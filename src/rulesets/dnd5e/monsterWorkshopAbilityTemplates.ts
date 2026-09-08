import {
  createDnd5eCustomMonsterTraitDraft,
  dnd5eCustomMonsterDraftFromStatBlock,
  type Dnd5eCustomMonsterActionDraft,
  type Dnd5eCustomMonsterDraft,
  type Dnd5eCustomMonsterTraitDraft,
  type Dnd5eMonsterWorkshopTemplateSource,
} from './customMonsterWorkshop'
import {
  DND5E_SRD_MONSTERS,
  dnd5eMonsterProficiencyBonus,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterTrait,
} from './monsters'
import { dnd5eMonsterActionAutomation } from './monsterSchema'

export type Dnd5eMonsterAbilityTemplateSection = Dnd5eMonsterWorkshopTemplateSource['section']

export interface Dnd5eMonsterAbilityTemplate {
  id: string
  section: Dnd5eMonsterAbilityTemplateSection
  name: string
  description: string
  sourceMonsterId: string
  sourceMonsterName: string
  sourceMonsterEnglishName: string
  /** Number of identical SRD abilities collapsed into this reusable template. */
  sourceCount: number
  ruleKind: string
  mechanicTags: readonly string[]
  dependencyCount: number
  /** Basic workshop editor that intentionally replaces source-specific parameters. */
  parameterEditor?:
    | 'charge'
    | 'regeneration'
    | 'magic-weapons'
    | 'relentless'
    | 'sneak-attack'
    | 'surprise-attack'
    | 'stench'
  searchText: string
  sourceIndex: number
}

export interface Dnd5eMonsterAbilityTemplateApplication {
  draft: Dnd5eCustomMonsterDraft
  addedActionIds: readonly string[]
  addedMultiattackIds: readonly string[]
  addedTraitIndexes: readonly number[]
}

interface CanonicalActionEntry {
  section: Exclude<Dnd5eMonsterAbilityTemplateSection, 'trait'>
  category: Dnd5eCustomMonsterActionDraft['category']
  action: Dnd5eMonsterAction
  sourceIndex: number
}

const ACTION_SECTIONS = [
  { section: 'action', category: 'action', read: (monster: Dnd5eMonsterStatBlock) => monster.actions },
  { section: 'bonus-action', category: 'bonus-action', read: (monster: Dnd5eMonsterStatBlock) => monster.bonusActions ?? [] },
  { section: 'reaction', category: 'reaction', read: (monster: Dnd5eMonsterStatBlock) => monster.reactions ?? [] },
  { section: 'legendary', category: 'legendary', read: (monster: Dnd5eMonsterStatBlock) => monster.legendaryActions ?? [] },
  { section: 'lair', category: 'lair', read: (monster: Dnd5eMonsterStatBlock) => monster.lairActions ?? [] },
] as const

const ACTION_REFERENCE_KEYS = new Set([
  'actionId',
  'referencedActionId',
  'bonusActionWeaponActionId',
  'reactionTriggerActionId',
])

function slugPart(value: string): string {
  return value.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'ability'
}

function actionEntries(monster: Dnd5eMonsterStatBlock): CanonicalActionEntry[] {
  return ACTION_SECTIONS.flatMap(({ section, category, read }) =>
    read(monster).map((action, sourceIndex) => ({ section, category, action, sourceIndex })))
}

function collectActionReferenceIds(value: unknown, parentKey = ''): string[] {
  if (typeof value === 'string') {
    return ACTION_REFERENCE_KEYS.has(parentKey) ? [value] : []
  }
  if (Array.isArray(value)) {
    if (parentKey === 'sequence') return value.filter((entry): entry is string => typeof entry === 'string')
    return value.flatMap((entry) => collectActionReferenceIds(entry))
  }
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, entry]) => collectActionReferenceIds(entry, key))
}

function dependencyClosure(monster: Dnd5eMonsterStatBlock, value: unknown): CanonicalActionEntry[] {
  const entries = actionEntries(monster)
  const byId = new Map<string, CanonicalActionEntry[]>()
  for (const entry of entries) byId.set(entry.action.id, [...(byId.get(entry.action.id) ?? []), entry])
  const result: CanonicalActionEntry[] = []
  const visited = new Set<string>()
  const queue = collectActionReferenceIds(value)
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const entry = byId.get(id)?.find((candidate) => candidate.section === 'action') ?? byId.get(id)?.[0]
    if (!entry) continue
    result.push(entry)
    queue.push(...collectActionReferenceIds(entry.action))
  }
  return result
}

function actionRuleKind(action: Dnd5eMonsterAction): string {
  if (action.kind === 'multiattack') return 'multiattack'
  if (action.rule) return action.rule.kind
  if (action.attack?.onHitRule) return `weapon:${action.attack.onHitRule.kind}`
  return action.kind
}

const TEMPLATE_SIGNATURE_OMITTED_KEYS = new Set([
  'id',
  'name',
  'description',
  'automation',
])
const ACTION_REFERENCE_SIGNATURE_CACHE = new WeakMap<Dnd5eMonsterStatBlock, ReadonlyMap<string, string>>()

function normalizedTemplateName(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ')
}

function configurableTraitParameterEditor(input: {
  section: Dnd5eMonsterAbilityTemplateSection
  name: string
  ruleKind: string
  mechanic: unknown
}): Dnd5eMonsterAbilityTemplate['parameterEditor'] {
  if (input.section !== 'trait') return undefined
  const name = input.name.trim()
  if (input.ruleKind === 'charge-damage' && /^冲锋(?:\s*[（(].*[）)])?$/u.test(name)) return 'charge'
  if (input.ruleKind === 'regeneration' && name === '再生') return 'regeneration'
  if (input.ruleKind === 'magic-weapons') return 'magic-weapons'
  if (input.ruleKind === 'relentless' && name === '坚韧不屈') return 'relentless'
  if (input.ruleKind === 'sneak-attack') return 'sneak-attack'
  if (input.ruleKind === 'surprise-attack') return 'surprise-attack'
  if (
    input.ruleKind === 'turn-start-saving-throw-aura' &&
    input.mechanic != null &&
    typeof input.mechanic === 'object' &&
    (input.mechanic as { ruleId?: unknown }).ruleId === 'stench'
  ) return 'stench'
  return undefined
}

function configurableTraitName(
  editor: Dnd5eMonsterAbilityTemplate['parameterEditor'],
  fallback: string,
): string {
  if (editor === 'charge') return '冲锋'
  if (editor === 'magic-weapons') return '魔法武器'
  if (editor === 'sneak-attack') return '偷袭（每回合 1 次）'
  if (editor === 'surprise-attack') return '突袭攻击'
  if (editor === 'stench') return '恶臭'
  return fallback
}

function configurableTraitDescription(
  editor: NonNullable<Dnd5eMonsterAbilityTemplate['parameterEditor']>,
): string {
  if (editor === 'charge') return '如果【名称】在同一回合直线移动至少指定距离，并以指定攻击命中目标，目标会受到 DM 填写的额外伤害；DM 还可设置命中后的豁免与失败状态。'
  if (editor === 'regeneration') return '【名称】在回合开始时恢复由 DM 设置的生命值；DM 可以设置压制再生的伤害类型及 0 HP 行为。'
  if (editor === 'magic-weapons') return '【名称】的武器攻击视为魔法攻击。'
  if (editor === 'relentless') return '当一次不超过 DM 设置阈值的伤害会使【名称】降至 0 HP 时，它改为降至 1 HP。'
  if (editor === 'sneak-attack') return '每回合一次，【名称】以具有优势的武器攻击命中，或目标邻近其未失能盟友且攻击不具有劣势时，造成 DM 填写的额外伤害。'
  if (editor === 'surprise-attack') return '【名称】在战斗第一轮命中仍处于受惊状态的目标时，造成 DM 填写的额外伤害。'
  return '在一个生物于【名称】的灵光范围内开始回合时，它必须进行体质豁免，失败则中毒至其下一回合开始；成功后在 24 小时内免疫该来源。'
}

function normalizedMechanicValue(
  value: unknown,
  actionReferences: ReadonlyMap<string, string>,
  parentKey = '',
): unknown {
  if (typeof value === 'string') {
    if (ACTION_REFERENCE_KEYS.has(parentKey)) return actionReferences.get(value) ?? '@action-reference'
    return value.normalize('NFKC').trim()
  }
  if (Array.isArray(value)) {
    if (parentKey === 'sequence') {
      return value.map((entry) => typeof entry === 'string'
        ? actionReferences.get(entry) ?? '@action-reference'
        : normalizedMechanicValue(entry, actionReferences))
    }
    return value.map((entry) => normalizedMechanicValue(entry, actionReferences))
  }
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key, entry]) => !TEMPLATE_SIGNATURE_OMITTED_KEYS.has(key) && entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, normalizedMechanicValue(entry, actionReferences, key)]))
}

function actionReferenceSignatures(monster: Dnd5eMonsterStatBlock): ReadonlyMap<string, string> {
  const cached = ACTION_REFERENCE_SIGNATURE_CACHE.get(monster)
  if (cached) return cached
  const placeholderReferences = new Map<string, string>()
  for (const entry of actionEntries(monster)) placeholderReferences.set(entry.action.id, '@action-reference')
  const result = new Map(actionEntries(monster).map((entry) => [
    entry.action.id,
    JSON.stringify(normalizedMechanicValue(entry.action, placeholderReferences)),
  ]))
  ACTION_REFERENCE_SIGNATURE_CACHE.set(monster, result)
  return result
}

function templateSemanticKey(input: {
  monster: Dnd5eMonsterStatBlock
  section: Dnd5eMonsterAbilityTemplateSection
  name: string
  ruleKind: string
  mechanic: unknown
}): string {
  const parameterEditor = configurableTraitParameterEditor(input)
  if (parameterEditor) {
    return `trait|configurable-${parameterEditor}|${input.ruleKind}`
  }
  return [
    input.section,
    normalizedTemplateName(input.name),
    JSON.stringify(normalizedMechanicValue(input.mechanic, actionReferenceSignatures(input.monster))),
  ].join('|')
}

function escapedRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function genericTemplateDescription(
  monster: Dnd5eMonsterStatBlock,
  description: string,
  ruleKind: string,
): string {
  if (ruleKind === 'magic-resistance') {
    return '【名称】对抗法术和其他魔法效应时进行的豁免检定具有优势。'
  }
  let result = description.trim()
  if (!result) return '【名称】拥有此能力。'
  const names = [monster.name, monster.englishName]
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
  for (const name of names) result = result.replace(new RegExp(escapedRegExp(name), 'giu'), '【名称】')
  result = result
    .replace(/^(?:该|此|这名|这只)(?:生物|怪物|魔物|魔鬼|恶魔|邪魔|构装体|亡灵|龙|野兽|元素|异怪|天界生物)/u, '【名称】')
    .replace(/^它(?=[在对可会能不具受免进发使获造拥])/u, '【名称】')
    .replace(/^其(?=[武攻豁速移法动特生])/u, '【名称】的')
  if (!result.includes('【名称】')) result = `【名称】：${result}`
  return result
}

function instantiateTemplateDescription(description: string, monsterName: string): string {
  return description.replace(/【名称】/gu, monsterName.trim() || '该怪物')
}

function ruleMechanicTags(ruleKind: string): readonly string[] {
  if (ruleKind === 'source-linked-engulf') {
    return ['共享空间', '吞没', '携带', '逃脱', '持续伤害']
  }
  if (ruleKind === 'source-linked-reel') return ['关系目标', '拖拽', '强制移动']
  if (ruleKind === 'throw-linked-target') return ['关系目标', '投掷', '碰撞伤害', '强制移动']
  if (ruleKind === 'area-saving-throw') return ['范围豁免', '范围伤害']
  if (ruleKind === 'charge-damage') return ['移动后命中', '直线移动', '追加伤害']
  if (ruleKind === 'regeneration') return ['回合开始', '恢复生命', '伤害压制']
  if (ruleKind === 'magic-weapons') return ['魔法攻击']
  if (ruleKind === 'relentless') return ['降至 0 HP', '保留 1 HP', '伤害阈值']
  if (ruleKind === 'sneak-attack') return ['每回合一次', '优势', '相邻盟友', '追加伤害']
  if (ruleKind === 'surprise-attack') return ['首轮', '受惊目标', '追加伤害']
  if (ruleKind === 'turn-start-saving-throw-aura') return ['回合开始', '范围豁免', '状态效果']
  if (ruleKind.startsWith('weapon:source-linked-condition')) {
    return ['擒抱', '附着', '吞咽', '关系目标']
  }
  return []
}

function templateSearchText(
  monster: Dnd5eMonsterStatBlock,
  section: Dnd5eMonsterAbilityTemplateSection,
  name: string,
  description: string,
  ruleKind: string,
  mechanicTags: readonly string[] = ruleMechanicTags(ruleKind),
): string {
  return [name, description, ruleKind, ...mechanicTags, section, monster.name, monster.englishName, monster.id]
    .join(' ')
    .toLocaleLowerCase('zh-CN')
}

export function buildDnd5eMonsterAbilityTemplateCatalog(
  monsters: readonly Dnd5eMonsterStatBlock[] = DND5E_SRD_MONSTERS,
): readonly Dnd5eMonsterAbilityTemplate[] {
  const templates = new Map<string, Dnd5eMonsterAbilityTemplate>()
  const addTemplate = (key: string, template: Dnd5eMonsterAbilityTemplate) => {
    const current = templates.get(key)
    if (!current) {
      templates.set(key, template)
      return
    }
    templates.set(key, {
      ...current,
      sourceCount: current.sourceCount + 1,
      searchText: `${current.searchText} ${template.searchText}`,
    })
  }
  for (const monster of monsters) {
    monster.traits.forEach((trait, sourceIndex) => {
      if (trait.automation !== 'headless' || !trait.rule) return
      const ruleKind = trait.rule.kind
      const mechanicTags = ruleMechanicTags(ruleKind)
      const parameterEditor = configurableTraitParameterEditor({
        section: 'trait',
        name: trait.name,
        ruleKind,
        mechanic: trait.rule,
      })
      const templateName = configurableTraitName(parameterEditor, trait.name)
      addTemplate(templateSemanticKey({ monster, section: 'trait', name: templateName, ruleKind, mechanic: trait.rule }), {
        id: `${monster.id}:trait:${sourceIndex}:${slugPart(templateName)}`,
        section: 'trait',
        name: templateName,
        description: parameterEditor
          ? configurableTraitDescription(parameterEditor)
          : genericTemplateDescription(monster, trait.description, ruleKind),
        sourceMonsterId: monster.id,
        sourceMonsterName: monster.name,
        sourceMonsterEnglishName: monster.englishName,
        sourceCount: 1,
        ruleKind,
        mechanicTags,
        dependencyCount: parameterEditor ? 0 : dependencyClosure(monster, trait).length,
        parameterEditor,
        searchText: templateSearchText(monster, 'trait', trait.name, trait.description, ruleKind),
        sourceIndex,
      })
    })
    for (const entry of actionEntries(monster)) {
      if (dnd5eMonsterActionAutomation(entry.action) !== 'headless') continue
      const ruleKind = actionRuleKind(entry.action)
      const mechanicTags = ruleMechanicTags(ruleKind)
      addTemplate(templateSemanticKey({ monster, section: entry.section, name: entry.action.name, ruleKind, mechanic: entry.action }), {
        id: `${monster.id}:${entry.section}:${entry.sourceIndex}:${slugPart(entry.action.id)}`,
        section: entry.section,
        name: entry.action.name,
        description: genericTemplateDescription(monster, entry.action.description, ruleKind),
        sourceMonsterId: monster.id,
        sourceMonsterName: monster.name,
        sourceMonsterEnglishName: monster.englishName,
        sourceCount: 1,
        ruleKind,
        mechanicTags,
        dependencyCount: dependencyClosure(monster, entry.action).length,
        searchText: templateSearchText(monster, entry.section, entry.action.name, entry.action.description, ruleKind),
        sourceIndex: entry.sourceIndex,
      })
    }
  }
  return [...templates.values()].sort((left, right) =>
    left.section.localeCompare(right.section) ||
    left.name.localeCompare(right.name, 'zh-CN') ||
    left.sourceMonsterName.localeCompare(right.sourceMonsterName, 'zh-CN'))
}

export const DND5E_MONSTER_ABILITY_TEMPLATES = buildDnd5eMonsterAbilityTemplateCatalog()

export function dnd5eMonsterWorkshopDefaultSaveDc(
  draft: Pick<Dnd5eCustomMonsterDraft, 'abilities' | 'challengeRating'>,
  ability: keyof Dnd5eCustomMonsterDraft['abilities'],
): number {
  const abilityModifier = Math.floor((draft.abilities[ability] - 10) / 2)
  return Math.max(1, Math.min(
    100,
    8 + dnd5eMonsterProficiencyBonus(draft.challengeRating) + abilityModifier,
  ))
}

function uniqueActionId(original: string, used: Set<string>): string {
  if (!used.has(original)) {
    used.add(original)
    return original
  }
  let suffix = 2
  while (used.has(`${original}-${suffix}`)) suffix += 1
  const result = `${original}-${suffix}`
  used.add(result)
  return result
}

function rebaseActionReferences<T>(value: T, idMap: ReadonlyMap<string, string>, parentKey = ''): T {
  if (typeof value === 'string') {
    return (ACTION_REFERENCE_KEYS.has(parentKey) ? idMap.get(value) ?? value : value) as T
  }
  if (Array.isArray(value)) {
    if (parentKey === 'sequence') {
      return value.map((entry) => typeof entry === 'string' ? idMap.get(entry) ?? entry : entry) as T
    }
    return value.map((entry) => rebaseActionReferences(entry, idMap)) as T
  }
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    rebaseActionReferences(entry, idMap, key),
  ])) as T
}

function sourceActionEntry(monster: Dnd5eMonsterStatBlock, template: Dnd5eMonsterAbilityTemplate): CanonicalActionEntry {
  const entry = actionEntries(monster).find((candidate) =>
    candidate.section === template.section && candidate.sourceIndex === template.sourceIndex)
  if (!entry) throw new Error(`模板“${template.name}”的来源动作已不存在`)
  return entry
}

function importActionEntries(
  draft: Dnd5eCustomMonsterDraft,
  monster: Dnd5eMonsterStatBlock,
  entries: readonly CanonicalActionEntry[],
  source: Dnd5eMonsterWorkshopTemplateSource,
): Pick<Dnd5eMonsterAbilityTemplateApplication, 'draft' | 'addedActionIds' | 'addedMultiattackIds'> & {
  idMap: ReadonlyMap<string, string>
} {
  const uniqueEntries = entries.filter((entry, index, all) =>
    all.findIndex((candidate) => candidate.section === entry.section && candidate.action.id === entry.action.id) === index)
  const usedIds = new Set([
    ...draft.actions.map((action) => action.id),
    ...(draft.preservedStatBlock?.actions ?? [])
      .filter((action) => action.kind === 'multiattack')
      .map((action) => action.id),
    ...(draft.preservedMultiattacks ?? []).map((action) => action.id),
  ])
  const assignedIds = new Map(uniqueEntries.map((entry) => [
    `${entry.section}:${entry.action.id}`,
    uniqueActionId(entry.action.id, usedIds),
  ]))
  const idMap = new Map<string, string>()
  for (const entry of uniqueEntries) {
    const assignedId = assignedIds.get(`${entry.section}:${entry.action.id}`)!
    if (!idMap.has(entry.action.id) || entry.section === 'action') idMap.set(entry.action.id, assignedId)
  }
  const sourceDraft = dnd5eCustomMonsterDraftFromStatBlock(monster)
  const addedActions: Dnd5eCustomMonsterActionDraft[] = []
  const addedMultiattacks: Dnd5eMonsterAction[] = []

  for (const entry of uniqueEntries) {
    const rebased = rebaseActionReferences(structuredClone(entry.action), idMap)
    rebased.id = assignedIds.get(`${entry.section}:${entry.action.id}`)!
    if (rebased.kind === 'multiattack') {
      addedMultiattacks.push(rebased)
      continue
    }
    const projection = sourceDraft.actions.find((action) =>
      action.id === entry.action.id && action.category === entry.category)
    if (!projection) throw new Error(`模板“${entry.action.name}”无法建立工坊编辑投影`)
    addedActions.push({
      ...structuredClone(projection),
      id: rebased.id,
      name: rebased.name,
      description: rebased.description,
      category: entry.category,
      automation: rebased.automation ?? projection.automation,
      attacksPerAction: 1,
      referencedActionId: rebased.referencedActionId ?? '',
      reactionTriggerActionId: rebased.reactionTrigger?.actionId ?? '',
      preservedAction: rebased,
      templateSource: source,
    })
  }

  return {
    draft: {
      ...draft,
      actions: [...draft.actions, ...addedActions],
      preservedMultiattacks: [...(draft.preservedMultiattacks ?? []), ...addedMultiattacks],
    },
    addedActionIds: addedActions.map((action) => action.id),
    addedMultiattackIds: addedMultiattacks.map((action) => action.id),
    idMap,
  }
}

export function applyDnd5eMonsterAbilityTemplate(
  draft: Dnd5eCustomMonsterDraft,
  templateId: string,
  monsters: readonly Dnd5eMonsterStatBlock[] = DND5E_SRD_MONSTERS,
  templates: readonly Dnd5eMonsterAbilityTemplate[] = DND5E_MONSTER_ABILITY_TEMPLATES,
): Dnd5eMonsterAbilityTemplateApplication {
  const template = templates.find((candidate) => candidate.id === templateId)
  if (!template) throw new Error('找不到所选 Headless 能力模板')
  const monster = monsters.find((candidate) => candidate.id === template.sourceMonsterId)
  if (!monster) throw new Error(`找不到模板来源怪物“${template.sourceMonsterName}”`)
  const source: Dnd5eMonsterWorkshopTemplateSource = {
    templateId: template.id,
    monsterId: monster.id,
    monsterName: template.sourceCount > 1 ? `通用模板（${template.sourceCount} 个来源）` : monster.name,
    section: template.section,
  }

  if (template.section === 'trait' && template.parameterEditor) {
    const traitIndex = draft.traits.length
    const defaultAttack = draft.actions.find((action) =>
      action.category === 'action' && action.kind === 'weapon-attack')
    const configuredTrait: Dnd5eCustomMonsterTraitDraft = {
      ...createDnd5eCustomMonsterTraitDraft(),
      name: template.name,
      description: instantiateTemplateDescription(template.description, draft.name),
      automation: 'headless',
      templateSource: source,
    }
    if (template.parameterEditor === 'charge') {
      Object.assign(configuredTrait, {
        ruleKind: 'charge-damage' as const,
        chargeMinimumFeet: 20,
        chargeActionId: defaultAttack?.id ?? '',
        chargeDamageDice: '2d6',
        chargeDamageType: defaultAttack?.damageType ?? 'bludgeoning',
        chargeSaveEnabled: true,
        chargeSaveAbility: 'str' as const,
        chargeSaveDc: dnd5eMonsterWorkshopDefaultSaveDc(draft, 'str'),
        chargeSaveCondition: 'prone' as const,
      })
    } else if (template.parameterEditor === 'regeneration') {
      Object.assign(configuredTrait, {
        ruleKind: 'regeneration' as const,
        amount: 10,
        requiresPositiveHp: true,
        damageTypes: [],
        diesAtZeroWhenSuppressed: false,
      })
    } else if (template.parameterEditor === 'magic-weapons') {
      configuredTrait.ruleKind = 'magic-weapons'
    } else if (template.parameterEditor === 'relentless') {
      Object.assign(configuredTrait, { ruleKind: 'relentless' as const, relentlessMaximumDamage: 10 })
    } else if (template.parameterEditor === 'sneak-attack') {
      Object.assign(configuredTrait, { ruleKind: 'sneak-attack' as const, sneakAttackDamageDice: '2d6' })
    } else if (template.parameterEditor === 'surprise-attack') {
      Object.assign(configuredTrait, { ruleKind: 'surprise-attack' as const, surpriseAttackDamageDice: '2d6' })
    } else {
      Object.assign(configuredTrait, {
        ruleKind: 'stench' as const,
        stenchRangeFeet: 10,
        stenchSaveDc: dnd5eMonsterWorkshopDefaultSaveDc(draft, 'con'),
      })
    }
    return {
      draft: {
        ...draft,
        traits: [...draft.traits, configuredTrait],
      },
      addedActionIds: [],
      addedMultiattackIds: [],
      addedTraitIndexes: [traitIndex],
    }
  }

  if (template.section !== 'trait') {
    const primary = sourceActionEntry(monster, template)
    const imported = importActionEntries(
      draft,
      monster,
      [primary, ...dependencyClosure(monster, primary.action)],
      source,
    )
    const primaryId = imported.idMap.get(primary.action.id)
    const description = instantiateTemplateDescription(template.description, draft.name)
    return {
      ...imported,
      draft: {
        ...imported.draft,
        actions: imported.draft.actions.map((action) => action.id === primaryId
          ? {
              ...action,
              name: template.name,
              description,
              preservedAction: action.preservedAction
                ? { ...action.preservedAction, name: template.name, description }
                : action.preservedAction,
            }
          : action),
        preservedMultiattacks: imported.draft.preservedMultiattacks?.map((action) => action.id === primaryId
          ? { ...action, name: template.name, description }
          : action),
      },
      addedTraitIndexes: [],
    }
  }

  const trait = monster.traits[template.sourceIndex]
  if (!trait || trait.automation !== 'headless' || !trait.rule) {
    throw new Error(`模板“${template.name}”不再是可复用的 Headless 特性`)
  }
  const dependencies = dependencyClosure(monster, trait)
  const imported = importActionEntries(draft, monster, dependencies, source)
  const sourceDraft = dnd5eCustomMonsterDraftFromStatBlock(monster)
  const projection = sourceDraft.traits[template.sourceIndex]
  if (!projection) throw new Error(`模板“${template.name}”无法建立工坊编辑投影`)
  const rebasedTrait: Dnd5eMonsterTrait = rebaseActionReferences(structuredClone(trait), imported.idMap)
  rebasedTrait.name = template.name
  rebasedTrait.description = instantiateTemplateDescription(template.description, draft.name)
  const traitIndex = imported.draft.traits.length
  return {
    draft: {
      ...imported.draft,
      traits: [...imported.draft.traits, {
        ...structuredClone(projection),
        name: rebasedTrait.name,
        description: rebasedTrait.description,
        automation: 'headless',
        preservedTrait: rebasedTrait,
        templateSource: source,
        chargeActionId: rebasedTrait.rule?.kind === 'charge-damage'
          ? rebasedTrait.rule.actionId
          : projection.chargeActionId,
      }],
    },
    addedActionIds: imported.addedActionIds,
    addedMultiattackIds: imported.addedMultiattackIds,
    addedTraitIndexes: [traitIndex],
  }
}
