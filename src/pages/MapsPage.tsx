import MapsWorkspacePage from './MapsWorkspacePage'

/**
 * Route shell for the map workspace.
 *
 * The route itself stays deliberately small; combat orchestration and the
 * tabletop runtime live in MapsWorkspacePage and its application coordinators.
 */
export default function MapsPage() {
  return <MapsWorkspacePage />
}
