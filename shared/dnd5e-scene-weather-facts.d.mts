export interface Dnd5eSceneWeatherFactsV1{schemaVersion:1;raining:boolean;wind:null|{speedMph:number;directionDegrees:number}}
export function validDnd5eSceneWeatherFacts(value:unknown):value is Dnd5eSceneWeatherFactsV1
export function cloneDnd5eSceneWeatherFacts(value:unknown):Dnd5eSceneWeatherFactsV1|undefined
