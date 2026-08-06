export function productionSecurityEnabled(env = process.env) {
  const explicit = String(env.STARS_SECURITY_MODE ?? '').trim().toLowerCase()
  if (explicit === 'production') return true
  if (explicit === 'development' || explicit === 'test') return false
  return env.NODE_ENV === 'production'
}

export function normalizedHttpOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = new URL(value.trim())
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null
    if (parsed.pathname !== '/' && parsed.pathname !== '') return null
    return parsed.origin
  } catch {
    return null
  }
}

export function validateProductionSecurityConfig(env = process.env) {
  if (!productionSecurityEnabled(env)) return { ok: true, production: false, errors: [] }
  const errors = []
  const publicOrigin = normalizedHttpOrigin(env.STARS_PUBLIC_ORIGIN)
  if (!publicOrigin) errors.push('STARS_PUBLIC_ORIGIN must be an absolute http(s) origin')
  if (
    publicOrigin?.startsWith('http://') &&
    !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(publicOrigin)
  ) {
    errors.push('STARS_PUBLIC_ORIGIN must use https outside localhost')
  }
  if (typeof env.STARS_SHARED_ROOT !== 'string' || !env.STARS_SHARED_ROOT.trim()) {
    errors.push('STARS_SHARED_ROOT must point to persistent storage')
  }
  const configuredOrigins = String(env.STARS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  if (configuredOrigins.includes('*')) errors.push('STARS_ALLOWED_ORIGINS cannot contain * in production')
  for (const origin of configuredOrigins) {
    if (!normalizedHttpOrigin(origin)) errors.push(`invalid STARS_ALLOWED_ORIGINS entry: ${origin}`)
  }
  if (String(env.STARS_ACCOUNT_STORAGE ?? '').trim().toLowerCase() === 'postgres') {
    try {
      const databaseUrl = new URL(String(env.STARS_DATABASE_URL ?? ''))
      if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
        errors.push('STARS_DATABASE_URL must use postgresql://')
      }
      if (
        !databaseUrl.password ||
        databaseUrl.password.length < 16 ||
        databaseUrl.password === 'development-only-change-me'
      ) {
        errors.push('PostgreSQL password must be a non-default secret of at least 16 characters')
      }
    } catch {
      errors.push('STARS_DATABASE_URL must be a valid PostgreSQL connection URL')
    }
  }
  return {
    ok: errors.length === 0,
    production: true,
    publicOrigin,
    allowedOrigins: [...new Set([publicOrigin, ...configuredOrigins.map(normalizedHttpOrigin)].filter(Boolean))],
    errors,
  }
}

export function applySecurityHeaders(res, options = {}) {
  const env = options.env ?? process.env
  const production = options.production ?? productionSecurityEnabled(env)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=(), usb=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  // The 3D dice renderer is an application-owned iframe, so same-origin
  // framing must remain available while third-party framing stays blocked.
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  if (!production) return
  const liveKitConnectSource = (() => {
    try {
      const parsed = new URL(String(env.STARS_LIVEKIT_URL ?? '').trim())
      return parsed.protocol === 'wss:' || parsed.protocol === 'ws:' ? parsed.origin : null
    } catch {
      return null
    }
  })()
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "frame-src 'self'",
      `connect-src 'self'${liveKitConnectSource ? ` ${liveKitConnectSource}` : ''}`,
    ].join('; '),
  )
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
}

export function applyCors(req, res, env = process.env) {
  const origin = typeof req?.headers?.origin === 'string' ? req.headers.origin : null
  const production = productionSecurityEnabled(env)
  const publicOrigin = normalizedHttpOrigin(env.STARS_PUBLIC_ORIGIN)
  const configured = String(env.STARS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(normalizedHttpOrigin)
    .filter(Boolean)
  const allowedOrigins = new Set([publicOrigin, ...configured].filter(Boolean))
  if (origin) {
    if (production && !allowedOrigins.has(origin)) return false
    if (!production && allowedOrigins.size > 0 && !allowedOrigins.has(origin)) return false
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins.size > 0 ? origin : '*')
    if (allowedOrigins.size > 0) res.setHeader('Vary', 'Origin')
  } else if (!production && allowedOrigins.size === 0) {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key, X-Stars-Command-Id, X-Stars-Command-Source, X-Stars-Secret, X-Stars-Token, X-Stars-Account-Token, X-Stars-Member, X-Stars-Room-Token, X-Stars-Protocol, X-Stars-Writer, X-Stars-Expected-Revision, X-Stars-Undo-Group, X-Stars-Undo-Label, X-Stars-Image-Purpose, X-Stars-Plugin-Version, X-Stars-Plugin-Integrity, X-Stars-Plugin-Filename, X-Stars-Plugin-Name, X-Stars-Plugin-Publisher, X-Stars-Plugin-License, X-Stars-Plugin-Distribution-Policy, X-Stars-Plugin-State-Schema, X-Stars-Plugin-Api-Version, X-Stars-Plugin-Ruleset, X-Stars-Plugin-Description, X-Stars-Plugin-Metadata')
  res.setHeader('Access-Control-Expose-Headers', 'X-Stars-State-Revision, X-Stars-Plugin-Version, X-Stars-Plugin-Integrity, X-Stars-Plugin-Filename, X-Stars-Plugin-Name, X-Stars-Plugin-Publisher, X-Stars-Plugin-License, X-Stars-Plugin-Distribution-Policy, X-Stars-Plugin-State-Schema, X-Stars-Plugin-Api-Version, X-Stars-Plugin-Ruleset, X-Stars-Plugin-Description, X-Stars-Plugin-Metadata')
  return true
}
