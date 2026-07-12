import { useMemo, useState } from 'react'
import { ArrowUpCircle, GitBranch, Lock, Sparkles } from 'lucide-react'
import { useCharacterStore } from '../../store/characters'
import {
  classDefinitionForCharacter,
  type ClassSkillTreeNodeView,
  type ClassSkillTreeView,
} from '../../lib/classDefinitionRegistry'

const CELL_W = 88
const CELL_H = 104
const NODE_CY = 36

function SkillNode({ node, active, onSelect }: {
  node: ClassSkillTreeNodeView
  active: boolean
  onSelect: () => void
}) {
  const { learned, rank, levelOk, prerequisiteOk, classOk } = node.state
  const faded = !learned && (!levelOk || !prerequisiteOk || !classOk)
  return (
    <button
      type="button"
      onClick={onSelect}
      title={node.name}
      className={[
        'group relative z-10 flex w-full flex-col items-center gap-1 transition-all',
        faded ? 'opacity-70' : '',
      ].join(' ')}
    >
      <div className={[
        'relative z-10 flex h-[68px] w-[68px] items-center justify-center rounded-full border-[3px] text-2xl shadow-lg transition-all',
        'border-amber-700/70 bg-gradient-to-br from-void-800 to-void-950',
        active ? 'scale-105 ring-2 ring-amber-500/50' : 'group-hover:scale-[1.03]',
        learned ? 'border-amber-500/60' : 'border-slate-600/50',
      ].join(' ')}>
        <span className={learned ? '' : 'opacity-90'}>{node.emoji}</span>
        {!learned && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-void-950/35">
            <Lock className="h-4 w-4 text-slate-400" />
          </span>
        )}
        {learned && (
          <span className="absolute -bottom-1 rounded-md bg-void-950/90 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-200 ring-1 ring-amber-500/30">
            {rank}/{node.maxRank}
          </span>
        )}
      </div>
      <span className="relative z-10 line-clamp-2 w-full rounded bg-void-950/90 px-0.5 text-center text-[10px] font-medium leading-tight text-slate-300">
        {node.name}
      </span>
    </button>
  )
}

function PrerequisiteLines({ nodes }: { nodes: ClassSkillTreeNodeView[] }) {
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const center = (node: ClassSkillTreeNodeView) => ({
    x: node.column * CELL_W + CELL_W / 2,
    y: node.row * CELL_H + NODE_CY,
  })
  return (
    <svg className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible">
      {nodes.map((node) => {
        if (!node.prerequisite?.withinSection) return null
        const parent = byId.get(node.prerequisite.skillId)
        if (!parent) return null
        const from = center(parent)
        const to = center(node)
        const fromBottom = from.y + 34
        const toTop = to.y - 34
        const midY = (fromBottom + toTop) / 2
        const d = from.x === to.x
          ? `M ${from.x} ${fromBottom} L ${to.x} ${toTop}`
          : `M ${from.x} ${fromBottom} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${toTop}`
        return <path key={`${parent.id}-${node.id}`} d={d} fill="none" stroke="rgba(251, 191, 36, 0.55)" strokeWidth={2} strokeLinecap="round" />
      })}
    </svg>
  )
}

function SkillTreeSection({
  label,
  nodes,
  selectedId,
  onSelect,
}: {
  label: string
  nodes: ClassSkillTreeNodeView[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const bounds = useMemo(() => {
    const maxColumn = Math.max(0, ...nodes.map((node) => node.column))
    const maxRow = Math.max(0, ...nodes.map((node) => node.row))
    return { width: (maxColumn + 1) * CELL_W, height: (maxRow + 1) * CELL_H + 12 }
  }, [nodes])
  if (nodes.length === 0) return null
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-white/10 bg-void-950/40 p-3">
      <h3 className="mb-3 text-center text-sm font-semibold text-amber-200/90">{label}</h3>
      <div className="relative mx-auto" style={{ width: bounds.width, height: bounds.height }}>
        <PrerequisiteLines nodes={nodes} />
        {nodes.map((node) => (
          <div key={node.id} className="absolute" style={{ left: node.column * CELL_W, top: node.row * CELL_H, width: CELL_W }}>
            <SkillNode node={node} active={selectedId === node.id} onSelect={() => onSelect(node.id)} />
          </div>
        ))}
      </div>
    </div>
  )
}

function SkillDetailPanel({ node, view, onLearn, onUpgrade }: {
  node: ClassSkillTreeNodeView
  view: ClassSkillTreeView
  onLearn: (id: string) => void
  onUpgrade: (id: string) => void
}) {
  const { learned, rank, levelOk, prerequisiteOk, classOk, canLearn, canUpgrade } = node.state
  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-void-900/50 p-5">
      <div className="flex items-start gap-4">
        <div className={[
          'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 text-3xl',
          learned ? 'border-amber-500/40 bg-amber-500/10' : 'border-white/10 bg-white/5',
        ].join(' ')}>{node.emoji}</div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-slate-100">{node.name}</h3>
          <p className="mt-1 text-sm text-slate-400">
            角色 {node.unlockLevel} 级可学
            {node.prerequisite?.label && ` · 前置：${node.prerequisite.label}`}
            {node.classRequirement && ` · 需「${node.classRequirement}」`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-slate-300">CD {node.cooldown === 0 ? '无' : `${node.cooldown} 回合`}</span>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-slate-300">{node.apCost > 0 ? `${node.apCost} AP` : '—'}</span>
            {learned && <span className="rounded-md bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-200">{rank}/{node.maxRank} 级</span>}
          </div>
        </div>
      </div>

      {!learned ? (
        <div className="mt-6 space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100/90">
          {!levelOk && <p>需要角色达到 {node.unlockLevel} 级</p>}
          {levelOk && !classOk && node.classRequirement && <p>需要职业「{node.classRequirement}」</p>}
          {levelOk && classOk && !prerequisiteOk && node.prerequisite?.label && <p>需要先学习：{node.prerequisite.label}</p>}
          {canLearn && (
            <button type="button" onClick={() => onLearn(node.id)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500/25 px-3 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/35">
              <Sparkles className="h-4 w-4" />学习技能（消耗 1 技能点，剩余 {view.availablePoints} 点）
            </button>
          )}
          {!canLearn && levelOk && prerequisiteOk && classOk && view.availablePoints <= 0 && <p>技能点不足（{view.pointRuleLabel}）</p>}
        </div>
      ) : (
        <>
          <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-slate-300">{node.description}</p>
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">各等级效果</p>
            <div className="space-y-1.5">
              {node.tierDescriptions.map((description, index) => (
                <div key={index} className={[
                  'rounded-lg px-3 py-2 text-xs leading-relaxed',
                  index + 1 === rank ? 'border border-amber-500/35 bg-amber-500/10 text-amber-100' : 'bg-void-900/60 text-slate-400',
                ].join(' ')}>
                  <span className="font-semibold text-slate-300">{index + 1} 级</span>
                  <span className="mx-2 text-slate-600">—</span>{description}
                </div>
              ))}
            </div>
          </div>
          {canUpgrade && (
            <button type="button" onClick={() => onUpgrade(node.id)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500/20 px-3 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/30">
              <ArrowUpCircle className="h-4 w-4" />升级（消耗 1 技能点 → {rank + 1} 级，剩余 {view.availablePoints - 1} 点）
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default function SkillTreeTab({ charId }: { charId: string }) {
  const character = useCharacterStore((state) => state.characters.find((item) => item.id === charId))
  const learnSkill = useCharacterStore((state) => state.learnSkill)
  const upgradeSkillRank = useCharacterStore((state) => state.upgradeSkillRank)
  const [selectedId, setSelectedId] = useState('')
  const definition = character ? classDefinitionForCharacter(character) : undefined
  const view = useMemo(
    () => character && definition?.skillTree ? definition.skillTree.buildView(character) : null,
    [character, definition],
  )
  if (!character || !view) {
    return <div className="glass rounded-2xl p-8 text-center text-sm text-slate-400">当前职业没有可用技能树。</div>
  }
  const selected = view.nodes.find((node) => node.id === selectedId) ?? view.nodes[0]
  if (!selected) {
    return <div className="glass rounded-2xl p-8 text-center text-sm text-slate-400">暂无可用技能。</div>
  }
  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <GitBranch className="h-4 w-4 text-amber-300" />
          <span>{character.charClass} · Lv.{character.level}</span>
          {view.headerNote && <span className="text-slate-500">· {view.headerNote}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">累计 {view.earnedPoints} 点 · {view.pointRuleLabel}</span>
          <span className="rounded-lg bg-amber-500/20 px-3 py-1 text-sm font-bold tabular-nums text-amber-200">可用技能点 {view.availablePoints}</span>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(280px,340px)]">
        <div className="glass rounded-2xl p-4">
          <div className="flex min-w-0 gap-4">
            {view.sections.map((section) => (
              <SkillTreeSection
                key={section.id}
                label={section.label}
                nodes={view.nodes.filter((node) => node.sectionId === section.id)}
                selectedId={selected.id}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        </div>
        <SkillDetailPanel
          node={selected}
          view={view}
          onLearn={(id) => learnSkill(charId, id)}
          onUpgrade={(id) => upgradeSkillRank(charId, id)}
        />
      </div>
    </div>
  )
}
