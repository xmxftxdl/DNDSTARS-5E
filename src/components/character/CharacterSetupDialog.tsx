import { useMemo, useState, useSyncExternalStore } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Backpack,
  BookOpen,
  Check,
  Dices,
  GraduationCap,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
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
  DEFAULT_DND5E_BEGINNER_PREFERENCES,
  DND5E_STANDARD_ARRAY,
  dnd5eFlexibleRacialAbilityBonus,
  dnd5eClassAbilityFit,
  dnd5ePointBuyCostForRule,
  dnd5ePointBuyRemainingForRule,
  dnd5eRacialAbilityBonuses,
  recommendDnd5eCharacter,
  recommendDnd5eRaces,
  recommendedDnd5eBaseAbilities,
  recommendedDnd5eBaseAbilitiesFromArray,
  recommendedDnd5eRacialBonusChoices,
  rollDnd5eAbilityScore,
  type Dnd5eAbilityRoll,
  type Dnd5eAbilityGenerationMethod,
  type Dnd5eBeginnerPreferences,
} from '../../rulesets/dnd5e/characterSetup'
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
  dnd5ePluginAbilityGenerationMethod,
  dnd5ePluginBackgroundDefinition,
  dnd5ePluginRaceDefinition,
  dnd5eRulesPluginRegistrySnapshot,
  registeredDnd5ePluginAbilityGenerationMethods,
  registeredDnd5ePluginBackgrounds,
  registeredDnd5ePluginFeats,
  registeredDnd5ePluginRaces,
  subscribeDnd5eRulesPluginRegistry,
} from '../../rulesets/dnd5e/pluginApi'
import type { Abilities } from '../../types/character'
import { dnd5eCoreRaceMechanics } from '../../rulesets/dnd5e/coreRaceMechanics'
import {
  DND5E_DRAGONBORN_ANCESTRIES,
  type Dnd5eDragonbornAncestryId,
} from '../../rulesets/dnd5e/racialAutomation'

type SetupStage = 'experience' | 'beginner-preferences' | 'identity' | 'ability-method' | 'abilities' | 'equipment' | 'review'

interface SetupIdentity {
  charClass: string
  race: string
  alignment: string
  background: string
}

export interface CharacterSetupResult extends SetupIdentity {
  name: string
  method: Dnd5eAbilityGenerationMethod
  baseAbilities: Abilities
  racialBonuses: Abilities
  abilities: Abilities
  dnd5eRaceId?: string
  dnd5eBackgroundId?: string
  backgroundSkillProficiencies?: string[]
  racialSkillProficiencies?: string[]
  racialFeatIds?: string[]
  dragonbornAncestry?: Dnd5eDragonbornAncestryId
  racialBonusChoices: AbilityKey[]
  startingEquipment: Dnd5eStartingEquipmentSelection
  recommendation?: {
    source: 'beginner-questionnaire' | 'build-analysis'
    recommendedClass: string
    selectedClass: string
    classMatchPercent?: number
    primaryAbilities: AbilityKey[]
    selectedRace: string
    recommendedRaces: string[]
    reasons: string[]
  }
  rolls?: Array<Dnd5eAbilityRoll & { ability: AbilityKey }>
}

interface CharacterSetupDialogProps {
  onCancel(): void
  onComplete(result: CharacterSetupResult): void
}

const PREFERENCE_QUESTIONS: Array<{
  key: keyof Dnd5eBeginnerPreferences
  label: string
  description: string
  impact: '职业' | '种族' | '阵营'
  options: Array<{ value: string; label: string; description: string }>
}> = [
  {
    key: 'combat', label: '你想怎样解决危险？', description: '决定最常使用的战斗距离和行动类型。', impact: '职业',
    options: [
      { value: 'frontline', label: '站在前线近战', description: '贴近敌人，以武器、护甲或蛮力作战。' },
      { value: 'ranged', label: '保持距离精准攻击', description: '依靠弓弩、投掷武器或远程能力。' },
      { value: 'magic', label: '用魔法改变局势', description: '用法术制造伤害、控制或特殊效果。' },
      { value: 'support', label: '治疗并支援同伴', description: '让队伍更稳定，恢复或强化盟友。' },
      { value: 'versatile', label: '灵活应对不同局面', description: '近战、远程和辅助之间保留转换空间。' },
    ],
  },
  {
    key: 'role', label: '你希望在队伍中扮演什么角色？', description: '这是职业排序权重最高的问题之一，选择后会立即重算。', impact: '职业',
    options: [
      { value: 'damage', label: '主要输出', description: '快速消灭威胁，追求稳定或爆发伤害。' },
      { value: 'defense', label: '保护队友', description: '承受攻击、占住前线并保护脆弱盟友。' },
      { value: 'support', label: '辅助与恢复', description: '治疗、强化、解除问题并维持队伍状态。' },
      { value: 'exploration', label: '侦察与探索', description: '追踪、潜行、找路和处理环境风险。' },
      { value: 'control', label: '控制战场', description: '限制敌人、改变地形或决定交战节奏。' },
    ],
  },
  {
    key: 'power', label: '哪种力量来源最吸引你？', description: '区分武艺、奥术、神术、自然与天赋能力。', impact: '职业',
    options: [
      { value: 'martial', label: '训练与武艺', description: '力量来自技巧、纪律、体魄与装备。' },
      { value: 'arcane', label: '学习奥术', description: '通过知识、乐艺或奥术训练掌握魔法。' },
      { value: 'divine', label: '信仰与誓言', description: '从神祇、信念或庄严誓言获得力量。' },
      { value: 'nature', label: '自然与荒野', description: '与野兽、植物和自然魔法建立联系。' },
      { value: 'innate', label: '天生或契约力量', description: '力量源于血脉、内在天赋或超自然契约。' },
    ],
  },
  {
    key: 'complexity', label: '你希望每回合考虑多少选择？', description: '影响操作复杂度和资源管理强度。', impact: '职业',
    options: [
      { value: 'straightforward', label: '规则清晰，快速行动', description: '少量核心按钮，容易判断当前最佳行动。' },
      { value: 'adaptive', label: '有选择但不过度繁琐', description: '保留战术变化，同时不需要记忆大量法术。' },
      { value: 'tactical', label: '喜欢研究战术组合', description: '愿意管理法术、资源、位置和多种解法。' },
    ],
  },
  {
    key: 'magicCommitment', label: '你想投入多少魔法玩法？', description: '同样喜欢魔法题材，也可能偏好不同操作量。', impact: '职业',
    options: [
      { value: 'none', label: '主要依靠非魔法能力', description: '武器、技能和身体能力是主要解决手段。' },
      { value: 'hybrid', label: '武艺与少量魔法结合', description: '有特色法术或超自然能力，但不以完整法术表为核心。' },
      { value: 'full', label: '完整施法者玩法', description: '希望准备或掌握较多法术，并持续管理法术位。' },
    ],
  },
  {
    key: 'defense', label: '面对危险时，你偏好怎样活下来？', description: '区分重甲、耐久、机动和远程防护路线。', impact: '职业',
    options: [
      { value: 'armored', label: '护甲与盾牌', description: '用较高 AC 正面承受攻击。' },
      { value: 'endurance', label: '生命与减伤', description: '即使命中也能靠生命值、抗性或恢复撑住。' },
      { value: 'mobility', label: '高速移动', description: '依靠走位、脱离和灵活性避开威胁。' },
      { value: 'avoidance', label: '距离与法术防护', description: '尽量不被接近，并用防御法术补救。' },
    ],
  },
  {
    key: 'utility', label: '离开战斗后，你最想擅长什么？', description: '细分社交、知识、荒野、潜行与通才路线。', impact: '职业',
    options: [
      { value: 'social', label: '交涉与影响他人', description: '谈判、欺瞒、表演或鼓舞同伴。' },
      { value: 'knowledge', label: '调查、知识与解谜', description: '理解魔法、历史、宗教并发现线索。' },
      { value: 'wilderness', label: '野外生存与追踪', description: '找路、觅食、识别自然迹象与追踪目标。' },
      { value: 'stealth', label: '潜行、侦察与开锁', description: '先发现危险，并绕过守卫与机关。' },
      { value: 'adaptable', label: '各种场景都能搭把手', description: '不锁定一种专长，希望在多数场景都有贡献。' },
    ],
  },
  {
    key: 'heritage', label: '你喜欢怎样的种族气质？', description: '种族建议会同时考虑气质、最终加点和职业主属性。', impact: '种族',
    options: [
      { value: 'versatile', label: '灵活且适应力强', description: '容易融入不同社会与职业路线。' },
      { value: 'sturdy', label: '坚韧可靠', description: '重视耐力、传统与可靠的生存能力。' },
      { value: 'agile', label: '轻盈敏捷', description: '偏好灵巧、速度与较小体型的形象。' },
      { value: 'mystical', label: '神秘而魔法化', description: '希望种族本身带有明显奥秘与异质感。' },
      { value: 'intimidating', label: '强悍有压迫感', description: '偏好醒目、强壮或令人生畏的外观。' },
    ],
  },
  {
    key: 'order', label: '角色如何看待秩序？', description: '决定阵营的守序—混乱轴，不影响职业强度。', impact: '阵营',
    options: [
      { value: 'lawful', label: '重视规则与承诺', description: '相信制度、传统、誓言或个人准则。' },
      { value: 'neutral', label: '视情况而定', description: '在秩序与自由之间根据现实选择。' },
      { value: 'chaotic', label: '重视自由与本心', description: '不愿让规则压过个人判断与自由。' },
    ],
  },
  {
    key: 'morality', label: '角色通常如何对待他人？', description: '决定阵营的善良—邪恶轴，不限制角色个性。', impact: '阵营',
    options: [
      { value: 'good', label: '愿意帮助与牺牲', description: '通常愿意为他人的福祉承担代价。' },
      { value: 'neutral', label: '先考虑现实与关系', description: '是否帮助取决于关系、风险和现实处境。' },
      { value: 'evil', label: '优先自己的目标', description: '更愿意让他人为自己的目的承担代价。' },
    ],
  },
]

const METHOD_OPTIONS: Array<{
  id: Exclude<Dnd5eAbilityGenerationMethod, 'beginner-recommended'>
  name: string
  summary: string
  kind: 'standard-array' | 'point-buy' | 'roll'
}> = [
  { id: 'standard-array', name: '标准数组', summary: '将 15、14、13、12、10、8 各分配一次，稳定且快速。', kind: 'standard-array' },
  { id: 'point-buy', name: '27 点购点', summary: '六项从 8 开始，按 2014 购点成本提升，种族调整最后加入。', kind: 'point-buy' },
  { id: 'roll-4d6', name: '4d6 去最低值', summary: '每次投四枚 d6，去掉一枚最低值，再选择填入一项尚未分配的属性。', kind: 'roll' },
]

const ABILITY_KEYS = ABILITIES.map((ability) => ability.key)

function emptyAbilities(value = 0): Abilities {
  return { str: value, dex: value, con: value, int: value, wis: value, cha: value }
}

function sameScoreMultiset(abilities: Abilities, scores: readonly number[]): boolean {
  return [...ABILITY_KEYS.map((ability) => abilities[ability])].sort((left, right) => left - right).join(',') ===
    [...scores].sort((left, right) => left - right).join(',')
}

function PreferenceQuestion({
  question,
  value,
  onChange,
}: {
  question: typeof PREFERENCE_QUESTIONS[number]
  value: string
  onChange(value: string): void
}) {
  return (
    <fieldset className="rounded-2xl border border-white/8 bg-black/15 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-100">{question.label}</legend>
      <div className="mb-3 mt-1 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{question.description}</p>
        <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-500">影响{question.impact}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {question.options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
              value === option.value
                ? 'border-arcane-400/50 bg-arcane-500/15 text-arcane-100'
                : 'border-white/8 bg-white/[0.025] text-slate-400 hover:border-white/15 hover:text-slate-200'
            }`}
          >
            <span className="block font-semibold">{option.label}</span>
            <span className={`mt-1 block text-[11px] leading-4 ${value === option.value ? 'text-arcane-200/70' : 'text-slate-600'}`}>{option.description}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function IdentityFields({
  identity,
  raceOptions,
  backgroundOptions,
  onChange,
}: {
  identity: SetupIdentity
  raceOptions: readonly { value: string; label: string }[]
  backgroundOptions: readonly { value: string; label: string }[]
  onChange(patch: Partial<SetupIdentity>): void
}) {
  const fields = [
    ['职业', 'charClass', DND5E_2014_CLASS_OPTIONS.map((value) => ({ value, label: value }))],
    ['种族', 'race', raceOptions],
    ['阵营', 'alignment', DND5E_2014_ALIGNMENT_OPTIONS.map((value) => ({ value, label: value }))],
    ['背景', 'background', backgroundOptions],
  ] as const
  return (
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
  return <div className="space-y-5">
    <div className="rounded-2xl border border-arcane-400/20 bg-arcane-500/[0.05] p-4">
      <div className="flex items-start gap-3">
        <Backpack className="mt-0.5 h-5 w-5 shrink-0 text-arcane-300" />
        <div>
          <h3 className="text-sm font-semibold text-arcane-100">{plan.charClass}起始装备</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">逐组选择 SRD 5.1 职业装备。标为已装备的武器、护甲和盾牌会立即参与 AC 与 Headless 攻击结算，其余物品进入库存。</p>
        </div>
      </div>
    </div>

    {plan.groups.map((group) => {
      const selectedId = normalized.optionIds[group.id]
      const selected = group.options.find((option) => option.id === selectedId)
      return <section key={group.id} className="rounded-2xl border border-white/8 bg-black/15 p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-slate-200">{group.label}</h4>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${group.source === 'background' ? 'bg-amber-500/10 text-amber-200' : 'bg-violet-500/10 text-violet-200'}`}>
            {group.source === 'background' ? `${plan.background}背景` : `${plan.charClass}职业`}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {group.options.map((option) => <button
            key={option.id}
            type="button"
            aria-pressed={selectedId === option.id}
            onClick={() => onChange({ ...normalized, optionIds: { ...normalized.optionIds, [group.id]: option.id } })}
            className={`rounded-xl border px-3 py-3 text-left text-xs transition ${selectedId === option.id ? 'border-arcane-300/40 bg-arcane-500/10 text-arcane-100' : 'border-white/8 bg-white/[0.02] text-slate-400 hover:border-white/15'}`}
          >
            <span className="font-semibold">{option.label}</span>
            {option.description ? <span className="mt-1 block text-[10px] leading-4 text-slate-500">{option.description}</span> : null}
          </button>)}
        </div>
        {(selected?.pickers ?? []).map((choice) => {
          const key = dnd5eStartingEquipmentPickerKey(group.id, choice.id)
          return <label key={choice.id} className="mt-3 block">
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">{choice.label}</span>
            <select
              aria-label={`${group.label}-${choice.label}`}
              value={normalized.equipmentIds[key] ?? choice.defaultEquipmentId}
              onChange={(event) => onChange({ ...normalized, equipmentIds: { ...normalized.equipmentIds, [key]: event.target.value } })}
              className="w-full rounded-xl border border-white/10 bg-void-900/80 px-3 py-2.5 text-sm text-slate-100"
            >
              {dnd5eStartingEquipmentPickerItems(choice).map((equipment) => <option key={equipment.id} value={equipment.id}>{equipment.name}</option>)}
            </select>
          </label>
        })}
      </section>
    })}

    <section className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.04] p-4">
      <h4 className="text-sm font-semibold text-emerald-100">固定获得</h4>
      <div className="mt-3 flex flex-wrap gap-2">
        {fixed.map((entry, index) => <span key={`${entry.templateId}:${index}`} className="rounded-lg border border-white/8 bg-black/15 px-2.5 py-1.5 text-xs text-slate-300">
          {entry.item!.name}{entry.quantity > 1 ? ` ×${entry.quantity}` : ''}{entry.equipSlot ? ' · 已装备' : ''}
        </span>)}
        {fixed.length === 0 ? <span className="text-xs text-slate-500">没有额外固定物品，全部由上方选择决定。</span> : null}
      </div>
      {plan.background !== '侍僧' ? <p className="mt-3 text-[11px] leading-5 text-slate-500">该背景没有核心起始装备表；创建后可由 DM 从 SRD 或当前规则包分发物品。</p> : null}
    </section>
  </div>
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
  const pluginMethods = registeredDnd5ePluginAbilityGenerationMethods()
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
  const abilityMethodOptions = [
    ...METHOD_OPTIONS,
    ...pluginMethods.map((method) => ({
      id: method.id as Dnd5eAbilityGenerationMethod,
      name: method.name,
      summary: method.summary,
      kind: method.kind,
      ownerPluginName: method.ownerPluginName,
    })),
  ]
  const [stage, setStage] = useState<SetupStage>('experience')
  const [experience, setExperience] = useState<'beginner' | 'veteran' | null>(null)
  const [name, setName] = useState('新冒险者')
  const [preferences, setPreferences] = useState<Dnd5eBeginnerPreferences>(DEFAULT_DND5E_BEGINNER_PREFERENCES)
  const [identity, setIdentity] = useState<SetupIdentity>({
    charClass: '战士', race: '人类', alignment: '中立善良', background: '自定义背景',
  })
  const equipmentPlan = useMemo(
    () => dnd5eStartingEquipmentPlan(identity.charClass, identity.background),
    [identity.background, identity.charClass],
  )
  const [startingEquipment, setStartingEquipment] = useState<Dnd5eStartingEquipmentSelection>(() =>
    defaultDnd5eStartingEquipmentSelection(dnd5eStartingEquipmentPlan('战士', '自定义背景')),
  )
  const [method, setMethod] = useState<Dnd5eAbilityGenerationMethod>('standard-array')
  const [baseAbilities, setBaseAbilities] = useState<Abilities>(recommendedDnd5eBaseAbilities('战士'))
  const [racialBonusChoices, setRacialBonusChoices] = useState<AbilityKey[]>([])
  const [racialSkillProficiencies, setRacialSkillProficiencies] = useState<string[]>([])
  const [racialFeatIds, setRacialFeatIds] = useState<string[]>([])
  const [dragonbornAncestry, setDragonbornAncestry] = useState<Dnd5eDragonbornAncestryId>('black')
  const [currentRoll, setCurrentRoll] = useState<Dnd5eAbilityRoll | null>(null)
  const [rolls, setRolls] = useState<Array<Dnd5eAbilityRoll & { ability: AbilityKey }>>([])

  const pluginMethod = dnd5ePluginAbilityGenerationMethod(method)
  const standardScores = method === 'standard-array'
    ? DND5E_STANDARD_ARRAY
    : pluginMethod?.kind === 'standard-array' ? pluginMethod.scores : undefined
  const pointBuyRule = method === 'point-buy'
    ? DND5E_CORE_POINT_BUY_RULE
    : pluginMethod?.kind === 'point-buy' ? pluginMethod : undefined
  const rollRule = method === 'roll-4d6'
    ? { diceCount: 4, dieSides: 6, dropLowest: 1 }
    : pluginMethod?.kind === 'roll' ? pluginMethod : undefined
  const methodKind = standardScores ? 'standard-array' : pointBuyRule ? 'point-buy' : rollRule ? 'roll' : undefined
  const selectedPluginRace = dnd5ePluginRaceDefinition(identity.race)
  const selectedCoreRace = dnd5eCoreRaceMechanics(identity.race)
  const racialSkillChoiceCount =
    selectedPluginRace?.skillProficiencyChoiceCount ?? selectedCoreRace?.skillProficiencyChoiceCount ?? 0
  const racialFeatChoiceCount = selectedPluginRace?.featChoiceCount ?? 0
  const requiresDragonbornAncestry = selectedCoreRace?.id === 'dragonborn'
  const flexibleRacialBonus = dnd5eFlexibleRacialAbilityBonus(identity.race)

  const racialBonuses = useMemo(
    () => dnd5eRacialAbilityBonuses(identity.race, racialBonusChoices),
    [racialBonusChoices, identity.race],
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
  const liveRecommendation = recommendDnd5eCharacter(preferences)
  const raceRecommendations = recommendDnd5eRaces(
    identity.charClass,
    baseAbilities,
    raceOptions.map((race) => race.value),
    experience === 'beginner' ? preferences.heritage : undefined,
  )
  const classAbilityFit = dnd5eClassAbilityFit(identity.charClass, finalAbilities)
  const currentClassCandidate = liveRecommendation.classCandidates.find((candidate) => candidate.charClass === identity.charClass)
  const currentRaceCandidate = raceRecommendations.find((candidate) => candidate.race === identity.race)
  const topRaceCandidate = raceRecommendations[0]
  const raceLabel = (race: string) => raceOptions.find((option) => option.value === race)?.label ?? race
  const recommendationReasons = [
    ...(experience === 'beginner'
      ? currentClassCandidate?.reasons ?? [`${identity.charClass}是根据你的问卷画像选出的综合匹配职业。`]
      : []),
    classAbilityFit.summary,
    topRaceCandidate?.race === identity.race
      ? `${raceLabel(identity.race)}是当前加点下的首选种族建议。`
      : `${raceLabel(topRaceCandidate?.race ?? identity.race)}更直接强化当前主属性；你仍可保留${raceLabel(identity.race)}以符合角色概念。`,
    ...(currentRaceCandidate?.reasons.slice(0, 2) ?? []),
  ]
  const pointBuyRemaining = pointBuyRule ? dnd5ePointBuyRemainingForRule(baseAbilities, pointBuyRule) : 0
  const assignedRollAbilities = new Set(rolls.map((roll) => roll.ability))
  const abilityAllocationComplete = methodKind === 'roll'
    ? rolls.length === 6
    : methodKind === 'point-buy'
      ? pointBuyRemaining === 0
      : !!standardScores && sameScoreMultiset(baseAbilities, standardScores)
  const racialBonusChoicesComplete = !flexibleRacialBonus || racialBonusChoices.length === flexibleRacialBonus.count
  const racialSkillChoicesComplete =
    racialSkillProficiencies.length === racialSkillChoiceCount
  const racialFeatChoicesComplete =
    racialFeatIds.length === racialFeatChoiceCount

  const updateIdentity = (patch: Partial<SetupIdentity>) => {
    const next = { ...identity, ...patch }
    setIdentity(next)
    const nextBaseAbilities = experience === 'beginner' && patch.charClass
      ? recommendedDnd5eBaseAbilities(next.charClass)
      : baseAbilities
    if (experience === 'beginner' && patch.charClass) {
      setBaseAbilities(nextBaseAbilities)
    }
    if (patch.race || patch.charClass) {
      setRacialBonusChoices(recommendedDnd5eRacialBonusChoices(next.race, next.charClass, nextBaseAbilities))
    }
    if (patch.race) {
      setRacialSkillProficiencies([])
      setRacialFeatIds([])
      setDragonbornAncestry('black')
    }
    if (patch.charClass || patch.background) {
      setStartingEquipment(defaultDnd5eStartingEquipmentSelection(dnd5eStartingEquipmentPlan(next.charClass, next.background)))
      if (stage === 'review') setStage('equipment')
    }
  }

  const beginBeginner = () => {
    setExperience('beginner')
    setStage('beginner-preferences')
  }
  const beginVeteran = () => {
    setExperience('veteran')
    setStage('identity')
  }
  const finishRecommendation = () => {
    const recommendation = liveRecommendation
    const nextIdentity = {
      charClass: recommendation.charClass,
      race: recommendation.race,
      alignment: recommendation.alignment,
      background: recommendation.background,
    }
    setIdentity(nextIdentity)
    setMethod('beginner-recommended')
    const recommendedBase = recommendedDnd5eBaseAbilities(nextIdentity.charClass)
    setBaseAbilities(recommendedBase)
    setRacialBonusChoices(recommendedDnd5eRacialBonusChoices(nextIdentity.race, nextIdentity.charClass, recommendedBase))
    setRacialSkillProficiencies([])
    setRacialFeatIds([])
    setDragonbornAncestry('black')
    setStartingEquipment(defaultDnd5eStartingEquipmentSelection(dnd5eStartingEquipmentPlan(nextIdentity.charClass, nextIdentity.background)))
    setStage('equipment')
  }

  const startAbilityMethod = () => {
    if (standardScores) setBaseAbilities(recommendedDnd5eBaseAbilitiesFromArray(identity.charClass, standardScores))
    if (pointBuyRule) setBaseAbilities(emptyAbilities(pointBuyRule.minimum))
    if (rollRule) {
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
    if (!pointBuyRule) return
    setBaseAbilities((current) => {
      const before = current[ability]
      const after = before + delta
      if (after < pointBuyRule.minimum || after > pointBuyRule.maximum) return current
      const costDelta = dnd5ePointBuyCostForRule(after, pointBuyRule) - dnd5ePointBuyCostForRule(before, pointBuyRule)
      if (costDelta > dnd5ePointBuyRemainingForRule(current, pointBuyRule)) return current
      return { ...current, [ability]: after }
    })
  }

  const assignCurrentRoll = (ability: AbilityKey) => {
    if (!currentRoll || assignedRollAbilities.has(ability)) return
    setBaseAbilities((current) => ({ ...current, [ability]: currentRoll.total }))
    setRolls((current) => [...current, { ...currentRoll, ability }])
    setCurrentRoll(null)
  }

  const toggleRacialBonusChoice = (ability: AbilityKey) => {
    if (!flexibleRacialBonus || flexibleRacialBonus.exclude?.includes(ability)) return
    setRacialBonusChoices((current) => current.includes(ability)
      ? current.filter((key) => key !== ability)
      : current.length < flexibleRacialBonus.count ? [...current, ability] : current)
  }

  const toggleRacialSkillChoice = (skill: string) => {
    const count = racialSkillChoiceCount
    if (count < 1) return
    setRacialSkillProficiencies((current) => current.includes(skill)
      ? current.filter((entry) => entry !== skill)
      : current.length < count ? [...current, skill] : current)
  }

  const toggleRacialFeatChoice = (featId: string) => {
    const count = racialFeatChoiceCount
    if (count < 1) return
    setRacialFeatIds((current) => current.includes(featId)
      ? current.filter((entry) => entry !== featId)
      : current.length < count ? [...current, featId] : current)
  }

  const goBack = () => {
    if (stage === 'beginner-preferences' || stage === 'identity') setStage('experience')
    else if (stage === 'ability-method') setStage('identity')
    else if (stage === 'abilities') setStage('ability-method')
    else if (stage === 'equipment') setStage(experience === 'beginner' ? 'beginner-preferences' : 'abilities')
    else if (stage === 'review') setStage('equipment')
  }

  const complete = () => {
    if (
      !name.trim() ||
      !racialBonusChoicesComplete ||
      !racialSkillChoicesComplete ||
      !racialFeatChoicesComplete
    ) return
    const pluginRace = dnd5ePluginRaceDefinition(identity.race)
    const pluginBackground = dnd5ePluginBackgroundDefinition(identity.background)
    onComplete({
      ...identity,
      race: pluginRace?.name ?? identity.race,
      background: pluginBackground?.name ?? identity.background,
      ...(pluginRace ? { dnd5eRaceId: pluginRace.id } : {}),
      ...(pluginBackground ? {
        dnd5eBackgroundId: pluginBackground.id,
        backgroundSkillProficiencies: [...pluginBackground.skillProficiencies],
      } : {}),
      ...(racialSkillProficiencies.length ? {
        racialSkillProficiencies: [...racialSkillProficiencies],
      } : {}),
      ...(racialFeatIds.length ? { racialFeatIds: [...racialFeatIds] } : {}),
      ...(requiresDragonbornAncestry ? { dragonbornAncestry } : {}),
      name: name.trim(),
      method,
      baseAbilities,
      racialBonuses,
      abilities: finalAbilities,
      racialBonusChoices,
      startingEquipment: normalizeDnd5eStartingEquipmentSelection(equipmentPlan, startingEquipment),
      recommendation: {
        source: experience === 'beginner' ? 'beginner-questionnaire' : 'build-analysis',
        recommendedClass: experience === 'beginner' ? liveRecommendation.charClass : identity.charClass,
        selectedClass: identity.charClass,
        ...(currentClassCandidate ? { classMatchPercent: currentClassCandidate.matchPercent } : {}),
        primaryAbilities: classAbilityFit.primaryAbilities,
        selectedRace: pluginRace?.name ?? identity.race,
        recommendedRaces: raceRecommendations.slice(0, 3).map((candidate) => raceLabel(candidate.race)),
        reasons: recommendationReasons,
      },
      ...(rolls.length > 0 ? { rolls } : {}),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/80 p-3 backdrop-blur-md sm:p-6">
      <div role="dialog" aria-modal="true" aria-label="创建角色 Setup" className="glass flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-7">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-arcane-300">
              <Sparkles className="h-4 w-4" /> D&D 5e 2014 角色 Setup
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-50">
              {stage === 'experience' ? '你是哪一种冒险者？' :
                stage === 'beginner-preferences' ? '先聊聊你喜欢怎样的角色' :
                    stage === 'identity' ? '选择角色框架' :
                    stage === 'ability-method' ? '选择属性生成方式' :
                      stage === 'abilities' ? '分配六项属性' :
                        stage === 'equipment' ? '选择起始装备' : '确认角色与种族调整'}
            </h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="关闭角色创建" className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {stage === 'experience' && (
            <div className="grid gap-4 md:grid-cols-2">
              <button type="button" onClick={beginBeginner} className="group rounded-3xl border border-arcane-400/20 bg-arcane-500/[0.06] p-6 text-left transition hover:border-arcane-400/50 hover:bg-arcane-500/10">
                <GraduationCap className="h-9 w-9 text-arcane-300" />
                <h3 className="mt-5 text-lg font-bold text-slate-100">初出茅庐的冒险者</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">回答十个细分偏好问题，实时查看前三职业，再按职业主属性、实际加点和种族调整生成可解释建议。</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-arcane-200">开始问答 <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
              </button>
              <button type="button" onClick={beginVeteran} className="group rounded-3xl border border-ember-400/20 bg-ember-500/[0.05] p-6 text-left transition hover:border-ember-400/45 hover:bg-ember-500/10">
                <Swords className="h-9 w-9 text-ember-300" />
                <h3 className="mt-5 text-lg font-bold text-slate-100">经验丰富的冒险者</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">先自行选择职业、种族、阵营和背景，再使用标准数组、27点购点或逐次4d6去最低值生成属性。</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-ember-200">自行构筑 <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
              </button>
            </div>
          )}

          {stage === 'beginner-preferences' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div data-testid="live-class-recommendation" className="lg:col-span-2 rounded-2xl border border-arcane-400/20 bg-gradient-to-r from-arcane-500/[0.09] to-violet-500/[0.05] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-arcane-100">即时职业倾向</p>
                    <p className="mt-1 text-xs text-slate-500">下面每次选择都会重新计算；队伍定位、战斗方式和力量来源权重最高。</p>
                  </div>
                  <span className="rounded-full bg-arcane-500/15 px-3 py-1 text-xs font-semibold text-arcane-200">当前首选：{liveRecommendation.charClass}</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {liveRecommendation.classCandidates.slice(0, 3).map((candidate, index) => (
                    <div key={candidate.charClass} data-testid={`class-recommendation-${index}`} className="rounded-xl border border-white/8 bg-black/15 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-100">{index + 1}. {candidate.charClass}</span>
                        <span className="text-xs font-mono text-arcane-300">{candidate.matchPercent}%</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{candidate.matchedPreferences.slice(0, 2).join('；')}</p>
                    </div>
                  ))}
                </div>
              </div>
              {PREFERENCE_QUESTIONS.map((question) => (
                <PreferenceQuestion
                  key={question.key}
                  question={question}
                  value={String(preferences[question.key])}
                  onChange={(value) => setPreferences((current) => ({ ...current, [question.key]: value }))}
                />
              ))}
            </div>
          )}

          {stage === 'identity' && (
            <div className="mx-auto max-w-2xl">
              <div className="mb-5 rounded-2xl border border-sky-400/15 bg-sky-500/[0.05] p-4 text-sm leading-6 text-slate-400">
                <BookOpen className="mr-2 inline h-4 w-4 text-sky-300" />
                核心仅内置 SRD 5.1 的侍僧示例和自定义背景路径；当前房间规则包提供的背景会在这里标明插件来源。
              </div>
              <IdentityFields identity={identity} raceOptions={raceOptions} backgroundOptions={backgroundOptions} onChange={updateIdentity} />
            </div>
          )}

          {stage === 'ability-method' && (
            <div className="grid gap-4 md:grid-cols-3">
              {abilityMethodOptions.map((option) => (
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
                  {option.kind === 'roll' ? <Dices className="h-6 w-6 text-arcane-300" /> :
                    option.kind === 'point-buy' ? <WandSparkles className="h-6 w-6 text-arcane-300" /> :
                      <Shield className="h-6 w-6 text-arcane-300" />}
                  <h3 className="mt-4 font-semibold text-slate-100">{option.name}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{option.summary}</p>
                  {'ownerPluginName' in option && <p className="mt-3 text-[11px] text-arcane-300">插件：{String(option.ownerPluginName)}</p>}
                </button>
              ))}
            </div>
          )}

          {stage === 'abilities' && (
            <div className="space-y-5">
              {methodKind === 'point-buy' && pointBuyRule && (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${pointBuyRemaining === 0 ? 'border-emerald-400/20 bg-emerald-500/5 text-emerald-200' : 'border-arcane-400/20 bg-arcane-500/5 text-arcane-100'}`}>
                  {pointBuyRule.budget} 点购点：已使用 {pointBuyRule.budget - pointBuyRemaining}，剩余 {pointBuyRemaining} 点。基础值范围 {pointBuyRule.minimum}～{pointBuyRule.maximum}。
                </div>
              )}
              {methodKind === 'roll' && rollRule && (
                <div className="rounded-2xl border border-arcane-400/20 bg-arcane-500/[0.05] p-5 text-center">
                  {currentRoll ? (
                    <>
                      <p className="text-xs text-slate-500">本次投掷{rollRule.dropLowest > 0 ? `，划掉 ${rollRule.dropLowest} 枚最低值` : ''}</p>
                      <div className="mt-3 flex justify-center gap-2">
                        {currentRoll.dice.map((die, index) => (
                          <span key={index} className={`flex h-11 w-11 items-center justify-center rounded-xl border font-mono text-lg font-bold ${currentRoll.discardedIndices.includes(index) ? 'border-rose-400/30 bg-rose-500/10 text-rose-300 line-through' : 'border-white/10 bg-white/5 text-slate-100'}`}>{die}</span>
                        ))}
                      </div>
                      <p className="mt-3 text-lg font-bold text-arcane-200">合计 {currentRoll.total}</p>
                      <p className="mt-1 text-xs text-slate-500">请选择要填入的属性。</p>
                    </>
                  ) : rolls.length < 6 ? (
                    <button type="button" onClick={() => setCurrentRoll(rollDnd5eAbilityScore(rollRule))} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-5 py-3 text-sm font-semibold text-white">
                      <Dices className="h-4 w-4" /> 投掷 {rollRule.diceCount}d{rollRule.dieSides}（第 {rolls.length + 1}/6 次）
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
                      <div><p className="font-semibold text-slate-100">{ability.label}</p><p className="text-[11px] text-slate-600">{ability.full}</p></div>
                      {methodKind === 'standard-array' && standardScores ? (
                        <select
                          aria-label={`${ability.label}基础值`}
                          value={baseAbilities[ability.key]}
                          onChange={(event) => assignStandardValue(ability.key, Number(event.target.value))}
                          className="rounded-xl border border-white/10 bg-void-900 px-3 py-2 font-mono text-lg font-bold text-slate-100"
                        >
                          {[...new Set(standardScores)].map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                      ) : methodKind === 'point-buy' ? (
                        <div className="flex items-center gap-2">
                          <button type="button" aria-label={`降低${ability.label}`} onClick={() => adjustPointBuy(ability.key, -1)} className="h-8 w-8 rounded-lg border border-white/10 text-slate-300">−</button>
                          <span className="w-8 text-center font-mono text-xl font-bold text-slate-100">{baseAbilities[ability.key]}</span>
                          <button type="button" aria-label={`提高${ability.label}`} onClick={() => adjustPointBuy(ability.key, 1)} className="h-8 w-8 rounded-lg border border-white/10 text-slate-300">+</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`${ability.label}${assignedRollAbilities.has(ability.key) ? `已分配${baseAbilities[ability.key]}` : currentRoll ? `填入${currentRoll.total}` : '未分配'}`}
                          disabled={!currentRoll || assignedRollAbilities.has(ability.key)}
                          onClick={() => assignCurrentRoll(ability.key)}
                          className="min-w-20 rounded-xl border border-white/10 px-3 py-2 font-mono text-lg font-bold text-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          {assignedRollAbilities.has(ability.key) ? baseAbilities[ability.key] : currentRoll ? `填入 ${currentRoll.total}` : '未分配'}
                        </button>
                      )}
                    </div>
                    {methodKind === 'point-buy' && pointBuyRule && <p className="mt-2 text-[11px] text-slate-600">当前成本 {dnd5ePointBuyCostForRule(baseAbilities[ability.key], pointBuyRule)} 点</p>}
                  </div>
                ))}
              </div>
              {methodKind === 'roll' && rolls.length > 0 && (
                <button type="button" onClick={() => { setBaseAbilities(emptyAbilities()); setRolls([]); setCurrentRoll(null) }} className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-200">
                  <RotateCcw className="h-3.5 w-3.5" /> 清空并重新投掷全部属性
                </button>
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
              <div data-testid="build-recommendation-review" className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-arcane-400/20 bg-arcane-500/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-arcane-100">{experience === 'beginner' ? '职业推荐理由' : '职业主属性检查'}</p>
                    {currentClassCandidate && <span className="rounded-full bg-arcane-500/15 px-2 py-1 text-[11px] font-mono text-arcane-200">问卷匹配 {currentClassCandidate.matchPercent}%</span>}
                  </div>
                  {experience === 'beginner' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {liveRecommendation.classCandidates.slice(0, 3).map((candidate, index) => (
                        <span key={candidate.charClass} className={`rounded-lg border px-2.5 py-1 text-xs ${candidate.charClass === identity.charClass ? 'border-arcane-300/35 bg-arcane-500/15 text-arcane-100' : 'border-white/8 text-slate-500'}`}>
                          {index + 1}. {candidate.charClass} · {candidate.matchPercent}%
                        </span>
                      ))}
                    </div>
                  )}
                  <p className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${classAbilityFit.rating === 'weak' ? 'border-amber-400/20 bg-amber-500/5 text-amber-200' : 'border-emerald-400/15 bg-emerald-500/5 text-emerald-200'}`}>
                    {classAbilityFit.summary}
                  </p>
                  <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-400">
                    {(currentClassCandidate?.reasons ?? []).slice(0, 3).map((reason) => <li key={reason}>· {reason}</li>)}
                  </ul>
                </div>

                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.05] p-4">
                  <p className="text-sm font-semibold text-amber-100">主属性与种族建议</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    按当前基础加点和{identity.charClass}主属性重新计算；这是优化建议，不限制角色概念。
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {raceRecommendations.slice(0, 3).map((candidate, index) => (
                      <div key={candidate.race} className={`rounded-xl border px-2.5 py-2 ${candidate.race === identity.race ? 'border-amber-300/35 bg-amber-500/10' : 'border-white/8 bg-black/10'}`}>
                        <p className="text-xs font-semibold text-slate-200">{index + 1}. {raceLabel(candidate.race)}</p>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{candidate.reasons[0]}</p>
                      </div>
                    ))}
                  </div>
                  <p data-testid="selected-race-advice" className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${topRaceCandidate?.race === identity.race ? 'border-emerald-400/15 bg-emerald-500/5 text-emerald-200' : 'border-amber-400/20 bg-amber-500/5 text-amber-200'}`}>
                    {topRaceCandidate?.race === identity.race
                      ? `当前选择的${raceLabel(identity.race)}就是首选建议。${currentRaceCandidate?.reasons[0] ?? ''}`
                      : `当前选择为${raceLabel(identity.race)}；若优先优化主属性，建议考虑${raceLabel(topRaceCandidate?.race ?? identity.race)}。${topRaceCandidate?.reasons[0] ?? ''}`}
                  </p>
                </div>
              </div>
              {(racialSkillChoiceCount || racialFeatChoiceCount || requiresDragonbornAncestry) ? (
                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.04] p-4">
                  <h3 className="text-sm font-semibold text-cyan-100">种族选择</h3>
                  {requiresDragonbornAncestry ? (
                    <div className="mt-3">
                      <p className="text-xs text-slate-400">选择龙族血统；该选择会决定吐息的伤害类型、区域、豁免属性与对应抗性。</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        {DND5E_DRAGONBORN_ANCESTRIES.map((ancestry) => (
                          <button
                            key={ancestry.id}
                            type="button"
                            aria-pressed={dragonbornAncestry === ancestry.id}
                            onClick={() => setDragonbornAncestry(ancestry.id)}
                            className={`rounded-xl border px-3 py-2 text-left ${
                              dragonbornAncestry === ancestry.id
                                ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100'
                                : 'border-white/8 bg-black/10 text-slate-400'
                            }`}
                          >
                            <span className="block text-xs font-semibold">{ancestry.name}</span>
                            <span className="mt-1 block text-[10px] opacity-70">
                              {ancestry.damageType} · {ancestry.area.shape === 'cone' ? '15 尺锥形' : '5×30 尺线形'} · {ancestry.saveAbility.toUpperCase()}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {racialSkillChoiceCount ? (
                    <div className="mt-3">
                      <p className="text-xs text-slate-400">
                        选择 {racialSkillChoiceCount} 项技能熟练
                        （已选 {racialSkillProficiencies.length}）
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {SKILLS.map((skill) => (
                          <button
                            key={skill.key}
                            type="button"
                            aria-pressed={racialSkillProficiencies.includes(skill.key)}
                            onClick={() => toggleRacialSkillChoice(skill.key)}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                              racialSkillProficiencies.includes(skill.key)
                                ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-100'
                                : 'border-white/8 text-slate-500'
                            }`}
                          >
                            {skill.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {racialFeatChoiceCount ? (
                    <div className="mt-4">
                      <p className="text-xs text-slate-400">
                        选择 {racialFeatChoiceCount} 项专长
                        （已选 {racialFeatIds.length}）
                      </p>
                      {racialFeatOptions.length > 0 ? (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {racialFeatOptions.map((feat) => (
                            <button
                              key={feat.id}
                              type="button"
                              aria-pressed={racialFeatIds.includes(feat.id)}
                              onClick={() => toggleRacialFeatChoice(feat.id)}
                              className={`rounded-xl border px-3 py-2 text-left ${
                                racialFeatIds.includes(feat.id)
                                  ? 'border-amber-300/40 bg-amber-400/10 text-amber-100'
                                  : 'border-white/8 bg-black/10 text-slate-400'
                              }`}
                            >
                              <span className="block text-sm font-semibold">{feat.name}</span>
                              <span className="mt-1 block text-[11px] leading-4 opacity-70">{feat.summary}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 rounded-xl border border-amber-400/15 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                          当前房间没有满足条件的本地专长。请先把专长条目加入同一合集后重新导入。
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div data-testid="starting-equipment-review" className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.04] p-4">
                <div className="flex items-center gap-2"><Backpack className="h-4 w-4 text-violet-300" /><h3 className="text-sm font-semibold text-violet-100">起始装备确认</h3></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {dnd5eStartingEquipmentSummary(equipmentPlan, startingEquipment).map((line) => <p key={line} className="rounded-xl border border-white/8 bg-black/10 px-3 py-2 text-xs text-slate-400">{line}</p>)}
                </div>
              </div>
              <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">角色名称</span>
                    <input autoFocus aria-label="角色名称" value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-white/10 bg-void-900/80 px-4 py-3 text-sm text-slate-100 outline-none focus:border-arcane-400/50" />
                  </label>
                  <IdentityFields identity={identity} raceOptions={raceOptions} backgroundOptions={backgroundOptions} onChange={updateIdentity} />
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-semibold text-slate-100">属性确认</h3><p className="mt-1 text-xs text-slate-500">先确定基础值，最后加入种族属性调整。</p></div>
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">{method === 'beginner-recommended' ? '推荐标准数组' : abilityMethodOptions.find((item) => item.id === method)?.name}</span>
                  </div>
                  {flexibleRacialBonus && (
                    <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
                      <p className="text-xs font-semibold text-amber-100">
                        {dnd5ePluginRaceDefinition(identity.race)?.name ?? identity.race}：选择 {flexibleRacialBonus.count} 项属性，
                        每项 {flexibleRacialBonus.amount > 0 ? '+' : ''}{flexibleRacialBonus.amount}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ABILITIES.filter((ability) => !flexibleRacialBonus.exclude?.includes(ability.key)).map((ability) => (
                          <button key={ability.key} type="button" aria-pressed={racialBonusChoices.includes(ability.key)} onClick={() => toggleRacialBonusChoice(ability.key)} className={`rounded-lg border px-2.5 py-1.5 text-xs ${racialBonusChoices.includes(ability.key) ? 'border-amber-300/40 bg-amber-400/15 text-amber-100' : 'border-white/8 text-slate-500'}`}>{ability.label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-4 space-y-2">
                    {ABILITIES.map((ability) => (
                      <div key={ability.key} className="grid grid-cols-[1fr_auto] items-center rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2.5">
                        <span className="text-sm text-slate-300">{ability.label}</span>
                        <div className="flex items-center gap-2 font-mono text-sm">
                          <span className="text-slate-400">{baseAbilities[ability.key]}</span>
                          <span className="text-slate-600">+</span>
                          <span className={racialBonuses[ability.key] > 0 ? 'text-emerald-300' : 'text-slate-600'}>{racialBonuses[ability.key]}</span>
                          <span className="text-slate-600">=</span>
                          <span className="w-7 text-right text-lg font-bold text-slate-100">{finalAbilities[ability.key]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {stage !== 'experience' && (
          <footer className="flex items-center justify-between gap-3 border-t border-white/8 px-5 py-4 sm:px-7">
            <button type="button" onClick={goBack} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200"><ArrowLeft className="h-4 w-4" /> 返回</button>
            {stage === 'beginner-preferences' && <button type="button" onClick={finishRecommendation} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-5 py-2.5 text-sm font-semibold text-white">生成推荐 <Sparkles className="h-4 w-4" /></button>}
            {stage === 'identity' && <button type="button" onClick={() => setStage('ability-method')} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-5 py-2.5 text-sm font-semibold text-white">选择属性方式 <ArrowRight className="h-4 w-4" /></button>}
            {stage === 'ability-method' && <button type="button" onClick={startAbilityMethod} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-5 py-2.5 text-sm font-semibold text-white">开始分配 <ArrowRight className="h-4 w-4" /></button>}
            {stage === 'abilities' && <button type="button" disabled={!abilityAllocationComplete} onClick={() => { setRacialBonusChoices(recommendedDnd5eRacialBonusChoices(identity.race, identity.charClass, baseAbilities)); setStage('equipment') }} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">加入种族调整并选择装备 <ArrowRight className="h-4 w-4" /></button>}
            {stage === 'equipment' && <button type="button" onClick={() => setStage('review')} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-arcane-500 px-5 py-2.5 text-sm font-semibold text-white">确认起始装备 <ArrowRight className="h-4 w-4" /></button>}
            {stage === 'review' && <button type="button" disabled={!name.trim() || !racialBonusChoicesComplete || !racialSkillChoicesComplete || !racialFeatChoicesComplete} onClick={complete} className="glow-arcane inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-arcane-600 to-arcane-500 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-4 w-4" /> 创建角色</button>}
          </footer>
        )}
      </div>
    </div>
  )
}
