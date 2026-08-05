import { FileCheck2, Plus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  PdfCampaignAnalysisV1,
  PdfClueRecordV1,
  PdfEncounterRecordV1,
  PdfImportCandidateV1,
  PdfNamedRecordV1,
  PdfPersonRecordV1,
  PdfPrepTipV1,
  PdfRelationshipRecordV1,
  PdfSceneRecordV1,
  PdfSourceCitationV1,
} from '../../lib/pdfCampaignAnalysis'
import {
  commaSeparatedValues,
  emptyPdfClue,
  emptyPdfEncounter,
  emptyPdfImportCandidate,
  emptyPdfNamedRecord,
  emptyPdfPerson,
  emptyPdfPrepTip,
  emptyPdfRelationship,
  emptyPdfScene,
  removePdfAnalysisEntry,
  renamePdfAnalysisEntity,
} from './pdfCampaignAnalysisEditorModel'
import { showAppConfirm } from '../../lib/appDialog'

type EditorTab =
  | 'overview'
  | 'people'
  | 'relationships'
  | 'factions'
  | 'locations'
  | 'clues'
  | 'scenes'
  | 'encounters'
  | 'imports'
  | 'tips'
  | 'warnings'

const EDITOR_TABS: Array<{ id: EditorTab; label: string }> = [
  { id: 'overview', label: '总览' },
  { id: 'people', label: '人物' },
  { id: 'relationships', label: '关系' },
  { id: 'factions', label: '势力' },
  { id: 'locations', label: '地点' },
  { id: 'clues', label: '线索' },
  { id: 'scenes', label: '场景' },
  { id: 'encounters', label: '遭遇' },
  { id: 'imports', label: '待导入资源' },
  { id: 'tips', label: '备团提示' },
  { id: 'warnings', label: '复核事项' },
]

interface PdfCampaignAnalysisEditorProps {
  analysis: PdfCampaignAnalysisV1
  onChange: (analysis: PdfCampaignAnalysisV1) => void
  onClose: () => void
  onExport?: () => void
}

function tabCount(analysis: PdfCampaignAnalysisV1, tab: EditorTab): number | null {
  if (tab === 'overview') return null
  if (tab === 'relationships') return analysis.relationships.length
  if (tab === 'imports') return analysis.importCandidates.length
  if (tab === 'tips') return analysis.prepTips.length
  return analysis[tab].length
}

function citationText(citations: readonly PdfSourceCitationV1[]): string {
  return citations.map((citation) => `${citation.documentName} · 第 ${citation.page} 页`).join('；')
}

function Evidence({ citations }: { citations: readonly PdfSourceCitationV1[] }) {
  return (
    <div className="rounded-xl border border-sky-400/15 bg-sky-500/[0.04] px-3 py-2 text-[10px] font-medium leading-5 text-sky-100/80">
      <strong className="mr-2 text-sky-100">原文证据（只读）</strong>
      {citations.length > 0 ? citationText(citations) : '这是由 DM 新增的条目，没有绑定原文页码。'}
    </div>
  )
}

function Field({ label, value, onChange, multiline = false, placeholder }: {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  placeholder?: string
}) {
  const className = 'mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs leading-5 text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-violet-400/45'
  return (
    <label className="block text-[10px] font-semibold text-slate-500">
      {label}
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} className={`${className} resize-y`} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={className} />
      )}
    </label>
  )
}

function SelectField({ label, value, onChange, children }: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="block text-[10px] font-semibold text-slate-500">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-400/45">
        {children}
      </select>
    </label>
  )
}

function RecordCard({ title, index, citations, onRemove, children }: {
  title: string
  index: number
  citations: readonly PdfSourceCitationV1[]
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <article className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] text-slate-600">条目 {index + 1}</p>
          <h4 className="mt-0.5 text-sm font-semibold text-slate-200">{title || '未命名条目'}</h4>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/15 px-2.5 py-2 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" />删除
        </button>
      </div>
      <div className="grid gap-3">{children}</div>
      <div className="mt-4"><Evidence citations={citations} /></div>
    </article>
  )
}

function replaceAt<T>(entries: readonly T[], index: number, value: T): T[] {
  return entries.map((entry, entryIndex) => entryIndex === index ? value : entry)
}

export default function PdfCampaignAnalysisEditor({ analysis, onChange, onClose, onExport }: PdfCampaignAnalysisEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('overview')
  const entityNames = useMemo(() => [
    ...analysis.people.map((entry) => entry.name),
    ...analysis.factions.map((entry) => entry.name),
    ...analysis.locations.map((entry) => entry.name),
  ].filter(Boolean), [analysis.factions, analysis.locations, analysis.people])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const remove = async (collection: keyof PdfCampaignAnalysisV1, index: number) => {
    if (!await showAppConfirm({
      title: '删除分析条目',
      message: '确定删除这个分析条目吗？原始 PDF 不会受到影响。',
      confirmLabel: '确认删除',
      tone: 'danger',
    })) return
    onChange(removePdfAnalysisEntry(analysis, collection, index))
  }

  const addForTab = () => {
    if (activeTab === 'people') onChange({ ...analysis, people: [...analysis.people, emptyPdfPerson()] })
    else if (activeTab === 'relationships') onChange({ ...analysis, relationships: [...analysis.relationships, emptyPdfRelationship()] })
    else if (activeTab === 'factions') onChange({ ...analysis, factions: [...analysis.factions, emptyPdfNamedRecord('新势力')] })
    else if (activeTab === 'locations') onChange({ ...analysis, locations: [...analysis.locations, emptyPdfNamedRecord('新地点')] })
    else if (activeTab === 'clues') onChange({ ...analysis, clues: [...analysis.clues, emptyPdfClue()] })
    else if (activeTab === 'scenes') onChange({ ...analysis, scenes: [...analysis.scenes, emptyPdfScene()] })
    else if (activeTab === 'encounters') onChange({ ...analysis, encounters: [...analysis.encounters, emptyPdfEncounter()] })
    else if (activeTab === 'imports') onChange({ ...analysis, importCandidates: [...analysis.importCandidates, emptyPdfImportCandidate()] })
    else if (activeTab === 'tips') onChange({ ...analysis, prepTips: [...analysis.prepTips, emptyPdfPrepTip()] })
    else if (activeTab === 'warnings') onChange({ ...analysis, warnings: [...analysis.warnings, '新复核事项'] })
  }

  const canAdd = activeTab !== 'overview'

  return (
    <div className="fixed inset-0 z-[180] flex bg-slate-950/90 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="DM 分析结果编辑器">
      <div className="m-auto flex h-[94vh] w-[min(1500px,96vw)] flex-col overflow-hidden rounded-3xl border border-violet-400/20 bg-[#0b0d17] shadow-2xl shadow-black/60">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-violet-300" />
              <h2 className="text-base font-bold text-slate-100">DM 分析结果审阅器</h2>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">修改立即写入当前分析草稿；PDF 原文与引用页码保持不变。</p>
          </div>
          <div className="flex items-center gap-2">
            {onExport && (
              <button type="button" onClick={onExport} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.04]">
                <Save className="h-4 w-4" />导出当前草稿
              </button>
            )}
            <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-400">
              <X className="h-4 w-4" />完成编辑
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/8 p-3 lg:w-52 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r">
            {EDITOR_TABS.map((tab) => {
              const count = tabCount(analysis, tab.id)
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${activeTab === tab.id ? 'bg-violet-500/15 text-violet-100' : 'text-slate-500 hover:bg-white/[0.035] hover:text-slate-300'}`}
                >
                  {tab.label}
                  {count != null && <span className="rounded-full border border-white/8 px-2 py-0.5 text-[9px] font-normal text-slate-500">{count}</span>}
                </button>
              )
            })}
          </nav>

          <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="mx-auto max-w-5xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{EDITOR_TABS.find((tab) => tab.id === activeTab)?.label}</h3>
                  <p className="mt-1 text-[10px] text-slate-600">AI 内容不是权威规则；确认无误后再导入工坊或场景。</p>
                </div>
                {canAdd && (
                  <button type="button" onClick={addForTab} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/15">
                    <Plus className="h-4 w-4" />新增条目
                  </button>
                )}
              </div>
              <div className="space-y-4">
                {activeTab === 'overview' && (
                  <section className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <Field label="全书概览" value={analysis.overview} multiline onChange={(overview) => onChange({ ...analysis, overview })} placeholder="核心冲突、反派计划、证据链、玩家选择与结局分支……" />
                    <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[10px] leading-5 text-slate-500">
                      已分析 {analysis.documents.length} 个文档、{analysis.documents.reduce((sum, document) => sum + document.pageCount, 0)} 页。文档元数据由 Host 生成，不能在这里修改。
                    </div>
                  </section>
                )}

                {activeTab === 'people' && analysis.people.map((person, index) => (
                  <PersonEditor key={index} person={person} index={index} onChange={(next) => onChange({ ...analysis, people: replaceAt(analysis.people, index, next) })} onRename={(name) => onChange(renamePdfAnalysisEntity(analysis, 'people', index, name))} onRemove={() => void remove('people', index)} />
                ))}
                {activeTab === 'relationships' && analysis.relationships.map((relationship, index) => (
                  <RelationshipEditor key={index} relationship={relationship} index={index} entityNames={entityNames} onChange={(next) => onChange({ ...analysis, relationships: replaceAt(analysis.relationships, index, next) })} onRemove={() => void remove('relationships', index)} />
                ))}
                {activeTab === 'factions' && analysis.factions.map((record, index) => (
                  <NamedEditor key={index} record={record} index={index} onChange={(next) => onChange({ ...analysis, factions: replaceAt(analysis.factions, index, next) })} onRename={(name) => onChange(renamePdfAnalysisEntity(analysis, 'factions', index, name))} onRemove={() => void remove('factions', index)} />
                ))}
                {activeTab === 'locations' && analysis.locations.map((record, index) => (
                  <NamedEditor key={index} record={record} index={index} onChange={(next) => onChange({ ...analysis, locations: replaceAt(analysis.locations, index, next) })} onRename={(name) => onChange(renamePdfAnalysisEntity(analysis, 'locations', index, name))} onRemove={() => void remove('locations', index)} />
                ))}
                {activeTab === 'clues' && analysis.clues.map((record, index) => (
                  <ClueEditor key={index} record={record} index={index} onChange={(next) => onChange({ ...analysis, clues: replaceAt(analysis.clues, index, next) })} onRemove={() => void remove('clues', index)} />
                ))}
                {activeTab === 'scenes' && analysis.scenes.map((record, index) => (
                  <SceneEditor key={index} record={record} index={index} onChange={(next) => onChange({ ...analysis, scenes: replaceAt(analysis.scenes, index, next) })} onRemove={() => void remove('scenes', index)} />
                ))}
                {activeTab === 'encounters' && analysis.encounters.map((record, index) => (
                  <EncounterEditor key={index} record={record} index={index} onChange={(next) => onChange({ ...analysis, encounters: replaceAt(analysis.encounters, index, next) })} onRemove={() => void remove('encounters', index)} />
                ))}
                {activeTab === 'imports' && analysis.importCandidates.map((record, index) => (
                  <ImportEditor key={index} record={record} index={index} onChange={(next) => onChange({ ...analysis, importCandidates: replaceAt(analysis.importCandidates, index, next) })} onRemove={() => void remove('importCandidates', index)} />
                ))}
                {activeTab === 'tips' && analysis.prepTips.map((record, index) => (
                  <PrepTipEditor key={index} record={record} index={index} onChange={(next) => onChange({ ...analysis, prepTips: replaceAt(analysis.prepTips, index, next) })} onRemove={() => void remove('prepTips', index)} />
                ))}
                {activeTab === 'warnings' && analysis.warnings.map((warning, index) => (
                  <article key={index} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="min-w-0 flex-1"><Field label={`复核事项 ${index + 1}`} value={warning} multiline onChange={(value) => onChange({ ...analysis, warnings: replaceAt(analysis.warnings, index, value) })} /></div>
                    <button type="button" onClick={() => void remove('warnings', index)} className="mt-5 rounded-lg border border-rose-400/15 p-2 text-rose-300"><Trash2 className="h-4 w-4" /></button>
                  </article>
                ))}
                {activeTab !== 'overview' && tabCount(analysis, activeTab) === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-xs text-slate-600">当前分类没有条目。DM 可以点击“新增条目”补充。</div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function PersonEditor({ person, index, onChange, onRename, onRemove }: { person: PdfPersonRecordV1; index: number; onChange: (value: PdfPersonRecordV1) => void; onRename: (name: string) => void; onRemove: () => void }) {
  return <RecordCard title={person.name} index={index} citations={person.citations} onRemove={onRemove}>
    <div className="grid gap-3 md:grid-cols-2"><Field label="人物名称" value={person.name} onChange={onRename} /><Field label="身份／角色" value={person.role} onChange={(role) => onChange({ ...person, role })} /></div>
    <Field label="人物概述" value={person.description} multiline onChange={(description) => onChange({ ...person, description })} />
    <div className="grid gap-3 md:grid-cols-2"><Field label="外貌与辨识特征" value={person.appearance ?? ''} multiline onChange={(appearance) => onChange({ ...person, appearance })} /><Field label="性格" value={person.personality} multiline onChange={(personality) => onChange({ ...person, personality })} /></div>
    <div className="grid gap-3 md:grid-cols-2"><Field label="动机" value={person.motivation} multiline onChange={(motivation) => onChange({ ...person, motivation })} /><Field label="秘密" value={person.secret} multiline onChange={(secret) => onChange({ ...person, secret })} /></div>
    <Field label="说话方式与扮演提示" value={person.voice} multiline onChange={(voice) => onChange({ ...person, voice })} />
  </RecordCard>
}

function RelationshipEditor({ relationship, index, entityNames, onChange, onRemove }: { relationship: PdfRelationshipRecordV1; index: number; entityNames: readonly string[]; onChange: (value: PdfRelationshipRecordV1) => void; onRemove: () => void }) {
  return <RecordCard title={`${relationship.from || '未指定'} → ${relationship.to || '未指定'}`} index={index} citations={relationship.citations} onRemove={onRemove}>
    <datalist id={`pdf-entity-names-${index}`}>{entityNames.map((name) => <option key={name} value={name} />)}</datalist>
    <div className="grid gap-3 md:grid-cols-3">
      <label className="block text-[10px] font-semibold text-slate-500">起点实体<input list={`pdf-entity-names-${index}`} value={relationship.from} onChange={(event) => onChange({ ...relationship, from: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200 outline-none" /></label>
      <Field label="关系类型" value={relationship.type} onChange={(type) => onChange({ ...relationship, type })} />
      <label className="block text-[10px] font-semibold text-slate-500">目标实体<input list={`pdf-entity-names-${index}`} value={relationship.to} onChange={(event) => onChange({ ...relationship, to: event.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-slate-200 outline-none" /></label>
    </div>
    <Field label="关系说明" value={relationship.description} multiline onChange={(description) => onChange({ ...relationship, description })} />
  </RecordCard>
}

function NamedEditor({ record, index, onChange, onRename, onRemove }: { record: PdfNamedRecordV1; index: number; onChange: (value: PdfNamedRecordV1) => void; onRename: (name: string) => void; onRemove: () => void }) {
  return <RecordCard title={record.name} index={index} citations={record.citations} onRemove={onRemove}><Field label="名称" value={record.name} onChange={onRename} /><Field label="说明" value={record.description} multiline onChange={(description) => onChange({ ...record, description })} /></RecordCard>
}

function ClueEditor({ record, index, onChange, onRemove }: { record: PdfClueRecordV1; index: number; onChange: (value: PdfClueRecordV1) => void; onRemove: () => void }) {
  return <RecordCard title={record.name} index={index} citations={record.citations} onRemove={onRemove}><Field label="线索名称" value={record.name} onChange={(name) => onChange({ ...record, name })} /><Field label="线索内容" value={record.description} multiline onChange={(description) => onChange({ ...record, description })} /><div className="grid gap-3 md:grid-cols-2"><Field label="线索来源" value={record.source} onChange={(source) => onChange({ ...record, source })} /><Field label="发现方式" value={record.discovery} onChange={(discovery) => onChange({ ...record, discovery })} /></div><Field label="失败后如何继续" value={record.failForward} multiline onChange={(failForward) => onChange({ ...record, failForward })} /></RecordCard>
}

function SceneEditor({ record, index, onChange, onRemove }: { record: PdfSceneRecordV1; index: number; onChange: (value: PdfSceneRecordV1) => void; onRemove: () => void }) {
  return <RecordCard title={record.name} index={index} citations={record.citations} onRemove={onRemove}><div className="grid gap-3 md:grid-cols-2"><Field label="场景名称" value={record.name} onChange={(name) => onChange({ ...record, name })} /><Field label="地点" value={record.location} onChange={(location) => onChange({ ...record, location })} /></div><Field label="场景目标、触发与关键选择" value={record.description} multiline onChange={(description) => onChange({ ...record, description })} /><div className="grid gap-3 md:grid-cols-2"><Field label="参与 NPC（逗号分隔）" value={record.npcs.join('，')} onChange={(value) => onChange({ ...record, npcs: commaSeparatedValues(value) })} /><Field label="参与怪物（逗号分隔）" value={record.monsters.join('，')} onChange={(value) => onChange({ ...record, monsters: commaSeparatedValues(value) })} /></div></RecordCard>
}

function EncounterEditor({ record, index, onChange, onRemove }: { record: PdfEncounterRecordV1; index: number; onChange: (value: PdfEncounterRecordV1) => void; onRemove: () => void }) {
  return <RecordCard title={record.name} index={index} citations={record.citations} onRemove={onRemove}><Field label="遭遇名称" value={record.name} onChange={(name) => onChange({ ...record, name })} /><Field label="遭遇说明" value={record.description} multiline onChange={(description) => onChange({ ...record, description })} /><Field label="参与生物（逗号分隔）" value={record.creatures.join('，')} onChange={(value) => onChange({ ...record, creatures: commaSeparatedValues(value) })} /><Field label="战术、环境与结算备注" value={record.notes} multiline onChange={(notes) => onChange({ ...record, notes })} /></RecordCard>
}

function ImportEditor({ record, index, onChange, onRemove }: { record: PdfImportCandidateV1; index: number; onChange: (value: PdfImportCandidateV1) => void; onRemove: () => void }) {
  return <RecordCard title={record.name} index={index} citations={record.citations} onRemove={onRemove}><Field label="资源名称" value={record.name} onChange={(name) => onChange({ ...record, name })} /><div className="grid gap-3 md:grid-cols-2"><SelectField label="资源类型" value={record.kind} onChange={(kind) => onChange({ ...record, kind: kind as PdfImportCandidateV1['kind'] })}><option value="monster">怪物</option><option value="npc">NPC</option><option value="item">物品</option><option value="spell">法术</option><option value="map">地图</option><option value="handout">讲义</option><option value="rule">规则</option></SelectField><SelectField label="预期自动化" value={record.automation} onChange={(automation) => onChange({ ...record, automation: automation as PdfImportCandidateV1['automation'] })}><option value="full">完全自动</option><option value="partial">半自动</option><option value="manual">DM 裁定</option></SelectField></div><Field label="资源说明" value={record.description} multiline onChange={(description) => onChange({ ...record, description })} /></RecordCard>
}

function PrepTipEditor({ record, index, onChange, onRemove }: { record: PdfPrepTipV1; index: number; onChange: (value: PdfPrepTipV1) => void; onRemove: () => void }) {
  return <RecordCard title={record.title} index={index} citations={record.citations} onRemove={onRemove}><div className="grid gap-3 md:grid-cols-[1fr_180px]"><Field label="提示标题" value={record.title} onChange={(title) => onChange({ ...record, title })} /><SelectField label="优先级" value={record.priority} onChange={(priority) => onChange({ ...record, priority: priority as PdfPrepTipV1['priority'] })}><option value="high">高</option><option value="medium">中</option><option value="low">低</option></SelectField></div><Field label="具体备团事项" value={record.description} multiline onChange={(description) => onChange({ ...record, description })} /></RecordCard>
}
