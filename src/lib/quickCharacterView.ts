export type QuickCharacterAbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export interface QuickCharacterRulesSource {
  level: number
  abilities: Record<QuickCharacterAbilityKey, number>
  savingThrows: readonly string[]
  skills: readonly string[]
  classSelections?: Record<string, readonly string[]>
  dnd5eClassChoices?: {
    fighter?: { extensionChoices?: Record<string, readonly string[]> }
    classes?: Record<string, { selections?: Record<string, readonly string[]> }>
  }
}

export type QuickCharacterCreatureFormMode = 'wild-shape' | 'polymorph' | 'true-polymorph' | 'animal-shapes' | 'shapechange'

export interface QuickCharacterCreatureFormSource {
  abilities: Record<QuickCharacterAbilityKey, number>
  savingThrows?: Partial<Record<QuickCharacterAbilityKey, number>>
  skills?: readonly { key: string; bonus: number }[]
  passivePerception: number
}

export interface QuickCharacterCreatureFormState {
  wildShapeMode?: QuickCharacterCreatureFormMode
  wildShapeOriginalAbilities?: Record<QuickCharacterAbilityKey, number>
  wildShapeOriginalSavingThrowBonuses?: Partial<Record<QuickCharacterAbilityKey, number>>
  wildShapeOriginalSavingThrowProficiencies?: readonly QuickCharacterAbilityKey[]
  wildShapeOriginalSkillProficiencies?: readonly string[]
  wildShapeOriginalPassivePerception?: number
}

export const QUICK_CHARACTER_ABILITIES = [
  { key: 'str', label: '力量' },
  { key: 'dex', label: '敏捷' },
  { key: 'con', label: '体质' },
  { key: 'int', label: '智力' },
  { key: 'wis', label: '感知' },
  { key: 'cha', label: '魅力' },
] as const

export const QUICK_CHARACTER_SKILLS = [
  { key: 'acrobatics', label: '杂技', ability: 'dex' },
  { key: 'animalHandling', label: '驯兽', ability: 'wis' },
  { key: 'arcana', label: '奥秘', ability: 'int' },
  { key: 'athletics', label: '运动', ability: 'str' },
  { key: 'deception', label: '欺瞒', ability: 'cha' },
  { key: 'history', label: '历史', ability: 'int' },
  { key: 'insight', label: '洞悉', ability: 'wis' },
  { key: 'intimidation', label: '威吓', ability: 'cha' },
  { key: 'investigation', label: '调查', ability: 'int' },
  { key: 'medicine', label: '医药', ability: 'wis' },
  { key: 'nature', label: '自然', ability: 'int' },
  { key: 'perception', label: '察觉', ability: 'wis' },
  { key: 'performance', label: '表演', ability: 'cha' },
  { key: 'persuasion', label: '游说', ability: 'cha' },
  { key: 'religion', label: '宗教', ability: 'int' },
  { key: 'sleightOfHand', label: '巧手', ability: 'dex' },
  { key: 'stealth', label: '隐匿', ability: 'dex' },
  { key: 'survival', label: '生存', ability: 'wis' },
] as const

export const QUICK_CHARACTER_EQUIPMENT_SLOTS = [
  { key: 'mainWeapon', label: '主手／法器' },
  { key: 'offHand', label: '副手／盾牌' },
  { key: 'armor', label: '护甲' },
  { key: 'helmet', label: '头部' },
  { key: 'shoes', label: '足部' },
  { key: 'ring', label: '戒指 1' },
  { key: 'ring2', label: '戒指 2' },
  { key: 'belt', label: '腰带' },
  { key: 'necklace', label: '项链' },
] as const

export const QUICK_CHARACTER_CURRENCIES = [
  { key: 'cp', label: '铜币' },
  { key: 'sp', label: '银币' },
  { key: 'ep', label: '琥珀金币' },
  { key: 'gp', label: '金币' },
  { key: 'pp', label: '铂金币' },
] as const

export function quickAbilityModifier(score: number): number {
  return Math.floor((Math.max(1, Math.min(30, Number.isFinite(score) ? score : 10)) - 10) / 2)
}

export function quickProficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.min(20, Math.max(1, level)) - 1) / 4)
}

export function quickFormatModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

function expertiseKeys(character: QuickCharacterRulesSource): Set<string> {
  const result = new Set<string>()
  for (const [key, values] of Object.entries(character.classSelections ?? {})) {
    if (key === 'expertise' || key.endsWith('-expertise')) values.forEach((value) => result.add(value))
  }
  Object.values(character.dnd5eClassChoices?.classes ?? {}).forEach((entry) => {
    for (const [key, values] of Object.entries(entry.selections ?? {})) {
      if (key === 'expertise' || key.endsWith('-expertise')) values.forEach((value) => result.add(value))
    }
  })
  for (const [key, values] of Object.entries(character.dnd5eClassChoices?.fighter?.extensionChoices ?? {})) {
    if (key === 'expertise' || key.endsWith('-expertise')) values.forEach((value) => result.add(value))
  }
  return result
}

export function quickCharacterAbilityRows(character: QuickCharacterRulesSource) {
  const proficiency = quickProficiencyBonus(character.level)
  return QUICK_CHARACTER_ABILITIES.map((definition) => {
    const score = character.abilities[definition.key]
    const modifier = quickAbilityModifier(score)
    const saveProficient = character.savingThrows.includes(definition.key)
    return {
      ...definition,
      score,
      modifier,
      saveProficient,
      savingThrowModifier: modifier + (saveProficient ? proficiency : 0),
    }
  })
}

export function quickCharacterSkillRows(character: QuickCharacterRulesSource) {
  const proficiency = quickProficiencyBonus(character.level)
  const expertise = expertiseKeys(character)
  return QUICK_CHARACTER_SKILLS.map((definition) => {
    const proficient = character.skills.includes(definition.key)
    const rank = expertise.has(definition.key) ? 2 : proficient ? 1 : 0
    return {
      ...definition,
      proficient,
      expertise: rank === 2,
      modifier: quickAbilityModifier(character.abilities[definition.ability]) + proficiency * rank,
    }
  })
}

/**
 * Mirrors the authoritative creature-form stat projection used by the headless
 * combat engine. Polymorph replaces the complete stat block; Wild Shape,
 * Animal Shapes, and Shapechange retain mental scores and take the better of
 * the creature's and the character's adjusted proficiencies.
 */
export function quickCreatureFormAbilityRows(
  character: QuickCharacterRulesSource,
  form: QuickCharacterCreatureFormSource,
  state: QuickCharacterCreatureFormState | undefined,
) {
  const mode = state?.wildShapeMode ?? 'wild-shape'
  if (mode === 'polymorph' || mode === 'true-polymorph') {
    return QUICK_CHARACTER_ABILITIES.map((definition) => {
      const score = form.abilities[definition.key]
      const modifier = quickAbilityModifier(score)
      const explicitSave = form.savingThrows?.[definition.key]
      return {
        ...definition,
        score,
        modifier,
        saveProficient: explicitSave != null && explicitSave > modifier,
        savingThrowModifier: explicitSave ?? modifier,
      }
    })
  }

  const proficiency = quickProficiencyBonus(character.level)
  const originalAbilities = state?.wildShapeOriginalAbilities ?? character.abilities
  const originalSavingThrowProficiencies = new Set(
    state?.wildShapeOriginalSavingThrowProficiencies ??
      character.savingThrows.filter((key): key is QuickCharacterAbilityKey =>
        QUICK_CHARACTER_ABILITIES.some((definition) => definition.key === key)),
  )
  const formAbilities = {
    ...originalAbilities,
    str: form.abilities.str,
    dex: form.abilities.dex,
    con: form.abilities.con,
  }

  return QUICK_CHARACTER_ABILITIES.map((definition) => {
    const ability = definition.key
    const score = formAbilities[ability]
    const modifier = quickAbilityModifier(score)
    const originalModifier = quickAbilityModifier(originalAbilities[ability])
    const originalProficiency = originalSavingThrowProficiencies.has(ability) ? proficiency : 0
    const originalBonus = state?.wildShapeOriginalSavingThrowBonuses?.[ability] ??
      originalModifier + originalProficiency
    const additionalBonus = originalBonus - originalModifier - originalProficiency
    const retainedBonus = modifier + originalProficiency + additionalBonus
    const monsterBonus = form.savingThrows?.[ability] ?? modifier
    const monsterProficient = form.savingThrows?.[ability] != null &&
      form.savingThrows[ability]! > quickAbilityModifier(form.abilities[ability])
    return {
      ...definition,
      score,
      modifier,
      saveProficient: originalSavingThrowProficiencies.has(ability) || monsterProficient,
      savingThrowModifier: Math.max(retainedBonus, monsterBonus),
    }
  })
}

export function quickCreatureFormSkillRows(
  character: QuickCharacterRulesSource,
  form: QuickCharacterCreatureFormSource,
  state: QuickCharacterCreatureFormState | undefined,
) {
  const mode = state?.wildShapeMode ?? 'wild-shape'
  if (mode === 'polymorph' || mode === 'true-polymorph') {
    return QUICK_CHARACTER_SKILLS.map((definition) => {
      const explicitSkill = form.skills?.find((entry) => entry.key === definition.key)
      return {
        ...definition,
        proficient: explicitSkill != null,
        expertise: false,
        modifier: explicitSkill?.bonus ?? quickAbilityModifier(form.abilities[definition.ability]),
      }
    })
  }

  const originalAbilities = state?.wildShapeOriginalAbilities ?? character.abilities
  const originalSkills = new Set(state?.wildShapeOriginalSkillProficiencies ?? character.skills)
  const originalRows = new Map(quickCharacterSkillRows({
    ...character,
    abilities: originalAbilities,
    skills: [...originalSkills],
  }).map((row) => [row.key, row] as const))
  const formAbilities = {
    ...originalAbilities,
    str: form.abilities.str,
    dex: form.abilities.dex,
    con: form.abilities.con,
  }

  return QUICK_CHARACTER_SKILLS.map((definition) => {
    const original = originalRows.get(definition.key)!
    const retainedBonus = original.modifier +
      quickAbilityModifier(formAbilities[definition.ability]) -
      quickAbilityModifier(originalAbilities[definition.ability])
    const monsterSkill = form.skills?.find((entry) => entry.key === definition.key)
    const monsterBonus = monsterSkill?.bonus ?? quickAbilityModifier(formAbilities[definition.ability])
    const retainedWins = retainedBonus >= monsterBonus
    return {
      ...definition,
      proficient: originalSkills.has(definition.key) || monsterSkill != null,
      expertise: retainedWins && original.expertise,
      modifier: Math.max(retainedBonus, monsterBonus),
    }
  })
}

export function quickCreatureFormPassivePerception(
  characterPassivePerception: number,
  form: QuickCharacterCreatureFormSource,
  state: QuickCharacterCreatureFormState | undefined,
): number {
  if (state?.wildShapeMode === 'polymorph' || state?.wildShapeMode === 'true-polymorph') return form.passivePerception
  return Math.max(
    state?.wildShapeOriginalPassivePerception ?? characterPassivePerception,
    form.passivePerception,
  )
}
