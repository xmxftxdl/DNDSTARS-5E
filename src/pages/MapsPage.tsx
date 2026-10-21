import MapsWorkspacePage from './MapsWorkspacePage'
import { memo } from 'react'

/**
 * Route shell for the map workspace.
 *
 * The route itself stays deliberately small; combat orchestration and the
 * tabletop runtime live in MapsWorkspacePage and its application coordinators.
 */
function MapsPage() {
  return <MapsWorkspacePage />
}

// App keeps this runtime mounted for combat processing across routes. Route
// changes must not rerender the entire tabletop; its own store subscriptions
// still deliver map, character and combat updates normally.
export default memo(MapsPage)
