export interface KernelPoint { x: number; y: number }
export interface KernelSegment {
  entityId: string
  entityKind: string
  wallEdgeId?: string
  a: KernelPoint
  b: KernelPoint
  blocksVision: boolean
  blocksMovement: boolean
  blocksLineOfEffect: boolean
  baseHeightFeet: number
  heightFeet: number
  cover?: string
}
export interface SegmentSpatialIndex {
  bucketSize: number
  buckets: Map<string, KernelSegment[]>
  segments: KernelSegment[]
}
export interface CompiledGeometry {
  geometry: unknown
  segments: KernelSegment[]
  index: SegmentSpatialIndex
}
export interface GeometryRelationshipIssue {
  code: string
  entityId?: string
  wallEdgeId?: string
}
export function projectPointToSegment(point: KernelPoint, a: KernelPoint, b: KernelPoint): { point: KernelPoint; t: number; distance: number }
export function interpolatePoint(a: KernelPoint, b: KernelPoint, t: number): KernelPoint
export function wallEdgeId(wall: any, segmentIndex: number): string
export function doorOpenState(door: any): 'open' | 'closed'
export function doorLockState(door: any): 'unlocked' | 'locked' | 'jammed'
export function doorPhysicalState(door: any): 'intact' | 'broken' | 'destroyed'
export function legacyDoorState(door: any): 'open' | 'closed' | 'locked'
export function openingIntervalOnWallSegment(opening: any, wall: any, segmentIndex: number): [number, number] | null
export function openingPoints(geometry: any, opening: any): KernelPoint[]
export function wallRenderSegments(geometry: any, wall: any): Array<{ wallId: string; wallEdgeId: string; wallSegmentIndex: number; a: KernelPoint; b: KernelPoint }>
export function effectiveGeometrySegments(geometry: any): KernelSegment[]
export function createSegmentSpatialIndex(segments: KernelSegment[], bucketSize?: number): SegmentSpatialIndex
export function querySegmentSpatialIndex(index: SegmentSpatialIndex, from: KernelPoint, to: KernelPoint): KernelSegment[]
export function querySegmentSpatialIndexBounds(index: SegmentSpatialIndex, bounds: { minX: number; minY: number; maxX: number; maxY: number }): KernelSegment[]
export function segmentIntersectionParameter(from: KernelPoint, to: KernelPoint, a: KernelPoint, b: KernelPoint): number | null
export function raycastGeometry(input: {
  geometry?: any
  compiled?: CompiledGeometry
  from: KernelPoint
  to: KernelPoint
  purpose: 'vision' | 'movement' | 'line-of-effect'
  fromElevationFeet?: number
  toElevationFeet?: number
  fromEyeHeightFeet?: number
  toEyeHeightFeet?: number
  ignoreStart?: boolean
}): { segment: KernelSegment; t: number } | null
export function compileGeometry(geometry: any, options?: { bucketSize?: number }): CompiledGeometry
export function compileGeometryCached(geometry: any, options?: { bucketSize?: number }): CompiledGeometry
export function validateGeometryRelationships(geometry: any): GeometryRelationshipIssue[]
export function validateGeometryStructure(geometry: any): GeometryRelationshipIssue[]
export function deriveRoomGraph(input: {
  geometry: any
  compiled?: CompiledGeometry
  width: number
  height: number
  cellSize?: number
}): {
  cellSize: number
  columns: number
  rows: number
  rooms: Array<{ id: string; cells: Array<{ col: number; row: number }>; touchesMapBoundary: boolean; sealed: boolean }>
  portals: Array<{ id: string; fromRoomId: string | null; toRoomId: string | null; open: boolean }>
  roomByCell: Map<string, string>
}
export function detectWallCandidatesFromRgba(input: {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
  sampleStride?: number
  darknessThreshold?: number
  edgeThreshold?: number
  edgePercentile?: number
  angleBins?: number
  minimumRun?: number
  region?: { x?: number; y?: number; width?: number; height?: number }
}): Array<{ a: KernelPoint; b: KernelPoint; confidence: number }>
