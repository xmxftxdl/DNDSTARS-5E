import {
  createEmptyMapGeometry,
  mapGeometryAttachOpeningToWall,
  mapGeometryRelationshipIssues,
  migrateMapGeometryV3,
  type MapGeometryDoor,
  type MapGeometryLight,
  type MapGeometryPoint,
  type MapGeometryState,
  type MapGeometryWall,
} from './mapGeometry'

interface UvttPoint { x: number; y: number }

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function point(value: unknown): UvttPoint | undefined {
  const raw = record(value)
  return raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)
    ? { x: Number(raw.x), y: Number(raw.y) }
    : undefined
}

function points(value: unknown): UvttPoint[] {
  if (!Array.isArray(value)) return []
  return value.map(point).filter((entry): entry is UvttPoint => !!entry)
}

function farthestPair(entries: UvttPoint[]): [UvttPoint, UvttPoint] | undefined {
  let best: { pair: [UvttPoint, UvttPoint]; distance: number } | undefined
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const distance = Math.hypot(entries[right].x - entries[left].x, entries[right].y - entries[left].y)
      if (!best || distance > best.distance) best = { pair: [entries[left], entries[right]], distance }
    }
  }
  return best?.pair
}

export interface UvttImportOptions {
  mapId: string
  targetWidth?: number
  targetHeight?: number
  feetPerCell?: number
  now?: number
}

export interface UvttImportResult {
  geometry: MapGeometryState
  sourceWidth: number
  sourceHeight: number
  pixelsPerGrid: number
  warnings: string[]
  embeddedImageDataUrl?: string
}

function normalizeUvttEmbeddedImage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(trimmed)) return trimmed
  const mime = trimmed.startsWith('iVBORw0KGgo')
    ? 'image/png'
    : trimmed.startsWith('UklGR')
      ? 'image/webp'
      : trimmed.startsWith('/9j/')
        ? 'image/jpeg'
        : undefined
  return mime && /^[a-zA-Z0-9+/=\s]+$/.test(trimmed)
    ? `data:${mime};base64,${trimmed.replace(/\s/g, '')}`
    : undefined
}

export function importUvttGeometry(value: unknown, options: UvttImportOptions): UvttImportResult {
  const raw = record(value)
  if (!raw) throw new Error('UVTT 文件必须是 JSON 对象')
  const resolution = record(raw.resolution)
  if (!resolution) throw new Error('UVTT 缺少 resolution')
  const mapOrigin = point(resolution.map_origin) ?? { x: 0, y: 0 }
  const mapSize = point(resolution.map_size)
  const pixelsPerGrid = Number(resolution.pixels_per_grid)
  if (!mapSize || !Number.isFinite(pixelsPerGrid) || pixelsPerGrid <= 0) {
    throw new Error('UVTT resolution.map_size 或 pixels_per_grid 无效')
  }
  const sourceWidth = mapSize.x * pixelsPerGrid
  const sourceHeight = mapSize.y * pixelsPerGrid
  const scaleX = options.targetWidth && sourceWidth > 0 ? options.targetWidth / sourceWidth : 1
  const scaleY = options.targetHeight && sourceHeight > 0 ? options.targetHeight / sourceHeight : 1
  const convert = (entry: UvttPoint): MapGeometryPoint => ({
    x: (entry.x - mapOrigin.x) * pixelsPerGrid * scaleX,
    y: (entry.y - mapOrigin.y) * pixelsPerGrid * scaleY,
  })
  const now = options.now ?? Date.now()
  const geometry = createEmptyMapGeometry(options.mapId, now)
  const warnings: string[] = []
  const sightLines = [
    ...(Array.isArray(raw.line_of_sight) ? raw.line_of_sight : []),
    ...(Array.isArray(raw.objects_line_of_sight) ? raw.objects_line_of_sight : []),
  ]
  geometry.walls = sightLines.flatMap((line, index) => {
    const converted = points(line).map(convert)
    if (converted.length < 2) {
      warnings.push(`忽略第 ${index + 1} 条无效墙线`)
      return []
    }
    const wall: MapGeometryWall = {
      id: `uvtt:wall:${index}`,
      kind: 'wall',
      label: `导入墙 ${index + 1}`,
      points: converted,
      edgeIds: converted.slice(0, -1).map((_, edgeIndex) => `uvtt:wall:${index}:edge:${edgeIndex}`),
      material: 'stone',
      blocksVision: true,
      blocksMovement: true,
      blocksLineOfEffect: true,
      baseHeightFeet: 0,
      heightFeet: 10,
      createdAt: now + index,
    }
    return [wall]
  })
  const embeddedImageDataUrl = normalizeUvttEmbeddedImage(raw.image)
  geometry.doors = (Array.isArray(raw.portals) ? raw.portals : []).flatMap((portalValue, index) => {
    const portal = record(portalValue)
    if (!portal) return []
    const pair = farthestPair(points(portal.bounds))
    if (!pair) {
      warnings.push(`忽略第 ${index + 1} 个无有效 bounds 的门`)
      return []
    }
    const converted = [convert(pair[0]), convert(pair[1])] as [MapGeometryPoint, MapGeometryPoint]
    const attachment = mapGeometryAttachOpeningToWall(
      geometry,
      converted[0],
      converted[1],
      Math.max(4, pixelsPerGrid * Math.max(scaleX, scaleY) * 0.2),
    )
    const open = portal.closed === false
    const door: MapGeometryDoor = {
      id: `uvtt:door:${index}`,
      kind: 'door',
      label: `导入门 ${index + 1}`,
      points: attachment?.points ?? converted,
      ...(attachment ?? {}),
      state: open ? 'open' : 'closed',
      openState: open ? 'open' : 'closed',
      lockState: 'unlocked',
      physicalState: 'intact',
      secret: false,
      blocksVision: true,
      blocksMovement: true,
      blocksLineOfEffect: true,
      baseHeightFeet: 0,
      heightFeet: 10,
      createdAt: now + geometry.walls.length + index,
    }
    if (!attachment) warnings.push(`门 ${index + 1} 未找到邻近墙段，按独立门导入`)
    return [door]
  })
  geometry.lights = (Array.isArray(raw.lights) ? raw.lights : []).flatMap((lightValue, index) => {
    const light = record(lightValue)
    const position = point(light?.position)
    if (!light || !position) return []
    const rangeInCells = Number(light.range)
    if (!Number.isFinite(rangeInCells) || rangeInCells <= 0) return []
    const color = typeof light.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(light.color)
      ? light.color.toLowerCase()
      : '#fbbf24'
    const rangeFeet = rangeInCells * Math.max(1, options.feetPerCell ?? 5)
    const imported: MapGeometryLight = {
      id: `uvtt:light:${index}`,
      kind: 'light',
      label: `导入光源 ${index + 1}`,
      points: [convert(position)],
      enabled: true,
      brightRadiusFeet: rangeFeet / 2,
      dimRadiusFeet: rangeFeet / 2,
      color,
      elevationFeet: 5,
      createdAt: now + geometry.walls.length + geometry.doors.length + index,
      sourceKind: 'permanent',
    }
    return [imported]
  })
  const migrated = migrateMapGeometryV3(geometry)
  const issues = mapGeometryRelationshipIssues(migrated)
  if (issues.length > 0) {
    throw new Error(`UVTT 几何关系无效：${issues.map((issue) => issue.code).join(', ')}`)
  }
  return { geometry: migrated, sourceWidth, sourceHeight, pixelsPerGrid, warnings, embeddedImageDataUrl }
}

export function uvttEmbeddedImageBlob(dataUrl: string): Blob {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) throw new Error('UVTT 嵌入图片格式无效')
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: match[1] })
}
