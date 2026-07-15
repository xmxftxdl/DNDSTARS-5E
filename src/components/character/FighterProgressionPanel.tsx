import { Check, Shield, Sparkles, Swords, Wind } from 'lucide-react'
import {
  FIGHTER_FIGHTING_STYLE_OPTIONS,
  FIGHTER_MANEUVER_OPTIONS,
  FIGHTER_RESOURCE_KEYS,
  FIGHTER_SUBCLASS_OPTIONS,
  fighterActionSurgeUses,
  fighterAttacksPerAttackAction,
  fighterFightingStyleName,
  fighterFightingStyleSelectionLimit,
  fighterIndomitableUses,
  fighterManeuverSaveDc,
  fighterManeuversKnown,
  fighterProgression,
  fighterResourceState,
  fighterSelectedFightingStyles,
  fighterSelectedManeuvers,
  fighterSubclassName,
  fighterSuperiorityDieSides,
  dnd5eArmorClass,
  dnd5eWeaponAttackProfile,
  type FighterFightingStyleId,
  type FighterManeuverId,
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
  const subclassOption = FIGHTER_SUBCLASS_OPTIONS.find((option) => option.id === subclass)
  const fightingStyles = fighterSelectedFightingStyles(character)
  const fightingStyleLimit = fighterFightingStyleSelectionLimit(character)
  const maneuvers = fighterSelectedManeuvers(character)
  const maneuverLimit = fighterManeuversKnown(character.level)
  const superiorityDice = fighterResourceState(character, FIGHTER_RESOURCE_KEYS.superiorityDice)
  const progression = fighterProgression(subclass)
  const weapon = dnd5eWeaponAttackProfile(character)
  const setFighterChoices = (patch: NonNullable<NonNullable<Character['dnd5eClassChoices']>['fighter']>) => {
    onChange({
      dnd5eClassChoices: {
        ...character.dnd5eClassChoices,
        fighter: { ...fighter, ...patch },
      },
    })
  }
  const setSubclass = (next: FighterSubclassId | undefined) => {
    const nextStyleLimit = next === 'champion' && character.level >= 10 ? 2 : 1
    setFighterChoices({
      subclass: next,
      fightingStyles: fightingStyles.slice(0, nextStyleLimit),
    })
  }
  const toggleFightingStyle = (style: FighterFightingStyleId) => {
    const selected = fightingStyles.includes(style)
    if (!selected && fightingStyles.length >= fightingStyleLimit) return
    setFighterChoices({ fightingStyles: selected ? fightingStyles.filter((item) => item !== style) : [...fightingStyles, style] })
  }
  const toggleManeuver = (maneuver: FighterManeuverId) => {
    const selected = maneuvers.includes(maneuver)
    if (!selected && maneuvers.length >= maneuverLimit) return
    setFighterChoices({ maneuvers: selected ? maneuvers.filter((item) => item !== maneuver) : [...maneuvers, maneuver] })
  }

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-arcane-300" />
            <h3 className="text-lg font-bold text-slate-100">战士职业特性</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">D&D 5e 2014／SRD 5.1 中文翻译 · 战士 {character.level} 级 · {fighterSubclassName(subclass)}</p>
        </div>

        <div className="xl:w-[260px]">
          <ChoiceSelect
            label="武术范型（3级）"
            value={subclass ?? ''}
            placeholder={character.level >= 3 ? '选择子职' : '3级解锁'}
            options={FIGHTER_SUBCLASS_OPTIONS}
            disabled={character.level < 3}
            onChange={(value) => setSubclass(value as FighterSubclassId || undefined)}
          />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-void-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-200">战斗风格</h4>
            <p className="mt-0.5 text-xs text-slate-500">普通战士选择 1 种；10级勇士可选择第 2 种，不能重复。</p>
          </div>
          <span className="rounded-full bg-arcane-500/10 px-2.5 py-1 text-xs font-semibold text-arcane-200">已选 {fightingStyles.length}/{fightingStyleLimit}</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {FIGHTER_FIGHTING_STYLE_OPTIONS.map((option) => (
            <SelectionCard
              key={option.id}
              name={option.name}
              summary={option.summary}
              selected={fightingStyles.includes(option.id)}
              disabled={!fightingStyles.includes(option.id) && fightingStyles.length >= fightingStyleLimit}
              onClick={() => toggleFightingStyle(option.id)}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Summary icon={Swords} label="每次攻击动作" value={`${fighterAttacksPerAttackAction(character.level)} 次攻击`} />
        <Summary icon={Wind} label="动作如潮" value={`${fighterActionSurgeUses(character.level)} 次／短休或长休`} />
        <Summary icon={Shield} label="不屈" value={`${fighterIndomitableUses(character.level)} 次／长休`} />
        <Summary icon={Sparkles} label="战斗风格" value={fightingStyles.map(fighterFightingStyleName).join('、') || '尚未选择'} />
      </div>

      {subclass === 'battle-master' && character.level >= 3 && (
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/5 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-amber-100">战斗大师战技</h4>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">3/7/10/15 级分别掌握 3/5/7/9 项战技；在 7、10、15 级学会新战技时可替换 1 项已知战技。每次攻击只能应用 1 项战技。已选 {maneuvers.length}/{maneuverLimit}。</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[420px]">
              <EquipmentLine label="卓越骰" value={`d${fighterSuperiorityDieSides(character.level)}`} detail={`${superiorityDice.current}/${superiorityDice.max} 枚 · 短休或长休恢复`} />
              <EquipmentLine label="战技豁免 DC" value={`${fighterManeuverSaveDc(character)}`} detail="8＋熟练＋所选属性" />
              <ChoiceSelect
                label="豁免计算属性"
                value={fighter.maneuverAbility ?? 'str'}
                placeholder="选择属性"
                options={[{ id: 'str', name: '力量' }, { id: 'dex', name: '敏捷' }]}
                onChange={(value) => setFighterChoices({ maneuverAbility: value === 'dex' ? 'dex' : 'str' })}
              />
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {FIGHTER_MANEUVER_OPTIONS.map((option) => (
              <SelectionCard
                key={option.id}
                name={option.name}
                summary={option.summary}
                selected={maneuvers.includes(option.id)}
                disabled={!maneuvers.includes(option.id) && maneuvers.length >= maneuverLimit}
                onClick={() => toggleManeuver(option.id)}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-amber-200/70">战斗大师不属于 SRD 5.1；这里是 2014 版机制摘要，不是 SRD 译文。战技在地图中的目标、反应、豁免与伤害结算仍需逐项接入 5e Headless。</p>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-white/10 bg-void-900/40 p-4">
        <h4 className="text-sm font-semibold text-slate-200">基础装备</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <EquipmentLine label="主武器" value={character.equipment?.mainWeapon?.name ?? '未装备'} detail={weapon ? `命中 +${weapon.attackModifier} · ${weapon.damage.count}d${weapon.damage.sides}${weapon.damage.bonus >= 0 ? '+' : ''}${weapon.damage.bonus}` : '无法攻击'} />
          <EquipmentLine label="副手" value={character.equipment?.offHand?.name ?? '未装备'} detail="盾牌提供 +2 护甲等级" />
          <EquipmentLine label="护甲" value={character.equipment?.armor?.name ?? '未装备'} detail={`当前护甲等级 ${dnd5eArmorClass(character)}`} />
        </div>
      </div>

      {subclass && (
        <div className="mt-4 rounded-xl border border-arcane-500/20 bg-arcane-500/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-arcane-300">{fighterSubclassName(subclass)}</span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">
              {subclassOption?.rulesTextSource === 'srd-5.1-translation' ? 'SRD 5.1 中文翻译' : '非 SRD 5.1 · 机制摘要'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{subclassOption?.summary}</p>
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

function SelectionCard({ name, summary, selected, disabled, onClick }: {
  name: string
  summary: string
  selected: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border p-3 text-left transition-colors ${selected ? 'border-arcane-400/50 bg-arcane-500/15' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.06]'} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-200">{name}</span>
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-arcane-300 bg-arcane-500 text-white' : 'border-slate-600'}`}>{selected && <Check className="h-3.5 w-3.5" />}</span>
      </span>
      <span className="mt-1 block text-xs leading-5 text-slate-500">{summary}</span>
    </button>
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

function EquipmentLine({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-200">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  )
}
