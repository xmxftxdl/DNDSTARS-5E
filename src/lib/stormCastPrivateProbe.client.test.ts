import {it,expect} from 'vitest'
import ts from 'typescript'
import source from './sharedApi.ts?raw'
const marker='export async function readStormCastOriginalPreparationBook('
const body=source.slice(source.indexOf(marker))
if(!source.includes(marker))throw Error('Actual private probe implementation missing')
const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const identity={parentId:'actual-parent',mapId:'actual-map',combatId:'actual-combat'}
function actualClient(fetcher:(url:string)=>Promise<Response>){
 return new Function('exports','sharedApiCandidates','fetchSharedCandidate','sharedSessionUrl','sharedAccessHeaders','sharedMemberHeaders','sharedProtocolHeaders',js+';return readStormCastOriginalPreparationBook')({},()=>['first','second'],fetcher,(url:string)=>url,()=>({}),()=>({}),()=>({})) as (input:typeof identity)=>Promise<unknown>
}
it('the actual client returns optional absence only for the exact private absent response',async()=>{
 const read=actualClient(async()=>Response.json({ok:true,present:false,sourceKind:'storm-cast-preparation-probe-v1',...identity}))
 expect(await read(identity)).toBeUndefined()
 const foreign=actualClient(async()=>Response.json({ok:true,present:false,sourceKind:'storm-cast-preparation-probe-v1',...identity,parentId:'foreign'}))
 await expect(foreign(identity)).rejects.toThrow('invalid-private-probe-response')
})
it('a reachable authority stale rejection never falls back to another server absence',async()=>{
 const calls:string[]=[];const read=actualClient(async url=>{calls.push(url);return calls.length===1?Response.json({error:'storm-cast-preparation:current-private-source-required'},{status:403}):Response.json({ok:true,present:false,sourceKind:'storm-cast-preparation-probe-v1',...identity})})
 await expect(read(identity)).rejects.toThrow('current-private-source-required')
 expect(calls).toEqual(['first/state/storm-cast-preparation/probe'])
})
it('only an unreachable network candidate permits the ordinary next-candidate transport retry',async()=>{
 const calls:string[]=[];const read=actualClient(async url=>{calls.push(url);if(calls.length===1)throw Error('network-unreachable');return Response.json({ok:true,present:false,sourceKind:'storm-cast-preparation-probe-v1',...identity})})
 expect(await read(identity)).toBeUndefined();expect(calls).toHaveLength(2)
})
