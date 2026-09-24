/** Public, Worker-only authoring surface. Bundle implementations into one ESM file. */
import type {
 Dnd5eRulesPluginApi, Dnd5eRulesPluginManifest, Dnd5ePluginAction,
 Dnd5ePluginDiceRollDeclaration, Dnd5ePluginDiceRollResult, JsonValue,
} from './pluginApi'
import type { Dnd5eCombatant } from './headlessCombatEngine'
import type { Dnd5ePluginImageAssetDefinition } from './pluginAssets'
import type { Dnd5eUnifiedContentDefinitionV1 } from './unifiedContent'
import type { Dnd5eSandboxConditionDuration } from './pluginSandbox'
import type { Dnd5eStandardConditionId } from './conditions'
import type { Dnd5eDamageType } from './damageTypes'

export type ModuleReadonly<T> = T extends (...args: never[]) => unknown ? T :
 T extends readonly (infer V)[] ? readonly ModuleReadonly<V>[] :
 T extends object ? {readonly [K in keyof T]: ModuleReadonly<T[K]>} : T
export type ModuleResolution = {readonly kind:'success'} | {readonly kind:'failure';readonly reason:string}
export interface ModuleActionContext {
 readonly actor: ModuleReadonly<Dnd5eCombatant>
 readonly target?: ModuleReadonly<Dnd5eCombatant>
 readonly targets: readonly ModuleReadonly<Dnd5eCombatant>[]
 readonly action: ModuleReadonly<Dnd5ePluginAction>
 readonly rolls: Readonly<Record<string, ModuleReadonly<Dnd5ePluginDiceRollResult>>>
 heal(targetId:string, amount:number):number
 grantTemporaryHitPoints(targetId:string, amount:number):number
 dealDamage(targetId:string, amount:number, type:Dnd5eDamageType):number
 applyStandardCondition(targetId:string, condition:Dnd5eStandardConditionId, duration:Dnd5eSandboxConditionDuration):boolean
 spendResource(id:string, amount?:number):boolean
 restoreResource(id:string, amount?:number):boolean
 succeed():ModuleResolution
 fail(reason:string):ModuleResolution
}
export interface ModuleAction {
 id:string
 allowOffTurn?:boolean
 rolls?:readonly Dnd5ePluginDiceRollDeclaration[]
 resolve(context:ModuleActionContext):ModuleResolution | Promise<ModuleResolution>
}
export interface CommunityModuleSdkV1 extends Pick<Dnd5eRulesPluginApi,
 'apiVersion'|'rulesetId'|'registerResource'|'registerRace'|'registerBackground'|
 'registerAbilityGenerationMethod'|'registerSpell'|'registerItem'|'registerMonster'> {
 readonly sdkVersion:1
 registerContent(definition:Dnd5eUnifiedContentDefinitionV1):string
 registerImageAsset(asset:Dnd5ePluginImageAssetDefinition):string
 registerHeadlessAction(action:ModuleAction):string
}
export interface CommunityModuleV1 {
 /** Optional inside .starmod: the archive manifest is authoritative. Required for standalone ESM. */
 manifest?:Dnd5eRulesPluginManifest
 migrations?:readonly {fromVersion:number;toVersion:number;migrate(state:JsonValue):JsonValue}[]
 setup(api:CommunityModuleSdkV1):void | (() => void)
}
export type {Dnd5eUnifiedContentDefinitionV1} from './unifiedContent'
export type {Dnd5eActivityDefinitionV1,Dnd5eActivityOperationV1} from './activities/dnd5eActivityContracts'
export type {Dnd5eEffectDefinitionV1} from './activities/dnd5eEffectContracts'
