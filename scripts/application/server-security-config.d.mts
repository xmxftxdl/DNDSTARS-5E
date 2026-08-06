export function productionSecurityEnabled(env?: NodeJS.ProcessEnv): boolean
export function normalizedHttpOrigin(value: unknown): string | null
export function validateProductionSecurityConfig(env?: NodeJS.ProcessEnv): {
  ok: boolean
  production: boolean
  publicOrigin?: string | null
  allowedOrigins?: string[]
  errors: string[]
}
export function applySecurityHeaders(
  response: { setHeader(name: string, value: string): void },
  options?: { production?: boolean; env?: Record<string, string | undefined> },
): void
