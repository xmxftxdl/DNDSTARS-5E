import{it,expect}from'vitest'
import{celestialBundle,growCelestial}from'../celestialNative.fixture'
import{registerDnd5eRulesPlugin}from'../pluginApi'
import{dnd5eRulesPluginFromUnifiedContentBundleV1}from'../unifiedContent'
import{createCombatantFromDnd5eCharacter,migrateCharacterToDnd5e}from'../character'
import{startDnd5eHeadlessCombat}from'../headlessCombatEngine'
import{collectDnd5eActivityNegationDice}from'./dnd5eActivityNegationDice'
it('the real Celestial1 parent reserves only its selected two-die cost before collecting real native healing dice',async()=>{
 const bundle=celestialBundle(),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle));try{
 const character=growCelestial(1),actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(character),controller:'player',initiativeD20:20,position:{x:0,y:0}}),state=startDnd5eHeadlessCombat('real-celestial-healing', [actor]),feature=bundle.definitions.find(d=>d.kind==='feature'&&d.id==='healing-light-control');if(!feature||feature.kind!=='feature'||!feature.activities?.[0])throw Error('Actual source activity required');const activity=feature.activities[0],before=JSON.stringify(state),rolled:string[]=[];
 const input={state,activityId:activity.id,actionId:'actual-healing-parent',parent:{activity,actorId:actor.id,choices:{dice:'2'}},declarations:[{id:'healing-2',label:'Healing Light',count:2,sides:6,modifier:0,visibility:'public' as const}],choose:async()=>undefined,roll:async(declaration:{id:string})=>{rolled.push(declaration.id);return[2,3]},isCurrent:()=>true};
 const result=await collectDnd5eActivityNegationDice(input);expect(result.authoritativeRolls['healing-2'].values).toEqual([2,3]);expect(rolled).toEqual(['healing-2']);expect(JSON.stringify(state)).toBe(before);
 await expect(collectDnd5eActivityNegationDice({...input,parent:{...input.parent,choices:{dice:'3'}}})).rejects.toThrow('activity-negation-parent-cost-unavailable');expect(rolled).toEqual(['healing-2']);
 const extra={kind:'resource' as const,resourceId:'local.xge-celestial:healing-light',amount:{kind:'constant' as const,value:1},consumeOn:'resolve' as const};await expect(collectDnd5eActivityNegationDice({...input,parent:{...input.parent,activity:{...activity,consumption:[...activity.consumption!,extra]}}})).rejects.toThrow('activity-negation-parent-cost-unavailable');expect(rolled).toEqual(['healing-2']);expect(JSON.stringify(state)).toBe(before);
 }finally{dispose()}
})
