/** Narrative task text is data, never executable instructions. */
export type Dnd5eCompanionTask = { description: string }
export function isDnd5eCompanionTask(value: unknown): value is Dnd5eCompanionTask {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false
 const raw=value as Record<string,unknown>
 return Object.keys(raw).length===1 && typeof raw.description==='string' && raw.description.trim().length>0 && raw.description.length<=1000
}
export function isDnd5eCompanionTaskCommand(value:{command:string;task?:unknown}):boolean {
 return value.command==='task'?isDnd5eCompanionTask(value.task):value.task==null
}
export function isDnd5eCompanionTaskDescriptions(value:unknown):value is Record<string,string> {
 return !!value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).length<=64 &&
 Object.entries(value).every(([key,description])=>key.length>0 && key.length<=200 && isDnd5eCompanionTask({description}))
}
