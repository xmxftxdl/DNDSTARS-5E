export const DND5E_EFFECTIVE_VISION_PROFILE_SCHEMA_VERSION = 1

const MAX_RANGE_FEET = 10_000
const DEVILS_SIGHT_RANGE_FEET = 120

function plainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function optionalRangeFeet(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_RANGE_FEET, value))
    : null
}

function rangeFeet(value) {
  return optionalRangeFeet(value) ?? 0
}

function normalizedText(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : ''
}

function activeEffectsFrom(input) {
  return [
    ...(Array.isArray(input?.token?.dnd5eCombatState?.activeEffects)
      ? input.token.dnd5eCombatState.activeEffects
      : []),
    ...(Array.isArray(input?.token?.classState?.activeEffects)
      ? input.token.classState.activeEffects
      : []),
    ...(Array.isArray(input?.character?.dnd5eCombatState?.activeEffects)
      ? input.character.dnd5eCombatState.activeEffects
      : []),
    ...(Array.isArray(input?.character?.classState?.activeEffects)
      ? input.character.classState.activeEffects
      : []),
  ]
}

function activeEffectDarkvisionRangeFeet(input) {
  return activeEffectsFrom(input).reduce((maximum, effect) => Math.max(
    maximum,
    rangeFeet(effect?.modifiers?.darkvisionRangeFeet),
  ), 0)
}

function selectionContainsDevilsSight(value) {
  if (Array.isArray(value)) {
    return value.some((entry) => {
      const id = normalizedText(entry)
      return id === 'devils-sight' || id.endsWith(':devils-sight')
    })
  }
  if (!plainObject(value)) return false
  return Object.values(value).some(selectionContainsDevilsSight)
}

export function dnd5eCharacterHasDevilsSight(character) {
  if (!plainObject(character)) return false
  return selectionContainsDevilsSight(character.dnd5eClassChoices) ||
    selectionContainsDevilsSight(character.classSelections) ||
    selectionContainsDevilsSight(character.classSelectionsByClass)
}

export function dnd5eCoreRaceDarkvisionRangeFeet(character) {
  if (!plainObject(character)) return 0
  const identifiers = [
    normalizedText(character.dnd5eRaceId),
    normalizedText(character.race),
  ].filter(Boolean)
  const coreDarkvisionRaces = new Set([
    'dwarf',
    'hill-dwarf',
    'mountain-dwarf',
    'elf',
    'high-elf',
    'wood-elf',
    'gnome',
    'rock-gnome',
    'forest-gnome',
    'half-elf',
    'half-orc',
    'tiefling',
    '\u77ee\u4eba',
    '\u4e18\u9675\u77ee\u4eba',
    '\u5c71\u5730\u77ee\u4eba',
    '\u7cbe\u7075',
    '\u9ad8\u7b49\u7cbe\u7075',
    '\u6728\u7cbe\u7075',
    '\u4f8f\u5112',
    '\u5ca9\u5730\u4f8f\u5112',
    '\u68ee\u6797\u4f8f\u5112',
    '\u534a\u7cbe\u7075',
    '\u534a\u517d\u4eba',
    '\u63d0\u592b\u6797',
  ])
  const superiorDarkvisionRaces = new Set([
    'drow',
    'dark-elf',
    '\u5353\u5c14',
    '\u9ed1\u6697\u7cbe\u7075',
  ])
  if (identifiers.some((identifier) =>
    [...superiorDarkvisionRaces].some((race) => identifier === race || identifier.endsWith(`:${race}`))
  )) return 120
  return identifiers.some((identifier) => coreDarkvisionRaces.has(identifier)) ? 60 : 0
}

function monsterSenseRangeFeet(monster, aliases) {
  if (!plainObject(monster) || !Array.isArray(monster.senses)) return 0
  return monster.senses.reduce((maximum, sense) => {
    const name = normalizedText(sense?.name)
    return aliases.some((alias) => name.includes(alias))
      ? Math.max(maximum, rangeFeet(sense?.distanceFeet))
      : maximum
  }, 0)
}

function monsterHasDevilsSight(monster) {
  if (!plainObject(monster)) return false
  const traitCollections = [
    monster.traits,
    monster.specialTraits,
    monster.features,
  ]
  return traitCollections.some((collection) => Array.isArray(collection) && collection.some((trait) => {
    const name = normalizedText(trait?.name)
    return name.includes("devil's sight") || name.includes('devils sight') ||
      name.includes('\u9b54\u9b3c\u89c6\u754c')
  }))
}

/**
 * Compiles the only vision profile used by server projection, the map renderer,
 * and D&D 5e Headless. All inputs are untrusted snapshots; the returned values
 * are bounded host-owned numbers.
 */
export function compileDnd5eEffectiveVisionProfile(input = {}) {
  const token = plainObject(input.token) ? input.token : {}
  const character = plainObject(input.character) ? input.character : undefined
  const monster = plainObject(input.monster) ? input.monster : undefined
  const fallbackRangeFeet = rangeFeet(input.fallbackRangeFeet)
  const normalRangeFeet = optionalRangeFeet(token.visionRangeFeet) ?? fallbackRangeFeet
  const racialDarkvision = dnd5eCoreRaceDarkvisionRangeFeet(character)
  const monsterDarkvision = monsterSenseRangeFeet(monster, ['darkvision', '\u9ed1\u6697\u89c6\u89c9'])
  const darkvisionRangeFeet = Math.max(
    rangeFeet(token.darkvisionRangeFeet),
    racialDarkvision,
    monsterDarkvision,
    activeEffectDarkvisionRangeFeet(input),
  )
  const blindsightRangeFeet = Math.max(
    rangeFeet(token.blindsightRangeFeet),
    monsterSenseRangeFeet(monster, ['blindsight', '\u76f2\u89c6']),
  )
  const tremorsenseRangeFeet = Math.max(
    rangeFeet(token.tremorsenseRangeFeet),
    monsterSenseRangeFeet(monster, ['tremorsense', '\u9707\u98a4\u611f\u77e5']),
  )
  const truesightRangeFeet = Math.max(
    rangeFeet(token.truesightRangeFeet),
    monsterSenseRangeFeet(monster, ['truesight', '\u771f\u89c6']),
  )
  const devilsSight = dnd5eCharacterHasDevilsSight(character) || monsterHasDevilsSight(monster)
  const explicitDarknessSightRangeFeet = rangeFeet(token.darknessSightRangeFeet)
  const explicitMagicalDarknessSightRangeFeet = rangeFeet(token.magicalDarknessSightRangeFeet)
  const legacyMagicalDarknessRangeFeet = token.canSeeMagicalDarkness === true
    ? normalRangeFeet
    : 0
  const devilsSightRangeFeet = devilsSight
    ? Math.max(
        monsterDarkvision,
        DEVILS_SIGHT_RANGE_FEET,
      )
    : 0

  return {
    schemaVersion: DND5E_EFFECTIVE_VISION_PROFILE_SCHEMA_VERSION,
    normalRangeFeet,
    darkvisionRangeFeet,
    darknessSightRangeFeet: Math.max(explicitDarknessSightRangeFeet, devilsSightRangeFeet),
    magicalDarknessSightRangeFeet: Math.max(
      explicitMagicalDarknessSightRangeFeet,
      legacyMagicalDarknessRangeFeet,
      devilsSightRangeFeet,
    ),
    blindsightRangeFeet,
    tremorsenseRangeFeet,
    truesightRangeFeet,
  }
}

export function applyDnd5eEffectiveVisionProfile(token, profile) {
  return {
    ...token,
    darkvisionRangeFeet: profile.darkvisionRangeFeet || undefined,
    darknessSightRangeFeet: profile.darknessSightRangeFeet || undefined,
    magicalDarknessSightRangeFeet: profile.magicalDarknessSightRangeFeet || undefined,
    blindsightRangeFeet: profile.blindsightRangeFeet || undefined,
    tremorsenseRangeFeet: profile.tremorsenseRangeFeet || undefined,
    truesightRangeFeet: profile.truesightRangeFeet || undefined,
  }
}
