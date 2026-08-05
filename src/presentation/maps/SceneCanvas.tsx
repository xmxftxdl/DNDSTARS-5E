import { memo, type ComponentProps } from 'react'
import MapCanvas from '../../components/map/MapCanvas'

export type SceneCanvasProps = ComponentProps<typeof MapCanvas>

/** Konva scene boundary. It receives projections and emits interaction intents only. */
const SceneCanvas = memo(function SceneCanvas(props: SceneCanvasProps) {
  return <MapCanvas {...props} />
})

export default SceneCanvas
