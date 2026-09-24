import type { StarScarPackageManifest } from './packageManifest'
export const packageFixture = (): StarScarPackageManifest => ({
  schemaVersion: 1, packageId: 'community.example', name: 'Example', author: 'Community', version: '1.0.0',
  minimumStarScarVersion: '0.1.0-beta.1', systemId: 'dnd5e', systemVersion: '2014',
  contentSource: 'Community', license: 'CC0-1.0', dependencies: [], permissions: ['compendium.write'], localizations: [],
})
