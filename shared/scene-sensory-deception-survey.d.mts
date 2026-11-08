/** Private DM facts about sensory deception, including effects outside the visible map. */
export interface SceneSensoryDeceptionSurvey {
  centerX: number
  centerY: number
  elevationFeet: number
  radiusFeet: number
  presences: Array<{ eastFeet: number; northFeet: number; elevationFeet: number;
    radiusFeet?: number; halfExtentsFeet?: {east:number;north:number;height:number} }>
}

export function validSceneSensoryDeceptionSurvey(value: unknown): value is SceneSensoryDeceptionSurvey
