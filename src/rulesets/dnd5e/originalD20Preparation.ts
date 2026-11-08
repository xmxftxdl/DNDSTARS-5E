import {createDnd5eOriginalD20Session} from './damageCommitSession'
import type {Dnd5eHeadlessCombatState} from './headlessCombatEngine'
import type {AllyNaturalOneRequest,AllyNaturalOneDecision,OriginalD20Ready} from './allyNaturalOneCheckpoint'

type Choice=(input:{request:AllyNaturalOneRequest;state:Dnd5eHeadlessCombatState;eventId:string})=>Promise<AllyNaturalOneDecision|undefined>
/** Stops the actual prepared parent at its first matching original-die boundary; publishes nothing. */
export async function prepareDnd5eOriginalD20ForParent<Input extends {prepared?:{state:Dnd5eHeadlessCombatState}},Result>(input:{
  parentId:string
  source:Input
  resolve:(input:Input)=>Result
  actorId:string
  kind:OriginalD20Ready['kind']
  authorityUnchanged:()=>boolean
  choose:Choice
}){
  const state=input.source.prepared?.state
  if(!state)throw Error('original-d20-prepared-state-required')
  const session=createDnd5eOriginalD20Session(input.source,input.resolve,input.actorId,input.kind)
  const decisions:{request:AllyNaturalOneRequest;decision?:AllyNaturalOneDecision}[]=[]
  const guard=()=>{if(!input.authorityUnchanged())throw Error('original-d20-stale-authority')}
  try{
    guard();let result=session.run(state)
    for(let count=0;result.status==='pending-ally-natural-one'&&count<64;count++){
      const pending=result
      guard()
      const decision=await input.choose({request:structuredClone(pending.request),state:structuredClone(pending.snapshot),eventId:input.parentId+':original-d20:'+pending.occurrence})
      guard()
      decisions.push({request:structuredClone(pending.request),decision:structuredClone(decision)})
      result=session.resumeAllyNaturalOne(state,pending.occurrence,pending.request,decision)
    }
    guard()
    if(result.status!=='original-d20-ready')throw Error('original-d20-parent-did-not-reach-boundary:'+result.status)
    const ready=structuredClone(result.request),snapshot=structuredClone(result.snapshot),events=structuredClone(result.events)
    return {ready,state:snapshot,events,decisions:structuredClone(decisions),
      replayFor(parentId:string,fallback:Choice){
        if(parentId!==input.parentId)throw Error('original-d20-wrong-parent')
        let cursor=0
        return {
          async choose(request:Parameters<Choice>[0]){
            const prior=decisions[cursor]
            if(!prior)return fallback(request)
            if(JSON.stringify(prior.request)!==JSON.stringify(request.request))throw Error('original-d20-replay-request-changed')
            cursor++;return structuredClone(prior.decision)
          },
          assertConsumed(){if(cursor!==decisions.length)throw Error('original-d20-replay-receipt-not-consumed')},
        }
      },
    }
  }finally{session.cancel()}
}
