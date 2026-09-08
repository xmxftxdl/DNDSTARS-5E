const DEFAULT_INSTALLER_URL = 'https://github.com/xmxftxdl/DNDSTARS-5E/releases/latest/download/AstralTrace-Setup-x64.exe'
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/

function secureHttpsUrl(value) {
  try {
    const parsed = new URL(String(value ?? '').trim())
    return parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

export function desktopReleaseManifestFromEnvironment(env, protocolVersion) {
  const channel = String(env.STARS_DESKTOP_CHANNEL ?? 'beta').trim() || 'beta'
  const version = String(env.STARS_DESKTOP_CLIENT_VERSION ?? '').trim()
  const minimumShellVersion = String(env.STARS_DESKTOP_MINIMUM_SHELL_VERSION ?? '').trim()
  const url = secureHttpsUrl(env.STARS_DESKTOP_CLIENT_URL)
  const sha256 = String(env.STARS_DESKTOP_CLIENT_SHA256 ?? '').trim().toLowerCase()
  const signature = String(env.STARS_DESKTOP_CLIENT_SIGNATURE ?? '').trim()
  const installerUrl = secureHttpsUrl(env.STARS_DESKTOP_DOWNLOAD_URL) ?? DEFAULT_INSTALLER_URL
  const available = Boolean(
    VERSION_PATTERN.test(version) &&
    VERSION_PATTERN.test(minimumShellVersion) &&
    url &&
    SHA256_PATTERN.test(sha256),
  )
  if (!available) {
    return {
      schemaVersion: 1,
      service: 'astraltrace-desktop-client',
      available: false,
      channel,
      platform: 'win32',
      arch: 'x64',
      installerUrl,
    }
  }
  return {
    schemaVersion: 1,
    service: 'astraltrace-desktop-client',
    available: true,
    channel,
    platform: 'win32',
    arch: 'x64',
    version,
    protocolVersion,
    minimumShellVersion,
    publishedAt: String(env.STARS_DESKTOP_PUBLISHED_AT ?? '').trim() || undefined,
    package: {
      url,
      sha256,
      ...(signature ? { signature } : {}),
    },
    installerUrl,
  }
}
