/** Invisible sensor locations may provide one sense or simultaneous sight/hearing.
 * Hidden bodies used for other spell projections are not implicitly invisible sensors. */
export function isDnd5eInvisibleVisionSensor(token) {
  const effect = token?.dnd5eSpellEffect
  return effect?.hiddenBody === true && !effect.linkedTargetProjection &&
    (['sight', 'hearing'].includes(effect.sensorSense) ||
      effect.visionFromSource === true && effect.shareVisionWithSource === true && effect.hearingFromSource === true)
}

export const DND5E_EFFECTIVE_VISION_PROFILE_SCHEMA_VERSION = 1

/** Resolve a room sensor source without choosing arbitrarily among duplicate identities. */
export function resolveDnd5eVisionSensorSource(token, tokens = []) {
  const binding = token?.dnd5eSpellEffect
  if (!binding?.visionFromSource) return undefined
  const exact = tokens.filter(source => source?.id === binding.sourceTokenId)
  if (exact.length > 0) return exact.length === 1 &&
    (!exact[0].characterId || exact[0].characterId === binding.sourceCharacterId) ? exact[0] : undefined
  const relocated = tokens.filter(source => source?.characterId === binding.sourceCharacterId && !source?.dnd5eSpellEffect)
  return relocated.length === 1 ? relocated[0] : undefined
}

/** A sensor owns its position, while its visual capabilities follow its source. */
export function projectDnd5eSourceVisionSensor(token, input = {}) {
  if (token?.dnd5eSpellEffect?.visionFromSource !== true) return token
  const source = input.sourceToken
  const available = source != null || input.character != null
  const profile = compileDnd5eEffectiveVisionProfile({
    token: available ? source ?? {} : { visionRangeFeet: 0 },
    character: input.character,
    fallbackRangeFeet: available ? input.fallbackRangeFeet : 0,
  })
  const sources = [source, source?.dnd5eCombatState, source?.classState, input.character,
    input.character?.dnd5eCombatState, input.character?.classState]
  const blinded = sources.some(value => value?.conditions?.some(condition => ['blinded', '失明'].includes(normalizedText(condition)))) ||
    activeEffectsFrom({ token: source, character: input.character }).some(effect => effect?.legacyCondition === 'blinded')
  const deafened = sources.some(value => value?.conditions?.some(condition => ['deafened', '耳聋'].includes(normalizedText(condition)))) ||
    activeEffectsFrom({ token: source, character: input.character }).some(effect => effect?.legacyCondition === 'deafened')
  const hearingOnly = token.dnd5eSpellEffect.sensorSense === 'hearing'
  if (blinded || hearingOnly) {
    Object.assign(profile, { normalRangeFeet: 0, darkvisionRangeFeet: 0, darknessSightRangeFeet: 0,
      magicalDarknessSightRangeFeet: 0, truesightRangeFeet: 0, tokenBaseDarkvisionRangeFeet: 0,
      intrinsicDarkvisionRangeFeet: 0, projectedCharacterVision: normalizeDnd5eProjectedCharacterVision({}),
      formDarkvisionRangeFeet: undefined, formRetainsDarkvision: undefined })
  }
  if (hearingOnly) Object.assign(profile, { blindsightRangeFeet: 0, tremorsenseRangeFeet: 0 })
  return applyDnd5eEffectiveVisionProfile({ ...token, visionRangeFeet: profile.normalRangeFeet,
    dnd5eSourceSightDisabled: blinded || hearingOnly || undefined,
      dnd5eSourceHearingDisabled: token.dnd5eSpellEffect.hearingFromSource === true && (!available || deafened || token.dnd5eSpellEffect.sensorSense === 'sight') || undefined,
    dnd5eSourceSeeInvisible: !blinded && !hearingOnly && activeEffectsFrom({ token: source, character: input.character }).some(effect =>
      effect?.modifiers?.seeInvisible === true || effect?.definitionId === 'srd-5.1:spell:see-invisibility' ||
      ['see-invisibility', 'srd-5.1:spell:see-invisibility'].includes(effect?.source?.rulesId)) || undefined,
    dnd5eBaseDarkvisionRangeFeet: undefined, dnd5eProjectedDarkvisionRangeFeet: undefined,
    dnd5eProjectedCharacterVision: undefined, dnd5eFormDarkvisionRangeFeet: undefined, dnd5eFormRetainsDarkvision: undefined,
  }, profile)
}

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
  ].filter((effect) => !(Array.isArray(effect?.suspendedBy) && effect.suspendedBy.length > 0))
}

function activeEffectDarkvisionRangeFeet(input) {
  return activeEffectsFrom(input).reduce((maximum, effect) => Math.max(
    maximum,
    rangeFeet(effect?.modifiers?.darkvisionRangeFeet),
  ), 0)
}

/** Retain only numeric sense data, never full character/effect content. */
export function normalizeDnd5eProjectedCharacterVision(value) {
  if (!plainObject(value)) return undefined
  const activeEffects = activeEffectsFrom({ character: value }).map(effect => ({
    ...(typeof effect?.id === 'string' ? { id: effect.id } : {}),
    source: { actorId: typeof effect?.source?.actorId === 'string' ? effect.source.actorId : undefined, ...(effect?.source?.magical === true ? { magical: true } : {}) },
    modifiers: { sightRangeLimitFeet: rangeFeet(effect?.modifiers?.sightRangeLimitFeet), darkvisionRangeFeet: rangeFeet(effect?.modifiers?.darkvisionRangeFeet),
      darkvisionIfAbsentFeet: rangeFeet(effect?.modifiers?.darkvisionIfAbsentFeet),
      darkvisionExistingBonusFeet: rangeFeet(effect?.modifiers?.darkvisionExistingBonusFeet),
      darkvisionRacialFallbackFeet: rangeFeet(effect?.modifiers?.darkvisionRacialFallbackFeet),
      darkvisionRacialBonusFeet: rangeFeet(effect?.modifiers?.darkvisionRacialBonusFeet) },
  })).filter(effect => Object.values(effect.modifiers).some(value => value > 0))
  return { darkvisionRangeFeet: rangeFeet(value.darkvisionRangeFeet),
    racialDarkvisionRangeFeet: rangeFeet(value.racialDarkvisionRangeFeet),
    darkvisionRacialFallbackFeet: rangeFeet(value.darkvisionRacialFallbackFeet),
    darkvisionRacialBonusFeet: rangeFeet(value.darkvisionRacialBonusFeet),
    darkvisionIfAbsentFeet: rangeFeet(value.darkvisionIfAbsentFeet),
    darkvisionExistingBonusFeet: rangeFeet(value.darkvisionExistingBonusFeet), classState: { activeEffects } }
}

/** Capability only: each observer must still qualify at the target's illumination. */
export function dnd5eHasDarkvisionConcealment(input = {}) {
  const token = input.token ?? {}
  const character = input.character ?? {}
  const mode = token.classState?.wildShapeMode ?? token.dnd5eCombatState?.wildShapeMode ?? character.dnd5eCombatState?.wildShapeMode
  const replacesTraits = ['polymorph', 'true-polymorph', 'animal-shapes'].includes(mode)
  return (!replacesTraits && (token.invisibleToDarkvision === true ||
    token.dnd5eCharacterInvisibleToDarkvision === true || character.invisibleToDarkvision === true)) ||
    activeEffectsFrom(input).some(effect => effect?.modifiers?.invisibleToDarkvision === true &&
      !(token.magicSuppressed === true && effect?.source?.magical === true))
}

export function dnd5eConcealedFromDarkvision(input) {
  return input.concealment === true && input.illumination === 'darkness' &&
    input.hasDarkvision === true && !input.alternativeSight && !input.seeInvisible && !input.outlined
}

function conditionalDarkvision(input, existingRangeFeet, retainCharacterSenses = true) {
  const token = input.token ?? {}
  const character = input.character ?? {}
  const racialRange = retainCharacterSenses ? Math.max(rangeFeet(token.racialDarkvisionRangeFeet),
    rangeFeet(token.dnd5eCharacterRacialDarkvisionRangeFeet), rangeFeet(character.racialDarkvisionRangeFeet)) : 0
  let racialFallback = retainCharacterSenses ? Math.max(rangeFeet(token.darkvisionRacialFallbackFeet),
    rangeFeet(token.dnd5eCharacterDarkvisionRacialFallbackFeet), rangeFeet(character.darkvisionRacialFallbackFeet)) : 0
  let racialBonus = retainCharacterSenses ? Math.max(rangeFeet(token.darkvisionRacialBonusFeet),
    rangeFeet(token.dnd5eCharacterDarkvisionRacialBonusFeet), rangeFeet(character.darkvisionRacialBonusFeet)) : 0
  let ifAbsent = Math.max(rangeFeet(token.darkvisionIfAbsentFeet),
    rangeFeet(token.dnd5eCharacterDarkvisionIfAbsentFeet), rangeFeet(character.darkvisionIfAbsentFeet))
  let bonus = Math.max(rangeFeet(token.darkvisionExistingBonusFeet),
    rangeFeet(token.dnd5eCharacterDarkvisionExistingBonusFeet), rangeFeet(character.darkvisionExistingBonusFeet))
  if (!retainCharacterSenses) { ifAbsent = 0; bonus = 0 }
  const seen = new Set()
  for (const effect of activeEffectsFrom(input)) {
    // A character-bound token can mirror the same live effect. Count it once.
    const key = typeof effect?.id === 'string' ? `${effect.source?.actorId ?? ''}\0${effect.id}` : effect
    if (seen.has(key)) continue
    seen.add(key)
    ifAbsent = Math.max(ifAbsent, rangeFeet(effect?.modifiers?.darkvisionIfAbsentFeet))
    bonus += rangeFeet(effect?.modifiers?.darkvisionExistingBonusFeet)
    racialFallback = Math.max(racialFallback, rangeFeet(effect?.modifiers?.darkvisionRacialFallbackFeet))
    racialBonus += rangeFeet(effect?.modifiers?.darkvisionRacialBonusFeet)
  }
  if (racialFallback > 0 || racialBonus > 0) {
    existingRangeFeet = Math.max(existingRangeFeet, racialRange > 0 ? racialRange + racialBonus : racialFallback)
  }
  return { range: Math.min(MAX_RANGE_FEET, existingRangeFeet > 0 ? existingRangeFeet + bonus : ifAbsent),
    conditional: ifAbsent > 0 || bonus > 0 || racialFallback > 0 || racialBonus > 0 }
}

function activeEffectTruesightRangeFeet(input) {
  return activeEffectsFrom(input).reduce((maximum, effect) => Math.max(
    maximum,
    rangeFeet(effect?.modifiers?.truesightRangeFeet),
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

export function dnd5eCharacterDarkvisionRangeFeet(character) {
  if (!plainObject(character)) return 0
  return rangeFeet(character.darkvisionRangeFeet)
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
  const cachedCharacter = normalizeDnd5eProjectedCharacterVision(token.dnd5eProjectedCharacterVision)
  // Explicit current character data supersedes a previously projected snapshot.
  const character = plainObject(input.character) ? input.character : cachedCharacter
  const hasCurrentTokenEffects = token.dnd5eSpellEffect?.visionFromSource !== true &&
    (Array.isArray(token.dnd5eCombatState?.activeEffects) || Array.isArray(token.classState?.activeEffects))
  const effectiveCharacter = !plainObject(input.character) && cachedCharacter && hasCurrentTokenEffects
    ? { ...cachedCharacter, classState: { activeEffects: [] } } : character
  input = { ...input, token, character: effectiveCharacter }
  const monster = plainObject(input.monster) ? input.monster : undefined
  const blindBeyondBlindsight = token.blindBeyondBlindsight === true ||
    monster?.senses?.some(sense => sense.blindBeyond === true && /blindsight|盲视/i.test(sense.name)) === true
  const sightRangeLimitFeet = activeEffectsFrom(input).reduce((limit, effect) => {
    if (token.magicSuppressed === true && effect?.source?.magical === true) return limit
    const value = effect?.modifiers?.sightRangeLimitFeet
    return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= MAX_RANGE_FEET ? Math.min(limit, value) : limit
  }, Infinity)
  const fallbackRangeFeet = rangeFeet(input.fallbackRangeFeet)
  const normalRangeFeet = optionalRangeFeet(token.visionRangeFeet) ?? fallbackRangeFeet
  const characterDarkvision = dnd5eCharacterDarkvisionRangeFeet(character)
  const monsterDarkvision = monsterSenseRangeFeet(monster, ['darkvision', '\u9ed1\u6697\u89c6\u89c9'])
  const usesProjectedRange = token.dnd5eProjectedDarkvisionRangeFeet == null || rangeFeet(token.darkvisionRangeFeet) === rangeFeet(token.dnd5eProjectedDarkvisionRangeFeet)
  const tokenBaseDarkvisionRangeFeet = (usesProjectedRange ? optionalRangeFeet(token.dnd5eBaseDarkvisionRangeFeet) : null) ?? rangeFeet(token.darkvisionRangeFeet)
  const formOwner = plainObject(input.character) && Object.prototype.hasOwnProperty.call(input.character, 'dnd5eFormDarkvisionRangeFeet') ? input.character : token
  const formRange = optionalRangeFeet(formOwner.dnd5eFormDarkvisionRangeFeet)
  const retainsFormSenses = formOwner.dnd5eFormRetainsDarkvision === true
  const retainCharacterSenses = formRange == null || formRange > 0 && retainsFormSenses
  const originalDarkvisionRangeFeet = Math.max(
    tokenBaseDarkvisionRangeFeet,
    rangeFeet(token.dnd5eCharacterDarkvisionRangeFeet),
    characterDarkvision,
    monsterDarkvision,
  )
  const intrinsicDarkvisionRangeFeet = formRange == null ? originalDarkvisionRangeFeet
    : retainCharacterSenses ? Math.max(formRange, originalDarkvisionRangeFeet) : formRange
  const existingDarkvisionRangeFeet = Math.max(intrinsicDarkvisionRangeFeet, activeEffectDarkvisionRangeFeet(input))
  const conditional = conditionalDarkvision(input, existingDarkvisionRangeFeet, retainCharacterSenses)
  const darkvisionRangeFeet = conditional.range
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
    activeEffectTruesightRangeFeet(input),
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
    ...(blindBeyondBlindsight ? { blindBeyondBlindsight: true } : {}),
    ...(Number.isFinite(sightRangeLimitFeet) ? { sightRangeLimitFeet } : {}),
    normalRangeFeet,
    darkvisionRangeFeet,
    ...(Number.isFinite(sightRangeLimitFeet) || conditional.conditional || formRange != null || token.dnd5eBaseDarkvisionRangeFeet != null ? { tokenBaseDarkvisionRangeFeet, intrinsicDarkvisionRangeFeet,
      formDarkvisionRangeFeet: formRange ?? undefined, formRetainsDarkvision: formRange == null ? undefined : retainsFormSenses,
      projectedCharacterVision: normalizeDnd5eProjectedCharacterVision({ ...effectiveCharacter,
        dnd5eCombatState: undefined,
        classState: { activeEffects: [...activeEffectsFrom({ character: effectiveCharacter }),
          ...activeEffectsFrom({ token }).filter(effect => effect?.modifiers?.sightRangeLimitFeet != null)] },
      }) } : {}),
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
    blindBeyondBlindsight: profile.blindBeyondBlindsight || undefined,
    darkvisionRangeFeet: profile.darkvisionRangeFeet || undefined,
    ...(profile.tokenBaseDarkvisionRangeFeet != null ? { dnd5eBaseDarkvisionRangeFeet: profile.tokenBaseDarkvisionRangeFeet,
      dnd5eProjectedDarkvisionRangeFeet: profile.darkvisionRangeFeet,
      dnd5eFormDarkvisionRangeFeet: profile.formDarkvisionRangeFeet,
      dnd5eFormRetainsDarkvision: profile.formRetainsDarkvision,
      dnd5eProjectedCharacterVision: profile.projectedCharacterVision } : {}),
    darknessSightRangeFeet: profile.darknessSightRangeFeet || undefined,
    magicalDarknessSightRangeFeet: profile.magicalDarknessSightRangeFeet || undefined,
    blindsightRangeFeet: profile.blindsightRangeFeet || undefined,
    tremorsenseRangeFeet: profile.tremorsenseRangeFeet || undefined,
    truesightRangeFeet: profile.truesightRangeFeet || undefined,
  }
}
