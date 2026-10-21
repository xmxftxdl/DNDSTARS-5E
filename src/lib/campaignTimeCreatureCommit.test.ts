import {describe,it,expect} from 'vitest'
import {commitCampaignTimeCreatureProjection} from './campaignTimeCreatureCommit'
import {projectDnd5eCampaignTimeCreatureTokens} from '../components/CampaignTimeSystem'

describe('authoritative timed creature projection',()=>{
 for(const changedResource of ['maps','characters','campaign-time'])it(`recomputes after ${changedResource} changes instead of restoring removed effects`,async()=>{
  const state:any={maps:{_sync:{revision:4},maps:[{id:'m',tokens:[{id:'enemy',type:'enemy',hp:10,maxHp:10,dnd5eWorldTimeAppliedMinute:100,dnd5eCombatState:{schemaVersion:2,conditions:[],activeEffects:[]}}]}]},characters:{_sync:{revision:2},characters:[]},'campaign-time':{_sync:{revision:3},worldMinute:101,worldSecondRemainder:15,timers:[],advances:[]}}
  let attempts=0
  await commitCampaignTimeCreatureProjection({
   loadResource:async(name:string)=>structuredClone(state[name]),
   saveResourcesAtomically:async(writes,options)=>{
    attempts++
    expect(writes[0].expectedRevision).toBe(state.maps._sync.revision)
    expect(options?.readRevisions).toEqual({characters:state.characters._sync.revision,'campaign-time':state['campaign-time']._sync.revision})
    if(attempts===1){state[changedResource]._sync.revision++;state.maps.maps[0].tokens[0].hp=7;throw Error('revision-conflict')}
    const saved:any=writes[0].data
    expect(saved.maps[0].tokens[0].hp).toBe(7)
    expect(saved.maps[0].tokens[0].dnd5eCombatState.conditions ?? []).toEqual([])
    expect(saved.maps[0].tokens[0].dnd5eCombatState.activeEffects ?? []).toEqual([])
    expect(saved.maps[0].tokens[0].dnd5eWorldTimeAppliedMinute).toBe(101)
    return {status:'committed',transactionId:'test',revisions:{maps:5}}
   },
  },projectDnd5eCampaignTimeCreatureTokens,()=>true)
  expect(attempts).toBe(2)
 })
 it('does not publish into a departed room',async()=>{
  let writes=0
  const result=await commitCampaignTimeCreatureProjection({loadResource:async()=>({}) as any,saveResourcesAtomically:async()=>{writes++;throw Error('unexpected-write')}},()=>{throw Error('unexpected-projection')},()=>false)
  expect(result).toBe(false);expect(writes).toBe(0)
 })
})
