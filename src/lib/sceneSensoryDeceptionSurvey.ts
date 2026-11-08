/** Private DM facts about sensory deception, including effects outside the visible map. */
export interface SceneSensoryDeceptionSurvey {
  centerX: number
  centerY: number
  elevationFeet: number
  radiusFeet: number
  presences: Array<{ eastFeet: number; northFeet: number; elevationFeet: number;
    radiusFeet?: number; halfExtentsFeet?: {east:number;north:number;height:number} }>
}

export function validSceneSensoryDeceptionSurvey(value: unknown): value is SceneSensoryDeceptionSurvey {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const survey = value as SceneSensoryDeceptionSurvey
  return Object.keys(survey).every(key => ['centerX','centerY','elevationFeet','radiusFeet','presences'].includes(key)) &&
    [survey.centerX,survey.centerY,survey.elevationFeet,survey.radiusFeet].every(n => typeof n === 'number' && Number.isFinite(n)) &&
    survey.radiusFeet > 0 && survey.radiusFeet <= 1_000_000 && Array.isArray(survey.presences) && survey.presences.length <= 100 &&
    survey.presences.every(point => point && typeof point === 'object' && !Array.isArray(point) &&
      Object.keys(point).every(key => ['eastFeet','northFeet','elevationFeet','radiusFeet','halfExtentsFeet'].includes(key)) &&
      [point.eastFeet,point.northFeet,point.elevationFeet].every(n => typeof n === 'number' && Number.isFinite(n)) &&
      !(point.radiusFeet!=null && point.halfExtentsFeet!=null) &&
      (point.radiusFeet===undefined || Number.isFinite(point.radiusFeet) && point.radiusFeet>=0 && point.radiusFeet<=1_000_000) &&
      (point.halfExtentsFeet===undefined || point.halfExtentsFeet!==null && typeof point.halfExtentsFeet==='object' && !Array.isArray(point.halfExtentsFeet) &&
        Object.keys(point.halfExtentsFeet).every(key=>['east','north','height'].includes(key)) &&
        [point.halfExtentsFeet.east,point.halfExtentsFeet.north,point.halfExtentsFeet.height].every(n=>typeof n==='number' && Number.isFinite(n) && n>=0 && n<=1_000_000)))
}
