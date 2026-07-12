import { useState } from 'react'
import { Shield, Zap, Footprints, Award, Dices, User, Swords, Sparkles, GitBranch, Backpack } from 'lucide-react'
import { useCharacterStore } from '../../store/characters'
import {
  ABILITIES,
  SKILLS,
  abilityMod,
  proficiencyBonus,
  formatMod,
  clampAbilityScore,
  MAX_ABILITY_SCORE,
} from '../../lib/dnd'
import type { AbilityKey } from '../../lib/dnd'
import HpPanel from './HpPanel'
import CombatTab from './CombatTab'
import EquipmentTab from './EquipmentTab'
import { getAc } from '../../lib/combatStats'
import FeaturesTab from './FeaturesTab'
import SkillTreeTab from './SkillTreeTab'
import {
  availableFeatureUpgradePoints,
  isArcherClass,
  pendingTraitChoices,
  stripArcherClassTraits,
} from '../../lib/classFeatures'
import { hasClassSkillTree } from '../../lib/classProgressionRegistry'
import {
  classesForLevel,
  isClassAllowedAtLevel,
  MAX_CHARACTER_LEVEL,
} from '../../lib/characterClasses'
import ClassSelect from './ClassSelect'

interface CharacterSheetProps {
  id: string
  /** DM 版可以编辑全部并看到 DM 专属字段 */
  isDM: boolean
}

function LabeledInput({
  label,
  value,
  editable,
  onChange,
  type = 'text',
}: {
  label: string
  value: string | number
  editable: boolean
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {editable ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border border-white/10 bg-void-900/60 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-arcane-500"
        />
      ) : (
        <span className="rounded-lg border border-transparent px-3 py-1.5 text-sm text-slate-200">{value}</span>
      )}
    </label>
  )
}

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="glass flex flex-col items-center rounded-xl px-2 py-3">
      <Icon className="h-4 w-4 text-arcane-300" />
      <span className="mt-1 text-xl font-bold text-slate-100">{value}</span>
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  )
}

type Tab = 'profile' | 'combat' | 'equipment' | 'features' | 'skilltree'

export default function CharacterSheet({ id, isDM }: CharacterSheetProps) {
  const [tab, setTab] = useState<Tab>('profile')
  const character = useCharacterStore((s) => s.characters.find((c) => c.id === id))
  const update = useCharacterStore((s) => s.update)

  if (!character) {
    return <p className="text-slate-400">未找到角色。</p>
  }

  const editable = true
  const c = character
  const prof = proficiencyBonus(c.level)
  const dexMod = abilityMod(c.abilities.dex)
  const initiative = dexMod + c.initiativeBonus

  const toggleSkill = (key: string) => {
    update(id, {
      skills: c.skills.includes(key) ? c.skills.filter((s) => s !== key) : [...c.skills, key],
    })
  }
  const toggleSave = (key: AbilityKey) => {
    update(id, {
      savingThrows: c.savingThrows.includes(key)
        ? c.savingThrows.filter((s) => s !== key)
        : [...c.savingThrows, key],
    })
  }

  const handleLevelChange = (value: string) => {
    const newLevel = Math.min(MAX_CHARACTER_LEVEL, Math.max(1, Number(value) || 1))
    const patch: { level: number; charClass?: string; featureUpgradePoints?: number } = {
      level: newLevel,
      featureUpgradePoints: availableFeatureUpgradePoints(c, newLevel),
    }
    if (!isClassAllowedAtLevel(c.charClass, newLevel, isDM)) {
      const fallback = classesForLevel(newLevel, isDM)[0]?.name
      if (fallback) patch.charClass = fallback
    }
    update(id, patch)
  }

  const handleClassChange = (charClass: string) => {
    if (!isClassAllowedAtLevel(charClass, c.level, isDM)) return
    const wasArcher = isArcherClass(c.charClass)
    const nowArcher = isArcherClass(charClass)

    if (wasArcher && !nowArcher) {
      update(id, {
        charClass,
        traits: stripArcherClassTraits(c.traits),
        traitChoicesDone: {},
        combatBuffs: {},
      })
      return
    }

    if (!wasArcher && nowArcher) {
      update(id, {
        charClass,
        traits: stripArcherClassTraits(c.traits),
        traitChoicesDone: {},
        combatBuffs: {},
      })
      return
    }

    update(id, { charClass })
  }

  return (
    <div className="space-y-5">
      {/* 头部 */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div
            className={`glow-arcane flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl ${c.accent}`}
          >
            {c.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <input
              value={c.name}
              onChange={(e) => update(id, { name: e.target.value })}
              className="w-full bg-transparent text-2xl font-bold text-slate-100 outline-none focus:ring-0"
            />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">种族</span>
                <input
                  value={c.race}
                  onChange={(e) => update(id, { race: e.target.value })}
                  className="rounded-lg border border-white/10 bg-void-900/60 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-arcane-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">职业</span>
                <ClassSelect
                  value={c.charClass}
                  level={c.level}
                  isDM={isDM}
                  onChange={handleClassChange}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">等级</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_CHARACTER_LEVEL}
                  value={c.level}
                  onChange={(e) => handleLevelChange(e.target.value)}
                  className="rounded-lg border border-white/10 bg-void-900/60 px-2 py-1.5 text-sm font-semibold text-arcane-200 outline-none focus:border-arcane-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">玩家</span>
                <input
                  value={c.player}
                  onChange={(e) => update(id, { player: e.target.value })}
                  placeholder="—"
                  className="rounded-lg border border-white/10 bg-void-900/60 px-2 py-1.5 text-sm text-slate-400 outline-none focus:border-arcane-500"
                />
              </label>
            </div>
            {pendingTraitChoices(c).length > 0 && (
              <p className="mt-2 text-xs text-amber-200/90">
                请前往「特性」页完成 {pendingTraitChoices(c)[0]?.title} 抉择
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 标签页切换 */}
      <div className="glass flex w-fit items-center rounded-xl p-1">
        <button
          onClick={() => setTab('profile')}
          className={[
            'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'profile' ? 'bg-arcane-500/25 text-arcane-100' : 'text-slate-400 hover:text-slate-200',
          ].join(' ')}
        >
          <User className="h-4 w-4" />
          角色
        </button>
        <button
          onClick={() => setTab('combat')}
          className={[
            'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'combat' ? 'bg-rose-500/25 text-rose-200' : 'text-slate-400 hover:text-slate-200',
          ].join(' ')}
        >
          <Swords className="h-4 w-4" />
          战斗
        </button>
        <button
          onClick={() => setTab('equipment')}
          className={[
            'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'equipment' ? 'bg-amber-500/25 text-amber-200' : 'text-slate-400 hover:text-slate-200',
          ].join(' ')}
        >
          <Backpack className="h-4 w-4" />
          装备
        </button>
        <button
          onClick={() => setTab('features')}
          className={[
            'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'features' ? 'bg-emerald-500/25 text-emerald-200' : 'text-slate-400 hover:text-slate-200',
          ].join(' ')}
        >
          <Sparkles className="h-4 w-4" />
          特性
        </button>
        {hasClassSkillTree(c) && (
          <button
            onClick={() => setTab('skilltree')}
            className={[
              'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              tab === 'skilltree' ? 'bg-sky-500/25 text-sky-200' : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            <GitBranch className="h-4 w-4" />
            技能树
          </button>
        )}
      </div>

      {tab === 'combat' && <CombatTab charId={id} />}
      {tab === 'equipment' && <EquipmentTab charId={id} editable={editable} />}
      {tab === 'features' && <FeaturesTab charId={id} isDM={isDM} />}
      {tab === 'skilltree' && <SkillTreeTab charId={id} />}

      {tab === 'profile' && (
        <>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_280px]">
            {/* 左栏：HP + 基础属性（含技能） */}
            <div className="space-y-5">
              <HpPanel
                current={c.currentHp}
                max={c.maxHp}
                temp={c.tempHp}
                editable={editable}
                onChange={(patch) => update(id, patch)}
              />

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                <StatChip icon={Shield} label="护甲 AC" value={String(getAc(c))} />
                <StatChip icon={Zap} label="先攻" value={formatMod(initiative)} />
                <StatChip icon={Footprints} label="速度" value={`${c.speed}`} />
                <StatChip icon={Award} label="熟练加值" value={formatMod(prof)} />
                <StatChip icon={Dices} label="生命骰" value={c.hitDice} />
              </div>

              {editable && (
                <div className="glass grid grid-cols-2 gap-3 rounded-2xl p-4 sm:grid-cols-3">
                  <LabeledInput label="速度" type="number" value={c.speed} editable onChange={(v) => update(id, { speed: Number(v) || 0 })} />
                  <LabeledInput label="生命骰" value={c.hitDice} editable onChange={(v) => update(id, { hitDice: v })} />
                </div>
              )}

              {/* 基础属性 + 按属性分组的技能（参考桌面工具排版） */}
              <div className="glass rounded-2xl p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">基础属性</p>
                <div className="space-y-0 divide-y divide-white/5">
                  {ABILITIES.map((a) => {
                    const score = c.abilities[a.key]
                    const mod = abilityMod(score)
                    const saveProf = c.savingThrows.includes(a.key)
                    const saveBonus = mod + (saveProf ? prof : 0)
                    const abilitySkills = SKILLS.filter((s) => s.ability === a.key)
                    return (
                      <div key={a.key} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
                        {/* 属性行：名称 / 数值 / 调整 / 豁免熟练 */}
                        <div className="flex shrink-0 items-center gap-2 sm:w-44">
                          <span className="w-8 text-sm font-semibold text-slate-200">{a.label}</span>
                          <input
                            type="number"
                            min={1}
                            max={MAX_ABILITY_SCORE}
                            value={score}
                            onChange={(e) =>
                              update(id, {
                                abilities: { ...c.abilities, [a.key]: clampAbilityScore(Number(e.target.value) || 1) },
                              })
                            }
                            className="w-12 rounded-md border border-white/10 bg-void-900/60 px-1 py-1 text-center text-sm font-semibold text-slate-200 outline-none focus:border-arcane-500"
                          />
                          <span className="w-8 text-center text-sm font-bold text-arcane-200">{formatMod(mod)}</span>
                          <button
                            type="button"
                            onClick={() => toggleSave(a.key)}
                            title="豁免熟练"
                            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-white/5"
                          >
                            <span
                              className={[
                                'h-3 w-3 shrink-0 rounded-full border',
                                saveProf ? 'border-arcane-400 bg-arcane-500' : 'border-slate-600',
                              ].join(' ')}
                            />
                            豁免{formatMod(saveBonus)}
                          </button>
                        </div>
                        {/* 该属性下的技能（2 列网格） */}
                        {abilitySkills.length > 0 && (
                          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
                            {abilitySkills.map((skill) => {
                              const proficient = c.skills.includes(skill.key)
                              const bonus = abilityMod(c.abilities[skill.ability]) + (proficient ? prof : 0)
                              return (
                                <button
                                  key={skill.key}
                                  type="button"
                                  onClick={() => toggleSkill(skill.key)}
                                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-white/5"
                                >
                                  <span
                                    className={[
                                      'h-2.5 w-2.5 shrink-0 rounded-full border',
                                      proficient ? 'border-arcane-400 bg-arcane-500' : 'border-slate-600',
                                    ].join(' ')}
                                  />
                                  <span className="min-w-0 flex-1 truncate text-slate-300">{skill.label}</span>
                                  <span className="shrink-0 font-semibold text-arcane-200">{formatMod(bonus)}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className="mt-3 text-[11px] text-slate-500">属性上限 50 · 25 = +0 · 每低 5 点 -1 · 点击圆点切换技能熟练</p>
              </div>
            </div>

            {/* 右栏：角色属性 */}
            <div className="space-y-5">
              <div className="glass space-y-3 rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">角色属性</p>
                <LabeledInput label="角色名称" value={c.name} editable={editable} onChange={(v) => update(id, { name: v })} />
                <LabeledInput label="种族" value={c.race} editable={editable} onChange={(v) => update(id, { race: v })} />
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">职业</span>
                  {editable ? (
                    <ClassSelect
                      value={c.charClass}
                      level={c.level}
                      isDM={isDM}
                      onChange={handleClassChange}
                      className="rounded-lg border border-white/10 bg-void-900/60 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-arcane-500"
                    />
                  ) : (
                    <span className="rounded-lg border border-transparent px-3 py-1.5 text-sm text-slate-200">
                      {c.charClass}
                    </span>
                  )}
                </label>
                <LabeledInput
                  label="等级"
                  type="number"
                  value={c.level}
                  editable={editable}
                  onChange={handleLevelChange}
                />
                <LabeledInput
                  label="经验值"
                  type="number"
                  value={c.experience}
                  editable={editable}
                  onChange={(v) => update(id, { experience: Math.max(0, Number(v) || 0) })}
                />
                <LabeledInput
                  label="声望"
                  type="number"
                  value={c.reputation}
                  editable={editable}
                  onChange={(v) => update(id, { reputation: Number(v) || 0 })}
                />
                <LabeledInput label="背景" value={c.background} editable={editable} onChange={(v) => update(id, { background: v })} />
                <LabeledInput label="玩家" value={c.player} editable={editable} onChange={(v) => update(id, { player: v })} />
              </div>

              <div className="glass rounded-2xl p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">角色背景</p>
                <textarea
                  value={c.notes}
                  onChange={(e) => update(id, { notes: e.target.value })}
                  rows={6}
                  placeholder="背景故事、装备、目标……"
                  className="w-full resize-none rounded-lg border border-white/10 bg-void-900/60 p-3 text-sm text-slate-200 outline-none focus:border-arcane-500"
                />
              </div>

              {isDM && (
                <div className="glass rounded-2xl border-amber-500/20 p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
                    DM 专属笔记（玩家不可见）
                  </p>
                  <textarea
                    value={c.dmNotes}
                    onChange={(e) => update(id, { dmNotes: e.target.value })}
                    rows={4}
                    placeholder="剧情钩子、隐藏信息、秘密……"
                    className="w-full resize-none rounded-lg border border-amber-500/20 bg-void-900/60 p-3 text-sm text-amber-100/90 outline-none focus:border-amber-500"
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
