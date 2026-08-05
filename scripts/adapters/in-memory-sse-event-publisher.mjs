import { assertEventPublisherPort } from '../ports/event-publisher.mjs'
import { observeServerOperation } from '../ports/server-telemetry.mjs'

/** In-process SSE adapter behind the application-facing EventPublisher port. */
export function createInMemorySseEventPublisher(options) {
  const {
    eventClients, eventBacklog, storageKey, projectPayload, replaySlice,
    pushBacklog, capChannels, channelLimit, streamId, currentSequence,
    nextSequence, now = Date.now, heartbeatMs = 15_000, telemetry,
  } = options

  const publishToChannel = (channel, payload) => {
    const startedAt = performance.now()
    let outcome = 'success'
    try {
    const key = storageKey(channel)
    const backlog = pushBacklog(eventBacklog.get(key) ?? [], payload)
    eventBacklog.delete(key)
    eventBacklog.set(key, backlog)
    capChannels(eventBacklog, channelLimit, new Set(eventClients.keys()))
    const clients = eventClients.get(key)
    if (!clients) return
    for (const client of clients) {
      const projected = projectPayload(channel, payload, client._starsEventViewer)
      if (projected !== undefined) client.write(`event: message\ndata: ${JSON.stringify(projected)}\n\n`)
    }
    } catch (error) {
      outcome = 'failure'
      throw error
    } finally {
      observeServerOperation(telemetry, {
        operation: 'sse.publish',
        durationMs: Math.max(0, performance.now() - startedAt),
        outcome,
        observedAt: now(),
        attributes: { channel },
      })
    }
  }

  const port = {
    subscribe(channel, res, viewer) {
      const key = storageKey(channel)
      const clients = eventClients.get(key) ?? new Set()
      res._starsEventViewer = viewer
      clients.add(res)
      eventClients.set(key, clients)
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      res.flushHeaders?.()
      res.write(`event: ready\ndata: ${JSON.stringify({ channel, streamId, sequence: currentSequence() })}\n\n`)
      for (const payload of replaySlice(eventBacklog.get(key) ?? [])) {
        const projected = projectPayload(channel, payload, viewer)
        if (projected !== undefined) res.write(`event: message\ndata: ${JSON.stringify(projected)}\n\n`)
      }
      const heartbeat = setInterval(() => {
        if (!res.destroyed && !res.writableEnded) res.write(`: heartbeat ${now()}\n\n`)
      }, heartbeatMs)
      heartbeat.unref?.()
      let removed = false
      return () => {
        if (removed) return
        removed = true
        clearInterval(heartbeat)
        delete res._starsEventViewer
        clients.delete(res)
        if (clients.size === 0) eventClients.delete(key)
      }
    },
    publish(channel, payload) {
      publishToChannel(channel, payload)
      if (channel !== '_all') {
        publishToChannel('_all', {
          channel, payload, sequence: nextSequence(), streamId, emittedAt: now(),
        })
      }
    },
    publishBestEffort(channel, payload) {
      try {
        port.publish(channel, payload)
        return true
      } catch {
        return false
      }
    },
  }
  return assertEventPublisherPort(port)
}
