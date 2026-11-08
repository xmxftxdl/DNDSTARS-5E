import{expect}from'vitest'
import{genuineFormalWardWorld}from'./mastermindQueuedFormFormalWard.fixture'
import{createNativeEnvelopeApi}from'./mastermindMagicFamilies.fixture'
import{getDnd5eSrdMonster}from'../../rulesets/dnd5e/monsters'
import{prepareDnd5eMonsterAttack}from'../../rulesets/dnd5e/monsterAttackAction'
import{createDnd5eTurnEconomyCounts}from'../../rulesets/dnd5e/turnEconomy'
import{dnd5eAttackAttemptWardRequirements}from'../../application/combat/dnd5eCombatRules'
import{prepareMastermindNativeMonsterOriginal,readMastermindNativeMonsterDecision}from'./mastermindMisdirectionNativeParent'
import{growNativeMastermind}from'./mastermindQueuedFormCurrentGrowth.fixture'
import{normalizeCharacter}from'../../store/characters'
import{dnd5eCombatantCoverRedirectFeatureIds,dnd5eCoverAttackRedirectEligible}from'../../application/combat/dnd5eCombatRules'
export async function genuineHostWardWorld(){
  const f=await genuineFormalWardWorld(),monster=getDnd5eSrdMonster('srd-5.1:goblin')!;
  expect(monster).toBeDefined();
  const second=normalizeCharacter({...growNativeMastermind(13,'second-owner').character,roomId:'room',roomMemberId:'reader'}),secondCover=growNativeMastermind(1,'second-cover').character;
  let map={...f.map,tokens:f.map.tokens.map(token=>token.id==='caster-token'?{id:token.id,poolId:monster.id,type:'enemy' as const,dnd5eSide:'enemy' as const,label:monster.name,x:token.x,y:token.y,size:1,color:'',emoji:'',hp:monster.hitPoints.average,maxHp:monster.hitPoints.average}:{...token,dnd5eSide:'player' as const})};
  const characters=[...f.characters.filter(character=>character.id!=='form-caster'),second,secondCover];let found=false;for(let x=275;x<=425&&!found;x+=50)for(let y=275;y<=425&&!found;y+=50)for(let cx=275;cx<=475&&!found;cx+=50)for(let cy=275;cy<=475&&!found;cy+=50){const tokens=[{id:'second-owner-token',characterId:second.id,type:'player' as const,dnd5eSide:'player' as const,label:'Second real Rogue13',x,y,size:1,color:'',emoji:''},{id:'second-cover-token',characterId:secondCover.id,type:'player' as const,dnd5eSide:'player' as const,label:'Second cover',x:cx,y:cy,size:1,color:'',emoji:''}];if(tokens.some(t=>map.tokens.some(v=>v.x===t.x&&v.y===t.y))||(x===cx&&y===cy))continue;const candidate={...map,tokens:[...map.tokens,...tokens]},p=prepareDnd5eMonsterAttack({map:candidate,characters,combatId:'second-owner-geometry',round:1,initiativeOrder:candidate.tokens.map((t,i)=>({tokenId:t.id,label:t.label,roll:20-i,color:'',emoji:''})),currentInitiativeIndex:0,actorTokenId:'caster-token',targetTokenId:'second-owner-token',actionIndex:0});if(p.ok&&dnd5eCombatantCoverRedirectFeatureIds(p.prepared.state.combatants['second-owner-token']).some(id=>dnd5eCoverAttackRedirectEligible(p.prepared.state,'caster-token','second-owner-token','second-cover-token',id))){map=candidate;found=true}}expect(found).toBe(true);const order=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,roll:20-index,color:'',emoji:''})),economies=Object.fromEntries(order.map(token=>[token.tokenId,createDnd5eTurnEconomyCounts('native-host-ward:1:0:'+token.tokenId)]));
  const actionIndex=monster.actions.findIndex(action=>action.attack?.mode==='melee');
  expect(actionIndex).toBeGreaterThanOrEqual(0);
  const args={map,characters,combatId:'native-host-ward',round:1,initiativeOrder:order,currentInitiativeIndex:0,actorTokenId:'caster-token',targetTokenId:'owner-token',actionIndex,turnEconomy:economies['caster-token'],turnEconomyByToken:economies};
  const prepared=prepareDnd5eMonsterAttack(args);expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason);
  const api=await createNativeEnvelopeApi({characters:{characters},maps:{maps:[map]},combat:{active:true,mapId:map.id,combatId:args.combatId,round:1,initiativeIndex:0,initiativeOrder:order,dnd5eTurnEconomyByToken:economies}});
  const gateway={session:()=>({roomId:'room',memberId:'dm',role:'dm'}),loadResource:api.read,request:async<T>(operation:'begin-native'|'answer'|'project'|'list',body:unknown):Promise<T>=>{const response=await api.post('mastermind-misdirection/'+operation,body);expect(response.status,JSON.stringify(response.payload)).toBe(200);return response.payload}};
  const before=await Promise.all(['characters','maps','combat','player-action-requests'].map(api.read));
  const cap=await prepareMastermindNativeMonsterOriginal({parentTransactionId:'actual-host-npc-formal-majesty-before-original',mapId:map.id,actorTokenId:'caster-token',targetTokenId:'owner-token',actionIndex},gateway);
  expect(cap).toBeDefined();
  const list=await api.post('mastermind-misdirection/list',{},'player'),prompt=list.payload.parents[0];expect(prompt).toBeDefined();expect(prompt.replacementTokenIds).toContain('cover-token');
  expect((await api.post('mastermind-misdirection/answer',{id:prompt.id,expectedRecordRevision:prompt.revision,choice:'cover-token'},'player')).status).toBe(200);
  const decision=await readMastermindNativeMonsterDecision(cap!,gateway);expect(decision).toBeDefined();expect(decision!.previewPrepared.attacks[0].targetToken.id).toBe('cover-token');
  const monsterAttack=decision!.previewPrepared,attackTargetToken=monsterAttack.attacks[0].targetToken,requirements=dnd5eAttackAttemptWardRequirements(monsterAttack.state,monsterAttack.actorToken.id,attackTargetToken.id);
  expect(requirements).toHaveLength(1);expect(requirements[0].effect.attackAttemptWard?.ability).toBe('cha');
  expect(await Promise.all(['characters','maps','combat','player-action-requests'].map(api.read))).toEqual(before);

 return{f,map,characters,order,economies,args,api,gateway,before,cap:cap!,prompt,decision:decision!,requirements,prepared:prepared.prepared}
}
