import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import MapCanvas from '../../src/components/map/MapCanvas'
import { createEmptyMapGeometry, type MapGeometryEntity, type MapGeometryPoint } from '../../src/lib/mapGeometry'

declare global {
  interface Window {
    wallGestureCommits: MapGeometryEntity[]
    wallGestureEdits: { id: string; points: MapGeometryPoint[] }[]
  }
}

const map = { id: 'wall-gesture-regression', name: 'Walls', width: 1000, height: 800,
  gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [] }
window.wallGestureCommits = []
window.wallGestureEdits = []

function WallGestureFixture() {
  const [geometry, setGeometry] = useState(createEmptyMapGeometry(map.id))
  const [selected, setSelected] = useState<string | null>(null)
  return <div style={{ width: 1000, height: 800 }}>
    <MapCanvas map={map} isDM selectedTokenId={null} onSelectToken={() => undefined}
      geometry={geometry} geometryEditMode geometryTool="wall" geometrySnapToGrid={false}
      selectedGeometryEntityId={selected} onGeometryEntitySelect={setSelected}
      onGeometryEntityCommit={(entity) => {
        if (entity.kind !== 'wall') throw new Error('Expected a wall')
        window.wallGestureCommits.push(entity)
        setGeometry((current) => ({ ...current, walls: [...current.walls, entity] }))
        setSelected(entity.id)
      }}
      onGeometryEntityPointsChange={(id, points) => {
        window.wallGestureEdits.push({ id, points })
        setGeometry((current) => ({ ...current, walls: current.walls.map((wall) => wall.id === id ? { ...wall, points } : wall) }))
      }} />
  </div>
}

createRoot(document.getElementById('root')!).render(<WallGestureFixture />)
