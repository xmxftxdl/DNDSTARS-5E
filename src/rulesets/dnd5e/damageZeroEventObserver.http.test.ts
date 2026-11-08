import ts from'typescript';import{publishSharedEvent}from'../../lib/sharedApi';import{actualEventObservers}from'./damageZeroEventObserver.producer.fixture';
import{readBountifulDamageZeroEquipmentUi,withBountifulDamageZeroEquipmentUi}from'./bountifulDamageZeroEquipmentUi';
import{createActualPageZeroRestorer}from'./damageZeroEquipmentPageRestore.support';
import{createBountifulDamageZeroOriginalRoomBoundary}from'./bountifulDamageZeroOriginalRoomBoundary';
import { captureBountifulDamageZeroOriginalPreparation, restoreBountifulDamageZeroOriginalParent } from './bountifulDamageZeroOriginalPreparation';
import type { BountifulDamageZeroOriginalParent } from './bountifulDamageZeroOriginalParentTypes';
/// <reference types="node" />

import { createDamageZeroSavingThrowRoomChoiceDriver } from '../../lib/damageZeroSavingThrowRoomChoices';
import { dnd5ePluginFeatureDefinition } from './pluginApi';
import { captureBountifulDamageZeroOriginalQualification, readBountifulDamageZeroOriginalQualification } from './bountifulDamageZeroOriginalQualification';
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
vi.mock('../../lib/roomSession',async importOriginal=>({...await importOriginal<typeof import('../../lib/roomSession')>(),getRoomSession:()=>auth.value}));
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
        const source = withBountifulDamageZeroEquipmentUi({ prepared: next.prepared, d20: 18, damageRolls: [2], classDamageRolls: [] },{schemaVersion:1,shieldAttempted:false,shieldSucceeded:false}), original = structuredClone(source.prepared.state), session = createDnd5eOriginalD20Session(source, resolvePreparedDnd5eEquipmentAttack, 'soul-token', 'saving-throw');
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
                const identity = { parentId: source.prepared.action.id, mapId: source.prepared.map.id, combatId: source.prepared.state.combatId }, loadParent = async (id: typeof identity) => { const r = await http.state('POST', 'bountiful-damage-zero-original/probe', id, data, 'host'); expect(r.status, JSON.stringify(r.payload)).toBe(200); if (!r.payload.present)
                    throw Error('Actual saved parent required'); return r.payload as BountifulDamageZeroOriginalParent; };
                let classChoices = 0, physical = 0;
                const pause=Object.freeze({nativeClassChoice:'waiting'}),beforeChoice=createBountifulDamageZeroOriginalRoomBoundary({action:source.prepared.action,gateway:{...gateway,loadResource:async<T>(name:string)=>data[name]as T,saveResourcesAtomically:async()=>{throw Error('No world/receipt before class choice')}},loadOriginal:load,loadOriginalParent:loadParent,options:ports=>({authorityUnchanged:()=>true,combatRevision:1,confirm:async()=>({accepted:false}),roll:async()=>{throw Error('No generic pre-choice dice')},replayEventBatchId:identity.parentId,...createDamageZeroSavingThrowRoomChoiceDriver({map:source.prepared.map,characters:()=>source.prepared.characters,parentTransactionId:()=>identity.parentId,authorityUnchanged:()=>true,choose:async()=>{classChoices++;const p=await loadParent(identity);expect(p.sourceKind).toBe('damage-zero-preparation-v1');expect(Object.hasOwn(p,'rows')).toBe(false);throw pause},rollDice:async()=>{physical++;throw Error('No saving pool before class use')},originalRaw:ports.originalRaw}),chooseAllyNaturalOne:ports.chooseAllyNaturalOne}),ui:{showChoice:async()=>{throw Error('No Bounty before class original')},requestRoll:async()=>{throw Error('No Bounty reroll before class original')}}});const freezeNativeTime=vi.spyOn(Date,'now').mockReturnValue(session.originalEffectTimestamp());try{await expect(beforeChoice.resolve(source)).rejects.toBe(pause)}finally{freezeNativeTime.mockRestore()};
expect(classChoices).toBe(1);
                expect(physical).toBe(0);
                expect(published[0]).toMatchObject({ sourceKind: 'damage-zero-original-v1', phase: 'prepare' });
                expect(Object.hasOwn(published[0], 'rows')).toBe(false);
                expect(Object.hasOwn(published[0], 'requestId')).toBe(false);
                const prepared = await loadParent(identity);
                expect(prepared.sourceKind).toBe('damage-zero-preparation-v1');
                expect(Object.hasOwn(prepared, 'rows')).toBe(false);
                expect(data).toEqual(originalData);
                expect(source.prepared.state).toEqual(original);
                const commands = published.length;
                await expect(captureBountifulDamageZeroOriginalPreparation({ ...operation }, gateway, loadParent)).rejects.toThrow('exact-current-operation-required');
                expect(published).toHaveLength(commands);
                for (const payload of [{ ...published[0], rows: [] }, { ...published[0], frame: { ...published[0].frame, dc: 999 } }, { ...published[0], prefixSignature: 'caller supplied result' }])
                    expect((await http.event('bountiful-native-raw-source-dm-to-host', payload, data, 'host')).status).toBe(403);
                expect((await http.event('bountiful-native-raw-source-dm-to-host', published[0], data, 'first-member')).status).toBe(403);
                expect((await http.state('POST', 'bountiful-damage-zero-original/source', identity, data, 'host')).status).toBe(403);
                const fakeId = 'bountiful-damage-zero-original:' + 'f'.repeat(64), fakeRoll = { ...identity, requestId: fakeId, rollerTokenId: 'soul-token', targetCharacterId: 'soul', kind: 'dice', count: 1, sides: 20, rollKind: 'saving-throw', delivery: 'player-roll-result', sourceMode: 'player', values: [1] };
                expect((await http.event('dice-roll-request-player-to-dm', fakeRoll, data, 'first-member')).status).toBe(403);
                expect((await http.event('bountiful-native-raw-source-dm-to-host', { sourceKind: 'damage-zero-original-v1', phase: 'confirm', ...identity, requestId: fakeId, rawValues: [1], values: [1] }, data, 'host')).status).toBe(403);
                const changed = structuredClone(data);
                changed.characters._sync.revision++;
                const stale = await http.state('POST', 'bountiful-damage-zero-original/probe', identity, changed, 'host');
                expect(stale.status).toBe(403);
                expect(stale.payload.present).toBeUndefined();
                expect((await loadParent(identity)).sourceKind).toBe('damage-zero-preparation-v1');
                const delay = vi.spyOn(Date, 'now').mockReturnValue(session.originalEffectTimestamp() + 30000);
                try {
                    const cold = await restoreBountifulDamageZeroOriginalParent(identity, loadParent);
                     const restorePage=createActualPageZeroRestorer(source.prepared.action),pageInputs=await restorePage(cold.source);
                     expect(pageInputs.finalEquipmentInput).toBe(cold.source);expect(pageInputs.attack).toBe(cold.source.prepared);expect(pageInputs.attackTransaction).toBe(cold.source.transaction);expect(pageInputs.damageRolls).toEqual([2]);expect(pageInputs.equipmentOriginalSource).toBeUndefined();expect(pageInputs.equipmentRerollCommit).toBeUndefined();expect(pageInputs.misdirection).toBeUndefined();expect(pageInputs.misdirectionWardEvents).toEqual([]);expect(pageInputs.useProtection).toBe(false);expect(pageInputs.shieldAttempted).toBe(false);expect(pageInputs.shieldSucceeded).toBe(false);expect(pageInputs.useDeflectMissiles).toBe(false);expect(pageInputs.allyRepositionMovementTrace).toBeUndefined();expect(pageInputs.classDamageLabels['sneak-attack']).toBe('偷袭');expect(Object.hasOwn(pageInputs,'result')).toBe(false);expect(physical).toBe(0);expect(data).toEqual(originalData);
                     const {hostDamageZeroEquipmentUi:_ui,...missingUi}=source;await expect(restorePage(missingUi)).rejects.toThrow('original-input-controls-required');expect(()=>readBountifulDamageZeroEquipmentUi({...source,hostDamageZeroEquipmentUi:{...source.hostDamageZeroEquipmentUi,result:{ok:true}}}as never)).toThrow('original-input-controls-required');await expect(restorePage({...cold.source,coverAttackRedirect:{ownerId:'caller'} }as never)).rejects.toThrow('actual-misdirection-ward-recovery-required');expect(physical).toBe(0);

                    expect(readDnd5eDamageZeroOriginalOperation(cold.operation).effectTimestamp).toBe(session.originalEffectTimestamp());
                    expect(readDnd5eDamageZeroOriginalOperation(cold.operation).prefixSignature).toBe(readDnd5eDamageZeroOriginalOperation(operation).prefixSignature);
                    expect((await captureBountifulDamageZeroOriginalPreparation(cold.operation, gateway, loadParent)).sourceKind).toBe('damage-zero-preparation-v1');
                    expect(Object.hasOwn(await loadParent(identity), 'rows')).toBe(false);
                    await expect(restoreBountifulDamageZeroOriginalParent(identity, async (id) => ({ ...await loadParent(id), prefixSignature: 'copied snapshot' }))).rejects.toThrow('exact-restored-prefix-required');
                    const fresh = createDnd5eOriginalD20Session(cold.source, resolvePreparedDnd5eEquipmentAttack, 'soul-token', 'saving-throw');
                    try {
                        const actual = fresh.run(cold.source.prepared.state);
                        if (actual.status !== 'pending-damage-zero-saving-throw')
                            throw Error('Fresh actual zero stage required');
                        const freshOp = captureDnd5eDamageZeroOriginalOperation(actual);
                        let issued: Awaited<ReturnType<typeof createBountifulDamageZeroOriginalRaw>> | undefined, prefixes = 0;
                        const driver = createDamageZeroSavingThrowRoomChoiceDriver({ map: source.prepared.map, characters: () => source.prepared.characters, parentTransactionId: () => identity.parentId, authorityUnchanged: () => true, choose: async () => { expect((await loadParent(identity)).sourceKind).toBe('damage-zero-preparation-v1'); return proof.featureId; }, originalRaw: { prepare: op => captureBountifulDamageZeroOriginalPreparation(op, gateway, loadParent), create: async (op, labels) => { issued = await createBountifulDamageZeroOriginalRaw(op, gateway, load, labels, loadParent); return issued; }, onPrefix: async (selection) => { prefixes++; expect(selection.operation).toBe(freshOp); expect(selection.requiresBountiful).toBe(true); } }, rollDice: async (count, sides, label, targetName, ctx) => { physical++; if (!ctx.bountifulDamageZeroOriginalDice || !issued)
                                throw Error('Actual newly activated raw route required'); const slot = await readBountifulDamageZeroOriginalDiceRoute(ctx.bountifulDamageZeroOriginalDice), p = { ...identity, requestId: slot.requestId, rollerTokenId: 'soul-token', targetCharacterId: 'soul', kind: 'dice', count, sides, rollKind: 'saving-throw', label, targetName, delivery: 'player-roll-request', sourceMode: 'dm' }; if (owner === 'host')
                                await issued.recordHostRaw(ctx.bountifulDamageZeroOriginalDice, [1]);
                            else {
                                expect((await http.event('dice-roll-request-dm-to-player', p, data, 'host')).status).toBe(200);
                                expect((await http.event('dice-roll-request-player-to-dm', { ...p, sourceMode: 'player', delivery: 'player-roll-start', values: [1] }, data, 'first-member')).status).toBe(200);
                                expect((await http.event('dice-roll-request-player-to-dm', { ...p, sourceMode: 'player', delivery: 'player-roll-result', values: [1] }, data, 'first-member')).status).toBe(200);
                            } await issued.confirm(ctx.bountifulDamageZeroOriginalDice, [1], [1]); return [1]; } });
                        const choice = await driver.chooseDamageZeroSavingThrow!({ frame: actual.frame, state: actual.snapshot, eventId: actual.frame.id, originalOperation: freshOp });
                        if (!choice || !issued)
                            throw Error('Actual activated original required');
                        expect(physical).toBe(1);
                        expect(prefixes).toBe(1);
                         const observer=(which:'before'|'proposed',side:'dm'|'pc')=>{const posts:any[]=[],tasks:Promise<void>[]=[];const js=ts.transpileModule('const actualObserver='+actualEventObservers[which],{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;return{posts,tasks,receive:new Function('dicePosts','diceTasks','side',js+';return actualObserver;')(posts,tasks,side)as(response:any)=>void}};
                         const beforeDm=observer('before','dm'),afterDm=observer('proposed','dm'),beforePc=observer('before','pc'),afterPc=observer('proposed','pc'),sent:Array<{url:string;body:any;status:number;response:any}>=[];const originalAuth={...auth.value};Object.assign(auth.value,{roomToken:'actual-fixture-membership'});
                         vi.stubGlobal('fetch',async(url:string|URL,options?:RequestInit)=>{const u=new URL(String(url));expect(u.pathname.startsWith('/api/events/')).toBe(true);const channel=decodeURIComponent(u.pathname.slice('/api/events/'.length)),body=JSON.parse(String(options?.body)),headers=new Headers(options?.headers),member=headers.get('x-stars-member')!;expect(headers.get('x-stars-protocol')).toBe('5');expect(member).toBe(auth.value.memberId);expect(Object.hasOwn(body,'channel')).toBe(false);const result=await http.event(channel,body,data,member);sent.push({url:String(url),body,status:result.status,response:result.payload});const response={request:()=>({method:()=>options?.method,postDataJSON:()=>JSON.parse(String(options?.body)),postData:()=>String(options?.body)}),url:()=>String(url),status:()=>result.status,json:async()=>result.payload};const observers=member==='host'?[beforeDm,afterDm]:[beforePc,afterPc];for(const one of observers)one.receive(response);await Promise.all(observers.flatMap(one=>one.tasks));return new Response(JSON.stringify(result.payload),{status:result.status,headers:{'Content-Type':'application/json'}})});
                         try{const current=await issued.read(),slot=current.rows[0],presentation={...identity,requestId:slot.requestId+':dm-confirmed',rollerTokenId:'soul-token',targetCharacterId:'soul',kind:'dice',count:1,sides:20,rollKind:'saving-throw',sourceMode:'dm',delivery:'broadcast-result',values:[1]};await publishSharedEvent('dice-roll-request-dm-to-player',presentation);expect(sent[0].status).toBe(200);expect(beforeDm.posts).toHaveLength(0);expect(afterDm.posts).toHaveLength(1);expect(afterDm.posts[0]).toMatchObject({side:'dm',status:200,channel:'dice-roll-request-dm-to-player',payload:presentation});
                           if(owner==='player'){auth.value={...auth.value,memberId:'first-member',role:'player'};const start={...presentation,requestId:slot.requestId,sourceMode:'player',delivery:'player-roll-start'};await publishSharedEvent('dice-roll-request-player-to-dm',start);expect(beforePc.posts).toHaveLength(0);expect(afterPc.posts.filter(row=>row.payload.requestId===slot.requestId&&row.payload.delivery==='player-roll-start')).toHaveLength(1);expect(afterPc.posts[0].payload.values).toEqual(slot.raw!.values);const actual=sent[1];afterPc.receive({request:()=>({method:()=> 'POST',postDataJSON:()=>actual.body,postData:()=>JSON.stringify(actual.body)}),url:()=>actual.url,status:()=>actual.status,json:async()=>actual.response});await Promise.all(afterPc.tasks);expect(afterPc.posts.filter(row=>row.payload.delivery==='player-roll-start')).toHaveLength(2);}
                           auth.value={...auth.value,memberId:'host',role:'dm'};await expect(publishSharedEvent('dice-roll-request-dm-to-player',{...presentation,count:2})).rejects.toThrow('exact-issued-pool-required');expect(afterDm.posts.filter(row=>row.status>=400)).toHaveLength(1);expect(afterDm.posts.at(-1)).toMatchObject({status:403,channel:'dice-roll-request-dm-to-player'});expect(beforeDm.posts).toHaveLength(0);
                           const count=afterDm.posts.length;afterDm.receive({request:()=>({method:()=> 'POST',postDataJSON:()=>({channel:'dice-roll-request-player-to-dm',payload:presentation}),postData:()=>''}),url:()=> 'http://localhost/api/events/room-presence?room=room',status:()=>200,json:async()=>({ok:true})});await Promise.all(afterDm.tasks);expect(afterDm.posts).toHaveLength(count);expect(data).toEqual(originalData);
                         }finally{vi.unstubAllGlobals();auth.value=originalAuth}

                        expect((await loadParent(identity)).sourceKind).toBe('damage-zero-original-v1');
                        expect((await issued.read()).rows[0]).toMatchObject({ raw: { values: [1] }, confirmed: { values: [1] } });
                        const pending = fresh.resumeDamageZeroSavingThrow(cold.source.prepared.state, actual.frame, choice);
                        expect(pending.status).toBe('pending-ally-natural-one');
                        const qualified = await captureBountifulDamageZeroOriginalQualification(pending, issued);
                        expect(readBountifulDamageZeroOriginalQualification(qualified.qualification, qualified.source).effectTimestamp).toBe(session.originalEffectTimestamp());
                        expect(data).toEqual(originalData);
                        expect(data['player-action-ack']).toBeUndefined();
                    }
                    finally {
                        fresh.cancel();
                    }
                }
                finally {
                    delay.mockRestore();
                }
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
