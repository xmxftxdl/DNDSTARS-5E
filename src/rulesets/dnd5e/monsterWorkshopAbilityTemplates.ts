import {
  dnd5eCustomMonsterDraftFromStatBlock,
  type Dnd5eCustomMonsterActionDraft,
  type Dnd5eCustomMonsterDraft,
  type Dnd5eMonsterWorkshopTemplateSource,
} from './customMonsterWorkshop'
import {
  DND5E_SRD_MONSTERS,
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
  ruleKind: string
  mechanicTags: readonly string[]
  dependencyCount: number
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

function ruleMechanicTags(ruleKind: string): readonly string[] {
  if (ruleKind === 'source-linked-engulf') {
    return ['共享空间', '吞没', '携带', '逃脱', '持续伤害']
  }
  if (ruleKind === 'source-linked-reel') return ['关系目标', '拖拽', '强制移动']
  if (ruleKind === 'throw-linked-target') return ['关系目标', '投掷', '碰撞伤害', '强制移动']
  if (ruleKind === 'area-saving-throw') return ['范围豁免', '范围伤害']
  if (ruleKind === 'charge-damage') return ['移动后命中', '直线移动', '追加伤害']
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
  const templates: Dnd5eMonsterAbilityTemplate[] = []
  for (const monster of monsters) {
    monster.traits.forEach((trait, sourceIndex) => {
      if (trait.automation !== 'headless' || !trait.rule) return
      const ruleKind = trait.rule.kind
      const mechanicTags = ruleMechanicTags(ruleKind)
      templates.push({
        id: `${monster.id}:trait:${sourceIndex}:${slugPart(trait.name)}`,
        section: 'trait',
        name: trait.name,
        description: trait.description,
        sourceMonsterId: monster.id,
        sourceMonsterName: monster.name,
        sourceMonsterEnglishName: monster.englishName,
        ruleKind,
        mechanicTags,
        dependencyCount: dependencyClosure(monster, trait).length,
        searchText: templateSearchText(monster, 'trait', trait.name, trait.description, ruleKind),
        sourceIndex,
      })
    })
    for (const entry of actionEntries(monster)) {
      if (dnd5eMonsterActionAutomation(entry.action) !== 'headless') continue
      const ruleKind = actionRuleKind(entry.action)
      const mechanicTags = ruleMechanicTags(ruleKind)
      templates.push({
        id: `${monster.id}:${entry.section}:${entry.sourceIndex}:${slugPart(entry.action.id)}`,
        section: entry.section,
        name: entry.action.name,
        description: entry.action.description,
        sourceMonsterId: monster.id,
        sourceMonsterName: monster.name,
        sourceMonsterEnglishName: monster.englishName,
        ruleKind,
        mechanicTags,
        dependencyCount: dependencyClosure(monster, entry.action).length,
        searchText: templateSearchText(monster, entry.section, entry.action.name, entry.action.description, ruleKind),
        sourceIndex: entry.sourceIndex,
      })
    }
  }
  return templates.sort((left, right) =>
    left.section.localeCompare(right.section) ||
    left.name.localeCompare(right.name, 'zh-CN') ||
    left.sourceMonsterName.localeCompare(right.sourceMonsterName, 'zh-CN'))
}

export const DND5E_MONSTER_ABILITY_TEMPLATES = buildDnd5eMonsterAbilityTemplateCatalog()

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
    monsterName: monster.name,
    section: template.section,
  }

  if (template.section !== 'trait') {
    const primary = sourceActionEntry(monster, template)
    const imported = importActionEntries(
      draft,
      monster,
      [primary, ...dependencyClosure(monster, primary.action)],
      source,
    )
    return { ...imported, addedTraitIndexes: [] }
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
