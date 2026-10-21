export interface SubclassLevelChoicePolicy {
  classId: string
  subclassId: string
  key: string
  maxSelections: number
  replaceOnClassLevelGain?: boolean
  options: readonly string[]
}
export function subclassChoicePoliciesFromPackage(value: unknown): SubclassLevelChoicePolicy[]
export function preserveSubclassLevelChoices<T extends object>(target: T, source: unknown, policies?: readonly SubclassLevelChoicePolicy[], advancedClassId?: string): T
