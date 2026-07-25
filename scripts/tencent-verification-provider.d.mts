export interface TencentVerificationCapabilities {
  email: boolean
  phone: boolean
}

export interface TencentCloudApiRequest {
  url: string
  body: string
  headers: Record<string, string>
}

export function tencentVerificationCapabilities(
  env?: Record<string, string | undefined>,
): TencentVerificationCapabilities

export function buildTencentCloudApiRequest(input: {
  endpoint: string
  service: string
  action: string
  version: string
  region?: string
  payload: unknown
  secretId: string
  secretKey: string
  timestamp?: number
}): TencentCloudApiRequest

export function deliverTencentVerification(
  channel: 'email' | 'phone',
  destination: string,
  code: string,
  options?: {
    env?: Record<string, string | undefined>
    fetchImpl?: typeof fetch
    timestamp?: number
  },
): Promise<void>
