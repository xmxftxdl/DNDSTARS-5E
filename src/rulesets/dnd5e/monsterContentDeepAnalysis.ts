import type {
  Dnd5eCustomMonsterActionDraft,
  Dnd5eCustomMonsterDraft,
  Dnd5eCustomMonsterSpellDraft,
  Dnd5eCustomMonsterTraitDraft,
} from './customMonsterWorkshop'
import { parseDnd5eSpellcastingText } from './monsterContentAutoParser'
import { DND5E_SRD_MONSTERS, type Dnd5eMonsterStatBlock } from './monsters'
import { DND5E_SRD_SPELL_CATALOG } from './spellCatalog'

export interface Dnd5eMonsterContentSpellReference {
  id: string
  name: string
  level: number
}

export interface Dnd5eMonsterContentUnresolvedSpell {
  id: string
  name: string
  level: number
  usageKind: Dnd5eCustomMonsterSpellDraft['usageKind']
  usageMax: number
}

export interface Dnd5eMonsterContentSummonReference {
  sourceId: string
  sourceName: string
  monsterName?: string
  monsterId?: string
  suggestedMonsterId?: string
  countExpression?: string
  resolvedMonsterId?: string
  reasons: string[]
}

export interface Dnd5eMonsterContentNormalizationReport {
  repairedActionIds: string[]
  absorbedSpellTraits: string[]
  absorbedSpellActions: string[]
  removedActionDuplicates: string[]
  removedMechanicActionDuplicates: string[]
  actionClassificationConflicts: string[]
  unresolvedSpells: Dnd5eMonsterContentUnresolvedSpell[]
}

export interface Dnd5eMonsterContentAnalysis extends Dnd5eMonsterContentNormalizationReport {
  summonReferences: Dnd5eMonsterContentSummonReference[]
}

const SPELL_SECTION_HEADING = /^(?:(?:innate\s+)?spellcasting|(?:天生)?施法|cantrips?|戏法|\d+(?:st|nd|rd|th)?\s*level|(?:\d+|[一二三四五六七八九])\s*环)(?:\s*[（(][^）)]*[）)])?$/i
const SPELLCASTING_HEADING = /^(?:(?:innate\s+)?spellcasting|(?:天生)?施法)(?:\s*[（(][^）)]*[）)])?$/i

const SRD_SPELL_IDS = new Set(DND5E_SRD_SPELL_CATALOG.map((spell) => spell.id))

function normalizedNeedle(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, '')
}

function normalizedRuleText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US')
    .replace(/[\s，。；、,.!！?？:：()（）'’"“”]/g, '')
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function dnd5eMonsterContentSlug(value: string): string {
  const ascii = value.normalize('NFKD').toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
  return ascii || `content-${stableHash(value.trim() || 'missing')}`
}

export function isDnd5eMonsterSpellSectionTraitName(value: string): boolean {
  return SPELL_SECTION_HEADING.test(value.trim())
}

function customSpellId(name: string): string {
  return `custom-spell-${dnd5eMonsterContentSlug(name)}`
}

function mergeDescription(current: string, addition: string): string {
  const left = current.trim()
  const right = addition.trim()
  if (!right || normalizedRuleText(left).includes(normalizedRuleText(right))) return left
  if (!left) return right
  return `${left}\n${right}`
}

function spellReferenceLookup(references: readonly Dnd5eMonsterContentSpellReference[]) {
  return new Map(references.flatMap((spell) => [
    [normalizedNeedle(spell.id), spell] as const,
    [normalizedNeedle(spell.name), spell] as const,
  ]))
}

function spellSectionLines(entries: readonly { name: string; description: string }[]): string[] {
  return entries
    .filter((entry) => isDnd5eMonsterSpellSectionTraitName(entry.name))
    .map((entry) => `${entry.name}：${entry.description}`)
}

function draftSpellFromUnknown(
  unknown: ReturnType<typeof parseDnd5eSpellcastingText>['unknownDetails'][number],
  lookup: ReturnType<typeof spellReferenceLookup>,
): Dnd5eCustomMonsterSpellDraft {
  const known = lookup.get(normalizedNeedle(unknown.name))
  return {
    id: known?.id ?? customSpellId(unknown.name),
    name: known?.name ?? unknown.name,
    level: known?.level ?? unknown.level,
    usageKind: unknown.usageKind,
    usageMax: unknown.usageMax,
  }
}

function sameActionAndTrait(
  trait: Dnd5eCustomMonsterTraitDraft,
  action: Dnd5eCustomMonsterDraft['actions'][number],
): boolean {
  if (normalizedNeedle(trait.name) !== normalizedNeedle(action.name)) return false
  const traitText = normalizedRuleText(trait.description)
  const actionText = normalizedRuleText(action.description)
  return !!traitText && !!actionText && (
    traitText === actionText || traitText.includes(actionText) || actionText.includes(traitText)
  )
}

function isExplicitAreaSavingThrowText(value: string): boolean {
  return /(锥(?:形|状)?|线形|直线|半径|范围|尺内|英尺内|cone|line|radius|area|within\s+\d+\s*(?:feet|ft))/i.test(value) &&
    /(豁免|saving\s+throw|\bsave\b)/i.test(value) &&
    /\bdc\s*\d+/i.test(value) &&
    /\d+\s*d\s*\d+/i.test(value) &&
    /(伤害|damage)/i.test(value)
}

function isMechanicActionDuplicate(
  action: Dnd5eCustomMonsterActionDraft,
  draft: Dnd5eCustomMonsterDraft,
): boolean {
  const mechanic = draft.headlessMechanics.find((entry) =>
    normalizedNeedle(entry.name) === normalizedNeedle(action.name))
  if (!mechanic) return false
  if (action.kind === 'area-saving-throw') {
    return !isExplicitAreaSavingThrowText(`${action.name} ${action.description}`)
  }
  return false
}

/**
 * 将被误放进普通特性或动作的施法段落归并到施法区，并仅删除可证明的副本。
 * 无法映射到当前法术目录的名称会保留为 custom-spell-* 引用，绝不静默丢弃。
 */
export function normalizeDnd5eMonsterDraftContent(
  draft: Dnd5eCustomMonsterDraft,
  knownCustomSpells: readonly Dnd5eMonsterContentSpellReference[] = [],
): { draft: Dnd5eCustomMonsterDraft; report: Dnd5eMonsterContentNormalizationReport } {
  const repairedActionIds: string[] = []
  const actionIdRemap = new Map<string, string>()
  const usedActionIds = new Set<string>()
  const hydratedActions = draft.actions.map((action, index) => {
    const originalId = action.id?.trim() ?? ''
    let id = originalId
    if (!/^[a-z][a-z0-9-]*$/.test(id) || usedActionIds.has(id)) {
      const base = `action-${dnd5eMonsterContentSlug(action.name || `entry-${index + 1}`)}`
      id = base
      let suffix = 2
      while (usedActionIds.has(id)) {
        id = `${base}-${suffix}`
        suffix += 1
      }
      repairedActionIds.push(`${originalId || '（空）'} → ${id}`)
    }
    usedActionIds.add(id)
    if (originalId && !actionIdRemap.has(originalId)) actionIdRemap.set(originalId, id)
    return {
      ...action,
      id,
      summonMonsterId: action.summonMonsterId ?? '',
      summonCountMode: action.summonCountMode ?? 'fixed',
      summonCount: action.summonCount ?? 1,
      summonCountDice: action.summonCountDice ?? '1d3',
      summonDurationRounds: action.summonDurationRounds ?? 10,
      summonConcentration: action.summonConcentration ?? false,
      summonConcentrationEndsOnAppearance: action.summonConcentrationEndsOnAppearance ?? false,
      summonTiming: action.summonTiming ?? 'immediate',
      summonSide: action.summonSide ?? 'ally',
    }
  })
  const sourceActions = hydratedActions.map((action) => ({
    ...action,
    referencedActionId: actionIdRemap.get(action.referencedActionId) ?? action.referencedActionId,
    reactionTriggerActionId: actionIdRemap.get(action.reactionTriggerActionId) ?? action.reactionTriggerActionId,
  }))
  const spellTraits = draft.traits.filter((trait) => isDnd5eMonsterSpellSectionTraitName(trait.name))
  const spellActions = sourceActions.filter((action) => isDnd5eMonsterSpellSectionTraitName(action.name))
  const parsed = parseDnd5eSpellcastingText(spellSectionLines([...spellTraits, ...spellActions]).join('\n'))
  const customLookup = spellReferenceLookup(knownCustomSpells)
  const absorbedSpellTraits = spellTraits.map((trait) => trait.name.trim()).filter(Boolean)
  const absorbedSpellActions = spellActions.map((action) => action.name.trim()).filter(Boolean)
  const unresolvedFromTraits = parsed.unknownDetails.map((entry) => draftSpellFromUnknown(entry, customLookup))
  const spellById = new Map<string, Dnd5eCustomMonsterSpellDraft>()
  for (const spell of [...draft.spells, ...parsed.spells, ...unresolvedFromTraits]) {
    const known = customLookup.get(normalizedNeedle(spell.id)) ?? customLookup.get(normalizedNeedle(spell.name))
    const normalized = known ? { ...spell, id: known.id, name: known.name, level: known.level } : spell
    spellById.set(normalized.id, normalized)
  }

  let spellcastingDescription = draft.spellcastingDescription
  for (const entry of [...spellTraits, ...spellActions]) {
    if (SPELLCASTING_HEADING.test(entry.name.trim())) {
      spellcastingDescription = mergeDescription(spellcastingDescription, entry.description)
    }
  }

  const withoutSpellTraits = draft.traits.filter((trait) => !isDnd5eMonsterSpellSectionTraitName(trait.name))
  const removedActionDuplicates: string[] = []
  const removedMechanicActionDuplicates: string[] = []
  const actionClassificationConflicts: string[] = []
  const traits = withoutSpellTraits.filter((trait) => {
    const sameNameAction = sourceActions.find((action) =>
      !isDnd5eMonsterSpellSectionTraitName(action.name) &&
      normalizedNeedle(action.name) === normalizedNeedle(trait.name))
    if (!sameNameAction) return true
    if (sameActionAndTrait(trait, sameNameAction)) {
      removedActionDuplicates.push(trait.name.trim())
      return false
    }
    actionClassificationConflicts.push(trait.name.trim())
    return true
  })
  const draftWithHydratedActions = { ...draft, actions: sourceActions }
  const actions = sourceActions.filter((action) => {
    if (isDnd5eMonsterSpellSectionTraitName(action.name)) return false
    if (!isMechanicActionDuplicate(action, draftWithHydratedActions)) return true
    removedMechanicActionDuplicates.push(action.name.trim())
    return false
  })

  const unresolvedSpells = [...spellById.values()]
    .filter((spell) => !SRD_SPELL_IDS.has(spell.id) && !customLookup.has(normalizedNeedle(spell.id)))
    .map((spell) => ({ ...spell }))

  return {
    draft: {
      ...draft,
      actions,
      equipment: draft.equipment.map((item) => ({
        ...item,
        linkedActionId: actionIdRemap.get(item.linkedActionId) ?? item.linkedActionId,
      })),
      traits: traits.map((trait) => ({
        ...trait,
        chargeActionId: actionIdRemap.get(trait.chargeActionId) ?? trait.chargeActionId,
      })),
      spellcastingEnabled: draft.spellcastingEnabled || spellTraits.length > 0 || spellActions.length > 0 || spellById.size > 0,
      spellcastingDescription,
      spellSlots: { ...draft.spellSlots, ...parsed.slots },
      spells: [...spellById.values()],
      spellcastingAutomation: unresolvedSpells.length > 0 ? 'dm-adjudication' : draft.spellcastingAutomation,
    },
    report: {
      repairedActionIds,
      absorbedSpellTraits,
      absorbedSpellActions,
      removedActionDuplicates,
      removedMechanicActionDuplicates,
      actionClassificationConflicts,
      unresolvedSpells,
    },
  }
}

/** 对模型已经生成的合法 monsterSchema 做同样的无损分类整理。 */
export function normalizeDnd5eMonsterStatBlockContent(monster: Dnd5eMonsterStatBlock): {
  monster: Dnd5eMonsterStatBlock
  report: Pick<Dnd5eMonsterContentNormalizationReport, 'absorbedSpellTraits' | 'absorbedSpellActions' | 'unresolvedSpells'>
} {
  const spellTraits = monster.traits.filter((trait) => isDnd5eMonsterSpellSectionTraitName(trait.name))
  const spellActions = monster.actions.filter((action) => isDnd5eMonsterSpellSectionTraitName(action.name))
  if (spellTraits.length === 0 && spellActions.length === 0) {
    return { monster, report: { absorbedSpellTraits: [], absorbedSpellActions: [], unresolvedSpells: [] } }
  }
  const parsed = parseDnd5eSpellcastingText(spellSectionLines([...spellTraits, ...spellActions]).join('\n'))
  const existingSpells = monster.spellcasting?.spells ?? []
  const spells = new Map(existingSpells.map((spell) => [spell.id, spell]))
  for (const spell of parsed.spells) {
    spells.set(spell.id, {
      id: spell.id,
      name: spell.name,
      level: spell.level,
      ...(spell.usageKind === 'at-will'
        ? { usage: { kind: 'at-will' as const } }
        : spell.usageKind === 'per-day'
          ? { usage: { kind: 'per-day' as const, max: spell.usageMax } }
          : {}),
    })
  }
  const unresolvedSpells = parsed.unknownDetails.map((entry) => draftSpellFromUnknown(entry, new Map()))
  for (const spell of unresolvedSpells) {
    spells.set(spell.id, {
      id: spell.id,
      name: spell.name,
      level: spell.level,
      ...(spell.usageKind === 'at-will'
        ? { usage: { kind: 'at-will' as const } }
        : spell.usageKind === 'per-day'
          ? { usage: { kind: 'per-day' as const, max: spell.usageMax } }
          : {}),
    })
  }
  let description = monster.spellcasting?.description ?? ''
  for (const entry of [...spellTraits, ...spellActions]) {
    if (SPELLCASTING_HEADING.test(entry.name.trim())) description = mergeDescription(description, entry.description)
  }
  return {
    monster: {
      ...monster,
      traits: monster.traits.filter((trait) => !isDnd5eMonsterSpellSectionTraitName(trait.name)),
      actions: monster.actions.filter((action) => !isDnd5eMonsterSpellSectionTraitName(action.name)),
      capabilities: {
        swarm: false,
        shapechanger: false,
        regeneration: false,
        legendary: false,
        hasFlySpeed: false,
        hasSwimSpeed: false,
        ...monster.capabilities,
        spellcaster: true,
      },
      spellcasting: {
        description: description || '该生物拥有施法能力。',
        ...monster.spellcasting,
        slots: { ...(monster.spellcasting?.slots ?? {}), ...parsed.slots },
        spells: [...spells.values()],
        automation: unresolvedSpells.length > 0 ? 'dm-adjudication' : monster.spellcasting?.automation ?? 'dm-adjudication',
      },
    },
    report: {
      absorbedSpellTraits: spellTraits.map((trait) => trait.name.trim()).filter(Boolean),
      absorbedSpellActions: spellActions.map((action) => action.name.trim()).filter(Boolean),
      unresolvedSpells,
    },
  }
}

function summonTargetFromText(value: string): { name: string; countExpression?: string } | undefined {
  const compact = value.replace(/\s+/g, ' ')
  const chinese = compact.match(/(\d+d\d+|\d+)\s*个\s*([\u3400-\u9fffA-Za-z0-9·'’ -]{2,40}?)(?=就?会|会在|将会|将|出现在|出现于|加入|[，。；;]|$)/i)
  if (chinese) return { name: chinese[2].trim(), countExpression: chinese[1] }
  const english = compact.match(/(?:summons?|calls?)\s+(\d+d\d+|\d+)?\s*([A-Za-z][A-Za-z0-9'’ -]{1,40}?)(?=\s+(?:that|which|appear|arrive)|[,. ;]|$)/i)
  if (english) return { name: english[2].trim(), countExpression: english[1] }
  return undefined
}

function monsterByReference(
  monsters: readonly Dnd5eMonsterStatBlock[],
  name?: string,
  id?: string,
): Dnd5eMonsterStatBlock | undefined {
  return monsters.find((monster) =>
    (!!id && monster.id === id) || (!!name && normalizedNeedle(monster.name) === normalizedNeedle(name)))
}

export function analyzeDnd5eMonsterDraftContent(
  draft: Dnd5eCustomMonsterDraft,
  monsters: readonly Dnd5eMonsterStatBlock[] = [],
  knownCustomSpells: readonly Dnd5eMonsterContentSpellReference[] = [],
): Dnd5eMonsterContentAnalysis {
  const normalized = normalizeDnd5eMonsterDraftContent(draft, knownCustomSpells)
  const availableMonsters = [...DND5E_SRD_MONSTERS, ...monsters]
  const summonReferences: Dnd5eMonsterContentSummonReference[] = []
  for (const action of draft.actions) {
    if (action.kind === 'summon') {
      const resolved = monsterByReference(availableMonsters, undefined, action.summonMonsterId)
      summonReferences.push({
        sourceId: action.id,
        sourceName: action.name,
        monsterId: action.summonMonsterId,
        countExpression: action.summonCountMode === 'fixed'
          ? String(action.summonCount)
          : action.summonCountDice,
        resolvedMonsterId: resolved?.id,
        reasons: resolved ? [] : ['召唤怪物 ID 尚未加入当前目录'],
      })
      continue
    }
    const target = summonTargetFromText(`${action.name}。${action.description}`)
    if (!target && !/召唤|呼唤|summon|\bcall\b/i.test(`${action.name} ${action.description}`)) continue
    const resolved = monsterByReference(availableMonsters, target?.name)
    const reasons: string[] = []
    if (!resolved) reasons.push(target?.name ? '目标怪物尚未加入当前目录' : '未从动作正文识别召唤目标')
    if (target?.countExpression?.includes('d')) reasons.push('请将动作类型设为“召唤”，由 Host 预掷随机数量')
    if (/下一个?.*回合开始|next\s+turn/i.test(action.description)) reasons.push('效果延迟到下回合开始')
    if (/专注|concentrat/i.test(action.description)) reasons.push('动作包含非标准专注过程')
    summonReferences.push({
      sourceId: action.id,
      sourceName: action.name,
      monsterName: target?.name,
      suggestedMonsterId: target?.name ? `room-monster:${dnd5eMonsterContentSlug(target.name)}` : undefined,
      countExpression: target?.countExpression,
      resolvedMonsterId: resolved?.id,
      reasons,
    })
  }
  for (const mechanic of draft.headlessMechanics) {
    if (mechanic.effectKind !== 'summon') continue
    const resolved = monsterByReference(availableMonsters, undefined, mechanic.summonMonsterId)
    summonReferences.push({
      sourceId: mechanic.id,
      sourceName: mechanic.name,
      monsterId: mechanic.summonMonsterId,
      countExpression: String(mechanic.summonCount),
      resolvedMonsterId: resolved?.id,
      reasons: resolved ? [] : ['召唤怪物 ID 尚未加入当前目录'],
    })
  }
  return { ...normalized.report, summonReferences }
}
