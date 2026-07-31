import { SKILLS, type AbilityKey } from '../../lib/dnd'
import type {
  Character,
  Dnd5eLevelAdvancementDecisionV1,
  Dnd5eLevelAdvancementRecordV1,
  Dnd5eLevelAdvancementSnapshotV1,
} from '../../types/character'
import {
  dnd5eClassChoiceLimit,
  dnd5eClassChoiceOptionAvailable,
  dnd5eClassDefinition,
  type Dnd5eClassChoiceGroup,
  type Dnd5eClassId,
} from './classes'
import {
  dnd5eCharacterClassLevel,
  dnd5eTotalCharacterLevel,
  normalizeDnd5eClassLevels,
} from './classLevels'
import {
  FIGHTER_FIGHTING_STYLE_OPTIONS,
  fighterFightingStyleSelectionLimit,
  fighterProgression,
  fighterSubclassChoiceKey,
  fighterSubclassChoiceLimit,
  fighterSubclassDefinition,
  registeredFighterSubclasses,
  type FighterFightingStyleId,
} from './fighter'
import {
  dnd5eManualHitPointRolls,
  syncDnd5eHitPoints,
} from './hitPoints'
import {
  dnd5ePluginFeatAvailableForCharacter,
  dnd5ePluginSubclassChoiceLimit,
  dnd5ePluginSubclassDefinition,
  registeredDnd5ePluginFeats,
  registeredDnd5ePluginSubclasses,
} from './pluginApi'
import {
  dnd5eMeetsMulticlassPrerequisite,
  validateDnd5eMulticlassLevelGain,
} from './multiclass'
import {
  dnd5eSrdFeatAvailableForCharacter,
  dnd5eSrdFeatDefinition,
} from './feats'
import {
  applyDnd5eSpellAdvancement,
  buildDnd5eSpellAdvancementPlan,
  type Dnd5eSpellAdvancementPlan,
} from './spellAdvancement'

const ABILITY_KEYS: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export interface Dnd5eAdvancementChoiceRequirement {
  key: string
  name: string
  description?: string
  options: readonly { id: string; name: string; summary: string }[]
  currentSelections: readonly string[]
  targetLimit: number
  additionalRequired: number
  kind: 'class' | 'fighter-subclass'
  /** 升级时可以用最终列表替换至多一个既有选项。 */
  replaceable?: boolean
}

export interface Dnd5eLevelAdvancementPlan {
  classId: Dnd5eClassId
  className: string
  hitDie: 6 | 8 | 10 | 12
  fromLevel: number
  toLevel: number
  fromClassLevel: number
  toClassLevel: number
  gainedClassLevels: readonly number[]
  grantedFeatures: readonly { id: string; level: number; name: string; description: string }[]
  asiLevels: readonly number[]
  subclassChoiceUnlocked: boolean
  subclassRequired: boolean
  subclassOptions: readonly { id: string; name: string; summary: string }[]
  choiceRequirements: readonly Dnd5eAdvancementChoiceRequirement[]
  spellAdvancement?: Dnd5eSpellAdvancementPlan
  multiclass: boolean
  rolledHitPointsAllowed: boolean
}

export type Dnd5eLevelAdvancementFailure =
  | 'invalid-level-gain'
  | 'maximum-level'
  | 'invalid-class'
  | 'multiclass-prerequisite'
  | 'rolled-hit-points-not-supported-for-multiclass'
  | 'invalid-hit-point-rolls'
  | 'subclass-required'
  | 'invalid-subclass'
  | 'missing-asi-choice'
  | 'invalid-asi-choice'
  | 'invalid-feat'
  | 'missing-class-choice'
  | 'invalid-class-choice'
  | 'missing-spell-choice'
  | 'invalid-spell-choice'
  | 'only-latest-advancement-can-be-revised'
  | 'dependent-advancement-invalid'

export type Dnd5eLevelAdvancementResult =
  | { ok: true; character: Character; record: Dnd5eLevelAdvancementRecordV1 }
  | { ok: false; reason: Dnd5eLevelAdvancementFailure }

function cloneSnapshot(snapshot: Dnd5eLevelAdvancementSnapshotV1): Dnd5eLevelAdvancementSnapshotV1 {
  return structuredClone(snapshot)
}

function advancementSnapshot(character: Character): Dnd5eLevelAdvancementSnapshotV1 {
  return {
    level: character.level,
    dnd5eClassLevels: character.dnd5eClassLevels ? structuredClone(character.dnd5eClassLevels) : undefined,
    abilities: { ...character.abilities },
    skills: [...character.skills],
    dnd5eClassChoices: character.dnd5eClassChoices ? structuredClone(character.dnd5eClassChoices) : undefined,
    dnd5eFeatIds: character.dnd5eFeatIds ? [...character.dnd5eFeatIds] : undefined,
    hitPointMaximumMode: character.hitPointMaximumMode,
    hitPointRolls: character.hitPointRolls ? [...character.hitPointRolls] : undefined,
    hitPointDice: character.hitPointDice?.map((pool) => ({ ...pool })),
    maxHp: character.maxHp,
    currentHp: character.currentHp,
  }
}

function restoreAdvancementSnapshot(
  character: Character,
  snapshot: Dnd5eLevelAdvancementSnapshotV1,
): Character {
  return {
    ...character,
    ...cloneSnapshot(snapshot),
  }
}

function progressionFeatures(classId: Dnd5eClassId, fromClassLevel: number, toClassLevel: number) {
  const definition = dnd5eClassDefinition(classId)
  if (!definition) return []
  if (classId === 'fighter') {
    return fighterProgression(undefined)
      .filter((entry) => entry.level > fromClassLevel && entry.level <= toClassLevel)
      .flatMap((entry) => entry.features)
  }
  return definition.features.filter((feature) =>
    feature.level > fromClassLevel && feature.level <= toClassLevel)
}

function subclassProgressionFeatures(
  classId: Dnd5eClassId,
  subclassId: string | undefined,
  fromClassLevel: number,
  toClassLevel: number,
) {
  if (!subclassId) return []
  if (classId === 'fighter') {
    return (fighterSubclassDefinition(subclassId)?.features ?? []).filter((feature) =>
      feature.level > fromClassLevel && feature.level <= toClassLevel)
  }
  const definition = dnd5eClassDefinition(classId)
  if (!definition) return []
  if (subclassId === definition.subclass.id) {
    return definition.subclass.features.filter((feature) =>
      feature.level > fromClassLevel && feature.level <= toClassLevel)
  }
  return (dnd5ePluginSubclassDefinition(subclassId)?.features ?? []).filter((feature) =>
    feature.level > fromClassLevel && feature.level <= toClassLevel)
}

function asiLevelsFor(classId: Dnd5eClassId, fromClassLevel: number, toClassLevel: number): number[] {
  return progressionFeatures(classId, fromClassLevel, toClassLevel)
    .filter((feature) => feature.id.startsWith('asi-'))
    .map((feature) => feature.level)
}

function selectedSubclassId(character: Character, classId: Dnd5eClassId): string | undefined {
  return classId === 'fighter'
    ? character.dnd5eClassChoices?.fighter?.subclass
    : character.dnd5eClassChoices?.classes?.[classId]?.subclass
}

function genericChoiceGroups(
  classId: Dnd5eClassId,
  subclassId: string | undefined,
  includeMulticlassSkillChoice: boolean = false,
): readonly Dnd5eClassChoiceGroup[] {
  const definition = dnd5eClassDefinition(classId)
  if (!definition || classId === 'fighter') return []
  const classGroups = definition.choiceGroups ?? []
  const subclassGroups = subclassId === definition.subclass.id
    ? definition.subclass.choiceGroups ?? []
    : []
  const pluginSubclass = subclassId ? dnd5ePluginSubclassDefinition(subclassId) : undefined
  const pluginGroups: Dnd5eClassChoiceGroup[] = (pluginSubclass?.choiceGroups ?? []).map((group) => ({
    id: `${pluginSubclass!.id}/${group.id}`,
    level: group.level,
    name: group.name,
    description: group.description,
    maxSelections: group.maxSelectionsByLevel?.length
      ? (level) => dnd5ePluginSubclassChoiceLimit(group, level)
      : group.maxSelections,
    options: group.options.map((option) => ({ ...option })),
  }))
  const multiclassSkillCount = includeMulticlassSkillChoice && ['bard', 'ranger', 'rogue'].includes(classId) ? 1 : 0
  const classSkillKeys = definition.skillProficiencies === 'any'
    ? SKILLS.map((skill) => skill.key)
    : definition.skillProficiencies
  const multiclassSkillGroup: Dnd5eClassChoiceGroup[] = multiclassSkillCount > 0 ? [{
    id: 'class-skills',
    level: 1,
    name: '兼职技能熟练',
    description: `加入${definition.name}时，从该职业允许的技能中选择 1 项。`,
    maxSelections: multiclassSkillCount,
    options: classSkillKeys.map((key) => {
      const skill = SKILLS.find((candidate) => candidate.key === key)
      return {
        id: key,
        name: skill?.label ?? key,
        summary: '获得该技能的熟练项',
      }
    }),
  }] : []
  return [...multiclassSkillGroup, ...classGroups, ...subclassGroups, ...pluginGroups]
}

function choiceRequirements(
  character: Character,
  classId: Dnd5eClassId,
  fromClassLevel: number,
  toClassLevel: number,
  subclassId: string | undefined,
): Dnd5eAdvancementChoiceRequirement[] {
  if (classId === 'fighter') {
    const targetCharacter: Character = {
      ...character,
      level: toClassLevel,
      dnd5eClassChoices: {
        ...character.dnd5eClassChoices,
        fighter: { ...character.dnd5eClassChoices?.fighter, subclass: subclassId },
      },
    }
    const definition = fighterSubclassDefinition(subclassId)
    return (definition?.choiceGroups ?? []).flatMap((group) => {
      if ((group.minLevel ?? 1) > toClassLevel) return []
      const key = fighterSubclassChoiceKey(definition!.id, group.id)
      const allowed = new Set(group.options.map((option) => option.id))
      const currentSelections = [
        ...new Set(character.dnd5eClassChoices?.fighter?.extensionChoices?.[key] ?? []),
      ].filter((id) => allowed.has(id))
      const targetLimit = fighterSubclassChoiceLimit(group, targetCharacter)
      const additionalRequired = Math.max(0, targetLimit - currentSelections.length)
      if (additionalRequired === 0 && (group.minLevel ?? 1) <= fromClassLevel) return []
      return [{
        key,
        name: group.name,
        description: group.description,
        options: group.options,
        currentSelections,
        targetLimit,
        additionalRequired,
        kind: 'fighter-subclass' as const,
      }]
    })
  }

  return genericChoiceGroups(classId, subclassId, fromClassLevel === 0).flatMap((group) => {
    if (group.level > toClassLevel) return []
    const options = group.id === 'class-skills'
      ? group.options.filter((option) => !character.skills.includes(option.id))
      : group.options
    const allowed = new Set(options.map((option) => option.id))
    const currentSelections = [
      ...new Set(character.dnd5eClassChoices?.classes?.[classId]?.selections?.[group.id] ?? []),
    ].filter((id) => allowed.has(id))
    const targetLimit = dnd5eClassChoiceLimit(group, toClassLevel)
    const additionalRequired = Math.max(0, targetLimit - currentSelections.length)
    const replaceable =
      classId === 'warlock' &&
      group.id === 'eldritch-invocations' &&
      fromClassLevel >= group.level
    if (additionalRequired === 0 && group.level <= fromClassLevel && !replaceable) return []
    return [{
      key: group.id,
      name: group.name,
      description: group.description,
      options,
      currentSelections,
      targetLimit,
      additionalRequired,
      kind: 'class' as const,
      ...(replaceable ? { replaceable: true } : {}),
    }]
  })
}

export function buildDnd5eLevelAdvancementPlan(
  character: Character,
  classId: Dnd5eClassId,
  levelsGained: number,
  proposedSubclassId?: string,
): Dnd5eLevelAdvancementPlan | undefined {
  const definition = dnd5eClassDefinition(classId)
  const gain = Math.floor(levelsGained)
  if (!definition || gain !== 1) return undefined
  const fromLevel = dnd5eTotalCharacterLevel(character)
  const toLevel = fromLevel + gain
  if (toLevel > 20) return undefined
  const fromClassLevel = dnd5eCharacterClassLevel(character, classId)
  const toClassLevel = fromClassLevel + gain
  const subclassId = selectedSubclassId(character, classId) ?? proposedSubclassId
  const subclassChoiceUnlocked =
    fromClassLevel < definition.subclassLevel &&
    toClassLevel >= definition.subclassLevel &&
    !selectedSubclassId(character, classId)
  const subclassRequired = subclassChoiceUnlocked && !subclassId
  const subclassOptions = classId === 'fighter'
    ? registeredFighterSubclasses().map((subclass) => ({
        id: subclass.id,
        name: subclass.name,
        summary: subclass.summary,
      }))
    : [
        {
          id: definition.subclass.id,
          name: definition.subclass.name,
          summary: definition.subclass.summary,
        },
        ...registeredDnd5ePluginSubclasses(classId).map((subclass) => ({
          id: subclass.id,
          name: subclass.name,
          summary: subclass.summary,
        })),
      ]
  const features = [
    ...progressionFeatures(classId, fromClassLevel, toClassLevel),
    ...subclassProgressionFeatures(classId, subclassId, fromClassLevel, toClassLevel),
  ]
    .filter((feature) => !feature.id.startsWith('asi-'))
    .map((feature) => ({ ...feature }))
  const classCount = Object.keys(normalizeDnd5eClassLevels(character)).length
  const multiclass = classCount > 1 || (fromClassLevel === 0 && classCount > 0)
  return {
    classId,
    className: definition.name,
    hitDie: definition.hitDie,
    fromLevel,
    toLevel,
    fromClassLevel,
    toClassLevel,
    gainedClassLevels: Array.from({ length: gain }, (_, index) => fromClassLevel + index + 1),
    grantedFeatures: features,
    asiLevels: asiLevelsFor(classId, fromClassLevel, toClassLevel),
    subclassChoiceUnlocked,
    subclassRequired,
    subclassOptions,
    choiceRequirements: subclassRequired
      ? []
      : choiceRequirements(character, classId, fromClassLevel, toClassLevel, subclassId),
    spellAdvancement: buildDnd5eSpellAdvancementPlan(
      character,
      classId,
      fromClassLevel,
      toClassLevel,
      subclassId,
    ),
    multiclass,
    rolledHitPointsAllowed: !multiclass,
  }
}

function validateSubclass(classId: Dnd5eClassId, subclassId: string | undefined): boolean {
  if (!subclassId) return false
  const definition = dnd5eClassDefinition(classId)
  if (!definition) return false
  if (classId === 'fighter') return registeredFighterSubclasses().some((subclass) => subclass.id === subclassId)
  return subclassId === definition.subclass.id ||
    registeredDnd5ePluginSubclasses(classId).some((subclass) => subclass.id === subclassId)
}

function applyAsiChoices(
  character: Character,
  plan: Dnd5eLevelAdvancementPlan,
  decision: Dnd5eLevelAdvancementDecisionV1,
): { ok: true; abilities: Character['abilities']; featIds: string[] } | {
  ok: false
  reason: Dnd5eLevelAdvancementFailure
} {
  const byLevel = new Map(decision.asiChoices.map((entry) => [entry.classLevel, entry.choice]))
  const abilities = { ...character.abilities }
  const featIds = [...new Set(character.dnd5eFeatIds ?? [])]
  for (const classLevel of plan.asiLevels) {
    const choice = byLevel.get(classLevel)
    if (!choice) return { ok: false, reason: 'missing-asi-choice' }
    if (choice.kind === 'ability-score') {
      const entries = Object.entries(choice.increases) as Array<[AbilityKey, number]>
      const total = entries.reduce((sum, [, increase]) => sum + Math.floor(Number(increase) || 0), 0)
      if (
        total !== 2 ||
        entries.some(([key, increase]) =>
          !ABILITY_KEYS.includes(key) || ![1, 2].includes(increase) || abilities[key] + increase > 20)
      ) return { ok: false, reason: 'invalid-asi-choice' }
      for (const [key, increase] of entries) abilities[key] += increase
      continue
    }
    const candidate = { ...character, level: plan.toLevel, abilities }
    const pluginFeat = registeredDnd5ePluginFeats().find((entry) => entry.id === choice.featId)
    const srdFeat = dnd5eSrdFeatDefinition(choice.featId)
    const available = pluginFeat
      ? dnd5ePluginFeatAvailableForCharacter(pluginFeat, candidate)
      : srdFeat
        ? dnd5eSrdFeatAvailableForCharacter(srdFeat, candidate)
        : false
    if (!available || featIds.includes(choice.featId)) {
      return { ok: false, reason: 'invalid-feat' }
    }
    featIds.push(choice.featId)
  }
  if (byLevel.size !== plan.asiLevels.length) return { ok: false, reason: 'invalid-asi-choice' }
  return { ok: true, abilities, featIds }
}

function applyGenericChoices(
  character: Character,
  plan: Dnd5eLevelAdvancementPlan,
  decision: Dnd5eLevelAdvancementDecisionV1,
  subclassId: string | undefined,
): { ok: true; choices: Character['dnd5eClassChoices']; skills: string[] } | {
  ok: false
  reason: Dnd5eLevelAdvancementFailure
} {
  const existing = character.dnd5eClassChoices?.classes?.[plan.classId] ?? {}
  const groups = genericChoiceGroups(plan.classId, subclassId, plan.fromClassLevel === 0)
  const selections = { ...existing.selections }
  const skills = new Set(character.skills)
  const requirements = choiceRequirements(
    character,
    plan.classId,
    plan.fromClassLevel,
    plan.toClassLevel,
    subclassId,
  )
  const requirementKeys = new Set(requirements.map((requirement) => requirement.key))
  if (Object.keys(decision.classChoiceSelections ?? {}).some((key) => !requirementKeys.has(key))) {
    return { ok: false, reason: 'invalid-class-choice' }
  }
  const resolved = new Map<string, { group: Dnd5eClassChoiceGroup; selections: string[] }>()
  for (const requirement of requirements) {
    const group = groups.find((candidate) => candidate.id === requirement.key)
    if (!group) return { ok: false, reason: 'invalid-class-choice' }
    const submitted = [...new Set(decision.classChoiceSelections?.[requirement.key] ?? [])]
    const combined = requirement.replaceable
      ? submitted.length > 0 ? submitted : [...requirement.currentSelections]
      : [...new Set([...requirement.currentSelections, ...submitted])]
    if (combined.length < requirement.targetLimit) return { ok: false, reason: 'missing-class-choice' }
    if (
      requirement.replaceable &&
      requirement.currentSelections.filter((optionId) => !combined.includes(optionId)).length > 1
    ) return { ok: false, reason: 'invalid-class-choice' }
    if (
      combined.length > requirement.targetLimit ||
      combined.some((optionId) => {
        const option = group.options.find((candidate) => candidate.id === optionId)
        return !option ||
          (requirement.key === 'class-skills' && character.skills.includes(optionId)) ||
          (
            requirement.key === 'expertise' &&
            optionId !== 'thievesTools' &&
            !skills.has(optionId)
          )
      })
    ) return { ok: false, reason: 'invalid-class-choice' }
    selections[requirement.key] = combined
    resolved.set(requirement.key, { group, selections: combined })
    if (requirement.key === 'class-skills' || requirement.key === 'lore-bonus-skills') {
      for (const skill of combined) skills.add(skill)
    }
  }
  const targetCharacter: Character = {
    ...character,
    level: plan.toClassLevel,
    abilities: character.abilities,
    dnd5eClassChoices: {
      ...character.dnd5eClassChoices,
      classes: {
        ...character.dnd5eClassChoices?.classes,
        [plan.classId]: { ...existing, subclass: subclassId, selections },
      },
    },
  }
  for (const entry of resolved.values()) {
    if (entry.selections.some((optionId) => {
      const option = entry.group.options.find((candidate) => candidate.id === optionId)
      return !option || !dnd5eClassChoiceOptionAvailable(targetCharacter, plan.classId, option)
    })) return { ok: false, reason: 'invalid-class-choice' }
  }
  return {
    ok: true,
    choices: {
      ...character.dnd5eClassChoices,
      classes: {
        ...character.dnd5eClassChoices?.classes,
        [plan.classId]: {
          ...existing,
          subclass: subclassId,
          selections,
        },
      },
    },
    skills: [...skills],
  }
}

function applyFighterChoices(
  character: Character,
  plan: Dnd5eLevelAdvancementPlan,
  decision: Dnd5eLevelAdvancementDecisionV1,
  subclassId: string | undefined,
): { ok: true; choices: Character['dnd5eClassChoices'] } | {
  ok: false
  reason: Dnd5eLevelAdvancementFailure
} {
  const existing = character.dnd5eClassChoices?.fighter ?? {}
  const targetCharacter: Character = {
    ...character,
    level: plan.toClassLevel,
    dnd5eClassChoices: {
      ...character.dnd5eClassChoices,
      fighter: { ...existing, subclass: subclassId },
    },
  }
  const styleLimit = fighterFightingStyleSelectionLimit(targetCharacter)
  const allowedStyles = new Set(FIGHTER_FIGHTING_STYLE_OPTIONS.map((option) => option.id))
  const styles = [...new Set(decision.fighterFightingStyles ?? existing.fightingStyles ?? [])]
  if (
    styles.length !== styleLimit ||
    styles.some((style) => !allowedStyles.has(style as FighterFightingStyleId))
  ) return { ok: false, reason: 'missing-class-choice' }

  const extensionChoices = { ...existing.extensionChoices }
  const requirements = choiceRequirements(
    character,
    plan.classId,
    plan.fromClassLevel,
    plan.toClassLevel,
    subclassId,
  )
  const requirementKeys = new Set(requirements.map((requirement) => requirement.key))
  if (Object.keys(decision.fighterSubclassSelections ?? {}).some((key) => !requirementKeys.has(key))) {
    return { ok: false, reason: 'invalid-class-choice' }
  }
  for (const requirement of requirements) {
    const submitted = [...new Set(decision.fighterSubclassSelections?.[requirement.key] ?? [])]
    const combined = [...new Set([...requirement.currentSelections, ...submitted])]
    if (combined.length < requirement.targetLimit) return { ok: false, reason: 'missing-class-choice' }
    const definition = fighterSubclassDefinition(subclassId)
    const group = definition?.choiceGroups?.find((candidate) =>
      fighterSubclassChoiceKey(definition.id, candidate.id) === requirement.key)
    const allowed = new Set(group?.options.map((option) => option.id) ?? [])
    if (combined.length > requirement.targetLimit || combined.some((option) => !allowed.has(option))) {
      return { ok: false, reason: 'invalid-class-choice' }
    }
    extensionChoices[requirement.key] = combined
  }
  return {
    ok: true,
    choices: {
      ...character.dnd5eClassChoices,
      fighter: {
        ...existing,
        subclass: subclassId,
        fightingStyles: styles as FighterFightingStyleId[],
        extensionChoices,
      },
    },
  }
}

function nextRecordId(now: number): string {
  const random = globalThis.crypto?.randomUUID?.()
  return random ? `adv-${random}` : `adv-${now}-${Math.random().toString(36).slice(2, 12)}`
}

export function applyDnd5eLevelAdvancement(
  character: Character,
  decision: Dnd5eLevelAdvancementDecisionV1,
  options: {
    completedBy?: 'player' | 'dm'
    completedAt?: number
    recordId?: string
    existingRevisions?: Dnd5eLevelAdvancementRecordV1['revisions']
  } = {},
): Dnd5eLevelAdvancementResult {
  if (
    decision.schemaVersion !== 1 ||
    !Number.isInteger(decision.levelsGained) ||
    decision.levelsGained !== 1
  ) return { ok: false, reason: 'invalid-level-gain' }
  const definition = dnd5eClassDefinition(decision.classId)
  if (!definition) return { ok: false, reason: 'invalid-class' }
  const plan = buildDnd5eLevelAdvancementPlan(
    character,
    decision.classId,
    decision.levelsGained,
    decision.subclassId,
  )
  if (!plan) {
    return {
      ok: false,
      reason: dnd5eTotalCharacterLevel(character) >= 20 ? 'maximum-level' : 'invalid-level-gain',
    }
  }
  if (plan.fromClassLevel === 0) {
    const validation = validateDnd5eMulticlassLevelGain(character, decision.classId)
    if (!validation.ok || !dnd5eMeetsMulticlassPrerequisite(character, decision.classId)) {
      return { ok: false, reason: 'multiclass-prerequisite' }
    }
  }
  const existingSubclass = selectedSubclassId(character, decision.classId)
  const subclassId = existingSubclass ?? decision.subclassId
  if (plan.subclassRequired && !subclassId) return { ok: false, reason: 'subclass-required' }
  if (subclassId && !validateSubclass(decision.classId, subclassId)) {
    return { ok: false, reason: 'invalid-subclass' }
  }
  if (existingSubclass && decision.subclassId && decision.subclassId !== existingSubclass) {
    return { ok: false, reason: 'invalid-subclass' }
  }
  if (decision.hitPointMethod === 'rolled' && !plan.rolledHitPointsAllowed) {
    return { ok: false, reason: 'rolled-hit-points-not-supported-for-multiclass' }
  }
  if (
    decision.hitPointMethod === 'rolled' &&
    (
      decision.hitPointRolls.length !== decision.levelsGained ||
      decision.hitPointRolls.some((roll) => !Number.isInteger(roll) || roll < 1 || roll > definition.hitDie)
    )
  ) return { ok: false, reason: 'invalid-hit-point-rolls' }
  if (decision.hitPointMethod === 'fixed' && decision.hitPointRolls.length !== 0) {
    return { ok: false, reason: 'invalid-hit-point-rolls' }
  }

  const levels = normalizeDnd5eClassLevels(character)
  levels[decision.classId] = plan.toClassLevel
  const provisional: Character = {
    ...character,
    level: plan.toLevel,
    dnd5eClassLevels: levels,
  }
  const asi = applyAsiChoices(provisional, plan, decision)
  if (!asi.ok) return asi
  provisional.abilities = asi.abilities
  provisional.dnd5eFeatIds = asi.featIds

  const spells = applyDnd5eSpellAdvancement(
    provisional,
    plan.spellAdvancement,
    decision.spellSelections,
    subclassId,
  )
  if (!spells.ok) return spells

  const choices = decision.classId === 'fighter'
    ? applyFighterChoices(spells.character, plan, decision, subclassId)
    : applyGenericChoices(spells.character, plan, decision, subclassId)
  if (!choices.ok) return choices
  Object.assign(provisional, spells.character)
  provisional.dnd5eClassChoices = choices.choices
  if ('skills' in choices && Array.isArray(choices.skills)) provisional.skills = choices.skills

  if (decision.hitPointMethod === 'rolled') {
    provisional.hitPointMaximumMode = 'manual'
    provisional.hitPointRolls = [
      ...dnd5eManualHitPointRolls(character).slice(0, plan.fromLevel),
      ...decision.hitPointRolls,
    ]
  } else {
    provisional.hitPointMaximumMode = 'fixed'
  }
  const advanced = syncDnd5eHitPoints(provisional)
  const now = options.completedAt ?? Date.now()
  const before = advancementSnapshot(character)
  const after = advancementSnapshot(advanced)
  const featureIds = [
    ...progressionFeatures(decision.classId, plan.fromClassLevel, plan.toClassLevel)
      .map((feature) => feature.id),
    ...subclassProgressionFeatures(
      decision.classId,
      subclassId,
      plan.fromClassLevel,
      plan.toClassLevel,
    ).map((feature) => feature.id),
  ]
  const record: Dnd5eLevelAdvancementRecordV1 = {
    schemaVersion: 1,
    id: options.recordId ?? nextRecordId(now),
    fromLevel: plan.fromLevel,
    toLevel: plan.toLevel,
    classId: decision.classId,
    fromClassLevel: plan.fromClassLevel,
    toClassLevel: plan.toClassLevel,
    completedAt: now,
    completedBy: options.completedBy ?? 'player',
    decision: structuredClone(decision),
    grantedFeatureIds: featureIds,
    before,
    after,
    revisions: options.existingRevisions ? structuredClone(options.existingRevisions) : undefined,
  }
  return {
    ok: true,
    character: {
      ...advanced,
      dnd5eLevelAdvancements: [
        ...(character.dnd5eLevelAdvancements ?? []),
        record,
      ],
    },
    record,
  }
}

export function reviseDnd5eLevelAdvancement(
  character: Character,
  recordId: string,
  decision: Dnd5eLevelAdvancementDecisionV1,
  reason?: string,
  revisedAt: number = Date.now(),
): Dnd5eLevelAdvancementResult {
  const records = character.dnd5eLevelAdvancements ?? []
  const recordIndex = records.findIndex((record) => record.id === recordId)
  const current = records[recordIndex]
  if (!current) {
    return { ok: false, reason: 'only-latest-advancement-can-be-revised' }
  }
  if (
    decision.classId !== current.classId ||
    decision.levelsGained !== current.decision.levelsGained
  ) return { ok: false, reason: 'invalid-level-gain' }
  const normalizedReason = reason?.trim()
  let replayedCharacter = restoreAdvancementSnapshot(
    { ...character, dnd5eLevelAdvancements: records.slice(0, recordIndex) },
    current.before,
  )
  const revisedRecordHistory = [
    ...(current.revisions ?? []),
    {
      revisedAt,
      revisedBy: 'dm' as const,
      ...(normalizedReason ? { reason: normalizedReason } : {}),
      previousDecision: structuredClone(current.decision),
    },
  ]
  let revisedRecord: Dnd5eLevelAdvancementRecordV1 | undefined

  for (let index = recordIndex; index < records.length; index += 1) {
    const original = records[index]
    const isRevisedRecord = index === recordIndex
    const result = applyDnd5eLevelAdvancement(
      replayedCharacter,
      isRevisedRecord ? decision : original.decision,
      {
        completedBy: isRevisedRecord ? 'dm' : original.completedBy,
        completedAt: isRevisedRecord ? revisedAt : original.completedAt,
        recordId: original.id,
        existingRevisions: isRevisedRecord ? revisedRecordHistory : original.revisions,
      },
    )
    if (!result.ok) {
      return isRevisedRecord
        ? result
        : { ok: false, reason: 'dependent-advancement-invalid' }
    }
    replayedCharacter = result.character
    if (isRevisedRecord) revisedRecord = result.record
  }

  return revisedRecord
    ? { ok: true, character: replayedCharacter, record: revisedRecord }
    : { ok: false, reason: 'only-latest-advancement-can-be-revised' }
}

/** @deprecated Use reviseDnd5eLevelAdvancement; retained for plugin/API compatibility. */
export const reviseLatestDnd5eLevelAdvancement = reviseDnd5eLevelAdvancement

export function dnd5eAdvancementRevisionBaseCharacter(
  character: Character,
  record: Dnd5eLevelAdvancementRecordV1,
): Character {
  const records = character.dnd5eLevelAdvancements ?? []
  return restoreAdvancementSnapshot(
    {
      ...character,
      dnd5eLevelAdvancements: records.filter((candidate) => candidate.id !== record.id),
    },
    record.before,
  )
}

export function dnd5eAdvancementLockedChoiceKeys(character: Character): ReadonlySet<string> {
  const keys = new Set<string>()
  for (const record of character.dnd5eLevelAdvancements ?? []) {
    if (record.decision.subclassId) keys.add(`${record.classId}:subclass`)
    for (const key of Object.keys(record.decision.classChoiceSelections ?? {})) {
      keys.add(`${record.classId}:class:${key}`)
    }
    if (record.decision.fighterFightingStyles?.length) keys.add('fighter:fighting-styles')
    for (const key of Object.keys(record.decision.fighterSubclassSelections ?? {})) {
      keys.add(`fighter:subclass:${key}`)
    }
    if (record.decision.spellSelections) {
      const plan = buildDnd5eSpellAdvancementPlan(
        restoreAdvancementSnapshot(character, record.before),
        record.classId,
        record.fromClassLevel,
        record.toClassLevel,
        record.decision.subclassId,
      )
      if (plan) {
        keys.add(`${record.classId}:class:${plan.cantripSelectionKey}`)
        if (plan.targetKnownSpellCount != null) {
          keys.add(`${record.classId}:class:${plan.spellSelectionKey}`)
        }
        if (plan.targetWizardSpellbookCount != null) {
          keys.add(`${record.classId}:class:wizard-spellbook`)
        }
      }
    }
  }
  return keys
}
