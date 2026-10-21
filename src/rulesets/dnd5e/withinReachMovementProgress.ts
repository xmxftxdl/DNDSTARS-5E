export interface Dnd5eMovementProgressPosition {
  x: number
  y: number
  elevationFeet: number
}

export interface Dnd5eWithinReachMovementProgress {
  turnKey: string
  end: Dnd5eMovementProgressPosition
  attackerPosition: Dnd5eMovementProgressPosition
  reachFeet: number
  distanceFeet: number
  lastCommitKey: string
}

const samePosition = (a: Dnd5eMovementProgressPosition | undefined, b: Dnd5eMovementProgressPosition | undefined) =>
  !!a && !!b && [a.x,a.y,a.elevationFeet,b.x,b.y,b.elevationFeet].every(Number.isFinite) &&
  Math.hypot(a.x-b.x,a.y-b.y,a.elevationFeet-b.elevationFeet)<1e-6

/** Only committed travel from this turn, at unchanged positions/reach, can carry forward. */
export function dnd5eWithinReachMovementDistance(input: {
  previous?: Dnd5eWithinReachMovementProgress
  turnKey: string
  from: Dnd5eMovementProgressPosition
  attackerPosition: Dnd5eMovementProgressPosition
  reachFeet: number
}): number {
  const previous=input.previous
  return previous?.turnKey===input.turnKey && previous.reachFeet===input.reachFeet &&
    samePosition(previous.end,input.from) && samePosition(previous.attackerPosition,input.attackerPosition) &&
    Number.isFinite(previous.distanceFeet) && previous.distanceFeet>=0 && previous.distanceFeet<5
    ? previous.distanceFeet : 0
}

/** A successful commit consumes complete five-foot windows and retains only the remainder. */
export function advanceDnd5eWithinReachMovement(input: {
  previous?: Dnd5eWithinReachMovementProgress
  turnKey: string
  commitKey: string
  from: Dnd5eMovementProgressPosition
  to: Dnd5eMovementProgressPosition
  attackerPosition: Dnd5eMovementProgressPosition
  reachFeet: number
  distanceFeet: number
  voluntary: boolean
  withinReach: boolean
}): Dnd5eWithinReachMovementProgress | undefined {
  if (!input.voluntary || !input.withinReach || !Number.isFinite(input.distanceFeet) || input.distanceFeet<=0) return undefined
  if(input.previous?.lastCommitKey===input.commitKey && input.previous.turnKey===input.turnKey &&
    samePosition(input.previous.end,input.to) && samePosition(input.previous.attackerPosition,input.attackerPosition) &&
    input.previous.reachFeet===input.reachFeet) return input.previous
  const total=dnd5eWithinReachMovementDistance(input)+input.distanceFeet
  return {turnKey:input.turnKey,end:{...input.to},attackerPosition:{...input.attackerPosition},
    reachFeet:input.reachFeet,distanceFeet:Math.max(0,total-Math.floor((total+1e-8)/5)*5),lastCommitKey:input.commitKey}
}
