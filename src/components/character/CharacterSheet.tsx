import { useEffect, useMemo } from 'react'
import { Award, Dices, Footprints, HeartPulse, Shield, Sparkles, Swords } from 'lucide-react'
import { useCharacterStore } from '../../store/characters'
import { ABILITIES, SKILLS, formatMod, type AbilityKey, type SkillDef } from '../../lib/dnd'
import { dnd5e2014Adapter as rules } from '../../rulesets/dnd5e'
import { normalizeLegacyAbilities } from '../../rulesets/dnd5e/character'
import HpPanel from './HpPanel'

interface CharacterSheetProps {
  id: string
  isDM: boolean
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.floor(value)))
}

export default function CharacterSheet({ id, isDM }: CharacterSheetProps) {
  const character = useCharacterStore((state) => state.characters.find((item) => item.id === id))
  const update = useCharacterStore((state) => state.update)
  const hitDice = useMemo(() => {
    if (!character) return []
    if (character.hitPointDice?.length) return character.hitPointDice
    const sides = Number(character.hitDice.match(/d(\d+)/i)?.[1] ?? 8)
    return [{ sides, current: character.level, max: character.level }]
  }, [character])

  useEffect(() => {
    if (!character || character.rulesetId === 'dnd5e-2014-srd-5.1') return
    const level = clamp(character.level, 1, 20)
    const sides = Number(character.hitDice.match(/d(\d+)/i)?.[1] ?? 8)
    update(character.id, {
      rulesetId: 'dnd5e-2014-srd-5.1',
      level,
      abilities: character.rulesetId ? character.abilities : normalizeLegacyAbilities(character.abilities),
      hitPointDice: character.hitPointDice?.length
        ? character.hitPointDice
        : [{ sides, current: level, max: level }],
      deathSaveSuccesses: character.deathSaveSuccesses ?? 0,
      deathSaveFailures: character.deathSaveFailures ?? 0,
      deathSaveStable: character.deathSaveStable ?? false,
      concentrating: character.concentrating ?? false,
      inspiration: character.inspiration > 0 || character.heroicInspiration ? 1 : 0,
      heroicInspiration: false,
      exhaustionLevel: character.exhaustionLevel ?? 0,
    })
  }, [character, update])

  if (!character) return <p className="text-slate-400">未找到角色。</p>
  const c = character
  const proficiency = rules.proficiencyBonus(clamp(c.level, 1, 20))
  const initiative = rules.abilityModifier(clamp(c.abilities.dex, 1, 30)) + c.initiativeBonus
  const perceptionProficient = c.skills.includes('perception')
  const passivePerception = 10 + rules.abilityModifier(clamp(c.abilities.wis, 1, 30)) + (perceptionProficient ? proficiency : 0)

  const toggleSavingThrow = (key: AbilityKey) => {
    update(id, {
      savingThrows: c.savingThrows.includes(key)
        ? c.savingThrows.filter((item) => item !== key)
        : [...c.savingThrows, key],
    })
  }
  const toggleSkill = (key: string) => {
    update(id, {
      skills: c.skills.includes(key)
        ? c.skills.filter((item) => item !== key)
        : [...c.skills, key],
    })
  }

  return (
    <div className="space-y-5">
      <section className="glass rounded-2xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl ${c.accent}`}>
            {c.avatar}
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="角色名称" value={c.name} onChange={(value) => update(id, { name: value })} className="col-span-2" />
            <Field label="职业" value={c.charClass} onChange={(value) => update(id, { charClass: value })} />
            <NumberField label="等级" value={c.level} min={1} max={20} onChange={(value) => update(id, { level: value })} />
            <Field label="种族" value={c.race} onChange={(value) => update(id, { race: value })} />
            <Field label="背景" value={c.background} onChange={(value) => update(id, { background: value })} />
            <Field label="玩家" value={c.player} onChange={(value) => update(id, { player: value })} />
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-wider text-slate-500">激励</span>
              <button
                type="button"
                onClick={() => update(id, { inspiration: c.inspiration > 0 ? 0 : 1 })}
                className={`rounded-lg border px-3 py-1.5 text-sm ${c.inspiration > 0 ? 'border-amber-400/50 bg-amber-500/20 text-amber-100' : 'border-white/10 bg-void-900/60 text-slate-400'}`}
              >
                {c.inspiration > 0 ? '已有激励' : '没有激励'}
              </button>
            </label>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat icon={Shield} label="护甲等级" value={`${c.ac}`} />
        <Stat icon={Footprints} label="速度" value={`${c.speed} 尺`} />
        <Stat icon={Swords} label="先攻" value={formatMod(initiative)} />
        <Stat icon={Award} label="熟练加值" value={formatMod(proficiency)} />
        <Stat icon={Sparkles} label="被动察觉" value={`${passivePerception}`} />
        <Stat icon={Dices} label="规则版本" value="5e 2014" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="glass rounded-2xl p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-200">属性、豁免与技能</h3>
            <p className="mt-1 text-xs text-slate-500">技能依照 D&D 5e 2014 人物卡归入其默认关联属性。</p>
          </div>
          <div className="space-y-3">
            {ABILITIES.map((ability) => (
              <AbilitySection
                key={ability.key}
                abilityKey={ability.key}
                label={ability.label}
                score={clamp(c.abilities[ability.key], 1, 30)}
                skills={SKILLS.filter((skill) => skill.ability === ability.key)}
                proficiency={proficiency}
                savingThrowProficient={c.savingThrows.includes(ability.key)}
                skillProficiencies={c.skills}
                onScoreChange={(score) => update(id, { abilities: { ...c.abilities, [ability.key]: score } })}
                onToggleSavingThrow={() => toggleSavingThrow(ability.key)}
                onToggleSkill={toggleSkill}
              />
            ))}
          </div>
        </section>

        <div className="space-y-5">
          <HpPanel current={c.currentHp} max={c.maxHp} temp={c.tempHp} editable onChange={(patch) => update(id, patch)} />

          <section className="glass rounded-2xl p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <HeartPulse className="h-4 w-4 text-rose-300" />死亡豁免与专注
            </h3>
            <div className="space-y-3">
              <Counter label="成功" value={c.deathSaveSuccesses ?? 0} max={3} tone="emerald" onChange={(value) => update(id, { deathSaveSuccesses: value, deathSaveStable: value >= 3 })} />
              <Counter label="失败" value={c.deathSaveFailures ?? 0} max={3} tone="rose" onChange={(value) => update(id, { deathSaveFailures: value })} />
              <div className="grid grid-cols-2 gap-2">
                <Toggle label="伤势稳定" active={!!c.deathSaveStable} onClick={() => update(id, { deathSaveStable: !c.deathSaveStable })} />
                <Toggle label="保持专注" active={!!c.concentrating} onClick={() => update(id, { concentrating: !c.concentrating })} />
              </div>
            </div>
          </section>

          <section className="glass rounded-2xl p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">生命骰</h3>
            <div className="space-y-2">
              {hitDice.map((pool, index) => (
                <div key={`${pool.sides}-${index}`} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                  <span className="font-bold text-arcane-200">d{pool.sides}</span>
                  <input
                    type="number"
                    min={0}
                    max={pool.max}
                    value={pool.current}
                    aria-label={`剩余 d${pool.sides} 生命骰`}
                    onChange={(event) => {
                      const next = hitDice.map((item, itemIndex) => itemIndex === index
                        ? { ...item, current: clamp(Number(event.target.value) || 0, 0, item.max) }
                        : item)
                      update(id, { hitPointDice: next })
                    }}
                    className="w-14 rounded border border-white/10 bg-void-950/70 px-1 py-1 text-center text-sm"
                  />
                  <span className="text-sm text-slate-500">/ {pool.max} 枚</span>
                </div>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">状态</h3>
            <input
              value={c.conditions.join('、')}
              onChange={(event) => update(id, { conditions: event.target.value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean) })}
              placeholder="例如：倒地、擒抱、中毒"
              className="w-full rounded-lg border border-white/10 bg-void-900/60 px-3 py-2 text-sm text-slate-200"
            />
          </section>

          <section className="glass rounded-2xl p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">角色笔记</h3>
            <textarea value={c.notes} onChange={(event) => update(id, { notes: event.target.value })} rows={5} className="w-full resize-none rounded-lg border border-white/10 bg-void-900/60 p-3 text-sm text-slate-200" />
            {isDM && (
              <textarea
                value={c.dmNotes}
                onChange={(event) => update(id, { dmNotes: event.target.value })}
                rows={3}
                placeholder="仅 DM 可见的笔记"
                className="mt-3 w-full resize-none rounded-lg border border-amber-500/20 bg-void-900/60 p-3 text-sm text-amber-100"
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function AbilitySection({
  abilityKey,
  label,
  score,
  skills,
  proficiency,
  savingThrowProficient,
  skillProficiencies,
  onScoreChange,
  onToggleSavingThrow,
  onToggleSkill,
}: {
  abilityKey: AbilityKey
  label: string
  score: number
  skills: SkillDef[]
  proficiency: number
  savingThrowProficient: boolean
  skillProficiencies: string[]
  onScoreChange: (score: number) => void
  onToggleSavingThrow: () => void
  onToggleSkill: (key: string) => void
}) {
  const modifier = rules.abilityModifier(score)
  const saveBonus = modifier + (savingThrowProficient ? proficiency : 0)
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-void-900/40">
      <div className="grid gap-3 p-3 sm:grid-cols-[180px_1fr]">
        <div className="flex items-center gap-2 sm:border-r sm:border-white/10 sm:pr-3">
          <div className="min-w-0 flex-1">
            <div className="whitespace-nowrap text-base font-bold text-slate-100">{label}</div>
            <div className="text-[11px] text-slate-500">{abilityKey.toUpperCase()}</div>
          </div>
          <input
            type="number"
            min={1}
            max={30}
            value={score}
            aria-label={`${label}属性值`}
            onChange={(event) => onScoreChange(clamp(Number(event.target.value) || 1, 1, 30))}
            className="w-14 rounded-md border border-white/10 bg-void-950/70 px-1 py-1 text-center text-sm text-slate-100"
          />
          <span className="w-10 text-right text-xl font-bold text-arcane-200">{formatMod(modifier)}</span>
        </div>
        <div className="min-w-0">
          <button type="button" onClick={onToggleSavingThrow} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5">
            <Dot active={savingThrowProficient} />
            <span className="min-w-0 flex-1 text-slate-300">{label}豁免</span>
            <span className="font-semibold text-arcane-200">{formatMod(saveBonus)}</span>
          </button>
          <div className="mt-1 border-t border-white/8 pt-1">
            {skills.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-slate-500">体质没有默认关联技能</p>
            ) : skills.map((skill) => {
              const proficient = skillProficiencies.includes(skill.key)
              const bonus = modifier + (proficient ? proficiency : 0)
              return (
                <button key={skill.key} type="button" onClick={() => onToggleSkill(skill.key)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5">
                  <Dot active={proficient} />
                  <span className="min-w-0 flex-1 text-slate-300">{skill.label}</span>
                  <span className="font-semibold text-arcane-200">{formatMod(bonus)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Dot({ active }: { active: boolean }) {
  return <span className={`h-3 w-3 shrink-0 rounded-full border ${active ? 'border-arcane-300 bg-arcane-500' : 'border-slate-600'}`} />
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return <div className="glass flex flex-col items-center rounded-xl px-2 py-3"><Icon className="h-4 w-4 text-arcane-300" /><strong className="mt-1 text-xl text-slate-100">{value}</strong><span className="text-center text-[11px] text-slate-500">{label}</span></div>
}

function Field({ label, value, onChange, className = '' }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return <label className={`flex flex-col gap-1 ${className}`}><span className="text-xs font-semibold tracking-wider text-slate-500">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-white/10 bg-void-900/60 px-3 py-1.5 text-sm text-slate-200" /></label>
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="flex flex-col gap-1"><span className="text-xs font-semibold tracking-wider text-slate-500">{label}</span><input type="number" value={value} min={min} max={max} onChange={(event) => onChange(clamp(Number(event.target.value) || min, min, max))} className="rounded-lg border border-white/10 bg-void-900/60 px-3 py-1.5 text-sm text-slate-200" /></label>
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-lg border px-3 py-2 text-sm ${active ? 'border-arcane-400/50 bg-arcane-500/20 text-arcane-100' : 'border-white/10 bg-white/5 text-slate-400'}`}>{label}：{active ? '是' : '否'}</button>
}

function Counter({ label, value, max, tone, onChange }: { label: string; value: number; max: number; tone: 'emerald' | 'rose'; onChange: (value: number) => void }) {
  return <div className="flex items-center justify-between"><span className="text-sm text-slate-300">{label}</span><div className="flex gap-2">{Array.from({ length: max }, (_, index) => <button key={index} type="button" aria-label={`${label} ${index + 1}`} onClick={() => onChange(value === index + 1 ? index : index + 1)} className={`h-5 w-5 rounded-full border ${index < value ? tone === 'emerald' ? 'border-emerald-300 bg-emerald-500' : 'border-rose-300 bg-rose-500' : 'border-slate-600'}`} />)}</div></div>
}
