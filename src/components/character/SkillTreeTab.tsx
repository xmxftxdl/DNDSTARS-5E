import { useMemo, useState } from 'react'
import { Lock, ArrowUpCircle, GitBranch, Sparkles } from 'lucide-react'
import { useCharacterStore } from '../../store/characters'
import {
  ARCHER_SPEC_LEVEL,
  ARCHER_TREE_MAX_UNLOCK,
  MAX_SKILL_RANK,
  type ArcherSkillDef,
  type SkillTreeDisplaySection,
  buildSkillDescription,
  buildSkillTierDescription,
  canLearnSkill,
  canUpgradeSkillRank,
  getAvailableSkillPoints,
  getPrerequisiteLabel,
  getSkillClassRequirement,
  getSkillRank,
  isArcherLineClass,
  isBaseArcherClass,
  isIntraPanelPrerequisite,
  isSkillClassAllowed,
  isSkillLearned,
  meetsSkillPrerequisite,
  skillTreeDisplaySectionLabel,
  visibleSkillTreeDisplaySections,
  visibleSkillsByDisplaySection,
} from '../../lib/archerSkillTree'
import type { Character } from '../../types/character'

const CELL_W = 88
const CELL_H = 104
const NODE_CY = 36

function skillNodeState(c: Character, def: ArcherSkillDef) {
  const learned = isSkillLearned(c, def.id)
  const rank = getSkillRank(c, def.id)
  const levelOk = c.level >= def.unlockLevel
  const prereqOk = meetsSkillPrerequisite(c, def)
  const classOk = isSkillClassAllowed(c, def)
  const canLearn = canLearnSkill(c, def.id)
  const canUpgrade = canUpgradeSkillRank(c, def.id)
  return { learned, rank, levelOk, prereqOk, classOk, canLearn, canUpgrade }
}

function SkillNode({
  def,
  c,
  active,
  onSelect,
}: {
  def: ArcherSkillDef
  c: Character
  active: boolean
  onSelect: () => void
}) {
  const { learned, rank, levelOk, prereqOk, classOk } = skillNodeState(c, def)
  const faded = !learned && (!levelOk || !prereqOk || !classOk)

  return (
    <button
      type="button"
      onClick={onSelect}
      title={def.name}
      className={[
        'group relative z-10 flex w-full flex-col items-center gap-1 transition-all',
        faded ? 'opacity-70' : '',
      ].join(' ')}
    >
      <div
        className={[
          'relative flex h-[68px] w-[68px] z-10 items-center justify-center rounded-full border-[3px] text-2xl shadow-lg transition-all',
          'border-amber-700/70 bg-gradient-to-br from-void-800 to-void-950',
          active ? 'scale-105 ring-2 ring-amber-500/50' : 'group-hover:scale-[1.03]',
          learned ? 'border-amber-500/60' : 'border-slate-600/50',
        ].join(' ')}
      >
        <span className={learned ? '' : 'opacity-90'}>{def.emoji}</span>
        {!learned && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-void-950/35">
            <Lock className="h-4 w-4 text-slate-400" />
          </span>
        )}
        {learned && (
          <span className="absolute -bottom-1 rounded-md bg-void-950/90 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-200 ring-1 ring-amber-500/30">
            {rank}/{MAX_SKILL_RANK}
          </span>
        )}
      </div>
      <span className="relative z-10 line-clamp-2 w-full rounded bg-void-950/90 px-0.5 text-center text-[10px] font-medium leading-tight text-slate-300">
        {def.name}
      </span>
    </button>
  )
}

function PrerequisiteLines({ skills }: { skills: ArcherSkillDef[] }) {
  const byId = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills])

  const nodeCenter = (def: ArcherSkillDef) => ({
    x: def.treeColumn * CELL_W + CELL_W / 2,
    y: def.treeRow * CELL_H + NODE_CY,
  })

  return (
    <svg className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible">
      {skills.map((def) => {
        if (!def.prerequisite || !isIntraPanelPrerequisite(def)) return null
        const parent = byId.get(def.prerequisite.skillId)
        if (!parent) return null
        const p = nodeCenter(parent)
        const c = nodeCenter(def)
        const pBottom = p.y + 34
        const cTop = c.y - 34
        const midY = (pBottom + cTop) / 2
        const d =
          p.x === c.x
            ? `M ${p.x} ${pBottom} L ${c.x} ${cTop}`
            : `M ${p.x} ${pBottom} L ${p.x} ${midY} L ${c.x} ${midY} L ${c.x} ${cTop}`
        return (
          <path
            key={`${parent.id}-${def.id}`}
            d={d}
            fill="none"
            stroke="rgba(251, 191, 36, 0.55)"
            strokeWidth={2}
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}

function PanelSkillTree({
  section,
  skills,
  c,
  selectedId,
  onSelect,
}: {
  section: SkillTreeDisplaySection
  skills: ArcherSkillDef[]
  c: Character
  selectedId: string
  onSelect: (id: string) => void
}) {
  const bounds = useMemo(() => {
    let maxCol = 0
    let maxRow = 0
    for (const s of skills) {
      maxCol = Math.max(maxCol, s.treeColumn)
      maxRow = Math.max(maxRow, s.treeRow)
    }
    return { width: (maxCol + 1) * CELL_W, height: (maxRow + 1) * CELL_H + 12 }
  }, [skills])

  if (skills.length === 0) return null

  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-white/10 bg-void-950/40 p-3">
      <h3 className="mb-3 text-center text-sm font-semibold text-amber-200/90">
        {skillTreeDisplaySectionLabel(section)}
      </h3>
      <div>
        <div className="relative mx-auto" style={{ width: bounds.width, height: bounds.height }}>
          <PrerequisiteLines skills={skills} />
          {skills.map((def) => (
            <div
              key={def.id}
              className="absolute"
              style={{
                left: def.treeColumn * CELL_W,
                top: def.treeRow * CELL_H,
                width: CELL_W,
              }}
            >
              <SkillNode
                def={def}
                c={c}
                active={selectedId === def.id}
                onSelect={() => onSelect(def.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SkillDetailPanel({
  c,
  def,
  onLearn,
  onUpgrade,
}: {
  c: Character
  def: ArcherSkillDef
  onLearn: (skillId: string) => void
  onUpgrade: (skillId: string) => void
}) {
  const { learned, rank, levelOk, prereqOk, classOk, canLearn, canUpgrade } = skillNodeState(c, def)
  const tier = def.tiers[Math.max(0, rank - 1)] ?? def.tiers[0]
  const skillPoints = getAvailableSkillPoints(c)
  const prereqLabel = getPrerequisiteLabel(def)
  const specReq = getSkillClassRequirement(def)

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-void-900/50 p-5">
      <div className="flex items-start gap-4">
        <div
          className={[
            'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 text-3xl',
            learned ? 'border-amber-500/40 bg-amber-500/10' : 'border-white/10 bg-white/5',
          ].join(' ')}
        >
          {def.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-slate-100">{def.name}</h3>
          <p className="mt-1 text-sm text-slate-400">
            角色 {def.unlockLevel} 级可学
            {prereqLabel && ` · 前置：${prereqLabel}`}
            {specReq && ` · ${ARCHER_SPEC_LEVEL} 级后需「${specReq}」`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-slate-300">
              CD {def.cooldown === 0 ? '无' : `${def.cooldown} 回合`}
            </span>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-slate-300">
              {(tier.apCost ?? def.apCost) > 0 ? `${tier.apCost ?? def.apCost} AP` : '—'}
            </span>
            {learned && (
              <span className="rounded-md bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-200">
                {rank}/{MAX_SKILL_RANK} 级
              </span>
            )}
          </div>
        </div>
      </div>

      {!learned ? (
        <div className="mt-6 space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100/90">
          {!levelOk && <p>需要角色达到 {def.unlockLevel} 级</p>}
          {levelOk && !classOk && specReq && (
            <p>需要 {ARCHER_SPEC_LEVEL} 级后进阶为「{specReq}」方可学习</p>
          )}
          {levelOk && classOk && !prereqOk && prereqLabel && <p>需要先学习：{prereqLabel}</p>}
          {canLearn && (
            <button
              type="button"
              onClick={() => onLearn(def.id)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500/25 px-3 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/35"
            >
              <Sparkles className="h-4 w-4" />
              学习技能（消耗 1 技能点，剩余 {skillPoints} 点）
            </button>
          )}
          {!canLearn && levelOk && prereqOk && classOk && skillPoints <= 0 && (
            <p>技能点不足（每 5 级获得 2 点）</p>
          )}
        </div>
      ) : (
        <>
          <p className="mt-5 text-sm leading-relaxed text-slate-300">{buildSkillDescription(def, rank)}</p>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">各等级效果</p>
            <div className="space-y-1.5">
              {def.tiers.map((_, i) => {
                return (
                  <div
                    key={i}
                    className={[
                      'rounded-lg px-3 py-2 text-xs leading-relaxed',
                      i + 1 === rank
                        ? 'border border-amber-500/35 bg-amber-500/10 text-amber-100'
                        : 'bg-void-900/60 text-slate-400',
                    ].join(' ')}
                  >
                    <span className="font-semibold text-slate-300">{i + 1} 级</span>
                    <span className="mx-2 text-slate-600">—</span>
                    {buildSkillTierDescription(def, i + 1)}
                  </div>
                )
              })}
            </div>
          </div>

          {canUpgrade && (
            <button
              type="button"
              onClick={() => onUpgrade(def.id)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500/20 px-3 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/30"
            >
              <ArrowUpCircle className="h-4 w-4" />
              升级（消耗 1 技能点 → {rank + 1} 级，剩余 {skillPoints - 1} 点）
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default function SkillTreeTab({ charId }: { charId: string }) {
  const c = useCharacterStore((s) => s.characters.find((x) => x.id === charId))
  const learnSkill = useCharacterStore((s) => s.learnSkill)
  const upgradeSkillRank = useCharacterStore((s) => s.upgradeSkillRank)
  const [selectedId, setSelectedId] = useState<string>('multiShot')

  const bySection = c ? visibleSkillsByDisplaySection(c) : null
  const sections = useMemo(
    () => (c ? visibleSkillTreeDisplaySections(c) : []),
    [c],
  )
  const allVisible = useMemo(
    () => (bySection ? sections.flatMap((s) => bySection[s]) : []),
    [bySection, sections],
  )

  if (!c) return null

  if (!isArcherLineClass(c.charClass)) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-slate-400">
        技能树仅适用于弓手系职业（弓手 / 逐风者 / 影舞者）。
      </div>
    )
  }

  const selected = allVisible.find((s) => s.id === selectedId) ?? allVisible[0]
  const effectiveSelectedId = selected?.id ?? selectedId
  const skillPoints = getAvailableSkillPoints(c)
  const earned = Math.floor(c.level / 5) * 2

  if (!selected) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-slate-400">暂无可用技能。</div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <GitBranch className="h-4 w-4 text-amber-300" />
          <span>
            {c.charClass} · Lv.{c.level}
          </span>
          {isBaseArcherClass(c.charClass) && (
            <span className="text-slate-500">
              · 弓手技能至 {ARCHER_TREE_MAX_UNLOCK} 级 · {ARCHER_SPEC_LEVEL} 级后可进阶逐风者/影舞者
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">累计 {earned} 点 · 每 5 级 +2</span>
          <span className="rounded-lg bg-amber-500/20 px-3 py-1 text-sm font-bold tabular-nums text-amber-200">
            可用技能点 {skillPoints}
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(280px,340px)]">
        <div className="glass rounded-2xl p-4">
          <div className="flex min-w-0 gap-4">
            {sections.map((section) => (
              <PanelSkillTree
                key={section}
                section={section}
                skills={bySection?.[section] ?? []}
                c={c}
                selectedId={effectiveSelectedId}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        </div>

        <SkillDetailPanel
          c={c}
          def={selected}
          onLearn={(id) => learnSkill(charId, id)}
          onUpgrade={(id) => upgradeSkillRank(charId, id)}
        />
      </div>
    </div>
  )
}
