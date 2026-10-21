/** Either authoritative clock can prove expiry; round resets cannot extend a timed summon. */
export function dnd5eSummonDurationExpired(summon, round, worldMinute) {
  if (!summon || summon.persistent === true) return false
  // A detached creature has its own absolute deadline, which may outlive the spell.
  if (Number.isFinite(worldMinute) && Number.isFinite(summon.dismissAtWorldMinute)) {
    return worldMinute >= summon.dismissAtWorldMinute
  }
  if (Number.isFinite(round) && round > summon.expiresAfterRound) return true
  const rounds = summon.expiresAfterRound - summon.createdRound + 1
  return Number.isFinite(worldMinute) && Number.isFinite(summon.createdWorldMinute) &&
    Number.isSafeInteger(rounds) && rounds > 0 &&
    worldMinute >= summon.createdWorldMinute + rounds / 10
}

export function isDnd5eSummonLingerPolicy(policy) {
  return !!policy && typeof policy === 'object' && !Array.isArray(policy) &&
    Number.isInteger(policy.count) && policy.count >= 1 && policy.count <= 20 &&
    [4, 6, 8, 10, 12, 20].includes(policy.sides) && ['round', 'minute'].includes(policy.unit) &&
    (policy.capAtOriginalExpiry == null || typeof policy.capAtOriginalExpiry === 'boolean')
}

/** Called only by authority; supplied rolls are for deterministic Host replay/tests. */
export function detachDnd5eUncontrolledSummon(token, round, roll, worldMinute) {
  const summon = token.dnd5eSummon
  if (!summon?.controlEnded || !summon.concentrationId) return token
  const policy = summon.uncontrolledLinger ?? (summon.controlSave?.lingerDieSides ? {
    count: 1, sides: summon.controlSave.lingerDieSides, unit: 'round', capAtOriginalExpiry: true,
  } : undefined)
  if (!policy) return token
  if (!isDnd5eSummonLingerPolicy(policy) || !Number.isInteger(round) || round < 0) throw new Error('Invalid summon linger policy')
  const sides = policy.sides
  const rollDie = () => {
    const sample = new Uint32Array(1), limit = Math.floor(0x100000000 / sides) * sides
    do { crypto.getRandomValues(sample) } while (sample[0] >= limit)
    return sample[0] % sides + 1
  }
  const rolls = roll == null ? Array.from({ length: policy.count }, rollDie) : typeof roll === 'number' ? [roll] : [...roll]
  if (rolls.length !== policy.count || rolls.some(value => !Number.isInteger(value) || value < 1 || value > sides)) throw new Error('Invalid summon linger roll')
  const value = rolls.reduce((sum, die) => sum + die, 0)
  const deadline = round + value * (policy.unit === 'minute' ? 10 : 1)
  const dismissAtRound = policy.capAtOriginalExpiry ? Math.min(summon.expiresAfterRound, deadline) : deadline
  if (worldMinute != null && (!Number.isFinite(worldMinute) || worldMinute < 0)) throw new Error('Invalid summon linger policy')
  return { ...token, dnd5eSummon: { ...summon, concentrationId: undefined, dismissAtRound,
    ...(worldMinute == null ? {} : { dismissAtWorldMinute: worldMinute + (dismissAtRound - round) / 10 }),
    expiresAfterRound: policy.capAtOriginalExpiry ? summon.expiresAfterRound : Math.max(summon.expiresAfterRound, dismissAtRound),
    lingerRoll: value, lingerRolls: rolls } }
}

/** Absolute deadlines survive combat round resets; no dice are rolled here. */
export function expireDnd5eSummonLingerAtWorldMinute(map, worldMinute) {
  if (!Number.isFinite(worldMinute) || worldMinute < 0) return map
  const expires = token => Number.isFinite(token.dnd5eSummon?.dismissAtWorldMinute) &&
    worldMinute >= token.dnd5eSummon.dismissAtWorldMinute
  const occupied = new Set(map.tokens.filter(token => !expires(token)).map(token => token.id))
  const tokens = map.tokens.flatMap(token => {
    const summon = token.dnd5eSummon
    if (!expires(token)) return [token]
    // The server clock path must preserve possessions just like Host round expiry.
    // These are authority-normalized objects; malformed snapshots must fail the
    // transaction rather than silently deleting somebody's physical inventory.
    if (token.dnd5eCarriedObjects != null && !Array.isArray(token.dnd5eCarriedObjects)) throw Error('invalid-carried-object-drop')
    const drops = (token.dnd5eCarriedObjects ?? []).map(item => {
      if (!item || typeof item.id !== 'string' || !item.id || !item.objectState?.inventoryItem) throw Error('invalid-carried-object-drop')
      return { id: 'carried:' + item.id, label: item.label, type: 'obstacle', size: 1,
        x: token.x, y: token.y, elevationFeet: token.elevationFeet, color: '', emoji: '',
        dnd5eObjectState: { ...structuredClone(item.objectState), wornOrCarried: false,
          inventoryItem: { ...structuredClone(item.objectState.inventoryItem), receiptId: 'carried:' + item.id } } }
    })
    const restored = summon.animatedCorpse ? [{ ...structuredClone(summon.animatedCorpse), x: token.x, y: token.y,
      elevationFeet: token.elevationFeet ?? summon.animatedCorpse.elevationFeet, hp: 0 }] : []
    for (const replacement of [...restored, ...drops]) {
      if (occupied.has(replacement.id)) throw Error('carried-object-drop-conflict')
      occupied.add(replacement.id)
    }
    return [...restored, ...drops]
  })
  return tokens.length === map.tokens.length && tokens.every((token, index) => token === map.tokens[index]) ? map : { ...map, tokens }
}
