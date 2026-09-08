import type {
  AccountCampaignActiveSessionV1,
  AccountCampaignClueStateV1,
  AccountCampaignPersonStateV1,
  AccountCampaignPrepPlanDraftV1,
  AccountCampaignSessionReviewV1,
  AccountCampaignStoryWorkspaceV1,
  AccountStoryEventLinkConditionV1,
  AccountStoryEventLinkV1,
  AccountStoryEventV1,
} from '../../lib/accountApi'
import type {
  PdfCampaignAnalysisV2,
  PdfSceneRecordV2,
  PdfSourceCitationV2,
  PdfSourceEvidenceV2,
} from '../../lib/pdfCampaignAnalysisV2'
import type { CampaignJournalEntry } from '../../lib/roomCommunications'
import { synchronizeAnalysisStoryTimelineMarkers } from './dmStoryTimelineMarkers'

function normalizedKey(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\s·•・—_:：，。、“”‘’（）()【】[\]-]+/g, '')
}

function stableId(prefix: string, value: string): string {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function mergeStoryText(...values: readonly string[]): string {
  const blocks = values
    .flatMap((value) => value.split(/\n{2,}/g))
    .map((value) => value.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  return blocks.filter((block) => {
    const key = normalizedKey(block)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).join('\n\n')
}

function citationFromEvidence(evidence: PdfSourceEvidenceV2): PdfSourceCitationV2 {
  return {
    documentId: evidence.documentId,
    documentName: evidence.documentName,
    page: evidence.page,
    evidenceId: evidence.id,
    quote: evidence.quote,
    verification: evidence.verification,
    ...(evidence.sourceExtractionMethod ? { sourceExtractionMethod: evidence.sourceExtractionMethod } : {}),
    ...(evidence.sourceConfidence == null ? {} : { sourceConfidence: evidence.sourceConfidence }),
    ...(evidence.pageRegion ? { pageRegion: evidence.pageRegion } : {}),
  }
}

/**
 * Resolves the immutable PDF evidence behind a story node. The bookmark is a
 * projection of analysis citations, so graph editing never copies source text
 * into the synchronized campaign workspace.
 */
export function storyEventSourceCitations(
  event: AccountStoryEventV1,
  analysis: PdfCampaignAnalysisV2,
): PdfSourceCitationV2[] {
  const records = [
    ...(analysis.timelineEvents ?? []).filter((record) => event.sourceEventIds.includes(record.id)),
    ...(analysis.scenes ?? []).filter((record) => event.sceneIds.includes(record.id)),
  ]
  const evidenceById = new Map((analysis.evidence ?? []).map((evidence) => [evidence.id, evidence]))
  const citations = records.flatMap((record) => [
    ...record.citations,
    ...record.evidenceIds
      .filter((evidenceId) => !record.citations.some((citation) => citation.evidenceId === evidenceId))
      .map((evidenceId) => evidenceById.get(evidenceId))
      .filter((evidence): evidence is PdfSourceEvidenceV2 => Boolean(evidence))
      .map(citationFromEvidence),
  ])
  const seen = new Set<string>()
  return citations.filter((citation) => {
    const key = citation.evidenceId || `${citation.documentId}:${citation.page}:${citation.quote}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function storyDetailsFromRecord(record: PdfSceneRecordV2): string {
  const sections = [
    record.description,
    record.time ? `时间：${record.time}` : '',
    record.location ? `地点：${record.location}` : '',
    record.npcs.length > 0 ? `涉及人物：${record.npcs.join('、')}` : '',
    record.monsters.length > 0 ? `怪物与威胁：${record.monsters.join('、')}` : '',
    (record.causedBy?.length ?? 0) > 0 ? `直接前因：${record.causedBy!.join('、')}` : '',
    ...(record.causalBranches ?? []).map((branch) => `因果分支：${branch.sourceEvent} → ${branch.label || branch.condition || '无条件推进'}${branch.explanation ? `（${branch.explanation}）` : ''}`),
    record.causalExplanation?.trim() ? `因果说明：${record.causalExplanation.trim()}` : '',
    record.branchCondition?.trim() ? `分支条件：${record.branchCondition.trim()}` : '',
    (record.tags?.length ?? 0) > 0 ? `标签：${record.tags!.join('、')}` : '',
    ...record.citations.map((citation) => `来源：${citation.documentName} · 第 ${citation.page} 页\n${citation.quote}`),
  ]
  return mergeStoryText(...sections)
}

function entityIdsByNames(
  names: readonly string[],
  entities: ReadonlyArray<{ id: string; name: string; aliases: string[] }>,
): string[] {
  const keys = new Set(names.map(normalizedKey).filter(Boolean))
  return entities
    .filter((entity) => [entity.name, ...entity.aliases].some((name) => keys.has(normalizedKey(name))))
    .map((entity) => entity.id)
}

function mentionedEntityIds(
  text: string,
  entities: ReadonlyArray<{ id: string; name: string; aliases: string[] }>,
): string[] {
  const normalized = normalizedKey(text)
  return entities.filter((entity) => [entity.name, ...entity.aliases]
    .map(normalizedKey)
    .some((name) => name.length >= 2 && normalized.includes(name)))
    .map((entity) => entity.id)
}

function eventFromRecord(
  record: PdfSceneRecordV2,
  source: AccountStoryEventV1['source'],
  analysis: PdfCampaignAnalysisV2,
): AccountStoryEventV1 {
  const combined = `${record.name}\n${record.description}\n${record.location}\n${record.npcs.join(' ')}`
  return {
    id: stableId('story', `${source}:${record.id}`),
    title: record.name,
    summary: record.description,
    details: storyDetailsFromRecord(record),
    timeLabel: record.time ?? '',
    ...(record.gameTimeWorldMinute == null ? {} : { gameTimeWorldMinute: record.gameTimeWorldMinute }),
    ...(record.timelineOrder == null ? {} : { timelineOrder: record.timelineOrder }),
    ...(record.timelineKind == null ? {} : { timelineKind: record.timelineKind }),
    status: 'planned',
    source,
    sourceEventIds: source === 'analysis-timeline' ? [record.id] : [],
    sceneIds: source === 'analysis-scene' ? [record.id] : [],
    personIds: unique([
      ...entityIdsByNames(record.npcs, analysis.people),
      ...mentionedEntityIds(combined, analysis.people),
    ]),
    clueIds: mentionedEntityIds(combined, analysis.clues),
    tags: unique([...(record.tags ?? []), record.location].filter(Boolean)),
  }
}

function recordsDescribeSameEvent(event: AccountStoryEventV1, scene: PdfSceneRecordV2, analysis: PdfCampaignAnalysisV2): boolean {
  const eventName = normalizedKey(event.title)
  const sceneName = normalizedKey(scene.name)
  if (eventName === sceneName || (eventName.length >= 4 && sceneName.includes(eventName)) || (sceneName.length >= 4 && eventName.includes(sceneName))) return true
  const sourceTimeline = (analysis.timelineEvents ?? []).find((entry) => event.sourceEventIds.includes(entry.id))
  const sameLocation = normalizedKey(sourceTimeline?.location ?? '') === normalizedKey(scene.location)
  const timelinePeople = new Set(event.personIds)
  const sharesPerson = entityIdsByNames(scene.npcs, analysis.people).some((id) => timelinePeople.has(id))
  const sharesEvidence = sourceTimeline?.evidenceIds.some((id) => scene.evidenceIds.includes(id)) ?? false
  return (sameLocation && sharesPerson) || (sharesEvidence && (sameLocation || sharesPerson))
}

function timelineRecordsDescribeSameEvent(
  event: AccountStoryEventV1,
  record: PdfSceneRecordV2,
): boolean {
  const eventName = normalizedKey(event.title)
  const recordName = normalizedKey(record.name)
  if (eventName === recordName) return true
  if ((eventName.length >= 6 && recordName.includes(eventName)) || (recordName.length >= 6 && eventName.includes(recordName))) return true

  // 同一页、同一时间、地点和人物经常会连续发生多个事件。这些字段只能用于建立
  // 因果联系，不能作为去重依据；AI 明确给出的不同事件 ID 应默认保持独立。
  return false
}

function mergeAnalysisRecordIntoEvent(
  event: AccountStoryEventV1,
  record: PdfSceneRecordV2,
  source: AccountStoryEventV1['source'],
  analysis: PdfCampaignAnalysisV2,
): void {
  const next = eventFromRecord(record, source, analysis)
  event.sourceEventIds = unique([...event.sourceEventIds, ...next.sourceEventIds])
  event.sceneIds = unique([...event.sceneIds, ...next.sceneIds])
  event.personIds = unique([...event.personIds, ...next.personIds])
  event.clueIds = unique([...event.clueIds, ...next.clueIds])
  event.tags = unique([...event.tags, ...next.tags])
  // SOL timelineEvents own the event narrative. LUNA-extracted scenes are runnable
  // attachments and evidence bookmarks only; folding their prose into the event
  // would make the story workspace materially diverge from full-book synthesis.
  if (source === 'analysis-timeline') {
    event.summary = mergeStoryText(event.summary, next.summary)
    event.details = mergeStoryText(event.details, next.details)
  }
}

function graphPositionForIndex(index: number): { x: number; y: number } {
  return { x: 420, y: 56 + index * 232 }
}

function withGraphPositions(events: AccountStoryEventV1[]): AccountStoryEventV1[] {
  return events.map((event, index) => ({ ...event, graphPosition: event.graphPosition ?? graphPositionForIndex(index) }))
}

function defaultGraphLinks(events: readonly AccountStoryEventV1[]): AccountStoryEventLinkV1[] {
  return events.slice(1).map((event, index) => {
    const previous = events[index]!
    return {
      id: stableId('story-link', `${previous.id}:${event.id}:然后`),
      fromEventId: previous.id,
      toEventId: event.id,
      label: '',
      condition: { kind: 'always' },
    }
  })
}

function storyEventForTimelineRecord(events: readonly AccountStoryEventV1[], recordId: string): AccountStoryEventV1 | undefined {
  return events.find((event) => event.sourceEventIds.includes(recordId))
}

function personIdByName(analysis: PdfCampaignAnalysisV2, name: string): string | undefined {
  const key = normalizedKey(name)
  if (!key) return undefined
  return analysis.people.find((person) => [person.name, ...person.aliases].some((candidate) => normalizedKey(candidate) === key))?.id
}

function analysisCausalGraphLinks(
  analysis: PdfCampaignAnalysisV2 | null,
  events: readonly AccountStoryEventV1[],
): AccountStoryEventLinkV1[] {
  if (!analysis) return []
  const recordsByName = new Map<string, PdfSceneRecordV2>()
  for (const record of analysis.timelineEvents ?? []) recordsByName.set(normalizedKey(record.name), record)
  const links: AccountStoryEventLinkV1[] = []
  const seen = new Set<string>()
  for (const targetRecord of analysis.timelineEvents ?? []) {
    const targetEvent = storyEventForTimelineRecord(events, targetRecord.id)
    if (!targetEvent) continue
    const structuredBranches = new Map((targetRecord.causalBranches ?? []).map((branch) => [normalizedKey(branch.sourceEvent), branch]))
    const causeNames = unique([
      ...(targetRecord.causedBy ?? []),
      ...(targetRecord.causalBranches ?? []).map((branch) => branch.sourceEvent),
    ])
    for (const causeName of causeNames) {
      const causeRecord = recordsByName.get(normalizedKey(causeName))
      const sourceEvent = causeRecord ? storyEventForTimelineRecord(events, causeRecord.id) : undefined
      if (!sourceEvent || sourceEvent.id === targetEvent.id) continue
      const structured = structuredBranches.get(normalizedKey(causeName))
      const branchPerson = structured?.branchPerson || targetRecord.branchPerson || ''
      const branchPersonState = structured?.branchPersonState ?? targetRecord.branchPersonState
      const branchCondition = structured?.condition || targetRecord.branchCondition || ''
      const branchPersonId = branchPerson ? personIdByName(analysis, branchPerson) : undefined
      const condition: AccountStoryEventLinkConditionV1 = branchPersonId && (branchPersonState === 'dead' || branchPersonState === 'alive')
        ? { kind: 'person-state', personId: branchPersonId, state: branchPersonState }
        : branchCondition.trim()
          ? { kind: 'manual', expression: branchCondition.trim() }
          : { kind: 'always' }
      const key = `${sourceEvent.id}:${targetEvent.id}:${JSON.stringify(condition)}`
      if (seen.has(key)) continue
      seen.add(key)
      links.push({
        id: stableId('story-link', key),
        fromEventId: sourceEvent.id,
        toEventId: targetEvent.id,
        label: structured?.label?.trim() || structured?.explanation?.trim() || targetRecord.causalExplanation?.trim() || '',
        condition,
      })
    }
  }
  return links
}

function isLegacyLinearGraph(events: readonly AccountStoryEventV1[], links: readonly AccountStoryEventLinkV1[]): boolean {
  if (events.length < 2) return links.length === 0
  if (links.length !== events.length - 1) return false
  return events.slice(1).every((event, index) => links.some((link) => (
    link.id === stableId('story-link', `${events[index]!.id}:${event.id}:然后`) &&
    link.fromEventId === events[index]!.id &&
    link.toEventId === event.id &&
    (!link.condition || link.condition.kind === 'always')
  )))
}

/** Detects links generated by the removed “convert to one line” UI. */
function isRemovedSingleLineProjection(
  events: readonly AccountStoryEventV1[],
  links: readonly AccountStoryEventLinkV1[],
): boolean {
  if (events.length < 2 || links.length !== events.length - 1) return false
  const indexes = links.map((link) => link.id.match(/^story-link-[a-z0-9]+-(\d+)$/)?.[1])
  if (indexes.some((index) => index === undefined)) return false
  if (new Set(indexes).size !== links.length || !indexes.every((index) => Number(index) >= 0 && Number(index) < links.length)) return false
  const outgoing = new Map<string, string>()
  const incoming = new Set<string>()
  for (const link of links) {
    if (link.label.trim() || link.resolution || (link.condition && link.condition.kind !== 'always')) return false
    if (outgoing.has(link.fromEventId) || incoming.has(link.toEventId)) return false
    outgoing.set(link.fromEventId, link.toEventId)
    incoming.add(link.toEventId)
  }
  const roots = events.filter((event) => !incoming.has(event.id))
  if (roots.length !== 1) return false
  const visited = new Set<string>()
  let currentId: string | undefined = roots[0]!.id
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    currentId = outgoing.get(currentId)
  }
  return visited.size === events.length && currentId === undefined
}

function storyGraphLinksDiffer(
  left: readonly AccountStoryEventLinkV1[],
  right: readonly AccountStoryEventLinkV1[],
): boolean {
  const signature = (link: AccountStoryEventLinkV1) => JSON.stringify([
    link.fromEventId,
    link.toEventId,
    link.label.trim(),
    link.condition ?? { kind: 'always' },
  ])
  const leftSignatures = new Set(left.map(signature))
  return left.length !== right.length || right.some((link) => !leftSignatures.has(signature(link)))
}

export function canonicalStoryEvents(analysis: PdfCampaignAnalysisV2 | null): AccountStoryEventV1[] {
  if (!analysis) return []
  const events: AccountStoryEventV1[] = []
  for (const record of analysis.timelineEvents ?? []) {
    const matching = events.find((event) => timelineRecordsDescribeSameEvent(event, record))
    if (matching) mergeAnalysisRecordIntoEvent(matching, record, 'analysis-timeline', analysis)
    else events.push(eventFromRecord(record, 'analysis-timeline', analysis))
  }
  for (const scene of analysis.scenes) {
    const matching = events.find((event) => recordsDescribeSameEvent(event, scene, analysis))
    if (matching) mergeAnalysisRecordIntoEvent(matching, scene, 'analysis-scene', analysis)
  }
  return events.sort((left, right) => (
    (left.timelineOrder ?? Number.MAX_SAFE_INTEGER) - (right.timelineOrder ?? Number.MAX_SAFE_INTEGER)
    || (left.gameTimeWorldMinute ?? Number.MAX_SAFE_INTEGER) - (right.gameTimeWorldMinute ?? Number.MAX_SAFE_INTEGER)
  ))
}

export function createStoryWorkspace(analysis: PdfCampaignAnalysisV2 | null): AccountCampaignStoryWorkspaceV1 {
  const events = withGraphPositions(canonicalStoryEvents(analysis))
  const causalLinks = analysisCausalGraphLinks(analysis, events)
  const workspace: AccountCampaignStoryWorkspaceV1 = {
    schemaVersion: 1,
    mode: 'prep',
    events,
    graphLinks: causalLinks.length > 0 ? causalLinks : defaultGraphLinks(events),
    graphInitialized: true,
    graphEditedByDm: false,
    graphLayoutVersion: 2,
    timelineMarkers: synchronizeAnalysisStoryTimelineMarkers(events),
    personStates: [],
    clueStates: [],
    recaps: [],
  }
  return synchronizeStoryBranchEventStatuses(workspace)
}

export function synchronizeStoryWorkspace(
  workspace: AccountCampaignStoryWorkspaceV1 | undefined,
  analysis: PdfCampaignAnalysisV2 | null,
): AccountCampaignStoryWorkspaceV1 {
  if (!workspace) return createStoryWorkspace(analysis)
  const generated = canonicalStoryEvents(analysis)
  const currentSceneIds = new Set((analysis?.scenes ?? []).map((scene) => scene.id))
  const currentPersonIds = new Set((analysis?.people ?? []).map((person) => person.id))
  const currentClueIds = new Set((analysis?.clues ?? []).map((clue) => clue.id))
  const existingBySource = new Map(workspace.events
    .filter((event) => event.source === 'analysis-timeline' || event.source === 'analysis-scene')
    .flatMap((event) => (
      [...event.sourceEventIds, ...event.sceneIds].map((id) => [id, event] as const)
    )))
  const reusedExistingEventIds = new Set<string>()
  const merged = generated.map((event) => {
    const existing = [...event.sourceEventIds, ...event.sceneIds]
      .map((id) => existingBySource.get(id))
      .find((candidate) => candidate && !reusedExistingEventIds.has(candidate.id))
    if (existing) reusedExistingEventIds.add(existing.id)
    const splitFromLegacyMergedEvent = Boolean(existing && existing.sourceEventIds.length > event.sourceEventIds.length)
    const editedFields = new Set(existing?.dmEditedFields ?? [])
    return existing ? {
      ...event,
      id: existing.id,
      nodeKind: existing.nodeKind ?? event.nodeKind,
      status: existing.status,
      ...(existing.statusAutomation ? { statusAutomation: existing.statusAutomation } : {}),
      title: editedFields.has('title') ? existing.title : event.title,
      summary: !splitFromLegacyMergedEvent && editedFields.has('summary') ? existing.summary : event.summary,
      details: !splitFromLegacyMergedEvent && editedFields.has('details') ? existing.details : event.details,
      timeLabel: editedFields.has('timeLabel') ? existing.timeLabel : event.timeLabel,
      personIds: editedFields.has('personIds')
        ? unique(existing.personIds.filter((id) => currentPersonIds.has(id)))
        : event.personIds,
      clueIds: editedFields.has('clueIds')
        ? unique(existing.clueIds.filter((id) => currentClueIds.has(id)))
        : event.clueIds,
      // Scene attachment is always rebuilt from the latest analysis. Stale scene IDs
      // must not survive merely because an earlier projection happened to contain them.
      sceneIds: event.sceneIds.filter((id) => currentSceneIds.has(id)),
      tags: editedFields.has('tags') ? unique(existing.tags) : event.tags,
      ...(editedFields.size > 0 ? { dmEditedFields: [...editedFields] } : {}),
      graphPosition: existing.graphPosition ?? event.graphPosition,
    } : event
  })
  // Analysis-derived events are a projection of the current full-book timeline. Old scene-only
  // projections must not survive a refresh, otherwise every runnable scene reappears as a second
  // "unified event". DM and session-log events are authored state and remain independent.
  const retained = workspace.events.filter((event) => event.source === 'dm' || event.source === 'session-log')
  const events = withGraphPositions([...merged, ...retained.filter((event) => !merged.some((candidate) => candidate.id === event.id))])
  const eventIds = new Set(events.map((event) => event.id))
  const existingLinks = (workspace.graphLinks ?? [])
  const generatedSourceIds = new Set(generated.flatMap((event) => event.sourceEventIds))
  const legacyMergedProjectionDetected = workspace.events.some((event) => (
    event.source === 'analysis-timeline'
    && event.sourceEventIds.filter((id) => generatedSourceIds.has(id)).length > 1
  ))
  const causalLinks = analysisCausalGraphLinks(analysis, events)
  const inferredGraphEditedByDm = workspace.graphEditedByDm ?? (
    existingLinks.length > 0 && !isLegacyLinearGraph(workspace.events, existingLinks)
  )
  const validExistingLinks = existingLinks
    .filter((link) => eventIds.has(link.fromEventId) && eventIds.has(link.toEventId) && link.fromEventId !== link.toEventId)
    .map((link) => ({
        ...link,
        label: link.label === '然后' ? '' : link.label,
        condition: link.condition ?? (link.label && link.label !== '然后'
          ? { kind: 'manual' as const, expression: link.label }
          : { kind: 'always' as const }),
      }))
  // Older builds used graphEditedByDm=true both for a deliberate clear and for several migration
  // paths. That ambiguity persisted an accidental empty graph forever. Only the dedicated flag
  // introduced with the clear-all action is now allowed to suppress regenerated analysis links.
  const explicitlyClearedByDm = workspace.graphLinksClearedByDm === true && existingLinks.length === 0
  const staleEditedGraph = inferredGraphEditedByDm
    && !legacyMergedProjectionDetected
    && !explicitlyClearedByDm
    && validExistingLinks.length === 0
  const removedSingleLineProjectionDetected = inferredGraphEditedByDm
    && causalLinks.length > 0
    && isRemovedSingleLineProjection(workspace.events, existingLinks)
    && storyGraphLinksDiffer(validExistingLinks, causalLinks)
  const graphLinks = inferredGraphEditedByDm && !legacyMergedProjectionDetected && !staleEditedGraph && !removedSingleLineProjectionDetected
    ? validExistingLinks
    : causalLinks.length > 0 ? causalLinks : defaultGraphLinks(events)
  const synchronized: AccountCampaignStoryWorkspaceV1 = {
    ...workspace,
    events,
    graphLinks,
    graphInitialized: true,
    graphEditedByDm: staleEditedGraph || removedSingleLineProjectionDetected ? false : inferredGraphEditedByDm,
    graphLinksClearedByDm: explicitlyClearedByDm && graphLinks.length === 0,
    // Adopting SOL links must not move DM-positioned nodes. Only the old
    // over-merged-node migration needs a fresh automatic layout.
    ...(legacyMergedProjectionDetected || removedSingleLineProjectionDetected ? { graphLayoutVersion: 2 as const } : {}),
    timelineMarkers: synchronizeAnalysisStoryTimelineMarkers(events, workspace.timelineMarkers, {
      storyStartWorldMinute: workspace.storyStartWorldMinute,
      dismissedSourceKeys: workspace.dismissedTimelineMarkerSourceKeys,
    }),
  }
  return synchronizeStoryBranchEventStatuses(synchronized)
}

export type StoryLinkConditionResult = 'matched' | 'blocked' | 'manual'

export function evaluateStoryLinkCondition(
  link: AccountStoryEventLinkV1,
  workspace: AccountCampaignStoryWorkspaceV1,
): StoryLinkConditionResult {
  void workspace
  if (link.resolution === 'triggered') return 'matched'
  if (link.resolution === 'not-triggered') return 'blocked'
  const condition: AccountStoryEventLinkConditionV1 = link.condition ?? (
    link.label && link.label !== '然后'
      ? { kind: 'manual', expression: link.label }
      : { kind: 'always' }
  )
  if (condition.kind === 'always') return 'matched'
  // Legacy person/event conditions are retained only so old workspaces can recover their
  // descriptive text. Conditional branches are now resolved exclusively by the DM's
  // pending/triggered/not-triggered choice in the story editor.
  return 'manual'
}

export function storyEventAvailability(
  workspace: AccountCampaignStoryWorkspaceV1,
  eventId: string,
): 'available' | 'waiting' | 'blocked' {
  const byId = new Map(workspace.events.map((event) => [event.id, event]))
  const links = workspace.graphLinks ?? []
  const visiting = new Set<string>()
  const resolved = new Map<string, 'available' | 'waiting' | 'blocked'>()
  const visit = (id: string): 'available' | 'waiting' | 'blocked' => {
    const cached = resolved.get(id)
    if (cached) return cached
    if (visiting.has(id)) return 'waiting'
    visiting.add(id)
    const event = byId.get(id)
    if (event?.status === 'completed' || event?.status === 'active') {
      visiting.delete(id)
      resolved.set(id, 'available')
      return 'available'
    }
    const incoming = links.filter((link) => link.toEventId === id)
    if (incoming.length === 0) {
      visiting.delete(id)
      resolved.set(id, 'available')
      return 'available'
    }
    let hasWaitingRoute = false
    for (const link of incoming) {
      const condition = evaluateStoryLinkCondition(link, workspace)
      if (condition === 'blocked') continue
      const source = byId.get(link.fromEventId)
      if (!source || source.status === 'skipped' || source.status === 'not-triggered') continue
      if (source.status === 'completed') {
        if (condition === 'matched') {
          visiting.delete(id)
          resolved.set(id, 'available')
          return 'available'
        }
        hasWaitingRoute = true
        continue
      }
      if (visit(source.id) !== 'blocked') hasWaitingRoute = true
    }
    const result = hasWaitingRoute ? 'waiting' : 'blocked'
    visiting.delete(id)
    resolved.set(id, result)
    return result
  }
  return visit(eventId)
}

/**
 * Persists branch reachability as a reversible event status. A pending route keeps
 * the target waiting; only an event whose every route is blocked becomes untriggered.
 */
export function synchronizeStoryBranchEventStatuses(
  workspace: AccountCampaignStoryWorkspaceV1,
): AccountCampaignStoryWorkspaceV1 {
  const links = workspace.graphLinks ?? []
  // First clear previous automatic results in-memory. Reachability is then recomputed
  // from the current link rulings, which also restores an entire descendant chain in
  // one pass when an upstream branch becomes pending or triggered again.
  const baseEvents = workspace.events.map((event) => {
    if (event.statusAutomation !== 'branch') return event
    if (event.status === 'not-triggered') {
      const restored = { ...event, status: 'planned' as const }
      delete restored.statusAutomation
      return restored
    }
    const cleaned = { ...event }
    delete cleaned.statusAutomation
    return cleaned
  })
  const reachabilityWorkspace = { ...workspace, events: baseEvents }
  const events = baseEvents.map((event, index) => {
    const hasIncoming = links.some((link) => link.toEventId === event.id)
    const availability = hasIncoming ? storyEventAvailability(reachabilityWorkspace, event.id) : 'available'
    const next = availability === 'blocked' && event.status === 'planned'
      ? { ...event, status: 'not-triggered' as const, statusAutomation: 'branch' as const }
      : event
    const previous = workspace.events[index]
    return previous?.status === next.status && previous.statusAutomation === next.statusAutomation ? previous : next
  })
  return events.every((event, index) => event === workspace.events[index]) ? workspace : { ...workspace, events }
}

export function resolveStoryBranch(
  workspace: AccountCampaignStoryWorkspaceV1,
  linkId: string,
  resolution: NonNullable<AccountStoryEventLinkV1['resolution']>,
): AccountCampaignStoryWorkspaceV1 {
  const links = workspace.graphLinks ?? []
  const selected = links.find((link) => link.id === linkId)
  if (!selected) return workspace
  const source = workspace.events.find((event) => event.id === selected.fromEventId)
  const nextLinks = links.map((link) => {
    if (source?.nodeKind === 'decision' && resolution === 'pending' && link.fromEventId === source.id) {
      return { ...link, resolution: 'pending' as const }
    }
    if (link.id === linkId) return { ...link, resolution }
    if (source?.nodeKind === 'decision' && resolution === 'triggered' && link.fromEventId === source.id) {
      return { ...link, resolution: 'not-triggered' as const }
    }
    return link
  })
  const nextEvents = workspace.events.map((event) => {
    if (event.id !== selected.fromEventId) return event
    if (resolution === 'triggered') return { ...event, status: 'completed' as const }
    if (source?.nodeKind === 'decision' && resolution === 'pending') return { ...event, status: 'planned' as const }
    return event
  })
  return synchronizeStoryBranchEventStatuses({
    ...workspace,
    events: nextEvents,
    graphLinks: nextLinks,
    graphInitialized: true,
    graphEditedByDm: true,
    graphLinksClearedByDm: false,
    graphLayoutVersion: 4,
  })
}

export function orderedStoryEvents(workspace: AccountCampaignStoryWorkspaceV1): AccountStoryEventV1[] {
  const byId = new Map(workspace.events.map((event) => [event.id, event]))
  const links = (workspace.graphLinks ?? []).filter((link) => byId.has(link.fromEventId) && byId.has(link.toEventId))
  if (links.length === 0) return [...workspace.events].sort((left, right) => (
    (left.graphPosition?.x ?? 0) - (right.graphPosition?.x ?? 0)
    || (left.graphPosition?.y ?? 0) - (right.graphPosition?.y ?? 0)
  ))
  const incoming = new Map(workspace.events.map((event) => [event.id, 0]))
  const outgoing = new Map(workspace.events.map((event) => [event.id, [] as string[]]))
  for (const link of links) {
    incoming.set(link.toEventId, (incoming.get(link.toEventId) ?? 0) + 1)
    outgoing.get(link.fromEventId)?.push(link.toEventId)
  }
  const positionSort = (leftId: string, rightId: string) => {
    const left = byId.get(leftId)!
    const right = byId.get(rightId)!
    return (left.graphPosition?.x ?? 0) - (right.graphPosition?.x ?? 0)
      || (left.graphPosition?.y ?? 0) - (right.graphPosition?.y ?? 0)
  }
  const queue = workspace.events.filter((event) => (incoming.get(event.id) ?? 0) === 0).map((event) => event.id).sort(positionSort)
  const result: AccountStoryEventV1[] = []
  const visited = new Set<string>()
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    result.push(byId.get(id)!)
    for (const targetId of outgoing.get(id) ?? []) {
      incoming.set(targetId, (incoming.get(targetId) ?? 1) - 1)
      if ((incoming.get(targetId) ?? 0) === 0) queue.push(targetId)
    }
    queue.sort(positionSort)
  }
  for (const event of workspace.events) if (!visited.has(event.id)) result.push(event)
  return result
}

export function createDmStoryEvent(title = '新剧情节点'): AccountStoryEventV1 {
  return {
    id: `story-dm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    summary: '',
    details: '',
    timeLabel: '',
    status: 'planned',
    source: 'dm',
    sourceEventIds: [],
    sceneIds: [],
    personIds: [],
    clueIds: [],
    tags: [],
  }
}

export function removeStoryGraphLink(
  workspace: AccountCampaignStoryWorkspaceV1,
  linkId: string,
): AccountCampaignStoryWorkspaceV1 {
  const links = workspace.graphLinks ?? []
  const removed = links.find((link) => link.id === linkId)
  let nextLinks = links.filter((link) => link.id !== linkId)
  let nextEvents = workspace.events
  const source = removed && workspace.events.find((event) => event.id === removed.fromEventId)
  if (removed?.resolution === 'triggered' && source?.nodeKind === 'decision') {
    nextLinks = nextLinks.map((link) => link.fromEventId === source.id ? { ...link, resolution: 'pending' as const } : link)
    nextEvents = workspace.events.map((event) => event.id === source.id ? { ...event, status: 'planned' as const } : event)
  }
  return synchronizeStoryBranchEventStatuses({
    ...workspace,
    events: nextEvents,
    graphLinks: nextLinks,
    graphEditedByDm: Boolean(removed) || workspace.graphEditedByDm,
    graphLinksClearedByDm: nextLinks.length === 0,
    graphLayoutVersion: 4,
  })
}

export function startCampaignSession(
  workspace: AccountCampaignStoryWorkspaceV1,
  title: string,
  journalEntries: readonly CampaignJournalEntry[],
  now = Date.now(),
): AccountCampaignStoryWorkspaceV1 {
  const activeSession: AccountCampaignActiveSessionV1 = {
    id: `session-${now.toString(36)}`,
    title: title.trim() || '未命名团务',
    startedAt: now,
    baselineJournalEntryIds: journalEntries.map((entry) => entry.id),
    journalEntryIds: [],
  }
  return { ...workspace, mode: 'running', activeSession }
}

function sessionJournalEntries(
  session: AccountCampaignActiveSessionV1,
  journalEntries: readonly CampaignJournalEntry[],
): CampaignJournalEntry[] {
  const baseline = new Set(session.baselineJournalEntryIds)
  return journalEntries.filter((entry) => !baseline.has(entry.id) && entry.createdAt >= session.startedAt)
}

function logText(entries: readonly CampaignJournalEntry[]): string {
  return entries.map((entry) => `${entry.title}\n${entry.body}`).join('\n')
}

function concise(value: string, max = 180): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`
}

export function buildSessionReview(
  analysis: PdfCampaignAnalysisV2 | null,
  workspace: AccountCampaignStoryWorkspaceV1,
  journalEntries: readonly CampaignJournalEntry[],
  now = Date.now(),
): AccountCampaignStoryWorkspaceV1 {
  const session = workspace.activeSession
  if (!session) return workspace
  const entries = sessionJournalEntries(session, journalEntries)
  const combined = logText(entries)
  const completedEventIds = workspace.events
    .filter((event) => event.status === 'completed' || normalizedKey(combined).includes(normalizedKey(event.title)))
    .map((event) => event.id)
  const personUpdates: AccountCampaignSessionReviewV1['personUpdates'] = (analysis?.people ?? [])
    .filter((person) => mentionedEntityIds(combined, [person]).length > 0)
    .map((person) => ({
      personId: person.id,
      status: 'changed',
      note: concise(entries.findLast((entry) => normalizedKey(`${entry.title} ${entry.body}`).includes(normalizedKey(person.name)))?.body ?? '本场团务中出现。'),
      updatedBySessionId: session.id,
      accepted: true,
    }))
  const clueUpdates: AccountCampaignSessionReviewV1['clueUpdates'] = (analysis?.clues ?? [])
    .filter((clue) => mentionedEntityIds(combined, [clue]).length > 0)
    .map((clue) => {
      const clueText = entries.findLast((entry) => normalizedKey(`${entry.title} ${entry.body}`).includes(normalizedKey(clue.name)))?.body ?? ''
      const resolved = /解决|破解|销毁|完成|结案/.test(clueText)
      const discovered = resolved || /发现|找到|获得|得知|确认|揭露|识破/.test(clueText)
      return {
        clueId: clue.id,
        status: resolved ? 'resolved' : discovered ? 'discovered' : 'hidden',
        note: concise(clueText || '本场团务中被提及，状态待 DM 确认。'),
        updatedBySessionId: session.id,
        accepted: discovered,
      }
    })
  const pendingEvents = orderedStoryEvents(workspace).filter((event) => event.status === 'planned' && !completedEventIds.includes(event.id)).slice(0, 3)
  const unresolvedClues = (analysis?.clues ?? []).filter((clue) => !clueUpdates.some((update) => update.clueId === clue.id && update.status === 'resolved')).slice(0, 2)
  const nextChecklist = unique([
    ...pendingEvents.map((event) => `准备后续剧情：${event.title}`),
    ...unresolvedClues.map((clue) => `确认线索“${clue.name}”的下一种发现方式`),
    ...(entries.some((entry) => entry.source === 'combat-summary') ? ['处理本场战斗造成的后果与资源消耗'] : []),
  ])
  if (nextChecklist.length === 0) nextChecklist.push('根据本场结果确认下一场开场、目标与可能的玩家选择')
  const checklistSuggestions = nextChecklist.map((text) => ({ id: stableId('review-task', `${session.id}:${text}`), text, accepted: true }))
  const highlights = entries.slice(-6).map((entry) => concise(`${entry.title}：${entry.body}`, 120))
  const review: AccountCampaignSessionReviewV1 = {
    summary: entries.length > 0
      ? entries.map((entry) => `${entry.title}：${concise(entry.body, 240)}`).join('\n')
      : '本场尚无战役日志。可先在“通讯与日志”补写记录，再重新生成复盘建议。',
    highlights,
    completedEventIds,
    personUpdates,
    clueUpdates,
    nextChecklist: checklistSuggestions,
  }
  return {
    ...workspace,
    mode: 'review',
    activeSession: { ...session, endedAt: session.endedAt ?? now, journalEntryIds: entries.map((entry) => entry.id), review },
  }
}

function mergeEntityStates<State extends AccountCampaignPersonStateV1 | AccountCampaignClueStateV1>(
  current: State[],
  updates: State[],
  key: 'personId' | 'clueId',
): State[] {
  const next = [...current]
  for (const update of updates) {
    const index = next.findIndex((entry) => entry[key as keyof State] === update[key as keyof State])
    if (index >= 0) next[index] = update
    else next.push(update)
  }
  return next
}

export function applySessionReview(plan: AccountCampaignPrepPlanDraftV1): AccountCampaignPrepPlanDraftV1 {
  const workspace = plan.storyWorkspace
  const session = workspace?.activeSession
  const review = session?.review
  if (!workspace || !session || !review || session.endedAt == null) return plan
  const acceptedPeople = review.personUpdates.filter((entry) => entry.accepted).map((entry) => ({
    personId: entry.personId, status: entry.status, note: entry.note, updatedBySessionId: entry.updatedBySessionId,
  }))
  const acceptedClues = review.clueUpdates.filter((entry) => entry.accepted).map((entry) => ({
    clueId: entry.clueId, status: entry.status, note: entry.note, updatedBySessionId: entry.updatedBySessionId,
  }))
  const checklist = [...plan.checklist]
  for (const item of review.nextChecklist.filter((entry) => entry.accepted)) {
    if (!checklist.some((candidate) => normalizedKey(candidate.text) === normalizedKey(item.text))) checklist.push({ id: item.id, text: item.text, completed: false })
  }
  return {
    ...plan,
    sessionTitle: '下一次团务',
    checklist: checklist.slice(0, 64),
    storyWorkspace: {
      ...workspace,
      mode: 'prep',
      events: workspace.events.map((event) => review.completedEventIds.includes(event.id) ? { ...event, status: 'completed' } : event.status === 'active' ? { ...event, status: 'planned' } : event),
      personStates: mergeEntityStates(workspace.personStates, acceptedPeople, 'personId'),
      clueStates: mergeEntityStates(workspace.clueStates, acceptedClues, 'clueId'),
      recaps: [...workspace.recaps, {
        id: session.id,
        title: session.title,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        summary: review.summary,
        highlights: review.highlights,
        journalEntryIds: session.journalEntryIds,
        completedEventIds: review.completedEventIds,
      }].slice(-100),
      activeSession: undefined,
    },
  }
}
