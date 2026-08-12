import {
  CirclePlus,
  Clock3,
  GitBranch,
  Link2,
  Maximize2,
  Minimize2,
  Pencil,
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
import { evaluateStoryLinkCondition } from './dmCampaignStoryModel'
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
  createStoryTimelineMarker,
  currentStoryTimelineY,
  moveStoryTimelineMarkerY,
  storyCanvasGestureIsClick,
  storyEventIsBeforeTimeline,
  storyTimelineYBelowEvent,
  storyTimelineMarkerIsReached,
} from './dmStoryTimelineMarkers'

const NODE_WIDTH = STORY_GRAPH_NODE_WIDTH
const NODE_HEIGHT = STORY_GRAPH_NODE_HEIGHT
const MIN_ZOOM = 0.25
const MAX_ZOOM = 1.8
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

type BranchConditionKind = 'always' | 'person-dead' | 'person-alive' | 'manual'

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100))
}

export function storyGraphFitZoom(input: {
  viewportWidth: number
  viewportHeight: number
  canvasWidth: number
  canvasHeight: number
  padding?: number
}): number {
  const padding = Math.max(0, input.padding ?? 48)
  const availableWidth = Math.max(1, input.viewportWidth - padding * 2)
  const availableHeight = Math.max(1, input.viewportHeight - padding * 2)
  return clampZoom(Math.min(
    availableWidth / Math.max(1, input.canvasWidth),
    availableHeight / Math.max(1, input.canvasHeight),
    1.1,
  ))
}

export function storyGraphCenteredScroll(input: {
  viewportWidth: number
  viewportHeight: number
  canvasWidth: number
  canvasHeight: number
  zoom: number
}): { left: number; top: number } {
  return {
    left: Math.max(0, (input.canvasWidth * input.zoom - input.viewportWidth) / 2),
    top: Math.max(0, (input.canvasHeight * input.zoom - input.viewportHeight) / 2),
  }
}

export function storyGraphAnchoredScroll(input: {
  viewportWidth: number
  viewportHeight: number
  canvasWidth: number
  canvasHeight: number
  previousZoom: number
  nextZoom: number
  scrollLeft: number
  scrollTop: number
  anchorX: number
  anchorY: number
}): { left: number; top: number } {
  const previousOffsetX = Math.max(0, (input.viewportWidth - input.canvasWidth * input.previousZoom) / 2)
  const previousOffsetY = Math.max(0, (input.viewportHeight - input.canvasHeight * input.previousZoom) / 2)
  const graphX = (input.scrollLeft + input.anchorX - previousOffsetX) / input.previousZoom
  const graphY = (input.scrollTop + input.anchorY - previousOffsetY) / input.previousZoom
  const nextOffsetX = Math.max(0, (input.viewportWidth - input.canvasWidth * input.nextZoom) / 2)
  const nextOffsetY = Math.max(0, (input.viewportHeight - input.canvasHeight * input.nextZoom) / 2)
  return {
    left: Math.max(0, nextOffsetX + graphX * input.nextZoom - input.anchorX),
    top: Math.max(0, nextOffsetY + graphY * input.nextZoom - input.anchorY),
  }
}

function sequentialLinks(events: readonly AccountStoryEventV1[]): AccountStoryEventLinkV1[] {
  return events.slice(1).map((event, index) => ({
    id: `story-link-${Date.now().toString(36)}-${index}`,
    fromEventId: events[index]!.id,
    toEventId: event.id,
    label: '',
    condition: { kind: 'always' },
  }))
}

function conditionLabel(link: AccountStoryEventLinkV1, analysis: PdfCampaignAnalysisV2): string {
  const condition = link.condition
  if (!condition || condition.kind === 'always') return link.label === '然后' ? '' : link.label
  if (condition.kind === 'manual') return link.label ? `${condition.expression} · ${link.label}` : condition.expression
  if (condition.kind === 'event-status') {
    const status = `${condition.status === 'completed' ? '已完成' : '已跳过'}指定事件`
    return link.label ? `${status} · ${link.label}` : status
  }
  const person = analysis.people.find((entry) => entry.id === condition.personId)
  const status = `${person?.name ?? '指定人物'}${condition.state === 'dead' ? '已死亡' : '仍存活'}`
  return link.label ? `${status} · ${link.label}` : status
}

function conditionColor(link: AccountStoryEventLinkV1, workspace: AccountCampaignStoryWorkspaceV1): string {
  const result = evaluateStoryLinkCondition(link, workspace)
  if (result === 'matched') return link.condition?.kind === 'always' || !link.condition ? '#a78bfa' : '#34d399'
  if (result === 'manual') return '#fbbf24'
  return '#64748b'
}

function compactLinkLabel(value: string): string {
  return value.length > 28 ? `${value.slice(0, 27)}…` : value
}

function buildCondition(kind: BranchConditionKind, personId: string, expression: string): AccountStoryEventLinkConditionV1 | null {
  if (kind === 'always') return { kind: 'always' }
  if (kind === 'manual') return expression.trim() ? { kind: 'manual', expression: expression.trim() } : null
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
  const [manualExpression, setManualExpression] = useState('')
  const [zoom, setZoom] = useState(0.95)
  const [fullscreen, setFullscreen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
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

  const edgeLabelLayouts = useMemo(() => new Map(
    layoutStoryGraphEdgeLabels(links, positions, (link) => compactLinkLabel(conditionLabel(link, analysis)))
      .map((layout) => {
        const link = links.find((candidate) => candidate.id === layout.linkId)
        const preview = linkLabelDragPreview?.id === layout.linkId ? linkLabelDragPreview : undefined
        return [layout.linkId, {
          ...layout,
          x: preview?.x ?? link?.labelPosition?.x ?? layout.x,
          y: preview?.y ?? link?.labelPosition?.y ?? layout.y,
        }]
      }),
  ), [analysis, linkLabelDragPreview, links, positions])
  const canvasSize = useMemo(() => {
    const values = Object.values(positions)
    const labelValues = [...edgeLabelLayouts.values()]
    return {
      width: Math.max(MIN_CANVAS_WIDTH, ...values.map((position) => position.x + NODE_WIDTH + 80), ...labelValues.map((label) => label.x + label.width + 80)),
      height: Math.max(680, ...values.map((position) => position.y + NODE_HEIGHT + 80), ...labelValues.map((label) => label.y + label.height + 80), ...timelineMarkers.map((marker) => (timelineMarkerDragPreview?.id === marker.id ? timelineMarkerDragPreview.y : marker.y) + 80)),
    }
  }, [edgeLabelLayouts, positions, timelineMarkerDragPreview, timelineMarkers])

  const commitEvents = (events: AccountStoryEventV1[]) => commitWorkspace({ ...workspace, events, graphInitialized: true, graphLayoutVersion: 4 })
  const commitLinks = (nextLinks: AccountStoryEventLinkV1[]) => commitWorkspace({ ...workspace, graphLinks: nextLinks, graphInitialized: true, graphLayoutVersion: 4 })
  const updateLink = (id: string, patch: Partial<AccountStoryEventLinkV1>) => commitLinks(links.map((link) => link.id === id ? { ...link, ...patch } : link))
  const updateEvent = (id: string, patch: Partial<AccountStoryEventV1>) => commitEvents(workspace.events.map((event) => event.id === id ? { ...event, ...patch } : event))
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
    const condition = buildCondition(conditionKind, conditionPersonId, manualExpression)
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

  const arrange = () => commitEvents(layoutStoryGraphEvents(workspace.events, links))
  const makeLinear = () => {
    const ordered = [...workspace.events].sort((left, right) => (
      (left.graphPosition?.y ?? 0) - (right.graphPosition?.y ?? 0)
      || (left.graphPosition?.x ?? 0) - (right.graphPosition?.x ?? 0)
    ))
    const nextLinks = sequentialLinks(ordered)
    commitWorkspace({ ...workspace, graphLinks: nextLinks, events: layoutStoryGraphEvents(ordered, nextLinks), graphInitialized: true, graphLayoutVersion: 4 })
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
      if (next) fitOnFullscreenRef.current = true
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
      commitWorkspace({
        ...workspace,
        events: workspace.events.filter((candidate) => candidate.id !== event.id),
        graphLinks: links.filter((link) => link.fromEventId !== event.id && link.toEventId !== event.id),
      })
    } else updateEvent(event.id, { status: 'skipped' })
    setSelectedEventId(null)
    setEditingEventId(null)
  }
  const toggleOutcome = (fromEventId: string, toEventId: string) => {
    if (!fromEventId || !toEventId || fromEventId === toEventId) return
    const exists = links.some((link) => link.fromEventId === fromEventId && link.toEventId === toEventId)
    if (exists) {
      commitLinks(links.filter((link) => link.fromEventId !== fromEventId || link.toEventId !== toEventId))
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
    }} className={`${fullscreen ? 'fixed inset-0 z-[260] flex flex-col rounded-none' : 'overflow-hidden rounded-3xl'} border border-violet-400/20 bg-[#080711] outline-none`} data-testid="dm-story-flow-graph">
      <div className="shrink-0 border-b border-white/8 bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><GitBranch className="h-4 w-4 text-violet-300" />剧情世界线</div><p className="mt-1 text-[11px] text-slate-500">事件由上向下推进。单击节点选中，使用右下角按钮详细编辑；拖动节点调整布局。</p></div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" aria-label="缩小剧情图" onClick={() => zoomAroundViewportCenter(zoomRef.current - 0.1)} className="rounded-lg border border-white/10 p-2 text-slate-300"><ZoomOut className="h-3.5 w-3.5" /></button>
            <span aria-label="当前剧情图缩放比例" className="min-w-14 rounded-lg border border-white/10 px-2 py-2 text-center text-[10px] tabular-nums text-slate-300">{Math.round(zoom * 100)}%</span>
            <button type="button" aria-label="放大剧情图" onClick={() => zoomAroundViewportCenter(zoomRef.current + 0.1)} className="rounded-lg border border-white/10 p-2 text-slate-300"><ZoomIn className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => centerCanvas(1)} className="rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-slate-300">100%</button>
            <button type="button" onClick={() => centerCanvas()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-slate-300"><LocateFixed className="h-3.5 w-3.5" />居中</button>
            <button type="button" onClick={fitCanvas} className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-2.5 py-2 text-[10px] font-semibold text-violet-200">适应屏幕</button>
            <button type="button" onClick={arrange} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-slate-300"><RotateCcw className="h-3 w-3" />纵向排版</button>
            <button type="button" onClick={makeLinear} className="rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-slate-300">按画面顺序串联</button>
            <button type="button" disabled={!selectedEventId} onClick={() => addTimelineMarkerBelowSelectedEvent()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.025] px-2.5 py-2 text-[10px] font-semibold text-slate-200 disabled:cursor-not-allowed disabled:opacity-35"><CirclePlus className="h-3.5 w-3.5" />添加时间点</button>
            <button type="button" disabled={!selectedEventId} onClick={() => addTimelineMarkerBelowSelectedEvent(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/25 bg-rose-500/10 px-2.5 py-2 text-[10px] font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-35"><Clock3 className="h-3.5 w-3.5" />插入当前时间 <kbd className="rounded border border-rose-300/20 px-1 text-[8px]">T</kbd></button>
            <button type="button" onClick={toggleFullscreen} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/20 px-2.5 py-2 text-[10px] text-violet-200">{fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}{fullscreen ? '退出全屏' : '全屏查看'}</button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 2xl:grid-cols-[minmax(150px,1fr)_150px_minmax(170px,1fr)_minmax(150px,1fr)_auto]">
          <select aria-label="分支起点" value={fromEventId} onChange={(event) => setFromEventId(event.target.value)} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200"><option value="">选择起点事件…</option>{workspace.events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select>
          <select aria-label="分支判断类型" value={conditionKind} onChange={(event) => setConditionKind(event.target.value as BranchConditionKind)} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200"><option value="always">无条件箭头</option><option value="person-dead">人物已死亡</option><option value="person-alive">人物仍存活</option><option value="manual">DM 自定义判断</option></select>
          {conditionKind === 'person-dead' || conditionKind === 'person-alive' ? <select aria-label="分支判断人物" value={conditionPersonId} onChange={(event) => setConditionPersonId(event.target.value)} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200"><option value="">选择人物…</option>{analysis.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select> : conditionKind === 'manual' ? <input aria-label="DM 分支条件" value={manualExpression} maxLength={240} onChange={(event) => setManualExpression(event.target.value)} placeholder="例如：玩家交出伪信" className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-400/40" /> : <div className="rounded-xl border border-white/7 bg-black/10 px-3 py-2 text-[10px] text-slate-600">仅显示箭头，不显示“然后”</div>}
          <select aria-label="分支终点" value={toEventId} onChange={(event) => setToEventId(event.target.value)} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200"><option value="">选择终点事件…</option>{workspace.events.map((event) => <option key={event.id} value={event.id} disabled={event.id === fromEventId}>{event.title}</option>)}</select>
          <button type="button" disabled={!fromEventId || !toEventId || fromEventId === toEventId || ((conditionKind === 'person-dead' || conditionKind === 'person-alive') && !conditionPersonId) || (conditionKind === 'manual' && !manualExpression.trim())} onClick={() => addLink()} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-35"><Link2 className="h-3.5 w-3.5" />建立分支</button>
        </div>

        {(conditionKind === 'person-dead' || conditionKind === 'person-alive') && conditionPersonId && <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-400/10 bg-cyan-500/[0.025] px-3 py-2 text-[10px] text-slate-500"><span>当前判断状态：<strong className={selectedPersonState?.status === 'dead' ? 'text-rose-300' : 'text-emerald-300'}>{selectedPersonState?.status === 'dead' ? '已死亡' : '仍存活'}</strong></span><button type="button" onClick={() => setPersonStatus(conditionPersonId, 'active')} className="rounded-md border border-emerald-400/20 px-2 py-1 text-emerald-300">标记存活</button><button type="button" onClick={() => setPersonStatus(conditionPersonId, 'dead')} className="rounded-md border border-rose-400/20 px-2 py-1 text-rose-300">标记死亡</button></div>}

        {links.length > 0 && <details className="mt-2"><summary className="cursor-pointer text-[10px] text-slate-600">管理 {links.length} 条箭头</summary><div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">{links.map((link) => { const label = conditionLabel(link, analysis); return <div key={link.id} className="inline-flex items-center gap-1 rounded-lg border border-white/8 bg-black/15 px-2 py-1 text-[9px] text-slate-500"><span className="max-w-24 truncate">{workspace.events.find((event) => event.id === link.fromEventId)?.title}</span><span style={{ color: conditionColor(link, workspace) }}>↓{label ? ` ${label} ↓` : ''}</span><span className="max-w-24 truncate">{workspace.events.find((event) => event.id === link.toEventId)?.title}</span><button type="button" aria-label="删除剧情箭头" onClick={() => commitLinks(links.filter((candidate) => candidate.id !== link.id))} className="ml-1 text-rose-400/70"><Trash2 className="h-3 w-3" /></button></div> })}<button type="button" onClick={() => commitLinks([])} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/15 px-2 py-1 text-[9px] text-rose-300"><Unlink className="h-3 w-3" />清空箭头</button></div></details>}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500" aria-label="剧情连线颜色说明"><span className="font-semibold text-slate-400">分支状态（不是事件分类）：</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-violet-400" />无条件推进</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-400" />条件已满足</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-300" />等待 DM 裁定</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-slate-500" />条件未满足</span><span className="text-slate-600">拖动彩色分支框可改位置；单击后可编辑文字与条件。</span></div>
        <p className="mt-2 text-[10px] text-slate-600">先选择一个事件，再添加时间点或插入当前时间；横线会放在该事件下方的层级间隙中。拖动画布只会平移。</p>
        {selectedLink && <LinkEditor link={selectedLink} workspace={workspace} analysis={analysis} onChange={(patch) => updateLink(selectedLink.id, patch)} onResetPosition={() => updateLink(selectedLink.id, { labelPosition: undefined })} onRemove={() => { commitLinks(links.filter((link) => link.id !== selectedLink.id)); setSelectedLinkId(null) }} />}
        {selectedTimelineMarker && <div className={`mt-2 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${selectedTimelineMarkerReached ? 'border-emerald-400/30 bg-emerald-500/[0.07]' : 'border-rose-400/15 bg-rose-500/[0.035]'}`} data-testid="dm-story-timeline-marker-editor" data-timeline-reached={selectedTimelineMarkerReached ? 'true' : 'false'}>
          <Clock3 className={`h-3.5 w-3.5 ${selectedTimelineMarkerReached ? 'text-emerald-300' : 'text-rose-300'}`} />
          <input aria-label="时间横线名称" value={selectedTimelineMarker.label} maxLength={160} onChange={(event) => updateTimelineMarker(selectedTimelineMarker.id, { label: event.target.value })} className="min-w-48 flex-1 rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5 text-[10px] text-slate-200 outline-none focus:border-rose-400/40" />
          {selectedTimelineMarkerReached && <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-200">已到达</span>}
          <button type="button" onClick={() => updateTimelineMarker(selectedTimelineMarker.id, { label: formatCampaignTime(campaignClock), gameTimeWorldMinute: campaignClock.worldMinute })} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${selectedTimelineMarkerReached ? 'border-emerald-400/25 text-emerald-200' : 'border-rose-400/20 text-rose-200'}`}>设为当前时间</button>
          <button type="button" aria-label="删除时间横线" onClick={() => { commitTimelineMarkers(timelineMarkers.filter((marker) => marker.id !== selectedTimelineMarker.id)); setSelectedTimelineMarkerId(null) }} className="rounded-lg border border-rose-400/15 p-1.5 text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>}
      </div>

      <div ref={viewportRef} className={`${fullscreen ? 'min-h-0 flex-1' : 'max-h-[760px]'} overflow-auto bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.055),transparent_55%)] [overscroll-behavior:auto] [scrollbar-gutter:stable]`}>
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
                const from = positions[link.fromEventId]
                const to = positions[link.toEventId]
                if (!from || !to) return null
                const startX = from.x + NODE_WIDTH / 2
                const startY = from.y + NODE_HEIGHT
                const endX = to.x + NODE_WIDTH / 2
                const endY = to.y
                const bend = Math.max(50, Math.abs(endY - startY) * 0.46)
                const color = conditionColor(link, workspace)
                return <g key={link.id} opacity={evaluateStoryLinkCondition(link, workspace) === 'blocked' ? 0.42 : 1}><path d={`M ${startX} ${startY} C ${startX} ${startY + bend}, ${endX} ${endY - bend}, ${endX} ${endY}`} fill="none" stroke={color} strokeWidth="2.4" strokeOpacity="0.86" markerEnd="url(#story-arrow-vertical)" /></g>
              })}
            </svg>

            {links.map((link) => {
              const label = compactLinkLabel(conditionLabel(link, analysis))
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
                className={`absolute z-[3] cursor-grab rounded-[10px] border bg-[#090812] px-3 text-center text-xs font-semibold shadow-lg outline-none active:cursor-grabbing ${selected ? 'ring-2 ring-white/45' : 'hover:brightness-125'}`}
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
              const position = positions[event.id] ?? { x: 420, y: 56 }
              const outgoing = links.filter((link) => link.fromEventId === event.id)
              const completedByTimeline = event.status !== 'skipped' && storyEventIsBeforeTimeline(position.y, NODE_HEIGHT, reachedTimelineY)
              const visualStatus: AccountStoryEventStatusV1 = completedByTimeline ? 'completed' : event.status
              const selected = selectedEventId === event.id
              return <article key={event.id} data-story-event-node data-story-event-selected={selected ? 'true' : 'false'} onPointerDown={(pointer) => {
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
                  return
                }
                commitEvents(workspace.events.map((candidate) => candidate.id === event.id ? { ...candidate, graphPosition: { x: drag.x, y: drag.y } } : candidate))
              }} data-timeline-completed={completedByTimeline ? 'true' : 'false'} className={`absolute z-[2] select-none overflow-hidden rounded-xl border shadow-xl transition-[box-shadow,border-color] ${selected ? 'ring-2 ring-violet-300/80 ring-offset-2 ring-offset-[#080711] shadow-[0_0_34px_rgba(139,92,246,0.22)]' : ''} ${completedByTimeline ? 'hover:border-emerald-300/70 hover:shadow-[0_0_26px_rgba(52,211,153,0.14)]' : 'hover:border-violet-300/60 hover:shadow-[0_0_26px_rgba(139,92,246,0.14)]'} ${STATUS_STYLE[visualStatus]}`} style={{ left: position.x, top: position.y, width: NODE_WIDTH, height: NODE_HEIGHT, touchAction: 'none' }}>
                <div className="cursor-grab border-b border-white/8 px-4 py-3 active:cursor-grabbing"><div className="flex items-start gap-2.5"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-sm ${visualStatus === 'active' ? 'animate-pulse bg-cyan-300' : visualStatus === 'completed' ? 'bg-emerald-400' : visualStatus === 'skipped' ? 'bg-slate-600' : 'bg-violet-400'}`} /><strong className="line-clamp-2 min-w-0 flex-1 text-sm leading-5 text-slate-100">{event.title}</strong><Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" /></div><p className="mt-1.5 truncate pl-5 text-[11px] text-slate-500">{event.timeLabel || '时间待 DM 校准'}</p></div>
                <p className="line-clamp-5 px-4 pt-3 text-xs leading-5 text-slate-300">{event.summary || '点击节点填写摘要与运行细节。'}</p>
                <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 border-t border-white/7 bg-black/25 px-3 py-2"><button type="button" onClick={() => { setFromEventId(event.id); setToEventId('') }} className={`rounded-md px-2 py-1 text-[10px] ${fromEventId === event.id ? 'bg-violet-500/25 text-violet-100' : 'text-slate-400 hover:bg-white/5'}`}>添加分支</button>{fromEventId && fromEventId !== event.id && <button type="button" onClick={() => addLink(fromEventId, event.id)} className="rounded-md bg-violet-500/20 px-2 py-1 text-[10px] text-violet-100">连接到此处</button>}<span className="ml-auto text-[10px] text-slate-500">{outgoing.length} 个出口</span>{selected && <button type="button" onClick={() => setEditingEventId(event.id)} className="ml-1 inline-flex items-center gap-1 rounded-md border border-violet-300/25 bg-violet-500/20 px-2 py-1 text-[10px] font-semibold text-violet-100"><Pencil className="h-3 w-3" />详细编辑</button>}</div>
              </article>
            })}
          </div>
          </div>
        </div>
      </div>

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
    </section>
  )
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
  return <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onPointerDown={(pointer) => { if (pointer.target === pointer.currentTarget) onClose() }}><section role="dialog" aria-modal="true" aria-label="编辑剧情事件" className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-violet-400/25 bg-[#0b0a13] p-5 shadow-2xl">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-violet-300">StoryEvent</p><h3 className="mt-1 text-lg font-bold text-slate-100">编辑剧情节点</h3></div><button type="button" aria-label="关闭剧情事件编辑器" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-slate-400"><X className="h-4 w-4" /></button></div>
    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]"><label className="text-[9px] text-slate-500">事件名称<input value={event.title} maxLength={160} onChange={(change) => onChange({ title: change.target.value })} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-100 outline-none focus:border-violet-400/40" /></label><label className="text-[9px] text-slate-500">时间标签<input value={event.timeLabel} maxLength={160} onChange={(change) => onChange({ timeLabel: change.target.value })} placeholder="例如：伪信送达后、第三日黄昏" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-100 outline-none focus:border-violet-400/40" /></label></div>
    <label className="mt-3 block text-[9px] text-slate-500">事件摘要<textarea value={event.summary} maxLength={2_000} rows={3} onChange={(change) => onChange({ summary: change.target.value })} className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-200 outline-none focus:border-violet-400/40" /></label>
    <label className="mt-3 block text-[9px] text-slate-500">DM 运行细节<textarea value={event.details} maxLength={12_000} rows={5} onChange={(change) => onChange({ details: change.target.value })} className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-200 outline-none focus:border-violet-400/40" /></label>
    <div className="mt-3 grid gap-3 lg:grid-cols-3"><RelationPicker title="关联人物" entries={analysis.people.map((person) => ({ id: person.id, label: person.name }))} selected={event.personIds} onToggle={(id) => onChange({ personIds: toggle(event.personIds, id) })} /><RelationPicker title="关联线索" entries={analysis.clues.map((clue) => ({ id: clue.id, label: clue.name }))} selected={event.clueIds} onToggle={(id) => onChange({ clueIds: toggle(event.clueIds, id) })} /><RelationPicker title="关联结局" entries={events.filter((candidate) => candidate.id !== event.id).map((candidate) => ({ id: candidate.id, label: candidate.title }))} selected={outcomeIds} onToggle={onToggleOutcome} /></div>
    <div className="mt-4 flex flex-wrap items-center gap-2">{(Object.keys(STATUS_COPY) as AccountStoryEventStatusV1[]).map((status) => <button key={status} type="button" onClick={() => onChange({ status })} className={`rounded-lg border px-2.5 py-1.5 text-[10px] ${event.status === status ? 'border-violet-400/30 bg-violet-500/15 text-violet-100' : 'border-white/8 text-slate-500'}`}>{STATUS_COPY[status]}</button>)}<button type="button" onClick={onRemove} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-rose-400/15 px-2.5 py-1.5 text-[10px] text-rose-300"><Trash2 className="h-3 w-3" />{event.source === 'dm' ? '删除事件' : '忽略事件'}</button><button type="button" onClick={onClose} className="rounded-lg bg-violet-500 px-4 py-1.5 text-[10px] font-semibold text-white">完成</button></div>
  </section></div>
}

function LinkEditor({ link, workspace, analysis, onChange, onResetPosition, onRemove }: {
  link: AccountStoryEventLinkV1
  workspace: AccountCampaignStoryWorkspaceV1
  analysis: PdfCampaignAnalysisV2
  onChange: (patch: Partial<AccountStoryEventLinkV1>) => void
  onResetPosition: () => void
  onRemove: () => void
}) {
  const condition = link.condition ?? { kind: 'always' as const }
  const from = workspace.events.find((event) => event.id === link.fromEventId)?.title ?? '未知事件'
  const to = workspace.events.find((event) => event.id === link.toEventId)?.title ?? '未知事件'
  const selectedPersonId = condition.kind === 'person-state' ? condition.personId : ''
  const selectedPersonState = condition.kind === 'person-state' ? condition.state : 'alive'
  const conditionKind: BranchConditionKind = condition.kind === 'person-state'
    ? condition.state === 'dead' ? 'person-dead' : 'person-alive'
    : condition.kind === 'manual' ? 'manual' : 'always'
  const setKind = (kind: BranchConditionKind) => {
    if (kind === 'always') onChange({ condition: { kind: 'always' } })
    else if (kind === 'manual') onChange({ condition: { kind: 'manual', expression: condition.kind === 'manual' ? condition.expression : '等待 DM 裁定' } })
    else {
      const personId = selectedPersonId || analysis.people[0]?.id
      if (personId) onChange({ condition: { kind: 'person-state', personId, state: kind === 'person-dead' ? 'dead' : 'alive' } })
    }
  }
  return <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3" data-testid="dm-story-link-editor">
    <div className="flex flex-wrap items-center gap-2"><strong className="text-xs text-slate-200">编辑分支</strong><span className="min-w-0 truncate text-[10px] text-slate-500">{from} → {to}</span><span className="ml-auto text-[10px]" style={{ color: conditionColor(link, workspace) }}>{conditionLabel(link, analysis) || '无条件推进'}</span></div>
    <div className="mt-2 grid gap-2 xl:grid-cols-[160px_minmax(180px,1fr)_minmax(220px,1.2fr)_auto_auto]">
      <select aria-label="编辑分支条件类型" value={conditionKind} onChange={(event) => setKind(event.target.value as BranchConditionKind)} className="rounded-lg border border-white/10 bg-[#0b0a13] px-2.5 py-2 text-xs text-slate-200"><option value="always">无条件推进</option><option value="person-dead">人物已死亡</option><option value="person-alive">人物仍存活</option><option value="manual">DM 手动裁定</option></select>
      {condition.kind === 'person-state' ? <select aria-label="编辑分支人物" value={selectedPersonId} onChange={(event) => onChange({ condition: { kind: 'person-state', personId: event.target.value, state: selectedPersonState } })} className="rounded-lg border border-white/10 bg-[#0b0a13] px-2.5 py-2 text-xs text-slate-200">{analysis.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select> : condition.kind === 'manual' ? <input aria-label="编辑手动分支条件" value={condition.expression} maxLength={240} onChange={(event) => onChange({ condition: { kind: 'manual', expression: event.target.value } })} className="rounded-lg border border-white/10 bg-[#0b0a13] px-2.5 py-2 text-xs text-slate-200" /> : <span className="rounded-lg border border-white/7 px-2.5 py-2 text-[10px] text-slate-600">不需要额外条件</span>}
      <input aria-label="编辑分支说明" value={link.label} maxLength={80} onChange={(event) => onChange({ label: event.target.value })} placeholder="说明该原因如何产生结果" className="rounded-lg border border-white/10 bg-[#0b0a13] px-2.5 py-2 text-xs text-slate-200" />
      <button type="button" onClick={onResetPosition} className="rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-slate-400">自动摆放</button>
      <button type="button" onClick={onRemove} className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-400/20 px-2.5 py-2 text-[10px] text-rose-300"><Trash2 className="h-3 w-3" />删除</button>
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
