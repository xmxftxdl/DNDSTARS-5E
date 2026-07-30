export interface SharedSystemRouteResponse {
  status: number
  body: Record<string, unknown>
}

export interface SharedPublicSystemRouteInput {
  pathname: string
  method?: string
  rulesetId: string
  protocolVersion: number
  minimumClientProtocol: number
  buildId: string
  startedAt: number
  now?: number
}

export interface SharedAuthenticatedSystemRouteInput {
  pathname: string
  method?: string
  now?: number
}

export function sharedPublicSystemRoute(
  input: SharedPublicSystemRouteInput,
): SharedSystemRouteResponse | undefined

export function sharedAuthenticatedSystemRoute(
  input: SharedAuthenticatedSystemRouteInput,
): SharedSystemRouteResponse | undefined
