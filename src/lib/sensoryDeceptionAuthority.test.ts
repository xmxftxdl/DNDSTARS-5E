import { expect, it } from 'vitest'
import { projectCharactersForRoomMember, projectMapsForPlayer } from '../../scripts/shared-server-core.mjs'

it('publishes sensory presence only to its owner and removes it from public tokens', () => {
  const sensoryDeceptionReports = {sense:{sourceActivityId:'sense',round:1,present:true,mapId:'map'}}
  const characters = {characters:[
    {id:'own',roomMemberId:'player-a',dnd5eCombatState:{sensoryDeceptionReports}},
    {id:'other',roomMemberId:'player-b',dnd5eCombatState:{sensoryDeceptionReports}},
  ]}
  const view = projectCharactersForRoomMember(characters,{memberId:'player-a'}) as typeof characters
  expect(view.characters[0].dnd5eCombatState.sensoryDeceptionReports).toEqual(sensoryDeceptionReports)
  expect(view.characters[1].dnd5eCombatState.sensoryDeceptionReports).toBeUndefined()
  const maps = {maps:[{id:'map',width:100,height:100,gridSize:10,tokens:[
    {id:'actor',characterId:'own',type:'player',x:20,y:20,size:1,dnd5eCombatState:{sensoryDeceptionReports}},
  ]}]}
  expect(JSON.stringify(projectMapsForPlayer(maps,{maps:[]},'own',characters))).not.toContain('sensoryDeceptionReports')
  expect(characters.characters[1].dnd5eCombatState.sensoryDeceptionReports).toEqual(sensoryDeceptionReports)
})
