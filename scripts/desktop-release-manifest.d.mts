export interface DesktopReleaseManifestUnavailable {
  schemaVersion: 1
  service: 'astraltrace-desktop-client'
  available: false
  channel: string
  platform: 'win32'
  arch: 'x64'
  installerUrl: string
}

export interface DesktopReleaseManifestAvailable {
  schemaVersion: 1
  service: 'astraltrace-desktop-client'
  available: true
  channel: string
  platform: 'win32'
  arch: 'x64'
  version: string
  protocolVersion: number
  minimumShellVersion: string
  publishedAt?: string
  package: {
    url: string
    sha256: string
    signature?: string
  }
  installerUrl: string
}

export type DesktopReleaseManifest = DesktopReleaseManifestUnavailable | DesktopReleaseManifestAvailable

export function desktopReleaseManifestFromEnvironment(
  env: Record<string, string | undefined>,
  protocolVersion: number,
): DesktopReleaseManifest
