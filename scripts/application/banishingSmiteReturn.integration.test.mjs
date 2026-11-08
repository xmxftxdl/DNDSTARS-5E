// Self-contained component regression: test-owned minimal spell definition,
// actual Map cast/weapon hit/server owner command and existing room/fall ports.
// No private package, source PDF or .codex-temp implementation dependency.
import {automationCapabilityFromLegacyStatus} from '../../src/domain/automation/automationCapability'
const ns='test.banishing-return-fixture',automation=automationCapabilityFromLegacyStatus('full'),source={kind:'spell',id:'banishing-smite',magical:true}
const banishingActivities=[{
 schemaVersion:1,id:'banishing-smite',name:'放逐斩',legacySource:source,automation,activation:{kind:'bonus-action'},target:{kind:'self'},
 consumption:[{kind:'spell-slot',minimumLevel:5,level:'selected',amount:1,consumeOn:'resolve'},{kind:'action-economy',economy:'bonus-action',amount:1,consumeOn:'resolve'}],
 effects:[{schemaVersion:1,id:'banishing-smite-controller',name:'放逐斩·专注',captureExecutionIdentity:true,magical:true,concentration:true,duration:{kind:'concentration',maximumRounds:10},stacking:'replace'},
 {schemaVersion:1,id:'banishing-smite-primed',name:'放逐斩·待命中',magical:true,concentration:true,duration:{kind:'concentration',maximumRounds:10},stacking:'replace',grants:['banishing-smite-hit'],grantsSingleUse:true}],
 outcomes:[{id:'prime',when:{kind:'always'},operations:[{id:'controller',kind:'apply-effect',target:'actor',effectId:'banishing-smite-controller'},{id:'prime',kind:'apply-effect',target:'actor',effectId:'banishing-smite-primed'}]}]
},{schemaVersion:1,id:'banishing-smite-hit',name:'放逐斩·命中',legacySource:source,automation,activation:{kind:'free'},requiresEffectGrant:true,
 invocation:{kind:'triggered',event:'attack-hit',confirmation:'automatic',retention:'single-event'},target:{kind:'creature',relation:'any',count:1},requirements:[{kind:'attack-category',category:'weapon'}],
 outcomes:[{id:'extra',when:{kind:'always'},operations:[{id:'extra',kind:'damage',target:'target',amount:{kind:'dice',rollId:'banishing-force',count:5,sides:10},damageType:'force',magical:true,critical:'double-dice'},
 {id:'banish',kind:'weapon-hit-banishment',target:'target',maximumHitPoints:50}]}]
}]
function requiredSpellBundleV3(){return{format:'dndstars5e-unified-content',schemaVersion:1,manifest:{id:ns,name:'Banishing return test fixture',version:'0.1.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},assets:[],definitions:[{schemaVersion:1,namespace:ns,version:'0.1.0',kind:'spell',id:'banishing-smite',name:'Banishing test spell',automation,activities:banishingActivities,payload:{id:'banishing-smite',name:'Banishing test spell',level:5,school:'abjuration',ritual:false,castingTime:{value:1,unit:'bonus-action'},range:{type:'self'},components:{verbal:true,somatic:false,material:false},duration:{type:'timed',value:1,unit:'minute',concentration:true},classes:['paladin'],description:'Self-contained automatic next weapon hit and native return component fixture.'}}]}}

import { createDnd5eMapCombatSnapshot } from '../../src/rulesets/dnd5e/mapBridge';
import { resolveDnd5eActionWithDamageReactions } from '../../src/rulesets/dnd5e/damageReactionFlow';
import { registerDnd5eRulesPlugin } from '../../src/rulesets/dnd5e/pluginApi';
import { dnd5eRulesPluginFromUnifiedContentBundleV1 } from '../../src/rulesets/dnd5e/unifiedContent';
import { normalizeCharacter } from '../../src/store/characters';
import { syncCharacterClassResources } from '../../src/lib/classResources';
import { applyDnd5eInventoryMutation } from '../../src/rulesets/dnd5e/items';
import { prepareDnd5ePluginSpellCast, resolvePreparedDnd5ePluginSpellCast } from '../../src/rulesets/dnd5e/pluginSpellTransaction';
import { dnd5eWeaponClassDamageDefinitions, resolveDnd5eHeadlessAction } from '../../src/rulesets/dnd5e/headlessCombatEngine';
import { dnd5eWeaponAttackProfile } from '../../src/rulesets/dnd5e/equipment';
async function actualBanishingHit(options = {}) {
    const row = { hp: options.hp ?? 61, temp: 0, ranged: options.ranged ?? false, critical: false, origin: options.origin ?? 'native' }, delayedRounds = 0, reaction = false;
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(requiredSpellBundleV3()));
    try {
        const spellId = ns + ':banishing-smite';
        let owner = syncCharacterClassResources(normalizeCharacter({ id: 'hero', name: 'Paladin', charClass: '圣武士', level: options.level ?? 17, dnd5eClassLevels: { paladin: options.level ?? 17 }, abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 10, cha: 18 }, equipment: {}, dnd5eInventory: { schemaVersion: 1, entries: [] }, dnd5eClassChoices: { classes: { paladin: { subclass: 'devotion', selections: { 'spell-prepared': [spellId] } } } } }));
        const grant = applyDnd5eInventoryMutation([owner], { type: 'grant', characterId: 'hero', templateId: row.ranged ? 'srd-5.1:equipment:dnd5e-longbow' : 'srd-5.1:equipment:dnd5e-longsword', quantity: 1 });
        expect(grant.ok).toBe(true);
        const instance = grant.characters[0].dnd5eInventory.entries[0].instanceId;
        const equip = applyDnd5eInventoryMutation(grant.characters, { type: 'equip', characterId: 'hero', instanceId: instance, slot: 'mainWeapon' });
        expect(equip.ok).toBe(true);
        owner = equip.characters[0];
        if (options.worldMinute != null)
            owner = { ...owner, dnd5eWorldTimeAppliedMinute: options.worldMinute };
        const map = { id: 'elemental-map', name: 'Map', width: 1000, height: 1000, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [{ id: 'hero-token', label: 'Paladin', type: 'player', characterId: 'hero', x: 225, y: 225, size: 1, color: '#ffffff', emoji: 'H' }, { id: 'enemy', label: 'Enemy', type: 'enemy', poolId: 'srd-5.1:goblin', hp: row.hp, maxHp: 100, x: 275, y: 225, elevationFeet: options.elevationFeet ?? 0, size: 1, color: '#ffffff', emoji: 'E' }] };
        const ready = prepareDnd5ePluginSpellCast({ worldMinute: options.worldMinute, map, characters: [owner], initiativeOrder: map.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, emoji: t.emoji, color: t.color, roll: 20 - i })), action: { id: 'actual-elemental-cast', type: 'dnd5e-spell-cast', sourceMode: 'player', status: 'pending', mapId: map.id, combatId: 'Elemental-Ab', actorTokenId: 'hero-token', characterId: 'hero', targetTokenId: 'hero-token', round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1, dnd5eSpellCast: { spellId, castingClassId: 'paladin', slotLevel: 5, targetTokenId: 'hero-token' } } });
        expect(ready.ok, JSON.stringify(ready)).toBe(true);
        if (!ready.ok)
            throw Error('Actual Elemental cast could not prepare');
        const cast = resolvePreparedDnd5ePluginSpellCast({ prepared: ready.prepared, rolls: {} });
        expect(cast.result.ok, JSON.stringify(cast.result)).toBe(true);
        if (!cast.result.ok || !cast.application)
            throw Error('Actual Elemental cast did not commit');
        expect(cast.result.state.combatants['hero-token'].concentrating).toBe(true);
        const actualController = cast.result.state.combatants['hero-token'].classState.activeEffects?.find(e => e.captureExecutionIdentity === true);
        expect(actualController?.source.executionId).toBe('actual-elemental-cast');
        const slots = cast.result.state.combatants['hero-token'].classResources['dnd5e-spell-slot-5'];
        expect(slots.current).toBe(owner.classResources['dnd5e-spell-slot-5'].current - 1);
        const profile = dnd5eWeaponAttackProfile(cast.application.characters[0]);
        if (!profile)
            throw Error('Actual weapon missing');
        const mapForAttack = options.insideAntimagic ? { ...cast.application.map, dnd5ePluginAreas: [{ id: 'anti', pluginId: 'test.environment', featureId: 'antimagic', label: 'Antimagic', color: '#9955ff', sourceTokenId: 'enemy', sourceCharacterId: 'enemy', anchorCell: { col: 4, row: 4 }, cells: [{ col: 4, row: 4 }], createdRound: 1, expiresAfterRound: 1000, includeSelf: true, relation: 'any', occupantModifiers: { suppressesMagic: true }, vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 } }] } : cast.application.map;
        let attackState = options.insideAntimagic ? createDnd5eMapCombatSnapshot({ map: mapForAttack, characters: cast.application.characters, combatId: 'Elemental-Ab', initiativeOrder: map.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, emoji: t.emoji, color: t.color, roll: 20 - i })) }).state : cast.result.state;
        attackState.combatants.enemy.temporaryHp = row.temp;
        for (let i = 0; i < delayedRounds; i++) {
            const end = resolveDnd5eHeadlessAction(attackState, { type: 'end-turn', actorId: 'hero-token' });
            expect(end.ok).toBe(true);
            const next = resolveDnd5eHeadlessAction(end.state, { type: 'end-turn', actorId: 'enemy' });
            expect(next.ok).toBe(true);
            attackState = next.state;
        }
        if (reaction) {
            const turn = resolveDnd5eHeadlessAction(attackState, { type: 'end-turn', actorId: 'hero-token' });
            expect(turn.ok).toBe(true);
            attackState = turn.state;
        }
        const remaining = attackState.combatants['hero-token'].classState.concentrationRoundsRemaining;
        const context = { mode: row.ranged ? 'ranged' : 'melee', strengthBased: !row.ranged, finesse: false, weaponId: profile.weaponId, weaponBaseId: profile.baseWeaponId, weaponCategory: 'martial', weaponDamageSides: profile.damage.sides, damageType: row.ranged ? 'piercing' : 'slashing', adjacentEnemyOfTarget: false };
        const definitions = dnd5eWeaponClassDamageDefinitions({ state: attackState, actorId: 'hero-token', targetId: 'enemy', context, critical: row.critical });
        const rolled = [];
        const factRequests = [];
        const result = await resolveDnd5eActionWithDamageReactions({ state: attackState, combatRevision: 1, authorityUnchanged: () => true, replayEventBatchId: 'banishing-parent-Ab:' + 'fixture', confirmPlanarOrigin: async (request) => { factRequests.push(request); return row.origin; },
            action: { type: reaction ? 'opportunity-attack' : 'attack', actorId: 'hero-token', targetId: 'enemy', d20: row.critical ? 20 : 15, attackModifier: profile.attackModifier, damage: { count: 1, sides: profile.damage.sides, rolls: row.critical ? [3, 3] : [3], bonus: profile.damage.bonus, type: row.ranged ? 'piercing' : 'slashing' }, classDamageContext: context, classDamageRolls: definitions.map(d => ({ source: d.source, rollId: d.rollId, rolls: Array.from({ length: d.count * (row.critical && d.doubleOnCritical ? 2 : 1) }, () => 1) })) },
            confirm: async () => { throw Error('Mandatory next-hit spell must not ask actor to accept bonus'); },
            roll: async (request) => { const values = Array.from({ length: request.count }, () => 1); rolled.push({ sides: request.sides, count: request.count, values }); return values; }
        });
        expect(result.ok, JSON.stringify({ ok: result.ok, reason: 'reason' in result ? result.reason : undefined })).toBe(true);
        return { dispose, map, cast, result, owner, profile, context, remaining, rolled, attackState, mapForAttack, factRequests };
    }
    catch (error) {
        dispose();
        throw error;
    }
}

import {it,expect} from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {Readable} from 'node:stream'
import {handleSharedApi,SHARED_PROTOCOL_VERSION} from '../shared-server-core.mjs'
import {planDnd5eMapResultApplication} from '../../src/rulesets/dnd5e/mapBridge'
import {commitCampaignBanishmentReturns,dnd5eBanishmentReturnRoomKey} from '../../src/lib/campaignBanishmentReturnCommit'
import {settleBrowserEtherealExpiry} from '../../src/composition/browserEtherealExpiry'
import {registerTempleExpiryInteraction} from '../../src/composition/templeExpiryInteraction'
import {createEmptyMapGeometry} from '../../src/lib/mapGeometry'
import {normalizeSharedCampaignTime} from '../../src/lib/campaignTime'
import {resolveDnd5eHeadlessAction as resolveRecastTurn} from '../../src/rulesets/dnd5e/headlessCombatEngine'
import {prepareDnd5ePluginSpellCast as prepareRecast,resolvePreparedDnd5ePluginSpellCast as commitRecast} from '../../src/rulesets/dnd5e/pluginSpellTransaction'

async function authorityRoom(map,characters){
 const root=path.resolve('.codex-temp/runtime-temp/banishing-return-http-'+randomUUID()),state=path.join(root,'rooms','room'),lobby=path.join(root,'lobby')
 await fs.mkdir(state,{recursive:true});await fs.mkdir(lobby,{recursive:true})
 const tokens={dm:randomBytes(32).toString('base64url'),player:randomBytes(32).toString('base64url')},hash=value=>createHash('sha256').update(value).digest('hex')
 await fs.writeFile(path.join(lobby,'room.json'),JSON.stringify({id:'room',host:{memberId:'dm',roomTokenHash:hash(tokens.dm)},players:[{memberId:'player',roomTokenHash:hash(tokens.player)}]}))
 const write=async(name,data)=>fs.writeFile(path.join(state,name+'.json'),JSON.stringify(data))
 await write('characters',{characters:characters.map(character=>({...character,roomMemberId:'player'})),_sync:{schemaVersion:1,revision:1,writerId:'fixture-dm',writtenAt:1}})
 await write('maps',{maps:[map],_sync:{schemaVersion:1,revision:2,writerId:'fixture-dm',writtenAt:1}})
 const ctx={stateRoot:root,lobbyRoot:lobby,imageRoot:root,legacyStateRoot:root,legacyImageRoot:root,quarantineRoot:root,snapshotRoot:root,eventClients:new Map(),eventBacklog:new Map(),eventSequences:new Map(),rateLimits:new Map()}
 return{end:async()=>{
  const body={expectedRevision:1,command:{commandId:'real-character-sheet-end-'+randomUUID(),type:'end-concentration',characterId:'hero'}}
  const req=Readable.from([Buffer.from(JSON.stringify(body))]);Object.assign(req,{method:'POST',headers:{'x-stars-member':'player','x-stars-room-token':tokens.player,'x-stars-protocol':String(SHARED_PROTOCOL_VERSION),'x-stars-writer':'fixture-player'},socket:{remoteAddress:'fixture-local'}})
  const res={status:0,body:'',headers:{},setHeader(name,value){this.headers[name]=value},getHeader(name){return this.headers[name]},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers??{})},end(body){this.body=String(body??'')}}
  expect(await handleSharedApi(req,res,new URL('http://localhost/api/state/characters/command?room=room'),ctx)).toBe(true)
  expect(res.status).toBe(201)
  return{characters:JSON.parse(await fs.readFile(path.join(state,'characters.json'),'utf8')).characters,map:JSON.parse(await fs.readFile(path.join(state,'maps.json'),'utf8')).maps[0]}
 }}
}

it.each([false,true])('real authenticated CharacterSheet end returns a native target atomically, source absent=%s',async offscene=>{
 const f=await actualBanishingHit();try{
  const projected=planDnd5eMapResultApplication({state:f.result.state,map:f.map,characters:f.cast.application.characters,characterIdByCombatantId:{'hero-token':'hero'}})
  const room=await authorityRoom(projected.map,projected.characters),ended=await room.end()
  expect(ended.characters[0].concentrating).toBe(false)
  expect(ended.map.tokens.find(token=>token.id==='enemy').dnd5eCombatState.activeEffects.some(effect=>effect.tags?.includes('banishing-smite-native-return'))).toBe(true)
  if(offscene)ended.map={...ended.map,tokens:ended.map.tokens.filter(token=>token.id!=='hero-token')}
  const key=dnd5eBanishmentReturnRoomKey(ended.characters,[ended.map]);expect(key).not.toBe('')
  const clock=normalizeSharedCampaignTime({worldMinute:ended.characters[0].dnd5eWorldTimeAppliedMinute??480})
  const storage={maps:{maps:[ended.map],_sync:{revision:2}},characters:{characters:ended.characters,_sync:{revision:1}},'campaign-time':{...clock,_sync:{revision:3}},'map-geometry':{maps:[createEmptyMapGeometry(ended.map.id)],_sync:{revision:4}},combat:{active:false,_sync:{revision:5}}}
  let commits=0
  const gateway={loadResource:async name=>structuredClone(storage[name]??null),saveResourcesAtomically:async(writes,options)=>{
   expect(writes.map(write=>write.name)).toEqual(['maps','characters']);expect(options.readRevisions).toEqual({'campaign-time':3,'map-geometry':4,combat:5})
   expect(writes.map(write=>write.expectedRevision)).toEqual([2,1]);commits++
   for(const write of writes)storage[write.name]=structuredClone(write.data)
   return{status:'committed',transactionId:'native-return-'+commits,revisions:{maps:3,characters:2}}
  }}
  expect(await commitCampaignBanishmentReturns(gateway,settleBrowserEtherealExpiry,()=>true)).toBe(true)
  expect(commits).toBe(1)
  const target=storage.maps.maps[0].tokens.find(token=>token.id==='enemy')
  expect(target.hp).toBe(50)
  expect(target.dnd5eCombatState.activeEffects??[]).not.toEqual(expect.arrayContaining([expect.objectContaining({tags:expect.arrayContaining(['banishing-smite-native-return'])})]))
  expect(dnd5eBanishmentReturnRoomKey(storage.characters.characters,storage.maps.maps)).toBe('')
  expect(await commitCampaignBanishmentReturns(gateway,settleBrowserEtherealExpiry,()=>true)).toBe(false)
  expect(commits).toBe(1)
 }finally{f.dispose()}
})

it.each(['fall','feather-fall','conflict','stale','unknown','foreign'])('room return preserves the actual %s boundary with an off-scene controller',async branch=>{
 const f=await actualBanishingHit({origin:branch==='foreign'?'foreign':'native'});let unregister
 try{
  const projected=planDnd5eMapResultApplication({state:f.result.state,map:f.map,characters:f.cast.application.characters,characterIdByCombatantId:{'hero-token':'hero'}})
  const ended=await (await authorityRoom(projected.map,projected.characters)).end()
  const blockers=[]
  for(const x of[150,250,350])for(const y of[150,250,350])blockers.push({...f.map.tokens[1],id:`large-${x}-${y}`,poolId:'srd-5.1:ogre',label:'Large ogre',size:2,hp:59,maxHp:59,x,y})
  const wizard=syncCharacterClassResources(normalizeCharacter({id:'wizard',name:'Actual Feather Fall caster',charClass:'法师',level:1,dnd5eClassLevels:{wizard:1},abilities:{str:8,dex:14,con:14,int:16,wis:12,cha:10},dnd5eClassChoices:{classes:{wizard:{selections:{'spell-prepared':['feather-fall']}}}}}))
  const map={...ended.map,tokens:[...ended.map.tokens.filter(token=>token.id!=='hero-token'),...blockers,{...f.map.tokens[0],id:'wizard-token',characterId:'wizard',x:25,y:175}]}
  const clock=normalizeSharedCampaignTime({worldMinute:ended.characters[0].dnd5eWorldTimeAppliedMinute??480})
  const storage={maps:{maps:[map],_sync:{revision:2}},characters:{characters:[...(branch==='unknown'?[]:ended.characters),wizard],_sync:{revision:1}},'campaign-time':{...clock,_sync:{revision:3}},'map-geometry':{maps:[createEmptyMapGeometry(map.id)],_sync:{revision:4}},combat:{active:false,_sync:{revision:5}}}
  const original=structuredClone(storage);let commits=0,choices=0,rolls=0,current=true
  unregister=registerTempleExpiryInteraction({chooseFeatherFall:async(state,falls)=>{
   choices++;expect(falls.find(fall=>fall.combatantId==='enemy')).toMatchObject({fromElevationFeet:10,fallingDamageDice:1})
   expect(state.combatants.enemy.conditions).not.toContain('banished')
   if(branch==='stale')current=false
   return branch==='feather-fall'?{casterId:'wizard-token',targetIds:['enemy']}:undefined
  },rollFalls:async falls=>{
   rolls++;const values={enemy:[4]}
   for(const fall of falls)for(const collision of fall.collisionCandidates??(fall.collision?[fall.collision]:[]))values[collision.rollKey]=[20]
   return values
  },damageReactions:()=>({combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>{throw Error('Unexpected extra damage reaction dice')}})})
  const gateway={loadResource:async name=>structuredClone(storage[name]??null),saveResourcesAtomically:async(writes,options)=>{
   expect(writes.map(write=>write.name)).toEqual(['maps','characters']);expect(options.readRevisions).toEqual({'campaign-time':3,'map-geometry':4,combat:5})
   expect(writes.map(write=>write.expectedRevision)).toEqual([2,1]);if(branch==='conflict')throw Error('state-transaction-conflict:maps')
   commits++;for(const write of writes)storage[write.name]=structuredClone(write.data)
   return{status:'committed',transactionId:'native-room-return',revisions:{maps:3,characters:2}}
  }}
  if(branch==='conflict')await expect(commitCampaignBanishmentReturns(gateway,settleBrowserEtherealExpiry,()=>current)).rejects.toThrow('state-transaction-conflict:maps')
  else expect(await commitCampaignBanishmentReturns(gateway,settleBrowserEtherealExpiry,()=>current)).toBe(!['unknown','foreign','stale'].includes(branch))
  if(['conflict','stale','unknown','foreign'].includes(branch)){expect(commits).toBe(0);expect(storage).toEqual(original)}
  else{
   expect(commits).toBe(1);expect(choices).toBe(1);expect(rolls).toBe(branch==='feather-fall'?0:1)
   const target=storage.maps.maps[0].tokens.find(token=>token.id==='enemy')
   expect(target.hp).toBe(branch==='feather-fall'?50:46)
   expect(target.dnd5eCombatState.activeEffects??[]).not.toEqual(expect.arrayContaining([expect.objectContaining({tags:expect.arrayContaining(['banishing-smite-native-return'])})]))
   const finalWizard=storage.characters.characters.find(character=>character.id==='wizard')
   expect(finalWizard.classResources['dnd5e-spell-slot-1'].current).toBe(wizard.classResources['dnd5e-spell-slot-1'].current-(branch==='feather-fall'?1:0))
   expect(await commitCampaignBanishmentReturns(gateway,settleBrowserEtherealExpiry,()=>true)).toBe(false);expect(commits).toBe(1)
  }
 }finally{unregister?.();f.dispose()}
})

it('actual one-minute source clock expires off-scene at 60 seconds, never at 59 or by projected cache',async()=>{
 const f=await actualBanishingHit({worldMinute:100});try{
  const projected=planDnd5eMapResultApplication({state:f.result.state,map:f.map,characters:f.cast.application.characters,characterIdByCombatantId:{'hero-token':'hero'}})
  const map={...projected.map,tokens:projected.map.tokens.filter(token=>token.id!=='hero-token')}
  const source=projected.characters.find(character=>character.id==='hero')
  expect(source.dnd5eCombatState.activeEffects.some(effect=>effect.captureExecutionIdentity===true)).toBe(true)
  const storage={maps:{maps:[map],_sync:{revision:2}},characters:{characters:projected.characters,_sync:{revision:1}},'campaign-time':{...normalizeSharedCampaignTime({worldMinute:100,worldSecondRemainder:59}),_sync:{revision:3}},'map-geometry':{maps:[createEmptyMapGeometry(map.id)],_sync:{revision:4}},combat:{active:false,_sync:{revision:5}}}
  let commits=0
  const gateway={loadResource:async name=>structuredClone(storage[name]??null),saveResourcesAtomically:async writes=>{
   for(const write of writes)storage[write.name]=structuredClone(write.data);commits++
   return{status:'committed',transactionId:'expiry',revisions:{maps:3,characters:2}}
  }}
  const before=structuredClone(storage)
  expect(await commitCampaignBanishmentReturns(gateway,settleBrowserEtherealExpiry,()=>true)).toBe(false)
  expect(commits).toBe(0);expect(storage).toEqual(before)
  storage['campaign-time']={...normalizeSharedCampaignTime({worldMinute:101}),_sync:{revision:4}}
  expect(await commitCampaignBanishmentReturns(gateway,settleBrowserEtherealExpiry,()=>true)).toBe(true)
  expect(commits).toBe(1);expect(storage.characters.characters[0].concentrating).toBe(false)
  expect(storage.maps.maps[0].tokens[0].hp).toBe(50)
  expect(storage.maps.maps[0].tokens[0].dnd5eCombatState.activeEffects??[]).not.toEqual(expect.arrayContaining([expect.objectContaining({tags:expect.arrayContaining(['banishing-smite-native-return'])})]))
 }finally{f.dispose()}
})

it('a real same-name second cast ends only the old departure before the original parent completes',async()=>{
 const f=await actualBanishingHit({level:19});try{
  const a=resolveRecastTurn(f.result.state,{type:'end-turn',actorId:'hero-token'}),b=resolveRecastTurn(a.state,{type:'end-turn',actorId:'enemy'})
  expect(a.ok&&b.ok).toBe(true)
  const projected=planDnd5eMapResultApplication({state:b.state,map:f.map,characters:f.cast.application.characters,characterIdByCombatantId:{'hero-token':'hero'}})
  const spellId=projected.characters[0].dnd5eCombatState.concentrationSpellId
  const action={id:'actual-second-banishing-instance',type:'dnd5e-spell-cast',sourceMode:'player',status:'pending',mapId:f.map.id,combatId:'Elemental-Ab',actorTokenId:'hero-token',characterId:'hero',targetTokenId:'hero-token',round:2,initiativeIndex:0,seq:2,updatedAt:2,dnd5eSpellCast:{spellId,castingClassId:'paladin',slotLevel:5,targetTokenId:'hero-token'}}
  const prepared=prepareRecast({map:projected.map,characters:projected.characters,initiativeOrder:projected.map.tokens.map((token,i)=>({tokenId:token.id,label:token.label,emoji:token.emoji,color:token.color,roll:20-i})),action})
  expect(prepared.ok).toBe(true);if(!prepared.ok)throw Error('Second actual cast could not prepare')
  const result=commitRecast({prepared:prepared.prepared,rolls:{}})
  expect(result.result.ok).toBe(true)
  expect(result.result.state.combatants.enemy.conditions).not.toContain('banished')
  expect(result.result.state.combatants['hero-token'].concentrating).toBe(true)
  expect(result.result.state.combatants['hero-token'].classState.activeEffects.find(effect=>effect.captureExecutionIdentity===true).source.executionId).toBe(action.id)
  expect(result.result.state.combatants['hero-token'].classResources['dnd5e-spell-slot-5'].current).toBe(0)
 }finally{f.dispose()}
})

import { validateDnd5eActivityDefinitionV1, validateDnd5eEffectDefinitionV1 } from '../../src/rulesets/dnd5e/activities/dnd5eActivityValidation';
it('only the closed granted automatic magical weapon-hit continuation can declare post-damage banishment', () => {
    const base = banishingActivities[1];
    expect(validateDnd5eActivityDefinitionV1(base)).toEqual([]);
    const changes = [
        { activation: { kind: 'action' } }, { requiresEffectGrant: false },
        { legacySource: { kind: 'feature', id: 'banishing-smite', magical: true } },
        { invocation: { kind: 'triggered', event: 'attack-hit', confirmation: 'actor', retention: 'single-event' } },
        { requirements: [{ kind: 'attack-category', category: 'spell' }] },
        { target: { kind: 'creature', relation: 'enemy', count: 2 } },
        { consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }] },
    ];
    for (const change of changes) {
        const altered = structuredClone(base);
        Object.assign(altered, change);
        expect(validateDnd5eActivityDefinitionV1(altered).length).toBeGreaterThan(0);
    }
    for (const change of [{ damageType: 'psychic' }, { magical: false }, { critical: 'none' }, { amount: { kind: 'dice', rollId: 'force', count: 4, sides: 10 } }]) {
        const altered = structuredClone(base);
        Object.assign(altered.outcomes[0].operations[0], change);
        expect(validateDnd5eActivityDefinitionV1(altered).length).toBeGreaterThan(0);
    }
    for (const change of [{ maximumHitPoints: 51 }, { target: 'actor' }, { playerOrigin: 'native' }]) {
        const altered = structuredClone(base);
        Object.assign(altered.outcomes[0].operations[1], change);
        expect(validateDnd5eActivityDefinitionV1(altered).length).toBeGreaterThan(0);
    }
});
it('execution provenance capture is explicit true and leaves ordinary controllers undeclared', () => {
    const controller = banishingActivities[0].effects[0];
    expect(validateDnd5eEffectDefinitionV1(controller)).toEqual([]);
    for (const value of [false, 'true', 1]) {
        const altered = structuredClone(controller);
        Object.assign(altered, { captureExecutionIdentity: value });
        expect(validateDnd5eEffectDefinitionV1(altered).length).toBeGreaterThan(0);
    }
    const legacy = structuredClone(controller);
    delete legacy.captureExecutionIdentity;
    expect(validateDnd5eEffectDefinitionV1(legacy)).toEqual([]);
});
