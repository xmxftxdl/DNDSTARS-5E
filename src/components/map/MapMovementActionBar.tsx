import type { ReactNode } from 'react'

export default function MapMovementActionBar({ children }: { children: ReactNode }) {
  return <div data-testid="movement-action-bar" className="map-combat-action-bar border-sky-400/40">{children}</div>
}
