import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { dnd5eCombatantPairKey } from './headlessCombatPrimitives'
import { recordDnd5eSensoryDeceptionReport as record } from './sensoryDeceptionReport'
import { normalizeSharedSceneOrchestration } from '../../lib/sceneOrchestration'
import { createDnd5eConditionEffect } from './activeEffects'

function makeState() {
  const make = (id: string, initiative: number) => createDnd5eCombatant({id,name:id,initiative,controller:'dm',
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},armorClass:10,proficiencyBonus:2,
    currentHp:10,maxHp:10,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const state = startDnd5eHeadlessCombat('sense',[make('actor',20),make('secret-target',10)])
  state.mapId = 'map'
  state.distanceFeetByCombatantPair = {[dnd5eCombatantPairKey('actor','secret-target')]:30}
  const target = state.combatants['secret-target']
  target.shapechanger = true
  target.classState.monsterShapechangeFormId = 'human'
  target.classState.monsterShapechangeOriginalStatBlockId = 'secret-original'
  return state
}
it('persists only a bounded private historical receipt from Host facts', () => {
  const state = makeState()
  expect(record(state,'actor','sense',30)).toBe(true)
  expect(state.combatants.actor.classState.sensoryDeceptionReports).toEqual({sense:{sourceActivityId:'sense',round:1,present:true,mapId:'map'}})
  expect(JSON.stringify(state.combatants.actor.classState.sensoryDeceptionReports)).not.toContain('secret')
  expect(state.combatants['secret-target'].classState.sensoryDeceptionReports).toBeUndefined()
  expect(JSON.parse(JSON.stringify(state)).combatants.actor.classState.sensoryDeceptionReports).toEqual(state.combatants.actor.classState.sensoryDeceptionReports)
})
it('refuses unknown facts, invalid ranges and unusable senses without overwriting a prior receipt', () => {
  for (const mode of ['unknown-distance','out-of-range','original-form','blinded','deafened','invalid-range'] as const) {
    const state = makeState()
    expect(record(state,'actor','sense',30)).toBe(true)
    if (mode === 'unknown-distance') state.distanceFeetByCombatantPair = undefined
    if (mode === 'out-of-range') state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('actor','secret-target')] = 30.01
    if (mode === 'original-form') state.combatants['secret-target'].classState.monsterShapechangeFormId = 'secret-original'
    if (mode === 'blinded' || mode === 'deafened') state.combatants.actor.conditions = [mode]
    const before = structuredClone(state)
    expect(record(state,'actor','sense',mode === 'invalid-range' ? 60 : 30)).toBe(false)
    expect(state).toEqual(before)
  }
})
it('requires explicit complete DM coverage to resolve otherwise unknown scene facts', () => {
  const state = makeState()
  state.combatants['secret-target'].classState.monsterShapechangeFormId = 'secret-original'
  expect(record(state,'actor','sense',30)).toBe(false)
  state.companionScene = {map:{id:'map',name:'Scene',width:500,height:500,gridSize:50,
    gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]},geometry:null,projectedTokenIds:[]}
  expect(record(state,'actor','sense',30)).toBe(false)
  state.companionScene.interactionScenes = normalizeSharedSceneOrchestration({scenes:[{
    id:'survey',mapId:'map',sensoryDeceptionSurvey:{centerX:0,centerY:0,elevationFeet:0,radiusFeet:30,presences:[]},
  }]}).scenes
  expect(record(state,'actor','sense',30)).toBe(true)
  expect(state.combatants.actor.classState.sensoryDeceptionReports?.sense.present).toBe(false)
  state.combatants['secret-target'].concentrating = true
  expect(record(state,'actor','sense',30)).toBe(true)
  expect(state.combatants.actor.classState.sensoryDeceptionReports?.sense.present).toBe(false)
  state.companionScene.interactionScenes=[]
  const before=structuredClone(state)
  expect(record(state,'actor','missing-survey',30)).toBe(false)
  expect(state).toEqual(before)
})
it.each([
  {radiusFeet:10,eastFeet:40,northFeet:0,elevationFeet:0,expected:true},
  {radiusFeet:9.99,eastFeet:40,northFeet:0,elevationFeet:0,expected:false},
  {halfExtentsFeet:{east:10,north:2,height:2},eastFeet:40,northFeet:0,elevationFeet:0,expected:true},
  {halfExtentsFeet:{east:9.99,north:2,height:2},eastFeet:40,northFeet:0,elevationFeet:0,expected:false},
  {halfExtentsFeet:{east:2,north:2,height:10},eastFeet:0,northFeet:0,elevationFeet:40,expected:true},
])('measures distance to the nearest point of a surveyed volume: %j', ({expected,...presence})=>{
  const state=makeState()
  state.combatants['secret-target'].classState.monsterShapechangeFormId='secret-original'
  state.companionScene={map:{id:'map',name:'Scene',width:500,height:500,gridSize:50,
    gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]},geometry:null,projectedTokenIds:[],
    interactionScenes:normalizeSharedSceneOrchestration({scenes:[{id:'survey',mapId:'map',
      sensoryDeceptionSurvey:{centerX:0,centerY:0,elevationFeet:0,radiusFeet:100,presences:[presence]}}]}).scenes}
  expect(record(state,'actor','volume',30)).toBe(true)
  expect(state.combatants.actor.classState.sensoryDeceptionReports?.volume.present).toBe(expected)
})
it('uses private surveyed presence locations without disclosing them or their identities', () => {
  const state = makeState()
  state.combatants['secret-target'].classState.monsterShapechangeFormId = 'secret-original'
  state.companionScene = {map:{id:'map',name:'Scene',width:500,height:500,gridSize:50,
    gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]},geometry:null,projectedTokenIds:[],
    interactionScenes:normalizeSharedSceneOrchestration({scenes:[{id:'survey',mapId:'map',
      sensoryDeceptionSurvey:{centerX:0,centerY:0,elevationFeet:0,radiusFeet:100,presences:[{eastFeet:30,northFeet:0,elevationFeet:0}]}}]}).scenes}
  expect(record(state,'actor','sense',30)).toBe(true)
  expect(state.combatants.actor.classState.sensoryDeceptionReports?.sense.present).toBe(true)
  const receipt=JSON.stringify(state.combatants.actor.classState.sensoryDeceptionReports)
  expect(receipt).not.toMatch(/eastFeet|northFeet|secret|presences/)
})
it('recognizes a real canonical illusion source and excludes a suspended effect', () => {
  const state=makeState()
  const target=state.combatants['secret-target']
  target.shapechanger=false
  target.classState.activeEffects=[createDnd5eConditionEffect({condition:'invisible',targetId:target.id,
    source:{kind:'spell',actorId:target.id,rulesId:'greater-invisibility'}})]
  expect(record(state,'actor','illusion',30)).toBe(true)
  expect(state.combatants.actor.classState.sensoryDeceptionReports?.illusion.present).toBe(true)
  target.classState.activeEffects[0].suspendedBy=['antimagic']
  const before=structuredClone(state)
  expect(record(state,'actor','suspended',30)).toBe(false)
  expect(state).toEqual(before)
})
