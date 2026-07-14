import { Shield, Sparkles, Swords, Wind } from 'lucide-react'
import {
  FIGHTER_FIGHTING_STYLE_OPTIONS,
  FIGHTER_SUBCLASS_OPTIONS,
  fighterActionSurgeUses,
  fighterAttacksPerAttackAction,
  fighterFightingStyleName,
  fighterIndomitableUses,
  fighterProgression,
  fighterSubclassName,
  type FighterFightingStyleId,
  type FighterSubclassId,
} from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'

interface FighterProgressionPanelProps {
  character: Character
  onChange: (patch: Partial<Character>) => void
}

export default function FighterProgressionPanel({ character, onChange }: FighterProgressionPanelProps) {
  const fighter = character.dnd5eClassChoices?.fighter ?? {}
  const subclass = fighter.subclass
  const fightingStyles = fighter.fightingStyles ?? []
  const progression = fighterProgression(subclass)
  const setFighterChoices = (patch: NonNullable<NonNullable<Character['dnd5eClassChoices']>['fighter']>) => {
    onChange({
      dnd5eClassChoices: {
        ...character.dnd5eClassChoices,
        fighter: { ...fighter, ...patch },
      },
    })
  }
  const setSubclass = (next: FighterSubclassId | undefined) => {
    setFighterChoices({
      subclass: next,
      fightingStyles: next === 'champion' ? fightingStyles : fightingStyles.slice(0, 1),
    })
  }
  const setPrimaryStyle = (next: FighterFightingStyleId | undefined) => {
    const secondary = fightingStyles[1]
    setFighterChoices({ fightingStyles: [next, secondary === next ? undefined : secondary].filter(Boolean) as FighterFightingStyleId[] })
  }
  const setSecondaryStyle = (next: FighterFightingStyleId | undefined) => {
    setFighterChoices({ fightingStyles: [fightingStyles[0], next].filter(Boolean) as FighterFightingStyleId[] })
  }

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-arcane-300" />
            <h3 className="text-lg font-bold text-slate-100">战士职业特性</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">D&D 5e 2014 · 战士 {character.level} 级 · {fighterSubclassName(subclass)}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:w-[520px]">
          <ChoiceSelect
            label="战斗风格（1级）"
            value={fightingStyles[0] ?? ''}
            placeholder="选择战斗风格"
            options={FIGHTER_FIGHTING_STYLE_OPTIONS}
            onChange={(value) => setPrimaryStyle(value as FighterFightingStyleId || undefined)}
          />
          <ChoiceSelect
            label="武术范型（3级）"
            value={subclass ?? ''}
            placeholder={character.level >= 3 ? '选择子职' : '3级解锁'}
            options={FIGHTER_SUBCLASS_OPTIONS}
            disabled={character.level < 3}
            onChange={(value) => setSubclass(value as FighterSubclassId || undefined)}
          />
          {subclass === 'champion' && character.level >= 10 && (
            <ChoiceSelect
              label="额外战斗风格（10级）"
              value={fightingStyles[1] ?? ''}
              placeholder="选择第二种风格"
              options={FIGHTER_FIGHTING_STYLE_OPTIONS.filter((option) => option.id !== fightingStyles[0])}
              onChange={(value) => setSecondaryStyle(value as FighterFightingStyleId || undefined)}
            />
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Summary icon={Swords} label="每次攻击动作" value={`${fighterAttacksPerAttackAction(character.level)} 次攻击`} />
        <Summary icon={Wind} label="动作如潮" value={`${fighterActionSurgeUses(character.level)} 次／休息`} />
        <Summary icon={Shield} label="不屈" value={`${fighterIndomitableUses(character.level)} 次／长休`} />
        <Summary icon={Sparkles} label="战斗风格" value={fighterFightingStyleName(fightingStyles[0])} />
      </div>

      {subclass && (
        <div className="mt-4 rounded-xl border border-arcane-500/20 bg-arcane-500/5 px-4 py-3">
          <span className="text-xs font-semibold text-arcane-300">{fighterSubclassName(subclass)}</span>
          <p className="mt-1 text-sm text-slate-400">{FIGHTER_SUBCLASS_OPTIONS.find((option) => option.id === subclass)?.summary}</p>
        </div>
      )}

      <div className="mt-5">
        <h4 className="text-sm font-semibold text-slate-200">1–20 级特性进度</h4>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {progression.map((entry) => {
            const unlocked = entry.level <= character.level
            const current = entry.level === character.level
            return (
              <div
                key={entry.level}
                className={`rounded-xl border p-3 ${current ? 'border-arcane-400/60 bg-arcane-500/10' : unlocked ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 bg-void-900/30 opacity-55'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-sm font-bold ${current ? 'text-arcane-200' : 'text-slate-300'}`}>{entry.level} 级</span>
                  <span className="text-[11px] text-slate-500">熟练加值 +{entry.proficiencyBonus}</span>
                </div>
                <div className="mt-2 space-y-2">
                  {entry.features.map((feature) => (
                    <div key={feature.id}>
                      <div className="text-sm font-semibold text-slate-200">{feature.name}</div>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ChoiceSelect({ label, value, placeholder, options, disabled = false, onChange }: {
  label: string
  value: string
  placeholder: string
  options: readonly { id: string; name: string }[]
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-white/10 bg-void-900/70 px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  )
}

function Summary({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-void-900/40 p-3">
      <div className="flex items-center gap-2 text-xs text-slate-500"><Icon className="h-4 w-4 text-arcane-300" />{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-200">{value}</div>
    </div>
  )
}
