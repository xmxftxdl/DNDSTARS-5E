import{afterEach,it,expect,vi}from'vitest'
import{normalizeCharacter}from'../../store/characters'
import{migrateMapsState}from'../../store/maps'
import{syncCharacterClassResources}from'../../lib/classResources'
import{registerDnd5eRulesPlugin}from'../../rulesets/dnd5e/pluginApi'
import{secondChanceTestContent}from'./secondChance.testFixture'
import{createDnd5eConditionEffect}from'../../rulesets/dnd5e/activeEffects'
import{DND5E_SHORTSWORD}from'../../rulesets/dnd5e/equipment'
import{createDnd5eTurnEconomyCounts}from'../../rulesets/dnd5e/turnEconomy'
import{prepareDnd5eEquipmentAttack,resolvePreparedDnd5eEquipmentAttack}from'../../rulesets/dnd5e/equipmentAttackAction'
import{captureSecondChancePreparedOriginal}from'./secondChancePreparedParent'
import{issueSecondChanceAttack}from'./issueSecondChanceAttack'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
const session=vi.hoisted(()=>({current:{roomId:'room',memberId:'dm',role:'dm'}}));vi.mock('../../lib/roomSession',async()=>({...await vi.importActual('../../lib/roomSession'),getRoomSession:()=>session.current}))
const disposers:(()=>void)[]=[];afterEach(()=>{for(const stop of disposers.splice(0))stop()})
function originalParent(skills:string[]=[]){
 const content=structuredClone(secondChanceTestContent),feat:import('../../rulesets/dnd5e/pluginApi').Dnd5ePluginFeatDefinition={...content.feats[0],automation:'full',resources:[{id:'uses',label:'花开二度',maximum:1,resetOn:'short-rest'}],declarativeAbility:{schemaVersion:1,id:'incoming-hit',name:'花开二度',description:content.feats[0].description,level:1,trigger:{kind:'after-d20-roll'},targeting:{kind:'self'},effects:[],automation:'full',cost:{economy:'reaction',resources:[{resourceId:'uses',amount:1}]},mechanic:{kind:'incoming-hit-attack-die-reroll'}}};
 disposers.push(registerDnd5eRulesPlugin({manifest:{id:'test.map-projection-sc',name:'Second Chance',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'Private'},setup(api){api.registerFeat(feat)}}));
 const owner=syncCharacterClassResources(normalizeCharacter({id:'hero',name:'Hero',skills,roomId:'room',roomMemberId:'owner',race:'半身人',dnd5eRaceId:'halfling',charClass:'战士',level:4,currentHp:30,maxHp:30,hitPointMaximumMode:'fixed',dnd5eFeatIds:['test.map-projection-sc:second-chance']})),roller=normalizeCharacter({id:'other',name:'Other',roomId:'room',roomMemberId:'roller',race:'人类',charClass:'战士',level:4,currentHp:30,maxHp:30,hitPointMaximumMode:'fixed',abilities:{str:16,dex:14,con:12,int:10,wis:10,cha:10},equipment:{mainWeapon:DND5E_SHORTSWORD}}),rawMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[{id:'attacker',type:'player' as const,characterId:'other',label:'Other',x:25,y:25,size:1,color:'',emoji:''},{id:'hero-token',type:'player' as const,characterId:'hero',label:'Hero',x:75,y:25,size:1,color:'',emoji:''}]},sync={schemaVersion:1 as const,revision:1,writerId:'dm',writtenAt:1};
 const data={characters:{characters:[owner,roller],_sync:sync},maps:{maps:[rawMap],_sync:sync},combat:{active:true,mapId:'map',combatId:'combat',round:1,initiativeIndex:0,initiativeOrder:rawMap.tokens.map((row,index)=>({tokenId:row.id,label:row.label,roll:20-index,emoji:'',color:''})),dnd5eTurnEconomyByToken:{attacker:createDnd5eTurnEconomyCounts('combat:1:attacker')},updatedAt:1,_sync:sync}};
 const map=migrateMapsState(data.maps).maps[0],action={id:'actual-equipment-parent',mapId:'map',combatId:'combat',round:1,initiativeIndex:0,actorTokenId:'attacker',characterId:'other',targetTokenId:'hero-token',type:'dnd5e-weapon-attack' as const,sourceMode:'player' as const,status:'pending' as const,seq:1,updatedAt:1},ready=prepareDnd5eEquipmentAttack({map,characters:data.characters.characters,action,initiativeOrder:data.combat.initiativeOrder,attacksUsed:0,turnEconomy:data.combat.dnd5eTurnEconomyByToken.attacker});expect(ready.ok,JSON.stringify(ready)).toBe(true);if(!ready.ok)throw Error(ready.reason);
 const preparedOriginal=captureSecondChancePreparedOriginal(resolvePreparedDnd5eEquipmentAttack,{prepared:ready.prepared,d20:18,damageRolls:[1]});expect(preparedOriginal).toBeTruthy();
 const gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>={loadResource:async<T>(name:string)=>structuredClone((data as Record<string,unknown>)[name])as T,saveResourcesAtomically:vi.fn(async(writes,options)=>{for(const write of writes)expect(write.expectedRevision).toBe(1);return{status:'committed' as const,transactionId:options?.transactionId??'',revisions:{}}})};
 return{data,map,gateway,input:{mapId:'map',parentTransactionId:action.id,preparedOriginal},resourceKey:'test.map-projection-sc:uses'}
}
it('issues the real original equipment parent when only the client materialized canonical empty/false map defaults',async()=>{
 const f=originalParent();expect(f.map).not.toEqual(f.data.maps.maps[0]);expect(f.map.tokens[0].dnd5eTokenStatusMarkers).toEqual([]);
 const receipt=await issueSecondChanceAttack(f.input,f.gateway);expect(receipt.attack.dice).toEqual([18]);expect(receipt.attack.transactionId).toBe('actual-equipment-parent');expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1)
})
for(const changed of['position','token-ownership','visibility','hp','resource','member-ownership','effect','round']as const)it(`continues to reject a genuinely stale original ${changed} despite map default normalization`,async()=>{
 const f=originalParent();
 if(changed==='position')f.data.maps.maps[0].tokens[0].x+=50;
 if(changed==='token-ownership')f.data.maps.maps[0].tokens[1].characterId='other';
 if(changed==='visibility')Object.assign(f.data.maps.maps[0].tokens[0],{dnd5eCharacterInvisibleToDarkvision:true});
 if(changed==='hp')f.data.characters.characters[0].currentHp-=1;
 if(changed==='resource')f.data.characters.characters[0].classResources![f.resourceKey].current=0;
 if(changed==='member-ownership')f.data.characters.characters[0].roomMemberId='roller';
 if(changed==='effect')f.data.characters.characters[0].dnd5eCombatState={...f.data.characters.characters[0].dnd5eCombatState,activeEffects:[createDnd5eConditionEffect({condition:'poisoned',targetId:'hero-token',source:{kind:'feature'}})]};
 if(changed==='round')f.data.combat.round=2;
 await expect(issueSecondChanceAttack(f.input,f.gateway)).rejects.toThrow('stale-prepared-original');expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
})

it('accepts the real browser rejection shape: resource records have identical fields and values in a different insertion order',async()=>{
 const f=originalParent(),owner=f.data.characters.characters[0],before=JSON.stringify(owner.classResources)
 owner.classResources=Object.fromEntries(Object.entries(owner.classResources!).reverse())
 expect(JSON.stringify(owner.classResources)).not.toBe(before)
 const receipt=await issueSecondChanceAttack(f.input,f.gateway)
 expect(receipt.attack.dice).toEqual([18]);expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1)
})
it('preserves ordered arrays when comparing the original character snapshot',async()=>{
 const f=originalParent(['arcana','history']);f.data.characters.characters[0].skills.reverse()
 await expect(issueSecondChanceAttack(f.input,f.gateway)).rejects.toThrow('stale-prepared-original');expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
})
for(const changed of['missing-resource-field','resource-maximum']as const)it(`keeps every original character field when ${changed} changes`,async()=>{
 const f=originalParent(),resources=f.data.characters.characters[0].classResources!
 if(changed==='missing-resource-field')delete resources[f.resourceKey]
 else resources[f.resourceKey].max+=1
 await expect(issueSecondChanceAttack(f.input,f.gateway)).rejects.toThrow('stale-prepared-original');expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
})
