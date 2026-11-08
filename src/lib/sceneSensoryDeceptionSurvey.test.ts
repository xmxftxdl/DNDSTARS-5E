import {expect,it} from 'vitest'
import {validSceneSensoryDeceptionSurvey as valid} from './sceneSensoryDeceptionSurvey'
import {normalizeSharedSceneOrchestration,validateSharedSceneOrchestration} from './sceneOrchestration'

const base={centerX:0,centerY:0,elevationFeet:0,radiusFeet:30,presences:[{eastFeet:40,northFeet:0,elevationFeet:0,radiusFeet:10}]}
it('retains private sphere and box geometry through scene normalization and JSON',()=>{
  const survey={...base,presences:[...base.presences,{eastFeet:0,northFeet:0,elevationFeet:0,halfExtentsFeet:{east:20,north:5,height:10}}]}
  expect(valid(survey)).toBe(true)
  const state=normalizeSharedSceneOrchestration({scenes:[{id:'survey',mapId:'map',sensoryDeceptionSurvey:survey}]})
  expect(state.scenes[0].sensoryDeceptionSurvey).toEqual(survey)
  expect(validateSharedSceneOrchestration(JSON.parse(JSON.stringify(state)))).toBe(true)
})
it.each([
  {...base,radiusFeet:NaN}, {...base,radiusFeet:0}, {...base,unknown:true},
  {...base,presences:[{...base.presences[0],radiusFeet:-1}]},
  {...base,presences:[{...base.presences[0],radiusFeet:null}]},
  {...base,presences:[{...base.presences[0],halfExtentsFeet:{east:1,north:1,height:1}}]},
  {...base,presences:[{eastFeet:0,northFeet:0,elevationFeet:0,halfExtentsFeet:{east:1,north:1}}]},
  {...base,presences:[{eastFeet:0,northFeet:0,elevationFeet:0,halfExtentsFeet:{east:1,north:1,height:-1}}]},
])('rejects malformed or ambiguous geometry %j',survey=>expect(valid(survey)).toBe(false))
