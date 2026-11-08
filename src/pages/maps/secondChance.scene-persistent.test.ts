import {resumeSecondChanceHostLocalParent} from './secondChanceHostLocalRecovery'
import { secondChanceTestContent } from './secondChance.testFixture';
import { afterEach, expect, it, vi } from 'vitest';
import { normalizeCharacter, mergePlayerWritableCharacter } from '../../store/characters';
import { syncCharacterClassResources, updateClassResource } from '../../lib/classResources';
import { migrateMapsState } from '../../store/maps';
import { normalizeSharedCampaignTime } from '../../lib/campaignTime';
import { mutateCampaignTimeState, stampPlayerActionStateForRoomMember, mergePlayerCharactersStateForAuthority, projectCharactersForRoomMember, projectSecondChanceCombatForMember, validateSharedStateShape } from '../../../scripts/shared-server-core.mjs';
import { validateAndMigrateSharedResource } from '../../lib/sharedResourceValidation';
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability';
import { registerDnd5eRulesPlugin } from '../../rulesets/dnd5e/pluginApi';
import { dnd5eRulesPluginFromUnifiedContentBundleV1 } from '../../rulesets/dnd5e/unifiedContent';
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction, prepareDnd5ePluginRestFeatureCasting, refreshDnd5ePluginRestFeatureCasting } from '../../rulesets/dnd5e/pluginFeatureAction';
import { armDnd5eLongCasting } from '../../rulesets/dnd5e/longCastingContinuity';
import { captureDnd5eCompletedRestCastingWitness, restoreDnd5eCompletedRestCastingWitness } from '../../rulesets/dnd5e/restActivityCastingWindow';
import { dnd5eSpellAuthorityResolutionContext } from './spellSettlementCoordinator';
import type { Dnd5eActivityDefinitionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts';
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway';
import { captureSecondChancePreparedOriginal, createSecondChancePreparedReplayAsync, readSecondChancePreparedOriginalAsync } from './secondChancePreparedParent';
import { runMapsPlayerActionTransaction } from './runMapsPlayerActionTransaction';
import { DmActionTransactionCoordinator } from '../../lib/dmActionTransactionCoordinator';
import { driveSecondChancePersistentRoomParent, resumeSecondChancePersistentRoomParent, type SecondChancePersistentRoomUI } from './secondChancePersistentRoomDriver';
import { submitSecondChanceChoice, submitSecondChanceRoll, submitSecondChanceHostConfirmation, submitSecondChanceOwnedDiceResult } from '../../lib/secondChanceClientCommands';
import { createSecondChancePersistentRoomUI } from '../../lib/secondChancePersistentRoomUI';
import { createDmDiceConfirmationQueue } from '../../presentation/maps/dmDiceConfirmationQueue';
import type { SecondChanceCombat } from './secondChanceHostCommit';
import { issueSecondChanceAttack } from './issueSecondChanceAttack';
import { createDnd5eMapCombatSnapshot } from '../../rulesets/dnd5e/mapBridge';
import { resolveDnd5eHeadlessAction } from '../../rulesets/dnd5e/headlessCombatEngine';
import { applyDnd5eShortRestBenefits, applyDnd5eLongRestBenefits, reconcileDnd5eCharacterCampaignTime } from '../../rulesets/dnd5e/campaignTimeRules';
import { validateSecondChanceAttackReceipts } from '../../../shared/second-chance-state.mjs';
const session = vi.hoisted(() => ({ current: { roomId: 'room', memberId: 'dm', role: 'dm' } }));
vi.mock('../../lib/roomSession', () => ({ getRoomSession: () => session.current }));
const disposers: (() => void)[] = [];
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); session.current = { roomId: 'room', memberId: 'dm', role: 'dm' }; });
function setup(timed = false,hostLocal=false) {
    const content = structuredClone(secondChanceTestContent), feat: import('../../rulesets/dnd5e/pluginApi').Dnd5ePluginFeatDefinition = { ...content.feats[0], automation: 'full', resources: [{ id: 'uses', label: '花开二度', maximum: 1, resetOn: 'short-rest' }], declarativeAbility: { schemaVersion: 1, id: 'incoming-hit', name: '花开二度', description: content.feats[0].description, level: 1, trigger: { kind: 'after-d20-roll' }, targeting: { kind: 'self' }, effects: [], automation: 'full', cost: { economy: 'reaction', resources: [{ resourceId: 'uses', amount: 1 }] }, mechanic: { kind: 'incoming-hit-attack-die-reroll' } } };
    disposers.push(registerDnd5eRulesPlugin({ manifest: { id: 'test.second-chance', name: 'Second Chance', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) { api.registerFeat(feat); } }));
    let owner = normalizeCharacter({ id: 'hero', name: 'Hero', roomId: hostLocal?undefined:'room', roomMemberId: hostLocal?undefined:'caster-member', currentHp: 20, maxHp: 20, dnd5eWorldTimeAppliedMinute: 480, dnd5ePluginFeatureIds: ['test.rest-boundary:rest-strike'] });
    const target = syncCharacterClassResources(normalizeCharacter({ id: 'target', name: 'Target', roomId: 'room', roomMemberId: 'player', race: '半身人', dnd5eRaceId: 'halfling', charClass: '战士', level: 4, currentHp: 20, maxHp: 20, dnd5eFeatIds: ['test.second-chance:second-chance'] }));
    const started = mutateCampaignTimeState(null, { operation: 'start-rest-session', id: 'rest-1', kind: 'short-rest', characterIds: ['hero'], expectedWorldMinute: 480 }, 1, { memberId: 'dm', role: 'dm' }, { host: { memberId: 'dm', role: 'dm' }, restCharacterIds: ['hero'] });
    if (!started.ok)
        throw Error('real rest start required');
    let clock = normalizeSharedCampaignTime(started.next);
    const automation = automationCapabilityFromLegacyStatus('full');
    if (timed) {
        const completion = mutateCampaignTimeState(clock, { operation: 'complete-rest-session', id: 'rest-1', expectedWorldMinute: 480 }, 2, { memberId: 'dm', role: 'dm' }, { host: { memberId: 'dm', role: 'dm' }, restCharacterIds: ['hero'] });
        if (!completion.ok)
            throw Error('actual rest completion required:' + JSON.stringify(completion));
        clock = normalizeSharedCampaignTime(completion.next);
        owner = reconcileDnd5eCharacterCampaignTime(owner, clock).character;
    }
    const map = migrateMapsState({ maps: [{ id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, tokens: [{ id: 'hero', characterId: 'hero', type: 'player', label: 'Hero', x: 25, y: 25 }, { id: 'target', characterId: 'target', type: 'player', label: 'Target', x: 75, y: 25 }] }] }).maps[0];
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'rest-strike', name: 'Rest strike', activation: { kind: 'free' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 }, legacySource: { kind: 'feature', id: 'rest-strike' }, automation, invocation: { kind: 'triggered', event: 'short-rest-started', confirmation: 'actor-choice', retention: 'single-event' }, checks: [{ id: 'attack', kind: 'attack-roll', rollId: 'attack-d20', attackBonus: { kind: 'constant', value: 5 }, rollMode: 'host-derived', scope: 'per-target' }], outcomes: [{ id: 'hit', when: { kind: 'check', checkId: 'attack', result: 'success' }, operations: [{ id: 'hurt', kind: 'damage', target: 'target', amount: { kind: 'dice', rollId: 'damage', count: 1, sides: 6 }, critical: 'double-dice', damageType: 'force' }] }] };
    if (timed) {
        activity.activation = { kind: 'minute', value: 1 };
        activity.invocation = { kind: 'triggered', event: 'short-rest-complete', confirmation: 'actor-choice', retention: 'single-event' };
    }
    disposers.push(registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1({ format: 'dndstars5e-unified-content', schemaVersion: 1, manifest: { id: 'test.rest-boundary', name: 'Rest boundary', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [], definitions: [{ schemaVersion: 1, id: 'rest-strike', name: 'Rest strike', namespace: 'test.rest-boundary', version: '1.0.0', kind: 'feature', automation, payload: { id: 'rest-strike', name: 'Rest strike', summary: 'Test', description: 'Test', automation: 'full', ...(timed ? { action: { id: 'rest-strike', label: 'Rest strike', economy: 'none', targeting: { kind: 'single-creature', relation: 'any', rangeFeet: 60 } } } : {}) }, activities: [activity] }] })));
    const action = { id: 'real-rest-parent', mapId: 'map', sourceMode: hostLocal?'dm' as const:'player' as const, status: 'pending' as const, type: 'dnd5e-plugin-action' as const, actorTokenId: 'hero', characterId: 'hero', targetTokenId: 'target', targetTokenIds: ['target'], round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1, dnd5ePluginAction: { featureId: 'test.rest-boundary:rest-strike', payload: { selectedActivityId: 'rest-strike', restEventId: 'rest-start:rest-1' } } };
    if (timed)
        action.dnd5ePluginAction.payload.restEventId = owner.dnd5eRestActivityWindow!.eventId;
    const authority = dnd5eSpellAuthorityResolutionContext({ combatActive: false, map, actorTokenId: 'hero', initiativeOrder: [] }), ready = prepareDnd5ePluginFeatureAction({ map, characters: [owner, target], initiativeOrder: authority.initiativeOrder, worldMinute: clock.worldMinute, action });
    expect(ready.ok, JSON.stringify(ready)).toBe(true);
    if (!ready.ok)
        throw Error('real prepared rest attack required');
    let original = captureSecondChancePreparedOriginal(resolvePreparedDnd5ePluginFeatureAction, { prepared: ready.prepared, restAuthority: { clock, combatRevision: 8 }, rolls: { 'attack-d20:target': { values: [18] }, damage: { values: [4] } } })!;
    const stamped = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [action] }, { memberId: 'caster-member' });
    if(!hostLocal)Object.assign(action, stamped.requests[0]);
    let data: Record<string, any> = { characters: { characters: [owner, target], _sync: { schemaVersion: 1, revision: 4, writerId: 'fixture-host', writtenAt: 1 } }, maps: { maps: [map], _sync: { schemaVersion: 1, revision: 7, writerId: 'fixture-host', writtenAt: 1 } }, combat: { mapId: 'old-map', combatId: 'old-combat', active: false, round: 9, initiativeIndex: 0, initiativeOrder: [], updatedAt: 1, _sync: { schemaVersion: 1, revision: 8, writerId: 'fixture-host', writtenAt: 1 } }, 'campaign-time': { ...clock, _sync: { schemaVersion: 1, revision: 1, writerId: 'fixture-host', writtenAt: 1 } }, 'player-action-requests': { ...stamped, ...(hostLocal?{requests:[]}:{}), _sync: { schemaVersion: 1, revision: 1, writerId: 'fixture-host', writtenAt: 1 } } };
    const sync = (revision: number, writerId = 'dm') => ({ schemaVersion: 1, revision, writerId, writtenAt: 1 });
    for (const row of Object.values(data))
        row._sync = sync(row._sync.revision);
    let loseFinalReply = false;
    const gateway: Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'> = {
        loadResource: async <T>(name: string) => structuredClone(data[name]) as T,
        saveResourcesAtomically: vi.fn(async (writes, options) => {
            for (const write of writes)
                if (write.expectedRevision !== data[write.name]?._sync.revision)
                    throw Error('state-transaction-conflict');
            for (const [name, revision] of Object.entries(options?.readRevisions ?? {}))
                if (revision !== (data[name]?._sync.revision ?? 0))
                    throw Error('state-transaction-conflict');
            const next = structuredClone(data);
            for (const write of writes) {
                const value = { ...write.data as object, _sync: sync((data[write.name]?._sync.revision ?? 0) + 1) }, valid = validateSharedStateShape(write.name, value);
                if (!valid.ok)
                    throw Error('real-server-validation:' + JSON.stringify(valid));
                next[write.name] = value;
            }
            data = next;
            if (loseFinalReply && writes.some((row: any) => row.name === 'characters')) {
                loseFinalReply = false;
                throw Error('Failed to fetch');
            }
            ;
            return { status: 'committed' as const, transactionId: options?.transactionId ?? '', revisions: {} };
        }),
    };
    const appendFor = (memberId: string) => ({ appendPlayerActionRequest: async (value: unknown) => { const prior = data['player-action-requests'], row = stampPlayerActionStateForRoomMember('player-action-requests', { requests: [value] }, { memberId }); data['player-action-requests'] = { requests: [...prior.requests, ...row.requests], _sync: sync(prior._sync.revision + 1, memberId) }; } });
    return { prepared: ready.prepared, clock, authority, gateway, action, original, data: () => data, appendFor, loseFinalReply: () => { loseFinalReply = true; }, prepareAction: (nextAction: typeof action, nextClock = clock) => { const next = prepareDnd5ePluginFeatureAction({ map: data.maps.maps[0], characters: data.characters.characters, initiativeOrder: authority.initiativeOrder, action: nextAction }); if (!next.ok)
            throw Error('real second parent preparation required'); return captureSecondChancePreparedOriginal(resolvePreparedDnd5ePluginFeatureAction, { prepared: next.prepared, restAuthority: { clock: nextClock, combatRevision: 8 }, rolls: { 'attack-d20:target': { values: [18] }, damage: { values: [4] } } })!; } };
}
async function completeTimedFixture(f: ReturnType<typeof setup>) {
    const start = prepareDnd5ePluginRestFeatureCasting({ prepared: f.prepared, clock: f.clock, combatRevision: 8, maps: f.data().maps.maps, combatActive: false });
    expect(start.ok, JSON.stringify(start)).toBe(true);
    if (!start.ok)
        throw Error('actual timed rest start rejected');
    const binding = start.castingContinuation.binding;
    expect(captureDnd5eCompletedRestCastingWitness({ receipt: start.castingContinuation.receipt, binding, character: f.prepared.actor, clock: f.clock, state: start.state, requiredSeconds: 60 })).toBeUndefined();
    await f.gateway.saveResourcesAtomically([{ name: 'characters', expectedRevision: f.data().characters._sync.revision, data: { characters: start.application.characters } }, { name: 'maps', expectedRevision: f.data().maps._sync.revision, data: { maps: [start.application.map] } }], { transactionId: 'actual-rest-cast-start', readRevisions: { 'campaign-time': 1, combat: 8 } });
    expect(armDnd5eLongCasting(start.castingReceipt, binding.casting, start.state.combatants.hero)).toBe(true);
    const unfinished = { prepared: { ...f.prepared, state: start.state, actor: start.application.characters.find((row: any) => row.id === 'hero')!, characters: start.application.characters, map: start.application.map }, restAuthority: { clock: f.clock, combatRevision: 8, castingContinuation: start.castingContinuation }, rolls: { 'attack-d20:target': { values: [18] }, damage: { values: [4] } } };
    expect(() => captureSecondChancePreparedOriginal(resolvePreparedDnd5ePluginFeatureAction, unfinished)).toThrow('original-rest-casting-incomplete');
    const advanced = mutateCampaignTimeState(f.data()['campaign-time'], { operation: 'advance', minutes: 1 }, 3, { memberId: 'dm', role: 'dm' });
    expect(advanced.ok, JSON.stringify(advanced)).toBe(true);
    if (!advanced.ok)
        throw Error('actual casting minute advance required');
    const clock = normalizeSharedCampaignTime(advanced.next), characters = f.data().characters.characters.map((row: ReturnType<typeof normalizeCharacter>) => reconcileDnd5eCharacterCampaignTime(row, clock).character);
    await f.gateway.saveResourcesAtomically([{ name: 'characters', expectedRevision: f.data().characters._sync.revision, data: { characters } }, { name: 'campaign-time', expectedRevision: 1, data: clock }], { transactionId: 'actual-rest-cast-elapsed', readRevisions: { maps: f.data().maps._sync.revision, combat: 8 } });
    const fresh = refreshDnd5ePluginRestFeatureCasting({ prepared: f.prepared, castingReceipt: start.castingReceipt, binding: binding.casting, map: f.data().maps.maps[0], maps: f.data().maps.maps, characters, worldMinute: clock.worldMinute, combat: { active: false, combatId: f.prepared.state.combatId, round: f.prepared.state.round, initiativeIndex: 0 }, initiativeOrder: f.authority.initiativeOrder });
    expect(fresh.ok, JSON.stringify(fresh)).toBe(true);
    if (!fresh.ok)
        throw Error('actual completed cast refresh required');
    const input = { prepared: fresh.prepared, restAuthority: { clock, combatRevision: 8, castingContinuation: start.castingContinuation }, rolls: { 'attack-d20:target': { values: [18] }, damage: { values: [4] } } };
    const witness = captureDnd5eCompletedRestCastingWitness({ receipt: start.castingContinuation.receipt, binding, character: fresh.prepared.actor, clock, state: fresh.prepared.state, requiredSeconds: 60 })!;
    expect(witness.casting.kind).toBe('exploration');
    f.original = captureSecondChancePreparedOriginal(resolvePreparedDnd5ePluginFeatureAction, input)!;
    return { input, witness, start };
}
it.each([2, 17, 20])('settles a real inactive rest attack with replacement %s and cost+HP in one parent CAS', async (replacement) => {
    const f = setup(), before = { mapId: f.data().combat.mapId, combatId: f.data().combat.combatId, round: f.data().combat.round, active: f.data().combat.active }, ui: SecondChancePersistentRoomUI = { showChoice: async ({ context }) => { await submitSecondChanceChoice({ mapId: 'map', context, optionId: context.phase === 'reaction' ? context.featureId : 'die:0', round: 1, initiativeIndex: 0 }, f.appendFor(context.phase === 'reaction' ? 'player' : 'caster-member')); }, requestRoll: async ({ receipt, rollRequestId, supplement }) => { const context = { attackReceiptId: receipt.attack.id, combatId: receipt.attack.combatId, actorTokenId: 'hero', characterId: 'hero', rollRequestId, count: supplement?.count ?? 1, sides: supplement?.sides ?? 20, supplementRequestId: supplement?.id }, values = [supplement ? 5 : replacement]; await submitSecondChanceRoll({ mapId: 'map', context, values, round: 1, initiativeIndex: 0 }, f.appendFor('caster-member')); await submitSecondChanceHostConfirmation({ mapId: 'map', context, values, round: 1, initiativeIndex: 0 }, f.appendFor('dm')); } };
    const recover = vi.fn(async () => { }), published = vi.fn(async () => { }), old = vi.fn(async () => { throw Error('old CAS'); });
    if (replacement === 17)
        f.loseFinalReply();
    if (replacement === 20)
        ui.prepareFollowups = async () => { const baseline = JSON.stringify([f.data().characters, f.data().maps]); return { combatRevision: f.data().combat._sync.revision, authorityUnchanged: () => JSON.stringify([f.data().characters, f.data().maps]) === baseline, confirm: async () => ({ accepted: false }), roll: async () => { throw Error('unexpected unrelated dice'); } }; };
    const run = () => runMapsPlayerActionTransaction({ coordinator: new DmActionTransactionCoordinator(), action: f.action, run: async () => { await resumeSecondChancePersistentRoomParent(f.action, f.gateway, ui); await driveSecondChancePersistentRoomParent({ mapId: 'map', parentTransactionId: f.action.id, preparedOriginal: JSON.parse(JSON.stringify(f.original)) }, f.gateway, ui); }, waitForAuthorityCommit: old, readOutcome: () => undefined, clearOutcome: () => { }, setTransactionActive: () => { }, recover, secondChanceSettlement: { gateway: f.gateway, onPublished: published } });
    await run();
    expect(recover.mock.calls).toEqual([]);
    expect(published).toHaveBeenCalledTimes(1);
    expect(old).not.toHaveBeenCalled();
    const target = f.data().characters.characters.find((row: any) => row.id === 'target'), caster = f.data().characters.characters.find((row: any) => row.id === 'hero');
    expect(target.currentHp).toBe(replacement === 2 ? 20 : replacement === 20 ? 11 : 16);
    expect(target.classResources['test.second-chance:uses'].current).toBe(0);
    expect(target.dnd5eCombatState.sceneReactionSpent.parentTransactionId).toBe(f.action.id);
    expect(caster.dnd5eRestStartActivityWindow).toBeTruthy();
    const combat = f.data().combat as SecondChanceCombat;
    expect({ mapId: combat.mapId, combatId: combat.combatId, round: combat.round, active: combat.active }).toEqual(before);
    expect(combat.dnd5eTurnEconomyByToken).toBeUndefined();
    expect(validateSecondChanceAttackReceipts(combat.secondChanceAttacks)).toBe(true);
    const characterWrites = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.filter(([writes]) => writes.some((row: any) => row.name === 'characters'));
    expect(characterWrites).toHaveLength(1);
    expect(characterWrites[0][0].some(row => row.name === 'maps')).toBe(true);
    expect(characterWrites[0][1]?.readRevisions?.['campaign-time']).toBe(1);
    const writes = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length;
    await run();
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(writes);
    const restored = normalizeCharacter(JSON.parse(JSON.stringify(target))), snapshot = createDnd5eMapCombatSnapshot({ map: f.data().maps.maps[0], characters: f.data().characters.characters, combatId: 'genuine-next-combat', initiativeOrder: [{ tokenId: 'hero', slotId: 'hero:normal', roll: 20, label: 'Hero', emoji: '', color: '' }, { tokenId: 'target', slotId: 'target:normal', roll: 10, label: 'Target', emoji: '', color: '' }] });
    expect(restored.dnd5eCombatState?.sceneReactionSpent).toEqual(target.dnd5eCombatState.sceneReactionSpent);
    const shape = validateSharedStateShape('characters', f.data().characters);
    expect(shape.ok, JSON.stringify(shape)).toBe(true);
    const projected = projectCharactersForRoomMember(f.data().characters, { memberId: 'player', activeCharacterId: 'target' }), validated = validateAndMigrateSharedResource('characters', projected);
    expect(validated.status, JSON.stringify(validated)).not.toBe('invalid');
    if (validated.status === 'invalid')
        throw Error('real client migration rejected marker');
    const migrated = normalizeCharacter((validated.value as any).characters.find((row: any) => row.id === 'target'));
    expect(migrated.dnd5eCombatState?.sceneReactionSpent).toEqual(target.dnd5eCombatState.sceneReactionSpent);
    const malicious = { ...target, dnd5eCombatState: { ...target.dnd5eCombatState, sceneReactionSpent: undefined } }, merged = mergePlayerCharactersStateForAuthority({ characters: [target] }, { characters: [malicious] }, 'player', { combatActive: false });
    expect((merged as any).characters[0].dnd5eCombatState.sceneReactionSpent).toEqual(target.dnd5eCombatState.sceneReactionSpent);
    expect(mergePlayerWritableCharacter(normalizeCharacter(malicious), migrated).dnd5eCombatState?.sceneReactionSpent).toEqual(target.dnd5eCombatState.sceneReactionSpent);
    const corrupt = { characters: [{ ...target, dnd5eCombatState: { ...target.dnd5eCombatState, sceneReactionSpent: { schemaVersion: 1, roomId: 'room', parentTransactionId: f.action.id, forged: true } } }] };
    expect(validateSharedStateShape('characters', corrupt).ok).toBe(false);
    expect(validateAndMigrateSharedResource('characters', corrupt).status).toBe('invalid');
    expect(snapshot.state.combatants.target.turn.reactionAvailable).toBe(false);
    const first = resolveDnd5eHeadlessAction(snapshot.state, { type: 'begin-turn', actorId: 'hero' });
    expect(first.ok).toBe(true);
    expect(first.state.combatants.target.classState.sceneReactionSpent).toBeTruthy();
    const own = resolveDnd5eHeadlessAction(first.state, { type: 'end-turn', actorId: 'hero' });
    expect(own.ok).toBe(true);
    expect(own.state.combatants.target.classState.sceneReactionSpent).toBeUndefined();
    expect(own.state.combatants.target.turn.reactionAvailable).toBe(true);
    expect(applyDnd5eShortRestBenefits(restored, 540).dnd5eCombatState?.sceneReactionSpent).toBeUndefined();
    expect(applyDnd5eLongRestBenefits(restored, 960).dnd5eCombatState?.sceneReactionSpent).toBeUndefined();
    const advanced = mutateCampaignTimeState(f.data()['campaign-time'], { operation: 'advance-seconds', seconds: 6 }, 2, { memberId: 'dm', role: 'dm' });
    if (!advanced.ok)
        throw Error('real clock advance required');
    expect(reconcileDnd5eCharacterCampaignTime(restored, normalizeSharedCampaignTime(advanced.next)).character.dnd5eCombatState?.sceneReactionSpent).toBeTruthy();
});
function sceneUI(f: ReturnType<typeof setup>, beforeRoll?: () => void, decline = false): SecondChancePersistentRoomUI { return { showChoice: async ({ context }) => { await submitSecondChanceChoice({ mapId: 'map', context, optionId: context.phase === 'reaction' ? (decline ? 'decline' : context.featureId) : 'die:0', round: 1, initiativeIndex: 0 }, f.appendFor(context.phase === 'reaction' ? 'player' : 'caster-member')); }, requestRoll: async ({ receipt, rollRequestId, supplement }) => { beforeRoll?.(); const context = { attackReceiptId: receipt.attack.id, combatId: receipt.attack.combatId, actorTokenId: 'hero', characterId: 'hero', rollRequestId, count: supplement?.count ?? 1, sides: supplement?.sides ?? 20, supplementRequestId: supplement?.id }, values = [supplement ? 5 : 17]; await submitSecondChanceRoll({ mapId: 'map', context, values, round: 1, initiativeIndex: 0 }, f.appendFor('caster-member')); await submitSecondChanceHostConfirmation({ mapId: 'map', context, values, round: 1, initiativeIndex: 0 }, f.appendFor('dm')); } }; }
function sceneRun(f: ReturnType<typeof setup>, ui: SecondChancePersistentRoomUI) { return runMapsPlayerActionTransaction({ coordinator: new DmActionTransactionCoordinator(), action: f.action, run: async () => { await resumeSecondChancePersistentRoomParent(f.action, f.gateway, ui); await driveSecondChancePersistentRoomParent({ mapId: 'map', parentTransactionId: f.action.id, preparedOriginal: JSON.parse(JSON.stringify(f.original)) }, f.gateway, ui); }, waitForAuthorityCommit: async () => { throw Error('old CAS'); }, readOutcome: () => undefined, clearOutcome: () => { }, setTransactionActive: () => { }, recover: async () => { }, secondChanceSettlement: { gateway: f.gateway, onPublished: async () => { } } }); }
it('publishes an explicit scene decline with original attack and rest receipt while preserving resource and reaction', async () => {
    const f = setup();
    await sceneRun(f, sceneUI(f, undefined, true));
    const target = f.data().characters.characters.find((row: any) => row.id === 'target'), caster = f.data().characters.characters.find((row: any) => row.id === 'hero'), receipt = Object.values((f.data().combat as SecondChanceCombat).secondChanceAttacks!)[0];
    expect(target.currentHp).toBe(16);
    expect(target.classResources['test.second-chance:uses'].current).toBe(1);
    expect(target.dnd5eCombatState?.sceneReactionSpent).toBeUndefined();
    expect(caster.dnd5eRestStartActivityWindow).toBeTruthy();
    expect(receipt.committed).toBeUndefined();
    expect(receipt.reactionDecision?.decision).toBe('decline');
    expect(receipt.parentContinuation?.phase).toBe('consumed');
});
it('keeps a cancelled scene reaction pending and reserved across reload without cost or HP until the one final CAS', async () => {
    const f = setup();
    await sceneRun(f, sceneUI(f, () => { throw Error('owner cancelled dice'); }));
    let target = f.data().characters.characters.find((row: any) => row.id === 'target');
    expect(target.currentHp).toBe(20);
    expect(target.classResources['test.second-chance:uses'].current).toBe(1);
    expect(target.dnd5eCombatState?.sceneReactionSpent).toBeUndefined();
    const nextAction = { ...f.action, id: 'second-rest-parent' }, nextOriginal = f.prepareAction(nextAction);
    await expect(issueSecondChanceAttack({ mapId: 'map', parentTransactionId: nextAction.id, preparedOriginal: nextOriginal }, f.gateway)).rejects.toThrow('scene-reaction-reserved');
    await sceneRun(f, sceneUI(f));
    target = f.data().characters.characters.find((row: any) => row.id === 'target');
    expect(target.currentHp).toBe(16);
    expect(target.classResources['test.second-chance:uses'].current).toBe(0);
    expect(target.dnd5eCombatState.sceneReactionSpent).toBeTruthy();
    expect(vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.filter(([writes]) => writes.some((row: any) => row.name === 'characters'))).toHaveLength(1);
});
it.each(['clock', 'characters', 'host', 'room'])('rejects changed %s authority before publishing an inactive rest attack', async (change) => {
    const f = setup();
    await expect(sceneRun(f, sceneUI(f, () => {
        if (change === 'clock') {
            const next = mutateCampaignTimeState(f.data()['campaign-time'], { operation: 'advance-seconds', seconds: 6 }, 2, { memberId: 'dm', role: 'dm' });
            if (!next.ok)
                throw Error('real clock advance required');
            f.data()['campaign-time'] = { ...next.next, _sync: { schemaVersion: 1, revision: 2, writerId: 'fixture-host', writtenAt: 1 } };
        }
        if (change === 'characters')
            f.data().characters._sync.revision++;
        if (change === 'host')
            session.current = { roomId: 'room', memberId: 'another-dm', role: 'dm' };
        if (change === 'room')
            session.current = { roomId: 'another-room', memberId: 'dm', role: 'dm' };
    }))).rejects.toThrow(change === 'clock' ? 'stale-rest-clock' : change === 'characters' ? 'stale-character-state' : 'host-room-required');
    const target = f.data().characters.characters.find((row: any) => row.id === 'target');
    expect(target.currentHp).toBe(20);
    expect(target.classResources['test.second-chance:uses'].current).toBe(1);
    expect(target.dnd5eCombatState?.sceneReactionSpent).toBeUndefined();
    expect(vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.some(([writes]) => writes.some((row: any) => row.name === 'characters'))).toBe(false);
});
it('does not grant another reaction to a genuinely fresh second rest parent even when the Host refills only the feat pool', async () => {
    const f = setup();
    await sceneRun(f, sceneUI(f));
    const first = f.data().characters.characters.find((row: any) => row.id === 'target'), refilled = updateClassResource(first, 'test.second-chance:uses', () => 1)!;
    expect(refilled.dnd5eCombatState?.sceneReactionSpent).toBeTruthy();
    f.data().characters.characters = f.data().characters.characters.map((row: any) => row.id === 'target' ? refilled : row);
    f.data().characters._sync.revision++;
    const dm = { memberId: 'dm', role: 'dm' }, interrupted = mutateCampaignTimeState(f.data()['campaign-time'], { operation: 'interrupt-rest-session', id: 'rest-1', expectedWorldMinute: 480 }, 2, dm, { host: dm, restCharacterIds: ['hero'] });
    if (!interrupted.ok)
        throw Error('actual rest interruption required');
    const started = mutateCampaignTimeState(interrupted.next, { operation: 'start-rest-session', id: 'rest-2', kind: 'short-rest', characterIds: ['hero'], expectedWorldMinute: 480 }, 3, dm, { host: dm, restCharacterIds: ['hero'] });
    if (!started.ok)
        throw Error('actual second rest session required');
    const nextClock = normalizeSharedCampaignTime(started.next);
    f.data()['campaign-time'] = { ...nextClock, _sync: { schemaVersion: 1, revision: 3, writerId: 'fixture-host', writtenAt: 1 } };
    const secondAction = { ...f.action, id: 'genuinely-fresh-rest-parent', dnd5ePluginAction: { ...f.action.dnd5ePluginAction, payload: { selectedActivityId: 'rest-strike', restEventId: 'rest-start:rest-2' } } }, original = f.prepareAction(secondAction, nextClock);
    const replay = await createSecondChancePreparedReplayAsync(original);
    try {
        const result = replay.run(replay.originalState);
        expect(result.status).toBe('resolved');
        if (result.status !== 'resolved')
            throw Error('fresh parent incorrectly offered free reaction');
        const final = await replay.finalize(result.result as never);
        expect(final.result.ok).toBe(true);
        const target = final.application?.characters.find((row: any) => row.id === 'target');
        expect(target?.currentHp).toBe(12);
        expect(target?.classResources?.['test.second-chance:uses'].current).toBe(1);
        expect(target?.dnd5eCombatState?.sceneReactionSpent).toBeTruthy();
    }
    finally {
        await replay.dispose();
    }
    await expect(issueSecondChanceAttack({ mapId: 'map', parentTransactionId: secondAction.id, preparedOriginal: original }, f.gateway)).rejects.toThrow('incoming-hit-not-awaiting-choice');
});
it('uses the actual owner UI, server-owned scene prompt and DM override without taking attack identity from DiceBox presentation', async () => {
    const f = setup(), confirm = createDmDiceConfirmationQueue(async (request: any) => [request.sides === 20 ? 20 : 6]);
    const postOwned = async (requestId: string, values: number[]) => {
        session.current = { roomId: 'room', memberId: 'caster-member', role: 'player' };
        try {
            const projected = projectSecondChanceCombatForMember(f.data().combat, { memberId: 'caster-member' });
            expect(projected.combatId).toBe('old-combat');
            expect(projected.secondChancePrompts[0].combatId).toBe('map-map');
            const result = await submitSecondChanceOwnedDiceResult({ mapId: 'map', combatId: 'old-combat', requestId, characterId: 'hero', values, round: 9, initiativeIndex: 0 }, { loadResource: async <T>() => structuredClone(projected) as T, ...f.appendFor('caster-member') });
            expect(result).toBeTruthy();
        }
        finally {
            session.current = { roomId: 'room', memberId: 'dm', role: 'dm' };
        }
    };
    const ui = createSecondChancePersistentRoomUI({ map: f.data().maps.maps[0], characters: () => f.data().characters.characters, gateway: { ...f.gateway, ...f.appendFor('dm') }, round: () => 9, initiativeIndex: () => 0, choose: async (request: any) => { const context = request.context!.secondChance as Parameters<typeof submitSecondChanceChoice>[0]['context'], optionId = context.phase === 'reaction' ? context.featureId : 'die:0'; await submitSecondChanceChoice({ mapId: 'map', context, optionId, round: 9, initiativeIndex: 0 }, f.appendFor(context.phase === 'reaction' ? 'player' : 'caster-member')); return optionId; }, rollD20: async (_label, _target, owner) => { await postOwned(owner.durableRollRequestId!, [2]); return (await confirm({ id: owner.durableRollRequestId!, label: 'Second Chance', targetName: 'Hero', sides: 20, values: [2], visibility: 'public' }))[0]; }, rollDice: async (count, sides, _label, _target, owner) => { expect([count, sides]).toEqual([1, 6]); await postOwned(owner.durableRollRequestId!, [5]); return confirm({ id: owner.durableRollRequestId!, label: 'Critical supplement', targetName: 'Hero', sides, values: [5], visibility: 'public' }); } });
    await sceneRun(f, ui);
    const target = f.data().characters.characters.find((row: any) => row.id === 'target'), receipt = Object.values((f.data().combat as SecondChanceCombat).secondChanceAttacks!)[0];
    expect(target.currentHp).toBe(10);
    expect(target.classResources['test.second-chance:uses'].current).toBe(0);
    expect(receipt.rollerD20).toMatchObject({ authenticatedMemberId: 'caster-member', value: 2 });
    expect(receipt.rollerConfirmation).toMatchObject({ authenticatedMemberId: 'dm', rawValue: 2, value: 20 });
    expect(receipt.parentContinuation?.phase).toBe('consumed');
    expect(Object.values(receipt.criticalDiceConfirmations!)[0]).toMatchObject({ rawValues: [5], values: [6], authenticatedMemberId: 'dm' });
});
it('restores a genuinely completed private timed rest cast through its issuer and publishes the same Maps parent once', async () => {
    const f = setup(true), done = await completeTimedFixture(f), context = { binding: done.start.castingContinuation.binding, character: done.input.prepared.actor, clock: done.input.restAuthority.clock, state: done.input.prepared.state, requiredSeconds: 60 };
    expect(captureDnd5eCompletedRestCastingWitness({ ...context, receipt: JSON.parse(JSON.stringify(done.start.castingContinuation.receipt)) })).toBeUndefined();
    expect(restoreDnd5eCompletedRestCastingWitness(JSON.parse(JSON.stringify(done.witness)), context)).toBeTruthy();
    for (const malformed of [null, { ...done.witness.binding, unexpected: true }, { ...done.witness.binding, casting: null }, { ...done.witness.binding, casting: { ...done.witness.binding.casting, unexpected: true } }])
        expect(restoreDnd5eCompletedRestCastingWitness({ ...done.witness, binding: malformed } as any, context)).toBeUndefined();
    const malformedInner = structuredClone(done.witness);
    if (malformedInner.casting.kind === 'exploration') {
        malformedInner.casting.witness.binding = { ...malformedInner.casting.witness.binding, unexpected: true } as any;
        expect(restoreDnd5eCompletedRestCastingWitness(malformedInner, context)).toBeUndefined();
    }
    expect(restoreDnd5eCompletedRestCastingWitness(done.witness, { ...context, requiredSeconds: 120 })).toBeUndefined();
    expect(restoreDnd5eCompletedRestCastingWitness(done.witness, { ...context, binding: { ...context.binding, casting: { ...context.binding.casting, requestId: 'foreign-parent' } } })).toBeUndefined();
    expect(restoreDnd5eCompletedRestCastingWitness(done.witness, { ...context, clock: { ...context.clock, advances: [] } })).toBeUndefined();
    const used = { ...context.character, dnd5eRestActivityWindow: { ...context.character.dnd5eRestActivityWindow!, receipts: { [JSON.stringify([context.binding.packageId, context.binding.activityId])]: 'used' as const } } };
    expect(restoreDnd5eCompletedRestCastingWitness(done.witness, { ...context, character: used })).toBeUndefined();
    if (done.witness.casting.kind !== 'exploration')
        throw Error('actual exploration witness required');
    const future = structuredClone(done.witness);
    if (future.casting.kind === 'exploration')
        future.casting.witness.exploration = { ...future.casting.witness.exploration, readyAtWorldMinute: context.clock.worldMinute + 1 };
    expect(restoreDnd5eCompletedRestCastingWitness(future, context)).toBeUndefined();
    for (const foreign of [{ roomId: 'room', memberId: 'player', role: 'player' }, { roomId: 'room', memberId: 'other-dm', role: 'dm' }, { roomId: 'foreign', memberId: 'dm', role: 'dm' }]) {
        session.current = foreign;
        await expect(readSecondChancePreparedOriginalAsync(JSON.parse(JSON.stringify(f.original)))).rejects.toThrow('host-recovery-authority-required');
    }
    session.current = { roomId: 'room', memberId: 'dm', role: 'dm' };
    expect((await readSecondChancePreparedOriginalAsync(JSON.parse(JSON.stringify(f.original)))).prepared.state.combatId).toBe('map-map');
    const before = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length;
    f.loseFinalReply();
    await sceneRun(f, sceneUI(f));
    const target = f.data().characters.characters.find((row: any) => row.id === 'target'), caster = f.data().characters.characters.find((row: any) => row.id === 'hero'), receipt = Object.values((f.data().combat as SecondChanceCombat).secondChanceAttacks!)[0];
    expect(target.currentHp).toBe(16);
    expect(target.classResources['test.second-chance:uses'].current).toBe(0);
    expect(target.dnd5eCombatState.sceneReactionSpent).toBeTruthy();
    expect(caster.concentrating).toBe(false);
    expect(Object.values(caster.dnd5eRestActivityWindow.receipts)).toEqual(['used']);
    expect(receipt.sceneScope?.campaignTimeRevision).toBe(2);
    expect(receipt.parentContinuation?.phase).toBe('consumed');
    const finalWrites = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.slice(before).filter(([writes]) => writes.some((row: any) => row.name === 'characters'));
    expect(finalWrites).toHaveLength(1);
    expect(finalWrites[0][1]?.readRevisions?.['campaign-time']).toBe(2);
    const writes = vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length;
    await sceneRun(f, sceneUI(f));
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(writes);
});

it('resumes a real Host-local inactive rest parent across cancellation/reload with the same scene, clock and one final CAS',async()=>{
 const f=setup(false,true),issued=await issueSecondChanceAttack({mapId:'map',parentTransactionId:f.action.id,preparedOriginal:JSON.parse(JSON.stringify(f.original))},f.gateway)
 expect(issued.sceneScope).toMatchObject({roomId:'room',hostMemberId:'dm'});expect(issued.originalRoomAction).toBeUndefined();expect(f.data().combat.active).toBe(false)
 const ui:SecondChancePersistentRoomUI={showChoice:async({context})=>{await submitSecondChanceChoice({mapId:'map',context,optionId:context.phase==='reaction'?context.featureId:'die:0',round:1,initiativeIndex:0},f.appendFor(context.phase==='reaction'?'player':'dm'))},requestRoll:async()=>{throw Error('actual roller cancelled')}}
 expect((await resumeSecondChanceHostLocalParent({mapId:'map',parentTransactionId:f.action.id},f.gateway,ui)).kind).toBe('second-chance-parent-pending')
 expect(f.data().characters.characters.find((row:any)=>row.id==='target').classResources['test.second-chance:uses'].current).toBe(1)
 const sameScene=JSON.parse(JSON.stringify(f.data().combat.secondChanceAttacks[issued.attack.id].sceneScope))
 ui.requestRoll=async({receipt,rollRequestId})=>{const context={attackReceiptId:receipt.attack.id,combatId:receipt.attack.combatId,actorTokenId:'hero',characterId:'hero',rollRequestId,count:1,sides:20};await submitSecondChanceRoll({mapId:'map',context,values:[17],round:1,initiativeIndex:0},f.appendFor('dm'));await submitSecondChanceHostConfirmation({mapId:'map',context,values:[17],round:1,initiativeIndex:0},f.appendFor('dm'))}
 expect((await resumeSecondChanceHostLocalParent({mapId:'map',parentTransactionId:f.action.id},f.gateway,ui)).kind).toBe('second-chance-parent-published')
 const count=vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length;expect((await resumeSecondChanceHostLocalParent({mapId:'map',parentTransactionId:f.action.id},f.gateway,ui)).kind).toBe('second-chance-parent-published');expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(count)
 const done=f.data().combat.secondChanceAttacks[issued.attack.id],target=f.data().characters.characters.find((row:any)=>row.id==='target');expect(done.sceneScope).toEqual(sameScene);expect(target.currentHp).toBe(16);expect(target.classResources['test.second-chance:uses'].current).toBe(0);expect(f.data().combat.active).toBe(false);expect(f.data().combat.combatId).toBe('old-combat')
})
it.each(['room','host','clock','source-map']as const)('Host-local inactive recovery rejects changed %s before rendering or writing',async change=>{
 const f=setup(false,true);await issueSecondChanceAttack({mapId:'map',parentTransactionId:f.action.id,preparedOriginal:JSON.parse(JSON.stringify(f.original))},f.gateway);const before=vi.mocked(f.gateway.saveResourcesAtomically).mock.calls.length
 if(change==='room')session.current={roomId:'foreign',memberId:'dm',role:'dm'};if(change==='host')session.current={roomId:'room',memberId:'foreign',role:'dm'};if(change==='clock')f.data()['campaign-time']._sync.revision++;if(change==='source-map')f.data().combat.mapId='foreign'
 const showChoice=vi.fn(async()=>{});await expect(resumeSecondChanceHostLocalParent({mapId:'map',parentTransactionId:f.action.id},f.gateway,{showChoice,requestRoll:async()=>{}})).rejects.toThrow();expect(showChoice).not.toHaveBeenCalled();expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(before);expect(f.data().characters.characters.find((row:any)=>row.id==='target').currentHp).toBe(20);expect(f.data().characters.characters.find((row:any)=>row.id==='target').classResources['test.second-chance:uses'].current).toBe(1)
})
