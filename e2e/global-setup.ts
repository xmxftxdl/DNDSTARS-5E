import { mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export default async function globalSetup() {
  const roots = [
    path.join(os.tmpdir(), 'stars-app-e2e-shared'),
    path.join(os.tmpdir(), 'stars-app-e2e-plugin-review'),
  ]
  await Promise.all(roots.map(async (root) => {
    await rm(root, { recursive: true, force: true })
    await mkdir(root, { recursive: true })
  }))
}
