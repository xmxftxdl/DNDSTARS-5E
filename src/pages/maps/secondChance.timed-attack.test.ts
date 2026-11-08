import { secondChanceTestContent } from './secondChance.testFixture';
import { afterEach, expect, it, vi } from 'vitest';
import { normalizeCharacter } from '../../store/characters';
import { syncCharacterClassResources } from '../../lib/classResources';
import { registerDnd5eRulesPlugin } from '../../rulesets/dnd5e/pluginApi';
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway';
import { type PersistedSecondChanceAttack, type SecondChanceCombat } from './secondChanceHostCommit';
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from '../../rulesets/dnd5e/headlessCombatEngine';
import { migrateMapsState } from '../../store/maps';
import { stampPlayerActionStateForRoomMember } from '../../../scripts/shared-server-core.mjs';
import { runMapsPlayerActionTransaction } from './runMapsPlayerActionTransaction';
import { DmActionTransactionCoordinator } from '../../lib/dmActionTransactionCoordinator';
import { driveSecondChancePersistentRoomParent, resumeSecondChancePersistentRoomParent } from './secondChancePersistentRoomDriver';
import { submitSecondChanceChoice, submitSecondChanceRoll, submitSecondChanceHostConfirmation } from '../../lib/secondChanceClientCommands';
import { captureSecondChancePreparedOriginal, readSecondChancePreparedOriginalAsync } from './secondChancePreparedParent';
const session = vi.hoisted(() => ({ current: { roomId: 'room', memberId: 'dm', role: 'dm' } }));
vi.mock('../../lib/roomSession', () => ({ getRoomSession: () => session.current }));
const disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0))
    dispose(); session.current = { roomId: 'room', memberId: 'dm', role: 'dm' }; });
function fixture() {
    const content = structuredClone(secondChanceTestContent);
    const feat: import('../../rulesets/dnd5e/pluginApi').Dnd5ePluginFeatDefinition = { ...content.feats[0], automation: 'full', resources: [{ id: 'uses', label: '花开二度', maximum: 1, resetOn: 'short-rest' }], declarativeAbility: { schemaVersion: 1, id: 'incoming-hit', name: '花开二度', description: content.feats[0].description, level: 1, trigger: { kind: 'after-d20-roll' }, targeting: { kind: 'self' }, effects: [], automation: 'full', cost: { economy: 'reaction', resources: [{ resourceId: 'uses', amount: 1 }] }, mechanic: { kind: 'incoming-hit-attack-die-reroll' } } };
    disposers.push(registerDnd5eRulesPlugin({ manifest: { id: 'test.second-chance', name: 'Second Chance staged candidate', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Local', license: 'Private' }, setup(api) { api.registerFeat(feat); } }));
    const owner = syncCharacterClassResources(normalizeCharacter({ id: 'hero', name: 'Hero', race: '半身人', dnd5eRaceId: 'halfling', charClass: '战士', level: 4, dnd5eFeatIds: ['test.second-chance:second-chance'] }));
    const receipt: PersistedSecondChanceAttack = { attack: { schemaVersion: 1, id: 'attack', transactionId: 'parent', mapId: 'map', combatId: 'combat', rollerTokenId: 'orc', rollerControllerMemberId: 'dm', targetTokenId: 'hero-token', targetCharacterId: 'hero', targetControllerMemberId: 'player', dice: [18, 17], mode: 'advantage', modifier: 5, armorClass: 16, criticalThreshold: 20, phase: 'hit-confirmation' }, featureId: 'test.second-chance:feat-second-chance', characterRevision: 4, mapRevision: 7, turnKey: 'combat:1:orc', canSeeRoller: true, canUseReaction: true, reactionReserved: false, reactionDecision: { authenticatedMemberId: 'player', decision: 'use' }, rollerSelection: { authenticatedMemberId: 'dm', dieIndex: 0 }, rollerD20: { authenticatedMemberId: 'dm', dieIndex: 0, value: 2 } };
    const combat: SecondChanceCombat = { mapId: 'map', combatId: 'combat', active: true, round: 1, initiativeIndex: 0, initiativeOrder: [], updatedAt: 1, secondChanceAttacks: { attack: receipt }, dnd5eTurnEconomyByToken: { 'hero-token': { turnKey: receipt.turnKey, attacksUsed: 0, action: { current: 1, max: 1 }, bonusAction: { current: 1, max: 1 }, reaction: { current: 1, max: 1 }, movement: { current: 25, max: 25 } } }, _sync: { schemaVersion: 1, revision: 8, writerId: 'fixture-host', writtenAt: 1 } };
    let data: Record<string, unknown> = { characters: { characters: [owner], _sync: { schemaVersion: 1, revision: 4, writerId: 'fixture-host', writtenAt: 1 } }, maps: { maps: [], _sync: { schemaVersion: 1, revision: 7, writerId: 'fixture-host', writtenAt: 1 } }, combat };
    let lostReply = false;
    const gateway: Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'> = { loadResource: async <T>(name: string) => structuredClone(data[name]) as T, saveResourcesAtomically: vi.fn(async (writes, options) => {
            for (const write of writes)
                if (write.expectedRevision !== (data[write.name] as {
                    _sync: {
                        revision: number;
                    };
                })._sync.revision)
                    throw Error('state-transaction-conflict');
            for (const [name, rev] of Object.entries(options?.readRevisions ?? {}))
                if (rev !== ((data[name] as {
                    _sync: {
                        revision: number;
                    };
                } | undefined)?._sync.revision ?? 0))
                    throw Error('state-transaction-conflict');
            const next = structuredClone(data);
            for (const write of writes)
                next[write.name] = { ...(write.data as object), _sync: { revision: (data[write.name] as {
                            _sync: {
                                revision: number;
                            };
                        })._sync.revision + 1 } };
            data = next;
            if (lostReply)
                throw Error('Failed to fetch');
            return { status: 'committed' as const, transactionId: options?.transactionId ?? '', revisions: {} };
        }) };
    return { gateway, input: { mapId: 'map', attackReceiptId: 'attack' }, data: () => data, receipt: () => ((data.combat as SecondChanceCombat).secondChanceAttacks!.attack), loseReply: () => { lostReply = true; } };
}
function attachRealParent(f: ReturnType<typeof fixture>) {
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'player', abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 16, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false });
    const attacker = make('orc', 20), owner = make('hero-token', 10);
    owner.pluginFeatureIds = ['test.second-chance:feat-second-chance'];
    owner.classResources = { 'test.second-chance:uses': { current: 1, max: 1 } };
    const state = startDnd5eHeadlessCombat('combat', [attacker, owner]);
    f.receipt().parentInput = { state, action: { type: 'attack', actorId: 'orc', targetId: 'hero-token', d20: 18, d20Second: 17, mode: 'advantage', attackModifier: 5, damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'slashing' } }, characterIdByCombatantId: { 'hero-token': 'hero' } };
    const chars = f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    };
    chars.characters[0].currentHp = 30;
    chars.characters[0].maxHp = 30;
    const normalized = migrateMapsState({ maps: [{ id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, tokens: [{ id: 'orc', type: 'enemy', label: 'Orc', x: 25, y: 25, hp: 30, maxHp: 30 }, { id: 'hero-token', characterId: 'hero', type: 'player', label: 'Hero', x: 75, y: 25 }] }] });
    f.data().maps = { ...normalized, _sync: { schemaVersion: 1, revision: 7, writerId: 'fixture-host', writtenAt: 1 } };
    const combat = f.data().combat as SecondChanceCombat;
    combat.dnd5eTurnEconomyByToken!.orc = { ...structuredClone(combat.dnd5eTurnEconomyByToken!['hero-token']), action: { current: 1, max: 1 } };
    combat.initiativeOrder = [{ tokenId: 'orc', slotId: 'orc:normal', label: 'Orc', roll: 20, emoji: '', color: '' }, { tokenId: 'hero-token', slotId: 'hero-token:normal', label: 'Hero', roll: 10, emoji: '', color: '' }];
}
import { prepareDnd5ePluginSpellCast, resolvePreparedDnd5ePluginSpellCast, prepareDnd5eLongCastingStart, activateDnd5ePreparedLongCasting, dnd5ePreparedLongCastingBinding } from '../../rulesets/dnd5e/pluginSpellTransaction';
import { parseDnd5eUnifiedContentBundleV1, dnd5eRulesPluginFromUnifiedContentBundleV1 } from '../../rulesets/dnd5e/unifiedContent';
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability';
import { beginDnd5eLongCasting, prepareDnd5eLongCastingCombatTurn, armDnd5eLongCastingCombatTurn, dnd5eLongCastingCanComplete, captureDnd5eCompletedLongCastingWitness, restoreDnd5eCompletedLongCastingWitness } from '../../rulesets/dnd5e/longCastingContinuity';
import { resolveDnd5eHeadlessAction } from '../../rulesets/dnd5e/headlessCombatEngine';
import { planDnd5eMapResultApplication } from '../../rulesets/dnd5e/mapBridge';
import { createDnd5ePreparedDamageCommitSession } from '../../rulesets/dnd5e/damageCommitSession';
it('a real completed timed imported attack can reach Second Chance after its ten actually paid casting turns', async () => {
    const placement = false;
    const f = fixture();
    attachRealParent(f);
    const namespace = 'test.second-chance-timed', spellId = namespace + ':ray', automation = automationCapabilityFromLegacyStatus('full');
    const parsed = parseDnd5eUnifiedContentBundleV1(JSON.stringify({ format: 'dndstars5e-unified-content', schemaVersion: 1, manifest: { id: namespace, name: 'Imported attack', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Local', license: 'Private' }, assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', id: 'ray', kind: 'spell', name: 'Ray', automation, payload: { id: 'ray', name: 'Ray', level: 0, school: 'evocation', ritual: false, castingTime: { value: 1, unit: 'minute' }, range: { type: 'distance', feet: 60 }, targeting: { relation: 'any', includeSelf: false, maximumTargets: 1 }, components: { verbal: false, somatic: false, material: false }, duration: { type: 'instantaneous', concentration: false }, classes: ['wizard'], description: 'Persistent imported attack integration fixture', automation: { mode: 'reference-only' } }, activities: [{ schemaVersion: 1, id: 'ray', name: 'Ray', castingConstraints: placement ? { maximumTargetDistanceFeet: 60 } : undefined, activation: { kind: 'special' }, target: placement ? { kind: 'area', relation: 'any', origin: 'point', shape: 'sphere', radiusFeet: 5, placeRangeFeet: 60, includeSelf: false, placementQualification: { prompt: 'Host verifies the chosen location' } } : { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60, requiredQualifications: undefined }, checks: [{ id: 'attack', kind: 'attack-roll', rollId: 'attack-d20', attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } }, rollMode: 'host-derived', scope: 'per-target' }], outcomes: [{ id: 'hit', when: { kind: 'check', checkId: 'attack', result: 'success' }, operations: [{ id: 'hurt', kind: 'damage', target: 'target', amount: { kind: 'dice', rollId: 'damage', count: 1, sides: 6 }, critical: 'double-dice', damageType: 'force', magical: true }] }], automation, legacySource: { kind: 'spell', id: 'ray' } }] }] }));
    expect(parsed).toBeTruthy();
    if (!parsed)
        throw Error('actual unified parser rejected fixture');
    disposers.push(registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(parsed)));
    const chars = (f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters;
    chars[0].roomMemberId = 'player';
    chars[0].roomId = 'room';
    const caster = normalizeCharacter({ id: 'imported-caster', name: 'Caster', roomMemberId: 'caster-member', charClass: '法师', level: 1, abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 10, cha: 10 }, currentHp: 30, maxHp: 30, dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': [spellId] } } } } });
    chars.push(caster);
    const map = (f.data().maps as {
        maps: ReturnType<typeof migrateMapsState>['maps'];
    }).maps[0], token = map.tokens.find((row: any) => row.id === 'orc')!;
    token.type = 'player';
    token.characterId = caster.id;
    const combat = f.data().combat as SecondChanceCombat;
    combat.secondChanceAttacks = undefined;
    const action = { id: 'imported-parent', mapId: 'map', combatId: 'combat', type: 'dnd5e-spell-cast', sourceMode: 'player', status: 'pending', actorTokenId: 'orc', characterId: caster.id, targetTokenId: 'hero-token', dnd5eSpellCast: { spellId, castingClassId: 'wizard', slotLevel: 0, targetTokenId: 'hero-token', ...(placement ? { areaTargetCell: { col: 1, row: 0 } } : {}) }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
    const parent = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [action] }, { memberId: 'caster-member' });
    Object.assign(action, parent.requests[0]);
    f.data()['player-action-requests'] = { ...parent, _sync: { schemaVersion: 1, revision: 1, writerId: 'fixture-host', writtenAt: 1 } };
    const ready = prepareDnd5ePluginSpellCast({ action: action as never, map, characters: chars, initiativeOrder: combat.initiativeOrder });
    expect(ready.ok, JSON.stringify(ready)).toBe(true);
    if (!ready.ok)
        throw Error('real spell preparation required');
    const prepared = ready.prepared, binding = dnd5ePreparedLongCastingBinding(prepared), receipt = prepared.longCastingReceipt;
    expect(prepared.castingTime).toBe('long');
    let state = beginDnd5eLongCasting(receipt, binding, prepared.state)!;
    const startPlan = prepareDnd5eLongCastingStart(prepared, { maps: [map], characters: chars })!;
    expect(state).toBeTruthy();
    expect(startPlan).toBeTruthy();
    const publish = async (plan: typeof startPlan, current: typeof state) => { const priorCharacters = f.data().characters as {
        _sync: {
            revision: number;
        };
    }, priorMaps = f.data().maps as {
        _sync: {
            revision: number;
        };
    }, priorCombat = f.data().combat as SecondChanceCombat; await f.gateway.saveResourcesAtomically([{ name: 'characters', expectedRevision: priorCharacters._sync.revision, data: { characters: plan.characters } }, { name: 'maps', expectedRevision: priorMaps._sync.revision, data: { maps: [plan.map] } }, { name: 'combat', expectedRevision: priorCombat._sync!.revision!, data: { ...priorCombat, round: current.round, initiativeIndex: current.initiativeIndex, dnd5eTurnEconomyByToken: { ...priorCombat.dnd5eTurnEconomyByToken, orc: { ...priorCombat.dnd5eTurnEconomyByToken!.orc, action: { current: current.combatants.orc.turn.actionAvailable ? 1 : 0, max: 1 } } } } }], { transactionId: 'actual-long-cast:' + current.round }); };
    const room = () => ({ maps: (f.data().maps as {
            maps: typeof map[];
        }).maps, characters: (f.data().characters as {
            characters: typeof chars;
        }).characters });
    await publish(startPlan, state);
    expect(activateDnd5ePreparedLongCasting(prepared, room(), state)).toBe(true);
    expect(captureDnd5eCompletedLongCastingWitness(receipt, binding, state, 60)).toBeUndefined();
    for (let round = 2; round <= 10; round++) {
        const end = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'orc' });
        expect(end.ok).toBe(true);
        const back = resolveDnd5eHeadlessAction(end.state, { type: 'end-turn', actorId: 'hero-token' });
        expect(back.ok).toBe(true);
        state = back.state;
        expect(state.round).toBe(round);
        expect(state.combatants.orc.turn.actionAvailable).toBe(true);
        const proposal = prepareDnd5eLongCastingCombatTurn(receipt, binding, state)!;
        expect(proposal).toBeTruthy();
        state = proposal.state;
        const plan = planDnd5eMapResultApplication({ state, map: room().maps[0], characters: room().characters, baselineCharacters: room().characters, characterIdByCombatantId: prepared.characterIdByCombatantId });
        await publish(plan, state);
        expect(armDnd5eLongCastingCombatTurn(proposal, binding, state)).toBe(true);
    }
    expect(dnd5eLongCastingCanComplete(receipt, binding, state)).toBe(true);
    const witness = captureDnd5eCompletedLongCastingWitness(receipt, binding, state, 60)!;
    expect(witness.combat.paidRounds).toBe(10);
    const recovered = restoreDnd5eCompletedLongCastingWitness(JSON.parse(JSON.stringify(witness)), binding, state, 60);
    expect(dnd5eLongCastingCanComplete(recovered, binding, state)).toBe(true);
    expect(restoreDnd5eCompletedLongCastingWitness({ ...witness, combat: { ...witness.combat, paidRounds: 9 } }, binding, state, 60)).toBeUndefined();
    expect(restoreDnd5eCompletedLongCastingWitness(witness, { ...binding, requestId: 'foreign' }, state, 60)).toBeUndefined();
    expect(restoreDnd5eCompletedLongCastingWitness(witness, binding, state, 120)).toBeUndefined();
    const input = { prepared, currentRoom: room(), currentCombatState: state, rolls: { activityRolls: { 'attack-d20:hero-token': { values: [18], modifier: 0, total: 18 }, damage: { values: [4], modifier: 0, total: 4 } } } };
    const parentSession = createDnd5ePreparedDamageCommitSession(input, resolvePreparedDnd5ePluginSpellCast, () => false), pending = parentSession.run(prepared.state);
    expect(pending.status, JSON.stringify(pending)).toBe('pending-incoming-attack');
    if (pending.status !== 'pending-incoming-attack')
        throw Error('actual timed completion did not yield a hit');
    expect(pending.snapshot.round).toBe(10);
    expect(pending.facts.dice).toEqual([18]);
    const original = captureSecondChancePreparedOriginal(resolvePreparedDnd5ePluginSpellCast, input)!;
    expect(original.adapterId).toBe('plugin-spell');
    for (const foreign of [{ roomId: 'room', memberId: 'caster-member', role: 'player' }, { roomId: 'room', memberId: 'another-dm', role: 'dm' }, { roomId: 'foreign-room', memberId: 'dm', role: 'dm' }]) {
        session.current = foreign;
        await expect(readSecondChancePreparedOriginalAsync(JSON.parse(JSON.stringify(original)))).rejects.toThrow('host-recovery-authority-required');
    }
    session.current = { roomId: 'room', memberId: 'dm', role: 'dm' };
    expect((await readSecondChancePreparedOriginalAsync(JSON.parse(JSON.stringify(original)))).prepared.state.combatId).toBe('combat');
    const appendFor = (memberId: string) => ({ appendPlayerActionRequest: async (value: unknown) => { const prior = f.data()['player-action-requests'] as {
            requests: unknown[];
            _sync: {
                revision: number;
            };
        }; const stamped = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [value] }, { memberId }); f.data()['player-action-requests'] = { requests: [...prior.requests, ...stamped.requests], _sync: { revision: prior._sync.revision + 1 } }; } });
    const ui: import('./secondChancePersistentRoomDriver').SecondChancePersistentRoomUI = { showChoice: async ({ context }) => { await submitSecondChanceChoice({ mapId: 'map', context, optionId: context.phase === 'reaction' ? context.featureId : 'die:0', round: 10, initiativeIndex: 0 }, appendFor(context.phase === 'reaction' ? 'player' : 'caster-member')); }, requestRoll: async ({ receipt, rollRequestId, supplement }) => { const context = { attackReceiptId: receipt.attack.id, combatId: 'combat', actorTokenId: 'orc', characterId: caster.id, rollRequestId, count: supplement?.count ?? 1, sides: supplement?.sides ?? 20, supplementRequestId: supplement?.id }; await submitSecondChanceRoll({ mapId: 'map', context, values: [supplement ? 5 : 17], round: 10, initiativeIndex: 0 }, appendFor('caster-member')); await submitSecondChanceHostConfirmation({ mapId: 'map', context, values: [supplement ? 5 : 17], round: 10, initiativeIndex: 0 }, appendFor('dm')); }, prepareFollowups: async () => { const baseline = JSON.stringify([f.data().characters, f.data().maps]); return { combatRevision: (f.data().combat as {
                _sync: {
                    revision: number;
                };
            })._sync.revision, authorityUnchanged: () => JSON.stringify([f.data().characters, f.data().maps]) === baseline, confirm: async () => ({ accepted: false }), roll: async () => { throw Error('unexpected unrelated dice'); } }; } };
    const published = vi.fn(async () => { }), recover = vi.fn(async () => { }), oldCas = vi.fn(async () => { throw Error('old-CAS'); });
    const run = () => runMapsPlayerActionTransaction({ coordinator: new DmActionTransactionCoordinator(), action: action as never, run: async () => { await resumeSecondChancePersistentRoomParent(action as never, f.gateway, ui); await driveSecondChancePersistentRoomParent({ mapId: 'map', parentTransactionId: 'imported-parent', preparedOriginal: JSON.parse(JSON.stringify(original)) }, f.gateway, ui); }, waitForAuthorityCommit: oldCas, readOutcome: () => undefined, clearOutcome: () => { }, setTransactionActive: () => { }, recover, secondChanceSettlement: { gateway: f.gateway, onPublished: published } });
    await run();
    expect(recover.mock.calls).toEqual([]);
    expect(published).toHaveBeenCalledTimes(1);
    expect(oldCas).not.toHaveBeenCalled();
    const final = room().characters.find((row: any) => row.id === 'hero')!;
    expect(final.currentHp).toBe(26);
    expect(final.classResources!['test.second-chance:uses'].current).toBe(0);
    expect(Object.values((f.data().combat as SecondChanceCombat).secondChanceAttacks!)[0].parentContinuation?.phase).toBe('consumed');
    expect(room().characters.find((row: any) => row.id === caster.id)!.concentrating).toBe(false);
    const writes = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length;
    await run();
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(writes);
});
