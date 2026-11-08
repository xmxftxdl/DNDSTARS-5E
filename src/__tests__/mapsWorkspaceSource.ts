import { readFileSync } from 'node:fs'

/** Source guards follow both the workspace controller and its delegated view. */
export const mapsWorkspaceSource = [
  readFileSync(new URL('../pages/MapsWorkspacePage.tsx', import.meta.url), 'utf8'),
  readFileSync(new URL('../presentation/maps/MapsWorkspaceView.tsx', import.meta.url), 'utf8'),
].join('\n').replace(/\r\n/g, '\n')

export function readMapsWorkspaceSource(): string {
  return mapsWorkspaceSource
}
