import{validateSharedStateShape}from'../../../scripts/shared-server-core.mjs'
/// <reference types="node" />
import ts from'typescript'
import vm from'node:vm'
import actualPage from'/src/pages/MapsWorkspacePage.tsx?raw'
import{createCombatInterrupt}from'../../lib/combatInterruptQueue'
import{requestAndWaitForCombatInterrupt}from'../../lib/combatInterruptRequestRuntime'
import{dnd5ePluginFeatureDefinition}from'./plugins/pluginContentCatalog'
import{bountifulReadyHttpFixture}from'./bountifulLuck.ready-authority.testSupport'
import {captureBountifulOriginalRawIssuer} from './bountifulOriginalRawIssuer'
import { assertBountifulHttpAction } from './bountifulLuck.httpAppendFixture.testSupport';
import { createBountifulPersistentRoomUI } from './bountifulLuckPersistentRoomUI';
import { submitBountifulOwnerChoice, isBountifulChoiceContext } from './bountifulLuckClientCommands';
import { createDmDiceConfirmationQueue } from '../../presentation/maps/dmDiceConfirmationQueue';
import { dnd5eWeaponAttackProfile } from './equipment';
import type { Character } from '../../types/character';
import { durableD20RollId } from '../../lib/rollConfirmation';
import { syncCharacterClassResources } from '../../lib/classResources';
import { beginBountifulEquipmentOriginal } from './bountifulLuckEquipmentOriginal';
import { it, expect, vi } from 'vitest';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { normalizeCharacter } from '../../store/characters';
import { prepareDnd5eEquipmentAttack } from './equipmentAttackAction';
import { applyDnd5eInventoryMutation } from './items';
import type { BattleMap } from '../../store/maps';
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes';
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway';
import { driveBountifulOriginalParent, BountifulOriginalParentPending } from './bountifulLuckPersistentRoomDriver';
const session = vi.hoisted(() => ({ value: { roomId: 'room', memberId: 'host', role: 'dm' } }));
vi.mock('../../lib/roomSession', () => ({ getRoomSession: () => session.value }));
function hero(options: {
    current?: number;
    attuned?: boolean;
    identified?: boolean;
} = {}): Character {
    return normalizeCharacter({
        id: 'hero',
        name: 'Hero',
        player: 'Player',
        charClass: 'Fighter',
        level: 1,
        maxHp: 12,
        currentHp: 12,
        equipment: {
            mainWeapon: {
                id: 'plugin:blade',
                name: 'Fate Blade',
                slot: 'mainWeapon',
                dnd5e: {
                    kind: 'weapon', category: 'martial', mode: 'melee',
                    damage: { count: 1, sides: 8, type: 'slashing' }, attackAbility: 'str', reachFeet: 5,
                },
            },
        },
        dnd5eInventory: {
            schemaVersion: 3,
            revision: 0,
            entries: [{
                    instanceId: 'blade-1',
                    templateId: 'plugin:blade',
                    quantity: 1,
                    acquiredAt: 1,
                    equippedSlot: 'mainWeapon',
                    attuned: options.attuned ?? true,
                    identified: options.identified ?? true,
                    item: {
                        id: 'plugin:blade',
                        name: 'Fate Blade',
                        category: 'equipment',
                        icon: 'weapon',
                        description: 'Test item',
                        rulesText: 'Test item',
                        stackable: false,
                        equipment: {
                            id: 'plugin:blade',
                            name: 'Fate Blade',
                            slot: 'mainWeapon',
                            dnd5e: {
                                kind: 'weapon', category: 'martial', mode: 'melee',
                                damage: { count: 1, sides: 8, type: 'slashing' }, attackAbility: 'str', reachFeet: 5,
                            },
                        },
                        magicItem: { kind: 'weapon', rarity: 'rare', attunement: 'required', automation: 'headless' },
                        resources: [{ id: 'charges', label: 'Charges', maximum: 4, resetOn: 'dawn' }],
                        headlessEffects: [{
                                schemaVersion: 1,
                                id: 'attack-reroll',
                                kind: 'attack-roll-reroll',
                                resourceId: 'charges',
                                maximumDice: 1,
                                trigger: 'after-attack-roll',
                                appliesTo: 'attacks-with-this-weapon',
                            }],
                        source: { book: 'Test', license: 'CC0' },
                    },
                    resources: {
                        charges: {
                            id: 'charges', label: 'Charges', current: options.current ?? 4, maximum: 4, resetOn: 'dawn',
                        },
                    },
                }],
        },
    });
}
it.each([17, 1])('actual BL finalized die remains protected while an independent original die uses a real active charged equipment source (%i)', async (replacement) => {
    session.value = { roomId: 'room', memberId: 'host', role: 'dm' };
    const { package: pkg } = await prepareDnd5eLocalContentJson("{\"name\":\"DM 本地规则\",\"version\":\"1.0.0\",\"races\":[],\"backgrounds\":[],\"features\":[],\"feats\":[{\"id\":\"bountiful-luck\",\"name\":\"慷慨吉运\",\"summary\":\"半身人可用反应帮助附近可见盟友重骰攻击、技能或豁免检定中掷出的1。\",\"description\":\"先决条件为半身人。当你周围30尺内你可见的盟友在攻击检定、技能检定或豁免检定的d20中掷出1时，你可以使用反应使其重骰一次；盟友必须接受新的结果。使用此能力后，直到你的下个回合结束前，你无法使用幸运种族特性。\",\"automation\":\"full\",\"prerequisite\":{\"raceIds\":[\"halfling\"]},\"declarativeAbility\":{\"schemaVersion\":1,\"id\":\"bountiful-luck\",\"name\":\"慷慨吉运\",\"description\":\"先决条件为半身人。当你周围30尺内你可见的盟友在攻击检定、技能检定或豁免检定的d20中掷出1时，你可以使用反应使其重骰一次；盟友必须接受新的结果。使用此能力后，直到你的下个回合结束前，你无法使用幸运种族特性。\",\"level\":1,\"trigger\":{\"kind\":\"after-d20-roll\"},\"cost\":{\"economy\":\"reaction\"},\"targeting\":{\"kind\":\"single-creature\",\"relation\":\"ally\",\"rangeFeet\":30,\"requiresSight\":true,\"includeSelf\":false},\"effects\":[],\"automation\":\"full\",\"mechanic\":{\"kind\":\"ally-natural-one-reroll\"}}}],\"spells\":[],\"items\":[],\"abilityGenerationMethods\":[],\"headlessActions\":[],\"activities\":[],\"classes\":[],\"subclasses\":[],\"monsters\":[]}");
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg));
    const disposeExtra = registerDnd5eRulesPlugin({ manifest: { id: 'test.bound-extra', name: 'Extra die', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0' }, setup(api) { api.registerFeat({ id: 'accuracy', name: 'Extra die', summary: 'Extra die', description: 'A real registered advantage-only test feature', automation: 'full', resources: [{ id: 'uses', label: 'Uses', maximum: 1, resetOn: 'long-rest' }], declarativeAbility: { schemaVersion: 1, id: 'accuracy', name: 'Extra die', description: 'Extra die', level: 1, trigger: { kind: 'after-d20-roll' }, targeting: { kind: 'self' }, effects: [], automation: 'full', cost: { economy: 'none', resources: [{ resourceId: 'uses', amount: 1 }] }, mechanic: { kind: 'd20-choice-reroll', rollKinds: ['attack'], scopes: ['self-roll'], additionalDice: 1, selection: 'highest', requiresAdvantage: true, attackAbilities: ['dex', 'int', 'wis', 'cha'] } } }); } });
    try {
        const make = (id: string, feat: boolean) => normalizeCharacter({ id, name: id, roomMemberId: id === 'ally' || id === 'first' ? 'host' : id + '-member', race: '半身人', dnd5eRaceId: 'halfling', charClass: '战士', level: 4, abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 10 }, currentHp: 30, maxHp: 30, dnd5eFeatIds: feat ? [pkg.manifest.id + ':bountiful-luck'] : [] });
        const actor = syncCharacterClassResources({ ...make('ally', false), rulesetId: 'dnd5e-2014-srd-5.1', dnd5eFeatIds: ['test.bound-extra:accuracy'] });
        actor.race = '人类';
        actor.dnd5eRaceId = 'human';
        actor.inspiration = 1;
        actor.dnd5eCombatState = { bardicInspirationDie: 6, bardicInspirationSourceId: 'first-token', bardicInspirationRoundsRemaining: 10 };
        actor.equipment = hero().equipment;
        actor.dnd5eInventory = hero().dnd5eInventory;
        const characters = [applyDnd5eInventoryMutation([actor], { type: 'grant', characterId: actor.id, templateId: 'srd-5.1:item:arrows', quantity: 20 }).characters[0], make('first', true), make('second', true), make('target', false)];
        const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: characters.map((c, index) => ({ id: c.id + '-token', characterId: c.id, type: index === 3 ? 'enemy' : 'player', label: c.name, x: index === 0 ? 25 : index === 3 ? 75 : index === 1 ? 125 : 175, y: 25, size: 1, color: '', emoji: '' })) };
        const action: SharedPlayerActionState = { id: 'parent', mapId: 'map', combatId: 'combat', sourceMode: 'dm', status: 'pending', roomMemberId: 'host', type: 'dnd5e-weapon-attack', actorTokenId: 'ally-token', characterId: 'ally', targetTokenId: 'target-token', round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
        const prepared = prepareDnd5eEquipmentAttack({ action, map, characters, attacksUsed: 0, initiativeOrder: map.tokens.map((token, index) => ({ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 20 - index })) });
        if (!prepared.ok)
            throw Error(prepared.reason + ': ' + JSON.stringify({ profile: dnd5eWeaponAttackProfile(characters[0]), weapon: characters[0].equipment?.mainWeapon }));
        prepared.prepared.attackMode = 'advantage';
        type Resource = {
            _sync: {
                revision: number;
            };
            [key: string]: unknown;
        };
        let data: Record<string, Resource> = { combat: { _sync: { revision: 1 }, active: true, mapId: 'map', combatId: 'combat', round: 1, initiativeIndex: 0 }, characters: { _sync: { revision: 2 }, characters }, maps: { _sync: { revision: 3 }, maps: [map] }, 'player-action-requests': { _sync: { revision: 4 }, requests: [action] } };
        data['player-action-ack'] = { _sync: { revision: 0 }, id: '' };
        data['player-action-processed'] = { _sync: { revision: 0 }, actionIds: [] };for(const value of Object.values(data))Object.assign(value._sync,{schemaVersion:1,writerId:'host',writtenAt:1});expect(validateSharedStateShape('characters',data.characters)).toMatchObject({ok:true});
        const writes: string[][] = [];
        const gateway: Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'> = { loadResource: async <T>(name: string) => structuredClone(data[name] ?? null) as T, saveResourcesAtomically: async (batch, options) => { for (const write of batch)
                expect(write.expectedRevision).toBe(data[write.name]._sync.revision); for (const [name, value] of Object.entries(options?.readRevisions ?? {}))
                expect(data[name]?._sync.revision ?? 0).toBe(value); const next = structuredClone(data); for (const write of batch)
                next[write.name] = { ...write.data as object, _sync: { revision: data[write.name]._sync.revision + 1 } }; data = next; writes.push(batch.map(row => row.name)); return { status: 'committed', transactionId: options?.transactionId ?? '', revisions: {} }; } };
        const rawRollId = durableD20RollId({ mapId: 'map', sourceMode: 'dm', transactionId: 'parent', occurrenceIndex: 0 }) + ':pool:2d20';
        const source = { prepared: prepared.prepared, d20: 1, d20Second: 1, damageRolls: [] as number[], ...captureBountifulOriginalRawIssuer({mapId:'map',parentId:'parent',mode:'dm',rollId:rawRollId,cursor:1,raw:[1,1]}) };
        await expect(beginBountifulEquipmentOriginal({ action, source }, gateway, { showChoice: async () => { }, requestRoll: async () => { } })).rejects.toBeInstanceOf(BountifulOriginalParentPending);
        const untouched = structuredClone(data.characters);
        // A closed or unanswered UI does not manufacture a decline or any cost.
        await expect(driveBountifulOriginalParent({ mapId: 'map', parentId: 'parent' }, gateway, { showChoice: async () => { }, requestRoll: async () => { } })).rejects.toBeInstanceOf(BountifulOriginalParentPending);
        expect(data.characters).toEqual(untouched);
        const http = await bountifulReadyHttpFixture();
        try {
            const client = { loadResource: gateway.loadResource, appendPlayerActionRequest: async (action: unknown) => {
                    assertBountifulHttpAction(action);
                    if (session.value.role === 'dm') {
                        const stale = structuredClone(data);
                        stale.characters._sync.revision++;
                        expect((await http.append({ ...action, id: action.id + ':stale' }, stale, 'host')).status).toBe(403);
                        expect((await http.append({ ...action, id: action.id + ':foreign', actorTokenId: 'target-token' }, data, 'host')).status).toBe(403);
                        if (action.bountifulLuck?.command.phase === 'confirm') {
                            expect((await http.append(action, data, 'ally-member')).status).toBe(403);
                            expect((await http.append(action, data, 'spectator')).status).toBe(403);
                        }
                    }
                    const result = await http.append(action, data, session.value.memberId);
                    expect(result.status, JSON.stringify(result.payload)).toBe(200);
                    const saved = result.queue.requests.find(row => row.id === action.id);
                    if (!saved)
                        throw Error('Actual server did not persist the original client action');
                    expect(saved.sourceMode).toBe(session.value.role === 'dm' ? 'dm' : 'player');
                    expect(saved.roomMemberId).toBe(session.value.memberId);
                    data['player-action-requests'] = result.queue;
                    expect((await http.append({ ...action, updatedAt: action.updatedAt + 1 }, data, session.value.memberId)).status).toBe(200);
                } };
            let originalRolls = 0, confirmations = 0;
            const confirmer = createDmDiceConfirmationQueue(async (request) => { confirmations++; expect(request.values).toEqual([1]); return [replacement]; });
            let oldChoiceId='',upserts=0;const mutate=async(operation:unknown,member='host')=>{const r=await http.state('PATCH','combat-interrupts/interrupt',operation,data,member);if(r.status===200)data['combat-interrupts']=r.saved;else console.info('SINGLE ACTUAL PATCH',JSON.stringify({operation,status:r.status,payload:r.payload,rows:(data['combat-interrupts']?.interrupts as any[]|undefined)?.map((row:any)=>({id:row.id,actorCharId:row.actorCharId,audience:row.payload?.audience,status:row.status})),owners:(data.characters.characters as any[]).map(row=>({id:row.id,owner:row.roomMemberId}))}));return r};const parsedPage=ts.createSourceFile('actualPage.tsx',actualPage,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),ports:ts.ArrowFunction[]=[];const scan=(node:ts.Node)=>{if(ts.isCallExpression(node)&&node.expression.getText(parsedPage)==='createBountifulPersistentRoomUI'){const arg=node.arguments[0];if(ts.isObjectLiteralExpression(arg)){const finish=arg.properties.find(p=>p.name?.getText(parsedPage)==='finishChoice');if(finish&&ts.isPropertyAssignment(finish)&&ts.isArrowFunction(finish.initializer))ports.push(finish.initializer)}}ts.forEachChild(node,scan)};scan(parsedPage);const chosen=ports.find(p=>p.getText(parsedPage).includes('common.map.id'));const finishChoice=chosen?vm.runInNewContext('('+chosen.getText(parsedPage)+')',{common:{map},finishSharedCombatInterrupt:async(id:string,response:unknown,mapId:string)=>{expect(mapId).toBe('map');const r=await mutate({operation:'finish',mapId,id,response});expect(r.status,JSON.stringify(r.payload)).toBe(200)}}) as(id:string,response:unknown)=>Promise<void>:undefined;const ui = createBountifulPersistentRoomUI({ finishChoice,map, characters: () => characters, gateway: client, round: () => 1, initiativeIndex: () => 0,
                choose: async (request) => {
const selectedActual=await requestAndWaitForCombatInterrupt({id:request.id,channel:{current:null},metadata:{},loadExisting:async()=>((data['combat-interrupts']?.interrupts??[])as any[]).find(row=>row.id===request.id),decideExisting:row=>!row?{type:'publish'}:row.status==='pending'?{type:'wait'}:{type:'resolve',value:(row.response as{optionId:string}).optionId},create:()=>createCombatInterrupt({id:request.id,transactionId:request.transactionId,mapId:'map',kind:'plugin-choice',phase:'before-hit',actorCharId:request.actor?.id,payload:{pluginId:request.pluginId,featureId:request.featureId,featureName:request.featureName,prompt:request.prompt,audience:request.audience,options:request.options,defaultOptionId:request.defaultOptionId,...request.context},expiresAt:Date.now()+60000}),publish:async interrupt=>{upserts++;const r=await mutate({operation:'upsert',mapId:'map',interrupt});expect(r.status,JSON.stringify(r.payload)).toBe(200)}});expect(selectedActual).toBe(request.actor?.id==='first'?request.options[2].id:'decline');

                    const context = request.context?.bountifulLuck;
                    if (!isBountifulChoiceContext(context))
                        throw Error('Actual original reaction context missing');
                    const own = context.characterId === 'first';
                    expect(request.audience).toBe(own ? 'dm' : 'actor');
                    session.value = own ? { roomId: 'room', memberId: 'host', role: 'dm' } : { roomId: 'room', memberId: context.characterId + '-member', role: 'player' };
                    const selected = own ? context.featureId : 'decline';
                    await submitBountifulOwnerChoice({ mapId: 'map', context, optionId: selected, round: 1, initiativeIndex: 0 }, client);
                    session.value = { roomId: 'room', memberId: 'host', role: 'dm' };
                    return selected;
                },
                rollD20: async (_label, _target, owner) => { originalRolls++; expect(owner.rollerTokenId).toBe('ally-token'); expect(owner.skipDmConfirmation).toBe(true); return 1; },
                confirmRetainedD20: async (id, label, targetName, value) => (await confirmer({ id, label, targetName, sides: 20, values: [value], visibility: 'public' }))[0],
            });
            const stage = await beginBountifulEquipmentOriginal({ action, source }, gateway, {requestRoll:ui.requestRoll,showChoice:async receipt=>{const option=receipt.request.options[0],definition=dnd5ePluginFeatureDefinition(option.featureId)!;if(!definition)throw Error('Real source feat required');const context={parentId:receipt.identity.parentId,occurrence:receipt.identity.occurrence,combatId:'combat',actorTokenId:option.ownerId,characterId:receipt.controllers[option.ownerId].characterId,ownerId:option.ownerId,featureId:option.featureId};oldChoiceId='actual-single-owner-before-reload:'+receipt.identity.occurrence;const interrupt=createCombatInterrupt({id:oldChoiceId,transactionId:action.id,mapId:'map',kind:'plugin-choice',phase:'before-hit',actorCharId:context.characterId,payload:{pluginId:definition.ownerPluginId,featureId:definition.id,featureName:definition.name,prompt:'Actual single original owner pre-reload',audience:receipt.controllers[option.ownerId].memberId==='host'?'dm':'actor',options:[{id:'pending',label:'Later'},{id:'decline',label:'Keep reaction'},{id:definition.id,label:'Use'}],defaultOptionId:'pending',bountifulLuck:context},expiresAt:Date.now()+60000});upserts++;expect((await mutate({operation:'upsert',mapId:'map',interrupt})).status).toBe(200);expect((await mutate({operation:'answer',mapId:'map',id:oldChoiceId,response:{optionId:context.characterId==='first'?definition.id:'decline'}},receipt.controllers[option.ownerId].memberId??'host')).status).toBe(200);try{await ui.showChoice(receipt)}catch(error){console.info('SINGLE ACTUAL UI',String(error));throw error}expect(((data['combat-interrupts'].interrupts??[])as any[]).find(row=>row.id===oldChoiceId)?.status).toBe('done');expect(upserts).toBe(receipt.identity.occurrence+1)}});
            if (!stage)
                throw Error('Actual original Host stage was not resumed');
            expect(stage.originalReady.values).toEqual([replacement, 1]);
            expect(stage.originalReady.finalizedDice).toEqual([0]);
            expect(originalRolls).toBe(1);
            expect(confirmations).toBe(1);
            const first = stage.receipts[0];
            expect(first.rawReroll).toMatchObject({ memberId: 'host', value: 1 });
            expect(first.hostReroll).toMatchObject({ memberId: 'host', rawValue: 1, value: replacement });
            expect(first.ownerDecisions).toContainEqual(expect.objectContaining({ ownerId: 'first-token', memberId: 'host', decision: 'use' }));
            expect(data.characters).toEqual(untouched);
            expect(writes.filter(names => names.includes('characters'))).toHaveLength(0);
        }
        finally {
            await http.close();
        }
    }
    finally {
        disposeExtra();
        dispose();
    }
});
