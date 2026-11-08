import{withTempestuousBeforePlainOriginalReplay}from'./tempestuousBeforePreparedOriginalReplay'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import type{Dnd5eHeadlessCombatState}from'./headlessCombatEngine'
import type{Dnd5eDamageReplaySession}from'./damageCommitSession'
import type{Dnd5eDamageReactionFlowOptions}from'./damageReactionFlow'
/** Initializes and genuinely runs the real native session synchronously. Later
 * async choices resume that same native session; no callback result is invented. */
export function initializeTempestuousBeforeReactionSession<Input extends{prepared?:{state:Dnd5eHeadlessCombatState}},Result>(options:Dnd5eDamageReactionFlowOptions,input:Input,resolve:(input:Input)=>Result,make:()=>Dnd5eDamageReplaySession<Result>):Dnd5eDamageReplaySession<Result>{
 const token=options.tempestuousBeforeOriginalReplay;if(token===undefined)return make()
 if((resolve as unknown)!==resolvePreparedDnd5eSpellCast||!input.prepared)throw Error('tempestuous-flow:actual-core-spell-required')
 if(options.enableTempestuousBeforeSpell)throw Error('tempestuous-flow:owner-already-recorded')
 if(!options.authorityUnchanged())throw Error('damage-reaction-stale-authority')
 const state=input.prepared.state,signature=JSON.stringify(state);let native:Dnd5eDamageReplaySession<Result>|undefined
 const first=withTempestuousBeforePlainOriginalReplay(input as unknown as Parameters<typeof resolvePreparedDnd5eSpellCast>[0],token,()=>{native=make();const result=native.run(state);if(!options.authorityUnchanged())throw Error('damage-reaction-stale-authority');return result}),session=native!
 let pendingFirst=true
 return{...session,run(current){if(pendingFirst){pendingFirst=false;if(JSON.stringify(current)!==signature){session.cancel();throw Error('tempestuous-flow:changed-first-state')}return first}return session.run(current)}}
}
