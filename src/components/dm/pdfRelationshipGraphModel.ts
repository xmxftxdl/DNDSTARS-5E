import type {
  PdfNamedRecordV1,
  PdfPersonRecordV1,
  PdfRelationshipRecordV1,
  PdfSceneRecordV1,
  PdfSourceCitationV1,
} from '../../lib/pdfCampaignAnalysis'

export type PdfRelationshipNodeKind = 'person' | 'faction' | 'location' | 'unknown'
export type PdfRelationshipEdgeOrigin = 'explicit' | 'scene-location' | 'scene-cooccurrence' | 'text-reference'

export interface PdfRelationshipGraphNode {
  id: string
  kind: PdfRelationshipNodeKind
  name: string
  description: string
  citations: PdfSourceCitationV1[]
  role?: string
  appearance?: string
  personality?: string
  motivation?: string
  portraitDataUrl?: string
}

export interface PdfRelationshipGraphEdge {
  id: string
  sourceId: string
  targetId: string
  relationship: PdfRelationshipRecordV1
  inferred: boolean
  origin: PdfRelationshipEdgeOrigin
}

export interface PdfRelationshipGraphModel {
  nodes: PdfRelationshipGraphNode[]
  edges: PdfRelationshipGraphEdge[]
}

export interface PdfRelationshipGraphPoint {
  x: number
  y: number
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function nodeId(kind: PdfRelationshipNodeKind, name: string): string {
  return `${kind}:${normalizedName(name)}`
}

function namedNode(kind: Exclude<PdfRelationshipNodeKind, 'person' | 'unknown'>, record: PdfNamedRecordV1): PdfRelationshipGraphNode {
  return {
    id: nodeId(kind, record.name),
    kind,
    name: record.name,
    description: record.description,
    citations: record.citations,
  }
}

function personNode(record: PdfPersonRecordV1): PdfRelationshipGraphNode {
  return {
    id: nodeId('person', record.name),
    kind: 'person',
    name: record.name,
    description: record.description,
    citations: record.citations,
    role: record.role,
    appearance: record.appearance,
    personality: record.personality,
    motivation: record.motivation,
    portraitDataUrl: record.portraitDataUrl,
  }
}

function personRecordLooksLikeFaction(record: PdfPersonRecordV1): boolean {
  const factionName = /(?:派|帮|会|盟|团|教团|教会|军团|组织|公会|家族|王国|帝国)$/u.test(record.name.trim())
  const factionDescription = /(?:势力|派系|组织|团体|帮派|阵营)/u.test(`${record.role} ${record.description}`)
  const hasPersonalDetail = Boolean(record.appearance?.trim() || record.personality?.trim() || record.voice?.trim())
  return factionDescription && (factionName || !hasPersonalDetail)
}

function unorderedPair(left: string, right: string): string {
  return left < right ? `${left}\u0000${right}` : `${right}\u0000${left}`
}

export function buildPdfRelationshipGraphModel(input: {
  people: readonly PdfPersonRecordV1[]
  factions: readonly PdfNamedRecordV1[]
  locations: readonly PdfNamedRecordV1[]
  relationships: readonly PdfRelationshipRecordV1[]
  scenes?: readonly PdfSceneRecordV1[]
}): PdfRelationshipGraphModel {
  const nodes = new Map<string, PdfRelationshipGraphNode>()
  const aliases = new Map<string, string>()
  const edges: PdfRelationshipGraphEdge[] = []
  const seenEdges = new Set<string>()
  const explicitPairs = new Set<string>()

  const register = (node: PdfRelationshipGraphNode) => {
    nodes.set(node.id, node)
    if (!aliases.has(normalizedName(node.name))) aliases.set(normalizedName(node.name), node.id)
  }

  input.people.forEach((record) => register(personRecordLooksLikeFaction(record)
    ? namedNode('faction', record)
    : personNode(record)))
  input.factions.forEach((record) => register(namedNode('faction', record)))
  input.locations.forEach((record) => register(namedNode('location', record)))
  for (const scene of input.scenes ?? []) {
    const sceneLocation = scene.location.trim()
    if (sceneLocation && !aliases.has(normalizedName(sceneLocation))) {
      register({
        id: nodeId('location', sceneLocation),
        kind: 'location',
        name: sceneLocation,
        description: `场景“${scene.name}”发生地点。`,
        citations: scene.citations,
      })
    }
  }

  const resolveEndpoint = (name: string, citations: readonly PdfSourceCitationV1[]): string | null => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const existing = aliases.get(normalizedName(trimmed))
    if (existing) return existing
    const id = nodeId('unknown', trimmed)
    if (!nodes.has(id)) {
      register({
        id,
        kind: 'unknown',
        name: trimmed,
        description: '关系或场景中出现了该名称，但当前分析没有足够证据确认其实体类型，需要 DM 确认。',
        citations: [...citations],
      })
    }
    return id
  }

  const pushEdge = (relationship: PdfRelationshipRecordV1, origin: PdfRelationshipEdgeOrigin) => {
    const sourceId = resolveEndpoint(relationship.from, relationship.citations)
    const targetId = resolveEndpoint(relationship.to, relationship.citations)
    if (!sourceId || !targetId || sourceId === targetId) return
    const key = `${sourceId}\u0000${targetId}\u0000${normalizedName(relationship.type)}`
    if (seenEdges.has(key)) return
    if (origin !== 'explicit' && explicitPairs.has(unorderedPair(sourceId, targetId))) return
    seenEdges.add(key)
    if (origin === 'explicit') explicitPairs.add(unorderedPair(sourceId, targetId))
    edges.push({
      id: `${origin}:${edges.length}:${sourceId}:${targetId}`,
      sourceId,
      targetId,
      relationship,
      inferred: origin !== 'explicit',
      origin,
    })
  }

  input.relationships.forEach((relationship) => pushEdge(relationship, 'explicit'))

  for (const scene of input.scenes ?? []) {
    const sceneLocation = scene.location.trim()
    const sceneNpcs = [...new Set(scene.npcs.map((name) => name.trim()).filter(Boolean))].slice(0, 10)
    if (sceneLocation) {
      sceneNpcs.forEach((npc) => pushEdge({
        from: npc,
        to: sceneLocation,
        type: '出现在',
        description: `人物与地点共同出现在场景“${scene.name}”中；这是系统根据场景字段推导的候选关系。`,
        citations: scene.citations,
      }, 'scene-location'))
    }
    for (let left = 0; left < sceneNpcs.length; left += 1) {
      for (let right = left + 1; right < sceneNpcs.length; right += 1) {
        pushEdge({
          from: sceneNpcs[left],
          to: sceneNpcs[right],
          type: '同场',
          description: `两者共同出现在场景“${scene.name}”中；这只表示共现，不代表友好或敌对。`,
          citations: scene.citations,
        }, 'scene-cooccurrence')
      }
    }
  }

  const knownNodes = [...nodes.values()]
  for (const source of knownNodes) {
    const sourceText = normalizedName([
      source.description,
      source.role,
      source.personality,
      source.motivation,
    ].filter(Boolean).join(' '))
    if (!sourceText) continue
    for (const target of knownNodes) {
      if (source.id === target.id || Array.from(target.name.trim()).length < 2) continue
      if (!sourceText.includes(normalizedName(target.name))) continue
      pushEdge({
        from: source.name,
        to: target.name,
        type: '文中关联',
        description: `“${source.name}”的档案正文提到了“${target.name}”；这是系统根据文本引用推导的候选关系。`,
        citations: source.citations,
      }, 'text-reference')
    }
  }

  return { nodes: [...nodes.values()], edges: edges.slice(0, 160) }
}

/**
 * Deterministic force layout. Keeping it pure makes the same analysis stable across
 * refreshes while still grouping well-connected entities near the centre.
 */
export function buildPdfRelationshipForceLayout(
  nodes: readonly PdfRelationshipGraphNode[],
  edges: readonly Pick<PdfRelationshipGraphEdge, 'sourceId' | 'targetId'>[],
  width = 1_100,
  height = 700,
): Map<string, PdfRelationshipGraphPoint> {
  const result = new Map<string, PdfRelationshipGraphPoint>()
  if (nodes.length === 0) return result

  const degree = new Map(nodes.map((node) => [node.id, 0]))
  edges.forEach((edge) => {
    degree.set(edge.sourceId, (degree.get(edge.sourceId) ?? 0) + 1)
    degree.set(edge.targetId, (degree.get(edge.targetId) ?? 0) + 1)
  })
  const ordered = [...nodes].sort((left, right) =>
    (degree.get(right.id) ?? 0) - (degree.get(left.id) ?? 0) || left.id.localeCompare(right.id))
  const centre = { x: width / 2, y: height / 2 }
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  ordered.forEach((node, index) => {
    const radius = index === 0 ? 0 : Math.min(width, height) * 0.38 * Math.sqrt(index / Math.max(1, nodes.length - 1))
    const angle = index * goldenAngle
    result.set(node.id, {
      x: centre.x + Math.cos(angle) * radius,
      y: centre.y + Math.sin(angle) * radius,
    })
  })

  const velocities = new Map(nodes.map((node) => [node.id, { x: 0, y: 0 }]))
  const margin = 76
  const targetEdgeLength = nodes.length > 30 ? 128 : 150
  for (let iteration = 0; iteration < 180; iteration += 1) {
    const forces = new Map(nodes.map((node) => [node.id, { x: 0, y: 0 }]))
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const leftPoint = result.get(nodes[left].id)!
        const rightPoint = result.get(nodes[right].id)!
        let dx = rightPoint.x - leftPoint.x
        let dy = rightPoint.y - leftPoint.y
        if (Math.abs(dx) + Math.abs(dy) < 0.01) {
          dx = ((left + 1) * 17 % 11) - 5
          dy = ((right + 1) * 23 % 13) - 6
        }
        const distanceSquared = Math.max(160, dx * dx + dy * dy)
        const distance = Math.sqrt(distanceSquared)
        const repulsion = (nodes.length > 32 ? 21_000 : 28_000) / distanceSquared
        const forceX = (dx / distance) * repulsion
        const forceY = (dy / distance) * repulsion
        forces.get(nodes[left].id)!.x -= forceX
        forces.get(nodes[left].id)!.y -= forceY
        forces.get(nodes[right].id)!.x += forceX
        forces.get(nodes[right].id)!.y += forceY
      }
    }
    edges.forEach((edge) => {
      const source = result.get(edge.sourceId)
      const target = result.get(edge.targetId)
      if (!source || !target) return
      const dx = target.x - source.x
      const dy = target.y - source.y
      const distance = Math.max(1, Math.hypot(dx, dy))
      const attraction = (distance - targetEdgeLength) * 0.012
      const forceX = (dx / distance) * attraction
      const forceY = (dy / distance) * attraction
      forces.get(edge.sourceId)!.x += forceX
      forces.get(edge.sourceId)!.y += forceY
      forces.get(edge.targetId)!.x -= forceX
      forces.get(edge.targetId)!.y -= forceY
    })

    nodes.forEach((node) => {
      const point = result.get(node.id)!
      const force = forces.get(node.id)!
      const centrality = Math.min(2.4, 0.65 + (degree.get(node.id) ?? 0) * 0.11)
      force.x += (centre.x - point.x) * 0.0025 * centrality
      force.y += (centre.y - point.y) * 0.0025 * centrality
      const velocity = velocities.get(node.id)!
      velocity.x = (velocity.x + force.x) * 0.78
      velocity.y = (velocity.y + force.y) * 0.78
      const maxStep = Math.max(1.3, 9 * (1 - iteration / 220))
      const speed = Math.max(1, Math.hypot(velocity.x, velocity.y))
      point.x = Math.max(margin, Math.min(width - margin, point.x + velocity.x * Math.min(1, maxStep / speed)))
      point.y = Math.max(margin, Math.min(height - margin, point.y + velocity.y * Math.min(1, maxStep / speed)))
    })
  }

  // A final collision pass keeps the circular nodes and their labels readable.
  for (let pass = 0; pass < 14; pass += 1) {
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const leftPoint = result.get(nodes[left].id)!
        const rightPoint = result.get(nodes[right].id)!
        const dx = rightPoint.x - leftPoint.x
        const dy = rightPoint.y - leftPoint.y
        const distance = Math.max(0.1, Math.hypot(dx, dy))
        const minimum = 112
        if (distance >= minimum) continue
        const shift = (minimum - distance) / 2
        const unitX = dx / distance
        const unitY = dy / distance
        leftPoint.x = Math.max(margin, Math.min(width - margin, leftPoint.x - unitX * shift))
        leftPoint.y = Math.max(margin, Math.min(height - margin, leftPoint.y - unitY * shift))
        rightPoint.x = Math.max(margin, Math.min(width - margin, rightPoint.x + unitX * shift))
        rightPoint.y = Math.max(margin, Math.min(height - margin, rightPoint.y + unitY * shift))
      }
    }
  }

  return result
}
