import Constants from 'expo-constants'

function developmentHost(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? ''
  const host = hostUri.replace(/^https?:\/\//, '').split(':')[0]
  return host || '127.0.0.1'
}

export const defaultDemoServerUrl = `http://${developmentHost()}:8787`
export const defaultGameServerUrl = `http://${developmentHost()}:5273`

export function normalizeGameServerUrl(value: string): string {
  return value.trim().replace(/\/+$/, '').replace(/\/api$/, '')
}
