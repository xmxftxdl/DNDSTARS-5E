export interface ExplicitWaterBreathingPolicy {id:string;sourceKind?:'subclass-passive';subclassId?:string;classId?:string;minimumLevel:number;classRequirements:readonly {classId:string;minimumLevel:number}[];classChoiceRequirements:readonly {classId:string;groupId:string;anyOf:readonly string[]}[]}
export function explicitWaterBreathingPoliciesFromPackage(p:unknown):ExplicitWaterBreathingPolicy[]
export function explicitCharacterCanBreatheWater(character:unknown,policies:readonly ExplicitWaterBreathingPolicy[]):boolean

export interface ExplicitSummonedMonsterConstitution {pluginId:string;monsterId:string;constitutionScore:number}
export function explicitSummonedMonsterConstitutionsFromPackage(p:unknown):ExplicitSummonedMonsterConstitution[]
