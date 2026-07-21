import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { BattleMap, Token } from '../../store/maps'
import { dnd5eCombatTokenSide } from '../../lib/opportunityAttacks'
import type { Character } from '../../types/character'
import type { Dnd5eAttackCoverOverride } from '../../lib/sharedCombatTypes'
import { getTokenTargetAc } from '../../lib/enemyCombatStats'
import { DND_FEET_PER_CELL, tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import { mapGeometryCanSeeToken, mapGeometryCoverBetween, mapGeometryLineOfSightBlocked, mapGeometryRuntimeForMap } from '../../lib/mapGeometry'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { createDnd5eCombatant, dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey, startDnd5eHeadlessCombat, type Dnd5eCombatant, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eMonsterMapSpeed, dnd5eMonsterProficiencyBonus, getDnd5eSrdMonster } from './monsters'
import { dnd5eCanThreatenRangedAttacker, dnd5eClassPassiveDefenses, dnd5eConditionImmuneFromSource, dnd5eIsIncapacitated } from './passiveDefenses'
import { dnd5eChallengeRatingValue } from './wildShape'
import { DND5E_COMBAT_STATE_SCHEMA_VERSION } from './activeEffects'

export interface Dnd5eMapCombatSnapshot {
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Record<string, string>
}

export interface Dnd5eAttackCoverSnapshot {
  cover: Dnd5eAttackCoverOverride
  armorClassBonus: 0 | 2 | 5
  blocksLineOfEffect: boolean
}

export function dnd5eAttackCoverForPair(
  state: Pick<Dnd5eHeadlessCombatState, 'coverBonusByCombatantPair' | 'lineOfEffectBlockedByCombatantPair'>,
  attackerId: string,
  targetId: string,
): Dnd5eAttackCoverSnapshot {
  const key = dnd5eDirectedCombatantPairKey(attackerId, targetId)
  if (state.lineOfEffectBlockedByCombatantPair?.[key]) {
    return { cover: 'total', armorClassBonus: 0, blocksLineOfEffect: true }
  }
  const armorClassBonus = state.coverBonusByCombatantPair?.[key] ?? 0
  return armorClassBonus === 5
    ? { cover: 'three-quarters', armorClassBonus, blocksLineOfEffect: false }
    : armorClassBonus === 2
      ? { cover: 'half', armorClassBonus, blocksLineOfEffect: false }
      : { cover: 'none', armorClassBonus: 0, blocksLineOfEffect: false }
}

/** Applies a DM ruling only to the ephemeral state used by one attack transaction. */
export function applyDnd5eAttackCoverOverride(
  state: Dnd5eHeadlessCombatState,
  attackerId: string,
  targetId: string,
  cover: Dnd5eAttackCoverOverride,
): Dnd5eAttackCoverSnapshot {
  const key = dnd5eDirectedCombatantPairKey(attackerId, targetId)
  state.coverBonusByCombatantPair ??= {}
  state.lineOfEffectBlockedByCombatantPair ??= {}
  delete state.coverBonusByCombatantPair[key]
  delete state.lineOfEffectBlockedByCombatantPair[key]
  if (cover === 'total') state.lineOfEffectBlockedByCombatantPair[key] = true
  else if (cover === 'half') state.coverBonusByCombatantPair[key] = 2
  else if (cover === 'three-quarters') state.coverBonusByCombatantPair[key] = 5
  return dnd5eAttackCoverForPair(state, attackerId, targetId)
}

const DEFAULT_ABILITIES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const

export function dnd5eMapTokenCanThreatenRangedAttacker(
  attacker: Dnd5eCombatant,
  hostileToken: Token,
  hostileCombatant?: Dnd5eCombatant,
): boolean {
  const currentHp = hostileCombatant?.currentHp ?? hostileToken.hp ?? hostileToken.maxHp ?? 1
  if (currentHp <= 0 || hostileCombatant?.deathSaves.dead) return false
  const tokenState = hostileToken.dnd5eCombatState
  return dnd5eCanThreatenRangedAttacker(attacker, hostileCombatant ?? {
    classState: tokenState ?? {},
    conditions: tokenState?.conditions ?? [],
  })
}

function compactOptionalRecord<T extends object>(value: T): Partial<T> | undefined {
  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined)
  return entries.length > 0 ? Object.fromEntries(entries) as Partial<T> : undefined
}

function applyPaladinAuras(map: BattleMap, combatants: Dnd5eCombatant[]): void {
  const tokenById = new Map(map.tokens.map((token) => [token.id, token]))
  const paladins = combatants.filter((combatant) =>
    combatant.classId === 'paladin' && combatant.level >= 6 && combatant.currentHp > 0 && !combatant.classState.stunnedByActorId,
  )
  if (paladins.length === 0) return
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  for (const target of combatants) {
    const targetToken = tokenById.get(target.id)
    if (!targetToken) continue
    let savingThrowAuraBonus = 0
    let courageAura = false
    let devotionAura = false
    for (const paladin of paladins) {
      const paladinToken = tokenById.get(paladin.id)
      if (!paladinToken || areOpposedCombatTokens(paladinToken, targetToken)) continue
      const radius = paladin.level >= 18 ? 30 : 10
      if (tokenFootprintDistanceCells(paladinToken, targetToken, map) * feetPerCell > radius) continue
      savingThrowAuraBonus = Math.max(savingThrowAuraBonus, Math.max(1, rules.abilityModifier(paladin.abilities.cha)))
      if (paladin.level >= 10) courageAura = true
      if (paladin.subclassId === 'devotion' && paladin.level >= 7) devotionAura = true
    }
    if (savingThrowAuraBonus > 0) {
      for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const) {
        const base = target.savingThrowBonuses[ability] ?? rules.abilityModifier(target.abilities[ability])
        target.savingThrowBonuses[ability] = base + savingThrowAuraBonus
      }
    }
    if (courageAura) {
      target.conditionImmunities = [...new Set([...target.conditionImmunities, 'frightened', '惊惧', '恐慌'])]
    }
    if (devotionAura) {
      target.conditionImmunities = [...new Set([...target.conditionImmunities, 'charmed', '魅惑'])]
    }
  }
}

function applyClassPassiveDefenses(combatants: Dnd5eCombatant[]): void {
  for (const combatant of combatants) {
    const passive = dnd5eClassPassiveDefenses(combatant)
    combatant.damageImmunities = [...new Set([...combatant.damageImmunities, ...passive.damageImmunities])]
    combatant.conditionImmunities = [...new Set([...combatant.conditionImmunities, ...passive.conditionImmunities])]
  }
}

function applyBardCountercharm(map: BattleMap, combatants: Dnd5eCombatant[]): void {
  const tokenById = new Map(map.tokens.map((token) => [token.id, token]))
  const sources = combatants.filter((combatant) => {
    if (combatant.classId !== 'bard' || combatant.level < 6 || (combatant.classState.countercharmRoundsRemaining ?? 0) <= 0) return false
    const performanceEnded = combatant.currentHp <= 0 || dnd5eIsIncapacitated(combatant) ||
      combatant.conditions.some((condition) => ['silenced', '沉默'].includes(condition.toLowerCase()))
    if (performanceEnded) combatant.classState.countercharmRoundsRemaining = undefined
    return !performanceEnded
  })
  if (sources.length === 0) return
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  for (const target of combatants) {
    if (target.conditions.some((condition) => ['deafened', '耳聋'].includes(condition.toLowerCase()))) continue
    const targetToken = tokenById.get(target.id)
    if (!targetToken) continue
    const sourceIds = sources.flatMap((source) => {
      const sourceToken = tokenById.get(source.id)
      if (!sourceToken || areOpposedCombatTokens(sourceToken, targetToken)) return []
      return tokenFootprintDistanceCells(sourceToken, targetToken, map) * feetPerCell <= 30 ? [source.id] : []
    })
    if (sourceIds.length > 0) target.countercharmSourceIds = sourceIds
  }
}

function applyHolyNimbusSources(map: BattleMap, combatants: Dnd5eCombatant[]): void {
  const tokenById = new Map(map.tokens.map((token) => [token.id, token]))
  const sources = combatants.filter((combatant) =>
    combatant.classId === 'paladin' && combatant.subclassId === 'devotion' && combatant.level >= 20 &&
    combatant.currentHp > 0 && (combatant.classState.holyNimbusRoundsRemaining ?? 0) > 0,
  )
  if (sources.length === 0) return
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  for (const target of combatants) {
    const targetToken = tokenById.get(target.id)
    if (!targetToken || target.currentHp <= 0) continue
    const sourceIds = sources.flatMap((source) => {
      const sourceToken = tokenById.get(source.id)
      if (!sourceToken || !areOpposedCombatTokens(sourceToken, targetToken)) return []
      return tokenFootprintDistanceCells(sourceToken, targetToken, map) * feetPerCell <= 30 ? [source.id] : []
    })
    if (sourceIds.length > 0) target.holyNimbusSourceIds = sourceIds
  }
}

function applyDraconicPresenceSources(map: BattleMap, combatants: Dnd5eCombatant[]): void {
  const tokenById = new Map(map.tokens.map((token) => [token.id, token]))
  const sources = combatants.filter((combatant) =>
    combatant.classId === 'sorcerer' && combatant.subclassId === 'draconic' && combatant.level >= 18 &&
    combatant.currentHp > 0 && combatant.concentrating &&
    combatant.classState.concentrationSpellId?.startsWith('class:draconic-presence:'),
  )
  if (sources.length === 0) return
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  for (const target of combatants) {
    const targetToken = tokenById.get(target.id)
    if (!targetToken || target.currentHp <= 0) continue
    const sourceIds = sources.flatMap((source) => {
      const sourceToken = tokenById.get(source.id)
      const effectId = source.classState.concentrationSpellId!
      const mode = effectId.endsWith(':fear') ? 'fear' : 'awe'
      const condition = mode === 'fear' ? 'frightened' : 'charmed'
      if (
        !sourceToken || !areOpposedCombatTokens(sourceToken, targetToken) ||
        (target.classState.draconicPresenceImmunityRoundsBySource?.[source.id] ?? 0) > 0 ||
        target.classState.concentrationEffectsBySource?.[source.id] === effectId ||
        dnd5eConditionImmuneFromSource(target, condition, source)
      ) return []
      return tokenFootprintDistanceCells(sourceToken, targetToken, map) * feetPerCell <= 60 ? [source.id] : []
    })
    if (sourceIds.length > 0) target.draconicPresenceSourceIds = sourceIds
  }
}

export function createDnd5eMapCombatSnapshot(input: {
  combatId: string
  round?: number
  turnSlotId?: string
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
}): Dnd5eMapCombatSnapshot {
  const charactersById = new Map(input.characters.map((character) => [character.id, character]))
  const initiativeByTokenId = new Map<string, number>()
  for (const entry of input.initiativeOrder) {
    // Extra first-round slots must not replace the creature's normal initiative
    // when a per-action Headless snapshot builds its unique combatant order.
    if (!initiativeByTokenId.has(entry.tokenId) || !entry.turnKind) {
      initiativeByTokenId.set(entry.tokenId, entry.roll)
    }
  }
  const characterIdByCombatantId: Record<string, string> = {}
  const combatants = input.map.tokens.flatMap((token) => {
    if (token.type !== 'player' && token.type !== 'enemy') return []
    const initiative = initiativeByTokenId.get(token.id)
    if (initiative == null) return []
    const character = token.characterId ? charactersById.get(token.characterId) : undefined
    if (character) {
      const migrated = migrateCharacterToDnd5e(character)
      characterIdByCombatantId[token.id] = character.id
      const combatant = createCombatantFromDnd5eCharacter({
        character: migrated,
        controller: dnd5eCombatTokenSide(token) === 'player' ? 'player' : 'dm',
        initiativeD20: Math.max(1, Math.min(20, initiative - migrated.initiativeBonus)),
        position: { x: token.x, y: token.y },
      })
      return [{
        ...combatant,
        id: token.id,
        name: token.label,
        initiative,
        sizeRank: ({ 微型: 0, 小型: 1, 中型: 2, 大型: 3, 超大型: 4, 巨型: 5 } as const)[token.creatureSize ?? '中型'],
      }]
    }
    const monster = token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
    const maxHp = Math.max(1, token.maxHp ?? monster?.hitPoints.average ?? token.hp ?? 1)
    const {
      conditions: tokenConditions,
      temporaryHp: tokenTemporaryHp,
      ...tokenClassState
    } = token.dnd5eCombatState ?? {}
    return [createDnd5eCombatant({
      id: token.id,
      name: token.label,
      controller: dnd5eCombatTokenSide(token) === 'player' ? 'player' : 'dm',
      initiative,
      abilities: monster ? { ...monster.abilities } : { ...DEFAULT_ABILITIES },
      savingThrowBonuses: monster?.savingThrows,
      skillProficiencies: monster?.skills?.map((skill) => skill.key),
      passivePerception: 10 + (monster?.skills?.find((skill) => skill.key === 'perception')?.bonus ??
        rules.abilityModifier(monster?.abilities.wis ?? DEFAULT_ABILITIES.wis)),
      proficiencyBonus: monster ? dnd5eMonsterProficiencyBonus(monster.challenge.rating) : 2,
      challengeRating: monster ? dnd5eChallengeRatingValue(monster.challenge.rating) : undefined,
      sizeRank: ({ 微型: 0, 小型: 1, 中型: 2, 大型: 3, 超大型: 4, 巨型: 5 } as const)[token.creatureSize ?? monster?.size ?? '中型'],
      armorClass: monster?.armorClass.value ?? getTokenTargetAc(token) ?? 10,
      currentHp: Math.max(0, Math.min(maxHp, token.hp ?? maxHp)),
      maxHp,
      temporaryHp: Math.max(0, Math.floor(tokenTemporaryHp ?? 0)),
      exhaustionLevel: 0,
      speed: monster ? dnd5eMonsterMapSpeed(monster) : 30,
      position: { x: token.x, y: token.y },
      concentrating: !!tokenClassState.concentrationSpellId,
      classState: {
        ...tokenClassState,
        legendaryResistanceUses: tokenClassState.legendaryResistanceUses ?? monster?.legendaryResistanceUses,
      },
      wearingArmor: !!monster?.armorClass.note && !monster.armorClass.note.includes('天生护甲'),
      wearingMetalArmor: !!monster?.armorClass.note && [
        '链甲', '鳞甲', '胸甲', '半身板甲', '环甲', '板条甲', '板甲',
        'chain', 'scale', 'breastplate', 'half plate', 'ring mail', 'splint', 'plate',
      ].some((name) => monster.armorClass.note!.toLowerCase().includes(name)),
      conditions: tokenConditions,
      statBlockId: monster?.id,
      creatureType: monster?.creatureType,
      damageVulnerabilities: monster?.damageVulnerabilities,
      damageResistances: monster?.damageResistances,
      damageImmunities: monster?.damageImmunities,
      conditionImmunities: monster?.conditionImmunities,
    })]
  })
  applyClassPassiveDefenses(combatants)
  applyPaladinAuras(input.map, combatants)
  applyBardCountercharm(input.map, combatants)
  applyHolyNimbusSources(input.map, combatants)
  applyDraconicPresenceSources(input.map, combatants)
  const state = startDnd5eHeadlessCombat(input.combatId, combatants)
  state.mapId = input.map.id
  const combatantTokens = input.map.tokens.filter((token) => state.combatants[token.id])
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  state.distanceFeetByCombatantPair = {}
  state.coverBonusByCombatantPair = {}
  state.lineOfEffectBlockedByCombatantPair = {}
  state.lineOfSightBlockedByCombatantPair = {}
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  for (let leftIndex = 0; leftIndex < combatantTokens.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < combatantTokens.length; rightIndex += 1) {
      const left = combatantTokens[leftIndex]
      const right = combatantTokens[rightIndex]
      state.distanceFeetByCombatantPair[dnd5eCombatantPairKey(left.id, right.id)] =
        tokenFootprintDistanceCells(left, right, input.map) * feetPerCell
      for (const [attacker, target] of [[left, right], [right, left]] as const) {
        const cover = mapGeometryCoverBetween(geometry, attacker, target, input.map)
        const directedKey = dnd5eDirectedCombatantPairKey(attacker.id, target.id)
        if (cover.blocksLineOfEffect) state.lineOfEffectBlockedByCombatantPair[directedKey] = true
        else if (cover.armorClassBonus === 2 || cover.armorClassBonus === 5) {
          state.coverBonusByCombatantPair[directedKey] = cover.armorClassBonus
        }
        const lineOfSightBlocked = mapGeometryLineOfSightBlocked({
          geometry,
          from: attacker,
          to: target,
          fromElevationFeet: attacker.elevationFeet ?? 0,
          toElevationFeet: target.elevationFeet ?? 0,
        }) || !mapGeometryCanSeeToken({ geometry, map: input.map, viewer: attacker, target })
        if (lineOfSightBlocked) state.lineOfSightBlockedByCombatantPair[directedKey] = true
      }
    }
  }
  state.round = Math.max(1, Math.floor(input.round ?? 1))
  state.turnSlotId = input.turnSlotId
  return { state, characterIdByCombatantId }
}

export interface Dnd5eMapResultPlan {
  map: BattleMap
  characters: Character[]
  changedTokenIds: readonly string[]
  changedCharacterIds: readonly string[]
}

export function planDnd5eMapResultApplication(input: {
  state: Dnd5eHeadlessCombatState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Readonly<Record<string, string>>
}): Dnd5eMapResultPlan {
  const changedTokenIds: string[] = []
  const changedCharacterIds: string[] = []
  const tokenById = new Map(input.map.tokens.map((token) => [token.id, token]))
  const map: BattleMap = {
    ...input.map,
    tokens: input.map.tokens.map((token) => {
      const combatant = input.state.combatants[token.id]
      if (!combatant) return token
      const nextTokenClassState = !token.characterId
          ? compactOptionalRecord({
            schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
            temporaryHp: combatant.temporaryHp > 0 ? combatant.temporaryHp : undefined,
            undeadFortitudePending: combatant.classState.undeadFortitudePending
              ? { ...combatant.classState.undeadFortitudePending }
              : undefined,
            monsterOnHitSavePending: combatant.classState.monsterOnHitSavePending
              ? { ...combatant.classState.monsterOnHitSavePending }
              : undefined,
            activeEffects: combatant.classState.activeEffects?.map((effect) => ({
              ...effect,
              source: { ...effect.source },
              duration: { ...effect.duration },
              repeatSave: effect.repeatSave ? { ...effect.repeatSave } : undefined,
              breakOn: effect.breakOn ? [...effect.breakOn] : undefined,
            })),
            caltropsSpeedPenaltyFeet: combatant.classState.caltropsSpeedPenaltyFeet,
            bardicInspirationDie: combatant.classState.bardicInspirationDie,
            bardicInspirationSourceId: combatant.classState.bardicInspirationSourceId,
            bardicInspirationRoundsRemaining: combatant.classState.bardicInspirationRoundsRemaining,
            countercharmRoundsRemaining: combatant.classState.countercharmRoundsRemaining,
            intimidatingPresenceSourceId: combatant.classState.intimidatingPresenceSourceId,
            intimidatingPresenceRoundsRemaining: combatant.classState.intimidatingPresenceRoundsRemaining,
            intimidatingPresenceImmunityRoundsBySource: combatant.classState.intimidatingPresenceImmunityRoundsBySource,
            natureSanctuaryImmunityRoundsByTarget: combatant.classState.natureSanctuaryImmunityRoundsByTarget,
            draconicPresenceImmunityRoundsBySource: combatant.classState.draconicPresenceImmunityRoundsBySource,
            turnedByClericId: combatant.classState.turnedByClericId,
            turnedRoundsRemaining: combatant.classState.turnedRoundsRemaining,
            holyNimbusRoundsRemaining: combatant.classState.holyNimbusRoundsRemaining,
            conditions: combatant.conditions.length > 0 ? [...combatant.conditions] : undefined,
            stunnedByActorId: combatant.classState.stunnedByActorId,
            stunnedAppliedTurnKey: combatant.classState.stunnedAppliedTurnKey,
            openHandNoReactionsAppliedTurnKeysBySource: combatant.classState.openHandNoReactionsAppliedTurnKeysBySource,
            concentrationSpellId: combatant.classState.concentrationSpellId,
            concentrationTargetIds: combatant.classState.concentrationTargetIds,
            concentrationRoundsRemaining: combatant.classState.concentrationRoundsRemaining,
            concentrationEffectsBySource: combatant.classState.concentrationEffectsBySource,
            viciousMockeryAttackDisadvantage: combatant.classState.viciousMockeryAttackDisadvantage,
            helpedAttackSourceId: combatant.classState.helpedAttackSourceId,
            helpedAttackSourceTurnKey: combatant.classState.helpedAttackSourceTurnKey,
            shieldSpellActive: combatant.classState.shieldSpellActive,
            hurlThroughHellSourceId: combatant.classState.hurlThroughHellSourceId,
            hurlThroughHellDamage: combatant.classState.hurlThroughHellDamage,
            hurlThroughHellAppliedTurnKey: combatant.classState.hurlThroughHellAppliedTurnKey,
          })
        : undefined
      const patch: Partial<Token> = {
        x: combatant.position.x,
        y: combatant.position.y,
        hp: combatant.currentHp,
        maxHp: combatant.maxHp,
        ...(!token.characterId ? { dnd5eCombatState: nextTokenClassState } : {}),
      }
      const tokenClassStateUnchanged = token.characterId ||
        JSON.stringify(token.dnd5eCombatState ?? {}) === JSON.stringify(nextTokenClassState ?? {})
      if (
        token.x === patch.x && token.y === patch.y && token.hp === patch.hp && token.maxHp === patch.maxHp &&
        tokenClassStateUnchanged
      ) return token
      changedTokenIds.push(token.id)
      return { ...token, ...patch }
    }),
  }
  const characters = input.characters.map((character) => {
    const combatantId = Object.keys(input.characterIdByCombatantId).find((id) => input.characterIdByCombatantId[id] === character.id)
    const combatant = combatantId ? input.state.combatants[combatantId] : undefined
    if (!combatant) return character
    const nextClassResources = Object.keys(combatant.classResources).length > 0
      ? Object.fromEntries(Object.entries(combatant.classResources).map(([key, resource]) => [key, { ...resource }]))
      : undefined
    const nextClassState = compactOptionalRecord(combatant.classState)
    const nextCharacterCurrentHp = combatant.classState.wildShapeFormId
      ? combatant.classState.wildShapeOriginalCurrentHp ?? character.currentHp
      : combatant.currentHp
    const resourcesUnchanged = JSON.stringify(character.classResources ?? {}) === JSON.stringify(nextClassResources ?? {})
    const classStateUnchanged = JSON.stringify(character.dnd5eCombatState ?? {}) === JSON.stringify(nextClassState ?? {})
    const conditionsUnchanged = JSON.stringify(character.conditions) === JSON.stringify(combatant.conditions)
    if (
      character.currentHp === nextCharacterCurrentHp &&
      character.tempHp === combatant.temporaryHp &&
      (character.exhaustionLevel ?? 0) === combatant.exhaustionLevel &&
      (character.deathSaveSuccesses ?? 0) === combatant.deathSaves.successes &&
      (character.deathSaveFailures ?? 0) === combatant.deathSaves.failures &&
      (character.deathSaveStable ?? false) === combatant.deathSaves.stable &&
      (character.concentrating ?? false) === combatant.concentrating &&
      resourcesUnchanged &&
      classStateUnchanged &&
      conditionsUnchanged
    ) return character
    changedCharacterIds.push(character.id)
    return {
      ...character,
      currentHp: nextCharacterCurrentHp,
      tempHp: combatant.temporaryHp,
      exhaustionLevel: combatant.exhaustionLevel,
      deathSaveSuccesses: combatant.deathSaves.successes,
      deathSaveFailures: combatant.deathSaves.failures,
      deathSaveStable: combatant.deathSaves.stable,
      concentrating: combatant.concentrating,
      conditions: [...combatant.conditions],
      classResources: nextClassResources,
      dnd5eCombatState: nextClassState,
    }
  })
  for (const tokenId of Object.keys(input.state.combatants)) {
    if (!tokenById.has(tokenId)) throw new Error(`Headless combatant has no map token: ${tokenId}`)
  }
  return { map, characters, changedTokenIds, changedCharacterIds }
}
