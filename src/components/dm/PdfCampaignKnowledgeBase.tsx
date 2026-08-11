import {
  BookOpenText,
  Bot,
  Boxes,
  CalendarClock,
  Check,
  ChevronRight,
  ExternalLink,
  FileSearch,
  GitBranch,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  MapPinned,
  PencilLine,
  Plus,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { createCharacterPortraitDataUrl } from '../../lib/characterPortrait'
import { generateLocalAiPortrait, localAiPortraitErrorMessage } from '../../lib/localAiBridgeApi'
import type {
  PdfImportCandidateV1,
  PdfNamedRecordV1,
  PdfPersonRecordV1,
  PdfSceneRecordV1,
  PdfSourceCitationV1,
} from '../../lib/pdfCampaignAnalysis'
import type { PdfCampaignAnalysisView } from '../../lib/pdfCampaignAnalysisV2'
import {
  campaignDay,
  campaignDisplayMinute,
  campaignGregorianDate,
  campaignMinuteOfDay,
  formatCampaignTime,
  type CampaignTimeDisplayMode,
  type SharedCampaignTimeState,
} from '../../lib/campaignTime'
import { useCampaignTimeStore } from '../../store/campaignTime'
import { canonicalizePdfPersonRelationships, mergePdfPersonRecords } from '../../lib/pdfPersonDeduplication'
import { PDF_TIMELINE_KIND_LABELS, pdfTimelineTimeLabel, schedulePdfCampaignTimeline } from '../../lib/pdfCampaignTimeline'
import PdfRelationshipGraph from './PdfRelationshipGraph'
import PdfSourceEvidenceDrawer, {
  PdfCitationButtons,
} from './PdfSourceEvidenceDrawer'
import type { PdfViewCitation } from './pdfSourceEvidenceViewModel'
import PdfTimelineGameTimeField from './PdfTimelineGameTimeField'
import { commaSeparatedValues, emptyPdfTimelineEvent } from './pdfCampaignAnalysisEditorModel'
import { showAppConfirm } from '../../lib/appDialog'
import {
  buildPdfMapIndex,
  buildPdfMonsterCodex,
  buildPdfEventIndex,
  buildPdfPersonPortraitPrompt,
  pdfKnowledgeMatches,
  pdfKnowledgeTabCounts,
  recordSearchText,
  type PdfKnowledgeTabV1,
} from './pdfCampaignKnowledgeBaseModel'

const KNOWLEDGE_TABS: Array<{
  id: PdfKnowledgeTabV1
  label: string
  icon: typeof BookOpenText
}> = [
  { id: 'overview', label: '总览', icon: BookOpenText },
  { id: 'people', label: '人物', icon: UserRound },
  { id: 'factions', label: '组织与势力', icon: Shield },
  { id: 'locations', label: '地点', icon: MapPinned },
  { id: 'events', label: '事件与场景', icon: Sparkles },
  { id: 'clues', label: '线索', icon: KeyRound },
  { id: 'timeline', label: '时间线', icon: CalendarClock },
  { id: 'maps', label: '地图', icon: MapPinned },
  { id: 'monsters', label: '怪物图鉴', icon: Swords },
  { id: 'relationships', label: '人物关系图', icon: GitBranch },
  { id: 'imports', label: '待导入资源', icon: Boxes },
]

export type PdfKnowledgeSectionV1 = 'all' | 'story' | 'world' | 'resources'

const KNOWLEDGE_SECTION_TABS: Record<PdfKnowledgeSectionV1, PdfKnowledgeTabV1[]> = {
  all: KNOWLEDGE_TABS.map((tab) => tab.id),
  story: ['timeline', 'events', 'clues'],
  world: ['people', 'relationships', 'factions', 'locations'],
  resources: ['maps', 'monsters', 'imports'],
}

const KIND_LABELS: Record<string, string> = {
  monster: '怪物',
  npc: 'NPC',
  item: '物品',
  spell: '法术',
  map: '地图',
  handout: '讲义',
  rule: '规则',
  full: '完整自动化',
  partial: '部分自动化',
  manual: 'DM 裁定',
  unreviewed: '待结构化',
}

function citationText(citations: readonly PdfSourceCitationV1[]): string {
  return citations.slice(0, 4).map((citation) => `${citation.documentName} · 第 ${citation.page} 页`).join('；')
}

const PdfCitationOpenContext = createContext<(citation: PdfViewCitation) => void>(() => undefined)

function EvidenceButtons({ citations }: { citations: readonly PdfSourceCitationV1[] }) {
  const onOpen = useContext(PdfCitationOpenContext)
  return <PdfCitationButtons citations={citations} onOpen={onOpen} />
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center text-xs text-slate-600">{children}</div>
}

function KnowledgeCard({ title, description, citations, children }: {
  title: string
  description: string
  citations?: readonly PdfSourceCitationV1[]
  children?: ReactNode
}) {
  return (
    <article className="rounded-2xl border border-white/8 bg-white/[0.018] p-4 sm:p-5 transition hover:border-violet-400/20 hover:bg-violet-500/[0.025]">
      <h4 className="text-base font-semibold leading-6 text-slate-100">{title}</h4>
      {description && <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-300">{description}</p>}
      {children}
      {!!citations?.length && <EvidenceButtons citations={citations} />}
    </article>
  )
}

function importTypeExplanation(entry: PdfImportCandidateV1): string {
  if (entry.kind === 'npc') return '这是 AI 识别出的 NPC 草稿，不是已经进入怪物图鉴的战斗怪物。若它需要参与战斗，请在“编辑知识库”中改为怪物，并补齐属性、动作、生命值与 Headless 机制。'
  if (entry.kind === 'monster') return '这是怪物导入候选，但尚未写入怪物工坊。导入前仍需确认属性、动作、挑战等级与 Headless 自动化。'
  return `这是${KIND_LABELS[entry.kind]}导入候选。当前只保存在 DM 审阅草稿中，尚未写入正式战役资源。`
}

function likelyCombatNpc(entry: PdfImportCandidateV1): boolean {
  if (entry.kind !== 'npc') return false
  return /(?:军兵|士兵|守卫|护卫|战斗|法术能力|召唤单位|敌人|怪物)/u.test(`${entry.name} ${entry.description}`)
}

function filterRecords<T extends PdfNamedRecordV1>(records: readonly T[], query: string, extras?: (record: T) => unknown[]): T[] {
  return records.filter((record) => pdfKnowledgeMatches(query, ...recordSearchText(record), ...(extras?.(record) ?? [])))
}

async function generatedDataUrlToPortrait(dataUrl: string, name: string): Promise<string> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'
  return await createCharacterPortraitDataUrl(new File([blob], `${name}.${extension}`, { type: blob.type || 'image/png' }))
}

function PersonPortraitStudio({ person, onPortraitChange }: {
  person: PdfPersonRecordV1
  onPortraitChange: (personName: string, portraitDataUrl: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState(() => buildPdfPersonPortraitPrompt(person))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const upload = async (file: File) => {
    setError('')
    setBusy(true)
    try {
      onPortraitChange(person.name, await createCharacterPortraitDataUrl(file))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法处理人物立绘。')
    } finally {
      setBusy(false)
    }
  }

  const generate = async () => {
    setError('')
    setBusy(true)
    try {
      const generated = await generateLocalAiPortrait({ prompt, aspect: 'portrait-3:4' })
      onPortraitChange(person.name, await generatedDataUrlToPortrait(generated.dataUrl, person.name))
    } catch (cause) {
      setError(localAiPortraitErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-violet-400/10 bg-violet-500/[0.025] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
            event.currentTarget.value = ''
          }}
        />
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-2 text-[10px] font-semibold text-slate-300 hover:bg-white/[0.04] disabled:opacity-40">
          <Upload className="h-3.5 w-3.5" />上传立绘
        </button>
        <button type="button" disabled={busy} onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/10 px-2.5 py-2 text-[10px] font-semibold text-violet-100 hover:bg-violet-500/15 disabled:opacity-40">
          <ImagePlus className="h-3.5 w-3.5" />AI 生成立绘
        </button>
        {person.portraitDataUrl && <span className="text-[10px] text-emerald-300">已设置</span>}
      </div>
      {open && (
        <div className="mt-3 border-t border-white/8 pt-3">
          <label className="text-[10px] font-semibold text-slate-500">
            生成提示词（可编辑）
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs leading-5 text-slate-300 outline-none focus:border-violet-400/40" />
          </label>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-slate-600">通过本机 Bridge 调用已配置的图片模型；密钥不会进入浏览器。生成费用由对应模型账户承担。</p>
            <button type="button" disabled={busy || prompt.trim().length < 20} onClick={() => void generate()} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-2 text-[10px] font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40">
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {busy ? '正在生成' : '生成并设为立绘'}
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-[10px] leading-5 text-rose-300">{error}</p>}
    </div>
  )
}

function PersonDetailField({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) return null
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="mt-1.5 whitespace-pre-wrap text-sm leading-7 text-slate-200">{value}</dd>
    </div>
  )
}

function PersonKnowledgeDetail({ person, onPortraitChange }: {
  person: PdfPersonRecordV1
  onPortraitChange: (personName: string, portraitDataUrl: string) => void
}) {
  return (
    <aside data-testid="pdf-person-detail" className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.025] p-4 xl:sticky xl:top-4 xl:self-start">
      <div className="flex items-start gap-4">
        <div className="grid h-28 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-violet-400/25 bg-violet-500/10 text-2xl font-bold text-violet-200">
          {person.portraitDataUrl
            ? <img src={person.portraitDataUrl} alt={`${person.name}的立绘`} className="h-full w-full object-cover" />
            : Array.from(person.name).slice(0, 2).join('')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/70">人物详情</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-100">{person.name}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-300">{person.role || '身份待确认'}</p>
          {!!person.aliases?.length && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {person.aliases.map((alias) => <span key={alias} className="rounded-full border border-white/8 bg-black/20 px-2 py-1 text-[9px] text-slate-400">别名：{alias}</span>)}
            </div>
          )}
        </div>
      </div>
      <dl className="mt-5 space-y-4 border-t border-white/8 pt-4">
        <PersonDetailField label="详细信息" value={person.description} />
        <PersonDetailField label="外貌描述" value={person.appearance} />
        <PersonDetailField label="性格" value={person.personality} />
        <PersonDetailField label="欲望或目标" value={person.motivation} />
        <PersonDetailField label="秘密" value={person.secret} />
        <PersonDetailField label="扮演与声线提示" value={person.voice} />
      </dl>
      <PersonPortraitStudio person={person} onPortraitChange={onPortraitChange} />
      {!!person.citations.length && <EvidenceButtons citations={person.citations} />}
    </aside>
  )
}

function TimelineClockEditor({ clock }: { clock: SharedCampaignTimeState }) {
  const mutate = useCampaignTimeStore((state) => state.mutate)
  const initialDisplayMinute = campaignDisplayMinute(clock)
  const initialMinuteOfDay = campaignMinuteOfDay(initialDisplayMinute)
  const today = new Date()
  const localDate = `${today.getFullYear().toString().padStart(4, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
  const [mode, setMode] = useState<CampaignTimeDisplayMode>(clock.displayMode)
  const [day, setDay] = useState(campaignDay(initialDisplayMinute))
  const [date, setDate] = useState(campaignGregorianDate(clock) ?? localDate)
  const [time, setTime] = useState(`${Math.floor(initialMinuteOfDay / 60).toString().padStart(2, '0')}:${(initialMinuteOfDay % 60).toString().padStart(2, '0')}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const apply = async () => {
    const [hour, minute] = time.split(':').map(Number)
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
      setError('请输入有效时刻。')
      return
    }
    setBusy(true)
    setError('')
    try {
      await mutate({
        operation: 'set-time',
        displayMode: mode,
        day: mode === 'campaign-day' ? day : undefined,
        date: mode === 'gregorian' ? date : undefined,
        hour,
        minute,
        reason: 'DM 在时间线中校准当前时间',
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-rose-400/15 bg-rose-500/[0.025] p-4" data-testid="pdf-timeline-clock-editor">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-300/70">房间当前时间</p>
          <p className="mt-1 text-base font-bold text-rose-100">{formatCampaignTime(clock)}</p>
        </div>
        <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
          <button type="button" onClick={() => setMode('campaign-day')} className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold ${mode === 'campaign-day' ? 'bg-violet-500/25 text-violet-100' : 'text-slate-500'}`}>战役时间</button>
          <button type="button" onClick={() => setMode('gregorian')} className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold ${mode === 'gregorian' ? 'bg-violet-500/25 text-violet-100' : 'text-slate-500'}`}>公历日期</button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
        {mode === 'campaign-day' ? (
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">第
            <input type="number" min={1} value={day} onChange={(event) => setDay(Math.max(1, Number(event.target.value) || 1))} className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none" />日
          </label>
        ) : (
          <input aria-label="公历日期" type="date" min="0001-01-01" max="9999-12-31" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
        )}
        <input aria-label="当前时刻" type="time" value={time} onChange={(event) => setTime(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100" />
        <button type="button" disabled={busy} onClick={() => void apply()} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-500/15 px-4 py-2 text-xs font-semibold text-rose-100 disabled:opacity-50">
          <Check className="h-3.5 w-3.5" />{busy ? '正在应用' : '应用当前时间'}
        </button>
      </div>
      {error && <p className="mt-2 text-[10px] text-rose-300">{error}</p>}
      <p className="mt-2 text-[10px] leading-5 text-slate-500">切换显示方式会同步房间权威时钟，时间线红线和所有已绑定事件会使用同一历法。</p>
    </section>
  )
}

function TimelineInlineEditor({ record, clock, busy = false, onSave, onCancel, onDelete }: {
  record: PdfSceneRecordV1
  clock: SharedCampaignTimeState
  busy?: boolean
  onSave: (record: PdfSceneRecordV1) => void | Promise<void>
  onCancel: () => void
  onDelete: () => void | Promise<void>
}) {
  const [draft, setDraft] = useState(record)
  const inputClass = 'mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-400/45'
  return (
    <aside className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.035] p-4 xl:sticky xl:top-4 xl:self-start" data-testid="pdf-timeline-inline-editor">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300/70">编辑时间节点</p><h3 className="mt-1 text-sm font-semibold text-slate-100">{draft.name || '未命名事件'}</h3></div>
        <button type="button" disabled={busy} onClick={() => void onDelete()} className="rounded-lg border border-rose-400/20 p-2 text-rose-300 hover:bg-rose-500/10 disabled:opacity-40" title="删除时间节点"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="mt-4 space-y-3">
        <label className="block text-[10px] font-semibold text-slate-500">事件名称<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={inputClass} /></label>
        <PdfTimelineGameTimeField record={draft} clock={clock} onChange={setDraft} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[10px] font-semibold text-slate-500">地点<input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} className={inputClass} /></label>
          <label className="block text-[10px] font-semibold text-slate-500">原文时间／相对锚点<input value={draft.time ?? ''} onChange={(event) => setDraft({ ...draft, time: event.target.value })} className={inputClass} /></label>
        </div>
        <label className="block text-[10px] font-semibold text-slate-500">事件详情<textarea rows={5} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className={`${inputClass} resize-y`} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[10px] font-semibold text-slate-500">相关人物（逗号分隔）<input value={draft.npcs.join('，')} onChange={(event) => setDraft({ ...draft, npcs: commaSeparatedValues(event.target.value) })} className={inputClass} /></label>
          <label className="block text-[10px] font-semibold text-slate-500">相关怪物（逗号分隔）<input value={draft.monsters.join('，')} onChange={(event) => setDraft({ ...draft, monsters: commaSeparatedValues(event.target.value) })} className={inputClass} /></label>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-400 disabled:opacity-40">取消</button>
        <button type="button" disabled={busy || !draft.name.trim()} onClick={() => void onSave({ ...draft, name: draft.name.trim() })} className="rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? '正在保存' : '保存节点'}</button>
      </div>
    </aside>
  )
}

function TimelineEventDetail({ scene, campaignClock, onEdit }: { scene: PdfSceneRecordV1; campaignClock: SharedCampaignTimeState; onEdit?: () => void }) {
  const kind = scene.timelineKind ?? 'current'
  return (
    <aside className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.025] p-4 xl:sticky xl:top-4 xl:self-start">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/70">事件详情</p>
      <h3 className="mt-1 text-base font-semibold text-slate-100">{scene.name}</h3>
      <div className="mt-3 flex flex-wrap gap-2 text-[9px]">
        {Number.isSafeInteger(scene.gameTimeWorldMinute) && Number(scene.gameTimeWorldMinute) >= 0 && (
          <span className="rounded-full bg-rose-500/10 px-2 py-1 text-rose-200">游戏时间：{formatCampaignTime({ ...campaignClock, worldMinute: Number(scene.gameTimeWorldMinute) })}</span>
        )}
        <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-cyan-200">{pdfTimelineTimeLabel(scene)}</span>
        <span className="rounded-full bg-violet-500/10 px-2 py-1 text-violet-200">{PDF_TIMELINE_KIND_LABELS[kind]}</span>
        {scene.location && <span className="rounded-full bg-white/[0.04] px-2 py-1 text-slate-400">{scene.location}</span>}
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">{scene.description}</p>
      {!!scene.tags?.length && <div className="mt-4 flex flex-wrap gap-1.5">{scene.tags.map((tag) => <span key={tag} className="rounded-lg border border-white/8 px-2 py-1 text-[9px] text-slate-500">{tag}</span>)}</div>}
      {!!scene.npcs.length && <p className="mt-4 text-xs leading-6 text-slate-400">相关人物：{scene.npcs.join('、')}</p>}
      {!!scene.monsters.length && <p className="text-xs leading-6 text-slate-400">相关怪物：{scene.monsters.join('、')}</p>}
      {!!scene.citations.length && <EvidenceButtons citations={scene.citations} />}
      {onEdit && <button type="button" onClick={onEdit} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100"><PencilLine className="h-3.5 w-3.5" />直接编辑此节点</button>}
    </aside>
  )
}

interface PdfCampaignKnowledgeBaseProps {
  analysis: PdfCampaignAnalysisView
  mapHref: string
  onEdit: () => void
  onPortraitChange: (personName: string, portraitDataUrl: string) => void
  onTimelineEventsChange?: (events: PdfSceneRecordV1[]) => void
  onTimelineEventsCommit?: (events: PdfSceneRecordV1[]) => Promise<boolean>
  initialTab?: PdfKnowledgeTabV1
  section?: PdfKnowledgeSectionV1
  compactHeader?: boolean
}

export default function PdfCampaignKnowledgeBase({
  analysis,
  mapHref,
  onEdit,
  onPortraitChange,
  onTimelineEventsChange,
  onTimelineEventsCommit,
  initialTab = 'overview',
  section = 'all',
  compactHeader = false,
}: PdfCampaignKnowledgeBaseProps) {
  const allowedTabs = KNOWLEDGE_SECTION_TABS[section]
  const [requestedActiveTab, setActiveTab] = useState<PdfKnowledgeTabV1>(() => allowedTabs.includes(initialTab) ? initialTab : allowedTabs[0])
  const activeTab = allowedTabs.includes(requestedActiveTab) ? requestedActiveTab : allowedTabs[0]
  const [query, setQuery] = useState('')
  const [searchScope, setSearchScope] = useState<'current' | 'all'>('current')
  const [selectedPersonName, setSelectedPersonName] = useState(analysis.people[0]?.name ?? '')
  const [selectedTimelineName, setSelectedTimelineName] = useState(analysis.timelineEvents?.[0]?.name ?? '')
  const [editingTimelineIndex, setEditingTimelineIndex] = useState<number | null>(null)
  const [timelineCommitBusy, setTimelineCommitBusy] = useState(false)
  const [selectedImport, setSelectedImport] = useState<PdfImportCandidateV1 | null>(null)
  const [selectedCitation, setSelectedCitation] = useState<PdfViewCitation | null>(null)
  const campaignClock = useCampaignTimeStore((state) => state.state)
  const normalizedPeople = useMemo(() => mergePdfPersonRecords(analysis.people), [analysis.people])
  const normalizedRelationships = useMemo(
    () => canonicalizePdfPersonRelationships(analysis.relationships, normalizedPeople),
    [analysis.relationships, normalizedPeople],
  )
  const counts = useMemo(() => pdfKnowledgeTabCounts({ ...analysis, people: normalizedPeople }), [analysis, normalizedPeople])
  const monsterCodex = useMemo(() => buildPdfMonsterCodex(analysis), [analysis])
  const mapIndex = useMemo(() => buildPdfMapIndex(analysis), [analysis])
  const eventIndex = useMemo(() => buildPdfEventIndex(analysis), [analysis])

  const people = filterRecords(normalizedPeople, query, (person) => [person.role, person.appearance, person.personality, person.motivation, person.secret, person.voice])
  const factions = filterRecords(analysis.factions, query)
  const locations = filterRecords(analysis.locations, query)
  const clues = filterRecords(analysis.clues, query, (clue) => [clue.source, clue.discovery, clue.failForward])
  const scenes = filterRecords(analysis.scenes, query, (scene) => [scene.location, scene.npcs, scene.monsters])
  const timelineEvents = filterRecords(analysis.timelineEvents ?? [], query, (event) => [event.time, event.timelineKind, event.tags, event.location, event.npcs, event.monsters])
  const events = eventIndex.filter((entry) => pdfKnowledgeMatches(query, entry.name, entry.description, entry.location, entry.npcs, entry.creatures, entry.notes))
  const imports = filterRecords(analysis.importCandidates, query, (entry) => [entry.kind, entry.automation, KIND_LABELS[entry.kind], KIND_LABELS[entry.automation]])
  const monsters = monsterCodex.filter((entry) => pdfKnowledgeMatches(query, entry.name, entry.description, entry.encounterNames, KIND_LABELS[entry.automation]))
  const maps = mapIndex.filter((entry) => pdfKnowledgeMatches(query, entry.name, entry.description, entry.sceneNames))
  const relationships = normalizedRelationships.filter((entry) => pdfKnowledgeMatches(query, entry.from, entry.to, entry.type, entry.description))
  const hasGlobalQuery = searchScope === 'all' && query.trim().length > 0

  const renderNamedRecords = (records: readonly PdfNamedRecordV1[], empty: string) => records.length === 0
    ? <EmptyState>{empty}</EmptyState>
    : <div className="grid gap-3 lg:grid-cols-2">{records.map((record, index) => <KnowledgeCard key={`${record.name}:${index}`} title={record.name} description={record.description} citations={record.citations} />)}</div>

  const renderGlobalSearch = () => {
    const groups: Array<{ title: string; entries: Array<{ title: string; description: string; meta: string }> }> = [
      { title: '人物', entries: people.map((entry) => ({ title: entry.name, description: entry.description, meta: entry.role })) },
      { title: '组织与势力', entries: factions.map((entry) => ({ title: entry.name, description: entry.description, meta: '势力' })) },
      { title: '地点与地图', entries: maps.map((entry) => ({ title: entry.name, description: entry.description, meta: entry.source === 'map-candidate' ? '地图资源' : '地点' })) },
      { title: '场景与事件', entries: events.map((entry) => ({ title: entry.name, description: entry.description, meta: entry.kind === 'scene-encounter' ? '场景＋遭遇' : entry.kind === 'encounter' ? '遭遇' : '场景' })) },
      { title: '关键时间线', entries: timelineEvents.map((entry) => ({ title: entry.name, description: entry.description, meta: pdfTimelineTimeLabel(entry) })) },
      { title: '线索', entries: clues.map((entry) => ({ title: entry.name, description: entry.description, meta: '线索' })) },
      { title: '怪物图鉴', entries: monsters.map((entry) => ({ title: entry.name, description: entry.description, meta: KIND_LABELS[entry.automation] })) },
      { title: '关系', entries: relationships.map((entry) => ({ title: `${entry.from} → ${entry.to}`, description: entry.description, meta: entry.type })) },
      { title: '待导入资源', entries: imports.map((entry) => ({ title: entry.name, description: entry.description, meta: KIND_LABELS[entry.kind] })) },
    ].filter((group) => group.entries.length > 0)
    if (groups.length === 0) return <EmptyState>全库没有找到与“{query}”匹配的内容。</EmptyState>
    return <div className="space-y-5">{groups.map((group) => (
      <section key={group.title}>
        <h3 className="mb-2 text-xs font-semibold text-slate-300">{group.title} · {group.entries.length}</h3>
        <div className="grid gap-2 lg:grid-cols-2">{group.entries.map((entry, index) => (
          <article key={`${group.title}:${entry.title}:${index}`} className="rounded-xl border border-white/8 bg-white/[0.018] p-3">
            <div className="flex items-center gap-2"><strong className="text-xs text-slate-100">{entry.title}</strong><span className="text-[9px] text-violet-300">{entry.meta}</span></div>
            <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-400">{entry.description}</p>
          </article>
        ))}</div>
      </section>
    ))}</div>
  }

  const renderTab = () => {
    if (hasGlobalQuery) return renderGlobalSearch()
    if (activeTab === 'overview') return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.035] p-4">
          <h3 className="text-sm font-semibold text-violet-100">战役内容概览</h3>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-400">{analysis.overview || '尚未生成战役概览。'}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {KNOWLEDGE_TABS.filter((tab) => !['overview', 'imports'].includes(tab.id)).map((tab) => {
            const Icon = tab.icon
            return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className="rounded-2xl border border-white/8 bg-white/[0.018] p-4 text-left hover:border-violet-400/25 hover:bg-violet-500/[0.035]">
              <div className="flex items-center justify-between"><Icon className="h-4 w-4 text-violet-300" /><strong className="text-lg text-slate-100">{counts[tab.id]}</strong></div>
              <p className="mt-3 text-xs font-semibold text-slate-300">{tab.label}</p>
            </button>
          })}
        </div>
      </div>
    )
    if (activeTab === 'people') {
      if (people.length === 0) return <EmptyState>没有匹配的人物档案。</EmptyState>
      const selectedPerson = people.find((person) => person.name === selectedPersonName) ?? people[0]
      return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/10">
            {people.map((person, index) => {
              const active = person.name === selectedPerson.name
              return (
                <button
                  key={`${person.name}:${index}`}
                  type="button"
                  data-testid="pdf-person-row"
                  onClick={() => setSelectedPersonName(person.name)}
                  className={`grid w-full grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/6 px-3 py-2.5 text-left transition last:border-b-0 ${active ? 'bg-violet-500/10' : 'hover:bg-white/[0.025]'}`}
                >
                  <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-violet-400/20 bg-violet-500/10 text-xs font-bold text-violet-200">
                    {person.portraitDataUrl
                      ? <img src={person.portraitDataUrl} alt="" className="h-full w-full object-cover" />
                      : Array.from(person.name).slice(0, 2).join('')}
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <strong className="truncate text-xs text-slate-100">{person.name}</strong>
                      <span className="shrink-0 truncate text-[9px] text-violet-300">{person.role || '身份待确认'}</span>
                    </div>
                    <p className="mt-1 truncate text-[10px] text-slate-500">{person.description || person.motivation || '暂无人物详情'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!!person.aliases?.length && <span className="hidden text-[9px] text-slate-600 sm:inline">{person.aliases.length} 个别名</span>}
                    <ChevronRight className={`h-4 w-4 ${active ? 'text-violet-300' : 'text-slate-700'}`} />
                  </div>
                </button>
              )
            })}
          </div>
          <PersonKnowledgeDetail person={selectedPerson} onPortraitChange={onPortraitChange} />
        </div>
      )
    }
    if (activeTab === 'factions') return renderNamedRecords(factions, '没有匹配的组织或势力。')
    if (activeTab === 'locations') return renderNamedRecords(locations, '没有匹配的地点。')
    if (activeTab === 'clues') return clues.length === 0 ? <EmptyState>没有匹配的线索。</EmptyState> : <div className="grid gap-3 lg:grid-cols-2">{clues.map((clue, index) => <KnowledgeCard key={`${clue.name}:${index}`} title={clue.name} description={clue.description} citations={clue.citations}><div className="mt-3 space-y-1 text-[11px] leading-5 text-slate-500">{clue.source && <p>来源：{clue.source}</p>}{clue.discovery && <p>发现方式：{clue.discovery}</p>}{clue.failForward && <p>失败推进：{clue.failForward}</p>}</div></KnowledgeCard>)}</div>
    if (activeTab === 'events') {
      return events.length === 0 ? <EmptyState>没有匹配的事件或场景。</EmptyState> : <div className="grid gap-3 lg:grid-cols-2">{events.map((entry, index) => (
        <KnowledgeCard key={`${entry.kind}:${entry.name}:${index}`} title={entry.name} description={entry.description} citations={entry.citations}>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-cyan-500/10 px-2 py-1 text-[9px] text-cyan-200">{entry.kind === 'scene-encounter' ? '场景＋遭遇' : entry.kind === 'encounter' ? '遭遇' : '场景'}</span>
            {entry.location && <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[9px] text-slate-400">{entry.location}</span>}
          </div>
          {!!entry.npcs.length && <p className="mt-3 text-xs leading-6 text-slate-400">相关人物：{entry.npcs.join('、')}</p>}
          {!!entry.creatures.length && <p className="text-xs leading-6 text-slate-400">相关生物：{entry.creatures.join('、')}</p>}
          {entry.notes && <p className="mt-2 text-xs leading-6 text-slate-400">遭遇备注：{entry.notes}</p>}
        </KnowledgeCard>
      ))}</div>
    }
    if (activeTab === 'timeline') {
      const schedule = schedulePdfCampaignTimeline(timelineEvents, campaignClock.worldMinute)
      const timeline = [...schedule.scheduled, ...schedule.unscheduled]
      const selected = timeline.find((scene) => scene.name === selectedTimelineName) ?? timeline[0] ?? null
      const selectedSourceIndex = selected ? (analysis.timelineEvents ?? []).indexOf(selected) : -1
      const editingRecord = editingTimelineIndex === null ? null : analysis.timelineEvents?.[editingTimelineIndex] ?? null
      const addTimelineNode = () => {
        if (!onTimelineEventsChange) return
        const nextRecord = emptyPdfTimelineEvent(campaignClock.worldMinute)
        const next = [...(analysis.timelineEvents ?? []), nextRecord]
        setQuery('')
        setSelectedTimelineName(nextRecord.name)
        setEditingTimelineIndex(next.length - 1)
        onTimelineEventsChange(next)
      }
      const saveTimelineNode = async (record: PdfSceneRecordV1) => {
        if (!onTimelineEventsChange || editingTimelineIndex === null) return
        const next = (analysis.timelineEvents ?? []).map((entry, index) => index === editingTimelineIndex ? record : entry)
        onTimelineEventsChange(next)
        if (onTimelineEventsCommit) {
          setTimelineCommitBusy(true)
          try {
            const persisted = await onTimelineEventsCommit(next)
            if (!persisted) return
          } finally {
            setTimelineCommitBusy(false)
          }
        }
        setSelectedTimelineName(record.name)
        setEditingTimelineIndex(null)
      }
      const deleteTimelineNode = async () => {
        if (!onTimelineEventsChange || editingTimelineIndex === null || !editingRecord) return
        const confirmed = await showAppConfirm({
          title: '删除时间节点',
          message: `确定删除“${editingRecord.name}”吗？确认后会直接保存到账号战役。`,
          confirmLabel: '删除节点',
          cancelLabel: '取消',
          tone: 'danger',
        })
        if (!confirmed) return
        const next = (analysis.timelineEvents ?? []).filter((_, index) => index !== editingTimelineIndex)
        onTimelineEventsChange(next)
        if (onTimelineEventsCommit) {
          setTimelineCommitBusy(true)
          try {
            const persisted = await onTimelineEventsCommit(next)
            if (!persisted) return
          } finally {
            setTimelineCommitBusy(false)
          }
        }
        setSelectedTimelineName(next[0]?.name ?? '')
        setEditingTimelineIndex(null)
      }
      const nowMarker = (
        <div className="flex items-center gap-3 border-b border-rose-400/15 bg-rose-500/[0.035] px-3 py-2" data-testid="pdf-timeline-now-marker">
          <span className="h-px flex-1 bg-rose-500/70" />
          <span className="shrink-0 text-[10px] font-bold text-rose-300">当前时间 · {formatCampaignTime(campaignClock)}</span>
          <span className="h-px flex-1 bg-rose-500/70" />
        </div>
      )
      const eventRow = (scene: PdfSceneRecordV1, key: string, scheduled: boolean) => {
        const active = scene.name === selected.name
        const kind = scene.timelineKind ?? 'current'
        const gameTimeLabel = scheduled
          ? formatCampaignTime({ ...campaignClock, worldMinute: Number(scene.gameTimeWorldMinute) })
          : pdfTimelineTimeLabel(scene)
        return (
          <button key={key} type="button" onClick={() => setSelectedTimelineName(scene.name)} className={`grid w-full gap-2 border-b border-white/6 px-4 py-4 text-left transition last:border-b-0 xl:grid-cols-[10rem_12rem_minmax(0,1fr)_auto] xl:items-center xl:gap-3 ${active ? 'bg-cyan-500/[0.07]' : 'hover:bg-white/[0.025]'}`}>
            <span className="min-w-0">
              <span className={`block truncate text-xs font-semibold ${scheduled ? 'text-rose-200' : 'text-cyan-200'}`}>{gameTimeLabel}</span>
              {scheduled && <span className="mt-0.5 block truncate text-[9px] text-slate-600">原文：{pdfTimelineTimeLabel(scene)}</span>}
            </span>
            <strong className="truncate text-sm text-slate-100">{scene.name}</strong>
            <span className="line-clamp-2 text-xs leading-5 text-slate-400">{scene.description}</span>
            <span className="justify-self-start rounded-full bg-violet-500/10 px-2 py-1 text-[10px] text-violet-200 xl:justify-self-end">{PDF_TIMELINE_KIND_LABELS[kind]}</span>
          </button>
        )
      }
      return (
        <div className="space-y-4">
          <TimelineClockEditor key={`${campaignClock.updatedAt}:${campaignClock.displayMode}`} clock={campaignClock} />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.018] px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-200">关键时间节点 · {(analysis.timelineEvents ?? []).length}</p>
              <p className="mt-1 text-[10px] text-slate-500">直接在本页安排事件；点击“保存节点”或确认删除后，会立即保存到账号战役并可在刷新后恢复。</p>
            </div>
            {onTimelineEventsChange && <button type="button" onClick={addTimelineNode} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" />新增时间节点</button>}
          </div>
          {timeline.length === 0 ? (
            <EmptyState>尚未生成全书关键时间线。DM 可以直接新增时间节点，或使用“深度分析”重新分析；页段场景不会再被当作时间线展示。</EmptyState>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/10">
                <div className="hidden grid-cols-[10rem_12rem_minmax(0,1fr)_auto] gap-3 border-b border-white/8 bg-white/[0.025] px-4 py-2.5 text-xs font-semibold text-slate-500 xl:grid">
                  <span>时间</span><span>事件</span><span>详细信息</span><span>类型</span>
                </div>
                {schedule.scheduled.length === 0 && (
                  <div className="border-b border-amber-400/15 bg-amber-500/[0.035] px-3 py-3 text-[10px] leading-5 text-amber-100/80">尚未有事件绑定游戏时间。选择右侧事件并直接编辑，即可设定战役日或公历日期。</div>
                )}
                {schedule.scheduled.map((scene, index) => (
                  <div key={`scheduled:${scene.name}:${index}`}>
                    {index === schedule.currentMarkerIndex && nowMarker}
                    {eventRow(scene, `scheduled-row:${scene.name}:${index}`, true)}
                  </div>
                ))}
                {schedule.scheduled.length > 0 && schedule.currentMarkerIndex === schedule.scheduled.length && nowMarker}
                {schedule.unscheduled.length > 0 && (
                  <div className="border-b border-white/8 bg-white/[0.018] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">未绑定游戏时间 · {schedule.unscheduled.length}</div>
                )}
                {schedule.unscheduled.map((scene, index) => eventRow(scene, `unscheduled:${scene.name}:${index}`, false))}
              </div>
              {editingRecord && onTimelineEventsChange ? (
                <TimelineInlineEditor
                  key={`${editingTimelineIndex}:${editingRecord.name}:${editingRecord.gameTimeWorldMinute ?? ''}`}
                  record={editingRecord}
                  clock={campaignClock}
                  busy={timelineCommitBusy}
                  onSave={saveTimelineNode}
                  onCancel={() => setEditingTimelineIndex(null)}
                  onDelete={() => void deleteTimelineNode()}
                />
              ) : selected ? (
                <TimelineEventDetail
                  scene={selected}
                  campaignClock={campaignClock}
                  onEdit={onTimelineEventsChange && selectedSourceIndex >= 0 ? () => setEditingTimelineIndex(selectedSourceIndex) : undefined}
                />
              ) : null}
            </div>
          )}
        </div>
      )
    }
    if (activeTab === 'maps') return maps.length === 0 ? <EmptyState>没有识别到地图或可建立场景的地点。</EmptyState> : <div className="space-y-3"><div className="flex justify-end"><Link to={mapHref} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-500/20"><ExternalLink className="h-3.5 w-3.5" />进入地图与场景编排</Link></div><div className="grid gap-3 lg:grid-cols-2">{maps.map((entry, index) => <KnowledgeCard key={`${entry.name}:${index}`} title={entry.name} description={entry.description} citations={entry.citations}><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] text-emerald-200">{entry.source === 'map-candidate' ? '地图资源' : '地点索引'}</span>{entry.sceneNames.map((scene) => <span key={scene} className="rounded-full bg-white/[0.04] px-2 py-1 text-[9px] text-slate-400">{scene}</span>)}</div></KnowledgeCard>)}</div></div>
    if (activeTab === 'monsters') return monsters.length === 0 ? <EmptyState>没有识别到怪物。遭遇中的生物和怪物导入候选都会显示在这里。</EmptyState> : <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{monsters.map((entry, index) => <KnowledgeCard key={`${entry.name}:${index}`} title={entry.name} description={entry.description} citations={entry.citations}><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-[9px] ${entry.automation === 'full' ? 'bg-emerald-500/10 text-emerald-200' : entry.automation === 'partial' ? 'bg-amber-500/10 text-amber-200' : 'bg-slate-500/10 text-slate-400'}`}>{KIND_LABELS[entry.automation]}</span>{entry.encounterNames.map((encounter) => <span key={encounter} className="rounded-full bg-rose-500/10 px-2 py-1 text-[9px] text-rose-200">{encounter}</span>)}</div></KnowledgeCard>)}</div>
    if (activeTab === 'relationships') return <PdfRelationshipGraph people={people} factions={factions} locations={locations} relationships={relationships} scenes={scenes} onPortraitChange={onPortraitChange} onCitationOpen={setSelectedCitation} />
    return imports.length === 0 ? <EmptyState>没有匹配的待导入资源。</EmptyState> : <div className="grid gap-3 lg:grid-cols-2">{imports.map((entry, index) => (
      <button
        key={`${entry.kind}:${entry.name}:${index}`}
        type="button"
        onClick={() => setSelectedImport(entry)}
        className="rounded-2xl border border-white/8 bg-white/[0.018] p-4 text-left transition hover:border-violet-400/30 hover:bg-violet-500/[0.035] focus:outline-none focus:ring-2 focus:ring-violet-400/40"
      >
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm font-semibold text-slate-100">{entry.name}</h4>
          <span className="shrink-0 text-[9px] font-semibold text-violet-300">查看详情</span>
        </div>
        {entry.description && <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{entry.description}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-[9px] text-cyan-200">{KIND_LABELS[entry.kind]}</span>
          <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[9px] text-slate-400">{KIND_LABELS[entry.automation]}</span>
          {likelyCombatNpc(entry) && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[9px] text-amber-200">可能应归类为怪物</span>}
        </div>
        {!!entry.citations.length && <p className="mt-3 text-xs font-medium leading-6 text-slate-400">{citationText(entry.citations)}</p>}
      </button>
    ))}</div>
  }

  return (
    <PdfCitationOpenContext.Provider value={setSelectedCitation}>
    <section className="overflow-hidden rounded-2xl border border-white/8 bg-black/15" data-testid="pdf-campaign-knowledge-base">
      <header className={`border-b border-white/8 ${compactHeader ? 'p-3' : 'p-4'}`}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-100"><FileSearch className="h-4 w-4 text-violet-300" />战役知识库</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">AI 提取结果按类型独立整理；DM 可搜索、修订、补充立绘，再决定哪些资源进入地图、工坊或 Headless。</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex min-w-64 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索人物、地点、事件、怪物或原文页码" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-600" />
            </label>
            <select value={searchScope} onChange={(event) => setSearchScope(event.target.value as 'current' | 'all')} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-300 outline-none">
              <option value="current">当前分类</option>
              <option value="all">全库搜索模式</option>
            </select>
            <button type="button" onClick={onEdit} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/15"><PencilLine className="h-3.5 w-3.5" />编辑知识库</button>
          </div>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-white/8 p-2" aria-label="战役知识库分类">
        {KNOWLEDGE_TABS.filter((tab) => allowedTabs.includes(tab.id)).map((tab) => {
          const Icon = tab.icon
          const active = !hasGlobalQuery && activeTab === tab.id
          return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-semibold transition ${active ? 'border-violet-400/25 bg-violet-500/15 text-violet-100' : 'border-transparent text-slate-500 hover:border-white/8 hover:text-slate-300'}`}>
            <Icon className="h-3.5 w-3.5" />{tab.label}<span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[9px]">{counts[tab.id]}</span>
          </button>
        })}
      </nav>

      {hasGlobalQuery && <div className="border-b border-sky-400/10 bg-sky-500/[0.035] px-4 py-2 text-[10px] text-sky-200"><Bot className="mr-1.5 inline h-3.5 w-3.5" />正在全库搜索“{query}”；点击任意分类可切回分类视图。</div>}
      <div className="p-4">{renderTab()}</div>

      {selectedImport && (
        <div className="fixed inset-0 z-[560] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedImport(null)
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="pdf-import-detail-title" className="w-full max-w-2xl rounded-3xl border border-violet-400/20 bg-slate-950 p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300">待导入资源详情</p>
                <h3 id="pdf-import-detail-title" className="mt-2 text-xl font-bold text-slate-100">{selectedImport.name}</h3>
              </div>
              <button type="button" onClick={() => setSelectedImport(null)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-100">关闭</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] text-cyan-200">AI 归类：{KIND_LABELS[selectedImport.kind]}</span>
              <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] text-slate-300">预期自动化：{KIND_LABELS[selectedImport.automation]}</span>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{selectedImport.description || '没有提取到进一步说明。'}</p>
            <div className={`mt-4 rounded-2xl border p-4 text-xs leading-6 ${likelyCombatNpc(selectedImport) ? 'border-amber-400/20 bg-amber-500/[0.06] text-amber-100' : 'border-sky-400/15 bg-sky-500/[0.045] text-sky-100'}`}>
              {importTypeExplanation(selectedImport)}
              {likelyCombatNpc(selectedImport) && <span className="mt-1 block text-amber-200">该条目包含明显战斗语义，建议 DM 检查 AI 是否误把怪物或敌对战斗单位归类成 NPC。</span>}
            </div>
            {!!selectedImport.citations.length && <EvidenceButtons citations={selectedImport.citations} />}
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => { setSelectedImport(null); onEdit() }} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-400"><PencilLine className="h-3.5 w-3.5" />编辑类型与内容</button>
            </div>
          </section>
        </div>
      )}
      <PdfSourceEvidenceDrawer citation={selectedCitation} onClose={() => setSelectedCitation(null)} />
    </section>
    </PdfCitationOpenContext.Provider>
  )
}
