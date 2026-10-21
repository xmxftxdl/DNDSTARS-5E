/** Host-owned turn evidence, persisted with the combatant. */
export interface Dnd5eDeathSaveTurn {
  turnKey: string
  eligible: boolean
  resolved: boolean
}

export function createDnd5eDeathSaveTurn(turnKey:string, actor:{currentHp:number;deathSaves:{dead:boolean;stable:boolean}}):Dnd5eDeathSaveTurn {
  return {turnKey,eligible:actor.currentHp===0&&!actor.deathSaves.dead&&!actor.deathSaves.stable,resolved:false}
}

export function dnd5eDeathSaveTurnAvailable(record:Dnd5eDeathSaveTurn|undefined,turnKey:string):boolean {
  return record?.turnKey===turnKey && record.eligible===true && record.resolved===false
}
