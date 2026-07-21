import { mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export default async function globalSetup() {
  const sharedRoot = path.join(os.tmpdir(), 'stars-app-e2e-shared')
  await rm(sharedRoot, { recursive: true, force: true })
  await mkdir(sharedRoot, { recursive: true })
}
