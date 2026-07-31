import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const LATENCY_BUCKETS_MS = [10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000]
const MAX_METRIC_SERIES = 2_000

function safeRoute(pathname) {
  return String(pathname ?? '/')
    .slice(0, 240)
    .split('/')
    .map((segment) => {
      if (/^[A-HJ-NP-Z2-9]{6,12}$/.test(segment)) return ':id'
      if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)) return ':uuid'
      if (segment.length > 32 || /\d{6,}/.test(segment)) return ':id'
      return segment
    })
    .join('/')
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left ?? ''))
  const b = Buffer.from(String(right ?? ''))
  return a.length === b.length && timingSafeEqual(a, b)
}

function prometheusLabel(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

function metricLabels(labels) {
  const entries = Object.entries(labels)
  if (entries.length === 0) return ''
  return `{${entries.map(([key, value]) => `${key}="${prometheusLabel(value)}"`).join(',')}}`
}

export class ServerObservability {
  constructor(options = {}) {
    this.service = options.service ?? 'dndstars-5e-shared'
    this.buildId = options.buildId ?? 'development'
    this.startedAt = options.startedAt ?? Date.now()
    this.requestTotals = new Map()
    this.latencyBuckets = new Map()
    this.inFlight = 0
    this.lastReady = true
    this.lastReadyCheckAt = 0
    this.lastReadyError = ''
    this.alertLastSentAt = new Map()
    this.droppedMetricSeries = 0
  }

  log(level, event, fields = {}) {
    const record = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      buildId: this.buildId,
      event,
      ...fields,
    }
    const output = `${JSON.stringify(record)}\n`
    if (level === 'error' || level === 'warn') process.stderr.write(output)
    else process.stdout.write(output)
  }

  observeRequest(req, res, parsed) {
    const started = process.hrtime.bigint()
    const requestId = String(req.headers['x-request-id'] ?? randomUUID()).slice(0, 120)
    const route = safeRoute(parsed.pathname)
    const method = String(req.method ?? 'GET').toUpperCase()
    res.setHeader('X-Request-Id', requestId)
    this.inFlight += 1
    let completed = false
    const finish = () => {
      if (completed) return
      completed = true
      this.inFlight = Math.max(0, this.inFlight - 1)
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000
      const status = Number(res.statusCode || 500)
      const statusClass = `${Math.floor(status / 100)}xx`
      let key = JSON.stringify({ method, route, statusClass })
      if (!this.requestTotals.has(key) && this.requestTotals.size >= MAX_METRIC_SERIES) {
        key = JSON.stringify({ method, route: ':overflow', statusClass })
        this.droppedMetricSeries += 1
      }
      this.requestTotals.set(key, (this.requestTotals.get(key) ?? 0) + 1)
      let latencyKey = JSON.stringify({ method, route })
      if (!this.latencyBuckets.has(latencyKey) && this.latencyBuckets.size >= MAX_METRIC_SERIES) {
        latencyKey = JSON.stringify({ method, route: ':overflow' })
      }
      const buckets = this.latencyBuckets.get(latencyKey) ?? {
        count: 0,
        sumMs: 0,
        buckets: LATENCY_BUCKETS_MS.map(() => 0),
      }
      buckets.count += 1
      buckets.sumMs += durationMs
      LATENCY_BUCKETS_MS.forEach((limit, index) => {
        if (durationMs <= limit) buckets.buckets[index] += 1
      })
      this.latencyBuckets.set(latencyKey, buckets)
      this.log(status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', 'http_request', {
        requestId,
        method,
        route,
        status,
        durationMs: Number(durationMs.toFixed(2)),
        ...(process.env.STARS_LOG_CLIENT_IP === 'true'
          ? { remoteAddress: req.socket?.remoteAddress ?? 'unknown' }
          : {}),
      })
      if (status >= 500) {
        void this.alert('http-5xx', {
          summary: `${method} ${route} returned ${status}`,
          requestId,
          status,
        })
      }
    }
    res.once('finish', finish)
    res.once('close', finish)
    return requestId
  }

  async checkReadiness(check) {
    try {
      const details = await check()
      this.lastReady = true
      this.lastReadyCheckAt = Date.now()
      this.lastReadyError = ''
      return { ready: true, details }
    } catch (error) {
      this.lastReady = false
      this.lastReadyCheckAt = Date.now()
      this.lastReadyError = String(error?.message ?? error).slice(0, 500)
      this.log('error', 'readiness_failed', { error: this.lastReadyError })
      void this.alert('readiness-failed', {
        summary: 'Astral Trace readiness check failed',
        error: this.lastReadyError,
      })
      return { ready: false, error: this.lastReadyError }
    }
  }

  async alert(kind, details) {
    const endpoint = String(process.env.STARS_ALERT_WEBHOOK_URL ?? '').trim()
    if (!endpoint) return
    const now = Date.now()
    const cooldownMs = Math.max(
      60_000,
      Number.parseInt(String(process.env.STARS_ALERT_COOLDOWN_MS ?? '300000'), 10) || 300_000,
    )
    if (now - (this.alertLastSentAt.get(kind) ?? 0) < cooldownMs) return
    this.alertLastSentAt.set(kind, now)
    const body = JSON.stringify({
      schemaVersion: 1,
      kind,
      service: this.service,
      buildId: this.buildId,
      occurredAt: now,
      details,
    })
    const secret = String(process.env.STARS_ALERT_WEBHOOK_SECRET ?? '')
    const signature = secret
      ? createHmac('sha256', secret).update(body).digest('hex')
      : ''
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(signature ? { 'X-Stars-Alert-Signature': signature } : {}),
        },
        body,
        signal: AbortSignal.timeout(5_000),
      })
      if (!response.ok) throw new Error(`alert-webhook-${response.status}`)
    } catch (error) {
      this.log('error', 'alert_delivery_failed', {
        kind,
        error: String(error?.message ?? error).slice(0, 300),
      })
    }
  }

  metrics(extra = {}) {
    const lines = [
      '# HELP astraltrace_process_uptime_seconds Process uptime in seconds.',
      '# TYPE astraltrace_process_uptime_seconds gauge',
      `astraltrace_process_uptime_seconds ${Math.max(0, Date.now() - this.startedAt) / 1_000}`,
      '# HELP astraltrace_http_requests_in_flight Current HTTP requests in flight.',
      '# TYPE astraltrace_http_requests_in_flight gauge',
      `astraltrace_http_requests_in_flight ${this.inFlight}`,
      '# HELP astraltrace_ready Whether dependencies passed the latest readiness check.',
      '# TYPE astraltrace_ready gauge',
      `astraltrace_ready ${this.lastReady ? 1 : 0}`,
      '# HELP astraltrace_metrics_series_dropped_total Metric series folded into overflow labels.',
      '# TYPE astraltrace_metrics_series_dropped_total counter',
      `astraltrace_metrics_series_dropped_total ${this.droppedMetricSeries}`,
      '# HELP astraltrace_http_requests_total HTTP request count.',
      '# TYPE astraltrace_http_requests_total counter',
    ]
    for (const [key, value] of this.requestTotals) {
      lines.push(`astraltrace_http_requests_total${metricLabels(JSON.parse(key))} ${value}`)
    }
    lines.push(
      '# HELP astraltrace_http_request_duration_ms HTTP request latency in milliseconds.',
      '# TYPE astraltrace_http_request_duration_ms histogram',
    )
    for (const [key, value] of this.latencyBuckets) {
      const labels = JSON.parse(key)
      value.buckets.forEach((count, index) => {
        lines.push(`astraltrace_http_request_duration_ms_bucket${metricLabels({
          ...labels,
          le: LATENCY_BUCKETS_MS[index],
        })} ${count}`)
      })
      lines.push(`astraltrace_http_request_duration_ms_bucket${metricLabels({ ...labels, le: '+Inf' })} ${value.count}`)
      lines.push(`astraltrace_http_request_duration_ms_sum${metricLabels(labels)} ${value.sumMs}`)
      lines.push(`astraltrace_http_request_duration_ms_count${metricLabels(labels)} ${value.count}`)
    }
    for (const [name, value] of Object.entries(extra)) {
      if (!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name) || !Number.isFinite(value)) continue
      lines.push(`${name} ${value}`)
    }
    return `${lines.join('\n')}\n`
  }

  metricsAuthorized(req) {
    const configured = String(process.env.STARS_METRICS_TOKEN ?? '')
    if (!configured) return process.env.NODE_ENV !== 'production'
    const authorization = String(req.headers.authorization ?? '')
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    const supplied = bearer || req.headers['x-stars-metrics-token']
    return constantTimeEqual(configured, supplied)
  }
}
