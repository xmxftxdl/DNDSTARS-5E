import type{Dnd5eActivityDefinitionV1}from'./dnd5eActivityContracts'
/** Closed existing Detect Thoughts recipes only. The Host snapshot derives protection from the actual owner source. Costs and caster concentration remain normal. */
export function dnd5eActivityWithSoulThoughtPolicy(activity:Dnd5eActivityDefinitionV1,targets:readonly{id:string;soulThoughtPolicy?:'blocked'|'real'|'false'}[]):Dnd5eActivityDefinitionV1{
 const source=activity.legacySource,spell=source?.kind==='spell'?source.id:activity.spellInvocation?.spellId
 if(!spell||spell.split(':').at(-1)!=='detect-thoughts'||targets.length!==1)return activity
 const policy=targets[0].soulThoughtPolicy
 if(!policy||policy==='real')return activity
 if(policy==='false')return{...activity,outcomes:(activity.outcomes??[]).map(outcome=>({...outcome,operations:outcome.operations.map(operation=>operation.kind==='manual-adjudication'?{...operation,prompt:'确认目标会说至少一种语言。思想内容使用这次原法术的私有回应。'}:operation)}))}
 const blocked=true
 // Search does not read a protected creature's thoughts; it may still locate an eligible mind under the spell's normal rules.
 if(activity.id.endsWith(':search')||activity.id.endsWith(':contest'))return activity
 const narrative={id:'soul-of-deceit-reading-result',kind:'narrative-prompt' as const,prompt:'无法读取目标的思想。'}
 return{...activity,checks:blocked?undefined:activity.checks,outcomes:[...(activity.outcomes??[]).filter(o=>!blocked||o.when.kind==='always').map(o=>({...o,operations:o.operations.flatMap(op=>{if(op.kind==='manual-adjudication')return[];if(blocked&&op.kind==='apply-effect'&&op.target!=='actor')return[];return[op]})})).filter(outcome=>outcome.operations.length>0),{id:'soul-of-deceit-reading-result',when:{kind:'always'},operations:[narrative]}]}
}
