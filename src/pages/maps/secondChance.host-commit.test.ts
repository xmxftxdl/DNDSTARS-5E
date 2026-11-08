import { secondChanceTestContent } from './secondChance.testFixture';
import { authorizeDnd5eSpellPlacement, dnd5eSpellPlacementQualified } from '../../rulesets/dnd5e/spellPlacementQualification';
import { collectDnd5eActivitySaveFactsV1, dnd5eHostSaveFactsV1 } from '../../rulesets/dnd5e/activities/dnd5eActivitySaveFacts';
import { afterEach, expect, it, vi } from 'vitest';
import { normalizeCharacter } from '../../store/characters';
import { syncCharacterClassResources } from '../../lib/classResources';
import { registerDnd5eRulesPlugin } from '../../rulesets/dnd5e/pluginApi';
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway';
import { commitSecondChanceHostAttack, type PersistedSecondChanceAttack, type SecondChanceCombat } from './secondChanceHostCommit';
import { publishSecondChanceParent, prepareSecondChanceParentCriticalDice } from './publishSecondChanceParent';
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eIncomingAttackRerollOptions } from '../../rulesets/dnd5e/headlessCombatEngine';
import { migrateMapsState } from '../../store/maps';
import { processSecondChanceRequest } from './processSecondChanceRequest';
import { stampPlayerActionStateForRoomMember, projectSecondChanceCombatForMember, validateSharedStateShape } from '../../../scripts/shared-server-core.mjs';
import { validateAndMigrateSharedResource } from '../../lib/sharedResourceValidation';
import { buildInitiativeOrder } from '../mapsPageHelpers';
import { recoverSecondChanceOnConfirmedInitiative } from '../../lib/secondChanceInitiativeRecovery';
import { issueSecondChanceAttack } from './issueSecondChanceAttack';
import { validateSecondChanceAttackReceipts } from '../../../shared/second-chance-state.mjs';
import { verifySecondChanceMapsSettlement, SecondChanceMapsSettlementSignal, type SecondChanceMapsSettlement } from './secondChanceMapsSettlement';
import { runMapsPlayerActionTransaction } from './runMapsPlayerActionTransaction';
import { DmActionTransactionCoordinator } from '../../lib/dmActionTransactionCoordinator';
import { driveSecondChancePersistentRoomParent, resumeSecondChancePersistentRoomParent } from './secondChancePersistentRoomDriver';
import { submitSecondChanceChoice, submitSecondChanceRoll, submitSecondChanceOwnedDiceResult, submitSecondChanceHostConfirmation } from '../../lib/secondChanceClientCommands';
import { createSecondChancePersistentRoomUI } from '../../lib/secondChancePersistentRoomUI';
import { createDmDiceConfirmationQueue } from '../../presentation/maps/dmDiceConfirmationQueue';
import { dmConfirmedFaces } from '../../presentation/maps/dmDiceMode';
import { prepareDnd5eEquipmentAttack, resolvePreparedDnd5eEquipmentAttack } from '../../rulesets/dnd5e/equipmentAttackAction';
import { DND5E_SHORTSWORD } from '../../rulesets/dnd5e/equipment';
import { captureSecondChancePreparedOriginal, readSecondChancePreparedOriginal, readSecondChancePreparedOriginalAsync, createSecondChancePreparedReplayAsync } from './secondChancePreparedParent';
import { encodeSecondChanceParentWire, decodeSecondChanceParentWire } from '../../lib/secondChanceParentWire';
import { authorizeDnd5eActivityTargetQualificationsV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityTargetQualifications';
const session = vi.hoisted(() => ({ current: { roomId: 'room', memberId: 'dm', role: 'dm' } }));
vi.mock('../../lib/roomSession', () => ({ getRoomSession: () => session.current }));
const disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0))
    dispose(); session.current = { roomId: 'room', memberId: 'dm', role: 'dm' }; });
function fixture(status: {
    outer?: 'full' | 'manual' | 'partial';
    inner?: 'full' | 'manual' | 'partial';
} = {}) {
    const content = structuredClone(secondChanceTestContent);
    const feat: import('../../rulesets/dnd5e/pluginApi').Dnd5ePluginFeatDefinition = { ...content.feats[0], automation: status.outer ?? 'full', resources: [{ id: 'uses', label: '花开二度', maximum: 1, resetOn: 'short-rest' }], declarativeAbility: { schemaVersion: 1, id: 'incoming-hit', name: '花开二度', description: content.feats[0].description, level: 1, trigger: { kind: 'after-d20-roll' }, targeting: { kind: 'self' }, effects: [], automation: status.inner ?? 'full', cost: { economy: 'reaction', resources: [{ resourceId: 'uses', amount: 1 }] }, mechanic: { kind: 'incoming-hit-attack-die-reroll' } } };
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
it('both actual server and client combat boundaries enforce the same persisted receipt validator', () => {
    const f = fixture(), combat = { ...f.data().combat as SecondChanceCombat };
    delete (combat as {
        _sync?: unknown;
    })._sync;
    expect(validateSharedStateShape('combat', combat).ok, JSON.stringify(validateSharedStateShape('combat', combat))).toBe(true);
    expect(validateAndMigrateSharedResource('combat', combat).status).not.toBe('invalid');
    f.receipt().attack.dice = [18];
    expect(validateSharedStateShape('combat', combat).ok).toBe(false);
    expect(validateAndMigrateSharedResource('combat', combat).status).toBe('invalid');
});
it('real registered feat ownership and class-resource authority commit reaction, resource and one parent continuation atomically', async () => {
    const f = fixture();
    const result = await commitSecondChanceHostAttack(f.input, f.gateway);
    expect(result).toMatchObject({ afterDice: [2, 17], adoptedD20: 17, total: 22, hit: true, critical: false });
    const chars = f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    };
    expect(chars.characters[0].classResources!['test.second-chance:uses'].current).toBe(0);
    expect((f.data().combat as SecondChanceCombat).dnd5eTurnEconomyByToken!['hero-token'].reaction.current).toBe(0);
    expect(f.receipt().parentContinuation).toMatchObject({ transactionId: 'parent', phase: 'ready' });
    expect(await commitSecondChanceHostAttack(f.input, f.gateway)).toEqual(result);
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1);
});
it('recovers exact persisted completion after a lost response without charging twice', async () => { const f = fixture(); f.loseReply(); expect((await commitSecondChanceHostAttack(f.input, f.gateway)).adoptedD20).toBe(17); await commitSecondChanceHostAttack(f.input, f.gateway); expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1); });
for (const boundary of ['owner', 'race-prerequisite', 'reaction-principal', 'roller-principal', 'map-revision', 'character-revision', 'turn', 'sight', 'reaction', 'resource'] as const)
    it(`rejects ${boundary} before any partial spend`, async () => {
        const f = fixture();
        const chars = f.data().characters as {
            characters: ReturnType<typeof normalizeCharacter>[];
            _sync: {
                revision: number;
            };
        };
        const combat = f.data().combat as SecondChanceCombat;
        if (boundary === 'owner')
            chars.characters[0].dnd5eFeatIds = [];
        if (boundary === 'race-prerequisite') {
            chars.characters[0].race = '人类';
            chars.characters[0].dnd5eRaceId = 'human';
        }
        if (boundary === 'reaction-principal')
            f.receipt().reactionDecision!.authenticatedMemberId = 'intruder';
        if (boundary === 'roller-principal') {
            f.receipt().rollerSelection!.authenticatedMemberId = 'player';
            f.receipt().rollerD20!.authenticatedMemberId = 'player';
        }
        if (boundary === 'map-revision')
            (f.data().maps as {
                _sync: {
                    revision: number;
                };
            })._sync.revision++;
        if (boundary === 'character-revision')
            chars._sync.revision++;
        if (boundary === 'turn')
            combat.dnd5eTurnEconomyByToken!['hero-token'].turnKey = 'later';
        if (boundary === 'sight')
            f.receipt().canSeeRoller = false;
        if (boundary === 'reaction')
            combat.dnd5eTurnEconomyByToken!['hero-token'].reaction.current = 0;
        if (boundary === 'resource')
            chars.characters[0].classResources!['test.second-chance:uses'].current = 0;
        const expected = { owner: 'owned-feature-required', 'race-prerequisite': 'owned-feature-required', 'reaction-principal': 'invalid-persisted-receipts', 'roller-principal': 'invalid-persisted-receipts', 'map-revision': 'stale-parent-snapshot', 'character-revision': 'stale-parent-snapshot', turn: 'stale-turn', sight: 'attacker-not-visible', reaction: 'reaction-unavailable', resource: 'resource-unavailable' }[boundary];
        await expect(commitSecondChanceHostAttack(f.input, f.gateway)).rejects.toThrow(`second-chance:${expected}`);
        expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled();
        expect(f.receipt().committed).toBeUndefined();
    });
it('CAS failure leaves both the resource and actual reaction untouched', async () => { const f = fixture(); f.gateway.saveResourcesAtomically = vi.fn(async () => { throw Error('state-transaction-conflict'); }); await expect(commitSecondChanceHostAttack(f.input, f.gateway)).rejects.toThrow('conflict'); expect((f.data().combat as SecondChanceCombat).dnd5eTurnEconomyByToken!['hero-token'].reaction.current).toBe(1); expect(f.receipt().committed).toBeUndefined(); });
it('requires a current authenticated Host room even for replay', async () => { const f = fixture(); session.current.role = 'player'; await expect(commitSecondChanceHostAttack(f.input, f.gateway)).rejects.toThrow('host-room-required'); expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled(); });
it('does not report a changed saved die-selection or feature as an already committed result', async () => {
    const f = fixture();
    await commitSecondChanceHostAttack(f.input, f.gateway);
    f.receipt().rollerD20!.value = 20;
    await expect(commitSecondChanceHostAttack(f.input, f.gateway)).rejects.toThrow('invalid-persisted-receipts');
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1);
});
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
it('publishes the real original attack HP and consumed continuation in the same CAS, once across reload and lost response', async () => {
    const f = fixture();
    attachRealParent(f);
    await commitSecondChanceHostAttack(f.input, f.gateway);
    f.loseReply();
    const result = await publishSecondChanceParent(f.input, f.gateway);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    const chars = f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    };
    expect(chars.characters[0].currentHp).toBe(26);
    expect(chars.characters[0].classResources!['test.second-chance:uses'].current).toBe(0);
    expect(f.receipt().parentContinuation?.phase).toBe('consumed');
    expect((f.data().combat as SecondChanceCombat).dnd5eTurnEconomyByToken!.orc.action.current).toBe(0);
    const replay = await publishSecondChanceParent(f.input, f.gateway);
    expect(replay).toEqual(result);
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(2);
    expect(result.events.filter(event => event.type === 'damage-applied')).toHaveLength(1);
    const finalWrites = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls[1][0];
    expect(finalWrites.map(write => write.name)).toEqual(['characters', 'maps', 'combat']);
});
it('leaves HP and continuation unchanged when the final parent CAS conflicts', async () => {
    const f = fixture();
    attachRealParent(f);
    await commitSecondChanceHostAttack(f.input, f.gateway);
    f.gateway.saveResourcesAtomically = vi.fn(async () => { throw Error('state-transaction-conflict'); });
    await expect(publishSecondChanceParent(f.input, f.gateway)).rejects.toThrow('conflict');
    expect((f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters[0].currentHp).toBe(30);
    expect(f.receipt().parentContinuation?.phase).toBe('ready');
});
it.each(['use', 'decline', 'disconnect-resume', 'normal-roll-cancel-resume', 'intruder-before-use'] as const)('one persistent room driver connects actual client append phases to Maps, real original HP, and consumed storage (%s)', async (decision) => {
    const f = fixture();
    attachRealParent(f);
    delete f.receipt().reactionDecision;
    delete f.receipt().rollerSelection;
    delete f.receipt().rollerD20;
    if (decision === 'normal-roll-cancel-resume') {
        f.receipt().attack.mode = 'normal';
        f.receipt().attack.dice = [18];
        const originalAction = f.receipt().parentInput!.action;
        if (!originalAction || originalAction.type !== 'attack')
            throw Error('expected attack');
        originalAction.mode = 'normal';
        delete originalAction.d20Second;
    }
    const original = structuredClone(f.receipt().parentInput!.action);
    const appendFor = (memberId: string) => ({ appendPlayerActionRequest: async (action: unknown) => {
            const prior = f.data()['player-action-requests'] as {
                requests: unknown[];
                _sync: {
                    revision: number;
                };
            } | undefined;
            const stamped = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [action] }, { memberId });
            f.data()['player-action-requests'] = { requests: [...(prior?.requests ?? []), ...stamped.requests], _sync: { revision: (prior?._sync.revision ?? 0) + 1 } };
        } });
    let disconnected = decision === 'disconnect-resume' || decision === 'normal-roll-cancel-resume';
    if (decision === 'intruder-before-use')
        await appendFor('intruder').appendPlayerActionRequest({ id: 'foreign-request', mapId: 'map', combatId: 'combat', type: 'dnd5e-second-chance', status: 'pending', actorTokenId: 'hero-token', characterId: 'hero', secondChance: { phase: 'reaction', attackReceiptId: 'attack', decision: 'use' } });
    const ui = { showChoice: async ({ context }: Parameters<import('./secondChancePersistentRoomDriver').SecondChancePersistentRoomUI['showChoice']>[0]) => {
            if (context.phase === 'select-die' && disconnected && decision === 'disconnect-resume')
                return;
            await submitSecondChanceChoice({ mapId: 'map', context, optionId: context.phase === 'reaction' ? decision === 'decline' ? 'decline' : context.featureId : 'die:0', round: 1, initiativeIndex: 0 }, appendFor(context.phase === 'reaction' ? 'player' : 'dm'));
        }, requestRoll: async ({ receipt, rollRequestId, supplement }: Parameters<import('./secondChancePersistentRoomDriver').SecondChancePersistentRoomUI['requestRoll']>[0]) => {
            if (disconnected)
                throw Error('combat-dice-cancelled');
            await submitSecondChanceRoll({ mapId: 'map', context: { attackReceiptId: receipt.attack.id, combatId: 'combat', actorTokenId: 'orc', characterId: 'monster', rollRequestId, count: supplement?.count ?? 1, sides: supplement?.sides ?? 20, supplementRequestId: supplement?.id }, values: supplement ? [5] : [2], round: 1, initiativeIndex: 0 }, appendFor('dm'));
        } };
    const oldCommit = vi.fn(async () => { throw Error('old-CAS'); }), published = vi.fn(async () => { }), recover = vi.fn(async () => { });
    const runBoundary = () => runMapsPlayerActionTransaction({ coordinator: new DmActionTransactionCoordinator(), action: { id: 'parent', mapId: 'map', combatId: 'combat', actorTokenId: 'orc', characterId: 'monster', type: 'dnd5e-weapon-attack' } as never, run: () => driveSecondChancePersistentRoomParent({ mapId: 'map', parentTransactionId: 'parent', action: original }, f.gateway, ui), waitForAuthorityCommit: oldCommit, readOutcome: () => undefined, clearOutcome: () => { }, setTransactionActive: () => { }, recover, secondChanceSettlement: { gateway: f.gateway, onPublished: published } });
    if (disconnected) {
        await runBoundary();
        expect(published).not.toHaveBeenCalled();
        expect(f.receipt().reactionDecision?.decision).toBe('use');
        expect(f.receipt().committed).toBeUndefined();
        expect((f.data().characters as {
            characters: ReturnType<typeof normalizeCharacter>[];
        }).characters[0].currentHp).toBe(30);
        disconnected = false;
    }
    await runBoundary();
    expect(recover).not.toHaveBeenCalled();
    expect(published).toHaveBeenCalledTimes(1);
    expect(oldCommit).not.toHaveBeenCalled();
    expect(f.receipt().parentContinuation?.phase).toBe('consumed');
    expect((f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters[0].currentHp).toBe(decision === 'normal-roll-cancel-resume' ? 30 : 26);
    expect((f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters[0].classResources!['test.second-chance:uses'].current).toBe(decision === 'decline' ? 1 : 0);
    expect((f.data().combat as SecondChanceCombat).dnd5eTurnEconomyByToken!.orc.attacksUsed).toBe(1);
    const writes = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length;
    await runBoundary();
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(writes);
});
it.each([false, true])('the concrete persistent owner UI, actual DM confirmation queue and player append chain upgrade the original attack with only its missing dice (override=%s)', async (override) => {
    const f = fixture();
    attachRealParent(f);
    delete f.receipt().reactionDecision;
    delete f.receipt().rollerSelection;
    delete f.receipt().rollerD20;
    f.receipt().hostControllerMemberId = 'dm';
    const chars = (f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters;
    chars[0].roomMemberId = 'player';
    const attacker = normalizeCharacter({ id: 'attacker-character', name: 'Attacker', roomMemberId: 'attacker-member', currentHp: 30, maxHp: 30 });
    chars.push(attacker);
    const map = (f.data().maps as {
        maps: ReturnType<typeof migrateMapsState>['maps'];
    }).maps[0];
    map.tokens.find((row: any) => row.id === 'orc')!.characterId = attacker.id;
    f.receipt().attack.rollerCharacterId = attacker.id;
    f.receipt().attack.rollerControllerMemberId = 'attacker-member';
    f.receipt().parentInput!.characterIdByCombatantId = { ...f.receipt().parentInput!.characterIdByCombatantId, orc: attacker.id };
    const appendFor = (memberId: string) => ({ appendPlayerActionRequest: async (action: unknown) => { const prior = f.data()['player-action-requests'] as {
            requests: unknown[];
            _sync: {
                revision: number;
            };
        } | undefined; const stamped = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [action] }, { memberId }); f.data()['player-action-requests'] = { requests: [...(prior?.requests ?? []), ...stamped.requests], _sync: { revision: (prior?._sync.revision ?? 0) + 1 } }; } });
    const clientGateway = { ...appendFor('attacker-member'), loadResource: async <T>(name: string) => name === 'combat' ? projectSecondChanceCombatForMember(f.data().combat, { memberId: 'attacker-member' }) as T : await f.gateway.loadResource<T>(name) };
    const postOwned = async (id: string, values: number[]) => { await submitSecondChanceOwnedDiceResult({ mapId: 'map', combatId: 'combat', requestId: id, characterId: attacker.id, values, round: 1, initiativeIndex: 0 }, clientGateway); return values; };
    const confirm = createDmDiceConfirmationQueue(async (request: any) => override ? [request.sides === 20 ? 20 : 6] : request.values);
    const rollD20 = vi.fn(async (_label, _target, owner) => { const raw = override ? 2 : 20; await postOwned(owner.durableRollRequestId, [raw]); return (await confirm({ id: owner.durableRollRequestId, label: 'Second Chance', targetName: 'Target', sides: 20, values: [raw], visibility: 'public', settleValues: values => dmConfirmedFaces(values, 'normal', 'normal', 1) }))[0]; }), rollDice = vi.fn(async (count, sides, _label, _target, owner) => { expect([count, sides]).toEqual([1, 6]); const raw = await postOwned(owner.durableRollRequestId, [5]); return confirm({ id: owner.durableRollRequestId, label: 'Critical supplement', targetName: 'Target', sides, values: raw, visibility: 'public' }); });
    const choose = vi.fn(async (request: any) => { const context = request.context.secondChance; const optionId = context.phase === 'reaction' ? context.featureId : 'die:0'; await submitSecondChanceChoice({ mapId: 'map', context, optionId, round: 1, initiativeIndex: 0 }, appendFor(context.phase === 'reaction' ? 'player' : 'attacker-member')); return optionId; });
    const ui = createSecondChancePersistentRoomUI({ map, characters: () => chars, choose, rollD20, rollDice, gateway: { ...f.gateway, ...appendFor('dm') }, round: () => 1, initiativeIndex: () => 0 });
    const published = vi.fn(async () => { }), oldCas = vi.fn(async () => { throw Error('old-CAS'); }), recover = vi.fn(async () => { });
    await runMapsPlayerActionTransaction({ coordinator: new DmActionTransactionCoordinator(), action: { id: 'parent', mapId: 'map', combatId: 'combat', actorTokenId: 'orc', characterId: attacker.id, type: 'dnd5e-weapon-attack' } as never, run: () => driveSecondChancePersistentRoomParent({ mapId: 'map', parentTransactionId: 'parent', action: f.receipt().parentInput!.action }, f.gateway, ui), waitForAuthorityCommit: oldCas, readOutcome: () => undefined, clearOutcome: () => { }, setTransactionActive: () => { }, recover, secondChanceSettlement: { gateway: f.gateway, onPublished: published } });
    expect(recover).not.toHaveBeenCalled();
    expect(published).toHaveBeenCalledTimes(1);
    expect(oldCas).not.toHaveBeenCalled();
    expect(rollD20).toHaveBeenCalledTimes(1);
    expect(rollDice).toHaveBeenCalledTimes(1);
    expect(f.receipt().reactionDecision?.authenticatedMemberId).toBe('player');
    expect(f.receipt().rollerD20?.authenticatedMemberId).toBe('attacker-member');
    expect(f.receipt().committed?.critical).toBe(true);
    expect(f.receipt().parentContinuation?.phase).toBe('consumed');
    expect(f.receipt().rollerD20?.value).toBe(override ? 2 : 20);
    expect(f.receipt().rollerConfirmation).toMatchObject({ authenticatedMemberId: 'dm', rawValue: override ? 2 : 20, value: 20 });
    expect(Object.values(f.receipt().criticalDiceConfirmations ?? {})[0]).toMatchObject({ authenticatedMemberId: 'dm', rawValues: [5], values: [override ? 6 : 5] });
    expect((f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters.find((row: any) => row.id === 'hero')!.currentHp).toBe(override ? 20 : 21);
});
for (const ownership of ['player', 'dm', 'foreign-owner', 'foreign-roller'] as const)
    it('real equipment prepared parent honors explicit ownership ' + ownership + ' across persistence', async () => {
        const controller = ownership === 'dm' ? 'dm' : 'attacker-member', defenderMemberId = ownership === 'dm' ? 'dm' : 'player';
        const f = fixture();
        attachRealParent(f);
        const chars = (f.data().characters as {
            characters: ReturnType<typeof normalizeCharacter>[];
        }).characters;
        chars[0].roomMemberId = defenderMemberId;
        chars[0].roomId = ownership === 'foreign-owner' ? 'foreign-room' : 'room';
        const attacker = normalizeCharacter({ id: 'attacker-character', name: 'Attacker', roomId: ownership === 'foreign-roller' ? 'foreign-room' : 'room', roomMemberId: controller, charClass: '战士', level: 4, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 }, currentHp: 30, maxHp: 30, equipment: { mainWeapon: DND5E_SHORTSWORD } });
        chars.push(attacker);
        const map = (f.data().maps as {
            maps: ReturnType<typeof migrateMapsState>['maps'];
        }).maps[0], token = map.tokens.find((row: any) => row.id === 'orc')!;
        token.type = 'player';
        token.characterId = attacker.id;
        const combat = f.data().combat as SecondChanceCombat;
        combat.secondChanceAttacks = undefined;
        const action = { id: 'prepared-parent', mapId: 'map', combatId: 'combat', type: 'dnd5e-weapon-attack', sourceMode: 'player', status: 'pending', actorTokenId: 'orc', characterId: attacker.id, targetTokenId: 'hero-token', round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
        const stampedParent = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [action] }, { memberId: controller });
        Object.assign(action, stampedParent.requests[0]);
        f.data()['player-action-requests'] = { ...stampedParent, _sync: { schemaVersion: 1, revision: 1, writerId: 'fixture-host', writtenAt: 1 } };
        const prepared = prepareDnd5eEquipmentAttack({ action: action as never, map, characters: chars, initiativeOrder: combat.initiativeOrder, attacksUsed: 0, turnEconomy: combat.dnd5eTurnEconomyByToken!.orc });
        expect(prepared.ok, prepared.ok ? '' : prepared.reason).toBe(true);
        if (!prepared.ok)
            throw Error('actual equipment preparation required');
        const originalInput = { prepared: prepared.prepared, d20: 18, damageRolls: [4] }, original = captureSecondChancePreparedOriginal(resolvePreparedDnd5eEquipmentAttack, originalInput);
        expect(original?.adapterId).toBe('equipment');
        if (!original)
            throw Error('actual facade identity required');
        expect(readSecondChancePreparedOriginal(original)).toEqual(originalInput);
        if (ownership.startsWith('foreign')) {
            await expect(issueSecondChanceAttack({ mapId: 'map', parentTransactionId: 'prepared-parent', preparedOriginal: original }, f.gateway)).rejects.toThrow('controller-identity-unavailable');
            expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled();
            expect(chars[0].currentHp).toBe(30);
            expect(chars[0].classResources!['test.second-chance:uses'].current).toBe(1);
            return;
        }
        const appendFor = (memberId: string) => ({ appendPlayerActionRequest: async (value: unknown) => { const prior = f.data()['player-action-requests'] as {
                requests: unknown[];
                _sync: {
                    revision: number;
                };
            } | undefined; const stamped = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [value] }, { memberId }); f.data()['player-action-requests'] = { requests: [...(prior?.requests ?? []), ...stamped.requests], _sync: { revision: (prior?._sync.revision ?? 0) + 1 } }; } });
        const ui = { showChoice: async ({ context }: Parameters<import('./secondChancePersistentRoomDriver').SecondChancePersistentRoomUI['showChoice']>[0]) => { await submitSecondChanceChoice({ mapId: 'map', context, optionId: context.phase === 'reaction' ? context.featureId : 'die:0', round: 1, initiativeIndex: 0 }, appendFor(context.phase === 'reaction' ? defenderMemberId : controller)); }, requestRoll: async ({ receipt, rollRequestId }: Parameters<import('./secondChancePersistentRoomDriver').SecondChancePersistentRoomUI['requestRoll']>[0]) => { const context = { attackReceiptId: receipt.attack.id, combatId: 'combat', actorTokenId: 'orc', characterId: attacker.id, rollRequestId, count: 1, sides: 20 }; await submitSecondChanceRoll({ mapId: 'map', context, values: [17], round: 1, initiativeIndex: 0 }, appendFor(controller)); await submitSecondChanceHostConfirmation({ mapId: 'map', context, values: [17], round: 1, initiativeIndex: 0 }, appendFor('dm')); } };
        const save = f.gateway.saveResourcesAtomically;
        f.gateway.saveResourcesAtomically = vi.fn(async (writes, options) => { if (writes.some((row: any) => row.name === 'maps'))
            f.loseReply(); return save(writes, options); });
        const published = vi.fn(async () => { }), oldCas = vi.fn(async () => { throw Error('old-CAS'); }), recover = vi.fn(async () => { });
        const run = () => runMapsPlayerActionTransaction({ coordinator: new DmActionTransactionCoordinator(), action: action as never, run: async () => { await resumeSecondChancePersistentRoomParent(action as never, f.gateway, ui); await driveSecondChancePersistentRoomParent({ mapId: 'map', parentTransactionId: 'prepared-parent', preparedOriginal: original }, f.gateway, ui); }, waitForAuthorityCommit: oldCas, readOutcome: () => undefined, clearOutcome: () => { }, setTransactionActive: () => { }, recover, secondChanceSettlement: { gateway: f.gateway, onPublished: published } });
        await run();
        expect(recover).not.toHaveBeenCalled();
        expect(published).toHaveBeenCalledTimes(1);
        expect(oldCas).not.toHaveBeenCalled();
        const receipt = Object.values((f.data().combat as SecondChanceCombat).secondChanceAttacks!)[0];
        expect(receipt.parentInput?.action).toBeUndefined();
        expect(receipt.parentInput?.prepared?.adapterId).toBe('equipment');
        expect(receipt.parentContinuation?.phase).toBe('consumed');
        const final = (f.data().characters as {
            characters: ReturnType<typeof normalizeCharacter>[];
        }).characters.find((row: any) => row.id === 'hero')!;
        expect(final.currentHp).toBe(23);
        expect(final.classResources!['test.second-chance:uses'].current).toBe(0);
        const writes = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length;
        await run();
        expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(writes);
        expect(oldCas).not.toHaveBeenCalled();
        await expect(resumeSecondChancePersistentRoomParent({ ...action, targetTokenId: 'foreign' } as never, f.gateway, ui)).rejects.toThrow('original-command-mismatch');
    });
it('the data codec preserves real containers and refuses an actually authorized Host brand instead of manufacturing it after JSON', () => {
    const shared = { value: 4 }, input = { first: shared, lookup: new Map([[shared, new Set([shared])]]), optional: undefined };
    const restored = decodeSecondChanceParentWire(encodeSecondChanceParentWire(input)) as typeof input;
    expect(restored.first).not.toBe(shared);
    expect(restored.lookup.get(restored.first)?.has(restored.first)).toBe(true);
    expect(Object.hasOwn(restored, 'optional')).toBe(true);
    const action = { actorId: 'orc', pluginId: 'actual-plugin', actionId: 'cast', transactionId: 'actual-parent', payload: { activityChoices: { choice: 'value' } } };
    authorizeDnd5eActivityTargetQualificationsV1(action, { orc: ['willing'] });
    expect(() => encodeSecondChanceParentWire({ prepared: { action } })).toThrow('capability-recovery-required');
});
it.each([false, true])('the persisted parent uses the actual full Flow for later critical cancellation and authenticates any missing dice (cancel=%s)', async (cancelCritical) => {
    const f = fixture();
    attachRealParent(f);
    f.receipt().rollerD20!.value = 20;
    f.receipt().hostControllerMemberId = 'dm';
    f.receipt().rollRequestId = 'original-roll';
    const namespace = 'test.persisted-critical-guard', featureId = namespace + ':guardian.cancel', resourceId = namespace + ':uses';
    disposers.push(registerDnd5eRulesPlugin({ manifest: { id: namespace, name: 'Actual guardian control', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Local', license: 'Private' }, setup(api) { api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'guardian', classId: 'cleric', name: 'Guardian', summary: 'Control', resources: [{ id: 'uses', label: 'Uses', maximum: { kind: 'fixed', value: 1 }, resetOn: 'long-rest' }], abilities: [{ schemaVersion: 1, id: 'cancel', name: 'Cancel', description: 'Control', level: 6, trigger: { kind: 'after-attack-roll' }, cost: { economy: 'reaction', resources: [{ resourceId: 'uses', amount: 1 }] }, targeting: { kind: 'single-creature', relation: 'ally', includeSelf: true, rangeFeet: 30, requiresSight: true }, mechanic: { kind: 'critical-hit-cancellation', protects: 'ally-or-self' }, effects: [], automation: 'partial' }] }); } }));
    const guard = syncCharacterClassResources(normalizeCharacter({ id: 'guard-character', name: 'Guard', charClass: '牧师', level: 6, dnd5eClassLevels: { cleric: 6 }, currentHp: 30, maxHp: 30, dnd5eClassChoices: { classes: { cleric: { subclass: namespace + ':guardian' } } }, dnd5ePluginFeatureIds: [featureId] }));
    expect(guard.classResources?.[resourceId]?.current, JSON.stringify(guard.classResources)).toBe(1);
    (f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters.push(guard);
    const parent = f.receipt().parentInput!, state = parent.state;
    state.combatants.guard = createDnd5eCombatant({ id: 'guard', name: 'Guard', controller: 'player', initiative: 5, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 }, proficiencyBonus: 3, armorClass: 16, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false, classId: 'cleric', classLevels: { cleric: 6 }, level: 6, pluginFeatureIds: [featureId], classResources: { [resourceId]: { current: 1, max: 1 } } });
    state.initiativeOrder = [...state.initiativeOrder, 'guard'];
    state.distanceFeetByCombatantPair = { 'guard\u0000hero-token': 5 };
    parent.characterIdByCombatantId = { ...parent.characterIdByCombatantId, guard: guard.id };
    const map = (f.data().maps as {
        maps: ReturnType<typeof migrateMapsState>['maps'];
    }).maps[0];
    map.tokens.push({ ...map.tokens.find((row: any) => row.id === 'hero-token')!, id: 'guard', characterId: guard.id, x: 75, y: 75 });
    const combat = f.data().combat as SecondChanceCombat;
    combat.initiativeOrder = [...combat.initiativeOrder, { tokenId: 'guard', slotId: 'guard:normal', label: 'Guard', roll: 5, color: '', emoji: '' }];
    combat.dnd5eTurnEconomyByToken!.guard = structuredClone(combat.dnd5eTurnEconomyByToken!['hero-token']);
    const append = { appendPlayerActionRequest: async (action: unknown) => { const prior = f.data()['player-action-requests'] as {
            requests: unknown[];
            _sync: {
                revision: number;
            };
        } | undefined; const stamped = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [action] }, { memberId: 'dm' }); f.data()['player-action-requests'] = { requests: [...(prior?.requests ?? []), ...stamped.requests], _sync: { revision: (prior?._sync.revision ?? 0) + 1 } }; } };
    let supplements = 0, offered = 0;
    const ui = { showChoice: async () => { throw Error('unexpected incoming UI'); }, requestRoll: async ({ receipt, rollRequestId, supplement }: Parameters<import('./secondChancePersistentRoomDriver').SecondChancePersistentRoomUI['requestRoll']>[0]) => { const context = { attackReceiptId: receipt.attack.id, combatId: 'combat', actorTokenId: 'orc', characterId: 'monster', rollRequestId, count: supplement?.count ?? 1, sides: supplement?.sides ?? 20, supplementRequestId: supplement?.id }; if (supplement) {
            supplements++;
            await submitSecondChanceRoll({ mapId: 'map', context, values: [5], round: 1, initiativeIndex: 0 }, append);
        } await submitSecondChanceHostConfirmation({ mapId: 'map', context, values: [supplement ? 5 : 20], round: 1, initiativeIndex: 0 }, append); }, prepareFollowups: async () => { const baseline = JSON.stringify([f.data().characters, f.data().maps]); return { combatRevision: (f.data().combat as {
                _sync: {
                    revision: number;
                };
            })._sync.revision, authorityUnchanged: () => JSON.stringify([f.data().characters, f.data().maps]) === baseline, confirm: async (request: any) => { if (request.activity.id === 'critical-cancellation') {
                offered++;
                expect(request.eventId).toContain('parent');
                return { accepted: cancelCritical };
            } return { accepted: false }; }, roll: async () => { throw Error('unexpected unrelated dice'); } }; } };
    const published = vi.fn(async () => { }), oldCas = vi.fn(async () => { throw Error('old-CAS'); }), recover = vi.fn(async () => { });
    const run = () => runMapsPlayerActionTransaction({ coordinator: new DmActionTransactionCoordinator(), action: { id: 'parent', mapId: 'map', combatId: 'combat', actorTokenId: 'orc', characterId: 'monster', type: 'dnd5e-weapon-attack' } as never, run: () => driveSecondChancePersistentRoomParent({ mapId: 'map', parentTransactionId: 'parent', action: parent.action }, f.gateway, ui), waitForAuthorityCommit: oldCas, readOutcome: () => undefined, clearOutcome: () => { }, setTransactionActive: () => { }, recover, secondChanceSettlement: { gateway: f.gateway, onPublished: published } });
    await run();
    expect(recover).not.toHaveBeenCalled();
    expect(published).toHaveBeenCalledTimes(1);
    expect(oldCas).not.toHaveBeenCalled();
    expect(offered).toBe(1);
    expect(supplements).toBe(cancelCritical ? 0 : 1);
    const current = (f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters;
    expect(current.find((row: any) => row.id === 'hero')!.currentHp).toBe(cancelCritical ? 26 : 21);
    expect(current.find((row: any) => row.id === guard.id)!.classResources![resourceId].current).toBe(cancelCritical ? 0 : 1);
    expect(f.receipt().parentContinuation?.phase).toBe('consumed');
    const writes = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length;
    await run();
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(writes);
    expect(offered).toBe(1);
});
it('actual DM confirmation cancellation after a persisted raw roll stays pending without cost or HP and resumes the same request', async () => {
    const f = fixture();
    attachRealParent(f);
    f.receipt().hostControllerMemberId = 'dm';
    f.receipt().rollRequestId = 'original-roll';
    await expect(commitSecondChanceHostAttack(f.input, f.gateway)).rejects.toThrow('original-roll-not-confirmed');
    const append = { appendPlayerActionRequest: async (action: unknown) => { const stamped = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [action] }, { memberId: 'dm' }); f.data()['player-action-requests'] = { ...stamped, _sync: { schemaVersion: 1, revision: 1, writerId: 'fixture-host', writtenAt: 1 } }; } };
    const pendingCore = createDmDiceConfirmationQueue(async () => new Promise<number[]>(() => { }));
    let cancel = true;
    const requestRoll = async ({ receipt, rollRequestId }: Parameters<import('./secondChancePersistentRoomDriver').SecondChancePersistentRoomUI['requestRoll']>[0]) => {
        if (cancel) {
            const values = pendingCore({ id: rollRequestId, label: 'Forced reroll', targetName: 'Target', sides: 20, values: [2], visibility: 'public' });
            pendingCore.cancelAll();
            await values;
            return;
        }
        const core = createDmDiceConfirmationQueue(async (request: any) => request.values), values = await core({ id: rollRequestId, label: 'Forced reroll', targetName: 'Target', sides: 20, values: [2], visibility: 'public' });
        await submitSecondChanceHostConfirmation({ mapId: 'map', context: { attackReceiptId: receipt.attack.id, combatId: 'combat', actorTokenId: 'orc', characterId: 'monster', rollRequestId, count: 1, sides: 20 }, values, round: 1, initiativeIndex: 0 }, append);
    };
    const published = vi.fn(async () => { }), oldCas = vi.fn(async () => { throw Error('old-CAS'); }), recover = vi.fn(async () => { });
    const run = () => runMapsPlayerActionTransaction({ coordinator: new DmActionTransactionCoordinator(), action: { id: 'parent', mapId: 'map', combatId: 'combat', actorTokenId: 'orc', characterId: 'monster', type: 'dnd5e-weapon-attack' } as never, run: () => driveSecondChancePersistentRoomParent({ mapId: 'map', parentTransactionId: 'parent', action: f.receipt().parentInput!.action }, f.gateway, { showChoice: async () => { throw Error('unexpected choice'); }, requestRoll }), waitForAuthorityCommit: oldCas, readOutcome: () => undefined, clearOutcome: () => { }, setTransactionActive: () => { }, recover, secondChanceSettlement: { gateway: f.gateway, onPublished: published } });
    await run();
    expect(published).not.toHaveBeenCalled();
    expect(f.receipt().rollerD20?.value).toBe(2);
    expect(f.receipt().rollerConfirmation).toBeUndefined();
    expect(f.receipt().committed).toBeUndefined();
    expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled();
    cancel = false;
    await run();
    expect(recover).not.toHaveBeenCalled();
    expect(published).toHaveBeenCalledTimes(1);
    expect(oldCas).not.toHaveBeenCalled();
    expect(f.receipt().rollerConfirmation).toMatchObject({ authenticatedMemberId: 'dm', rollRequestId: 'original-roll', rawValue: 2, value: 2 });
    expect(f.receipt().parentContinuation?.phase).toBe('consumed');
});
it('the actual Maps transaction boundary skips its old CAS only after the persisted original parent is verifiably consumed', async () => {
    const f = fixture();
    attachRealParent(f);
    const coordinator = new DmActionTransactionCoordinator();
    const action = { id: 'parent', mapId: 'map', combatId: 'combat', actorTokenId: 'orc', characterId: 'monster', type: 'dnd5e-weapon-attack' };
    const oldCommit = vi.fn(async () => { throw Error('old-authority-should-not-run'); }), onPublished = vi.fn(async () => { }), recover = vi.fn(async () => { });
    const run = async () => { await commitSecondChanceHostAttack(f.input, f.gateway); const result = await publishSecondChanceParent(f.input, f.gateway); throw new SecondChanceMapsSettlementSignal({ kind: 'second-chance-parent-published', mapId: 'map', combatId: 'combat', parentTransactionId: 'parent', attackReceiptId: 'attack', result }); };
    await runMapsPlayerActionTransaction({ coordinator, action: action as never, run, waitForAuthorityCommit: oldCommit, readOutcome: () => undefined, clearOutcome: () => { }, setTransactionActive: () => { }, recover, secondChanceSettlement: { gateway: f.gateway, onPublished } });
    expect(oldCommit).not.toHaveBeenCalled();
    expect(onPublished).toHaveBeenCalledTimes(1);
    expect(recover).not.toHaveBeenCalled();
    expect(f.receipt().parentContinuation?.phase).toBe('consumed');
    expect((f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters[0].currentHp).toBe(26);
    await runMapsPlayerActionTransaction({ coordinator: new DmActionTransactionCoordinator(), action: action as never, run, waitForAuthorityCommit: oldCommit, readOutcome: () => undefined, clearOutcome: () => { }, setTransactionActive: () => { }, recover, secondChanceSettlement: { gateway: f.gateway, onPublished } });
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(2);
    expect(oldCommit).not.toHaveBeenCalled();
});
it('Maps publication branch verifies the exact persisted consumed parent before skipping an outer stale commit', async () => {
    const f = fixture();
    attachRealParent(f);
    const pending: SecondChanceMapsSettlement = { kind: 'second-chance-parent-pending', mapId: 'map', combatId: 'combat', parentTransactionId: 'parent', attackReceiptId: 'attack' };
    expect((await verifySecondChanceMapsSettlement({ settlement: pending, mapId: 'map', combatId: 'combat', parentTransactionId: 'parent' }, f.gateway)).kind).toBe('second-chance-parent-pending');
    await commitSecondChanceHostAttack(f.input, f.gateway);
    const result = await publishSecondChanceParent(f.input, f.gateway), published: SecondChanceMapsSettlement = { ...pending, kind: 'second-chance-parent-published', result };
    expect((await verifySecondChanceMapsSettlement({ settlement: published, mapId: 'map', combatId: 'combat', parentTransactionId: 'parent' }, f.gateway)).kind).toBe('second-chance-parent-published');
    await expect(verifySecondChanceMapsSettlement({ settlement: published, mapId: 'map', combatId: 'combat', parentTransactionId: 'other-parent' }, f.gateway)).rejects.toThrow('parent-identity-mismatch');
    const altered = structuredClone(published);
    altered.result.state.combatants['hero-token'].currentHp = 30;
    await expect(verifySecondChanceMapsSettlement({ settlement: altered, mapId: 'map', combatId: 'combat', parentTransactionId: 'parent' }, f.gateway)).rejects.toThrow('unverified-publication');
    await expect(verifySecondChanceMapsSettlement({ settlement: pending, mapId: 'map', combatId: 'combat', parentTransactionId: 'parent' }, f.gateway)).rejects.toThrow('parent-no-longer-pending');
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(2);
});
it('uses the existing real server membership stamp for defender reaction and original roller choice, then commits and continues actual HP once', async () => {
    const f = fixture();
    attachRealParent(f);
    delete f.receipt().reactionDecision;
    delete f.receipt().rollerSelection;
    delete f.receipt().rollerD20;
    const append = (id: string, memberId: string, phase: object, dm = false) => { const action = { id, mapId: 'map', combatId: 'combat', type: 'dnd5e-second-chance', sourceMode: dm ? 'dm' : 'player', roomMemberId: 'forged-client-member', status: 'pending', actorTokenId: memberId === 'player' ? 'hero-token' : 'orc', characterId: memberId === 'player' ? 'hero' : 'monster', secondChance: { attackReceiptId: 'attack', ...phase } }; const stamped = dm ? { requests: [{ ...action, roomMemberId: 'dm' }] } : stampPlayerActionStateForRoomMember('player-action-requests', { requests: [action] }, { memberId }); f.data()['player-action-requests'] = { ...stamped, _sync: { schemaVersion: 1, revision: 1, writerId: 'fixture-host', writtenAt: 1 } }; return id; };
    await processSecondChanceRequest({ mapId: 'map', requestId: append('react', 'player', { phase: 'reaction', decision: 'use' }) }, f.gateway);
    expect(f.receipt().reactionDecision?.authenticatedMemberId).toBe('player');
    await processSecondChanceRequest({ mapId: 'map', requestId: append('choose', 'dm', { phase: 'select-die', dieIndex: 0 }, true) }, f.gateway);
    const requestId = f.receipt().rollRequestId;
    await processSecondChanceRequest({ mapId: 'map', requestId: append('roll', 'dm', { phase: 'roll-result', rollRequestId: requestId, value: 2 }, true) }, f.gateway);
    await commitSecondChanceHostAttack(f.input, f.gateway);
    const result = await publishSecondChanceParent(f.input, f.gateway);
    expect(result.state.combatants['hero-token'].currentHp).toBe(26);
    expect(f.receipt().processedRequestIds).toEqual(['react', 'choose', 'roll']);
    expect(f.receipt().parentContinuation?.phase).toBe('consumed');
});
it('a server-stamped intruder cannot borrow a forged defender principal or write a selection/d20 in the reaction command', async () => {
    const f = fixture();
    delete f.receipt().reactionDecision;
    delete f.receipt().rollerSelection;
    delete f.receipt().rollerD20;
    const action = { id: 'forge', mapId: 'map', combatId: 'combat', type: 'dnd5e-second-chance', status: 'pending', actorTokenId: 'hero-token', characterId: 'hero', roomMemberId: 'player', secondChance: { phase: 'reaction', attackReceiptId: 'attack', decision: 'use' } };
    const stamped = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [action] }, { memberId: 'intruder' });
    f.data()['player-action-requests'] = { ...stamped, _sync: { schemaVersion: 1, revision: 1, writerId: 'fixture-host', writtenAt: 1 } };
    await expect(processSecondChanceRequest({ mapId: 'map', requestId: 'forge' }, f.gateway)).rejects.toThrow('reaction-not-authorized');
    const own = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [{ ...action, secondChance: { ...action.secondChance, dieIndex: 0, value: 20 } }] }, { memberId: 'player' });
    f.data()['player-action-requests'] = { ...own, _sync: { schemaVersion: 1, revision: 1, writerId: 'fixture-host', writtenAt: 1 } };
    await expect(processSecondChanceRequest({ mapId: 'map', requestId: 'forge' }, f.gateway)).rejects.toThrow('invalid-reaction-command');
    expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled();
});
it('restores from an actual minted combat-start initiative roll once, retains the receipt through real normalization/reload, and refuses rank/manual/live-join substitutes', () => {
    const f = fixture();
    attachRealParent(f);
    const characters = (f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters;
    const hero = characters[0];
    hero.classResources!['test.second-chance:uses'].current = 0;
    const map = (f.data().maps as {
        maps: ReturnType<typeof migrateMapsState>['maps'];
    }).maps[0];
    const entry = buildInitiativeOrder(map.tokens, characters, { combatId: 'next-combat', phase: 'combat-start' }).find((row: any) => row.tokenId === 'hero-token')!;
    expect(entry.initiativeCalculation?.rolls).toHaveLength(1);
    const restored = recoverSecondChanceOnConfirmedInitiative(hero, 'next-combat', entry);
    expect(restored.classResources!['test.second-chance:uses'].current).toBe(1);
    const spent = normalizeCharacter(JSON.parse(JSON.stringify({ ...restored, classResources: { ...restored.classResources, 'test.second-chance:uses': { current: 0, max: 1 } } })));
    expect(recoverSecondChanceOnConfirmedInitiative(spent, 'next-combat', entry).classResources!['test.second-chance:uses'].current).toBe(0);
    const manual = { ...entry, initiativeCalculation: undefined };
    expect(recoverSecondChanceOnConfirmedInitiative(hero, 'next-combat', manual)).toBe(hero);
    const unstamped = { ...entry, initiativeRollReceipt: undefined };
    expect(recoverSecondChanceOnConfirmedInitiative(hero, 'next-combat', unstamped)).toBe(hero);
    const join = buildInitiativeOrder(map.tokens, characters, { combatId: 'next-combat', phase: 'live-join' }).find((row: any) => row.tokenId === 'hero-token')!;
    expect(recoverSecondChanceOnConfirmedInitiative(hero, 'next-combat', join)).toBe(hero);
    expect(recoverSecondChanceOnConfirmedInitiative(hero, 'wrong-combat', entry)).toBe(hero);
    const later = buildInitiativeOrder(map.tokens, characters, { combatId: 'later-combat', phase: 'combat-start' }).find((row: any) => row.tokenId === 'hero-token')!;
    expect(recoverSecondChanceOnConfirmedInitiative(spent, 'later-combat', later).classResources!['test.second-chance:uses'].current).toBe(1);
});
it('projects only a member’s bounded prompt and never the private original encounter or principals', () => {
    const f = fixture();
    attachRealParent(f);
    const combat = f.data().combat as SecondChanceCombat;
    for (const memberId of ['player', 'dm', 'bystander']) {
        const projected = projectSecondChanceCombatForMember(combat, { memberId });
        const text = JSON.stringify(projected);
        for (const privateKey of ['secondChanceAttacks', 'parentInput', 'authenticatedMemberId', 'canUseReaction', 'ownedFeatureIds'])
            expect(text).not.toContain(privateKey);
        expect(projected.secondChancePrompts).toHaveLength(memberId === 'bystander' ? 0 : 1);
        if (memberId === 'player')
            expect(projected.secondChancePrompts[0].dice).toBeUndefined();
        if (memberId === 'dm')
            expect(projected.secondChancePrompts[0].dice).toEqual([18, 17]);
    }
});
it('issues the immutable receipt from a real fresh room map snapshot and original Host action, not a player-supplied hit/visibility object', async () => {
    const f = fixture();
    attachRealParent(f);
    const original = f.receipt().parentInput!.action;
    const chars = f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    };
    chars.characters[0].roomMemberId = 'player';
    chars.characters[0].roomId = 'room';
    (f.data().combat as SecondChanceCombat).secondChanceAttacks = undefined;
    const receipt = await issueSecondChanceAttack({ mapId: 'map', parentTransactionId: 'issued-parent', action: original }, f.gateway);
    expect(receipt.attack).toMatchObject({ rollerTokenId: 'orc', targetTokenId: 'hero-token', targetCharacterId: 'hero', targetControllerMemberId: 'player', rollerControllerMemberId: 'dm', dice: [18, 17], mode: 'advantage' });
    expect(receipt.parentInput?.state.combatants['hero-token'].currentHp).toBe(30);
    expect(receipt.reactionDecision).toBeUndefined();
    expect(receipt.rollerD20).toBeUndefined();
    expect(receipt.canSeeRoller).toBe(true);
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1);
});
it('preserves native original transaction options and refuses a changed parent option on reload', async () => {
    const f = fixture();
    attachRealParent(f);
    const original = f.receipt().parentInput!.action;
    const chars = f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    };
    chars.characters[0].roomMemberId = 'player';
    chars.characters[0].roomId = 'room';
    (f.data().combat as SecondChanceCombat).secondChanceAttacks = undefined;
    const options = { transactionId: 'native-original-options', mapId: 'map', now: 12345 };
    const receipt = await issueSecondChanceAttack({ mapId: 'map', parentTransactionId: 'options-parent', action: original, options }, f.gateway);
    expect(receipt.parentInput?.options).toEqual(options);
    expect(await issueSecondChanceAttack({ mapId: 'map', parentTransactionId: 'options-parent', action: original, options }, f.gateway)).toEqual(receipt);
    await expect(issueSecondChanceAttack({ mapId: 'map', parentTransactionId: 'options-parent', action: original, options: { ...options, transactionId: 'changed' } }, f.gateway)).rejects.toThrow('parent-identity-mismatch');
});
it('a real reroll critical upgrade persists an exact missing-dice receipt, accepts only its original roller, and commits original HP once after reload', async () => {
    const f = fixture();
    attachRealParent(f);
    f.receipt().rollerD20!.value = 20;
    await commitSecondChanceHostAttack(f.input, f.gateway);
    const request = await prepareSecondChanceParentCriticalDice(f.input, f.gateway);
    expect(request).toMatchObject({ actorId: 'orc', targetId: 'hero-token', count: 1, sides: 6, originalRolls: [4] });
    if (!request)
        throw Error('expected actual parent missing critical dice');
    expect((f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters[0].currentHp).toBe(30);
    expect(await prepareSecondChanceParentCriticalDice(f.input, f.gateway)).toEqual(request);
    const command = { id: 'critical-result', mapId: 'map', combatId: 'combat', type: 'dnd5e-second-chance', status: 'pending', sourceMode: 'dm', roomMemberId: 'dm', actorTokenId: 'orc', characterId: 'monster', secondChance: { phase: 'critical-roll-result', attackReceiptId: 'attack', supplementRequestId: request.id, values: [5] } };
    f.data()['player-action-requests'] = { requests: [command], _sync: { schemaVersion: 1, revision: 1, writerId: 'fixture-host', writtenAt: 1 } };
    await processSecondChanceRequest({ mapId: 'map', requestId: 'critical-result' }, f.gateway);
    expect(validateSecondChanceAttackReceipts((f.data().combat as SecondChanceCombat).secondChanceAttacks)).toBe(true);
    f.loseReply();
    const result = await publishSecondChanceParent(f.input, f.gateway);
    expect(result.ok).toBe(true);
    expect(result.state.combatants['hero-token'].currentHp).toBe(21);
    expect((f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters[0].currentHp).toBe(21);
    expect(await publishSecondChanceParent(f.input, f.gateway)).toEqual(result);
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(4);
    expect(f.receipt().parentContinuation?.phase).toBe('consumed');
    expect(f.receipt().attack.phase).toBe('damage-committed');
    expect(result.events.filter(event => event.type === 'damage-applied')).toHaveLength(1);
});
it.each(['dice-count', 'foreign-parent', 'foreign-target-map', 'extra-host-field', 'false-principal', 'invalid-selection', 'resource-total'] as const)('strict persisted receipt validation refuses %s', async (boundary) => {
    const f = fixture();
    attachRealParent(f);
    if (boundary === 'dice-count')
        f.receipt().attack.dice = [18];
    if (boundary === 'foreign-parent')
        f.receipt().parentInput!.state.combatId = 'foreign';
    if (boundary === 'foreign-target-map')
        f.receipt().parentInput!.characterIdByCombatantId = { 'hero-token': 'other-character' };
    if (boundary === 'extra-host-field')
        Object.assign(f.receipt(), { playerSaysEligible: true });
    if (boundary === 'false-principal')
        f.receipt().reactionDecision!.authenticatedMemberId = 'intruder';
    if (boundary === 'invalid-selection')
        f.receipt().rollerSelection!.dieIndex = 9;
    if (boundary === 'resource-total') {
        await commitSecondChanceHostAttack(f.input, f.gateway);
        f.receipt().committed!.nextResourceCurrent = 1;
    }
    expect(validateSecondChanceAttackReceipts((f.data().combat as SecondChanceCombat).secondChanceAttacks)).toBe(false);
    await expect(commitSecondChanceHostAttack(f.input, f.gateway)).rejects.toThrow('invalid-persisted-receipts');
});
import { prepareDnd5ePluginSpellCast, resolvePreparedDnd5ePluginSpellCast, dnd5ePreparedSpellCastingProximityValid } from '../../rulesets/dnd5e/pluginSpellTransaction';
import { parseDnd5eUnifiedContentBundleV1, dnd5eRulesPluginFromUnifiedContentBundleV1 } from '../../rulesets/dnd5e/unifiedContent';
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability';
import { authorizeDnd5eActivityDmChoicesV1, dnd5eActivityDmChoicesAuthorizedV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityDmChoices';
import { dnd5eHostTargetQualificationsV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityTargetQualifications';
it.each([false, true].flatMap(placement => [17, 2, 20].map(reroll => ({ placement, reroll }))))('a genuinely parsed unified attack spell restores its actual Host brands, rerolls through the persistent Maps path and publishes HP exactly once (reroll=$reroll placement=$placement)', async ({ reroll, placement }) => {
    const f = fixture();
    attachRealParent(f);
    const namespace = 'test.second-chance-imported', spellId = namespace + ':ray', automation = automationCapabilityFromLegacyStatus('full');
    const parsed = parseDnd5eUnifiedContentBundleV1(JSON.stringify({ format: 'dndstars5e-unified-content', schemaVersion: 1, manifest: { id: namespace, name: 'Imported attack', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Local', license: 'Private' }, assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', id: 'ray', kind: 'spell', name: 'Ray', automation, payload: { id: 'ray', name: 'Ray', level: 0, school: 'evocation', ritual: false, castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 60 }, targeting: { relation: 'any', includeSelf: false, maximumTargets: 1 }, components: { verbal: false, somatic: false, material: false }, duration: { type: 'instantaneous', concentration: false }, classes: ['wizard'], description: 'Persistent imported attack integration fixture', automation: { mode: 'reference-only' } }, activities: [{ schemaVersion: 1, id: 'ray', name: 'Ray', castingConstraints: placement ? { maximumTargetDistanceFeet: 60 } : undefined, activation: { kind: 'action' }, target: placement ? { kind: 'area', relation: 'any', origin: 'point', shape: 'sphere', radiusFeet: 5, placeRangeFeet: 60, includeSelf: false, placementQualification: { prompt: 'Host verifies the chosen location' } } : { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60, requiredQualifications: [{ id: 'exposed', label: 'Exposed', audience: 'dm' }] }, checks: [{ id: 'attack', kind: 'attack-roll', rollId: 'attack-d20', attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } }, rollMode: 'host-derived', scope: 'per-target' }, { id: 'save', kind: 'saving-throw', rollId: 'save-d20', ability: 'wis', dc: { kind: 'constant', value: 12 }, rollMode: 'host-derived', scope: 'per-target', rollModeByHostFact: { id: 'distracted', label: 'Distracted', mode: 'disadvantage' } }], outcomes: [{ id: 'hit', when: { kind: 'check', checkId: 'attack', result: 'success' }, operations: [{ id: 'hurt', kind: 'damage', target: 'target', amount: { kind: 'dice', rollId: 'damage', count: 1, sides: 6 }, critical: 'double-dice', damageType: 'force', magical: true }] }], automation, legacySource: { kind: 'spell', id: 'ray' } }] }] }));
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
    const originalInput = { prepared: ready.prepared, currentRoom: { maps: [map], characters: chars }, rolls: { activityRolls: { 'save-d20:hero-token': { values: [13], modifier: 0, total: 13 }, 'attack-d20:hero-token': { values: [18], modifier: 0, total: 18 }, damage: { values: [4], modifier: 0, total: 4 } } } };
    const hostAction = ready.prepared.activityHeadlessAction!, activity = ready.prepared.activity!;
    if (placement)
        expect(await authorizeDnd5eSpellPlacement(ready.prepared, async () => true)).toBe(true);
    authorizeDnd5eActivityTargetQualificationsV1(hostAction, { 'hero-token': ['exposed'] });
    authorizeDnd5eActivityDmChoicesV1(hostAction, activity, originalInput.rolls.activityRolls);
    expect(await collectDnd5eActivitySaveFactsV1({ action: hostAction, activity, targets: ready.prepared.targetTokens, decide: async () => false })).toBe(true);
    const original = captureSecondChancePreparedOriginal(resolvePreparedDnd5ePluginSpellCast, originalInput)!;
    expect(original.adapterId).toBe('plugin-spell');
    const probe = (await createSecondChancePreparedReplayAsync(original)).run(ready.prepared.state);
    expect(probe.status, JSON.stringify(probe)).toBe('pending-incoming-attack');
    for (const principal of [{ roomId: 'room', memberId: 'player', role: 'player' }, { roomId: 'room', memberId: 'other-dm', role: 'dm' }, { roomId: 'foreign', memberId: 'dm', role: 'dm' }]) {
        session.current = principal;
        await expect(readSecondChancePreparedOriginalAsync(JSON.parse(JSON.stringify(original)))).rejects.toThrow('host-recovery-authority-required');
    }
    session.current = { roomId: 'room', memberId: 'dm', role: 'dm' };
    const restored = await readSecondChancePreparedOriginalAsync(JSON.parse(JSON.stringify(original))) as unknown as typeof originalInput;
    expect(dnd5eHostTargetQualificationsV1(restored.prepared.activityHeadlessAction!)).toEqual({ 'hero-token': ['exposed'] });
    expect(dnd5eActivityDmChoicesAuthorizedV1(restored.prepared.activityHeadlessAction!, activity, restored.rolls.activityRolls)).toBe(true);
    if (placement) {
        expect(ready.prepared.castingProximityReceipt).toBeTruthy();
        expect(dnd5eSpellPlacementQualified(restored.prepared)).toBe(true);
        expect(dnd5ePreparedSpellCastingProximityValid(restored.prepared, restored.prepared.map)).toBe(true);
    }
    expect(dnd5eHostSaveFactsV1(restored.prepared.activityHeadlessAction!)).toEqual({ 'hero-token': { distracted: false } });
    const missing = decodeSecondChanceParentWire(original.input) as {
        recovery: {
            saveFacts: Record<string, Record<string, boolean>>;
        };
    };
    delete missing.recovery.saveFacts['hero-token'].distracted;
    await expect(readSecondChancePreparedOriginalAsync({ ...original, input: encodeSecondChanceParentWire(missing) })).rejects.toThrow('save-fact-recovery-failed');
    expect(() => encodeSecondChanceParentWire(restored)).toThrow('capability-recovery-required');
    const appendFor = (memberId: string) => ({ appendPlayerActionRequest: async (value: unknown) => { const prior = f.data()['player-action-requests'] as {
            requests: unknown[];
            _sync: {
                revision: number;
            };
        }; const stamped = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [value] }, { memberId }); f.data()['player-action-requests'] = { requests: [...prior.requests, ...stamped.requests], _sync: { revision: prior._sync.revision + 1 } }; } });
    const ui = { showChoice: async ({ context }: Parameters<import('./secondChancePersistentRoomDriver').SecondChancePersistentRoomUI['showChoice']>[0]) => { await submitSecondChanceChoice({ mapId: 'map', context, optionId: context.phase === 'reaction' ? context.featureId : 'die:0', round: 1, initiativeIndex: 0 }, appendFor(context.phase === 'reaction' ? 'player' : 'caster-member')); }, requestRoll: async ({ receipt, rollRequestId, supplement }: Parameters<import('./secondChancePersistentRoomDriver').SecondChancePersistentRoomUI['requestRoll']>[0]) => { const context = { attackReceiptId: receipt.attack.id, combatId: 'combat', actorTokenId: 'orc', characterId: caster.id, rollRequestId, count: supplement?.count ?? 1, sides: supplement?.sides ?? 20, supplementRequestId: supplement?.id }; await submitSecondChanceRoll({ mapId: 'map', context, values: [supplement ? 5 : reroll], round: 1, initiativeIndex: 0 }, appendFor('caster-member')); await submitSecondChanceHostConfirmation({ mapId: 'map', context, values: [supplement ? 5 : reroll], round: 1, initiativeIndex: 0 }, appendFor('dm')); } };
    const published = vi.fn(async () => { }), recover = vi.fn(async () => { }), oldCas = vi.fn(async () => { throw Error('old-CAS'); });
    const run = () => runMapsPlayerActionTransaction({ coordinator: new DmActionTransactionCoordinator(), action: action as never, run: async () => { await resumeSecondChancePersistentRoomParent(action as never, f.gateway, ui); await driveSecondChancePersistentRoomParent({ mapId: 'map', parentTransactionId: 'imported-parent', preparedOriginal: JSON.parse(JSON.stringify(original)) }, f.gateway, ui); }, waitForAuthorityCommit: oldCas, readOutcome: () => undefined, clearOutcome: () => { }, setTransactionActive: () => { }, recover, secondChanceSettlement: { gateway: f.gateway, onPublished: published } });
    await run();
    expect(recover.mock.calls).toEqual([]);
    expect(published).toHaveBeenCalledTimes(1);
    expect(oldCas).not.toHaveBeenCalled();
    const final = (f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters.find((row: any) => row.id === 'hero')!;
    expect(final.currentHp).toBe(reroll === 2 ? 30 : reroll === 20 ? 21 : 26);
    expect(final.classResources!['test.second-chance:uses'].current).toBe(0);
    expect(Object.values((f.data().combat as SecondChanceCombat).secondChanceAttacks!)[0].parentContinuation?.phase).toBe('consumed');
    const writes = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length;
    await run();
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(writes);
});
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } from '../../rulesets/dnd5e/pluginFeatureAction';
import { getRegisteredDnd5eActivity } from '../../rulesets/dnd5e/activities/dnd5eActivityRegistry';
import { createDnd5ePreparedDamageCommitSession } from '../../rulesets/dnd5e/damageCommitSession';
import { captureSecondChancePluginFeatureBoundary } from './secondChancePluginFeatureBoundary';
it.each([false, true].flatMap(teleport => [17, 2, 20].map(reroll => ({ teleport, reroll }))))('the actual async feature facade suspends its actual worker and completes the full application after incoming reroll=$reroll teleport=$teleport', async ({ reroll, teleport }) => {
    const f = fixture();
    attachRealParent(f);
    const namespace = 'test.second-chance-async-feature', spellId = namespace + ':ray', automation = automationCapabilityFromLegacyStatus('full');
    const parsed = parseDnd5eUnifiedContentBundleV1(JSON.stringify({ format: 'dndstars5e-unified-content', schemaVersion: 1, manifest: { id: namespace, name: 'Imported attack', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Local', license: 'Private' }, assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', id: 'ray', kind: 'feature', name: 'Ray', automation, payload: { id: 'ray', name: 'Ray', summary: 'Async attack', description: 'Actual boundary fixture', automation: 'full' }, activities: [{ schemaVersion: 1, id: 'ray', name: 'Ray', usesAttackActionAttack: teleport || undefined, activation: { kind: teleport ? 'free' : 'action' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60, requiredQualifications: teleport ? undefined : [{ id: 'exposed', label: 'Exposed', audience: 'dm' }] }, checks: [{ id: 'attack', kind: 'attack-roll', rollId: 'attack-d20', attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } }, rollMode: 'host-derived', scope: 'per-target' }, ...(!teleport ? [{ id: 'save', kind: 'saving-throw', rollId: 'save-d20', ability: 'wis', dc: { kind: 'constant', value: 12 }, rollMode: 'host-derived', scope: 'per-target', rollModeByHostFact: { id: 'distracted', label: 'Distracted', mode: 'disadvantage' } }] : [])], outcomes: [{ id: 'hit', when: { kind: 'check', checkId: 'attack', result: 'success' }, operations: [{ id: 'hurt', kind: 'damage', target: 'target', amount: { kind: 'dice', rollId: 'damage', count: 1, sides: 6 }, critical: 'double-dice', damageType: 'force', magical: true }] }], automation, legacySource: { kind: 'feature', id: 'ray' } }] }] }));
    expect(parsed).toBeTruthy();
    if (!parsed)
        throw Error('actual unified parser rejected fixture');
    disposers.push(registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(parsed)));
    const stepId = 'test.second-chance-teleport:step';
    if (teleport)
        disposers.push(registerDnd5eRulesPlugin({ manifest: { id: 'test.second-chance-teleport', name: 'Actual teleport', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Local', license: 'Private' }, setup(api) { api.registerFeature({ id: 'step', name: 'Step', summary: 'Actual attack teleport', description: 'Actual attack teleport fixture', automation: 'full', declarativeAbility: { schemaVersion: 1, id: 'step', name: 'Step', description: 'Step', level: 1, trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full', mechanic: { kind: 'attack-action-teleport', rangeFeet: 10 } } }); } }));
    const chars = (f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters;
    chars[0].roomMemberId = 'player';
    chars[0].roomId = 'room';
    const caster = normalizeCharacter({ id: 'imported-caster', name: 'Caster', roomMemberId: 'caster-member', charClass: '法师', level: 1, abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 10, cha: 10 }, currentHp: 30, maxHp: 30, dnd5ePluginFeatureIds: teleport ? [spellId, stepId] : [spellId] });
    chars.push(caster);
    const map = (f.data().maps as {
        maps: ReturnType<typeof migrateMapsState>['maps'];
    }).maps[0], token = map.tokens.find((row: any) => row.id === 'orc')!;
    token.type = 'player';
    token.characterId = caster.id;
    const combat = f.data().combat as SecondChanceCombat;
    combat.secondChanceAttacks = undefined;
    const action = { id: 'imported-parent', mapId: 'map', combatId: 'combat', type: 'dnd5e-plugin-action', sourceMode: 'player', status: 'pending', actorTokenId: 'orc', characterId: caster.id, targetTokenId: 'hero-token', dnd5ePluginAction: { featureId: spellId, ...(teleport ? { attackActionTeleport: { targetCell: { col: 0, row: 1 } } } : {}) }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
    const parent = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [action] }, { memberId: 'caster-member' });
    Object.assign(action, parent.requests[0]);
    f.data()['player-action-requests'] = { ...parent, _sync: { schemaVersion: 1, revision: 1, writerId: 'fixture-host', writtenAt: 1 } };
    const ready = prepareDnd5ePluginFeatureAction({ action: action as never, map, characters: chars, initiativeOrder: combat.initiativeOrder, turnEconomy: combat.dnd5eTurnEconomyByToken!.orc });
    expect(ready.ok, JSON.stringify(ready)).toBe(true);
    if (!ready.ok)
        throw Error('real feature preparation required');
    const originalInput = { prepared: ready.prepared, combatRevision: 8, rolls: { 'save-d20:hero-token': { values: [13], modifier: 0, total: 13 }, 'attack-d20:hero-token': { values: [18], modifier: 0, total: 18 }, damage: { values: [4], modifier: 0, total: 4 } } };
    const hostAction = ready.prepared.headlessAction, activity = getRegisteredDnd5eActivity(hostAction.pluginId, hostAction.actionId)!;
    if (!teleport)
        authorizeDnd5eActivityTargetQualificationsV1(hostAction, { 'hero-token': ['exposed'] });
    authorizeDnd5eActivityDmChoicesV1(hostAction, activity, originalInput.rolls);
    if (!teleport)
        expect(await collectDnd5eActivitySaveFactsV1({ action: hostAction, activity, targets: ready.prepared.targetTokens, decide: async () => false })).toBe(true);
    if (teleport)
        expect(ready.prepared.attackActionTeleport).toBeTruthy();
    const boundary = captureSecondChancePluginFeatureBoundary(originalInput);
    const commit = createDnd5ePreparedDamageCommitSession({ prepared: { state: boundary.state } }, input => boundary.resolve(input.prepared.state), () => false);
    const pending = commit.run(boundary.state);
    expect(pending.status, JSON.stringify(pending)).toBe('pending-incoming-attack');
    if (pending.status !== 'pending-incoming-attack')
        throw Error('real async facade worker did not pause');
    let done = commit.resumeIncomingAttack(boundary.state, pending.occurrence, pending.facts, { featureId: 'test.second-chance:feat-second-chance', dieIndex: 0, newD20: reroll });
    if (done.status === 'pending-incoming-critical-dice')
        done = commit.resumeIncomingCriticalDice(boundary.state, done.request, [5]);
    expect(done.status, JSON.stringify(done)).toBe('resolved');
    if (done.status !== 'resolved')
        throw Error('actual worker unresolved');
    const facadeFinal = await boundary.complete(done.result);
    expect(facadeFinal.result.ok, JSON.stringify(facadeFinal.result)).toBe(true);
    expect(facadeFinal.application?.characters.find((row: any) => row.id === 'hero')?.currentHp).toBe(reroll === 2 ? 30 : reroll === 20 ? 21 : 26);
    if (teleport) {
        expect(facadeFinal.result.events.some(event => event.type === 'teleported')).toBe(true);
        expect(facadeFinal.application?.map.tokens.find((row: any) => row.id === 'orc')).toMatchObject({ x: 25, y: 75 });
    }
    expect(facadeFinal.result.state.combatants['hero-token'].classResources['test.second-chance:uses'].current).toBe(0);
    const aborted = captureSecondChancePluginFeatureBoundary(originalInput);
    await aborted.abort();
    await expect(aborted.complete(done.result)).rejects.toThrow('boundary-ended');
    const original = captureSecondChancePreparedOriginal(resolvePreparedDnd5ePluginFeatureAction, originalInput)!;
    expect(original.adapterId).toBe('plugin-feature');
    const appendFor = (memberId: string) => ({ appendPlayerActionRequest: async (value: unknown) => { const prior = f.data()['player-action-requests'] as {
            requests: unknown[];
            _sync: {
                revision: number;
            };
        }; const stamped = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [value] }, { memberId }); f.data()['player-action-requests'] = { requests: [...prior.requests, ...stamped.requests], _sync: { revision: prior._sync.revision + 1 } }; } });
    const ui: import('./secondChancePersistentRoomDriver').SecondChancePersistentRoomUI = { showChoice: async ({ context }: Parameters<import('./secondChancePersistentRoomDriver').SecondChancePersistentRoomUI['showChoice']>[0]) => { await submitSecondChanceChoice({ mapId: 'map', context, optionId: context.phase === 'reaction' ? context.featureId : 'die:0', round: 1, initiativeIndex: 0 }, appendFor(context.phase === 'reaction' ? 'player' : 'caster-member')); }, requestRoll: async ({ receipt, rollRequestId, supplement }: Parameters<import('./secondChancePersistentRoomDriver').SecondChancePersistentRoomUI['requestRoll']>[0]) => { const context = { attackReceiptId: receipt.attack.id, combatId: 'combat', actorTokenId: 'orc', characterId: caster.id, rollRequestId, count: supplement?.count ?? 1, sides: supplement?.sides ?? 20, supplementRequestId: supplement?.id }; await submitSecondChanceRoll({ mapId: 'map', context, values: [supplement ? 5 : reroll], round: 1, initiativeIndex: 0 }, appendFor('caster-member')); await submitSecondChanceHostConfirmation({ mapId: 'map', context, values: [supplement ? 5 : reroll], round: 1, initiativeIndex: 0 }, appendFor('dm')); } };
    ui.prepareFollowups = async () => { const baseline = JSON.stringify([f.data().characters, f.data().maps]); return { combatRevision: (f.data().combat as {
            _sync: {
                revision: number;
            };
        })._sync.revision, authorityUnchanged: () => JSON.stringify([f.data().characters, f.data().maps]) === baseline, confirm: async () => ({ accepted: false }), roll: async () => { throw Error('unexpected unrelated dice'); } }; };
    const published = vi.fn(async () => { }), recover = vi.fn(async () => { }), oldCas = vi.fn(async () => { throw Error('old-CAS'); });
    const run = () => runMapsPlayerActionTransaction({ coordinator: new DmActionTransactionCoordinator(), action: action as never, run: async () => { await resumeSecondChancePersistentRoomParent(action as never, f.gateway, ui); await driveSecondChancePersistentRoomParent({ mapId: 'map', parentTransactionId: 'imported-parent', preparedOriginal: JSON.parse(JSON.stringify(original)) }, f.gateway, ui); }, waitForAuthorityCommit: oldCas, readOutcome: () => undefined, clearOutcome: () => { }, setTransactionActive: () => { }, recover, secondChanceSettlement: { gateway: f.gateway, onPublished: published } });
    await run();
    expect(recover.mock.calls).toEqual([]);
    expect(published).toHaveBeenCalledTimes(1);
    expect(oldCas).not.toHaveBeenCalled();
    const final = (f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters.find((row: any) => row.id === 'hero')!;
    expect(final.currentHp).toBe(reroll === 2 ? 30 : reroll === 20 ? 21 : 26);
    expect(final.classResources!['test.second-chance:uses'].current).toBe(0);
    expect(Object.values((f.data().combat as SecondChanceCombat).secondChanceAttacks!)[0].parentContinuation?.phase).toBe('consumed');
    if (teleport)
        expect((f.data().maps as {
            maps: {
                tokens: {
                    id: string;
                    x: number;
                    y: number;
                }[];
            }[];
        }).maps[0].tokens.find((row: any) => row.id === 'orc')).toMatchObject({ x: 25, y: 75 });
    const writes = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length;
    await run();
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(writes);
});
import { activateDnd5ePluginSandbox, type Dnd5ePluginSandboxSession } from '../../rulesets/dnd5e/pluginSandbox';
import { resolveDnd5eDamageBoundaryWithMaterials } from '../../rulesets/dnd5e/damageReactionFlow';
it('the actual sandbox capability path deals direct damage without a rerollable attack or Second Chance spend', async () => {
    const f = fixture();
    attachRealParent(f);
    const pluginId = 'test.second-chance-worker', featureId = pluginId + ':pulse';
    const worker: Dnd5ePluginSandboxSession = { manifest: { id: pluginId, name: 'Sandbox exclusion proof', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Local', license: 'Private' }, features: [{ id: 'pulse', name: 'Pulse', summary: 'Direct effect', description: 'Actual closed capability effect', automation: 'full', action: { id: 'pulse', label: 'Pulse', economy: 'action', targeting: { kind: 'single-creature', relation: 'any', rangeFeet: 60 } } }], actions: [{ id: 'pulse' }], feats: [], races: [], backgrounds: [], abilityGenerationMethods: [], spells: [], items: [], monsters: [], resources: [], subclasses: [], migrations: [], resolve: async () => ({ ok: true, operations: [{ kind: 'deal-damage', targetId: 'hero-token', amount: 4, damageType: 'force' }] }), migrateState: async (fromVersion, state) => ({ state, fromVersion, toVersion: fromVersion }), terminate() { } };
    disposers.push(registerDnd5eRulesPlugin(activateDnd5ePluginSandbox(worker)));
    const chars = (f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters;
    const caster = normalizeCharacter({ id: 'worker-caster', name: 'Caster', charClass: '法师', level: 1, currentHp: 30, maxHp: 30, dnd5ePluginFeatureIds: [featureId] });
    chars.push(caster);
    const map = (f.data().maps as {
        maps: ReturnType<typeof migrateMapsState>['maps'];
    }).maps[0], actor = map.tokens.find((row: any) => row.id === 'orc')!;
    actor.type = 'player';
    actor.characterId = caster.id;
    const combat = f.data().combat as SecondChanceCombat;
    const action = { id: 'sandbox-parent', mapId: 'map', combatId: 'combat', type: 'dnd5e-plugin-action', sourceMode: 'player', status: 'pending', actorTokenId: 'orc', characterId: caster.id, targetTokenId: 'hero-token', dnd5ePluginAction: { featureId }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
    const ready = prepareDnd5ePluginFeatureAction({ action: action as never, map, characters: chars, initiativeOrder: combat.initiativeOrder });
    expect(ready.ok, JSON.stringify(ready)).toBe(true);
    if (!ready.ok)
        throw Error('actual sandbox prepare failed');
    const incoming = vi.fn(async () => undefined);
    const result = await resolvePreparedDnd5ePluginFeatureAction({ prepared: ready.prepared, resolveMaterialDamageBoundary: (state, resolve, succeeded) => resolveDnd5eDamageBoundaryWithMaterials({ combatRevision: 8, authorityUnchanged: () => true, confirm: async () => ({ accepted: false }), roll: async () => { throw Error('unexpected die'); }, chooseIncomingAttackReroll: incoming }, state, resolve, succeeded) });
    expect(result.result.ok, JSON.stringify(result.result)).toBe(true);
    expect(result.result.state.combatants['hero-token'].currentHp).toBe(26);
    expect(result.result.events.some(event => event.type === 'attack-resolved')).toBe(false);
    expect(incoming).not.toHaveBeenCalled();
    expect(result.result.state.combatants['hero-token'].classResources['test.second-chance:uses'].current).toBe(1);
    expect(result.result.state.combatants['hero-token'].turn.reactionAvailable).toBe(true);
});
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from '../../rulesets/dnd5e/items';
import { createDnd5eDamageReactionMaterialLedger } from '../../rulesets/dnd5e/damageReactionMaterialLedger';
import { dnd5eSpellMaterialConsumptionPlan } from '../../rulesets/dnd5e/spellMaterials';
it('preserves the actual native authority state and pre-consumed material application through the same parent CAS', async () => {
    const f = fixture();
    attachRealParent(f);
    const before = (f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters;
    before[0].roomMemberId = 'player';
    before[0].roomId = 'room';
    const granted = applyDnd5eInventoryMutation(before, { type: 'grant', characterId: 'hero', templateId: 'srd-5.1:item:gold-dust-25gp', quantity: 1 });
    expect(granted.ok).toBe(true);
    (f.data().characters as {
        characters: typeof before;
    }).characters = granted.characters;
    const baseline = granted.characters, owner = baseline.find((row: any) => row.id === 'hero')!, ledger = createDnd5eDamageReactionMaterialLedger({ 'hero-token': owner });
    const material = dnd5eSpellMaterialConsumptionPlan(owner, { label: 'Actual prelude', options: [{ label: 'Gold dust', components: [{ tag: 'gold-dust', label: 'Gold dust', quantity: 1, consumed: true }] }] })!;
    expect(material).toBeTruthy();
    ledger.settle('native-real-prelude', 'hero-token', material);
    const consumed = ledger.character('hero-token')!;
    expect(ledger.finish()).toHaveLength(1);
    const map = (f.data().maps as {
        maps: ReturnType<typeof migrateMapsState>['maps'];
    }).maps[0], state = f.receipt().parentInput!.state, action = f.receipt().parentInput!.action!;
    const nativeContext = { map, characters: baseline.map(row => row.id === 'hero' ? consumed : row), baselineCharacters: baseline, characterIdByCombatantId: { 'hero-token': 'hero' } };
    const combat = f.data().combat as SecondChanceCombat;
    combat.secondChanceAttacks = undefined;
    const parent = { id: 'native-prelude-parent', mapId: 'map', combatId: 'combat', actorTokenId: 'orc', characterId: 'monster', type: 'dnd5e-weapon-attack', sourceMode: 'dm', status: 'pending', round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
    const stamped = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [parent] }, { memberId: 'dm' });
    Object.assign(parent, stamped.requests[0]);
    f.data()['player-action-requests'] = { ...stamped, _sync: { schemaVersion: 1, revision: 1, writerId: 'fixture-host', writtenAt: 1 } };
    const appendFor = (memberId: string) => ({ appendPlayerActionRequest: async (value: unknown) => { const prior = f.data()['player-action-requests'] as {
            requests: unknown[];
            _sync: {
                revision: number;
            };
        }; const stamped = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [value] }, { memberId }); f.data()['player-action-requests'] = { requests: [...prior.requests, ...stamped.requests], _sync: { revision: prior._sync.revision + 1 } }; } });
    const ui: import('./secondChancePersistentRoomDriver').SecondChancePersistentRoomUI = { showChoice: async ({ context }) => { await submitSecondChanceChoice({ mapId: 'map', context, optionId: context.phase === 'reaction' ? context.featureId : 'die:0', round: 1, initiativeIndex: 0 }, appendFor(context.phase === 'reaction' ? 'player' : 'dm')); }, requestRoll: async ({ receipt, rollRequestId }) => { const context = { attackReceiptId: receipt.attack.id, combatId: 'combat', actorTokenId: 'orc', characterId: 'orc', rollRequestId, count: 1, sides: 20 }; await submitSecondChanceRoll({ mapId: 'map', context, values: [2], round: 1, initiativeIndex: 0 }, appendFor('dm')); await submitSecondChanceHostConfirmation({ mapId: 'map', context, values: [2], round: 1, initiativeIndex: 0 }, appendFor('dm')); }, prepareFollowups: async () => { const baseline = JSON.stringify([f.data().characters, f.data().maps]); return { combatRevision: (f.data().combat as {
                _sync: {
                    revision: number;
                };
            })._sync.revision, authorityUnchanged: () => JSON.stringify([f.data().characters, f.data().maps]) === baseline, confirm: async () => ({ accepted: false }), roll: async () => { throw Error('unexpected dice'); } }; } };
    const published = vi.fn(async () => { }), recover = vi.fn(async () => { });
    const run = () => runMapsPlayerActionTransaction({ coordinator: new DmActionTransactionCoordinator(), action: parent as never, run: async () => { await resumeSecondChancePersistentRoomParent(parent as never, f.gateway, ui); await driveSecondChancePersistentRoomParent({ mapId: 'map', parentTransactionId: parent.id, action, state, nativeContext }, f.gateway, ui); }, waitForAuthorityCommit: async () => { throw Error('old-CAS'); }, readOutcome: () => undefined, clearOutcome: () => { }, setTransactionActive: () => { }, recover, secondChanceSettlement: { gateway: f.gateway, onPublished: published } });
    await run();
    expect(recover.mock.calls).toEqual([]);
    expect(published).toHaveBeenCalledTimes(1);
    const final = (f.data().characters as {
        characters: typeof before;
    }).characters.find((row: any) => row.id === 'hero')!;
    expect(final.currentHp).toBe(26);
    expect(final.classResources!['test.second-chance:uses'].current).toBe(0);
    expect(normalizeDnd5eInventory(final).entries.some(row => row.templateId === 'srd-5.1:item:gold-dust-25gp')).toBe(false);
    const receipt = Object.values((f.data().combat as SecondChanceCombat).secondChanceAttacks!)[0];
    expect(receipt.parentInput!.state).toEqual(state);
    expect(receipt.parentInput!.nativeContext).toEqual(nativeContext);
    expect(receipt.parentContinuation?.phase).toBe('consumed');
    const writes = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length;
    await run();
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(writes);
    await expect(issueSecondChanceAttack({ mapId: 'map', parentTransactionId: parent.id, action, state: { ...state, round: 2 }, nativeContext }, f.gateway)).rejects.toThrow('parent-identity-mismatch');
});
import { compileDnd5eActivityHeadlessAction } from '../../rulesets/dnd5e/activities/dnd5eActivityHeadlessCompiler';
import { registerDnd5eActivityPackage } from '../../rulesets/dnd5e/activities/dnd5eActivityRegistry';
it.each(['same-owner-decline-then-use', 'same-owner-advantage', 'two-owners', 'second-roll-cancel-resume', 'two-owners-first-critical', 'critical-then-second-roll-cancel-resume'] as const)('one actual original compiled parent settles multiple genuine incoming occurrences exactly once (%s)', async (mode) => {
    const f = fixture();
    attachRealParent(f);
    const chars = (f.data().characters as {
        characters: ReturnType<typeof normalizeCharacter>[];
    }).characters;
    chars[0].roomMemberId = 'player';
    chars[0].roomId = 'room';
    const map = (f.data().maps as {
        maps: ReturnType<typeof migrateMapsState>['maps'];
    }).maps[0], combat = f.data().combat as SecondChanceCombat;
    combat.secondChanceAttacks = undefined;
    const two = !mode.startsWith('same-owner'), critical = mode.includes('critical'), advantage = mode === 'same-owner-advantage';
    if (two) {
        const second = normalizeCharacter({ ...structuredClone(chars[0]), id: 'second-hero', name: 'Second hero', roomMemberId: 'second-player' });
        chars.push(second);
        map.tokens.push({ ...structuredClone(map.tokens.find((row: any) => row.id === 'hero-token')!), id: 'second-token', characterId: second.id, x: 75, y: 75 });
        combat.initiativeOrder = [...combat.initiativeOrder, { tokenId: 'second-token', slotId: 'second-token:normal', label: 'Second', roll: 5, color: '', emoji: '' }];
        combat.dnd5eTurnEconomyByToken!['second-token'] = structuredClone(combat.dnd5eTurnEconomyByToken!['hero-token']);
    }
    const pluginId = 'test.second-chance-multiple', activity: import('../../rulesets/dnd5e/activities/dnd5eActivityContracts').Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'multi', name: 'Actual two incoming attacks', activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: two ? 2 : 1, rangeFeet: 60 }, automation: automationCapabilityFromLegacyStatus('full'), checks: two ? [{ id: 'first', kind: 'attack-roll', rollId: 'first-d20', attackBonus: { kind: 'constant', value: 5 }, rollMode: 'normal', scope: 'per-target' }] : [{ id: 'first', kind: 'attack-roll', rollId: 'first-d20', attackBonus: { kind: 'constant', value: 5 }, rollMode: 'normal', scope: 'per-target' }, { id: 'second', kind: 'attack-roll', rollId: 'second-d20', attackBonus: { kind: 'constant', value: 5 }, rollMode: advantage ? 'advantage' : 'normal', scope: 'per-target' }], outcomes: two ? [{ id: 'first-hit', when: { kind: 'check', checkId: 'first', result: 'success' }, operations: [{ id: 'hurt-first', kind: 'damage', target: 'target', amount: critical ? { kind: 'dice', rollId: 'damage', count: 1, sides: 6 } : { kind: 'constant', value: 4 }, critical: critical ? 'double-dice' : undefined, damageType: 'force' }] }] : [{ id: 'first-hit', when: { kind: 'check', checkId: 'first', result: 'success' }, operations: [{ id: 'hurt-first', kind: 'damage', target: 'target', amount: critical ? { kind: 'dice', rollId: 'damage', count: 1, sides: 6 } : { kind: 'constant', value: 4 }, critical: critical ? 'double-dice' : undefined, damageType: 'force' }] }, { id: 'second-hit', when: { kind: 'check', checkId: 'second', result: 'success' }, operations: [{ id: 'hurt-second', kind: 'damage', target: 'target', amount: critical ? { kind: 'dice', rollId: 'damage', count: 1, sides: 6 } : { kind: 'constant', value: 4 }, critical: critical ? 'double-dice' : undefined, damageType: 'force' }] }] };
    const registration = registerDnd5eActivityPackage({ packageId: pluginId, packageVersion: '1.0.0', activities: [activity] });
    disposers.push(() => registration.dispose());
    disposers.push(registerDnd5eRulesPlugin({ manifest: { id: pluginId, name: 'Actual multiple attack parent', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Local', license: 'Private' }, setup(api) { api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity)); } }));
    const action = { type: 'plugin' as const, pluginId, actionId: 'multi', actorId: 'orc', targetId: 'hero-token', targetIds: two ? ['hero-token', 'second-token'] : ['hero-token'], rolls: { ...(critical ? { damage: { values: [4], modifier: 0, total: 4 } } : {}), 'first-d20:hero-token': { values: [18], modifier: 0, total: 18 }, ...(two ? { 'first-d20:second-token': { values: [18], modifier: 0, total: 18 } } : { 'second-d20:hero-token': { values: advantage ? [18, 17] : [18], modifier: 0, total: advantage ? 35 : 18 } }) } };
    const parent = { id: 'multi-parent', mapId: 'map', combatId: 'combat', actorTokenId: 'orc', characterId: 'monster', type: 'dnd5e-plugin-action', sourceMode: 'dm', status: 'pending', round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
    const stamped = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [parent] }, { memberId: 'dm' });
    Object.assign(parent, stamped.requests[0]);
    f.data()['player-action-requests'] = { ...stamped, _sync: { schemaVersion: 1, revision: 1, writerId: 'fixture-host', writtenAt: 1 } };
    const appendFor = (memberId: string) => ({ appendPlayerActionRequest: async (value: unknown) => { const prior = f.data()['player-action-requests'] as {
            requests: unknown[];
            _sync: {
                revision: number;
            };
        }; const stamped = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [value] }, { memberId }); f.data()['player-action-requests'] = { requests: [...prior.requests, ...stamped.requests], _sync: { revision: prior._sync.revision + 1 } }; } });
    let cancelled = mode.includes('cancel-resume'), choices = 0, rolls = 0;
    const ui: import('./secondChancePersistentRoomDriver').SecondChancePersistentRoomUI = { showChoice: async ({ receipt, context }) => { choices++; await submitSecondChanceChoice({ mapId: 'map', context, optionId: context.phase === 'reaction' ? !two && receipt.incomingOccurrence === 0 ? 'decline' : context.featureId : 'die:0', round: 1, initiativeIndex: 0 }, appendFor(context.phase === 'reaction' ? receipt.attack.targetControllerMemberId : 'dm')); }, requestRoll: async ({ receipt, rollRequestId, supplement }) => { if (cancelled && receipt.incomingOccurrence === 1 && !supplement)
            throw Error('combat-dice-cancelled'); rolls++; const value = supplement ? 5 : two && receipt.attack.targetTokenId === 'hero-token' ? critical ? 20 : 17 : critical ? 17 : 2, context = { attackReceiptId: receipt.attack.id, combatId: 'combat', actorTokenId: 'orc', characterId: 'orc', rollRequestId, count: supplement?.count ?? 1, sides: supplement?.sides ?? 20, supplementRequestId: supplement?.id }; await submitSecondChanceRoll({ mapId: 'map', context, values: [value], round: 1, initiativeIndex: 0 }, appendFor('dm')); await submitSecondChanceHostConfirmation({ mapId: 'map', context, values: [value], round: 1, initiativeIndex: 0 }, appendFor('dm')); }, prepareFollowups: async () => { const baseline = JSON.stringify([f.data().characters, f.data().maps]); return { combatRevision: (f.data().combat as {
                _sync: {
                    revision: number;
                };
            })._sync.revision, authorityUnchanged: () => JSON.stringify([f.data().characters, f.data().maps]) === baseline, confirm: async () => ({ accepted: false }), roll: async () => { throw Error('unexpected unrelated die'); } }; } };
    const published = vi.fn(async () => { }), recover = vi.fn(async () => { }), oldCas = vi.fn(async () => { throw Error('old-CAS'); });
    const run = () => runMapsPlayerActionTransaction({ coordinator: new DmActionTransactionCoordinator(), action: parent as never, run: async () => { await resumeSecondChancePersistentRoomParent(parent as never, f.gateway, ui); await driveSecondChancePersistentRoomParent({ mapId: 'map', parentTransactionId: parent.id, action }, f.gateway, ui); }, waitForAuthorityCommit: oldCas, readOutcome: () => undefined, clearOutcome: () => { }, setTransactionActive: () => { }, recover, secondChanceSettlement: { gateway: f.gateway, onPublished: published } });
    if (cancelled) {
        await run();
        expect(recover.mock.calls).toEqual([]);
        expect(published).not.toHaveBeenCalled();
        const current = (f.data().characters as {
            characters: typeof chars;
        }).characters;
        expect(current.find((row: any) => row.id === 'hero')!.currentHp).toBe(30);
        expect(current.find((row: any) => row.id === 'hero')!.classResources!['test.second-chance:uses'].current).toBe(0);
        expect(current.find((row: any) => row.id === 'second-hero')!.classResources!['test.second-chance:uses'].current).toBe(1);
        cancelled = false;
    }
    await run();
    expect(recover.mock.calls).toEqual([]);
    expect(published).toHaveBeenCalledTimes(1);
    expect(oldCas).not.toHaveBeenCalled();
    const final = (f.data().characters as {
        characters: typeof chars;
    }).characters;
    expect(final.find((row: any) => row.id === 'hero')!.currentHp).toBe(critical ? 21 : advantage ? 22 : 26);
    expect(final.find((row: any) => row.id === 'hero')!.classResources!['test.second-chance:uses'].current).toBe(0);
    if (two) {
        expect(final.find((row: any) => row.id === 'second-hero')!.currentHp).toBe(critical ? 26 : 30);
        expect(final.find((row: any) => row.id === 'second-hero')!.classResources!['test.second-chance:uses'].current).toBe(0);
    }
    const receipts = Object.values((f.data().combat as SecondChanceCombat).secondChanceAttacks!).sort((a, b) => a.incomingOccurrence! - b.incomingOccurrence!);
    expect(receipts).toHaveLength(2);
    expect(receipts.map(row => row.incomingOccurrence)).toEqual([0, 1]);
    expect(receipts.every(row => row.parentContinuation?.phase === 'consumed')).toBe(true);
    if (advantage)
        expect(receipts[1].committed?.afterDice).toEqual([2, 17]);
    if (critical) {
        expect(Object.keys(receipts[0].criticalDiceConfirmations ?? {})).toHaveLength(1);
        expect(rolls).toBe(3);
    }
    const writes = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length, windows = choices, dice = rolls;
    await run();
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(writes);
    expect(choices).toBe(windows);
    expect(rolls).toBe(dice);
    const costs = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.filter(([, options]) => options?.transactionId?.startsWith('second-chance:'));
    expect(costs).toHaveLength(two ? 2 : 1);
});
for (const status of [{ outer: 'manual' }, { outer: 'partial' }, { inner: 'manual' }, { inner: 'partial' }] as const)
    it('does not execute automatic Second Chance for registered ' + JSON.stringify(status), async () => {
        const f = fixture(status);
        attachRealParent(f);
        const state = f.receipt().parentInput!.state, event = { type: 'attack-resolved' as const, actorId: 'orc', targetId: 'hero-token', hit: true, critical: false, total: 23, d20: 18, armorClass: 16 };
        expect(dnd5eIncomingAttackRerollOptions(state, event as never)).toEqual([]);
        const hero = (f.data().characters as any).characters[0], entry = buildInitiativeOrder((f.data().maps as any).maps[0].tokens, [hero], { combatId: 'new-start', phase: 'combat-start' }).find((row: any) => row.tokenId === 'hero-token')!;
        hero.classResources['test.second-chance:uses'].current = 0;
        expect(recoverSecondChanceOnConfirmedInitiative(hero, 'new-start', entry).classResources!['test.second-chance:uses'].current).toBe(0);
        hero.classResources['test.second-chance:uses'].current = 1;
        await expect(commitSecondChanceHostAttack(f.input, f.gateway)).rejects.toThrow('owned-feature-required');
        expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled();
    });
for (const status of [{ outer: 'manual' }, { outer: 'partial' }] as const)
    it('refuses a persisted full parent after outer status alone is downgraded ' + status.outer, async () => {
        const f = fixture();
        attachRealParent(f);
        f.receipt().featureDefinitionSignature = JSON.stringify((await import('../../rulesets/dnd5e/plugins/pluginContentCatalog')).dnd5ePluginFeatureDefinition(f.receipt().featureId)!.declarativeAbility);
        disposers.pop()!();
        fixture(status);
        await expect(commitSecondChanceHostAttack(f.input, f.gateway)).rejects.toThrow('owned-feature-required');
        expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled();
        expect((f.data().characters as any).characters[0].classResources['test.second-chance:uses'].current).toBe(1);
    });
it('does not publish a ready full replacement after outer status is downgraded', async () => { const f = fixture(); attachRealParent(f); await commitSecondChanceHostAttack(f.input, f.gateway); const before = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length; disposers.pop()!(); fixture({ outer: 'manual' }); await expect(publishSecondChanceParent(f.input, f.gateway)).rejects.toThrow('automatic-feature-required'); expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(before); expect((f.data().characters as any).characters[0].currentHp).toBe(30); });
for (const sample of [{ race: 'halfling' }, { race: 'human' }, { race: 'halfling', status: { outer: 'manual' } }, { race: 'halfling', status: { outer: 'partial' } }, { race: 'halfling', status: { inner: 'manual' } }, { race: 'halfling', status: { inner: 'partial' } }] as const)
    it('uses actual Map equipment preparation and runtime source entitlement for ' + JSON.stringify(sample), () => {
        const race = sample.race, status = 'status' in sample ? sample.status : {};
        const f = fixture(status);
        attachRealParent(f);
        const chars = (f.data().characters as any).characters;
        chars[0].dnd5eRaceId = race;
        chars[0].race = race === 'human' ? '人类' : '半身人';
        chars[0].classResources['test.second-chance:uses'] = { current: 1, max: 1 };
        const attacker = normalizeCharacter({ id: 'attacker-character', name: 'Attacker', charClass: '战士', level: 4, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 }, currentHp: 30, maxHp: 30, equipment: { mainWeapon: DND5E_SHORTSWORD } });
        chars.push(attacker);
        const map = (f.data().maps as any).maps[0], token = map.tokens.find((row: any) => row.id === 'orc');
        token.type = 'player';
        token.characterId = attacker.id;
        const combat = f.data().combat as SecondChanceCombat, action = { id: 'source-entitlement', mapId: 'map', combatId: 'combat', type: 'dnd5e-weapon-attack', sourceMode: 'player', status: 'pending', actorTokenId: 'orc', characterId: attacker.id, targetTokenId: 'hero-token', round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
        const prepared = prepareDnd5eEquipmentAttack({ action: action as never, map, characters: chars, initiativeOrder: combat.initiativeOrder, attacksUsed: 0, turnEconomy: combat.dnd5eTurnEconomyByToken!.orc });
        expect(prepared.ok).toBe(true);
        if (!prepared.ok)
            throw Error('actual equipment prep required');
        const input = { prepared: prepared.prepared, d20: 18, damageRolls: [4] }, run = createDnd5ePreparedDamageCommitSession(input, resolvePreparedDnd5eEquipmentAttack, () => false).run(prepared.prepared.state);
        expect(run.status).toBe(race === 'halfling' && !('status' in sample) ? 'pending-incoming-attack' : 'resolved');
        if (run.status === 'resolved') {
            expect(run.result.result.ok).toBe(true);
            expect(run.result.result.state.combatants['hero-token'].currentHp).toBe(23);
            expect(run.result.result.state.combatants['hero-token'].turn.reactionAvailable).toBe(true);
        }
        expect(chars[0].classResources['test.second-chance:uses'].current).toBe(1);
    });
for (const status of [{ outer: 'manual' }, { outer: 'partial' }, { inner: 'manual' }, { inner: 'partial' }] as const)
    it('does not reopen a stored pending automatic prompt after registered status downgrade ' + JSON.stringify(status), async () => { const f = fixture(); attachRealParent(f); delete f.receipt().reactionDecision; delete f.receipt().rollerSelection; delete f.receipt().rollerD20; disposers.pop()!(); fixture(status); const ui = { showChoice: vi.fn(async () => { }), requestRoll: vi.fn(async () => { }) }; await expect(driveSecondChancePersistentRoomParent({ mapId: 'map', parentTransactionId: 'parent', action: f.receipt().parentInput!.action }, f.gateway, ui)).rejects.toThrow('automatic-feature-required'); expect(ui.showChoice).not.toHaveBeenCalled(); expect(ui.requestRoll).not.toHaveBeenCalled(); expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled(); });

it('SC real first-round defender without a lazy economy can issue and consume the original parent once',async()=>{
 const f=fixture();attachRealParent(f);const original=f.receipt().parentInput!.action,owner=(f.data().characters as {characters:ReturnType<typeof normalizeCharacter>[]}).characters[0];owner.roomMemberId='player';owner.roomId='room';const combat=f.data().combat as SecondChanceCombat;combat.secondChanceAttacks=undefined;delete combat.dnd5eTurnEconomyByToken!['hero-token'];const attacker=structuredClone(combat.dnd5eTurnEconomyByToken!.orc)
 const issued=await issueSecondChanceAttack({mapId:'map',parentTransactionId:'first-round-lazy',action:original},f.gateway)
 expect(issued.turnKey).toBe('combat:1:hero-token');expect((f.data().combat as SecondChanceCombat).dnd5eTurnEconomyByToken!.orc).toEqual(attacker);expect((f.data().combat as SecondChanceCombat).dnd5eTurnEconomyByToken!['hero-token'].reaction.current).toBe(1)
 const saved=(f.data().combat as SecondChanceCombat).secondChanceAttacks![issued.attack.id];saved.reactionDecision={authenticatedMemberId:'player',decision:'use'};saved.rollerSelection={authenticatedMemberId:'dm',dieIndex:0};saved.rollerD20={authenticatedMemberId:'dm',dieIndex:0,value:2};saved.rollRequestId='first-round-roll';saved.rollerConfirmation={authenticatedMemberId:'dm',rollRequestId:'first-round-roll',rawValue:2,value:2}
 await commitSecondChanceHostAttack({mapId:'map',attackReceiptId:saved.attack.id},f.gateway);await publishSecondChanceParent({mapId:'map',attackReceiptId:saved.attack.id},f.gateway)
 expect((f.data().combat as SecondChanceCombat).secondChanceAttacks![saved.attack.id].parentContinuation?.phase).toBe('consumed');expect((f.data().combat as SecondChanceCombat).dnd5eTurnEconomyByToken!['hero-token'].reaction.current).toBe(0)
 const finalOwner=(f.data().characters as {characters:ReturnType<typeof normalizeCharacter>[]}).characters[0];expect(finalOwner.currentHp).toBe(26);expect(finalOwner.classResources!['test.second-chance:uses'].current).toBe(0);expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(3);await commitSecondChanceHostAttack({mapId:'map',attackReceiptId:saved.attack.id},f.gateway);await publishSecondChanceParent({mapId:'map',attackReceiptId:saved.attack.id},f.gateway);expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(3)
})
it('SC lazy first-round handling never restores an existing spent reaction or ignores another unrelated missing pool',async()=>{
 const f=fixture();attachRealParent(f);const original=f.receipt().parentInput!.action,owner=(f.data().characters as {characters:ReturnType<typeof normalizeCharacter>[]}).characters[0];owner.roomMemberId='player';owner.roomId='room';const combat=f.data().combat as SecondChanceCombat;combat.secondChanceAttacks=undefined;combat.dnd5eTurnEconomyByToken!['hero-token'].reaction.current=0;delete combat.dnd5eTurnEconomyByToken!.orc
 await expect(issueSecondChanceAttack({mapId:'map',parentTransactionId:'existing-spent',action:original},f.gateway)).rejects.toThrow('second-chance-issue:incoming-hit-not-awaiting-choice');expect((f.data().combat as SecondChanceCombat).dnd5eTurnEconomyByToken!['hero-token'].reaction.current).toBe(0);expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
})

it('projects a real second ordinary Attack in the same final CAS and never adds the count again on reload',async()=>{
 const f=fixture();attachRealParent(f);const parent=f.receipt().parentInput!,action=parent.action
 if(action?.type!=='attack')throw Error('real attack expected')
 const first=resolveDnd5eHeadlessAction(parent.state,{...action,d20:1,d20Second:1})
 expect(first.ok,JSON.stringify(first)).toBe(true);expect(first.state.combatants.orc.classState.attackActionHistory?.attacksTaken).toBe(1)
 parent.state=first.state;action.spendAction=false
 const combat=f.data().combat as SecondChanceCombat;combat.dnd5eTurnEconomyByToken!.orc.attacksUsed=1;combat.dnd5eTurnEconomyByToken!.orc.action.current=0
 await commitSecondChanceHostAttack(f.input,f.gateway);f.loseReply();const result=await publishSecondChanceParent(f.input,f.gateway)
 expect(result.state.combatants.orc.classState.attackActionHistory?.attacksTaken).toBe(2)
 expect((f.data().combat as SecondChanceCombat).dnd5eTurnEconomyByToken!.orc.attacksUsed).toBe(2)
 expect((f.data().combat as SecondChanceCombat).dnd5eTurnEconomyByToken!['hero-token'].attacksUsed).toBe(0)
 const writes=vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length;expect(await publishSecondChanceParent(f.input,f.gateway)).toEqual(result)
 expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(writes);expect((f.data().combat as SecondChanceCombat).dnd5eTurnEconomyByToken!.orc.attacksUsed).toBe(2)
})

it('does not count a real bonus-action attack as an ordinary Attack action',async()=>{
 const f=fixture();attachRealParent(f);const action=f.receipt().parentInput!.action
 if(action?.type!=='attack')throw Error('attack required');action.spendAction=false;action.spendBonusAction=true
 await commitSecondChanceHostAttack(f.input,f.gateway);const result=await publishSecondChanceParent(f.input,f.gateway)
 expect(result.ok,JSON.stringify(result)).toBe(true);expect(result.state.combatants.orc.classState.attackActionHistory).toBeUndefined()
 const economy=(f.data().combat as SecondChanceCombat).dnd5eTurnEconomyByToken!.orc
 expect(economy.attacksUsed).toBe(0);expect(economy.bonusAction.current).toBe(0);expect(economy.action.current).toBe(1)
})
it('derives the count from the real original resolver, ignoring client count claims and old-turn history',async()=>{
 const f=fixture();attachRealParent(f);const parent=f.receipt().parentInput!
 Object.assign(parent.action!,{attacksUsed:99,attackNumber:99})
 parent.state.combatants.orc.classState.attackActionHistory={turnKey:'expired-turn',actionOrdinal:9,attacksTaken:99,creatureTargetIds:[],restricted:false,bonusAttacksTakenThisTurn:50}
 await commitSecondChanceHostAttack(f.input,f.gateway);const result=await publishSecondChanceParent(f.input,f.gateway)
 expect(result.ok,JSON.stringify(result)).toBe(true);expect(result.state.combatants.orc.classState.attackActionHistory?.attacksTaken).toBe(1)
 expect((f.data().combat as SecondChanceCombat).dnd5eTurnEconomyByToken!.orc.attacksUsed).toBe(1)
})
