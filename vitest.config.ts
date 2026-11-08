import { configDefaults, defineConfig } from 'vitest/config'
import { privateFixtureManifest, privateFixtureSelection } from './scripts/testing/private-fixtures.mjs'

const privateOnly = process.env.STARS_TEST_PRIVATE === '1'
const { unavailableSuites, missingInputs } = privateFixtureSelection()
if (privateOnly && missingInputs.length) throw new Error('Private acceptance inputs are missing; run npm run test:private for the input list.')
if (!privateOnly && unavailableSuites.length) {
  console.warn(`[private-fixtures] ${unavailableSuites.length} private acceptance suites unavailable (${missingInputs.length} local inputs missing). These are not passing results. Restore the inputs and run npm run test:private.`)
}

export default defineConfig({
  test: {
    include: privateOnly ? Object.keys(privateFixtureManifest) : ['src/**/*.test.{ts,tsx}', 'local-content/**/*.test.{ts,tsx}'],
    exclude: [...configDefaults.exclude, ...(!privateOnly ? unavailableSuites : [])],
    // Authenticated HTTP fixtures install rule bundles before making real requests.
    testTimeout: 30_000,
    environment: 'node',
  },
})
