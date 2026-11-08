import{buildShadowGraveActors}from'./legacy-growth';
export async function buildDeathActors(input:{roomId:string;memberId:string}){
 const proof=await buildShadowGraveActors(input),characters=['caster','foe','helper'].map(id=>{const c=proof.characters.find(c=>c.id===id);if(!c)throw Error('Actual grown character required '+id);return c});
 const positions:Record<string,[number,number]>={caster:[525,375],foe:[575,375],helper:[625,375]},map={...proof.map,id:'actual-death-map',name:'Actual first zero HP death saving turn',tokens:characters.map(c=>({id:c.id+'-token',characterId:c.id,type:'player' as const,dnd5eSide:c.id==='caster'?'enemy' as const:'player' as const,label:c.name,x:positions[c.id][0],y:positions[c.id][1],size:1,color:'#6ac',emoji:c.name[0],hp:c.currentHp,maxHp:c.maxHp}))};
 if(characters.find(c=>c.id==='foe')!.dnd5eRaceId!=='halfling'||characters.find(c=>c.id==='foe')!.currentHp!==10||characters.find(c=>c.id==='helper')!.level!==4||characters.find(c=>c.id==='caster')!.classResources?.['dnd5e-spell-slot-1']?.current!==2)throw Error('True Fighter1 HP10, Fighter4 feat and Cleric1 two slots required');
 return{...proof,characters,map,initialFoeHp:10,allHitPointsFromTrueClassGrowth:true,noPrebuiltDeathTurn:true};
}
