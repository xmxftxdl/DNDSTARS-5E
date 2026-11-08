import {it,expect} from 'vitest'
import {celestialRadiantSelectedBundle} from './celestialRadiantSelected.fixture'
import {growSearingCelestial} from './celestialLawfulGrowth.fixture'
import {radiantSelectedScene} from './celestialRadiantSelectedScene.fixture'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromUnifiedContentBundleV1} from './unifiedContent'
import {resolvePreparedDnd5eSpellCast} from './spellAction'
import {withDnd5eSpellDamageSelectedAbilityBonus} from './spellDamageSelectedAbilityBonus'
import {collectDnd5ePersistentAreaTriggers} from './pluginAreas'
import {prepareDnd5ePersistentAreaTrigger,resolvePreparedDnd5ePersistentAreaTrigger} from './pluginAreaTransactions'
const register=()=>registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(celestialRadiantSelectedBundle()))
it.each(['below-six','force-spell','declared-source-mutation','forged-selection'] as const)('real native source boundary: %s',mode=>{
 const dispose=register();try{
  const actor=growSearingCelestial(mode==='below-six'?5:6,16,undefined,mode==='force-spell'?'eldritch-blast':undefined),f=radiantSelectedScene(actor,mode==='force-spell'?'eldritch-blast':'sacred-flame'),before=structuredClone(f.prepared.state);let called=0
  const run=()=>withDnd5eSpellDamageSelectedAbilityBonus(options=>{called++;if(mode==='forged-selection')return 'not-an-owned-source';const id=options[0].featureId;Object.assign(options[0],{amount:900,targetId:'enemy-spoof',castParentId:'parent-spoof'});return id},()=>resolvePreparedDnd5eSpellCast({prepared:f.prepared,effectRolls:mode==='force-spell'?[]:[4,4],...(mode==='force-spell'?{targetAttacks:[{targetId:'enemy',d20:15,effectRolls:[4]},{targetId:'enemy',d20:15,effectRolls:[4]}]}:{savingThrowD20:1})}))
  if(mode==='forged-selection')expect(run).toThrow('invalid-spell-damage-selected-ability-source')
  else{const result=run();expect(result.result.ok,JSON.stringify(result.result)).toBe(true);expect(called).toBe(mode==='declared-source-mutation'?1:0);expect(result.result.events.filter(e=>e.type==='spell-damage-selected-ability-modifier-applied')).toHaveLength(mode==='declared-source-mutation'?1:0);if(mode==='declared-source-mutation')expect(result.result.state.combatants.enemy.currentHp).toBe(48)}
  expect(f.prepared.state).toEqual(before)
 }finally{dispose()}
})
it('a genuine mixed fire/radiant AoE can select only the radiant pool of only one target',()=>{
 const dispose=register();try{
  const actor=growSearingCelestial(10,16,'flame-strike'),f=radiantSelectedScene(actor,'flame-strike',5),seen:string[]=[]
  const cast=withDnd5eSpellDamageSelectedAbilityBonus(options=>{const o=options[0];seen.push(o.targetId+':'+o.damageType);return o.targetId==='other'&&o.damageType==='radiant'?o.featureId:null},()=>resolvePreparedDnd5eSpellCast({prepared:f.prepared,effectRolls:[1,1,1,1],additionalEffectRolls:[[1,1,1,1]],targetSavingThrows:f.prepared.targetTokens.map(t=>({targetId:t.id,d20:t.id==='caster'?20:1}))}))
  expect(cast.result.ok,JSON.stringify(cast.result)).toBe(true);expect(cast.result.state.combatants.enemy.currentHp).toBe(51);expect(cast.result.state.combatants.other.currentHp).toBe(48);expect(seen).toContain('other:radiant');expect(cast.result.events.filter(e=>e.type==='spell-damage-selected-ability-modifier-applied')).toEqual([expect.objectContaining({targetId:'other',damageType:'radiant',amount:3})])
 }finally{dispose()}
})
it('a real Wall of Fire retains one use across two actual on-create recipients and a cold saved source',()=>{
 const dispose=register();try{
  const actor=growSearingCelestial(10,16,'wall-of-fire'),f=radiantSelectedScene(actor,'wall-of-fire',5),cast=resolvePreparedDnd5eSpellCast({prepared:f.prepared,effectRolls:[]});expect(cast.result.ok,JSON.stringify(cast.result)).toBe(true);expect(cast.application).toBeDefined();let app=cast.application!;const area=app.map.dnd5ePluginAreas!.find(a=>a.coreSpellId==='wall-of-fire')!;expect(area.id).toBe('core-spell-area:'+f.input.action.id);let called=0
  for(const targetId of ['enemy','other']){
   const candidate=collectDnd5ePersistentAreaTriggers({map:app.map,timing:'on-create',round:1,areaId:area.id,turnKey:'1:caster'}).find(c=>c.targetToken.id===targetId);expect(candidate,'Actual Wall of Fire target '+targetId).toBeDefined()
   const prepared=prepareDnd5ePersistentAreaTrigger({combatId:'radiant-combat',round:1,map:app.map,characters:app.characters,initiativeOrder:f.input.initiativeOrder,candidate:candidate!});expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
   const result=withDnd5eSpellDamageSelectedAbilityBonus(options=>{called++;return options[0].featureId},()=>resolvePreparedDnd5ePersistentAreaTrigger({prepared:prepared.prepared,d20:1,damageRolls:[1,1,1,1,1,1]}));expect(result.result.ok,JSON.stringify(result.result)).toBe(true);expect(result.result.events.filter(e=>e.type==='spell-damage-selected-ability-modifier-applied')).toHaveLength(targetId==='enemy'?1:0);app=JSON.parse(JSON.stringify(result.application!))
  }
  expect(called).toBe(1);expect(app.map.tokens.find(t=>t.id==='enemy')!.hp).toBe(50);expect(app.map.tokens.find(t=>t.id==='other')!.hp).toBe(53);expect(Object.keys(app.characters[0].dnd5eCombatState!.spellDamageSelectedAbilityBonusUses!)).toHaveLength(1)
 }finally{dispose()}
})
