import{SecondChanceMapsSettlementSignal}from'./secondChanceMapsSettlement'
import { secondChanceTestContent } from './secondChance.testFixture';
import { afterEach, expect, it, vi } from 'vitest';
import { normalizeCharacter } from '../../store/characters';
import { syncCharacterClassResources } from '../../lib/classResources';
import { migrateMapsState } from '../../store/maps';
import { normalizeSharedCampaignTime } from '../../lib/campaignTime';
import { mutateCampaignTimeState, stampPlayerActionStateForRoomMember, validateSharedStateShape } from '../../../scripts/shared-server-core.mjs';
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability';
import { registerDnd5eRulesPlugin } from '../../rulesets/dnd5e/pluginApi';
import { dnd5eRulesPluginFromUnifiedContentBundleV1 } from '../../rulesets/dnd5e/unifiedContent';
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } from '../../rulesets/dnd5e/pluginFeatureAction';
import { dnd5eSpellAuthorityResolutionContext } from './spellSettlementCoordinator';
import type { Dnd5eActivityDefinitionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts';
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway';
import { captureSecondChancePreparedOriginal } from './secondChancePreparedParent';
import { driveSecondChancePersistentRoomParent, type SecondChancePersistentRoomUI } from './secondChancePersistentRoomDriver';
import { reconcileDnd5eCharacterCampaignTime } from '../../rulesets/dnd5e/campaignTimeRules';
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

import{createNativeEnvelopeApi}from'./secondChanceNativeApiTestHelper'
it('real inactive Host rest attack decline publishes its original HP through the actual HTTP CAS without duplicate read/write revision keys',async()=>{
 const f=setup(false,true),api=await createNativeEnvelopeApi(f.data()),before=await api.read('characters'),ui:SecondChancePersistentRoomUI={showChoice:async({receipt})=>{const action:any={id:'true-rest-owner-decline',mapId:'map',combatId:receipt.attack.combatId,actorTokenId:'target',characterId:'target',type:'dnd5e-second-chance',sourceMode:'player',status:'pending',round:1,initiativeIndex:0,seq:1,updatedAt:1,secondChance:{attackReceiptId:receipt.attack.id,phase:'reaction',decision:'decline'}};expect((await api.post('player-action-requests/append',{action},'player')).status).toBe(200)},requestRoll:async()=>{throw Error('decline cannot roll')},prepareFollowups:async()=>({combatRevision:8,authorityUnchanged:()=>true,confirm:async()=>{throw Error('No additional reaction expected')},roll:async()=>{throw Error('No additional dice expected')}})}
 try{await driveSecondChancePersistentRoomParent({mapId:'map',parentTransactionId:f.action.id,preparedOriginal:f.original},api.gateway,ui);throw Error('expected published signal')}catch(error){if(!(error instanceof SecondChanceMapsSettlementSignal))throw error;expect(error.settlement.kind).toBe('second-chance-parent-published')}
 const after=await api.read('characters'),combat=await api.read('combat');expect(after.characters.find((row:any)=>row.id==='target').currentHp).toBe(before.characters.find((row:any)=>row.id==='target').currentHp-4);expect(after.characters.find((row:any)=>row.id==='target').classResources['test.second-chance:uses'].current).toBe(1);expect(combat.active).toBe(false);expect(combat.combatId).toBe('old-combat');expect(Object.values(combat.secondChanceAttacks).every((row:any)=>row.parentContinuation.phase==='consumed')).toBe(true)
 expect(api.gateway.saveResourcesAtomically.mock.calls.filter((call:any)=>call[1]?.transactionId==='second-chance-parent:'+f.action.id)).toHaveLength(1)
})
