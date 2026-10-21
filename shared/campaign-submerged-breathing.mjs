import { advanceSubmergedBreathingStep } from './submerged-breathing-step.mjs'
import { normalizeSubmergedBreathingEffectDeadlines } from './submerged-breathing-state.mjs'
import { monsterBreathingProfiles } from './monster-breathing-profiles.mjs'
import { characterCombatClockKey, tokenCombatClockKey, validCombatRoundCredits } from './combat-round-credits.mjs'

const clockSeconds = clock => clock.worldMinute * 60 + (clock.worldSecondRemainder ?? 0)

function combatCreditsBridgeCursor(clock, cursor, to, actorKey) {
  if (!Number.isSafeInteger(cursor) || cursor >= to) return false
  let covered = cursor
  for (const advance of clock.advances ?? []) {
    const start = advance.fromWorldMinute * 60, end = advance.toWorldMinute * 60
    if (end <= covered) continue
    if (advance.kind !== 'advance' || start !== covered || end > to || end <= start ||
      !validCombatRoundCredits(advance.combatRoundCredits, advance.minutes * 10) ||
      (advance.combatRoundCredits?.[actorKey] ?? 0) * 6 !== end - start) return false
    covered = end
    if (covered === to) return true
  }
  return false
}

/** Plan breathing before the time transaction discards expired area instances. */
export function planCampaignSubmergedBreathing({ maps, characters, previousClock, nextClock }) {
  const from = clockSeconds(previousClock), to = clockSeconds(nextClock), elapsed = to - from
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || elapsed <= 0)
    return { updates: [], endedSourceIds: [] }
  const areas = maps.flatMap(map => (map.dnd5ePluginAreas ?? []).map(area => ({ mapId: map.id, area })))
  const ended = new Map()
  const seenCharacters = new Set()
  const previousAdvanceIds = new Set((previousClock.advances ?? []).map(advance => advance.id))
  const actors = maps.flatMap(map => map.tokens.flatMap(token => {
    if (token.type === 'obstacle') return []
    const character = token.characterId && !token.dnd5eSimulacrum ? characters.find(character => character.id === token.characterId) : undefined
    if (character && seenCharacters.has(character.id)) return []
    if (character) seenCharacters.add(character.id)
    const entity = character ?? token, state = entity.dnd5eCombatState ?? {}, effects = state.activeEffects ?? []
    if (!state.submergedBreathing && !effects.some(effect => effect.modifiers?.submerged === true)) return []
    const profile = monsterBreathingProfiles[state.wildShapeFormId ?? token.poolId]
    const baseCon = profile?.constitutionScore ?? token.dnd5eSimulacrum?.abilities?.con ?? character?.abilities?.con ?? 10
    // Native actors persist their base scores; the combat bridge subtracts this
    // ledger when it constructs their effective abilities. Match that boundary.
    const conReduction = (state.abilityScoreReductionLedger ?? []).reduce((sum, entry) =>
      sum + (entry.ability === 'con' ? Math.max(0, Math.floor(entry.amount)) : 0), 0)
    const con = state.wildShapeFormId ? baseCon : Math.max(1, baseCon - conReduction)
    const key = character ? characterCombatClockKey(character.id) : tokenCombatClockKey(map.id, token.id)
    const credit = (nextClock.advances ?? []).filter(advance => !previousAdvanceIds.has(advance.id))
      .reduce((sum, advance) => sum + (advance.combatRoundCredits?.[key] ?? 0) * 6, 0)
    if (!Number.isSafeInteger(credit) || credit < 0 || credit > elapsed) throw new Error('invalid-submerged-campaign-credit')
    const cursor = state.submergedBreathing?.campaignClockSeconds
    if (cursor != null && cursor !== from && cursor !== to && !combatCreditsBridgeCursor(previousClock, cursor, from, key))
      throw new Error('stale-submerged-campaign-clock')
    const storedDeadlines = normalizeSubmergedBreathingEffectDeadlines(state.submergedBreathingEffectDeadlines)
    if (state.submergedBreathingEffectDeadlines != null && !storedDeadlines) throw new Error('invalid-submerged-effect-deadlines')
    const deadlines = effects.flatMap(effect => {
      if (!['rounds', 'concentration'].includes(effect.duration?.type) || !Number.isSafeInteger(effect.duration.remainingRounds)) return []
      const previous = storedDeadlines?.find(entry => entry.effectId === effect.id && entry.appliedAt === effect.appliedAt)
      // remainingRounds already excludes credited combat turns. Anchor a new
      // deadline after that elapsed combat interval; existing absolute deadlines
      // must not be extended every time the campaign clock catches up.
      return [previous ?? { effectId: effect.id, appliedAt: effect.appliedAt, expiresAtSeconds: from + credit + effect.duration.remainingRounds * 6 }]
    })
    return [{ mapId: map.id, tokenId: token.id, characterId: character?.id, entity, effects, con, profile,
      originalCon: state.wildShapeOriginalAbilities?.con ?? monsterBreathingProfiles[state.wildShapeOriginalStatBlockId]?.constitutionScore ?? character?.abilities?.con ?? 10,
      deadlines, credit: cursor === to ? elapsed : credit, breathing: state.submergedBreathing, collapsedAt: undefined }]
  }))
  const effectExpiry = (effect, actor) => {
    const deadline = actor.deadlines.find(entry => entry.effectId === effect.id)
    let expiry = deadline ? Math.max(0, deadline.expiresAtSeconds - from) : Infinity
    if (effect.duration?.type === 'concentration' && ended.has(effect.duration.sourceActorId))
      expiry = Math.min(expiry, ended.get(effect.duration.sourceActorId))
    const link = effect.areaLifetime
    if (link) {
      const found = areas.find(({ mapId, area }) => mapId === link.mapId && area.id === link.areaId &&
        area.sourceTokenId === link.sourceActorId && (area.boundEffectGeneration ?? 0) === (link.generation ?? 0))
      if (!found) return 0
      const area = found.area
      const remaining = area.remainingExplorationSeconds ?? (Number.isSafeInteger(area.expiresAtWorldMinute)
        ? Math.max(0, area.expiresAtWorldMinute * 60 - from) : Infinity)
      expiry = Math.min(expiry, remaining, ended.get(area.sourceTokenId) ?? Infinity)
    }
    return expiry
  }
  const resolve = (actor, offset) => {
    const present = actor.effects.filter(effect => effectExpiry(effect, actor) > offset)
    const ids = new Set(present.map(effect => effect.id))
    const active = present.filter(effect => !(effect.suspendedBy ?? []).some(id => ids.has(id) || !actor.effects.some(source => source.id === id)) && effect.grantedActivityCharges?.current !== 0)
    const suppressions = active.flatMap(effect => effect.modifiers?.conditionImmunitiesBySourceMagic?.filter(rule => rule.suppressExisting) ?? [])
    const effective = active.filter(effect => !suppressions.some(rule =>
      (effect.source?.magical === true) === rule.sourceMagical && rule.conditions.includes(effect.standardCondition)))
    const caps = effective.flatMap(effect => effect.modifiers?.environmentalCapabilities ?? [])
    return { constitutionScore: actor.con,
      canBreathe: !effective.some(effect => effect.modifiers?.submerged === true) || actor.profile?.canBreatheWater === true ||
        caps.some(cap => cap.doesNotNeedAir || cap.breatheIn?.includes('water')),
      holdBreathSeconds: Math.max(actor.profile?.holdBreathSeconds ?? 0, ...caps.map(cap => cap.holdBreathSeconds ?? 0)) || undefined }
  }
  let offset = 0
  while (offset < elapsed && actors.length) {
    let next = elapsed
    const resolved = actors.map(actor => {
      const capability = resolve(actor, offset)
      const prepared = advanceSubmergedBreathingStep({ ...capability, state: actor.breathing, elapsedSeconds: 0,
        stepKey: `campaign:${from + offset}:prepare`, targetTurnStart: false })
      actor.breathing = prepared.state
      const pending = prepared.state?.pendingCollapseAtSeconds
      if (pending != null && pending > from + offset) next = Math.min(next, pending - from)
      for (const effect of actor.effects) {
        const expiry = effectExpiry(effect, actor)
        if (expiry > offset) next = Math.min(next, expiry)
      }
      if (actor.credit > offset) next = Math.min(next, actor.credit)
      else if (prepared.state && !prepared.state.collapsed) {
        const deadline = prepared.state.breathSeconds + prepared.state.survivalSeconds
        if (deadline > 0) next = Math.min(next, offset + deadline)
      }
      return capability
    })
    for (let index = 0; index < actors.length; index++) {
      const actor = actors[index]
      const result = advanceSubmergedBreathingStep({ ...resolved[index], state: actor.breathing,
        elapsedSeconds: Math.max(0, next - Math.max(offset, actor.credit)),
        stepKey: `campaign:${from + next}`, targetTurnStart: true })
      actor.breathing = result.state
      if (result.dropToZero || result.state?.pendingCollapseAtSeconds != null && result.state.pendingCollapseAtSeconds <= from + next) {
        const form = actor.entity.dnd5eCombatState
        const originalProfile = monsterBreathingProfiles[form?.wildShapeOriginalStatBlockId]
        if (form?.wildShapeFormId && !actor.revertedForm) {
          actor.revertedForm = true
          actor.profile = originalProfile
          actor.con = actor.originalCon
          if (!form.wildShapeRetainsHitPoints && (form.wildShapeOriginalCurrentHp ?? (actor.characterId ? actor.entity.currentHp : 0)) > 0) {
            actor.breathing = { ...result.state, pendingCollapseAtSeconds: from + next + 6 }
            continue
          }
        }
        if (actor.breathing) delete actor.breathing.pendingCollapseAtSeconds
        actor.collapsedAt ??= from + next
        ended.set(actor.tokenId, next)
      }
    }
    offset = next
  }
  return { updates: actors.map(actor => {
    const final = advanceSubmergedBreathingStep({ ...resolve(actor, elapsed), state: actor.breathing,
      elapsedSeconds: 0, stepKey: `campaign:${to}:final`, targetTurnStart: false })
    return { mapId: actor.mapId, tokenId: actor.tokenId, characterId: actor.characterId, revertedForm: actor.revertedForm,
      collapsedAt: actor.collapsedAt, effectDeadlines: actor.deadlines,
      expiredEffectIds: actor.effects.filter(effect => effectExpiry(effect, actor) <= elapsed).map(effect => effect.id),
      state: final.state ? { ...final.state, campaignClockSeconds: to } : undefined }
  }), endedSourceIds: [...ended.keys()] }
}
