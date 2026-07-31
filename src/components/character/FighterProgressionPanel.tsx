import { useSyncExternalStore } from 'react'
import { Check, Shield, Sparkles, Swords, Wind } from 'lucide-react'
import {
  FIGHTER_FIGHTING_STYLE_OPTIONS,
  fighterActionSurgeUses,
  fighterAttacksPerAttackAction,
  fighterFightingStyleName,
  fighterFightingStyleSelectionLimit,
  fighterIndomitableUses,
  fighterProgression,
  fighterSelectedFightingStyles,
  fighterSelectedSubclassChoices,
  fighterSubclassChoiceKey,
  fighterSubclassChoiceLimit,
  fighterSubclassDefinition,
  fighterSubclassRegistrySnapshot,
  fighterSubclassName,
  registeredFighterSubclasses,
  subscribeFighterSubclassRegistry,
  dnd5eArmorClass,
  dnd5ePluginResourceDieSides,
  dnd5ePluginSubclassDefinition,
  dnd5eWeaponAttackProfile,
  registeredDnd5ePluginResources,
  type FighterFightingStyleId,
  type FighterSubclassId,
} from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'

interface FighterProgressionPanelProps {
  character: Character
  onChange: (patch: Partial<Character>) => void
  lockedChoiceKeys?: ReadonlySet<string>
}

export default function FighterProgressionPanel({
  character,
  onChange,
  lockedChoiceKeys = new Set<string>(),
}: FighterProgressionPanelProps) {
  useSyncExternalStore(subscribeFighterSubclassRegistry, fighterSubclassRegistrySnapshot, fighterSubclassRegistrySnapshot)
  const fighter = character.dnd5eClassChoices?.fighter ?? {}
  const subclass = fighter.subclass
  const subclassOptions = registeredFighterSubclasses()
  const subclassOption = fighterSubclassDefinition(subclass)
  const pluginSubclass = subclass ? dnd5ePluginSubclassDefinition(subclass) : undefined
  const pluginResourceDice = registeredDnd5ePluginResources()
    .filter((resource) => resource.subclassId === subclass && resource.declarativeDie)
  const fightingStyles = fighterSelectedFightingStyles(character)
  const fightingStyleLimit = fighterFightingStyleSelectionLimit(character)
  const progression = fighterProgression(subclass)
  const weapon = dnd5eWeaponAttackProfile(character)
  const subclassLocked = lockedChoiceKeys.has('fighter:subclass')
  const fightingStylesLocked = lockedChoiceKeys.has('fighter:fighting-styles')
  const setFighterChoices = (patch: NonNullable<NonNullable<Character['dnd5eClassChoices']>['fighter']>) => {
    onChange({
      dnd5eClassChoices: {
        ...character.dnd5eClassChoices,
        fighter: { ...fighter, ...patch },
      },
    })
  }
  const setSubclass = (next: FighterSubclassId | undefined) => {
    if (subclassLocked) return
    const nextCharacter: Character = {
      ...character,
      dnd5eClassChoices: {
        ...character.dnd5eClassChoices,
        fighter: { ...fighter, subclass: next },
      },
    }
    const nextStyleLimit = fighterFightingStyleSelectionLimit(nextCharacter)
    setFighterChoices({
      subclass: next,
      fightingStyles: fightingStyles.slice(0, nextStyleLimit),
    })
  }
  const toggleFightingStyle = (style: FighterFightingStyleId) => {
    if (fightingStylesLocked) return
    const selected = fightingStyles.includes(style)
    if (!selected && fightingStyles.length >= fightingStyleLimit) return
    setFighterChoices({ fightingStyles: selected ? fightingStyles.filter((item) => item !== style) : [...fightingStyles, style] })
  }
  const toggleSubclassChoice = (groupId: string, optionId: string) => {
    if (!subclassOption) return
    const group = subclassOption.choiceGroups?.find((candidate) => candidate.id === groupId)
    if (!group) return
    const selected = fighterSelectedSubclassChoices(character, subclassOption.id, group)
    const isSelected = selected.includes(optionId)
    const limit = fighterSubclassChoiceLimit(group, character)
    if (!isSelected && selected.length >= limit) return
    const key = fighterSubclassChoiceKey(subclassOption.id, group.id)
    if (lockedChoiceKeys.has(`fighter:subclass:${key}`)) return
    setFighterChoices({
      extensionChoices: {
        ...fighter.extensionChoices,
        [key]: isSelected ? selected.filter((item) => item !== optionId) : [...selected, optionId],
      },
    })
  }

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-arcane-300" />
            <h3 className="text-lg font-bold text-slate-100">战士职业特性</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">D&D 5e 2014 · 战士核心采用 SRD 5.1 中文翻译 · 战士 {character.level} 级 · {fighterSubclassName(subclass)}</p>
        </div>

        <div className="xl:w-[260px]">
          <ChoiceSelect
            label="武术范型（3级）"
            value={subclass ?? ''}
            placeholder={character.level >= 3 ? '选择子职' : '3级解锁'}
            options={subclassOptions}
            disabled={character.level < 3 || subclassLocked}
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
              disabled={fightingStylesLocked || (!fightingStyles.includes(option.id) && fightingStyles.length >= fightingStyleLimit)}
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

      {(pluginSubclass?.declarativeSpellcasting || pluginResourceDice.length > 0) && (
        <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/5 p-4">
          <h4 className="text-sm font-semibold text-violet-100">子职扩展协议</h4>
          {pluginSubclass?.declarativeSpellcasting && (() => {
            const spellcasting = pluginSubclass.declarativeSpellcasting
            const levelIndex = Math.max(0, Math.min(19, character.level - 1))
            return (
              <p className="mt-1 text-xs leading-5 text-slate-500">
                三分之一施法者 · {spellcasting.ability.toUpperCase()} 施法 ·
                当前已知 {spellcasting.cantripsKnownByClassLevel[levelIndex] ?? 0} 个戏法、
                {spellcasting.spellsKnownByClassLevel[levelIndex] ?? 0} 个法术 ·
                法术表：{spellcasting.spellListClassId}
              </p>
            )
          })()}
          {pluginResourceDice.length > 0 && (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              资源骰：{pluginResourceDice.map((resource) =>
                `${resource.label} d${dnd5ePluginResourceDieSides(resource, character) ?? '—'}`
              ).join('、')}
            </p>
          )}
          <p className="mt-2 text-[11px] text-amber-200/70">
            这里只显示已注册的纯数据协议；实际法术和战斗选项仍由房间目录与 Headless 再校验。
          </p>
        </div>
      )}

      {subclassOption?.choiceGroups?.filter((group) => character.level >= (group.minLevel ?? 1)).map((group) => {
        const selected = fighterSelectedSubclassChoices(character, subclassOption.id, group)
        const limit = fighterSubclassChoiceLimit(group, character)
        return (
          <div key={group.id} className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-amber-100">{group.name}</h4>
                {group.description && <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{group.description}</p>}
              </div>
              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-100">已选 {selected.length}/{limit}</span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {group.options.map((option) => (
                <SelectionCard
                  key={option.id}
                  name={option.name}
                  summary={option.summary}
                  selected={selected.includes(option.id)}
                  disabled={lockedChoiceKeys.has(`fighter:subclass:${fighterSubclassChoiceKey(subclassOption.id, group.id)}`) || (!selected.includes(option.id) && selected.length >= limit)}
                  onClick={() => toggleSubclassChoice(group.id, option.id)}
                />
              ))}
            </div>
          </div>
        )
      })}

      <div className="mt-4 rounded-xl border border-white/10 bg-void-900/40 p-4">
        <h4 className="text-sm font-semibold text-slate-200">基础装备</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <EquipmentLine label="主武器" value={character.equipment?.mainWeapon?.name ?? '未装备'} detail={weapon ? `命中 +${weapon.attackModifier} · ${weapon.damage.count}d${weapon.damage.sides}${weapon.damage.bonus >= 0 ? '+' : ''}${weapon.damage.bonus}` : '无法攻击'} />
          <EquipmentLine label="副手" value={character.equipment?.offHand?.name ?? '未装备'} detail="盾牌提供 +2 护甲等级" />
          <EquipmentLine label="护甲" value={character.equipment?.armor?.name ?? '未装备'} detail={`当前护甲等级 ${dnd5eArmorClass(character)}`} />
        </div>
      </div>

      {subclass && subclassOption && (
        <div className="mt-4 rounded-xl border border-arcane-500/20 bg-arcane-500/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-arcane-300">{fighterSubclassName(subclass)}</span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">
              {subclassOption.sourceLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{subclassOption.summary}</p>
          {subclassOption.ownerPluginId && <p className="mt-2 text-xs text-amber-200/70">该内容由本机插件 {subclassOption.ownerPluginId} 提供；平台核心包不包含其规则数据。</p>}
          {subclassOption.resources && subclassOption.resources.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {subclassOption.resources.filter((resource) => resource.isAvailable(character)).map((resource) => {
                const max = Math.max(0, resource.max(character))
                const current = Math.min(max, Math.max(0, character.classResources?.[resource.key]?.current ?? max))
                return <EquipmentLine key={resource.key} label={resource.label} value={`${current}/${max}`} detail={resource.resetOn === 'short-rest' ? '短休或长休恢复' : resource.resetOn === 'long-rest' ? '长休恢复' : '战斗重置'} />
              })}
            </div>
          )}
        </div>
      )}

      {subclass && !subclassOption && (
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
          此角色引用的第三方子职插件尚未安装。存档中的插件 ID 与选择数据已保留，但不会载入名称、规则或 Headless 效果。
        </div>
      )}

      <div className="mt-5">
        <h4 className="text-sm font-semibold text-slate-200">职业特性进度</h4>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {progression.map((entry) => {
            if (entry.features.length === 0) return null
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
