import{assertActualOriginalDiceOwnerSemantics}from'./originalDicePageSemantics.testSupport'
import { createBountifulDamageZeroOriginalRoomBoundary } from './bountifulDamageZeroOriginalRoomBoundary';
import { restoreBountifulDamageZeroOriginalRaw } from './bountifulDamageZeroOriginalRaw';
import type { BountifulOriginalDieReceipt } from './bountifulLuckReceipt';
/// <reference types="node" />
import pageText from '../../pages/MapsWorkspacePage.tsx?raw';
import { readBountifulDamageZeroOriginalPlayerDiceOwner, hasIssuedBountifulDamageZeroOriginalRequest, recordBountifulDamageZeroOriginalHostRaw, recordBountifulDamageZeroOriginalHostConfirmation } from './bountifulDamageZeroOriginalRaw';
import { publishBountifulOrOrdinaryPlayerActionAck } from './bountifulLuckNormalAck';
import { createDnd5eTurnEconomyCounts, projectDnd5eHeadlessTurnEconomy } from './turnEconomy';
import type { PublishPlayerActionAckInput } from '../../lib/playerActionAckPublish';
import { performPlayerDiceRoll } from '../../pages/maps/playerDiceRoll';
import type { SharedRollRequestEvent } from '../../lib/sharedCombatTypes';
import { createDamageZeroSavingThrowRoomChoiceDriver } from '../../lib/damageZeroSavingThrowRoomChoices';
import { dnd5ePluginFeatureDefinition } from './pluginApi';
import { bountifulOriginalDieRollId, bountifulOriginalDiePhase, type BountifulOriginalDieCommand } from './bountifulLuckReceipt';
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway';
import { createBountifulDamageZeroOriginalRaw, readBountifulDamageZeroOriginalDiceRoute, type BountifulDamageZeroOriginalRawBook } from './bountifulDamageZeroOriginalRaw';
import { damageZeroNormalAckHttpFixture as bountifulReadyHttpFixture } from './damageZeroNormalAck.http.support';
import { captureDnd5eDamageZeroOriginalOperation, readDnd5eDamageZeroOriginalOperation, dnd5eDamageZeroOriginalBountifulOwners } from './damageZeroOriginalOperation';
import { createHash } from 'node:crypto';
import { it, expect, vi } from 'vitest';
import { buildShadowGraveActors, damageZeroOriginalFixtureArchives } from './damageZeroOriginal.native.fixture';
import { projectDnd5eStarModRuntime } from './starModAdapter';
import { parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { normalizeCharacter } from '../../store/characters';
import { applyDnd5eLevelAdvancement } from './levelAdvancement';
import { restoreClassResources } from '../../lib/classResources';
import { dnd5eClassDefinition } from './classes';
import { syncDnd5eHitPoints } from './hitPoints';
import { prepareDnd5eEquipmentAttack, resolvePreparedDnd5eEquipmentAttack } from './equipmentAttackAction';
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine';
import { planDnd5eMapResultApplication } from './mapBridge';
import { createDnd5eOriginalD20Session } from './damageCommitSession';
const auth = vi.hoisted(() => ({ value: { roomId: 'room', memberId: 'host', role: 'dm' } }));
vi.mock('../../lib/roomSession', () => ({ getRoomSession: () => auth.value }));
const sha = (v: Uint8Array) => createHash('sha256').update(v).digest('hex');
it.each(['player', 'host'] as const)('actual source1 original final-zero CHA1 authenticates %s original raw, independent adoption and fresh locked replay without world writes', async (owner) => {
    const shadowRaw = Buffer.from(damageZeroOriginalFixtureArchives.shadow.base64, 'base64'), bRaw = Buffer.from(damageZeroOriginalFixtureArchives.bounty.base64, 'base64');
    expect(sha(shadowRaw)).toBe('98524daa7d17e1abcb03dfa55dd5617a1b2e2fdc11f3a487680660d7c9ced6cc');
    expect(sha(bRaw)).toBe('757c068cbc0fe40e44006496dd4ac92daf6c400d94915076dc59bc7ea4500382');
    const packages = await Promise.all([shadowRaw, bRaw].map(async (bytes) => { const p = parseDnd5eContentPackageV2(await projectDnd5eStarModRuntime(new Uint8Array(bytes).buffer)); if (!p)
        throw Error('Actual source archive required'); return p; })), disposes = packages.map(pkg => registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)));
    try {
        const proof = await buildShadowGraveActors({ roomId: 'room', memberId: 'first-member' }), b = packages[1], feat = b.content.feats.find(row => row.id === 'bountiful-luck');
        if (!feat)
            throw Error('Actual installed Bountiful feat missing');
        const featId = b.manifest.id + ':' + feat.id;
        let helper = syncDnd5eHitPoints(normalizeCharacter({ id: 'helper', name: 'Helper', roomId: 'room', roomMemberId: 'helper-member', charClass: '战士', hitPointMaximumMode: 'fixed', level: 1, dnd5eClassLevels: { fighter: 1 }, race: '半身人', dnd5eRaceId: 'halfling', savingThrows: [...dnd5eClassDefinition('fighter')!.savingThrows], abilities: { str: 14, dex: 14, con: 14, int: 10, wis: 10, cha: 10 }, skills: ['athletics', 'perception'], dnd5eClassChoices: { fighter: { fightingStyles: ['archery'] } } }));
        for (let level = 2; level <= 4; level++) {
            const next = applyDnd5eLevelAdvancement(helper, { schemaVersion: 1, classId: 'fighter', levelsGained: 1, hitPointMethod: 'fixed', hitPointRolls: [], ...(level >= 3 ? { subclassId: 'champion' } : {}), fighterFightingStyles: ['archery'], asiChoices: level === 4 ? [{ classLevel: 4, choice: { kind: 'feat', featId } }] : [] });
            if (!next.ok)
                throw Error('Actual helper native' + level + ':' + next.reason);
            helper = restoreClassResources(next.character, 'long-rest');
        }
        expect(helper.dnd5eFeatIds).toContain(featId);
        expect(helper.dnd5ePluginFeatureIds ?? []).toEqual([]);
        let characters = [...proof.characters, helper].map(row => row.id === 'soul' ? { ...row, roomMemberId: owner === 'host' ? 'host' : 'first-member' } : row), map = { ...proof.map, tokens: [...proof.map.tokens, { id: 'helper-token', characterId: 'helper', type: 'player' as const, dnd5eSide: 'player' as const, label: 'Helper', x: 625, y: 425, size: 1, color: '', emoji: 'H', hp: helper.currentHp, maxHp: helper.maxHp }] }, order = map.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, roll: 20 - i, color: '', emoji: '' }));
        const ready = (id: string, round: number) => prepareDnd5eEquipmentAttack({ map, characters, initiativeOrder: order, attacksUsed: 0, action: { id, mapId: map.id, combatId: 'actual-strength-bountiful', sourceMode: 'player', status: 'pending', roomMemberId: 'first-member', type: 'dnd5e-weapon-attack', actorTokenId: 'foe-token', characterId: 'foe', targetTokenId: 'soul-token', round, initiativeIndex: 0, seq: round, updatedAt: 1 } });
        const first = ready('actual-first-physical-injury', 1);
        if (!first.ok)
            throw Error(first.reason);
        const injury = resolvePreparedDnd5eEquipmentAttack({ prepared: first.prepared, d20: 18, damageRolls: [5], classDamageRolls: [] });
        expect(injury.result.ok).toBe(true);
        let state = injury.result.state;
        for (const actorId of order.map(row => row.tokenId)) {
            const end = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId });
            expect(end.ok, JSON.stringify(end)).toBe(true);
            state = end.state;
        }
        const projection = planDnd5eMapResultApplication({ map, characters, state, events: [], characterIdByCombatantId: Object.fromEntries(map.tokens.map(t => [t.id, t.characterId!])) });
        map = projection.map as typeof map;
        characters = [...projection.characters];
        const next = ready('actual-original-final-two', state.round);
        if (!next.ok)
            throw Error(next.reason);
        const source = { prepared: next.prepared, d20: 18, damageRolls: [2], classDamageRolls: [] }, original = structuredClone(source.prepared.state), session = createDnd5eOriginalD20Session(source, resolvePreparedDnd5eEquipmentAttack, 'soul-token', 'saving-throw');
        try {
            const zero = session.run(source.prepared.state);
            expect(zero.status).toBe('pending-damage-zero-saving-throw');
            if (zero.status !== 'pending-damage-zero-saving-throw')
                throw Error(zero.status);
            const operation = captureDnd5eDamageZeroOriginalOperation(zero);
            expect(readDnd5eDamageZeroOriginalOperation(operation).frame).toEqual(zero.frame);
            expect(dnd5eDamageZeroOriginalBountifulOwners(operation)).toContainEqual(expect.objectContaining({ ownerId: 'helper-token' }));
            expect(readDnd5eDamageZeroOriginalOperation(operation).effectTimestamp).toBe(session.originalEffectTimestamp());
            const primaryLabel = dnd5ePluginFeatureDefinition(proof.featureId)!.name + ' · 魅力豁免';
            const http = await bountifulReadyHttpFixture();
            try {
                const data: Record<string, any> = { characters: { _sync: { revision: 1 }, characters: source.prepared.characters }, maps: { _sync: { revision: 1 }, maps: [source.prepared.map] }, combat: { _sync: { revision: 1 }, active: true, mapId: source.prepared.map.id, combatId: source.prepared.state.combatId, round: source.prepared.state.round, initiativeIndex: source.prepared.state.initiativeIndex, dnd5eTurnEconomyByToken: {} }, 'player-action-requests': { _sync: { revision: 1 }, requests: [source.prepared.action] }, 'map-geometry': { _sync: { revision: 0 } } };
                for (const entry of Object.values(data))
                    Object.assign(entry._sync, { schemaVersion: 1, writerId: 'host', writtenAt: 1 });
                const unrelated = { ...source.prepared.action, id: 'unrelated-original-ahead' };
                data['player-action-requests'].requests.unshift(unrelated);
                const originalData = structuredClone(data), published: any[] = [];
                const load = async (identity: {
                    parentId: string;
                    mapId: string;
                    combatId: string;
                }) => { const result = await http.state('POST', 'bountiful-damage-zero-original/source', identity, data, 'host'); expect(result.status, JSON.stringify(result.payload)).toBe(200); return result.payload as BountifulDamageZeroOriginalRawBook; };
                const gateway = { publishEvent: async (channel: string, payload: unknown) => { published.push(structuredClone(payload)); const response = await http.event(channel, payload, data, 'host'); expect(response.status, JSON.stringify(response.payload)).toBe(200); } };
                await expect(readBountifulDamageZeroOriginalDiceRoute({} as never)).rejects.toThrow('actual-issued-route-required');
                await expect(createBountifulDamageZeroOriginalRaw({ ...operation }, gateway, load, { original: primaryLabel, bless: '祝福术 · 魅力豁免', bane: '灾祸术 · 魅力豁免' })).rejects.toThrow('exact-current-operation-required');
                const issued = await createBountifulDamageZeroOriginalRaw(operation, gateway, load, { original: primaryLabel, bless: '祝福术 · 魅力豁免', bane: '灾祸术 · 魅力豁免' }), route = issued.routes[0], slot = await readBountifulDamageZeroOriginalDiceRoute(route), identity = { parentId: source.prepared.action.id, mapId: source.prepared.map.id, combatId: source.prepared.state.combatId };
                expect(slot).toMatchObject({ rollerTokenId: 'soul-token', memberId: owner === 'host' ? 'host' : 'first-member', count: 1, sides: 20, rollKind: 'saving-throw' });
                const register = published[0];
                expect((await http.event('bountiful-native-raw-source-dm-to-host', register, data, 'first-member')).status).toBe(403);
                expect((await http.event('bountiful-native-raw-source-dm-to-host', { ...register, frame: { ...register.frame, dc: register.frame.dc + 1 } }, data, 'host')).status).toBe(403);
                expect((await http.state('POST', 'bountiful-damage-zero-original/source', identity, data, 'first-member')).status).toBe(403);
                const payload = { ...identity, requestId: slot.requestId, rollerTokenId: slot.rollerTokenId, targetCharacterId: slot.targetCharacterId, kind: 'dice', label: slot.label, targetName: source.prepared.characters.find(c => c.id === 'soul')!.name, count: slot.count, sides: slot.sides, values: [], rollKind: slot.rollKind, delivery: 'player-roll-request', sourceMode: 'dm', eventId: 'zero-original-request', updatedAt: 1 };
                const event = async (p: any, member: string) => http.event(member === 'host' ? 'dice-roll-request-dm-to-player' : 'dice-roll-request-player-to-dm', p, data, member);
                const nativeOwner = await readBountifulDamageZeroOriginalPlayerDiceOwner(route, slot.requestId, slot.rollerTokenId, slot.count, slot.sides);
                expect(nativeOwner).toMatchObject({ characterId: 'soul', memberId: owner === 'host' ? 'host' : 'first-member', hostMemberId: 'host' });
                expect(nativeOwner?.rawValues).toBeUndefined();
                expect(await readBountifulDamageZeroOriginalPlayerDiceOwner(undefined, 'legacy', 'soul-token', 1, 20)).toBeUndefined();
                await expect(readBountifulDamageZeroOriginalPlayerDiceOwner({ ...route }, slot.requestId, slot.rollerTokenId, 1, 20)).rejects.toThrow('actual-issued-route-required');
                await expect(readBountifulDamageZeroOriginalPlayerDiceOwner(route, slot.requestId, 'helper-token', 1, 20)).rejects.toThrow('exact-issued-dice-owner-required');
                await expect(readBountifulDamageZeroOriginalPlayerDiceOwner(route, slot.requestId, slot.rollerTokenId, 2, 20)).rejects.toThrow('exact-issued-dice-owner-required');
                expect(await hasIssuedBountifulDamageZeroOriginalRequest({ requestId: slot.requestId, rollerTokenId: slot.rollerTokenId })).toBe(true);
                expect(await hasIssuedBountifulDamageZeroOriginalRequest({ requestId: 'bountiful-damage-zero-original:' + ('f'.repeat(64)), rollerTokenId: slot.rollerTokenId })).toBe(false);
                await expect(hasIssuedBountifulDamageZeroOriginalRequest({ requestId: slot.requestId, rollerTokenId: 'helper-token' })).rejects.toThrow('exact-issued-presentation-required');
                await expect(recordBountifulDamageZeroOriginalHostConfirmation({ requestId: slot.requestId, rollerTokenId: slot.rollerTokenId, sides: 20, rawValues: [1], values: [1] }, gateway)).rejects.toThrow('exact-locked-host-confirmation-required');
                expect(pageText).toContain('const damageZeroDiceOwner=await readBountifulDamageZeroOriginalPlayerDiceOwner(options.bountifulDamageZeroOriginalDice');
                await assertActualOriginalDiceOwnerSemantics(pageText,nativeOwner);
                /* Original broadcast exclusion is checked by the actual Page semantics call above. */
                expect(pageText).toContain('||await hasIssuedBountifulDamageZeroOriginalRequest({requestId:id,rollerTokenId:');
                const confirmSource = pageText.slice(pageText.indexOf('const issuedSettlementPresentation'));
                expect(confirmSource.indexOf('await recordBountifulDamageZeroOriginalHostRaw(')).toBeLessThan(confirmSource.indexOf('const confirmed = await dmDiceConfirmationQueueRef.current!'));
                expect(confirmSource.indexOf('await recordBountifulDamageZeroOriginalHostConfirmation(')).toBeGreaterThan(confirmSource.indexOf('const confirmed = await dmDiceConfirmationQueueRef.current!'));
                expect(confirmSource.indexOf('await recordBountifulDamageZeroOriginalHostConfirmation(')).toBeLessThan(confirmSource.indexOf('writeDicePoolCheckpoint(id, sides, confirmed, true)'));
                expect(confirmSource).toContain('enqueueCheckOutcome({ ...outcome, rollId: id');
                if (owner === 'player') {
                    expect((await event(payload, 'host')).status).toBe(200);
                    let generated = 0, physicalStarts = 0;
                    const actualRequest: SharedRollRequestEvent = { ...payload, kind: 'dice', delivery: 'player-roll-request', sourceMode: 'dm' }, priorAuth = { ...auth.value };
                    let actualValues: number[];
                    auth.value.memberId = 'first-member';
                    auth.value.role = 'player';
                    try {
                        actualValues = await performPlayerDiceRoll(actualRequest, () => { generated++; return 1; }, async (values) => { physicalStarts++; const started = await event({ ...payload, delivery: 'player-roll-start', sourceMode: 'player', values }, 'first-member'); expect(started.status, JSON.stringify(started.payload)).toBe(200); });
                        expect(await performPlayerDiceRoll(actualRequest, () => { throw Error('Cached original physically rolled twice'); }, async () => { throw Error('Cached original announced a second physical start'); })).toEqual(actualValues);
                    }
                    finally {
                        auth.value.memberId = priorAuth.memberId;
                        auth.value.role = priorAuth.role;
                    }
                    expect(generated).toBe(1);
                    expect(physicalStarts).toBe(1);
                    expect(actualValues!).toEqual([1]);
                    expect((await issued.read()).rows[0].raw).toBeUndefined();
                    expect((await event({ ...payload, delivery: 'player-roll-result', sourceMode: 'player', values: [2] }, 'first-member')).status).toBe(403);
                    const raw = { ...payload, delivery: 'player-roll-result', sourceMode: 'player', values: [1], eventId: 'zero-original-physical' };
                    expect((await event({ ...raw, roomMemberId: 'first-member' }, 'second-member')).status).toBe(403);
                    expect((await event(raw, 'host')).status).toBe(403);
                    await expect(issued.confirm(route, [1], [1])).rejects.toThrow();
                    expect((await event(raw, 'first-member')).status).toBe(200);
                    expect((await event(raw, 'first-member')).status).toBe(200);
                    expect((await event({ ...raw, values: [2] }, 'first-member')).status).toBe(403);
                    await expect(issued.recordHostRaw(route, [1])).rejects.toThrow();
                }
                else {
                    expect((await event(payload, 'host')).status).toBe(403);
                    expect((await event({ ...payload, delivery: 'player-roll-result', values: [1], sourceMode: 'player' }, 'first-member')).status).toBe(403);
                    await expect(issued.confirm(route, [1], [1])).rejects.toThrow();
                    await recordBountifulDamageZeroOriginalHostRaw({ requestId: slot.requestId, rollerTokenId: slot.rollerTokenId, sides: 20, values: [1] }, gateway);
                    await recordBountifulDamageZeroOriginalHostRaw({ requestId: slot.requestId, rollerTokenId: slot.rollerTokenId, sides: 20, values: [1] }, gateway);
                    await expect(issued.recordHostRaw(route, [2])).rejects.toThrow();
                }
                expect(await recordBountifulDamageZeroOriginalHostRaw({ requestId: slot.requestId, rollerTokenId: slot.rollerTokenId, sides: 20, values: [1] }, gateway)).toBe(true);
                const locked = await issued.read();
                expect(locked.rows[0].raw).toEqual({ memberId: owner === 'host' ? 'host' : 'first-member', values: [1] });
                expect(locked.rows[0].confirmed).toBeUndefined();await assertActualOriginalDiceOwnerSemantics(pageText,await readBountifulDamageZeroOriginalPlayerDiceOwner(route,slot.requestId,slot.rollerTokenId,slot.count,slot.sides));
                await recordBountifulDamageZeroOriginalHostConfirmation({ requestId: slot.requestId, rollerTokenId: slot.rollerTokenId, sides: 20, rawValues: [1], values: [1] }, gateway);
                expect((await issued.read()).rows[0].confirmed).toEqual({ memberId: 'host', values: [1] });await assertActualOriginalDiceOwnerSemantics(pageText,await readBountifulDamageZeroOriginalPlayerDiceOwner(route,slot.requestId,slot.rollerTokenId,slot.count,slot.sides));
                await expect(issued.confirm(route, [1], [18])).rejects.toThrow();
                const fresh = await createBountifulDamageZeroOriginalRaw(operation, gateway, load, { original: primaryLabel, bless: '祝福术 · 魅力豁免', bane: '灾祸术 · 魅力豁免' });
                expect((await fresh.read()).rows).toEqual((await issued.read()).rows);
                expect((await readBountifulDamageZeroOriginalDiceRoute(fresh.routes[0])).values).toEqual([1]);
                const copy = structuredClone(route);
                await expect(readBountifulDamageZeroOriginalDiceRoute(copy)).rejects.toThrow('actual-issued-route-required');
                expect((await event({ ...payload, requestId: slot.requestId + ':preview:1', delivery: 'broadcast-result', values: [1] }, 'host')).status).toBe(403);
                expect((await event({ ...payload, requestId: slot.requestId + ':dm-confirmed', delivery: 'broadcast-result', values: [1] }, 'host')).status).toBe(200);
                expect((await event({ ...payload, requestId: slot.requestId + ':dm-confirmed', delivery: 'broadcast-result', values: [18] }, 'host')).status).toBe(403);
                expect(data).toEqual(originalData);
                let physicalAgain = 0, lateBeforeBounty = 0, prefixOffers = 0;
                const makeRoom = (cloneHandle = false) => createDamageZeroSavingThrowRoomChoiceDriver({ map: source.prepared.map, characters: () => source.prepared.characters, parentTransactionId: () => source.prepared.action.id, choose: async () => proof.featureId, rollDice: async () => { physicalAgain++; throw Error('Locked original must not physically reroll'); }, authorityUnchanged: () => true, originalRaw: { create: async (op, labels) => cloneHandle ? { ...issued } : createBountifulDamageZeroOriginalRaw(op, gateway, load, labels), onPrefix: async (selection) => { prefixOffers++; expect(selection.operation).toBe(operation); expect(selection.requiresBountiful).toBe(true); expect(selection.prefix).toEqual({ frameId: zero.frame.id, featureId: proof.featureId, rolls: [1] }); } }, collectLateSavingThrow: async () => { lateBeforeBounty++; throw Error('Shared late choices must follow original Bounty'); } }), roomInput = { frame: zero.frame, state: zero.snapshot, eventId: zero.frame.id, originalOperation: operation };
                const roomChoice = await makeRoom().chooseDamageZeroSavingThrow!(roomInput);
                expect(roomChoice).toEqual({ frameId: zero.frame.id, featureId: proof.featureId, rolls: [1] });
                expect(physicalAgain).toBe(0);
                expect(lateBeforeBounty).toBe(0);
                expect(prefixOffers).toBe(1);
                await expect(makeRoom().chooseDamageZeroSavingThrow!({ ...roomInput, originalOperation: { ...operation } })).rejects.toThrow('exact-current-operation-required');
                await expect(makeRoom(true).chooseDamageZeroSavingThrow!(roomInput)).rejects.toThrow('actual-issued-handle-required');
                expect(physicalAgain).toBe(0);
                expect(lateBeforeBounty).toBe(0);
                if (!roomChoice)
                    throw Error('Actual Room original choice missing');
                const metadataWrites: string[][] = [];
                const save: SharedRoomGatewayPort['saveResourcesAtomically'] = async (batch, options) => { const response = await http.state('POST', 'transaction', { transactionId: options?.transactionId, writes: batch, readRevisions: options?.readRevisions }, data, 'host'); expect(response.status, JSON.stringify(response.payload)).toBe(200); expect([['combat'], ['combat', 'player-action-requests']]).toContainEqual(batch.map(row => row.name)); for (const row of batch)
                    data[row.name] = await http.readActualResource(row.name); data.combat = response.saved; metadataWrites.push(batch.map(row => row.name)); return { status: 'committed', transactionId: options?.transactionId ?? '', revisions: { combat: data.combat._sync.revision } }; };
                const parentGateway = { ...gateway, loadResource: async <T>(name: string) => structuredClone(data[name] ?? null) as T, saveResourcesAtomically: save };
                let commandSerial = 0;
                const append = async (currentReceipt: BountifulOriginalDieReceipt, command: BountifulOriginalDieCommand, actorId: string, characterId: string, memberId: string) => { const row = { id: 'actual-zero-response-' + owner + '-' + (++commandSerial), mapId: source.prepared.map.id, combatId: source.prepared.state.combatId, sourceMode: memberId === 'host' ? 'dm' : 'player', status: 'pending', type: 'dnd5e-bountiful-luck', actorTokenId: actorId, characterId, roomMemberId: memberId, round: source.prepared.state.round, initiativeIndex: source.prepared.state.initiativeIndex, seq: commandSerial + 10, updatedAt: 1, bountifulLuck: { parentId: source.prepared.action.id, occurrence: currentReceipt.identity.occurrence, command } }; const response = await http.append(row, data, memberId); expect(response.status, JSON.stringify(response.payload)).toBe(200); data['player-action-requests'] = response.queue; };
                const action = source.prepared.action, recovered = await restoreBountifulDamageZeroOriginalRaw(identity, gateway, load, { original: primaryLabel, bless: '祝福术 · 魅力豁免', bane: '灾祸术 · 魅力豁免' });
                let physicalAgainInBoundary = 0;
                const boundary = createBountifulDamageZeroOriginalRoomBoundary({ action, gateway: parentGateway, loadOriginal: load, options: ports => ({ authorityUnchanged: () => true, combatRevision: data.combat._sync.revision, confirm: async () => ({ accepted: false }), roll: async () => { throw Error('No new generic damage pool'); }, replayEventBatchId: action.id, ...createDamageZeroSavingThrowRoomChoiceDriver({ map: source.prepared.map, characters: () => source.prepared.characters, parentTransactionId: () => action.id, choose: async () => proof.featureId, rollDice: async () => { physicalAgainInBoundary++; throw Error('Private original physically rerolled'); }, authorityUnchanged: () => true, originalRaw: ports.originalRaw }), chooseAllyNaturalOne: ports.chooseAllyNaturalOne }), ui: { showChoice: async (current) => { const option = current.request.options[0]; await append(current, { phase: 'reaction', ...option, decision: owner === 'host' ? 'use' : 'decline' }, option.ownerId, 'helper', 'helper-member'); }, requestRoll: async (_current, refresh) => { let latest = await refresh(); if (bountifulOriginalDiePhase(latest) === 'roller') {
                            await append(latest, { phase: 'roll', rollRequestId: bountifulOriginalDieRollId(latest), value: 17 }, 'soul-token', 'soul', 'host');
                            latest = await refresh();
                        } if (bountifulOriginalDiePhase(latest) === 'host-confirmation') {
                            await append(latest, { phase: 'confirm', rollRequestId: bountifulOriginalDieRollId(latest), rawValue: 17, value: 17 }, 'soul-token', 'soul', 'host');
                            await refresh();
                        } } } });
                const spoof=Object.freeze({source:recovered.source,result:{ok:true}}),fakeBoundary=createBountifulDamageZeroOriginalRoomBoundary({action,gateway:parentGateway,loadOriginal:load,options:()=>({authorityUnchanged:()=>true,combatRevision:data.combat._sync.revision,confirm:async()=>({accepted:false}),roll:async()=>{throw Error('Unissued pool')},chooseDamageZeroSavingThrow:async()=>{throw spoof}}),ui:{showChoice:async()=>{throw Error('Unissued owner')},requestRoll:async()=>{throw Error('Unissued reroll')}}});await expect(fakeBoundary.resolve(recovered.source)).rejects.toBe(spoof);expect(metadataWrites).toHaveLength(0);await expect(boundary.ports.originalRaw.onPrefix({operation,handle:issued,prefix:roomChoice,requiresBountiful:true})).rejects.toThrow('actual-original-handle-required');expect(metadataWrites).toHaveLength(0);
const normal = await boundary.resolve(recovered.source);
                expect(normal.result.ok).toBe(true);
                expect(normal.result.state.combatants['soul-token'].currentHp).toBe(owner === 'host' ? 1 : 0);
                expect(physicalAgainInBoundary).toBe(0);
                expect(boundary.readSavedSource()).toHaveProperty('hostDamageZeroSavingThrows');
                expect(metadataWrites.every(names => names.every(name => ['combat', 'player-action-requests'].includes(name)))).toBe(true);
                const restoredBoundary = createBountifulDamageZeroOriginalRoomBoundary({ action, gateway: parentGateway, loadOriginal: load, options: () => ({ authorityUnchanged: () => true, combatRevision: data.combat._sync.revision, confirm: async () => ({ accepted: false }), roll: async () => { throw Error('Fresh saved Base unexpectedly rolled'); } }), ui: { showChoice: async () => { throw Error('Fresh ready asked owner again'); }, requestRoll: async () => { throw Error('Fresh ready physically rerolled'); } } });
                const freshFinal = await restoredBoundary.resolve(source);
                expect(freshFinal.result.state).toEqual(normal.result.state);expect(freshFinal.result.events).toEqual(normal.result.events);expect(freshFinal.application).toEqual(normal.application);expect(freshFinal.result.transaction?.id).toBe(action.id);expect(freshFinal.result.transaction?.rollLedger.entries.map(row=>row.dice)).toEqual(normal.result.transaction?.rollLedger.entries.map(row=>row.dice));expect(source.prepared.state).toEqual(original);
                const worldWrites: string[][] = [], worldTransactions: string[] = [];
                if (!normal.result.ok || !normal.application)
                    throw Error('Actual source/Base normal result required');
                expect(data.characters).toEqual(originalData.characters);
                expect(data.maps).toEqual(originalData.maps);
                const beforeWorldQueue = JSON.stringify(await http.readActualResource('player-action-requests'));
                const normalState = normal.result.state, economies = Object.fromEntries(Object.entries(normalState.combatants).map(([id, actor]) => { const slot = normalState.initiativeOrder[normalState.initiativeIndex] === id ? (normalState.initiativeSlotIds?.[normalState.initiativeIndex] ?? id) : id; return [id, projectDnd5eHeadlessTurnEconomy(createDnd5eTurnEconomyCounts(normalState.combatId + ':' + normalState.round + ':' + slot, Math.max(source.prepared.state.combatants[id]?.speed ?? actor.speed, actor.speed)), actor.turn, actor.speed)]; }));
                const ackInput: PublishPlayerActionAckInput = { ack: { id: 'ack:' + action.id, actionId: action.id, mapId: action.mapId, combatId: action.combatId, recipientMemberId: action.roomMemberId, status: 'accepted', round: action.round, initiativeIndex: action.initiativeIndex, updatedAt: 2 }, snapshots: { characters: normal.application.characters, maps: [normal.application.map], combat: { ...data.combat, dnd5eTurnEconomyByToken: economies, updatedAt: 2 }, updatedAt: 2 }, processed: { mapId: action.mapId, combatId: action.combatId, actionIds: [action.id], updatedAt: 2 }, expectedRevisions: { 'player-action-ack': 0, 'player-action-processed': 0 }, saveSharedResource: async () => { throw Error('No independent world writes'); }, commitSharedResources: async (writes, options) => { const response = await http.state('POST', 'transaction', { ...options, writes }, data, 'host'); expect(response.status, JSON.stringify(response.payload)).toBe(200); worldWrites.push(writes.map(row => row.name)); worldTransactions.push(options?.transactionId ?? ''); for (const row of writes)
                        data[row.name] = await http.readActualResource(row.name); return response.payload; }, loadSharedResource: parentGateway.loadResource, publishAck: async () => { } };
                await expect(publishBountifulOrOrdinaryPlayerActionAck(structuredClone(action), ackInput, parentGateway)).rejects.toThrow('issued-result-required');
                expect(worldWrites).toHaveLength(0);
                await publishBountifulOrOrdinaryPlayerActionAck(action, ackInput, parentGateway);
                expect(worldWrites).toEqual([['characters', 'maps', 'combat', 'player-action-processed', 'player-action-ack']]);
                expect(worldTransactions).toEqual(['player-action:' + action.id]);
                expect(JSON.stringify(await http.readActualResource('player-action-requests'))).toBe(beforeWorldQueue);
                expect((await http.readActualResource('player-action-processed')).actionIds).toEqual([action.id]);
                expect(await http.readActualResource('player-action-ack')).toMatchObject({ actionId: action.id, status: 'accepted', recipientMemberId: 'first-member' });
                expect(Object.values(data.combat.bountifulOriginalParents).every((row: any) => row.consumed?.transactionId === action.id)).toBe(true);
                expect(data.combat.dnd5eTurnEconomyByToken['foe-token'].action.current).toBe(0);
                expect(data.combat.dnd5eTurnEconomyByToken['helper-token'].reaction.current).toBe(owner === 'host' ? 0 : 1);
                expect(data.characters.characters.find((c: any) => c.id === 'soul').currentHp).toBe(normalState.combatants['soul-token'].currentHp);
                for (const resource of ['characters', 'maps', 'combat', 'player-action-processed', 'player-action-ack'])
                    expect(await http.readActualResource(resource)).toEqual(data[resource]);
                await publishBountifulOrOrdinaryPlayerActionAck(structuredClone(action), ackInput, parentGateway);
                expect(worldWrites).toHaveLength(1);
            }
            finally {
                await http.close();
            }
        }
        finally {
            session.cancel();
        }
    }
    finally {
        for (const dispose of disposes.reverse())
            dispose();
    }
});
