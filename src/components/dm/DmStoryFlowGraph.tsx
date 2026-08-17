import {
  Bookmark,
  ChevronDown,
  CirclePlus,
  Clock3,
  GitBranch,
  Link2,
  Maximize2,
  Minimize2,
  Settings2,
  LocateFixed,
  RotateCcw,
  Trash2,
  Unlink,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type {
  AccountCampaignStoryWorkspaceV1,
  AccountStoryEventLinkConditionV1,
  AccountStoryEventLinkV1,
  AccountStoryEventStatusV1,
  AccountStoryEventV1,
  AccountStoryTimelineMarkerV1,
} from '../../lib/accountApi'
import { formatCampaignTime } from '../../lib/campaignTime'
import { useCampaignTimeStore } from '../../store/campaignTime'
import type { PdfCampaignAnalysisV2 } from '../../lib/pdfCampaignAnalysisV2'
import {
  createDmStoryEvent,
  evaluateStoryLinkCondition,
  resolveStoryBranch,
  storyEventAvailability,
  storyEventSourceCitations,
} from './dmCampaignStoryModel'
import PdfSourceEvidenceDrawer, { PdfCitationButtons } from './PdfSourceEvidenceDrawer'
import type { PdfViewCitation } from './pdfSourceEvidenceViewModel'
import {
  layoutStoryGraphEdgeLabels,
  layoutStoryGraphEvents,
  prioritizeSelectedStoryEntries,
  STORY_GRAPH_MIN_CANVAS_WIDTH,
  STORY_GRAPH_NODE_GAP_Y,
  STORY_GRAPH_NODE_HEIGHT,
  STORY_GRAPH_NODE_WIDTH,
} from './dmStoryGraphLayout'
import {
  clampStoryGraphZoom as clampZoom,
  storyGraphAnchoredScroll,
  storyGraphCenteredScroll,
  storyGraphFitZoom,
} from './dmStoryGraphViewport'
import {
  createStoryTimelineMarker,
  currentStoryTimelineY,
  moveStoryTimelineMarkerY,
  storyCanvasGestureIsClick,
  storyEventIsBeforeTimeline,
  storyTimelineYBelowEvent,
  storyTimelineMarkerIsReached,
} from './dmStoryTimelineMarkers'

type DmEditableEventField = NonNullable<AccountStoryEventV1['dmEditedFields']>[number]

const DM_EDITABLE_EVENT_FIELDS: readonly DmEditableEventField[] = [
  'title', 'summary', 'details', 'timeLabel', 'personIds', 'clueIds', 'tags',
]

function applyDmEventPatch(
  event: AccountStoryEventV1,
  patch: Partial<AccountStoryEventV1>,
): AccountStoryEventV1 {
  if (event.source === 'dm' || event.source === 'session-log') return { ...event, ...patch }
  const editedFields = new Set(event.dmEditedFields ?? [])
  for (const field of DM_EDITABLE_EVENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) editedFields.add(field)
  }
  return {
    ...event,
    ...patch,
    ...(editedFields.size > 0 ? { dmEditedFields: [...editedFields] } : {}),
  }
}

const NODE_WIDTH = STORY_GRAPH_NODE_WIDTH
const NODE_HEIGHT = STORY_GRAPH_NODE_HEIGHT
const MIN_CANVAS_WIDTH = STORY_GRAPH_MIN_CANVAS_WIDTH

const STATUS_COPY: Record<AccountStoryEventStatusV1, string> = {
  planned: '待发生',
  active: '进行中',
  completed: '已完成',
  skipped: '已跳过',
}

const STATUS_STYLE: Record<AccountStoryEventStatusV1, string> = {
  planned: 'border-violet-400/35 bg-[#12101d]',
  active: 'border-cyan-300/60 bg-cyan-950/30 shadow-[0_0_24px_rgba(34,211,238,0.12)]',
  completed: 'border-emerald-400/45 bg-emerald-950/20',
  skipped: 'border-slate-700 bg-slate-950/70 opacity-65',
}

type BranchConditionKind =
  | 'always'
  | 'event-completed'
  | 'event-skipped'
  | 'person-dead'
  | 'person-alive'
  | 'manual'

function sequentialLinks(events: readonly AccountStoryEventV1[]): AccountStoryEventLinkV1[] {
  return events.slice(1).map((event, index) => ({
    id: `story-link-${Date.now().toString(36)}-${index}`,
    fromEventId: events[index]!.id,
    toEventId: event.id,
    label: '',
    condition: { kind: 'always' },
  }))
}

function conditionLabel(
  link: AccountStoryEventLinkV1,
  analysis: PdfCampaignAnalysisV2,
  events: readonly AccountStoryEventV1[] = [],
): string {
  const condition = link.condition
  if (!condition || condition.kind === 'always') return link.label === '然后' ? '' : link.label
  if (condition.kind === 'manual') return link.label ? `${condition.expression} · ${link.label}` : condition.expression
  if (condition.kind === 'event-status') {
    const event = events.find((entry) => entry.id === condition.eventId)
    const status = `${event?.title ?? '指定事件'}${condition.status === 'completed' ? '已发生' : '未发生'}`
    return link.label ? `${status} · ${link.label}` : status
  }
  const person = analysis.people.find((entry) => entry.id === condition.personId)
  const status = `${person?.name ?? '指定人物'}${condition.state === 'dead' ? '已死亡' : '仍存活'}`
  return link.label ? `${status} · ${link.label}` : status
}

function conditionColor(link: AccountStoryEventLinkV1, workspace: AccountCampaignStoryWorkspaceV1): string {
  if (link.resolution === 'triggered') return '#34d399'
  if (link.resolution === 'not-triggered') return '#64748b'
  const result = evaluateStoryLinkCondition(link, workspace)
  if (result === 'matched') return link.condition?.kind === 'always' || !link.condition ? '#a78bfa' : '#34d399'
  if (result === 'manual') return '#fbbf24'
  return '#64748b'
}

function compactLinkLabel(value: string, maxLength = 28): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function buildCondition(
  kind: BranchConditionKind,
  personId: string,
  eventId: string,
  expression: string,
): AccountStoryEventLinkConditionV1 | null {
  if (kind === 'always') return { kind: 'always' }
  if (kind === 'manual') return expression.trim() ? { kind: 'manual', expression: expression.trim() } : null
  if (kind === 'event-completed' || kind === 'event-skipped') {
    return eventId
      ? { kind: 'event-status', eventId, status: kind === 'event-completed' ? 'completed' : 'skipped' }
      : null
  }
  if (!personId) return null
  return { kind: 'person-state', personId, state: kind === 'person-dead' ? 'dead' : 'alive' }
}

export default function DmStoryFlowGraph({ workspace, analysis, onChange }: {
  workspace: AccountCampaignStoryWorkspaceV1
  analysis: PdfCampaignAnalysisV2
  onChange: (workspace: AccountCampaignStoryWorkspaceV1) => void
}) {
  const links = useMemo(() => workspace.graphLinks ?? [], [workspace.graphLinks])
  const positionSnapshot = JSON.stringify(workspace.events.map((event) => [event.id, event.graphPosition?.x ?? 420, event.graphPosition?.y ?? 56]))
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => Object.fromEntries(workspace.events.map((event) => [event.id, event.graphPosition ?? { x: 420, y: 56 }])))
  const [fromEventId, setFromEventId] = useState('')
  const [toEventId, setToEventId] = useState('')
  const [conditionKind, setConditionKind] = useState<BranchConditionKind>('always')
  const [conditionPersonId, setConditionPersonId] = useState('')
  const [conditionEventId, setConditionEventId] = useState('')
  const [manualExpression, setManualExpression] = useState('')
  const [zoom, setZoom] = useState(0.95)
  const [fullscreen, setFullscreen] = useState(false)
  const [editToolsOpen, setEditToolsOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [detailEventId, setDetailEventId] = useState<string | null>(null)
  const [selectedCitation, setSelectedCitation] = useState<PdfViewCitation | null>(null)
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [selectedTimelineMarkerId, setSelectedTimelineMarkerId] = useState<string | null>(null)
  const [timelineMarkerDragPreview, setTimelineMarkerDragPreview] = useState<{ id: string; y: number } | null>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number; x: number; y: number; moved: boolean } | null>(null)
  const linkLabelDragRef = useRef<{ id: string; pointerId: number; dx: number; dy: number; x: number; y: number; moved: boolean } | null>(null)
  const [linkLabelDragPreview, setLinkLabelDragPreview] = useState<{ id: string; x: number; y: number } | null>(null)
  const timelineMarkerDragRef = useRef<{ id: string; pointerId: number; clientY: number; startY: number; y: number; moved: boolean } | null>(null)
  const canvasGestureRef = useRef<{ pointerId: number; clientX: number; clientY: number; scrollLeft: number; scrollTop: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const graphSectionRef = useRef<HTMLElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const pendingViewportRef = useRef<{ left: number; top: number } | null>(null)
  const migratedLayoutSignatureRef = useRef<string | null>(null)
  const zoomRef = useRef(zoom)
  const wheelFrameRef = useRef<number | null>(null)
  const wheelGestureRef = useRef<{ deltaY: number; offsetX: number; offsetY: number } | null>(null)
  const fitOnFullscreenRef = useRef(false)
  const campaignClock = useCampaignTimeStore((state) => state.state)
  const timelineMarkers = useMemo(() => workspace.timelineMarkers ?? [], [workspace.timelineMarkers])
  const reachedTimelineY = useMemo(
    () => currentStoryTimelineY(timelineMarkers, campaignClock.worldMinute),
    [campaignClock.worldMinute, timelineMarkers],
  )

  const rememberViewport = useCallback(() => {
    const viewport = viewportRef.current
    if (viewport) pendingViewportRef.current = { left: viewport.scrollLeft, top: viewport.scrollTop }
  }, [])

  const commitWorkspace = useCallback((nextWorkspace: AccountCampaignStoryWorkspaceV1) => {
    rememberViewport()
    onChange(nextWorkspace)
  }, [onChange, rememberViewport])

  useEffect(() => {
    if (dragRef.current) return
    const entries = JSON.parse(positionSnapshot) as Array<[string, number, number]>
    setPositions(Object.fromEntries(entries.map(([id, x, y]) => [id, { x, y }])))
  }, [positionSnapshot])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const pending = pendingViewportRef.current
    if (!viewport || !pending) return
    viewport.scrollLeft = pending.left
    viewport.scrollTop = pending.top
    pendingViewportRef.current = null
  }, [positionSnapshot, links.length, workspace.events.length, zoom])

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => () => {
    if (wheelFrameRef.current !== null) window.cancelAnimationFrame(wheelFrameRef.current)
  }, [])

  useEffect(() => {
    if (workspace.graphLayoutVersion === 4) return
    const signature = JSON.stringify({
      eventIds: workspace.events.map((event) => event.id),
      links: links.map((link) => [link.fromEventId, link.toEventId, link.condition]),
    })
    if (migratedLayoutSignatureRef.current === signature) return
    migratedLayoutSignatureRef.current = signature
    commitWorkspace({ ...workspace, events: layoutStoryGraphEvents(workspace.events, links), graphLayoutVersion: 4, graphInitialized: true })
  }, [commitWorkspace, links, workspace])

  useEffect(() => {
    if (!fullscreen) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [fullscreen])

  const displayPositions = positions
  const nodeWidth = NODE_WIDTH
  const nodeHeight = NODE_HEIGHT
  const minCanvasWidth = MIN_CANVAS_WIDTH
  const edgeLabelLayouts = useMemo(() => new Map(
    layoutStoryGraphEdgeLabels(
      links,
      displayPositions,
      (link) => compactLinkLabel(conditionLabel(link, analysis, workspace.events)),
    )
      .map((layout) => {
        const link = links.find((candidate) => candidate.id === layout.linkId)
        const preview = linkLabelDragPreview?.id === layout.linkId ? linkLabelDragPreview : undefined
        return [layout.linkId, {
          ...layout,
          x: preview?.x ?? link?.labelPosition?.x ?? layout.x,
          y: preview?.y ?? link?.labelPosition?.y ?? layout.y,
        }]
      }),
  ), [analysis, displayPositions, linkLabelDragPreview, links, workspace.events])
  const canvasSize = useMemo(() => {
    const values = Object.values(displayPositions)
    const labelValues = [...edgeLabelLayouts.values()]
    return {
      width: Math.max(minCanvasWidth, ...values.map((position) => position.x + nodeWidth + 64), ...labelValues.map((label) => label.x + label.width + 64)),
      height: Math.max(680, ...values.map((position) => position.y + nodeHeight + 56), ...labelValues.map((label) => label.y + label.height + 56), ...timelineMarkers.map((marker) => (timelineMarkerDragPreview?.id === marker.id ? timelineMarkerDragPreview.y : marker.y) + 80)),
    }
  }, [displayPositions, edgeLabelLayouts, minCanvasWidth, nodeHeight, nodeWidth, timelineMarkerDragPreview, timelineMarkers])

  const commitEvents = (events: AccountStoryEventV1[]) => commitWorkspace({ ...workspace, events, graphInitialized: true, graphLayoutVersion: 4 })
  const commitLinks = (nextLinks: AccountStoryEventLinkV1[]) => commitWorkspace({
    ...workspace,
    graphLinks: nextLinks,
    graphInitialized: true,
    graphEditedByDm: true,
    graphLinksClearedByDm: nextLinks.length === 0,
    graphLayoutVersion: 4,
  })
  const updateLink = (id: string, patch: Partial<AccountStoryEventLinkV1>) => commitLinks(links.map((link) => link.id === id ? { ...link, ...patch } : link))
  const updateEvent = (id: string, patch: Partial<AccountStoryEventV1>) => commitEvents(workspace.events.map((event) => event.id === id ? applyDmEventPatch(event, patch) : event))
  const commitTimelineMarkers = (markers: AccountStoryTimelineMarkerV1[]) => commitWorkspace({ ...workspace, timelineMarkers: markers })
  const updateTimelineMarker = (id: string, patch: Partial<AccountStoryTimelineMarkerV1>) => commitTimelineMarkers(timelineMarkers.map((marker) => marker.id === id ? { ...marker, ...patch } : marker))
  const addTimelineMarker = (y: number, currentTime = false) => {
    const marker = createStoryTimelineMarker(y, currentTime ? {
      label: formatCampaignTime(campaignClock),
      gameTimeWorldMinute: campaignClock.worldMinute,
    } : {})
    commitTimelineMarkers([...timelineMarkers, marker])
    setSelectedTimelineMarkerId(marker.id)
  }
  const timelineYBelowSelectedEvent = () => {
    if (!selectedEventId) return null
    const selectedPosition = positions[selectedEventId]
    if (!selectedPosition) return null
    return storyTimelineYBelowEvent(
      selectedPosition.y,
      NODE_HEIGHT,
      Object.entries(positions).filter(([id]) => id !== selectedEventId).map(([, position]) => position.y),
      STORY_GRAPH_NODE_GAP_Y,
    )
  }
  const addTimelineMarkerBelowSelectedEvent = (currentTime = false) => {
    const y = timelineYBelowSelectedEvent()
    if (y === null) return
    addTimelineMarker(y, currentTime)
  }

  const addLink = (fromId = fromEventId, toId = toEventId) => {
    const condition = buildCondition(conditionKind, conditionPersonId, conditionEventId, manualExpression)
    if (!fromId || !toId || fromId === toId || !condition) return
    const duplicate = links.some((link) => link.fromEventId === fromId && link.toEventId === toId && JSON.stringify(link.condition ?? { kind: 'always' }) === JSON.stringify(condition))
    if (!duplicate) commitLinks([...links, {
      id: `story-link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      fromEventId: fromId,
      toEventId: toId,
      label: '',
      condition,
    }])
    setFromEventId('')
    setToEventId('')
  }

  const addDecisionNode = () => {
    const event = {
      ...createDmStoryEvent('玩家如何选择？'),
      nodeKind: 'decision' as const,
      summary: '为这个选择框添加两个或更多出口，并为每条箭头填写玩家选项。',
      graphPosition: selectedEventId && positions[selectedEventId]
        ? { x: positions[selectedEventId]!.x, y: positions[selectedEventId]!.y + NODE_HEIGHT + STORY_GRAPH_NODE_GAP_Y }
        : { x: 488, y: Math.max(64, ...Object.values(positions).map((position) => position.y + NODE_HEIGHT + STORY_GRAPH_NODE_GAP_Y)) },
    }
    const nextLinks = selectedEventId && selectedEventId !== event.id
      ? [...links, {
          id: `story-link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          fromEventId: selectedEventId,
          toEventId: event.id,
          label: '',
          condition: { kind: 'always' as const },
        }]
      : links
    commitWorkspace({
      ...workspace,
      events: [...workspace.events, event],
      graphLinks: nextLinks,
      graphInitialized: true,
      graphEditedByDm: true,
      graphLinksClearedByDm: nextLinks.length === 0,
      graphLayoutVersion: 4,
    })
    setSelectedEventId(event.id)
    setEditingEventId(event.id)
  }

  const resolveLink = (linkId: string, resolution: NonNullable<AccountStoryEventLinkV1['resolution']>) => {
    commitWorkspace(resolveStoryBranch(workspace, linkId, resolution))
  }

  const removeLink = (linkId: string) => {
    const removed = links.find((link) => link.id === linkId)
    let nextLinks = links.filter((link) => link.id !== linkId)
    let nextEvents = workspace.events
    const source = removed && workspace.events.find((event) => event.id === removed.fromEventId)
    if (removed?.resolution === 'triggered' && source?.nodeKind === 'decision') {
      nextLinks = nextLinks.map((link) => link.fromEventId === source.id ? { ...link, resolution: 'pending' as const } : link)
      nextEvents = workspace.events.map((event) => event.id === source.id ? { ...event, status: 'planned' as const } : event)
    }
    commitWorkspace({
      ...workspace,
      events: nextEvents,
      graphLinks: nextLinks,
      graphInitialized: true,
      graphEditedByDm: true,
      graphLinksClearedByDm: nextLinks.length === 0,
      graphLayoutVersion: 4,
    })
  }

  const arrange = () => commitEvents(layoutStoryGraphEvents(workspace.events, links))
  const makeLinear = () => {
    const ordered = [...workspace.events].sort((left, right) => (
      (left.graphPosition?.y ?? 0) - (right.graphPosition?.y ?? 0)
      || (left.graphPosition?.x ?? 0) - (right.graphPosition?.x ?? 0)
    ))
    const nextLinks = sequentialLinks(ordered)
    commitWorkspace({ ...workspace, graphLinks: nextLinks, events: layoutStoryGraphEvents(ordered, nextLinks), graphInitialized: true, graphEditedByDm: true, graphLinksClearedByDm: nextLinks.length === 0, graphLayoutVersion: 4 })
  }
  const applyZoomAndScroll = useCallback((nextZoom: number, nextScroll: { left: number; top: number }) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const normalizedZoom = clampZoom(nextZoom)
    if (normalizedZoom === zoomRef.current) {
      viewport.scrollTo({ left: nextScroll.left, top: nextScroll.top, behavior: 'smooth' })
      return
    }
    pendingViewportRef.current = nextScroll
    zoomRef.current = normalizedZoom
    setZoom(normalizedZoom)
  }, [])
  const centerCanvas = useCallback((nextZoom = zoomRef.current) => {
    const viewport = viewportRef.current
    if (!viewport) return
    applyZoomAndScroll(nextZoom, storyGraphCenteredScroll({
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      zoom: nextZoom,
    }))
  }, [applyZoomAndScroll, canvasSize.height, canvasSize.width])
  const fitCanvas = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const nextZoom = storyGraphFitZoom({
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
    })
    centerCanvas(nextZoom)
  }, [canvasSize.height, canvasSize.width, centerCanvas])
  const zoomAroundViewportCenter = useCallback((nextZoom: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const normalizedZoom = clampZoom(nextZoom)
    applyZoomAndScroll(normalizedZoom, storyGraphAnchoredScroll({
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      previousZoom: zoomRef.current,
      nextZoom: normalizedZoom,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      anchorX: viewport.clientWidth / 2,
      anchorY: viewport.clientHeight / 2,
    }))
  }, [applyZoomAndScroll, canvasSize.height, canvasSize.width])
  const toggleFullscreen = useCallback(() => {
    setFullscreen((value) => {
      const next = !value
      if (next) {
        fitOnFullscreenRef.current = true
        setEditToolsOpen(false)
      }
      return next
    })
  }, [])

  useLayoutEffect(() => {
    if (!fullscreen || !fitOnFullscreenRef.current) return
    fitOnFullscreenRef.current = false
    const frame = window.requestAnimationFrame(() => fitCanvas())
    return () => window.cancelAnimationFrame(frame)
  }, [fitCanvas, fullscreen])
  const zoomWithWheel = useCallback((event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    event.stopPropagation()
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const deltaScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1
    const previous = wheelGestureRef.current
    wheelGestureRef.current = {
      deltaY: Math.max(-240, Math.min(240, (previous?.deltaY ?? 0) + event.deltaY * deltaScale)),
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    }
    if (wheelFrameRef.current !== null) return
    wheelFrameRef.current = window.requestAnimationFrame(() => {
      wheelFrameRef.current = null
      const gesture = wheelGestureRef.current
      const currentViewport = viewportRef.current
      wheelGestureRef.current = null
      if (!gesture || !currentViewport) return
      const currentZoom = zoomRef.current
      const nextZoom = clampZoom(currentZoom * Math.exp(-gesture.deltaY * 0.0018))
      if (nextZoom === currentZoom) return
      pendingViewportRef.current = storyGraphAnchoredScroll({
        viewportWidth: currentViewport.clientWidth,
        viewportHeight: currentViewport.clientHeight,
        canvasWidth: canvasSize.width,
        canvasHeight: canvasSize.height,
        previousZoom: currentZoom,
        nextZoom,
        scrollLeft: currentViewport.scrollLeft,
        scrollTop: currentViewport.scrollTop,
        anchorX: gesture.offsetX,
        anchorY: gesture.offsetY,
      })
      zoomRef.current = nextZoom
      setZoom(nextZoom)
    })
  }, [canvasSize.height, canvasSize.width])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.addEventListener('wheel', zoomWithWheel, { capture: true, passive: false })
    return () => viewport.removeEventListener('wheel', zoomWithWheel, { capture: true })
  }, [zoomWithWheel])
  const setPersonStatus = (personId: string, status: 'active' | 'dead') => {
    const nextState = { personId, status, note: '由 DM 在剧情世界线中设置', updatedBySessionId: workspace.activeSession?.id ?? 'dm-story-flow' }
    const exists = workspace.personStates.some((entry) => entry.personId === personId)
    commitWorkspace({ ...workspace, personStates: exists ? workspace.personStates.map((entry) => entry.personId === personId ? nextState : entry) : [...workspace.personStates, nextState] })
  }
  const removeEvent = (event: AccountStoryEventV1) => {
    if (event.source === 'dm') {
      const nextLinks = links.filter((link) => link.fromEventId !== event.id && link.toEventId !== event.id)
      commitWorkspace({
        ...workspace,
        events: workspace.events.filter((candidate) => candidate.id !== event.id),
        graphLinks: nextLinks,
        graphEditedByDm: links.some((link) => link.fromEventId === event.id || link.toEventId === event.id) || workspace.graphEditedByDm,
        graphLinksClearedByDm: nextLinks.length === 0,
      })
    } else updateEvent(event.id, { status: 'skipped' })
    setSelectedEventId(null)
    setEditingEventId(null)
  }
  const toggleOutcome = (fromEventId: string, toEventId: string) => {
    if (!fromEventId || !toEventId || fromEventId === toEventId) return
    const exists = links.some((link) => link.fromEventId === fromEventId && link.toEventId === toEventId)
    if (exists) {
      const existing = links.find((link) => link.fromEventId === fromEventId && link.toEventId === toEventId)
      if (existing) removeLink(existing.id)
      return
    }
    commitLinks([...links, {
      id: `story-link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      fromEventId,
      toEventId,
      label: '',
      condition: { kind: 'always' },
    }])
  }

  const selectedPersonState = conditionPersonId ? workspace.personStates.find((entry) => entry.personId === conditionPersonId) : undefined
  const selectedConditionEvent = conditionEventId ? workspace.events.find((entry) => entry.id === conditionEventId) : undefined
  const eventCitations = useMemo(() => new Map(
    workspace.events.map((event) => [event.id, storyEventSourceCitations(event, analysis)]),
  ), [analysis, workspace.events])
  const detailEvent = detailEventId ? workspace.events.find((event) => event.id === detailEventId) : undefined
  const editingEvent = editingEventId ? workspace.events.find((event) => event.id === editingEventId) : undefined
  const selectedLink = selectedLinkId ? links.find((link) => link.id === selectedLinkId) : undefined
  const selectedTimelineMarker = selectedTimelineMarkerId ? timelineMarkers.find((marker) => marker.id === selectedTimelineMarkerId) : undefined
  const selectedTimelineMarkerReached = selectedTimelineMarker
    ? storyTimelineMarkerIsReached(selectedTimelineMarker, campaignClock.worldMinute)
    : false

  return (
    <section ref={graphSectionRef} tabIndex={0} onKeyDown={(event) => {
      const target = event.target as HTMLElement
      if (editingEventId || target.closest('input,textarea,select,button,[contenteditable="true"]')) return
      if (event.key.toLowerCase() !== 't' || event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()
      addTimelineMarkerBelowSelectedEvent(true)
    }} className={`${fullscreen ? 'fixed inset-0 z-[260] flex flex-col rounded-none' : 'relative overflow-hidden rounded-3xl'} border border-violet-400/20 bg-[#080711] outline-none`} data-testid="dm-story-flow-graph">
      <div className={fullscreen ? 'relative z-40 shrink-0 border-b border-white/8 bg-[#080711]/95 p-3 backdrop-blur-xl' : 'shrink-0 border-b border-white/8 bg-white/[0.02] p-3'}>
        <div className={`flex flex-wrap items-center justify-between gap-3 ${fullscreen ? 'rounded-2xl border border-white/10 bg-[#0b0a13]/90 px-3 py-2 shadow-2xl' : ''}`} data-testid="dm-story-flow-toolbar">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><GitBranch className="h-4 w-4 text-violet-300" />剧情世界线</div>
            <p className="mt-1 text-[10px] text-slate-500">{workspace.events.length} 个节点 · 完整事件、分支条件与时间线；点击节点查看细节与 PDF 原文</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" aria-label="缩小剧情图" onClick={() => zoomAroundViewportCenter(zoomRef.current - 0.1)} className="rounded-lg border border-white/10 p-2 text-slate-300"><ZoomOut className="h-3.5 w-3.5" /></button>
            <span aria-label="当前剧情图缩放比例" className="min-w-12 rounded-lg border border-white/10 px-2 py-2 text-center text-[10px] tabular-nums text-slate-300">{Math.round(zoom * 100)}%</span>
            <button type="button" aria-label="放大剧情图" onClick={() => zoomAroundViewportCenter(zoomRef.current + 0.1)} className="rounded-lg border border-white/10 p-2 text-slate-300"><ZoomIn className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={fitCanvas} className="rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-slate-300">适应</button>
            <button type="button" onClick={toggleFullscreen} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-slate-300">{fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}{fullscreen ? '退出全屏' : '全屏'}</button>
            <button type="button" aria-label="切换剧情编辑工具" aria-expanded={editToolsOpen} onClick={() => setEditToolsOpen((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[10px] font-semibold text-slate-200 hover:border-violet-300/30 hover:text-violet-100"><Settings2 className="h-3.5 w-3.5 text-violet-300" />编辑工具<ChevronDown className={`h-3.5 w-3.5 transition-transform ${editToolsOpen ? 'rotate-180' : ''}`} /></button>
          </div>
        </div>

        {editToolsOpen && <div className={`${fullscreen ? 'absolute left-3 right-3 top-full mt-2 max-h-[calc(100vh-6.5rem)] overflow-y-auto border-violet-300/25 bg-[#0b0a13]/95 shadow-2xl backdrop-blur-xl' : 'mt-3 border-violet-400/15 bg-black/15'} rounded-2xl border p-3`} data-testid="dm-story-edit-tools" data-overlay={fullscreen ? 'true' : 'false'}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold text-violet-200">布局与时间</span>
            <button type="button" onClick={() => centerCanvas(1)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300">100%</button>
            <button type="button" onClick={() => centerCanvas()} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300"><LocateFixed className="h-3 w-3" />居中</button>
            <button type="button" onClick={arrange} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300"><RotateCcw className="h-3 w-3" />重新排版</button>
            <button type="button" onClick={makeLinear} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300">改为单线</button>
            <button type="button" onClick={addDecisionNode} className="inline-flex items-center gap-1 rounded-lg border border-amber-400/20 bg-amber-500/[0.07] px-2.5 py-1.5 text-[10px] font-semibold text-amber-200"><GitBranch className="h-3 w-3" />添加选择框</button>
            <button type="button" disabled={!selectedEventId} onClick={() => addTimelineMarkerBelowSelectedEvent()} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300 disabled:opacity-35"><CirclePlus className="h-3 w-3" />时间点</button>
            <button type="button" disabled={!selectedEventId} onClick={() => addTimelineMarkerBelowSelectedEvent(true)} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/20 bg-rose-500/[0.07] px-2.5 py-1.5 text-[10px] text-rose-200 disabled:opacity-35"><Clock3 className="h-3 w-3" />当前时间</button>
            <span className="ml-auto text-[9px] text-slate-600">编辑模式下可拖动节点、分支标签和时间线</span>
          </div>

          <details className="mt-3 rounded-xl border border-white/8 bg-white/[0.015] px-3 py-2">
            <summary className="cursor-pointer text-[10px] font-semibold text-slate-300">添加或管理分支 · {links.length}</summary>
            <div className="mt-3 grid gap-2 2xl:grid-cols-[minmax(150px,1fr)_150px_minmax(170px,1fr)_minmax(150px,1fr)_auto]">
              <select aria-label="分支起点" value={fromEventId} onChange={(event) => setFromEventId(event.target.value)} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200"><option value="">选择起点事件…</option>{workspace.events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select>
              <select aria-label="分支判断类型" value={conditionKind} onChange={(event) => setConditionKind(event.target.value as BranchConditionKind)} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200">
                <option value="always">无条件推进</option>
                <option value="event-completed">指定事件已发生</option>
                <option value="event-skipped">指定事件未发生</option>
                <option value="person-dead">人物已死亡</option>
                <option value="person-alive">人物仍存活</option>
                <option value="manual">其他事件或自定义条件</option>
              </select>
              {conditionKind === 'person-dead' || conditionKind === 'person-alive'
                ? <select aria-label="分支判断人物" value={conditionPersonId} onChange={(event) => setConditionPersonId(event.target.value)} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200"><option value="">选择人物…</option>{analysis.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
                : conditionKind === 'event-completed' || conditionKind === 'event-skipped'
                  ? <select aria-label="分支判断事件" value={conditionEventId} onChange={(event) => setConditionEventId(event.target.value)} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200"><option value="">选择事件…</option>{workspace.events.map((event) => <option key={event.id} value={event.id}>{event.nodeKind === 'decision' ? '◇ ' : ''}{event.title}</option>)}</select>
                  : conditionKind === 'manual'
                    ? <input aria-label="自定义分支条件" value={manualExpression} maxLength={240} onChange={(event) => setManualExpression(event.target.value)} placeholder="例如：警报被触发、玩家交出伪信、检定成功" className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-400/40" />
                    : <div className="rounded-xl border border-white/7 bg-black/10 px-3 py-2 text-[10px] text-slate-600">无需额外条件</div>}
              <select aria-label="分支终点" value={toEventId} onChange={(event) => setToEventId(event.target.value)} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200"><option value="">选择终点事件…</option>{workspace.events.map((event) => <option key={event.id} value={event.id} disabled={event.id === fromEventId}>{event.title}</option>)}</select>
              <button type="button" disabled={!fromEventId || !toEventId || fromEventId === toEventId || ((conditionKind === 'person-dead' || conditionKind === 'person-alive') && !conditionPersonId) || ((conditionKind === 'event-completed' || conditionKind === 'event-skipped') && !conditionEventId) || (conditionKind === 'manual' && !manualExpression.trim())} onClick={() => addLink()} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-35"><Link2 className="h-3.5 w-3.5" />建立分支</button>
            </div>
            {(conditionKind === 'person-dead' || conditionKind === 'person-alive') && conditionPersonId && <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-400/10 bg-cyan-500/[0.025] px-3 py-2 text-[10px] text-slate-500"><span>当前判断：<strong className={selectedPersonState?.status === 'dead' ? 'text-rose-300' : 'text-emerald-300'}>{selectedPersonState?.status === 'dead' ? '已死亡' : '仍存活'}</strong></span><button type="button" onClick={() => setPersonStatus(conditionPersonId, 'active')} className="rounded-md border border-emerald-400/20 px-2 py-1 text-emerald-300">标记存活</button><button type="button" onClick={() => setPersonStatus(conditionPersonId, 'dead')} className="rounded-md border border-rose-400/20 px-2 py-1 text-rose-300">标记死亡</button></div>}
            {(conditionKind === 'event-completed' || conditionKind === 'event-skipped') && selectedConditionEvent && <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-violet-400/10 bg-violet-500/[0.025] px-3 py-2 text-[10px] text-slate-500"><span>事件状态：<strong className={selectedConditionEvent.status === 'completed' ? 'text-emerald-300' : selectedConditionEvent.status === 'skipped' ? 'text-slate-400' : 'text-amber-300'}>{STATUS_COPY[selectedConditionEvent.status]}</strong></span><button type="button" onClick={() => updateEvent(selectedConditionEvent.id, { status: 'completed' })} className="rounded-md border border-emerald-400/20 px-2 py-1 text-emerald-300">标记已发生</button><button type="button" onClick={() => updateEvent(selectedConditionEvent.id, { status: 'skipped' })} className="rounded-md border border-slate-400/20 px-2 py-1 text-slate-300">标记未发生</button></div>}
            {links.length > 0 && <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">{links.map((link) => { const label = conditionLabel(link, analysis, workspace.events); const selected = selectedLinkId === link.id; return <div key={link.id} className={`inline-flex items-center rounded-lg border bg-black/15 text-[9px] ${selected ? 'border-violet-300/45 ring-1 ring-violet-400/20' : 'border-white/8'}`}><button type="button" aria-label={`编辑剧情箭头：${workspace.events.find((event) => event.id === link.fromEventId)?.title ?? ''} 到 ${workspace.events.find((event) => event.id === link.toEventId)?.title ?? ''}`} onClick={() => { setSelectedLinkId(link.id); setSelectedEventId(null) }} className="inline-flex items-center gap-1 px-2 py-1 text-slate-500"><span className="max-w-24 truncate">{workspace.events.find((event) => event.id === link.fromEventId)?.title}</span><span style={{ color: conditionColor(link, workspace) }}>→{label ? ` ${label} →` : ''}</span><span className="max-w-24 truncate">{workspace.events.find((event) => event.id === link.toEventId)?.title}</span></button><button type="button" aria-label="删除剧情箭头" onClick={() => removeLink(link.id)} className="px-1.5 py-1 text-rose-400/70"><Trash2 className="h-3 w-3" /></button></div> })}<button type="button" onClick={() => commitLinks([])} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/15 px-2 py-1 text-[9px] text-rose-300"><Unlink className="h-3 w-3" />清空箭头</button></div>}
          </details>
          {selectedLink && <LinkEditor link={selectedLink} workspace={workspace} analysis={analysis} onChange={(patch) => updateLink(selectedLink.id, patch)} onResolve={(resolution) => resolveLink(selectedLink.id, resolution)} onResetPosition={() => updateLink(selectedLink.id, { labelPosition: undefined })} onRemove={() => { removeLink(selectedLink.id); setSelectedLinkId(null) }} />}
          {selectedTimelineMarker && <div className={`mt-2 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${selectedTimelineMarkerReached ? 'border-emerald-400/30 bg-emerald-500/[0.07]' : 'border-rose-400/15 bg-rose-500/[0.035]'}`} data-testid="dm-story-timeline-marker-editor" data-timeline-reached={selectedTimelineMarkerReached ? 'true' : 'false'}>
            <Clock3 className={`h-3.5 w-3.5 ${selectedTimelineMarkerReached ? 'text-emerald-300' : 'text-rose-300'}`} />
            <input aria-label="时间横线名称" value={selectedTimelineMarker.label} maxLength={160} onChange={(event) => updateTimelineMarker(selectedTimelineMarker.id, { label: event.target.value })} className="min-w-48 flex-1 rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5 text-[10px] text-slate-200 outline-none focus:border-rose-400/40" />
            {selectedTimelineMarkerReached && <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-200">已到达</span>}
            <button type="button" onClick={() => updateTimelineMarker(selectedTimelineMarker.id, { label: formatCampaignTime(campaignClock), gameTimeWorldMinute: campaignClock.worldMinute })} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${selectedTimelineMarkerReached ? 'border-emerald-400/25 text-emerald-200' : 'border-rose-400/20 text-rose-200'}`}>设为当前时间</button>
            <button type="button" aria-label="删除时间横线" onClick={() => { commitTimelineMarkers(timelineMarkers.filter((marker) => marker.id !== selectedTimelineMarker.id)); setSelectedTimelineMarkerId(null) }} className="rounded-lg border border-rose-400/15 p-1.5 text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>}
        </div>}
      </div>

      <div ref={viewportRef} data-testid="dm-story-flow-viewport" className={`${fullscreen ? 'min-h-0 flex-1' : 'max-h-[760px]'} overflow-auto bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.055),transparent_55%)] [overscroll-behavior:auto] [scrollbar-gutter:stable]`}>
        <div
          className="grid min-h-full min-w-full place-items-center"
          style={{
            width: `max(100%, ${canvasSize.width * zoom}px)`,
            height: `max(100%, ${canvasSize.height * zoom}px)`,
          }}
        >
          <div style={{ width: canvasSize.width * zoom, height: canvasSize.height * zoom }}>
          <div ref={canvasRef} data-testid="dm-story-flow-canvas" onPointerDown={(pointer) => {
            if ((pointer.target as HTMLElement).closest('[data-story-event-node],[data-story-time-marker],button,input,select,textarea')) return
            const viewport = viewportRef.current
            if (!viewport) return
            graphSectionRef.current?.focus({ preventScroll: true })
            canvasGestureRef.current = { pointerId: pointer.pointerId, clientX: pointer.clientX, clientY: pointer.clientY, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop }
            pointer.currentTarget.setPointerCapture(pointer.pointerId)
          }} onPointerMove={(pointer) => {
            const gesture = canvasGestureRef.current
            const viewport = viewportRef.current
            if (!gesture || gesture.pointerId !== pointer.pointerId || !viewport) return
            const deltaX = pointer.clientX - gesture.clientX
            const deltaY = pointer.clientY - gesture.clientY
            if (!storyCanvasGestureIsClick(deltaX, deltaY)) {
              viewport.scrollLeft = Math.max(0, gesture.scrollLeft - deltaX)
              viewport.scrollTop = Math.max(0, gesture.scrollTop - deltaY)
            }
          }} onPointerUp={(pointer) => {
            const gesture = canvasGestureRef.current
            if (!gesture || gesture.pointerId !== pointer.pointerId) return
            canvasGestureRef.current = null
            pointer.currentTarget.releasePointerCapture(pointer.pointerId)
            const deltaX = pointer.clientX - gesture.clientX
            const deltaY = pointer.clientY - gesture.clientY
            if (storyCanvasGestureIsClick(deltaX, deltaY)) setSelectedEventId(null)
          }} onPointerCancel={() => { canvasGestureRef.current = null }} className="relative origin-top-left cursor-grab active:cursor-grabbing" style={{ width: canvasSize.width, height: canvasSize.height, transform: `translateZ(0) scale(${zoom})`, willChange: 'transform', touchAction: 'none' }}>
            <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
              <defs><marker id="story-arrow-vertical" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="context-stroke" /></marker></defs>
              {links.map((link) => {
                const from = displayPositions[link.fromEventId]
                const to = displayPositions[link.toEventId]
                if (!from || !to) return null
                const startX = from.x + nodeWidth / 2
                const startY = from.y + nodeHeight
                const endX = to.x + nodeWidth / 2
                const endY = to.y
                const bend = Math.max(50, Math.abs(endY - startY) * 0.46)
                const color = conditionColor(link, workspace)
                const blocked = evaluateStoryLinkCondition(link, workspace) === 'blocked' || storyEventAvailability(workspace, link.fromEventId) === 'blocked'
                return <g key={link.id} opacity={blocked ? 0.32 : 1}><path d={`M ${startX} ${startY} C ${startX} ${startY + bend}, ${endX} ${endY - bend}, ${endX} ${endY}`} fill="none" stroke={color} strokeWidth="2.4" strokeOpacity="0.86" markerEnd="url(#story-arrow-vertical)" /></g>
              })}
            </svg>

            {links.map((link) => {
              const label = compactLinkLabel(conditionLabel(link, analysis, workspace.events))
              const layout = edgeLabelLayouts.get(link.id)
              if (!label || !layout) return null
              const color = conditionColor(link, workspace)
              const selected = selectedLinkId === link.id
              return <button
                key={`label-${link.id}`}
                type="button"
                data-story-link-label
                data-story-link-selected={selected ? 'true' : 'false'}
                onPointerDown={(pointer) => {
                  if (pointer.button !== 0) return
                  pointer.stopPropagation()
                  const rect = pointer.currentTarget.getBoundingClientRect()
                  linkLabelDragRef.current = { id: link.id, pointerId: pointer.pointerId, dx: (pointer.clientX - rect.left) / zoom, dy: (pointer.clientY - rect.top) / zoom, x: layout.x, y: layout.y, moved: false }
                  pointer.currentTarget.setPointerCapture(pointer.pointerId)
                }}
                onPointerMove={(pointer) => {
                  const drag = linkLabelDragRef.current
                  const canvas = canvasRef.current
                  if (!drag || drag.id !== link.id || drag.pointerId !== pointer.pointerId || !canvas) return
                  const rect = canvas.getBoundingClientRect()
                  const next = { x: Math.max(8, (pointer.clientX - rect.left) / zoom - drag.dx), y: Math.max(8, (pointer.clientY - rect.top) / zoom - drag.dy) }
                  if (Math.abs(next.x - drag.x) > 2 || Math.abs(next.y - drag.y) > 2) drag.moved = true
                  drag.x = next.x
                  drag.y = next.y
                  setLinkLabelDragPreview({ id: link.id, ...next })
                }}
                onPointerUp={(pointer) => {
                  const drag = linkLabelDragRef.current
                  if (!drag || drag.id !== link.id || drag.pointerId !== pointer.pointerId) return
                  pointer.currentTarget.releasePointerCapture(pointer.pointerId)
                  linkLabelDragRef.current = null
                  setLinkLabelDragPreview(null)
                  setSelectedLinkId(link.id)
                  setSelectedEventId(null)
                  if (drag.moved) updateLink(link.id, { labelPosition: { x: drag.x, y: drag.y } })
                }}
                onPointerCancel={() => { linkLabelDragRef.current = null; setLinkLabelDragPreview(null) }}
                className={`absolute z-[3] cursor-grab rounded-[10px] border bg-[#090812] px-1.5 text-center text-xs font-semibold shadow-lg outline-none active:cursor-grabbing hover:brightness-125 ${selected ? 'ring-2 ring-white/45' : ''}`}
                style={{ left: layout.x, top: layout.y, width: layout.width, height: layout.height, color, borderColor: color, touchAction: 'none' }}
              >{label}</button>
            })}

            {timelineMarkers.map((marker) => {
              const markerY = timelineMarkerDragPreview?.id === marker.id ? timelineMarkerDragPreview.y : marker.y
              const markerReached = storyTimelineMarkerIsReached(marker, campaignClock.worldMinute)
              return <div
                key={marker.id}
                data-story-time-marker
                data-testid="dm-story-timeline-marker"
                role="button"
                tabIndex={0}
                aria-label={`移动时间横线：${marker.label || '时间待设置'}`}
                onPointerDown={(pointer) => {
                  if (pointer.button !== 0) return
                  pointer.stopPropagation()
                  setSelectedTimelineMarkerId(marker.id)
                  timelineMarkerDragRef.current = { id: marker.id, pointerId: pointer.pointerId, clientY: pointer.clientY, startY: marker.y, y: marker.y, moved: false }
                  pointer.currentTarget.setPointerCapture(pointer.pointerId)
                }}
                onPointerMove={(pointer) => {
                  const drag = timelineMarkerDragRef.current
                  if (!drag || drag.id !== marker.id || drag.pointerId !== pointer.pointerId) return
                  const deltaY = pointer.clientY - drag.clientY
                  const nextY = moveStoryTimelineMarkerY(drag.startY, deltaY, zoom)
                  if (!storyCanvasGestureIsClick(0, deltaY)) drag.moved = true
                  drag.y = nextY
                  setTimelineMarkerDragPreview({ id: marker.id, y: nextY })
                }}
                onPointerUp={(pointer) => {
                  const drag = timelineMarkerDragRef.current
                  if (!drag || drag.id !== marker.id || drag.pointerId !== pointer.pointerId) return
                  pointer.currentTarget.releasePointerCapture(pointer.pointerId)
                  timelineMarkerDragRef.current = null
                  setTimelineMarkerDragPreview(null)
                  if (drag.moved && drag.y !== marker.y) updateTimelineMarker(marker.id, { y: drag.y })
                }}
                onPointerCancel={() => {
                  timelineMarkerDragRef.current = null
                  setTimelineMarkerDragPreview(null)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                  event.preventDefault()
                  updateTimelineMarker(marker.id, { y: moveStoryTimelineMarkerY(marker.y, event.key === 'ArrowUp' ? -10 : 10, 1) })
                }}
                className={`pointer-events-auto absolute left-0 right-0 z-[1] h-3 -translate-y-1/2 cursor-ns-resize select-none outline-none ${markerReached ? 'focus-visible:bg-emerald-500/10' : 'focus-visible:bg-rose-500/10'}`}
                style={{ top: markerY, touchAction: 'none' }}
              >
                <span className={`pointer-events-none absolute inset-x-0 top-1/2 border-t ${markerReached ? 'border-emerald-400/75 shadow-[0_-1px_8px_rgba(52,211,153,0.2)]' : 'border-rose-400/70 shadow-[0_-1px_8px_rgba(251,113,133,0.18)]'}`} />
                <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1 text-[9px] font-semibold shadow-lg ${markerReached ? selectedTimelineMarkerId === marker.id ? 'border-emerald-300/65 bg-emerald-500/25 text-emerald-100' : 'border-emerald-400/30 bg-[#0c1a16] text-emerald-300' : selectedTimelineMarkerId === marker.id ? 'border-rose-300/60 bg-rose-500/25 text-rose-100' : 'border-rose-400/25 bg-[#160d17] text-rose-300'}`}>{marker.label || '时间待设置'}</span>
              </div>
            })}

            {workspace.events.map((event) => {
              const position = displayPositions[event.id] ?? { x: 420, y: 56 }
              const timelinePosition = positions[event.id] ?? position
              const outgoing = links.filter((link) => link.fromEventId === event.id)
              const citations = eventCitations.get(event.id) ?? []
              const completedByTimeline = event.status !== 'skipped' && storyEventIsBeforeTimeline(timelinePosition.y, NODE_HEIGHT, reachedTimelineY)
              const visualStatus: AccountStoryEventStatusV1 = completedByTimeline ? 'completed' : event.status
              const selected = selectedEventId === event.id
              const firstCitation = citations[0]
              const availability = storyEventAvailability(workspace, event.id)
              const blockedByBranch = availability === 'blocked' && event.status !== 'completed' && event.status !== 'active'
              const isDecision = event.nodeKind === 'decision'
              const decisionColor = blockedByBranch ? '#64748b' : visualStatus === 'completed' ? '#34d399' : visualStatus === 'active' ? '#22d3ee' : '#a78bfa'
              return <article key={event.id} data-story-event-node data-story-explicit-decision={isDecision ? 'true' : undefined} data-story-event-availability={availability} data-story-event-selected={selected ? 'true' : 'false'} onPointerDown={(pointer) => {
                if ((pointer.target as HTMLElement).closest('button')) return
                const rect = pointer.currentTarget.getBoundingClientRect()
                dragRef.current = { id: event.id, dx: (pointer.clientX - rect.left) / zoom, dy: (pointer.clientY - rect.top) / zoom, x: position.x, y: position.y, moved: false }
                pointer.currentTarget.setPointerCapture(pointer.pointerId)
              }} onPointerMove={(pointer) => {
                const drag = dragRef.current
                const canvas = canvasRef.current
                if (!drag || drag.id !== event.id || !canvas) return
                const rect = canvas.getBoundingClientRect()
                const next = { x: Math.max(16, (pointer.clientX - rect.left) / zoom - drag.dx), y: Math.max(16, (pointer.clientY - rect.top) / zoom - drag.dy) }
                if (Math.abs(next.x - drag.x) > 2 || Math.abs(next.y - drag.y) > 2) drag.moved = true
                drag.x = next.x
                drag.y = next.y
                setPositions((current) => ({ ...current, [event.id]: next }))
              }} onPointerUp={(pointer) => {
                const drag = dragRef.current
                if (!drag || drag.id !== event.id) return
                pointer.currentTarget.releasePointerCapture(pointer.pointerId)
                dragRef.current = null
                if (!drag.moved) {
                  setSelectedEventId(event.id)
                  setDetailEventId(event.id)
                  return
                }
                commitEvents(workspace.events.map((candidate) => candidate.id === event.id ? { ...candidate, graphPosition: { x: drag.x, y: drag.y } } : candidate))
              }} data-timeline-completed={completedByTimeline ? 'true' : 'false'} className={`absolute z-[2] cursor-grab select-none transition-[filter,opacity,box-shadow,border-color] active:cursor-grabbing ${isDecision ? 'overflow-visible border border-transparent bg-transparent' : `overflow-hidden rounded-xl border shadow-xl ${STATUS_STYLE[visualStatus]}`} ${selected && !isDecision ? 'ring-2 ring-violet-300/80 ring-offset-2 ring-offset-[#080711] shadow-[0_0_34px_rgba(139,92,246,0.22)]' : ''} ${!isDecision && (completedByTimeline ? 'hover:border-emerald-300/70 hover:shadow-[0_0_26px_rgba(52,211,153,0.14)]' : 'hover:border-violet-300/60 hover:shadow-[0_0_26px_rgba(139,92,246,0.14)]')} ${blockedByBranch ? 'grayscale opacity-35' : availability === 'waiting' ? 'opacity-[0.85]' : ''}`} style={{ left: position.x, top: position.y, width: nodeWidth, height: nodeHeight, touchAction: 'none' }}>
                {isDecision ? <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center" style={{ width: 132, height: 132 }}>
                  <svg className="absolute inset-0 h-full w-full drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]" viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,2 98,50 50,98 2,50" fill={blockedByBranch ? '#11131a' : '#171321'} stroke={decisionColor} strokeWidth={selected ? 3 : 1.8} /></svg>
                  <div className="relative max-w-[78%] text-center"><strong className="line-clamp-3 text-[12px] font-semibold leading-4 text-slate-100">{event.title}</strong><span className="mt-1 block text-[8px]" style={{ color: decisionColor }}>{blockedByBranch ? '支线未触发' : availability === 'waiting' ? '等待选择' : STATUS_COPY[visualStatus]}</span></div>
                </div> : <>
                  <div className="border-b border-white/8 px-3.5 py-2.5"><div className="flex items-start gap-2"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${visualStatus === 'active' ? 'animate-pulse bg-cyan-300' : visualStatus === 'completed' ? 'bg-emerald-400' : visualStatus === 'skipped' ? 'bg-slate-600' : 'bg-violet-400'}`} /><strong className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-5 text-slate-100">{event.title}</strong><span className="shrink-0 text-[9px] text-slate-600">{STATUS_COPY[visualStatus]}</span></div><p className="mt-1 truncate pl-4 text-[10px] text-slate-500">{event.timeLabel || '时间待校准'}</p></div>
                  <p className="line-clamp-2 px-3.5 pt-2.5 text-[11px] leading-[1.15rem] text-slate-300">{event.summary || '点击查看事件详情。'}</p>
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 border-t border-white/7 bg-black/25 px-3 py-2 text-[9px] text-slate-500">
                    {firstCitation && <button type="button" title={`${firstCitation.documentName} · 第 ${firstCitation.page} 页`} onClick={(click) => { click.stopPropagation(); setSelectedCitation(firstCitation) }} className="inline-flex max-w-[9rem] items-center gap-1 truncate rounded-md border border-sky-400/15 bg-sky-500/[0.06] px-1.5 py-0.5 font-semibold text-sky-200"><Bookmark className="h-2.5 w-2.5 shrink-0" />第 {firstCitation.page} 页{citations.length > 1 ? ` +${citations.length - 1}` : ''}</button>}
                    {event.sceneIds.length > 0 && <span>{event.sceneIds.length} 场景</span>}
                    {(event.personIds.length > 0 || event.clueIds.length > 0) && <span>{event.personIds.length + event.clueIds.length} 关联</span>}
                    <span className="ml-auto">{outgoing.length > 0 ? `${outgoing.length} 分支` : '末端'}</span>
                  </div>
                </>}
              </article>
            })}
          </div>
          </div>
        </div>
      </div>

      {detailEvent && !editingEvent && <StoryEventDetail
        event={detailEvent}
        analysis={analysis}
        events={workspace.events}
        citations={eventCitations.get(detailEvent.id) ?? []}
        outgoingLinks={links.filter((link) => link.fromEventId === detailEvent.id)}
        onClose={() => setDetailEventId(null)}
        onEdit={() => { setDetailEventId(null); setEditingEventId(detailEvent.id) }}
        onResolveLink={resolveLink}
        onCitationOpen={setSelectedCitation}
      />}
      {editingEvent && <EventEditor
        event={editingEvent}
        analysis={analysis}
        events={workspace.events}
        outcomeIds={[...new Set(links.filter((link) => link.fromEventId === editingEvent.id).map((link) => link.toEventId))]}
        onClose={() => setEditingEventId(null)}
        onChange={(patch) => updateEvent(editingEvent.id, patch)}
        onToggleOutcome={(toEventId) => toggleOutcome(editingEvent.id, toEventId)}
        onRemove={() => removeEvent(editingEvent)}
      />}
      <PdfSourceEvidenceDrawer citation={selectedCitation} onClose={() => setSelectedCitation(null)} />
    </section>
  )
}

function StoryEventDetail({ event, analysis, events, citations, outgoingLinks, onClose, onEdit, onResolveLink, onCitationOpen }: {
  event: AccountStoryEventV1
  analysis: PdfCampaignAnalysisV2
  events: AccountStoryEventV1[]
  citations: readonly PdfViewCitation[]
  outgoingLinks: AccountStoryEventLinkV1[]
  onClose: () => void
  onEdit: () => void
  onResolveLink: (linkId: string, resolution: NonNullable<AccountStoryEventLinkV1['resolution']>) => void
  onCitationOpen: (citation: PdfViewCitation) => void
}) {
  const attachedScenes = analysis.scenes.filter((scene) => event.sceneIds.includes(scene.id))
  const people = analysis.people.filter((person) => event.personIds.includes(person.id))
  const clues = analysis.clues.filter((clue) => event.clueIds.includes(clue.id))
  return <div className="fixed inset-0 z-[390] flex justify-end bg-black/65 backdrop-blur-sm" onPointerDown={(pointer) => { if (pointer.target === pointer.currentTarget) onClose() }}>
    <aside role="dialog" aria-modal="true" aria-label="剧情事件详情" className="h-full w-full max-w-xl overflow-y-auto border-l border-violet-400/20 bg-[#0b0a13] p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[9px] font-semibold text-violet-200">{STATUS_COPY[event.status]}</span>{event.timeLabel && <span className="text-[10px] text-slate-500">{event.timeLabel}</span>}</div><h3 className="mt-3 text-xl font-bold leading-7 text-slate-100">{event.title}</h3></div>
        <button type="button" aria-label="关闭剧情事件详情" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-slate-400"><X className="h-4 w-4" /></button>
      </div>

      <section className="mt-5 rounded-2xl border border-white/8 bg-white/[0.018] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">事件概要</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{event.summary || '暂无概要。'}</p>{event.details && <><div className="my-4 border-t border-white/7" /><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">DM 运行细节</p><p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-400">{event.details}</p></>}</section>

      <section className="mt-4 rounded-2xl border border-sky-400/15 bg-sky-500/[0.035] p-4" data-testid="dm-story-source-bookmarks">
        <div className="flex items-center gap-2"><Bookmark className="h-4 w-4 text-sky-300" /><strong className="text-xs text-sky-100">PDF 原文书签</strong><span className="ml-auto text-[10px] text-sky-200">{citations.length} 处</span></div>
        {citations.length > 0 ? <PdfCitationButtons citations={citations} onOpen={onCitationOpen} /> : <p className="mt-2 text-[10px] leading-5 text-slate-500">这个节点没有可核验的 PDF 页码。</p>}
      </section>

      {attachedScenes.length > 0 && <section className="mt-4"><div className="flex items-center justify-between"><h4 className="text-xs font-semibold text-slate-200">关联场景</h4><span className="text-[10px] text-slate-600">{attachedScenes.length}</span></div><div className="mt-2 space-y-2">{attachedScenes.map((scene) => <article key={scene.id} className="rounded-xl border border-white/8 bg-black/15 p-3"><strong className="text-xs text-slate-200">{scene.name}</strong>{scene.location && <span className="ml-2 text-[10px] text-sky-300/70">{scene.location}</span>}<p className="mt-1 line-clamp-3 text-[10px] leading-5 text-slate-500">{scene.description || '暂无场景说明'}</p></article>)}</div></section>}

      {(people.length > 0 || clues.length > 0) && <section className="mt-4 grid gap-3 sm:grid-cols-2"><RelatedList title="人物" values={people.map((person) => person.name)} /><RelatedList title="线索" values={clues.map((clue) => clue.name)} /></section>}
      {outgoingLinks.length > 0 && <section className="mt-4 rounded-2xl border border-white/8 p-4"><h4 className="text-xs font-semibold text-slate-200">{event.nodeKind === 'decision' ? '玩家选择' : '可能走向'} · {outgoingLinks.length}</h4><div className="mt-2 space-y-1.5">{outgoingLinks.map((link) => <div key={link.id} className={`rounded-lg border px-3 py-2 text-[10px] ${link.resolution === 'triggered' ? 'border-emerald-400/25 bg-emerald-500/[0.06]' : link.resolution === 'not-triggered' ? 'border-slate-700 bg-slate-950/60 opacity-55' : 'border-white/7 bg-white/[0.025]'}`}><div className="flex items-center gap-2"><span className="font-semibold text-violet-200">{link.label || conditionLabel(link, analysis, events) || '无条件推进'}</span><span className="text-slate-700">→</span><span className="min-w-0 flex-1 truncate text-slate-400">{events.find((entry) => entry.id === link.toEventId)?.title ?? '后续事件'}</span>{link.resolution === 'triggered' && <span className="text-emerald-300">已触发</span>}{link.resolution === 'not-triggered' && <span className="text-slate-500">未触发</span>}</div>{event.nodeKind === 'decision' && <div className="mt-2 flex justify-end gap-1.5"><button type="button" onClick={() => onResolveLink(link.id, 'triggered')} className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 text-emerald-200">选择此项</button><button type="button" onClick={() => onResolveLink(link.id, 'pending')} className="rounded-md border border-white/8 px-2 py-1 text-slate-500">重置选择</button></div>}</div>)}</div></section>}

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-white/8 bg-[#0b0a13]/95 py-4 backdrop-blur"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300">关闭</button><button type="button" onClick={onEdit} className="rounded-xl bg-violet-500 px-4 py-2 text-xs font-semibold text-white">编辑此节点</button></div>
    </aside>
  </div>
}

function RelatedList({ title, values }: { title: string; values: string[] }) {
  return <div className="rounded-xl border border-white/8 bg-white/[0.015] p-3"><p className="text-[10px] font-semibold text-slate-500">{title} · {values.length}</p><div className="mt-2 flex flex-wrap gap-1.5">{values.map((value) => <span key={value} className="rounded-full border border-white/8 px-2 py-1 text-[10px] text-slate-300">{value}</span>)}</div></div>
}

function EventEditor({ event, analysis, events, outcomeIds, onClose, onChange, onToggleOutcome, onRemove }: {
  event: AccountStoryEventV1
  analysis: PdfCampaignAnalysisV2
  events: AccountStoryEventV1[]
  outcomeIds: string[]
  onClose: () => void
  onChange: (patch: Partial<AccountStoryEventV1>) => void
  onToggleOutcome: (eventId: string) => void
  onRemove: () => void
}) {
  const attachedScenes = analysis.scenes.filter((scene) => event.sceneIds.includes(scene.id))
  return <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onPointerDown={(pointer) => { if (pointer.target === pointer.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-label="编辑剧情事件" className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-violet-400/25 bg-[#0b0a13] p-5 shadow-2xl">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-violet-300">StoryEvent</p><h3 className="mt-1 text-lg font-bold text-slate-100">编辑剧情节点</h3>{(event.dmEditedFields?.length ?? 0) > 0 && <p className="mt-1 text-[9px] text-amber-300/75">DM 已覆盖 {event.dmEditedFields?.length} 个 SOL 字段；后续分析不会自动替换这些字段。</p>}</div><button type="button" aria-label="关闭剧情事件编辑器" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-slate-400"><X className="h-4 w-4" /></button></div>
    <div className="mt-4 grid gap-3 lg:grid-cols-[150px_minmax(0,0.8fr)_minmax(0,1.2fr)]"><label className="text-[9px] text-slate-500">节点类型<select aria-label="剧情节点类型" value={event.nodeKind ?? 'event'} onChange={(change) => onChange({ nodeKind: change.target.value as 'event' | 'decision' })} className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0b0a13] px-3 py-2 text-xs text-slate-100"><option value="event">事件框</option><option value="decision">选择框</option></select></label><label className="text-[9px] text-slate-500">{event.nodeKind === 'decision' ? '选择问题' : '事件名称'}<input value={event.title} maxLength={160} onChange={(change) => onChange({ title: change.target.value })} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-100 outline-none focus:border-violet-400/40" /></label><label className="text-[9px] text-slate-500">时间标签<input value={event.timeLabel} maxLength={160} onChange={(change) => onChange({ timeLabel: change.target.value })} placeholder="例如：伪信送达后、第三日黄昏" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-100 outline-none focus:border-violet-400/40" /></label></div>
    <label className="mt-3 block text-[9px] text-slate-500">事件摘要<textarea value={event.summary} maxLength={2_000} rows={3} onChange={(change) => onChange({ summary: change.target.value })} className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-200 outline-none focus:border-violet-400/40" /></label>
    <label className="mt-3 block text-[9px] text-slate-500">DM 运行细节<textarea value={event.details} maxLength={12_000} rows={5} onChange={(change) => onChange({ details: change.target.value })} className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-200 outline-none focus:border-violet-400/40" /></label>
    {attachedScenes.length > 0 && <section className="mt-3 rounded-xl border border-sky-400/15 bg-sky-500/[0.035] p-3"><p className="text-[10px] font-semibold text-sky-200">可运行场景附件 · {attachedScenes.length}</p><div className="mt-2 grid gap-2 md:grid-cols-2">{attachedScenes.map((scene) => <article key={scene.id} className="rounded-lg border border-white/7 bg-black/15 p-2.5"><p className="text-[10px] font-semibold text-slate-200">{scene.name}</p><p className="mt-1 line-clamp-3 text-[9px] leading-4 text-slate-500">{scene.description || '暂无场景说明'}</p>{scene.location && <p className="mt-1 text-[9px] text-sky-300/60">{scene.location}</p>}</article>)}</div></section>}
    <div className="mt-3 grid gap-3 lg:grid-cols-3"><RelationPicker title="关联人物" entries={analysis.people.map((person) => ({ id: person.id, label: person.name }))} selected={event.personIds} onToggle={(id) => onChange({ personIds: toggle(event.personIds, id) })} /><RelationPicker title="关联线索" entries={analysis.clues.map((clue) => ({ id: clue.id, label: clue.name }))} selected={event.clueIds} onToggle={(id) => onChange({ clueIds: toggle(event.clueIds, id) })} /><RelationPicker title="关联结局" entries={events.filter((candidate) => candidate.id !== event.id).map((candidate) => ({ id: candidate.id, label: candidate.title }))} selected={outcomeIds} onToggle={onToggleOutcome} /></div>
    <div className="mt-4 flex flex-wrap items-center gap-2">{(Object.keys(STATUS_COPY) as AccountStoryEventStatusV1[]).map((status) => <button key={status} type="button" onClick={() => onChange({ status })} className={`rounded-lg border px-2.5 py-1.5 text-[10px] ${event.status === status ? 'border-violet-400/30 bg-violet-500/15 text-violet-100' : 'border-white/8 text-slate-500'}`}>{STATUS_COPY[status]}</button>)}<button type="button" onClick={onRemove} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-rose-400/15 px-2.5 py-1.5 text-[10px] text-rose-300"><Trash2 className="h-3 w-3" />{event.source === 'dm' ? '删除事件' : '忽略事件'}</button><button type="button" onClick={onClose} className="rounded-lg bg-violet-500 px-4 py-1.5 text-[10px] font-semibold text-white">完成</button></div>
  </section></div>
}

function LinkEditor({ link, workspace, analysis, onChange, onResolve, onResetPosition, onRemove }: {
  link: AccountStoryEventLinkV1
  workspace: AccountCampaignStoryWorkspaceV1
  analysis: PdfCampaignAnalysisV2
  onChange: (patch: Partial<AccountStoryEventLinkV1>) => void
  onResolve: (resolution: NonNullable<AccountStoryEventLinkV1['resolution']>) => void
  onResetPosition: () => void
  onRemove: () => void
}) {
  const condition = link.condition ?? { kind: 'always' as const }
  const from = workspace.events.find((event) => event.id === link.fromEventId)?.title ?? '未知事件'
  const to = workspace.events.find((event) => event.id === link.toEventId)?.title ?? '未知事件'
  const selectedPersonId = condition.kind === 'person-state' ? condition.personId : ''
  const selectedPersonState = condition.kind === 'person-state' ? condition.state : 'alive'
  const selectedConditionEventId = condition.kind === 'event-status' ? condition.eventId : ''
  const selectedConditionEventStatus = condition.kind === 'event-status' ? condition.status : 'completed'
  const conditionKind: BranchConditionKind = condition.kind === 'person-state'
    ? condition.state === 'dead' ? 'person-dead' : 'person-alive'
    : condition.kind === 'event-status'
      ? condition.status === 'completed' ? 'event-completed' : 'event-skipped'
      : condition.kind === 'manual' ? 'manual' : 'always'
  const setKind = (kind: BranchConditionKind) => {
    if (kind === 'always') onChange({ condition: { kind: 'always' } })
    else if (kind === 'manual') onChange({ condition: { kind: 'manual', expression: condition.kind === 'manual' ? condition.expression : '填写事件、选择、线索或检定条件' } })
    else if (kind === 'event-completed' || kind === 'event-skipped') {
      const eventId = selectedConditionEventId || link.fromEventId || workspace.events[0]?.id
      if (eventId) onChange({ condition: { kind: 'event-status', eventId, status: kind === 'event-completed' ? 'completed' : 'skipped' } })
    }
    else {
      const personId = selectedPersonId || analysis.people[0]?.id
      if (personId) onChange({ condition: { kind: 'person-state', personId, state: kind === 'person-dead' ? 'dead' : 'alive' } })
    }
  }
  return <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3" data-testid="dm-story-link-editor">
    <div className="flex flex-wrap items-center gap-2"><strong className="text-xs text-slate-200">编辑分支</strong><span className="min-w-0 truncate text-[10px] text-slate-500">{from} → {to}</span><span className="ml-auto text-[10px]" style={{ color: conditionColor(link, workspace) }}>{conditionLabel(link, analysis, workspace.events) || '无条件推进'}</span></div>
    <div className="mt-2 grid gap-2 md:grid-cols-[minmax(180px,1fr)_auto_minmax(180px,1fr)]">
      <select aria-label="编辑分支起点" value={link.fromEventId} onChange={(event) => onChange({ fromEventId: event.target.value, resolution: 'pending', labelPosition: undefined })} className="rounded-lg border border-white/10 bg-[#0b0a13] px-2.5 py-2 text-xs text-slate-200">{workspace.events.map((entry) => <option key={entry.id} value={entry.id} disabled={entry.id === link.toEventId}>{entry.nodeKind === 'decision' ? '◇ ' : ''}{entry.title}</option>)}</select>
      <span className="self-center text-center text-xs text-violet-300">→</span>
      <select aria-label="编辑分支终点" value={link.toEventId} onChange={(event) => onChange({ toEventId: event.target.value, resolution: 'pending', labelPosition: undefined })} className="rounded-lg border border-white/10 bg-[#0b0a13] px-2.5 py-2 text-xs text-slate-200">{workspace.events.map((entry) => <option key={entry.id} value={entry.id} disabled={entry.id === link.fromEventId}>{entry.nodeKind === 'decision' ? '◇ ' : ''}{entry.title}</option>)}</select>
    </div>
    <div className="mt-2 grid gap-2 xl:grid-cols-[160px_minmax(180px,1fr)_minmax(220px,1.2fr)_auto_auto]">
      <select aria-label="编辑分支条件类型" value={conditionKind} onChange={(event) => setKind(event.target.value as BranchConditionKind)} className="rounded-lg border border-white/10 bg-[#0b0a13] px-2.5 py-2 text-xs text-slate-200"><option value="always">无条件推进</option><option value="event-completed">指定事件已发生</option><option value="event-skipped">指定事件未发生</option><option value="person-dead">人物已死亡</option><option value="person-alive">人物仍存活</option><option value="manual">其他事件或自定义条件</option></select>
      {condition.kind === 'person-state'
        ? <select aria-label="编辑分支人物" value={selectedPersonId} onChange={(event) => onChange({ condition: { kind: 'person-state', personId: event.target.value, state: selectedPersonState } })} className="rounded-lg border border-white/10 bg-[#0b0a13] px-2.5 py-2 text-xs text-slate-200">{analysis.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
        : condition.kind === 'event-status'
          ? <select aria-label="编辑分支事件" value={selectedConditionEventId} onChange={(event) => onChange({ condition: { kind: 'event-status', eventId: event.target.value, status: selectedConditionEventStatus } })} className="rounded-lg border border-white/10 bg-[#0b0a13] px-2.5 py-2 text-xs text-slate-200">{workspace.events.map((entry) => <option key={entry.id} value={entry.id}>{entry.nodeKind === 'decision' ? '◇ ' : ''}{entry.title}</option>)}</select>
          : condition.kind === 'manual'
            ? <input aria-label="编辑自定义分支条件" value={condition.expression} maxLength={240} onChange={(event) => onChange({ condition: { kind: 'manual', expression: event.target.value } })} placeholder="例如：警报被触发或玩家取得钥匙" className="rounded-lg border border-white/10 bg-[#0b0a13] px-2.5 py-2 text-xs text-slate-200" />
            : <span className="rounded-lg border border-white/7 px-2.5 py-2 text-[10px] text-slate-600">不需要额外条件</span>}
      <input aria-label="编辑分支说明" value={link.label} maxLength={80} onChange={(event) => onChange({ label: event.target.value })} placeholder="说明该原因如何产生结果" className="rounded-lg border border-white/10 bg-[#0b0a13] px-2.5 py-2 text-xs text-slate-200" />
      <button type="button" onClick={onResetPosition} className="rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-slate-400">自动摆放</button>
      <button type="button" onClick={onRemove} className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-400/20 px-2.5 py-2 text-[10px] text-rose-300"><Trash2 className="h-3 w-3" />删除</button>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-white/7 bg-white/[0.015] px-2.5 py-2">
      <span className="mr-1 text-[10px] text-slate-500">本次剧情结果</span>
      <button type="button" aria-pressed={(link.resolution ?? 'pending') === 'pending'} onClick={() => onResolve('pending')} className={`rounded-md border px-2 py-1 text-[10px] ${(link.resolution ?? 'pending') === 'pending' ? 'border-amber-300/35 bg-amber-500/12 text-amber-200' : 'border-white/8 text-slate-500'}`}>待决定</button>
      <button type="button" aria-pressed={link.resolution === 'triggered'} onClick={() => onResolve('triggered')} className={`rounded-md border px-2 py-1 text-[10px] ${link.resolution === 'triggered' ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-100' : 'border-white/8 text-slate-500'}`}>已触发</button>
      <button type="button" aria-pressed={link.resolution === 'not-triggered'} onClick={() => onResolve('not-triggered')} className={`rounded-md border px-2 py-1 text-[10px] ${link.resolution === 'not-triggered' ? 'border-slate-400/35 bg-slate-500/12 text-slate-200' : 'border-white/8 text-slate-500'}`}>未触发</button>
      <span className="ml-auto text-[9px] text-slate-600">选择框只允许一个出口触发；其余出口会自动变灰</span>
    </div>
  </div>
}

function toggle(values: string[], id: string): string[] {
  return values.includes(id) ? values.filter((value) => value !== id) : [...values, id]
}

function RelationPicker({ title, entries, selected, onToggle }: { title: string; entries: Array<{ id: string; label: string }>; selected: string[]; onToggle: (id: string) => void }) {
  const orderedEntries = prioritizeSelectedStoryEntries(entries, selected)
  return <div className="rounded-xl border border-white/7 bg-white/[0.015] p-3"><p className="text-[10px] font-semibold text-slate-400">{title} · {selected.length}</p><div className="mt-2 max-h-36 space-y-1 overflow-y-auto">{orderedEntries.map((entry) => <button key={entry.id} type="button" aria-pressed={selected.includes(entry.id)} onClick={() => onToggle(entry.id)} className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-[10px] ${selected.includes(entry.id) ? 'bg-violet-500/15 text-violet-100' : 'text-slate-600 hover:bg-white/[0.03] hover:text-slate-400'}`}>{entry.label}</button>)}{entries.length === 0 && <span className="text-[10px] text-slate-700">暂无可关联资料</span>}</div></div>
}
