import {createHash} from 'node:crypto'
import {readMastermindNativeWardOriginalFacts} from './mastermind-native-ward-originals.mjs'

const object = value => !!value && typeof value === 'object' && !Array.isArray(value)
const closed = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key))
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 2000 && value.trim() === value
const integer = value => Number.isSafeInteger(value) && value >= 0
const ordered = value => Array.isArray(value) ? value.map(ordered) : object(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, ordered(child)])) : value
const same = (a, b) => JSON.stringify(ordered(a)) === JSON.stringify(ordered(b))
const digest = value => createHash('sha256').update(JSON.stringify(ordered(value))).digest('hex')
const fail = (status, error) => ({ok: false, status, error})
const d20 = value => Array.isArray(value) && value.length === 1 && Number.isSafeInteger(value[0]) && value[0] >= 1 && value[0] <= 20
const versionNames = ['characters', 'maps', 'combat', 'map-geometry', 'campaign-time']
const versions = value => object(value) && Object.keys(value).length === 5 && versionNames.every(name => integer(value[name]))
const requestKeys = ['actorId', 'kind', 'originalRolls', 'dieIndex', 'options']
const validRequest = request => closed(request, requestKeys) && Object.keys(request).length === 5 && text(request.actorId) && request.kind === 'saving-throw' && same(request.originalRolls, [1]) && request.dieIndex === 0 && Array.isArray(request.options) && request.options.length > 0 && request.options.length <= 128 && request.options.every(option => closed(option, ['ownerId', 'featureId']) && Object.keys(option).length === 2 && text(option.ownerId) && text(option.featureId) && option.ownerId !== request.actorId) && new Set(request.options.map(option => JSON.stringify(option))).size === request.options.length
const validFeatureSources = (value, request) => object(value) && Object.keys(value).length === new Set(request.options.map(option => option.featureId)).size && request.options.every(option => /^[a-f0-9]{64}$/.test(value[option.featureId]))
const selected = row => row.decisions.find(choice => choice.decision === 'use')
const nextOwner = row => selected(row) ? undefined : row.request.options.find(option => !row.decisions.some(choice => choice.ownerId === option.ownerId && choice.featureId === option.featureId))
const phase = row => nextOwner(row) ? 'owner-choice' : !selected(row) ? 'declined' : !row.rawReroll ? 'roller' : !row.confirmedReroll ? 'host-confirmation' : 'ready'
const rawId = row => 'mm-native-ward-bountiful-pool:' + digest({id: row.id})
const host = identity => identity.role === 'dm' && identity.memberId === identity.hostMemberId
const sourceRow = row => {const {complete, ...immutable} = row; void complete; return immutable}

function validRow(row) {
  if (!closed(row, ['id', 'parentId', 'requestId', 'parentTransactionId', 'mapId', 'combatId', 'roomId', 'hostMemberId', 'actorId', 'clock', 'versions', 'sourceSignature', 'featureSources', 'request', 'controllers', 'revision', 'createdAt', 'decisions', 'rawReroll', 'confirmedReroll', 'consumed']) || !/^mm-native-ward-bountiful:[a-f0-9]{64}$/.test(row.id) || !/^mm-native-ward-pool:[a-f0-9]{64}$/.test(row.requestId) || !['parentId', 'parentTransactionId', 'mapId', 'combatId', 'roomId', 'hostMemberId', 'actorId'].every(key => text(row[key])) || !integer(row.clock) || row.clock < 1 || !versions(row.versions) || !/^[a-f0-9]{64}$/.test(row.sourceSignature) || !validRequest(row.request) || !validFeatureSources(row.featureSources, row.request) || row.request.actorId !== row.actorId || !integer(row.revision) || row.revision < 1 || !integer(row.createdAt) || !object(row.controllers) || Object.keys(row.controllers).length !== new Set(row.request.options.map(option => option.ownerId)).size || row.request.options.some(option => !closed(row.controllers[option.ownerId], ['characterId', 'memberId']) || !text(row.controllers[option.ownerId].characterId) || !text(row.controllers[option.ownerId].memberId)) || !Array.isArray(row.decisions) || row.decisions.length > row.request.options.length) return false
  if(row.consumed!==undefined&&(!closed(row.consumed,['transactionId','authorityRevision'])||Object.keys(row.consumed).length!==2||row.consumed.transactionId!=='mastermind-native-misdirection:'+row.parentId||!integer(row.consumed.authorityRevision)||row.consumed.authorityRevision<1))return false
  let used = false
  for (let index = 0; index < row.decisions.length; index++) {
    const choice = row.decisions[index], option = row.request.options[index]
    if (used || !closed(choice, ['ownerId', 'featureId', 'memberId', 'decision', 'at']) || choice.ownerId !== option.ownerId || choice.featureId !== option.featureId || choice.memberId !== row.controllers[option.ownerId].memberId || !['use', 'decline'].includes(choice.decision) || !integer(choice.at)) return false
    used = choice.decision === 'use'
  }
  if (row.rawReroll !== undefined && (!used || !closed(row.rawReroll, ['memberId', 'values', 'at']) || row.rawReroll.memberId !== row.hostMemberId || !d20(row.rawReroll.values) || !integer(row.rawReroll.at))) return false
  return row.confirmedReroll === undefined || !!row.rawReroll && closed(row.confirmedReroll, ['memberId', 'rawValues', 'values', 'at']) && row.confirmedReroll.memberId === row.hostMemberId && same(row.confirmedReroll.rawValues, row.rawReroll.values) && d20(row.confirmedReroll.values) && integer(row.confirmedReroll.at)
}

export function validMastermindNativeWardBountifuls(book) {
  return closed(book, ['schemaVersion', 'parents', 'updatedAt', '_sync']) && book.schemaVersion === 1 && object(book.parents) && Object.keys(book.parents).length <= 512 && Object.entries(book.parents).every(([key, row]) => row.id === key && validRow(row))
}

/** Source inspection uses the canonical room Host identity, independently of
 * the member who is answering. It grants that member no Host operation. */
function source(snapshot, identity, parentId, requestId) {
  const facts = readMastermindNativeWardOriginalFacts(snapshot['mastermind-native-ward-originals'], snapshot, {...identity, role: 'dm', memberId: identity.hostMemberId}, requestId)
  if (!facts || facts.row.parentId !== parentId || facts.row.modifierKind !== undefined || facts.row.mode !== 'normal' || facts.row.count !== 1 || facts.row.sides !== 20 || facts.row.phase !== 'confirmed' || !same(facts.row.confirmed?.values, [1]) || facts.row.raw?.memberId !== identity.hostMemberId || facts.row.confirmed?.memberId !== identity.hostMemberId) return undefined
  return {...facts, signature: digest({parent: facts.actual.parent, original: sourceRow(facts.row)})}
}

function controllers(request, facts, snapshot, identity) {
  const result = Object.create(null), map = facts.actual.map, actor = facts.actual.actor
  for (const option of request.options) {
    const token = map.tokens?.find(candidate => candidate.id === option.ownerId), character = snapshot.characters?.characters?.find(candidate => candidate.id === token?.characterId), economy = snapshot.combat?.dnd5eTurnEconomyByToken?.[option.ownerId]
    if (!token || token.type === 'obstacle' || !character || token.id === actor.id || !economy || !Number.isSafeInteger(economy.reaction?.current) || economy.reaction.current < 1) return undefined
    result[option.ownerId] = {characterId: character.id, memberId: character.roomMemberId ?? identity.hostMemberId}
  }
  return result
}

function current(row, snapshot, identity) {
  const facts = source(snapshot, identity, row.parentId, row.requestId)
  return !row.consumed && facts && row.roomId === identity.roomId && row.hostMemberId === identity.hostMemberId && row.actorId === facts.row.actorTokenId && row.parentTransactionId === facts.row.parentTransactionId && row.mapId === facts.row.mapId && row.combatId === facts.actual.native.combatId && row.clock === facts.actual.parent.issuedAt && same(row.versions, facts.row.versions) && row.sourceSignature === facts.signature && same(row.controllers, controllers(row.request, facts, snapshot, identity)) ? facts : undefined
}

function projection(row, identity, facts) {
  if (host(identity)) return {id: row.id, parentId: row.parentId, requestId: row.requestId, parentTransactionId: row.parentTransactionId, mapId: row.mapId, combatId: row.combatId, actorId: row.actorId, clock: row.clock, versions: structuredClone(row.versions), sourceSignature: row.sourceSignature, request: structuredClone(row.request), controllers: structuredClone(row.controllers), revision: row.revision, phase: phase(row), decisions: structuredClone(row.decisions), rawRequestId: rawId(row), ...(row.rawReroll ? {raw: [...row.rawReroll.values]} : {}), ...(row.confirmedReroll ? {confirmed: [...row.confirmedReroll.values]} : {})}
  const option = nextOwner(row), controller = option && row.controllers[option.ownerId]
  return option && controller.memberId === identity.memberId ? {id: row.id, revision: row.revision, parentId: row.parentId, mapId: row.mapId, actorId: row.actorId, actorName: facts.actual.actor.label ?? row.actorId, ownerId: option.ownerId, featureId: option.featureId, phase: 'owner-choice'} : undefined
}

export function projectMastermindNativeWardBountiful(book, snapshot, identity, input, list = false) {
  if (!identity.memberId || !['dm', 'player'].includes(identity.role) || identity.role === 'dm' && !host(identity)) return fail(403, 'native-ward-bountiful:actual-member-required')
  if (!closed(input, list ? [] : ['id']) || Object.keys(input).length !== (list ? 0 : 1) || !list && !text(input.id)) return fail(400, 'native-ward-bountiful:closed-projection-required')
  if (book == null && list) return {ok: true, choices: []}
  if (!validMastermindNativeWardBountifuls(book)) return fail(409, 'native-ward-bountiful:protected-book-required')
  if (list) return {ok: true, choices: Object.values(book.parents).flatMap(row => {const facts = current(row, snapshot, identity), value = facts && projection(row, identity, facts); return value ? [value] : []})}
  const row = book.parents[input.id] ?? Object.values(book.parents).find(row => rawId(row) === input.id), facts = row && current(row, snapshot, identity), value = facts && projection(row, identity, facts)
  return value ? {ok: true, choice: value} : fail(identity.role === 'dm' ? 409 : 403, 'native-ward-bountiful:current-owned-original-required')
}

/** Input evidence and authenticated decisions only. No endpoint accepts a
 * prepared object, saving total/DC, Native result, state, HP or cost mutation. */
export function mutateMastermindNativeWardBountiful(book, snapshot, identity, operation, input, now) {
  if (!identity.memberId || !['dm', 'player'].includes(identity.role) || identity.role === 'dm' && !host(identity) || !integer(now)) return fail(403, 'native-ward-bountiful:actual-member-required')
  const base = book ?? {schemaVersion: 1, parents: {}}
  if (!validMastermindNativeWardBountifuls(base)) return fail(409, 'native-ward-bountiful:protected-book-required')
  if (operation === 'register') {
    if (!host(identity)) return fail(403, 'native-ward-bountiful:actual-Host-required')
    if (!closed(input, ['parentId', 'requestId', 'request', 'featureSources']) || Object.keys(input).length !== 4 || !text(input.parentId) || !text(input.requestId) || !validRequest(input.request) || !validFeatureSources(input.featureSources, input.request)) return fail(400, 'native-ward-bountiful:closed-original-required')
    const facts = source(snapshot, identity, input.parentId, input.requestId), controlled = facts && controllers(input.request, facts, snapshot, identity)
    if (!facts || !controlled || input.request.actorId !== facts.row.actorTokenId) return fail(409, 'native-ward-bountiful:actual-locked-original-required')
    const id = 'mm-native-ward-bountiful:' + digest({parentId: input.parentId, requestId: input.requestId}), old = base.parents[id]
    if (old) return current(old, snapshot, identity) && same(old.request, input.request) && same(old.featureSources, input.featureSources) ? {ok: true, changed: false, next: base, choice: projection(old, identity, facts)} : fail(409, 'native-ward-bountiful:immutable-original')
    if (Object.keys(base.parents).length >= 512) return fail(409, 'native-ward-bountiful:book-capacity')
    if (Object.values(snapshot['mastermind-native-ward-outcomes']?.choices ?? {}).some(choice => choice.requestId === input.requestId)) return fail(409, 'native-ward-bountiful:original-already-settled')
    const row = {id, parentId: input.parentId, requestId: input.requestId, parentTransactionId: facts.row.parentTransactionId, mapId: facts.row.mapId, combatId: facts.actual.native.combatId, roomId: identity.roomId, hostMemberId: identity.hostMemberId, actorId: facts.row.actorTokenId, clock: facts.actual.parent.issuedAt, versions: structuredClone(facts.row.versions), sourceSignature: facts.signature, featureSources: structuredClone(input.featureSources), request: structuredClone(input.request), controllers: controlled, revision: 1, createdAt: now, decisions: []}
    if (!validRow(row)) return fail(400, 'native-ward-bountiful:invalid-original')
    return {ok: true, changed: true, next: {...base, parents: {...base.parents, [id]: row}, updatedAt: now}, choice: projection(row, identity, facts)}
  }
  const allowed = operation === 'answer' ? ['id', 'expectedRevision', 'ownerId', 'featureId', 'decision'] : operation === 'raw' ? ['id', 'rollerTokenId', 'values'] : operation === 'confirm' ? ['id', 'rollerTokenId', 'rawValues', 'values'] : []
  if (!allowed.length || !closed(input, allowed) || Object.keys(input).length !== allowed.length || !text(input.id)) return fail(400, 'native-ward-bountiful:closed-operation-required')
  const row = base.parents[input.id], facts = row && current(row, snapshot, identity)
  if (!facts) return fail(409, 'native-ward-bountiful:current-original-required')
  let next
  if (operation === 'answer') {
    const owned = row.controllers[input.ownerId], previous = row.decisions.find(choice => choice.ownerId === input.ownerId && choice.featureId === input.featureId)
    if (!owned || owned.memberId !== identity.memberId || !['use', 'decline'].includes(input.decision) || !integer(input.expectedRevision)) return fail(403, 'native-ward-bountiful:actual-owner-required')
    if (previous) return previous.decision === input.decision ? {ok: true, changed: false, next: base, choice: projection(row, identity, facts)} : fail(409, 'native-ward-bountiful:decision-immutable')
    const expected = nextOwner(row)
    if (!expected || expected.ownerId !== input.ownerId || expected.featureId !== input.featureId || row.revision !== input.expectedRevision) return fail(409, 'native-ward-bountiful:current-owner-window-required')
    next = {...row, revision: row.revision + 1, decisions: [...row.decisions, {ownerId: input.ownerId, featureId: input.featureId, memberId: identity.memberId, decision: input.decision, at: now}]}
  } else {
    if (!host(identity) || input.rollerTokenId !== row.actorId || !d20(input.values)) return fail(403, 'native-ward-bountiful:actual-original-roller-required')
    if (operation === 'raw') {
      if (row.rawReroll) return same(row.rawReroll.values, input.values) ? {ok: true, changed: false, next: base, choice: projection(row, identity, facts)} : fail(409, 'native-ward-bountiful:raw-immutable')
      if (phase(row) !== 'roller') return fail(409, 'native-ward-bountiful:accepted-owner-required')
      next = {...row, revision: row.revision + 1, rawReroll: {memberId: identity.memberId, values: [...input.values], at: now}}
    } else {
      if (!row.rawReroll || !d20(input.rawValues) || !same(row.rawReroll.values, input.rawValues)) return fail(409, 'native-ward-bountiful:actual-locked-raw-required')
      if (row.confirmedReroll) return same(row.confirmedReroll.values, input.values) ? {ok: true, changed: false, next: base, choice: projection(row, identity, facts)} : fail(409, 'native-ward-bountiful:adoption-immutable')
      next = {...row, revision: row.revision + 1, confirmedReroll: {memberId: identity.memberId, rawValues: [...input.rawValues], values: [...input.values], at: now}}
    }
  }
  return {ok: true, changed: true, next: {...base, parents: {...base.parents, [row.id]: next}, updatedAt: now}, choice: projection(next, identity, facts) ?? {id: next.id, revision: next.revision, phase: phase(next)}}
}


/** The extra evidence write is admitted only together with the old exact native
 * four-write publication. It never supplies a Native result or a world state. */
export function mastermindNativeWardBountifulConsumptionAllowed(book, snapshot, identity, writes, transactionId) {
  const resource='mastermind-native-ward-bountifuls',write=writes.find(value=>value.name===resource),journal=snapshot['mastermind-misdirections']
  const parent=Object.values(journal?.parents??{}).find(row=>transactionId==='mastermind-native-misdirection:'+row.id)
  const rows=Object.values(book?.parents??{}).filter(row=>row.parentId===parent?.id)
  if(!write&&!rows.length)return true
  if(!host(identity)||!parent||parent.phase!=='answered'||!parent.nativeOriginal||parent.spellWindowOriginal||!validMastermindNativeWardBountifuls(book)||rows.length===0||rows.some(row=>row.consumed)||writes.length!==5||new Set(writes.map(value=>value.name)).size!==5||!['characters','maps','combat','mastermind-misdirections',resource].every(name=>writes.some(value=>value.name===name))||!write||write.expectedRevision!==(book._sync?.revision??0)||!validMastermindNativeWardBountifuls(write.data)||!same(Object.keys(book.parents).sort(),Object.keys(write.data.parents).sort()))return false
  const afterCombat=writes.find(value=>value.name==='combat')?.data,consumption={transactionId,authorityRevision:(book._sync?.revision??0)+1},usedOwners=new Set()
  for(const row of rows){const facts=current(row,snapshot,identity);if(!facts||!facts.row.complete||!['ready','declined'].includes(phase(row))||row.revision!==1+row.decisions.length+(row.rawReroll?1:0)+(row.confirmedReroll?1:0))return false;const use=selected(row);if(use){if(usedOwners.has(use.ownerId))return false;usedOwners.add(use.ownerId);const before=snapshot.combat?.dnd5eTurnEconomyByToken?.[use.ownerId],after=afterCombat?.dnd5eTurnEconomyByToken?.[use.ownerId];if(!before||!after||before.reaction?.current<1||!same({...before,reaction:{...before.reaction,current:before.reaction.current-1}},after))return false}if(!same(write.data.parents[row.id],{...row,revision:row.revision+1,consumed:consumption}))return false}
  for(const[id,row]of Object.entries(book.parents))if(!rows.includes(row)&&!same(write.data.parents[id],row))return false
  const{parents:oldRows,_sync:oldSync,...oldRest}=book,{parents:newRows,_sync:newSync,...newRest}=write.data;void oldRows;void newRows;void oldSync;void newSync
  return same(oldRest,newRest)
}
