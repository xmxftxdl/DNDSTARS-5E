import{it,expect}from'vitest'
import{genuineInitiativePreparation}from'./testFixtures/initiativeOriginal.native.fixture'
import*as originals from'./initiativeOriginal'
import{withAllyNaturalOneCheckpoints}from'./allyNaturalOneCheckpoint'
import{createDnd5eAllyOriginalCollectionSession}from'./damageCommitSession'
import{normalizeCharacter}from'../../store/characters'

async function roster(){const f=await genuineInitiativePreparation();try{const second=normalizeCharacter({...f.input.characters[0],id:'init-second',name:'Second actual Fighter'}),map={...f.input.map,tokens:[...f.input.map.tokens,{...f.input.map.tokens[0],id:'init-second-token',characterId:second.id,label:second.name,y:375}]},input={...f.input,map,characters:[...f.input.characters,second]},prepared=originals.prepareDnd5eInitiativeOriginal(input);return{...f,input,prepared}}catch(error){f.dispose();throw error}}

it('pre-combat originals carry the actual earlier helper reaction state into the next distinct actor without creating an initiative order',async()=>{const f=await roster();try{
 const first=withAllyNaturalOneCheckpoints(request=>{expect(request.actorId).toBe('init-actor-token');return{ownerId:'init-helper-token',featureId:f.featureId,replacement:20}},()=>originals.resolvePreparedDnd5eInitiativeOriginal({prepared:f.prepared}));expect(first.initiative.roll.d20).toBe(20);expect(first.result.state.combatants['init-helper-token'].turn.reactionAvailable).toBe(false)
 const prepared=originals.prepareDnd5eInitiativeOriginalContinuation(first,'init-second-token',[1]);expect(prepared.state.active).toBe(false);expect(prepared.state.initiativeOrder).toEqual([]);expect(prepared.state.combatants['init-helper-token'].turn.reactionAvailable).toBe(false)
 const session=createDnd5eAllyOriginalCollectionSession({prepared},originals.resolvePreparedDnd5eInitiativeOriginal);try{const stage=session.run(prepared.state);expect(stage.status).toBe('resolved');if(stage.status!=='resolved')throw Error(stage.status);expect(stage.result.initiative.roll.d20).toBe(1);expect(stage.result.result.state.combatants['init-helper-token'].turn.reactionAvailable).toBe(false);expect(stage.result.result.state.initiativeOrder).toEqual([]);expect(stage.result.result.events.filter(event=>event.type==='ally-natural-one-rerolled')).toHaveLength(1)}finally{session.cancel()}
 }finally{f.dispose()}})

it('copied, mutated or repeated-actor initiative results cannot issue a next original; actual source stays bound',async()=>{const f=await roster();try{
 const first=withAllyNaturalOneCheckpoints(()=>undefined,()=>originals.resolvePreparedDnd5eInitiativeOriginal({prepared:f.prepared}));expect(()=>originals.prepareDnd5eInitiativeOriginalContinuation(JSON.parse(JSON.stringify(first)),'init-second-token',[1])).toThrow('actual-unchanged-prior-required');expect(()=>originals.prepareDnd5eInitiativeOriginalContinuation(first,'init-actor-token',[1])).toThrow('current-distinct-next-original-required')
 const before=JSON.stringify(first);Reflect.set(first.result.state.combatants['init-helper-token'].turn,'reactionAvailable',false);expect(()=>originals.prepareDnd5eInitiativeOriginalContinuation(first,'init-second-token',[1])).toThrow('actual-unchanged-prior-required');expect(JSON.stringify(first)).not.toBe(before)
 const actual=withAllyNaturalOneCheckpoints(()=>undefined,()=>originals.resolvePreparedDnd5eInitiativeOriginal({prepared:f.prepared}));f.input.map.tokens[0].x=999;expect(()=>originals.prepareDnd5eInitiativeOriginalContinuation(actual,'init-second-token',[1])).toThrow('actual-unchanged-prior-required')
 }finally{f.dispose()}})
