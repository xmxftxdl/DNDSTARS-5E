import {
  BookOpenText,
  Bot,
  Boxes,
  CalendarClock,
  ExternalLink,
  FileSearch,
  GitBranch,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  MapPinned,
  PencilLine,
  Search,
  Shield,
  Sparkles,
  Swords,
  Upload,
  UserRound,
} from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { createCharacterPortraitDataUrl } from '../../lib/characterPortrait'
import { generateLocalAiPortrait, localAiPortraitErrorMessage } from '../../lib/localAiBridgeApi'
import type {
  PdfCampaignAnalysisV1,
  PdfImportCandidateV1,
  PdfNamedRecordV1,
  PdfPersonRecordV1,
  PdfSourceCitationV1,
} from '../../lib/pdfCampaignAnalysis'
import PdfRelationshipGraph from './PdfRelationshipGraph'
import {
  buildPdfMapIndex,
  buildPdfMonsterCodex,
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
    <article className="rounded-2xl border border-white/8 bg-white/[0.018] p-4 transition hover:border-violet-400/20 hover:bg-violet-500/[0.025]">
      <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
      {description && <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-400">{description}</p>}
      {children}
      {!!citations?.length && <p className="mt-3 text-[10px] font-medium leading-5 text-slate-400">{citationText(citations)}</p>}
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

interface PdfCampaignKnowledgeBaseProps {
  analysis: PdfCampaignAnalysisV1
  mapHref: string
  onEdit: () => void
  onPortraitChange: (personName: string, portraitDataUrl: string) => void
  initialTab?: PdfKnowledgeTabV1
}

export default function PdfCampaignKnowledgeBase({
  analysis,
  mapHref,
  onEdit,
  onPortraitChange,
  initialTab = 'overview',
}: PdfCampaignKnowledgeBaseProps) {
  const [activeTab, setActiveTab] = useState<PdfKnowledgeTabV1>(initialTab)
  const [query, setQuery] = useState('')
  const [searchScope, setSearchScope] = useState<'current' | 'all'>('current')
  const [selectedImport, setSelectedImport] = useState<PdfImportCandidateV1 | null>(null)
  const counts = useMemo(() => pdfKnowledgeTabCounts(analysis), [analysis])
  const monsterCodex = useMemo(() => buildPdfMonsterCodex(analysis), [analysis])
  const mapIndex = useMemo(() => buildPdfMapIndex(analysis), [analysis])

  const people = filterRecords(analysis.people, query, (person) => [person.role, person.appearance, person.personality, person.motivation, person.secret, person.voice])
  const factions = filterRecords(analysis.factions, query)
  const locations = filterRecords(analysis.locations, query)
  const clues = filterRecords(analysis.clues, query, (clue) => [clue.source, clue.discovery, clue.failForward])
  const scenes = filterRecords(analysis.scenes, query, (scene) => [scene.location, scene.npcs, scene.monsters])
  const encounters = filterRecords(analysis.encounters, query, (encounter) => [encounter.creatures, encounter.notes])
  const imports = filterRecords(analysis.importCandidates, query, (entry) => [entry.kind, entry.automation, KIND_LABELS[entry.kind], KIND_LABELS[entry.automation]])
  const monsters = monsterCodex.filter((entry) => pdfKnowledgeMatches(query, entry.name, entry.description, entry.encounterNames, KIND_LABELS[entry.automation]))
  const maps = mapIndex.filter((entry) => pdfKnowledgeMatches(query, entry.name, entry.description, entry.sceneNames))
  const relationships = analysis.relationships.filter((entry) => pdfKnowledgeMatches(query, entry.from, entry.to, entry.type, entry.description))
  const hasGlobalQuery = searchScope === 'all' && query.trim().length > 0

  const renderNamedRecords = (records: readonly PdfNamedRecordV1[], empty: string) => records.length === 0
    ? <EmptyState>{empty}</EmptyState>
    : <div className="grid gap-3 lg:grid-cols-2">{records.map((record, index) => <KnowledgeCard key={`${record.name}:${index}`} title={record.name} description={record.description} citations={record.citations} />)}</div>

  const renderGlobalSearch = () => {
    const groups: Array<{ title: string; entries: Array<{ title: string; description: string; meta: string }> }> = [
      { title: '人物', entries: people.map((entry) => ({ title: entry.name, description: entry.description, meta: entry.role })) },
      { title: '组织与势力', entries: factions.map((entry) => ({ title: entry.name, description: entry.description, meta: '势力' })) },
      { title: '地点与地图', entries: maps.map((entry) => ({ title: entry.name, description: entry.description, meta: entry.source === 'map-candidate' ? '地图资源' : '地点' })) },
      { title: '场景与事件', entries: [...scenes, ...encounters].map((entry) => ({ title: entry.name, description: entry.description, meta: '场景' })) },
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
            <p className="mt-1 line-clamp-3 text-[11px] leading-5 text-slate-500">{entry.description}</p>
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
    if (activeTab === 'people') return people.length === 0 ? <EmptyState>没有匹配的人物档案。</EmptyState> : (
      <div className="grid gap-3 xl:grid-cols-2">{people.map((person, index) => (
        <article key={`${person.name}:${index}`} className="rounded-2xl border border-white/8 bg-white/[0.018] p-4">
          <div className="flex gap-4">
            <div className="grid h-24 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-violet-400/20 bg-violet-500/10 text-xl font-bold text-violet-200">
              {person.portraitDataUrl ? <img src={person.portraitDataUrl} alt={`${person.name}的立绘`} className="h-full w-full object-cover" /> : Array.from(person.name).slice(0, 2).join('')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold text-slate-100">{person.name}</h4><span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] text-violet-200">{person.role || '身份待确认'}</span></div>
              <p className="mt-2 text-xs leading-5 text-slate-400">{person.description}</p>
              {person.appearance && <p className="mt-1 text-[11px] leading-5 text-slate-500">外貌：{person.appearance}</p>}
              {person.personality && <p className="text-[11px] leading-5 text-slate-500">性格：{person.personality}</p>}
              {person.motivation && <p className="text-[11px] leading-5 text-slate-500">动机：{person.motivation}</p>}
            </div>
          </div>
          <PersonPortraitStudio person={person} onPortraitChange={onPortraitChange} />
          {!!person.citations.length && <p className="mt-3 text-[10px] font-medium text-slate-400">{citationText(person.citations)}</p>}
        </article>
      ))}</div>
    )
    if (activeTab === 'factions') return renderNamedRecords(factions, '没有匹配的组织或势力。')
    if (activeTab === 'locations') return renderNamedRecords(locations, '没有匹配的地点。')
    if (activeTab === 'clues') return clues.length === 0 ? <EmptyState>没有匹配的线索。</EmptyState> : <div className="grid gap-3 lg:grid-cols-2">{clues.map((clue, index) => <KnowledgeCard key={`${clue.name}:${index}`} title={clue.name} description={clue.description} citations={clue.citations}><div className="mt-3 space-y-1 text-[11px] leading-5 text-slate-500">{clue.source && <p>来源：{clue.source}</p>}{clue.discovery && <p>发现方式：{clue.discovery}</p>}{clue.failForward && <p>失败推进：{clue.failForward}</p>}</div></KnowledgeCard>)}</div>
    if (activeTab === 'events') {
      const entries = [...scenes.map((entry) => ({ ...entry, kind: '场景' })), ...encounters.map((entry) => ({ ...entry, kind: '遭遇' }))]
      return entries.length === 0 ? <EmptyState>没有匹配的事件或场景。</EmptyState> : <div className="grid gap-3 lg:grid-cols-2">{entries.map((entry, index) => <KnowledgeCard key={`${entry.kind}:${entry.name}:${index}`} title={entry.name} description={entry.description} citations={entry.citations}><span className="mt-3 inline-flex rounded-full bg-cyan-500/10 px-2 py-1 text-[9px] text-cyan-200">{entry.kind}</span></KnowledgeCard>)}</div>
    }
    if (activeTab === 'timeline') {
      const timeline = [...scenes].sort((left, right) => (left.citations[0]?.page ?? 0) - (right.citations[0]?.page ?? 0))
      return timeline.length === 0 ? <EmptyState>尚未生成可以排序的场景时间线。</EmptyState> : <ol className="relative ml-3 border-l border-violet-400/20 pl-6">{timeline.map((scene, index) => <li key={`${scene.name}:${index}`} className="relative pb-7"><span className="absolute -left-[31px] top-0 grid h-3 w-3 place-items-center rounded-full border-2 border-slate-950 bg-violet-400" /><p className="text-[10px] font-semibold text-violet-300">节点 {String(index + 1).padStart(2, '0')} · 第 {scene.citations[0]?.page ?? '？'} 页</p><h4 className="mt-1 text-sm font-semibold text-slate-100">{scene.name}</h4><p className="mt-1 text-xs leading-5 text-slate-500">{scene.description}</p>{scene.location && <p className="mt-1 text-[10px] text-cyan-300">地点：{scene.location}</p>}</li>)}</ol>
    }
    if (activeTab === 'maps') return maps.length === 0 ? <EmptyState>没有识别到地图或可建立场景的地点。</EmptyState> : <div className="space-y-3"><div className="flex justify-end"><Link to={mapHref} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-[10px] font-semibold text-emerald-100 hover:bg-emerald-500/20"><ExternalLink className="h-3.5 w-3.5" />进入地图与场景编排</Link></div><div className="grid gap-3 lg:grid-cols-2">{maps.map((entry, index) => <KnowledgeCard key={`${entry.name}:${index}`} title={entry.name} description={entry.description} citations={entry.citations}><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] text-emerald-200">{entry.source === 'map-candidate' ? '地图资源' : '地点索引'}</span>{entry.sceneNames.map((scene) => <span key={scene} className="rounded-full bg-white/[0.04] px-2 py-1 text-[9px] text-slate-400">{scene}</span>)}</div></KnowledgeCard>)}</div></div>
    if (activeTab === 'monsters') return monsters.length === 0 ? <EmptyState>没有识别到怪物。遭遇中的生物和怪物导入候选都会显示在这里。</EmptyState> : <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{monsters.map((entry, index) => <KnowledgeCard key={`${entry.name}:${index}`} title={entry.name} description={entry.description} citations={entry.citations}><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-[9px] ${entry.automation === 'full' ? 'bg-emerald-500/10 text-emerald-200' : entry.automation === 'partial' ? 'bg-amber-500/10 text-amber-200' : 'bg-slate-500/10 text-slate-400'}`}>{KIND_LABELS[entry.automation]}</span>{entry.encounterNames.map((encounter) => <span key={encounter} className="rounded-full bg-rose-500/10 px-2 py-1 text-[9px] text-rose-200">{encounter}</span>)}</div></KnowledgeCard>)}</div>
    if (activeTab === 'relationships') return <PdfRelationshipGraph people={people} factions={factions} locations={locations} relationships={relationships} scenes={scenes} onPortraitChange={onPortraitChange} />
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
        {entry.description && <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-6 text-slate-400">{entry.description}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-[9px] text-cyan-200">{KIND_LABELS[entry.kind]}</span>
          <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[9px] text-slate-400">{KIND_LABELS[entry.automation]}</span>
          {likelyCombatNpc(entry) && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[9px] text-amber-200">可能应归类为怪物</span>}
        </div>
        {!!entry.citations.length && <p className="mt-3 text-[10px] font-medium leading-5 text-slate-400">{citationText(entry.citations)}</p>}
      </button>
    ))}</div>
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/8 bg-black/15" data-testid="pdf-campaign-knowledge-base">
      <header className="border-b border-white/8 p-4">
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
        {KNOWLEDGE_TABS.map((tab) => {
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
            {!!selectedImport.citations.length && <p className="mt-4 text-xs font-medium leading-6 text-slate-400">来源：{citationText(selectedImport.citations)}</p>}
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => { setSelectedImport(null); onEdit() }} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-400"><PencilLine className="h-3.5 w-3.5" />编辑类型与内容</button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
