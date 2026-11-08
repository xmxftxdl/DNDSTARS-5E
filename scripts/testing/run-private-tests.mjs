import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { privateFixtureSelection } from './private-fixtures.mjs'

const { missingInputs } = privateFixtureSelection()
if (missingInputs.length) {
  console.error('Private acceptance tests require the following local inputs. No private tests were run:')
  for (const input of missingInputs) console.error(`- ${input}`)
  process.exit(2)
}
const require = createRequire(import.meta.url)
const cli = require.resolve('vitest/vitest.mjs')
const result = spawnSync(process.execPath, [cli, 'run', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, STARS_TEST_PRIVATE: '1' },
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
