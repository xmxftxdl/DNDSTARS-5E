import { mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export default async function globalSetup() {
  const e2ePortBase = Math.max(1_024, Number(process.env.STARS_E2E_PORT_BASE) || 6_173)
  const suffix = process.env.STARS_E2E_PORT_BASE ? `-${e2ePortBase}` : ''
  const roots = [
    path.join(os.tmpdir(), `stars-app-e2e-shared${suffix}`),
    path.join(os.tmpdir(), `stars-app-e2e-plugin-review${suffix}`),
  ]
  await Promise.all(roots.map(async (root) => {
    await rm(root, { recursive: true, force: true })
    await mkdir(root, { recursive: true })
  }))
}
