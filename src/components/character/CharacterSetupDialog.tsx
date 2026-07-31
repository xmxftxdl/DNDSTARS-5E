import { useMemo, useState, useSyncExternalStore } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Backpack,
  Check,
  Dices,
  RotateCcw,
  Shield,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react'
import { ABILITIES, SKILLS, type AbilityKey } from '../../lib/dnd'
import {
  DND5E_2014_ALIGNMENT_OPTIONS,
  DND5E_2014_BACKGROUND_OPTIONS,
  DND5E_2014_CLASS_OPTIONS,
  DND5E_2014_RACE_OPTIONS,
} from '../../rulesets/dnd5e/characterOptions'
import {
  applyDnd5eRacialAbilityBonuses,
  DND5E_CORE_POINT_BUY_RULE,
  DND5E_STANDARD_ARRAY,
  dnd5eFlexibleRacialAbilityBonus,
  dnd5ePointBuyCostForRule,
  dnd5ePointBuyRemainingForRule,
  dnd5eRacialAbilityBonuses,
  recommendedDnd5eBaseAbilitiesFromArray,
  recommendedDnd5eRacialBonusChoices,
  rollDnd5eAbilityScore,
  type Dnd5eAbilityRoll,
  type Dnd5eAbilityGenerationMethod,
} from '../../rulesets/dnd5e/characterSetup'
import {
  dnd5eClassChoiceLimit,
  dnd5eClassDefinition,
  type Dnd5eClassChoiceOption,
} from '../../rulesets/dnd5e/classes'
import {
  FIGHTER_FIGHTING_STYLE_OPTIONS,
  type FighterFightingStyleId,
} from '../../rulesets/dnd5e/fighter'
import {
  defaultDnd5eStartingEquipmentSelection,
  dnd5eStartingEquipmentPickerItems,
  dnd5eStartingEquipmentPickerKey,
  dnd5eStartingEquipmentPlan,
  dnd5eStartingEquipmentSummary,
  normalizeDnd5eStartingEquipmentSelection,
  type Dnd5eStartingEquipmentPlan,
  type Dnd5eStartingEquipmentSelection,
} from '../../rulesets/dnd5e/startingEquipment'
import { dnd5eInventoryItemTemplate } from '../../rulesets/dnd5e/items'
import {
  dnd5ePluginBackgroundDefinition,
  dnd5ePluginRaceDefinition,
  dnd5ePluginSubclassChoiceLimit,
  dnd5eRulesPluginRegistrySnapshot,
  registeredDnd5ePluginBackgrounds,
  registeredDnd5ePluginFeats,
  registeredDnd5ePluginRaces,
  registeredDnd5ePluginSubclasses,
  subscribeDnd5eRulesPluginRegistry,
} from '../../rulesets/dnd5e/pluginApi'
import { dnd5eCoreRaceMechanics } from '../../rulesets/dnd5e/coreRaceMechanics'
import {
  DND5E_DRAGONBORN_ANCESTRIES,
  type Dnd5eDragonbornAncestryId,
} from '../../rulesets/dnd5e/racialAutomation'
import type {
  Abilities,
  Character,
  Dnd5eAdvancementSpellSelectionsV1,
} from '../../types/character'
import {
  buildDnd5eSpellAdvancementPlanFromSelections,
  dnd5eSpellAdvancementSelectionsComplete,
} from '../../rulesets/dnd5e/spellAdvancement'
import Dnd5eSpellAdvancementPicker from './Dnd5eSpellAdvancementPicker'

type SetupStage =
  | 'class'
  | 'ability-method'
  | 'abilities'
  | 'identity'
  | 'level-one'
  | 'equipment'
  | 'review'

interface SetupIdentity {
  charClass: string
  race: string
  alignment: string
  background: string
}

export interface CharacterSetupResult extends SetupIdentity {
  name: string
  targetLevel: number
  method: Dnd5eAbilityGenerationMethod
  baseAbilities: Abilities
  racialBonuses: Abilities
  abilities: Abilities
  dnd5eRaceId?: string
  dnd5eBackgroundId?: string
  backgroundSkillProficiencies?: string[]
  classSkillProficiencies: string[]
  racialSkillProficiencies?: string[]
  racialFeatIds?: string[]
  dragonbornAncestry?: Dnd5eDragonbornAncestryId
  racialBonusChoices: AbilityKey[]
  startingEquipment: Dnd5eStartingEquipmentSelection
  initialClassChoices?: Character['dnd5eClassChoices']
  rolls?: Array<Dnd5eAbilityRoll & { ability: AbilityKey }>
}

interface CharacterSetupDialogProps {
  onCancel(): void
  onComplete(result: CharacterSetupResult): void
}

interface InitialChoiceGroup {
  id: string
  name: string
  description?: string
  limit: number
  options: readonly Dnd5eClassChoiceOption[]
}

const METHOD_OPTIONS: Array<{
  id: Exclude<Dnd5eAbilityGenerationMethod, 'beginner-recommended'>
  name: string
  summary: string
  kind: 'standard-array' | 'point-buy' | 'roll'
}> = [
  {
    id: 'standard-array',
    name: '标准数组',
    summary: '将 15、14、13、12、10、8 各分配一次，稳定且快速。',
    kind: 'standard-array',
  },
  {
    id: 'point-buy',
    name: '27 点购点',
    summary: '六项从 8 开始，按 2014 购点成本提升，种族调整最后加入。',
    kind: 'point-buy',
  },
  {
    id: 'roll-4d6',
    name: '4d6 去最低值',
    summary: '每次投四枚 d6，去掉一枚最低值，再选择填入一项尚未分配的属性。',
    kind: 'roll',
  },
]

const ABILITY_KEYS = ABILITIES.map((ability) => ability.key)

function emptyAbilities(value = 0): Abilities {
  return { str: value, dex: value, con: value, int: value, wis: value, cha: value }
}

function sameScoreMultiset(abilities: Abilities, scores: readonly number[]): boolean {
  return [...ABILITY_KEYS.map((ability) => abilities[ability])].sort((left, right) => left - right).join(',') ===
    [...scores].sort((left, right) => left - right).join(',')
}

function coreBackgroundSkills(background: string): string[] {
  return background === '侍僧' ? ['insight', 'religion'] : []
}

function optionSkillName(skillId: string): string {
  return SKILLS.find((skill) => skill.key === skillId)?.label ?? skillId
}

function ClassFields({
  name,
  charClass,
  onNameChange,
  onClassChange,
}: {
  name: string
  charClass: string
  onNameChange(value: string): void
  onClassChange(value: string): void
}) {
  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">角色名称</span>
        <input
          autoFocus
          aria-label="角色名称"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-void-900/80 px-4 py-3 text-sm text-slate-100 outline-none focus:border-arcane-400/50"
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">起始职业</span>
        <select
          aria-label="起始职业"
          value={charClass}
          onChange={(event) => onClassChange(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-void-900/80 px-4 py-3 text-sm text-slate-100 outline-none focus:border-arcane-400/50"
        >
          {DND5E_2014_CLASS_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <div className="rounded-2xl border border-violet-300/15 bg-violet-500/[0.05] p-4 text-xs leading-5 text-slate-400">
        起始职业决定 1 级生命骰、豁免熟练、装备和职业技能。若创建高等级角色，后续每一级都会单独处理，
        并可在满足属性前提时选择兼职。
      </div>
    </div>
  )
}

function IdentityFields({
  identity,
  targetLevel,
  raceOptions,
  backgroundOptions,
  onChange,
  onTargetLevelChange,
}: {
  identity: SetupIdentity
  targetLevel: number
  raceOptions: readonly { value: string; label: string }[]
  backgroundOptions: readonly { value: string; label: string }[]
  onChange(patch: Partial<SetupIdentity>): void
  onTargetLevelChange(level: number): void
}) {
  const fields = [
    ['种族', 'race', raceOptions],
    ['背景', 'background', backgroundOptions],
    ['阵营', 'alignment', DND5E_2014_ALIGNMENT_OPTIONS.map((value) => ({ value, label: value }))],
  ] as const
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([label, key, options]) => (
          <label key={key} className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
            <select
              aria-label={label}
              value={identity[key]}
              onChange={(event) => onChange({ [key]: event.target.value })}
              className="w-full rounded-xl border border-white/10 bg-void-900/80 px-4 py-3 text-sm text-slate-100 outline-none focus:border-arcane-400/50"
            >
              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        ))}
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">起始等级</span>
          <select
            aria-label="起始等级"
            value={targetLevel}
            onChange={(event) => onTargetLevelChange(Number(event.target.value))}
            className="w-full rounded-xl border border-white/10 bg-void-900/80 px-4 py-3 text-sm text-slate-100 outline-none focus:border-arcane-400/50"
          >
            {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => (
              <option key={level} value={level}>{level} 级</option>
            ))}
          </select>
        </label>
      </div>
      {targetLevel > 1 && (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-500/[0.06] p-4 text-xs leading-5 text-amber-100">
          创建 1 级角色后，系统将依次结算第 2 级到第 {targetLevel} 级。每一级都要分别确认生命值、
          专长／属性提升、战斗风格、子职与其他职业选择；已确认的级别不能返回修改。
        </div>
      )}
    </div>
  )
}

function StartingEquipmentFields({
  plan,
  selection,
  onChange,
}: {
  plan: Dnd5eStartingEquipmentPlan
  selection: Dnd5eStartingEquipmentSelection
  onChange(selection: Dnd5eStartingEquipmentSelection): void
}) {
  const normalized = normalizeDnd5eStartingEquipmentSelection(plan, selection)
  const fixed = plan.fixedGrants.map((entry) => ({
    ...entry,
    item: dnd5eInventoryItemTemplate(entry.templateId),
  })).filter((entry) => !!entry.item)
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-arcane-400/20 bg-arcane-500/[0.05] p-4">
        <div className="flex items-start gap-3">
          <Backpack className="mt-0.5 h-5 w-5 shrink-0 text-arcane-300" />
          <div>
            <h3 className="text-sm font-semibold text-arcane-100">{plan.charClass}起始装备</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">装备会进入库存；标为已装备的武器、护甲和盾牌会立即参与 Headless 结算。</p>
          </div>
        </div>
      </div>
      {plan.groups.map((group) => {
        const selectedId = normalized.optionIds[group.id]
        const selected = group.options.find((option) => option.id === selectedId)
        return (
          <section key={group.id} className="rounded-2xl border border-white/8 bg-black/15 p-4">
            <h4 className="text-sm font-semibold text-slate-200">{group.label}</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {group.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selectedId === option.id}
                  onClick={() => onChange({
                    ...normalized,
                    optionIds: { ...normalized.optionIds, [group.id]: option.id },
                  })}
                  className={`rounded-xl border px-3 py-3 text-left text-xs transition ${
                    selectedId === option.id
                      ? 'border-arcane-300/40 bg-arcane-500/10 text-arcane-100'
                      : 'border-white/8 bg-white/[0.02] text-slate-400 hover:border-white/15'
                  }`}
                >
                  <span className="font-semibold">{option.label}</span>
                  {option.description && <span className="mt-1 block text-[10px] leading-4 text-slate-500">{option.description}</span>}
                </button>
              ))}
            </div>
            {(selected?.pickers ?? []).map((choice) => {
              const key = dnd5eStartingEquipmentPickerKey(group.id, choice.id)
              return (
                <label key={choice.id} className="mt-3 block">
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">{choice.label}</span>
                  <select
                    aria-label={`${group.label}-${choice.label}`}
                    value={normalized.equipmentIds[key] ?? choice.defaultEquipmentId}
                    onChange={(event) => onChange({
                      ...normalized,
                      equipmentIds: { ...normalized.equipmentIds, [key]: event.target.value },
                    })}
                    className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100"
                  >
                    {dnd5eStartingEquipmentPickerItems(choice).map((equipment) => (
                      <option key={equipment.id} value={equipment.id}>{equipment.name}</option>
                    ))}
                  </select>
                </label>
              )
            })}
          </section>
        )
      })}
      {fixed.length > 0 && (
        <section className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.04] p-4">
          <h4 className="text-sm font-semibold text-emerald-100">固定获得</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {fixed.map((entry, index) => (
              <span key={`${entry.templateId}:${index}`} className="rounded-lg border border-white/8 bg-black/15 px-2.5 py-1.5 text-xs text-slate-300">
                {entry.item!.name}{entry.quantity > 1 ? ` ×${entry.quantity}` : ''}{entry.equipSlot ? ' · 已装备' : ''}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default function CharacterSetupDialog({ onCancel, onComplete }: CharacterSetupDialogProps) {
  useSyncExternalStore(
    subscribeDnd5eRulesPluginRegistry,
    dnd5eRulesPluginRegistrySnapshot,
    dnd5eRulesPluginRegistrySnapshot,
  )
  const pluginRaces = registeredDnd5ePluginRaces()
  const pluginBackgrounds = registeredDnd5ePluginBackgrounds()
  const pluginFeats = registeredDnd5ePluginFeats()
  const raceOptions = [
    ...DND5E_2014_RACE_OPTIONS.map((value) => ({ value, label: value })),
    ...pluginRaces.map((race) => ({
      value: race.id,
      label: `${race.parentRace ? `${race.parentRace.name} › ` : ''}${race.name} · ${race.ownerPluginName}`,
    })),
  ]
  const backgroundOptions = [
    ...DND5E_2014_BACKGROUND_OPTIONS.map((value) => ({ value, label: value })),
    ...pluginBackgrounds.map((background) => ({
      value: background.id,
      label: `${background.name} · ${background.ownerPluginName}`,
    })),
  ]

  const [stage, setStage] = useState<SetupStage>('class')
  const [name, setName] = useState('新冒险者')
  const [identity, setIdentity] = useState<SetupIdentity>({
    charClass: '战士',
    race: '人类',
    alignment: '中立善良',
    background: '自定义背景',
  })
  const [targetLevel, setTargetLevel] = useState(1)
  const [method, setMethod] = useState<Exclude<Dnd5eAbilityGenerationMethod, 'beginner-recommended'>>('standard-array')
  const [baseAbilities, setBaseAbilities] = useState<Abilities>(() =>
    recommendedDnd5eBaseAbilitiesFromArray('战士', DND5E_STANDARD_ARRAY),
  )
  const [currentRoll, setCurrentRoll] = useState<Dnd5eAbilityRoll | null>(null)
  const [rolls, setRolls] = useState<Array<Dnd5eAbilityRoll & { ability: AbilityKey }>>([])
  const [racialBonusChoices, setRacialBonusChoices] = useState<AbilityKey[]>([])
  const [racialSkillProficiencies, setRacialSkillProficiencies] = useState<string[]>([])
  const [racialFeatIds, setRacialFeatIds] = useState<string[]>([])
  const [dragonbornAncestry, setDragonbornAncestry] = useState<Dnd5eDragonbornAncestryId>('black')
  const [classSkillProficiencies, setClassSkillProficiencies] = useState<string[]>([])
  const [fighterStyles, setFighterStyles] = useState<FighterFightingStyleId[]>([])
  const [subclassId, setSubclassId] = useState('')
  const [initialSelections, setInitialSelections] = useState<Record<string, string[]>>({})
  const [initialSpellSelections, setInitialSpellSelections] = useState<Dnd5eAdvancementSpellSelectionsV1>()
  const [startingEquipment, setStartingEquipment] = useState<Dnd5eStartingEquipmentSelection>(() =>
    defaultDnd5eStartingEquipmentSelection(dnd5eStartingEquipmentPlan('战士', '自定义背景')),
  )

  const definition = dnd5eClassDefinition(identity.charClass)
  const selectedPluginRace = dnd5ePluginRaceDefinition(identity.race)
  const selectedCoreRace = dnd5eCoreRaceMechanics(identity.race)
  const pluginBackground = dnd5ePluginBackgroundDefinition(identity.background)
  const equipmentPlan = useMemo(
    () => dnd5eStartingEquipmentPlan(identity.charClass, identity.background),
    [identity.background, identity.charClass],
  )
  const flexibleRacialBonus = dnd5eFlexibleRacialAbilityBonus(identity.race)
  const racialSkillChoiceCount =
    selectedPluginRace?.skillProficiencyChoiceCount ?? selectedCoreRace?.skillProficiencyChoiceCount ?? 0
  const racialFeatChoiceCount = selectedPluginRace?.featChoiceCount ?? 0
  const requiresDragonbornAncestry = selectedCoreRace?.id === 'dragonborn'
  const racialBonuses = useMemo(
    () => dnd5eRacialAbilityBonuses(identity.race, racialBonusChoices),
    [identity.race, racialBonusChoices],
  )
  const finalAbilities = useMemo(
    () => applyDnd5eRacialAbilityBonuses(baseAbilities, racialBonuses),
    [baseAbilities, racialBonuses],
  )
  const racialFeatOptions = pluginFeats.filter((feat) => {
    const prerequisite = feat.prerequisite
    if ((prerequisite?.minimumLevel ?? 1) > 1) return false
    if (Object.entries(prerequisite?.abilityScores ?? {}).some(([ability, minimum]) =>
      finalAbilities[ability as AbilityKey] < (minimum ?? 0))) return false
    if (prerequisite?.raceIds?.length) {
      const identities = new Set([
        identity.race,
        selectedPluginRace?.id,
        selectedPluginRace?.name,
      ].filter((value): value is string => !!value))
      if (!prerequisite.raceIds.some((raceId) => identities.has(raceId))) return false
    }
    return true
  })
  const classSkillOptions = definition?.skillProficiencies === 'any'
    ? SKILLS.map((skill) => skill.key)
    : definition?.skillProficiencies ?? []
  const backgroundSkillProficiencies = pluginBackground
    ? [...pluginBackground.skillProficiencies]
    : coreBackgroundSkills(identity.background)
  const availableProficiencyKeys = new Set([
    ...classSkillProficiencies,
    ...backgroundSkillProficiencies,
    ...racialSkillProficiencies,
  ])
  const subclassOptions = definition?.subclassLevel === 1
    ? [
        {
          id: definition.subclass.id,
          name: definition.subclass.name,
          summary: definition.subclass.summary,
        },
        ...registeredDnd5ePluginSubclasses(definition.id).map((subclass) => ({
          id: subclass.id,
          name: `${subclass.name} · ${subclass.ownerPluginName}`,
          summary: subclass.summary,
        })),
      ]
    : []
  const initialChoiceGroups: InitialChoiceGroup[] = (() => {
    if (!definition || definition.id === 'fighter') return []
    const groups: InitialChoiceGroup[] = (definition.choiceGroups ?? [])
      .filter((group) => group.level <= 1)
      .map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        limit: dnd5eClassChoiceLimit(group, 1),
        options: group.options,
      }))
    if (!subclassId || definition.subclassLevel !== 1) return groups
    if (subclassId === definition.subclass.id) {
      groups.push(...(definition.subclass.choiceGroups ?? [])
        .filter((group) => group.level <= 1)
        .map((group) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          limit: dnd5eClassChoiceLimit(group, 1),
          options: group.options,
        })))
      return groups
    }
    const pluginSubclass = registeredDnd5ePluginSubclasses(definition.id)
      .find((subclass) => subclass.id === subclassId)
    groups.push(...(pluginSubclass?.choiceGroups ?? [])
      .filter((group) => group.level <= 1)
      .map((group) => ({
        id: `${pluginSubclass!.id}/${group.id}`,
        name: group.name,
        description: group.description,
        limit: dnd5ePluginSubclassChoiceLimit(group, 1),
        options: group.options,
      })))
    return groups
  })()
  const initialSpellPlan = definition
    ? buildDnd5eSpellAdvancementPlanFromSelections({
        classId: definition.id,
        fromClassLevel: 0,
        toClassLevel: 1,
        subclassId: subclassId || undefined,
        selections: {},
      })
    : undefined
  const effectiveInitialSpellSelections = initialSpellPlan?.selectionRequired
    ? initialSpellSelections ?? initialSpellPlan.defaultSelections
    : undefined

  const pointBuyRemaining = method === 'point-buy'
    ? dnd5ePointBuyRemainingForRule(baseAbilities, DND5E_CORE_POINT_BUY_RULE)
    : 0
  const assignedRollAbilities = new Set(rolls.map((roll) => roll.ability))
  const abilityAllocationComplete = method === 'roll-4d6'
    ? rolls.length === 6
    : method === 'point-buy'
      ? pointBuyRemaining === 0
      : sameScoreMultiset(baseAbilities, DND5E_STANDARD_ARRAY)
  const racialBonusChoicesComplete = !flexibleRacialBonus ||
    racialBonusChoices.length === flexibleRacialBonus.count
  const racialChoicesComplete =
    racialSkillProficiencies.length === racialSkillChoiceCount &&
    racialFeatIds.length === racialFeatChoiceCount
  const classChoicesComplete =
    !!definition &&
    classSkillProficiencies.length === definition.skillChoiceCount &&
    (definition.id !== 'fighter' || fighterStyles.length === 1) &&
    (definition.subclassLevel !== 1 || !!subclassId) &&
    initialChoiceGroups.every((group) => (initialSelections[group.id] ?? []).length === group.limit) &&
    (!initialSpellPlan?.selectionRequired ||
      dnd5eSpellAdvancementSelectionsComplete(initialSpellPlan, effectiveInitialSpellSelections))

  const updateIdentity = (patch: Partial<SetupIdentity>) => {
    const next = { ...identity, ...patch }
    setIdentity(next)
    if (patch.charClass) {
      setClassSkillProficiencies([])
      setFighterStyles([])
      setSubclassId('')
      setInitialSelections({})
      setInitialSpellSelections(undefined)
      setStartingEquipment(defaultDnd5eStartingEquipmentSelection(
        dnd5eStartingEquipmentPlan(next.charClass, next.background),
      ))
    }
    if (patch.race) {
      setRacialBonusChoices([])
      setRacialSkillProficiencies([])
      setRacialFeatIds([])
      setDragonbornAncestry('black')
      setInitialSelections({})
      setInitialSpellSelections(undefined)
    }
    if (patch.background) {
      setInitialSelections({})
      setStartingEquipment(defaultDnd5eStartingEquipmentSelection(
        dnd5eStartingEquipmentPlan(next.charClass, next.background),
      ))
    }
  }

  const startAbilityMethod = () => {
    if (method === 'standard-array') {
      setBaseAbilities(recommendedDnd5eBaseAbilitiesFromArray(identity.charClass, DND5E_STANDARD_ARRAY))
    } else if (method === 'point-buy') {
      setBaseAbilities(emptyAbilities(DND5E_CORE_POINT_BUY_RULE.minimum))
    } else {
      setBaseAbilities(emptyAbilities())
      setCurrentRoll(null)
      setRolls([])
    }
    setStage('abilities')
  }

  const assignStandardValue = (ability: AbilityKey, score: number) => {
    setBaseAbilities((current) => {
      const other = ABILITY_KEYS.find((key) => key !== ability && current[key] === score)
      if (!other) return { ...current, [ability]: score }
      return { ...current, [ability]: score, [other]: current[ability] }
    })
  }

  const adjustPointBuy = (ability: AbilityKey, delta: -1 | 1) => {
    setBaseAbilities((current) => {
      const before = current[ability]
      const after = before + delta
      if (after < DND5E_CORE_POINT_BUY_RULE.minimum || after > DND5E_CORE_POINT_BUY_RULE.maximum) return current
      const costDelta =
        dnd5ePointBuyCostForRule(after, DND5E_CORE_POINT_BUY_RULE) -
        dnd5ePointBuyCostForRule(before, DND5E_CORE_POINT_BUY_RULE)
      if (costDelta > dnd5ePointBuyRemainingForRule(current, DND5E_CORE_POINT_BUY_RULE)) return current
      return { ...current, [ability]: after }
    })
  }

  const assignCurrentRoll = (ability: AbilityKey) => {
    if (!currentRoll || assignedRollAbilities.has(ability)) return
    setBaseAbilities((current) => ({ ...current, [ability]: currentRoll.total }))
    setRolls((current) => [...current, { ...currentRoll, ability }])
    setCurrentRoll(null)
  }

  const toggleLimited = (
    current: string[],
    value: string,
    limit: number,
    setter: (next: string[]) => void,
  ) => {
    setter(current.includes(value)
      ? current.filter((entry) => entry !== value)
      : current.length < limit ? [...current, value] : current)
  }

  const goBack = () => {
    if (stage === 'ability-method') setStage('class')
    else if (stage === 'abilities') setStage('ability-method')
    else if (stage === 'identity') setStage('abilities')
    else if (stage === 'level-one') setStage('identity')
    else if (stage === 'equipment') setStage('level-one')
    else if (stage === 'review') setStage('equipment')
  }

  const complete = () => {
    if (!definition || !name.trim() || !classChoicesComplete || !racialChoicesComplete || !racialBonusChoicesComplete) return
    const resolvedRace = dnd5ePluginRaceDefinition(identity.race)
    const resolvedBackground = dnd5ePluginBackgroundDefinition(identity.background)
    const initialClassChoices: Character['dnd5eClassChoices'] = definition.id === 'fighter'
      ? {
          fighter: {
            fightingStyles: [...fighterStyles],
          },
        }
      : {
          classes: {
            [definition.id]: {
              ...(definition.subclassLevel === 1 && subclassId ? { subclass: subclassId } : {}),
              selections: {
                'class-skills': [...classSkillProficiencies],
                ...Object.fromEntries(Object.entries(initialSelections).map(([key, values]) => [key, [...values]])),
                ...(initialSpellPlan?.selectionRequired && effectiveInitialSpellSelections
                  ? {
                      [initialSpellPlan.cantripSelectionKey]: [...effectiveInitialSpellSelections.cantrips],
                      ...(initialSpellPlan.targetKnownSpellCount == null
                        ? {}
                        : {
                            [initialSpellPlan.spellSelectionKey]: [
                              ...(effectiveInitialSpellSelections.knownSpells ?? []),
                            ],
                          }),
                      ...(initialSpellPlan.targetWizardSpellbookCount == null
                        ? {}
                        : {
                            'wizard-spellbook': [
                              ...(effectiveInitialSpellSelections.wizardSpellbook ?? []),
                            ],
                          }),
                    }
                  : {}),
              },
            },
          },
        }
    onComplete({
      ...identity,
      race: resolvedRace?.name ?? identity.race,
      background: resolvedBackground?.name ?? identity.background,
      ...(resolvedRace ? { dnd5eRaceId: resolvedRace.id } : {}),
      ...(resolvedBackground ? { dnd5eBackgroundId: resolvedBackground.id } : {}),
      backgroundSkillProficiencies,
      classSkillProficiencies: [...classSkillProficiencies],
      ...(racialSkillProficiencies.length ? { racialSkillProficiencies: [...racialSkillProficiencies] } : {}),
      ...(racialFeatIds.length ? { racialFeatIds: [...racialFeatIds] } : {}),
      ...(requiresDragonbornAncestry ? { dragonbornAncestry } : {}),
      name: name.trim(),
      targetLevel,
      method,
      baseAbilities,
      racialBonuses,
      abilities: finalAbilities,
      racialBonusChoices,
      initialClassChoices,
      startingEquipment: normalizeDnd5eStartingEquipmentSelection(equipmentPlan, startingEquipment),
      ...(rolls.length ? { rolls } : {}),
    })
  }

  const stageTitle: Record<SetupStage, string> = {
    class: '选择起始职业',
    'ability-method': '选择属性生成方式',
    abilities: '分配六项属性',
    identity: '选择种族、背景与起始等级',
    'level-one': '完成 1 级角色选择',
    equipment: '选择起始装备',
    review: '确认角色',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/80 p-3 backdrop-blur-md sm:p-6">
      <div role="dialog" aria-modal="true" aria-label="创建角色" className="glass flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-7">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-arcane-300">
              <Sparkles className="h-4 w-4" /> D&D 5e 2014 角色创建
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-50">{stageTitle[stage]}</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="关闭角色创建" className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {stage === 'class' && (
            <ClassFields
              name={name}
              charClass={identity.charClass}
              onNameChange={setName}
              onClassChange={(charClass) => updateIdentity({ charClass })}
            />
          )}

          {stage === 'ability-method' && (
            <div className="grid gap-4 md:grid-cols-3">
              {METHOD_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={method === option.id}
                  onClick={() => setMethod(option.id)}
                  className={`rounded-2xl border p-5 text-left transition ${
                    method === option.id
                      ? 'border-arcane-400/50 bg-arcane-500/10'
                      : 'border-white/8 bg-black/15 hover:border-white/15'
                  }`}
                >
                  {option.kind === 'roll'
                    ? <Dices className="h-6 w-6 text-arcane-300" />
                    : option.kind === 'point-buy'
                      ? <WandSparkles className="h-6 w-6 text-arcane-300" />
                      : <Shield className="h-6 w-6 text-arcane-300" />}
                  <h3 className="mt-4 font-semibold text-slate-100">{option.name}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{option.summary}</p>
                </button>
              ))}
            </div>
          )}

          {stage === 'abilities' && (
            <div className="space-y-5">
              {method === 'point-buy' && (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${
                  pointBuyRemaining === 0
                    ? 'border-emerald-400/20 bg-emerald-500/5 text-emerald-200'
                    : 'border-arcane-400/20 bg-arcane-500/5 text-arcane-100'
                }`}>
                  27 点购点：已使用 {27 - pointBuyRemaining}，剩余 {pointBuyRemaining} 点。
                </div>
              )}
              {method === 'roll-4d6' && (
                <div className="rounded-2xl border border-arcane-400/20 bg-arcane-500/[0.05] p-5 text-center">
                  {currentRoll ? (
                    <>
                      <p className="text-xs text-slate-500">本次投掷，划掉一枚最低值</p>
                      <div className="mt-3 flex justify-center gap-2">
                        {currentRoll.dice.map((die, index) => (
                          <span key={index} className={`flex h-11 w-11 items-center justify-center rounded-xl border font-mono text-lg font-bold ${
                            currentRoll.discardedIndices.includes(index)
                              ? 'border-rose-400/30 bg-rose-500/10 text-rose-300 line-through'
                              : 'border-white/10 bg-white/5 text-slate-100'
                          }`}>{die}</span>
                        ))}
                      </div>
                      <p className="mt-3 text-lg font-bold text-arcane-200">合计 {currentRoll.total}</p>
                    </>
                  ) : rolls.length < 6 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentRoll(rollDnd5eAbilityScore({ diceCount: 4, dieSides: 6, dropLowest: 1 }))}
                      className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-5 py-3 text-sm font-semibold text-white"
                    >
                      <Dices className="h-4 w-4" /> 投掷 4d6（第 {rolls.length + 1}/6 次）
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-emerald-200"><Check className="h-5 w-5" /> 六项属性已完成</div>
                  )}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ABILITIES.map((ability) => (
                  <div key={ability.key} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-100">{ability.label}</p>
                        <p className="text-[11px] text-slate-600">{ability.full}</p>
                      </div>
                      {method === 'standard-array' ? (
                        <select
                          aria-label={`${ability.label}基础值`}
                          value={baseAbilities[ability.key]}
                          onChange={(event) => assignStandardValue(ability.key, Number(event.target.value))}
                          className="rounded-xl border border-white/10 bg-void-900 px-3 py-2 font-mono text-lg font-bold text-slate-100"
                        >
                          {DND5E_STANDARD_ARRAY.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                      ) : method === 'point-buy' ? (
                        <div className="flex items-center gap-2">
                          <button type="button" aria-label={`降低${ability.label}`} onClick={() => adjustPointBuy(ability.key, -1)} className="h-8 w-8 rounded-lg border border-white/10 text-slate-300">−</button>
                          <span className="w-8 text-center font-mono text-xl font-bold text-slate-100">{baseAbilities[ability.key]}</span>
                          <button type="button" aria-label={`提高${ability.label}`} onClick={() => adjustPointBuy(ability.key, 1)} className="h-8 w-8 rounded-lg border border-white/10 text-slate-300">+</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!currentRoll || assignedRollAbilities.has(ability.key)}
                          onClick={() => assignCurrentRoll(ability.key)}
                          className="min-w-20 rounded-xl border border-white/10 px-3 py-2 font-mono text-lg font-bold text-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          {assignedRollAbilities.has(ability.key)
                            ? baseAbilities[ability.key]
                            : currentRoll ? `填入 ${currentRoll.total}` : '未分配'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {method === 'roll-4d6' && rolls.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setBaseAbilities(emptyAbilities())
                    setRolls([])
                    setCurrentRoll(null)
                  }}
                  className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-200"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> 清空并重新投掷全部属性
                </button>
              )}
            </div>
          )}

          {stage === 'identity' && (
            <IdentityFields
              identity={identity}
              targetLevel={targetLevel}
              raceOptions={raceOptions}
              backgroundOptions={backgroundOptions}
              onChange={updateIdentity}
              onTargetLevelChange={setTargetLevel}
            />
          )}

          {stage === 'level-one' && definition && (
            <div className="space-y-5">
              <section className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <h3 className="text-sm font-semibold text-slate-100">{definition.name}职业技能</h3>
                <p className="mt-1 text-xs text-slate-500">选择 {definition.skillChoiceCount} 项（已选 {classSkillProficiencies.length}）。</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {classSkillOptions.map((skillId) => (
                    <button
                      key={skillId}
                      type="button"
                      aria-pressed={classSkillProficiencies.includes(skillId)}
                      onClick={() => toggleLimited(
                        classSkillProficiencies,
                        skillId,
                        definition.skillChoiceCount,
                        setClassSkillProficiencies,
                      )}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                        classSkillProficiencies.includes(skillId)
                          ? 'border-violet-300/40 bg-violet-400/15 text-violet-100'
                          : 'border-white/8 text-slate-500'
                      }`}
                    >
                      {optionSkillName(skillId)}
                    </button>
                  ))}
                </div>
              </section>

              {definition.id === 'fighter' && (
                <section className="rounded-2xl border border-amber-300/15 bg-amber-500/[0.04] p-4">
                  <h3 className="text-sm font-semibold text-amber-100">战斗风格</h3>
                  <p className="mt-1 text-xs text-slate-500">1 级战士必须选择一项战斗风格。</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {FIGHTER_FIGHTING_STYLE_OPTIONS.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        aria-pressed={fighterStyles.includes(style.id)}
                        onClick={() => setFighterStyles([style.id])}
                        className={`rounded-xl border p-3 text-left ${
                          fighterStyles.includes(style.id)
                            ? 'border-amber-300/40 bg-amber-400/10 text-amber-100'
                            : 'border-white/8 bg-black/10 text-slate-400'
                        }`}
                      >
                        <span className="text-sm font-semibold">{style.name}</span>
                        <span className="mt-1 block text-[11px] leading-5 opacity-70">{style.summary}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {subclassOptions.length > 0 && (
                <section className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/[0.04] p-4">
                  <h3 className="text-sm font-semibold text-fuchsia-100">1 级子职</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {subclassOptions.map((subclass) => (
                      <button
                        key={subclass.id}
                        type="button"
                        aria-pressed={subclassId === subclass.id}
                        onClick={() => {
                          setSubclassId(subclass.id)
                          setInitialSelections({})
                          setInitialSpellSelections(undefined)
                        }}
                        className={`rounded-xl border p-3 text-left ${
                          subclassId === subclass.id
                            ? 'border-fuchsia-300/40 bg-fuchsia-400/10 text-fuchsia-100'
                            : 'border-white/8 bg-black/10 text-slate-400'
                        }`}
                      >
                        <span className="text-sm font-semibold">{subclass.name}</span>
                        <span className="mt-1 block text-[11px] leading-5 opacity-70">{subclass.summary}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {initialChoiceGroups.map((group) => {
                const selected = initialSelections[group.id] ?? []
                const options = group.id === 'expertise'
                  ? group.options.filter((option) => option.id === 'thievesTools' || availableProficiencyKeys.has(option.id))
                  : group.options
                return (
                  <section key={group.id} className="rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.04] p-4">
                    <h3 className="text-sm font-semibold text-cyan-100">{group.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {group.description ?? `选择 ${group.limit} 项。`}（已选 {selected.length}/{group.limit}）
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {options.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected.includes(option.id)}
                          onClick={() => toggleLimited(
                            selected,
                            option.id,
                            group.limit,
                            (next) => setInitialSelections((current) => ({ ...current, [group.id]: next })),
                          )}
                          className={`rounded-xl border p-3 text-left ${
                            selected.includes(option.id)
                              ? 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100'
                              : 'border-white/8 bg-black/10 text-slate-400'
                          }`}
                        >
                          <span className="text-sm font-semibold">{option.name}</span>
                          <span className="mt-1 block text-[11px] leading-5 opacity-70">{option.summary}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )
              })}

              {initialSpellPlan?.selectionRequired && effectiveInitialSpellSelections && (
                <Dnd5eSpellAdvancementPicker
                  plan={initialSpellPlan}
                  value={effectiveInitialSpellSelections}
                  onChange={setInitialSpellSelections}
                />
              )}

              {(flexibleRacialBonus || racialSkillChoiceCount || racialFeatChoiceCount || requiresDragonbornAncestry) && (
                <section className="rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.04] p-4">
                  <h3 className="text-sm font-semibold text-emerald-100">种族选择</h3>
                  {flexibleRacialBonus && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-400">选择 {flexibleRacialBonus.count} 项属性，各获得 +{flexibleRacialBonus.amount}。</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ABILITIES.filter((ability) => !flexibleRacialBonus.exclude?.includes(ability.key)).map((ability) => (
                          <button
                            key={ability.key}
                            type="button"
                            aria-pressed={racialBonusChoices.includes(ability.key)}
                            onClick={() => toggleLimited(
                              racialBonusChoices,
                              ability.key,
                              flexibleRacialBonus.count,
                              (next) => setRacialBonusChoices(next as AbilityKey[]),
                            )}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                              racialBonusChoices.includes(ability.key)
                                ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100'
                                : 'border-white/8 text-slate-500'
                            }`}
                          >
                            {ability.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {requiresDragonbornAncestry && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      {DND5E_DRAGONBORN_ANCESTRIES.map((ancestry) => (
                        <button
                          key={ancestry.id}
                          type="button"
                          aria-pressed={dragonbornAncestry === ancestry.id}
                          onClick={() => setDragonbornAncestry(ancestry.id)}
                          className={`rounded-xl border px-3 py-2 text-left ${
                            dragonbornAncestry === ancestry.id
                              ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100'
                              : 'border-white/8 text-slate-500'
                          }`}
                        >
                          <span className="text-xs font-semibold">{ancestry.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {racialSkillChoiceCount > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-slate-400">选择 {racialSkillChoiceCount} 项种族技能熟练。</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {SKILLS.map((skill) => (
                          <button
                            key={skill.key}
                            type="button"
                            aria-pressed={racialSkillProficiencies.includes(skill.key)}
                            onClick={() => toggleLimited(
                              racialSkillProficiencies,
                              skill.key,
                              racialSkillChoiceCount,
                              setRacialSkillProficiencies,
                            )}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                              racialSkillProficiencies.includes(skill.key)
                                ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-100'
                                : 'border-white/8 text-slate-500'
                            }`}
                          >
                            {skill.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {racialFeatChoiceCount > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-slate-400">选择 {racialFeatChoiceCount} 项种族专长。</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {racialFeatOptions.map((feat) => (
                          <button
                            key={feat.id}
                            type="button"
                            aria-pressed={racialFeatIds.includes(feat.id)}
                            onClick={() => toggleLimited(
                              racialFeatIds,
                              feat.id,
                              racialFeatChoiceCount,
                              setRacialFeatIds,
                            )}
                            className={`rounded-xl border p-3 text-left ${
                              racialFeatIds.includes(feat.id)
                                ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100'
                                : 'border-white/8 bg-black/10 text-slate-400'
                            }`}
                          >
                            <span className="text-sm font-semibold">{feat.name}</span>
                            <span className="mt-1 block text-[11px] leading-5 opacity-70">{feat.summary}</span>
                          </button>
                        ))}
                      </div>
                      {racialFeatOptions.length === 0 && (
                        <p className="mt-2 rounded-xl border border-amber-300/15 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
                          当前房间没有满足前提的种族专长，请先安装包含对应专长的规则包。
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {stage === 'equipment' && (
            <StartingEquipmentFields
              plan={equipmentPlan}
              selection={startingEquipment}
              onChange={setStartingEquipment}
            />
          )}

          {stage === 'review' && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <section className="rounded-2xl border border-arcane-300/15 bg-arcane-500/[0.04] p-4">
                  <h3 className="font-semibold text-arcane-100">{name}</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {identity.race} · {identity.charClass} · {identity.background} · {identity.alignment}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">目标等级：{targetLevel} 级</p>
                  {targetLevel > 1 && (
                    <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-100">
                      创建后将连续打开 {targetLevel - 1} 次单级升级结算；每次只处理一级。
                    </p>
                  )}
                </section>
                <section className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <h3 className="font-semibold text-slate-100">最终属性</h3>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {ABILITIES.map((ability) => (
                      <div key={ability.key} className="rounded-xl border border-white/6 px-3 py-2 text-center">
                        <p className="text-[11px] text-slate-500">{ability.label}</p>
                        <p className="mt-1 font-mono text-lg font-bold text-slate-100">{finalAbilities[ability.key]}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <section className="rounded-2xl border border-violet-300/15 bg-violet-500/[0.04] p-4">
                <div className="flex items-center gap-2">
                  <Backpack className="h-4 w-4 text-violet-300" />
                  <h3 className="text-sm font-semibold text-violet-100">起始装备</h3>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {dnd5eStartingEquipmentSummary(equipmentPlan, startingEquipment).map((line) => (
                    <p key={line} className="rounded-xl border border-white/8 bg-black/10 px-3 py-2 text-xs text-slate-400">{line}</p>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-white/8 px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={stage === 'class' ? onCancel : goBack}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" /> {stage === 'class' ? '取消' : '返回'}
          </button>
          {stage === 'class' && (
            <button type="button" disabled={!name.trim()} onClick={() => setStage('ability-method')} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
              生成属性 <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {stage === 'ability-method' && (
            <button type="button" onClick={startAbilityMethod} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-5 py-2.5 text-sm font-semibold text-white">
              开始分配 <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {stage === 'abilities' && (
            <button type="button" disabled={!abilityAllocationComplete} onClick={() => setStage('identity')} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
              选择种族与背景 <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {stage === 'identity' && (
            <button
              type="button"
              onClick={() => {
                setRacialBonusChoices(recommendedDnd5eRacialBonusChoices(
                  identity.race,
                  identity.charClass,
                  baseAbilities,
                ))
                setStage('level-one')
              }}
              className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-5 py-2.5 text-sm font-semibold text-white"
            >
              处理 1 级选择 <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {stage === 'level-one' && (
            <button type="button" disabled={!classChoicesComplete || !racialChoicesComplete || !racialBonusChoicesComplete} onClick={() => setStage('equipment')} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
              选择起始装备 <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {stage === 'equipment' && (
            <button type="button" onClick={() => setStage('review')} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-5 py-2.5 text-sm font-semibold text-white">
              检查角色 <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {stage === 'review' && (
            <button type="button" onClick={complete} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-arcane-600 to-arcane-500 px-5 py-2.5 text-sm font-semibold text-white">
              <Check className="h-4 w-4" /> 创建角色
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
