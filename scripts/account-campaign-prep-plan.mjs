function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizedString(value, maxLength, allowEmpty = true) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if ((!allowEmpty && !normalized) || normalized.length > maxLength) return null
  return normalized
}

function normalizedIds(value) {
  if (!Array.isArray(value) || value.length > 64) return null
  const normalized = []
  const seen = new Set()
  for (const candidate of value) {
    const id = normalizedString(candidate, 120, false)
    if (!id) return null
    if (!seen.has(id)) {
      seen.add(id)
      normalized.push(id)
    }
  }
  return normalized
}

function normalizedChecklist(value) {
  if (!Array.isArray(value) || value.length > 64) return null
  const normalized = []
  const seen = new Set()
  for (const candidate of value) {
    if (!plainObject(candidate)) return null
    const id = normalizedString(candidate.id, 64, false)
    const text = normalizedString(candidate.text, 240, false)
    if (!id || !text || typeof candidate.completed !== 'boolean' || seen.has(id)) return null
    seen.add(id)
    normalized.push({ id, text, completed: candidate.completed })
  }
  return normalized
}

function normalizedEnum(value, allowed) {
  return allowed.includes(value) ? value : null
}

function normalizedStoryEvent(value) {
  if (!plainObject(value)) return null
  const id = normalizedString(value.id, 120, false)
  const title = normalizedString(value.title, 160, false)
  const summary = normalizedString(value.summary, 2_000)
  const details = normalizedString(value.details, 12_000)
  const timeLabel = normalizedString(value.timeLabel, 160)
  const status = normalizedEnum(value.status, ['planned', 'active', 'completed', 'skipped'])
  const source = normalizedEnum(value.source, ['analysis-timeline', 'analysis-scene', 'dm', 'session-log'])
  const sourceEventIds = normalizedIds(value.sourceEventIds)
  const sceneIds = normalizedIds(value.sceneIds)
  const personIds = normalizedIds(value.personIds)
  const clueIds = normalizedIds(value.clueIds)
  const tags = normalizedIds(value.tags)
  const gameTimeWorldMinute = value.gameTimeWorldMinute == null ? undefined : Number(value.gameTimeWorldMinute)
  const graphPosition = value.graphPosition == null
    ? undefined
    : plainObject(value.graphPosition)
      ? { x: Number(value.graphPosition.x), y: Number(value.graphPosition.y) }
      : null
  if (!id || !title || !status || !source || [summary, details, timeLabel, sourceEventIds, sceneIds, personIds, clueIds, tags].some((entry) => entry == null)) return null
  if (gameTimeWorldMinute !== undefined && (!Number.isSafeInteger(gameTimeWorldMinute) || gameTimeWorldMinute < 0)) return null
  if (graphPosition === null || (graphPosition && (!Number.isFinite(graphPosition.x) || !Number.isFinite(graphPosition.y) || graphPosition.x < 0 || graphPosition.y < 0 || graphPosition.x > 50_000 || graphPosition.y > 50_000))) return null
  return { id, title, summary, details, timeLabel, status, source, sourceEventIds, sceneIds, personIds, clueIds, tags, ...(gameTimeWorldMinute === undefined ? {} : { gameTimeWorldMinute }), ...(graphPosition ? { graphPosition } : {}) }
}

function normalizedStoryGraphLinks(value, eventIds) {
  if (value == null) return undefined
  if (!Array.isArray(value) || value.length > 1_024) return null
  const links = []
  const ids = new Set()
  for (const candidate of value) {
    if (!plainObject(candidate)) return null
    const id = normalizedString(candidate.id, 120, false)
    const fromEventId = normalizedString(candidate.fromEventId, 120, false)
    const toEventId = normalizedString(candidate.toEventId, 120, false)
    const label = normalizedString(candidate.label, 80)
    const condition = normalizedStoryGraphCondition(candidate.condition, eventIds)
    const labelPosition = candidate.labelPosition == null
      ? undefined
      : plainObject(candidate.labelPosition)
        ? { x: Number(candidate.labelPosition.x), y: Number(candidate.labelPosition.y) }
        : null
    if (!id || !fromEventId || !toEventId || label == null || condition === null || labelPosition === null || (labelPosition && (!Number.isFinite(labelPosition.x) || !Number.isFinite(labelPosition.y) || labelPosition.x < 0 || labelPosition.y < 0 || labelPosition.x > 50_000 || labelPosition.y > 50_000)) || ids.has(id) || fromEventId === toEventId || !eventIds.has(fromEventId) || !eventIds.has(toEventId)) return null
    ids.add(id)
    links.push({ id, fromEventId, toEventId, label, ...(condition ? { condition } : {}), ...(labelPosition ? { labelPosition } : {}) })
  }
  return links
}

function normalizedStoryGraphCondition(value, eventIds) {
  if (value == null) return undefined
  if (!plainObject(value)) return null
  if (value.kind === 'always') return { kind: 'always' }
  if (value.kind === 'person-state') {
    const personId = normalizedString(value.personId, 120, false)
    const state = normalizedEnum(value.state, ['dead', 'alive'])
    return personId && state ? { kind: 'person-state', personId, state } : null
  }
  if (value.kind === 'event-status') {
    const eventId = normalizedString(value.eventId, 120, false)
    const status = normalizedEnum(value.status, ['completed', 'skipped'])
    return eventId && eventIds.has(eventId) && status ? { kind: 'event-status', eventId, status } : null
  }
  if (value.kind === 'manual') {
    const expression = normalizedString(value.expression, 240, false)
    return expression ? { kind: 'manual', expression } : null
  }
  return null
}

function normalizedStoryTimelineMarkers(value) {
  if (value == null) return undefined
  if (!Array.isArray(value) || value.length > 256) return null
  const markers = []
  const ids = new Set()
  for (const candidate of value) {
    if (!plainObject(candidate)) return null
    const id = normalizedString(candidate.id, 120, false)
    const label = normalizedString(candidate.label, 160)
    const y = Number(candidate.y)
    const gameTimeWorldMinute = candidate.gameTimeWorldMinute == null ? undefined : Number(candidate.gameTimeWorldMinute)
    if (!id || label == null || ids.has(id) || !Number.isFinite(y) || y < 0 || y > 50_000) return null
    if (gameTimeWorldMinute !== undefined && (!Number.isSafeInteger(gameTimeWorldMinute) || gameTimeWorldMinute < 0)) return null
    ids.add(id)
    markers.push({ id, y, label, ...(gameTimeWorldMinute === undefined ? {} : { gameTimeWorldMinute }) })
  }
  return markers
}

function normalizedEntityState(value, kind) {
  if (!plainObject(value)) return null
  const entityKey = kind === 'person' ? 'personId' : 'clueId'
  const entityId = normalizedString(value[entityKey], 120, false)
  const status = normalizedEnum(value.status, kind === 'person'
    ? ['unknown', 'active', 'changed', 'departed', 'dead']
    : ['hidden', 'discovered', 'resolved', 'lost'])
  const note = normalizedString(value.note, 2_000)
  const updatedBySessionId = normalizedString(value.updatedBySessionId, 120)
  return entityId && status && note != null && updatedBySessionId != null
    ? { [entityKey]: entityId, status, note, updatedBySessionId }
    : null
}

function normalizedEntityStates(value, kind) {
  if (!Array.isArray(value) || value.length > 256) return null
  const result = value.map((entry) => normalizedEntityState(entry, kind))
  return result.some((entry) => !entry) ? null : result
}

function normalizedReview(value) {
  if (!plainObject(value)) return null
  const summary = normalizedString(value.summary, 12_000)
  const highlights = normalizedIds(value.highlights)
  const completedEventIds = normalizedIds(value.completedEventIds)
  const personUpdates = Array.isArray(value.personUpdates) && value.personUpdates.length <= 128
    ? value.personUpdates.map((entry) => {
        const normalized = normalizedEntityState(entry, 'person')
        return normalized && typeof entry.accepted === 'boolean' ? { ...normalized, accepted: entry.accepted } : null
      })
    : null
  const clueUpdates = Array.isArray(value.clueUpdates) && value.clueUpdates.length <= 128
    ? value.clueUpdates.map((entry) => {
        const normalized = normalizedEntityState(entry, 'clue')
        return normalized && typeof entry.accepted === 'boolean' ? { ...normalized, accepted: entry.accepted } : null
      })
    : null
  const nextChecklist = Array.isArray(value.nextChecklist) && value.nextChecklist.length <= 64
    ? value.nextChecklist.map((entry) => {
        if (!plainObject(entry)) return null
        const id = normalizedString(entry.id, 64, false)
        const text = normalizedString(entry.text, 240, false)
        return id && text && typeof entry.accepted === 'boolean' ? { id, text, accepted: entry.accepted } : null
      })
    : null
  if ([summary, highlights, completedEventIds, personUpdates, clueUpdates, nextChecklist].some((entry) => entry == null)) return null
  if (personUpdates.some((entry) => !entry) || clueUpdates.some((entry) => !entry) || nextChecklist.some((entry) => !entry)) return null
  return { summary, highlights, completedEventIds, personUpdates, clueUpdates, nextChecklist }
}

function normalizedActiveSession(value) {
  if (!plainObject(value)) return null
  const id = normalizedString(value.id, 120, false)
  const title = normalizedString(value.title, 160, false)
  const baselineJournalEntryIds = normalizedIds(value.baselineJournalEntryIds)
  const journalEntryIds = normalizedIds(value.journalEntryIds)
  const startedAt = Number(value.startedAt)
  const endedAt = value.endedAt == null ? undefined : Number(value.endedAt)
  const review = value.review == null ? undefined : normalizedReview(value.review)
  if (!id || !title || !Number.isFinite(startedAt) || startedAt <= 0 || !baselineJournalEntryIds || !journalEntryIds || (value.review != null && !review)) return null
  if (endedAt !== undefined && (!Number.isFinite(endedAt) || endedAt < startedAt)) return null
  return { id, title, startedAt, baselineJournalEntryIds, journalEntryIds, ...(endedAt === undefined ? {} : { endedAt }), ...(review ? { review } : {}) }
}

function normalizedRecaps(value) {
  if (!Array.isArray(value) || value.length > 100) return null
  const result = value.map((entry) => {
    if (!plainObject(entry)) return null
    const id = normalizedString(entry.id, 120, false)
    const title = normalizedString(entry.title, 160, false)
    const summary = normalizedString(entry.summary, 12_000)
    const highlights = normalizedIds(entry.highlights)
    const journalEntryIds = normalizedIds(entry.journalEntryIds)
    const completedEventIds = normalizedIds(entry.completedEventIds)
    const startedAt = Number(entry.startedAt)
    const endedAt = Number(entry.endedAt)
    return id && title && summary != null && highlights && journalEntryIds && completedEventIds && Number.isFinite(startedAt) && Number.isFinite(endedAt) && endedAt >= startedAt
      ? { id, title, startedAt, endedAt, summary, highlights, journalEntryIds, completedEventIds }
      : null
  })
  return result.some((entry) => !entry) ? null : result
}

function normalizedStoryWorkspace(value) {
  if (value == null) return undefined
  if (!plainObject(value) || value.schemaVersion !== 1) return null
  const mode = normalizedEnum(value.mode, ['prep', 'running', 'review'])
  const events = Array.isArray(value.events) && value.events.length <= 512 ? value.events.map(normalizedStoryEvent) : null
  const personStates = normalizedEntityStates(value.personStates, 'person')
  const clueStates = normalizedEntityStates(value.clueStates, 'clue')
  const activeSession = value.activeSession == null ? undefined : normalizedActiveSession(value.activeSession)
  const recaps = normalizedRecaps(value.recaps)
  if (!mode || !events || events.some((entry) => !entry) || !personStates || !clueStates || (value.activeSession != null && !activeSession) || !recaps) return null
  if (new Set(events.map((entry) => entry.id)).size !== events.length || new Set(personStates.map((entry) => entry.personId)).size !== personStates.length || new Set(clueStates.map((entry) => entry.clueId)).size !== clueStates.length || new Set(recaps.map((entry) => entry.id)).size !== recaps.length) return null
  const graphLinks = normalizedStoryGraphLinks(value.graphLinks, new Set(events.map((entry) => entry.id)))
  const timelineMarkers = normalizedStoryTimelineMarkers(value.timelineMarkers)
  if (graphLinks === null || timelineMarkers === null || (value.graphInitialized != null && typeof value.graphInitialized !== 'boolean') || (value.graphLayoutVersion != null && value.graphLayoutVersion !== 2 && value.graphLayoutVersion !== 3 && value.graphLayoutVersion !== 4)) return null
  if (mode !== 'prep' && !activeSession) return null
  return { schemaVersion: 1, mode, events, personStates, clueStates, ...(activeSession ? { activeSession } : {}), recaps, ...(graphLinks ? { graphLinks } : {}), ...(timelineMarkers ? { timelineMarkers } : {}), ...(value.graphInitialized == null ? {} : { graphInitialized: value.graphInitialized }), ...([2, 3, 4].includes(value.graphLayoutVersion) ? { graphLayoutVersion: value.graphLayoutVersion } : {}) }
}

export function normalizeCampaignPrepPlan(value, { persisted = false } = {}) {
  if (!plainObject(value) || value.schemaVersion !== 1) return null
  const sessionTitle = normalizedString(value.sessionTitle, 120)
  const objective = normalizedString(value.objective, 1200)
  const selectedSceneIds = normalizedIds(value.selectedSceneIds)
  const selectedPersonIds = normalizedIds(value.selectedPersonIds)
  const selectedClueIds = normalizedIds(value.selectedClueIds)
  const checklist = normalizedChecklist(value.checklist)
  const privateNotes = normalizedString(value.privateNotes, 12_000)
  const storyWorkspace = normalizedStoryWorkspace(value.storyWorkspace)
  if ([sessionTitle, objective, selectedSceneIds, selectedPersonIds, selectedClueIds, checklist, privateNotes, storyWorkspace].some((entry) => entry === null)) return null
  const selectedStoryEventIds = value.selectedStoryEventIds === undefined
    ? storyWorkspace?.events
      .filter((event) => event.sceneIds.some((sceneId) => selectedSceneIds.includes(sceneId)))
      .map((event) => event.id) ?? []
    : normalizedIds(value.selectedStoryEventIds)
  if (!selectedStoryEventIds) return null
  const base = { schemaVersion: 1, sessionTitle, objective, selectedStoryEventIds, selectedSceneIds, selectedPersonIds, selectedClueIds, checklist, privateNotes, ...(storyWorkspace ? { storyWorkspace } : {}) }
  if (!persisted) return base
  const revision = Number(value.revision)
  return Number.isSafeInteger(revision) && revision >= 1 && Number.isFinite(value.updatedAt)
    ? { ...base, revision, updatedAt: value.updatedAt }
    : null
}

export function applyCampaignPrepPlanPatch(currentValue, payload, now) {
  if (payload?.prepPlan == null) {
    return payload?.expectedPrepPlanRevision == null
      ? { ok: true, value: currentValue }
      : { ok: false, status: 400, error: 'campaign-prep-plan-required' }
  }
  const normalized = normalizeCampaignPrepPlan(payload.prepPlan)
  const expectedRevision = Number(payload.expectedPrepPlanRevision)
  const current = normalizeCampaignPrepPlan(currentValue, { persisted: true })
  if (!normalized) return { ok: false, status: 400, error: 'invalid-campaign-prep-plan' }
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    return { ok: false, status: 400, error: 'invalid-campaign-prep-plan-revision' }
  }
  if (expectedRevision !== (current?.revision ?? 0)) {
    return { ok: false, status: 409, error: 'campaign-prep-plan-revision-conflict' }
  }
  return { ok: true, value: { ...normalized, revision: expectedRevision + 1, updatedAt: now } }
}
