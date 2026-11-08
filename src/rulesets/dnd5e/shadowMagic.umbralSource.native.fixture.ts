import { nativeWalkSource, namespace } from './shadowMagic.walkSource.native.fixture'
import { parseDnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { automationCapabilityFromLegacyStatus as cap } from '../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
export { namespace }
export const umbralFeatureId = namespace + ':umbral-form-native'

export async function nativeUmbralSource() {
  const prior = structuredClone(await nativeWalkSource()), bundle = { ...prior, definitions: [...prior.definitions] }
  const sub = bundle.definitions.find(definition => definition.kind === 'subclass')!.payload as any
  const summary = sub.abilities.find((ability: any) => ability.id === 'umbral-form')
  if (!summary) throw Error('Original Umbral Form required')
  const text = summary.description
  summary.automation = 'manual'; summary.trigger = { kind: 'passive' }; summary.targeting = { kind: 'self' }; summary.effects = []
  for (const key of ['cost', 'requirements', 'limits', 'duration', 'mechanic', 'choices', 'rolls', 'predicates']) delete summary[key]
  summary.passiveImplementationReferences = [{kind:'feature',id:'umbral-form-native'}]
  sub.advancements = [...(sub.advancements ?? []), { schemaVersion:1,id:'umbral-form-native-grant',level:18,kind:'build-grant',grants:[{kind:'feature',featureId:umbralFeatureId}] }]
  const use: Dnd5eActivityDefinitionV1 = {
    schemaVersion:1,id:'umbral-form',name:'幽影形态',description:text,
    activation:{kind:'bonus-action'},invocation:{kind:'active',confirmation:'actor-choice'},legacySource:{kind:'feature',id:'umbral-form-native',magical:true},
    target:{kind:'self'},requirements:[{kind:'class-level',classId:'sorcerer',minimum:18},{kind:'turn-owner',owner:'actor'}],
    consumption:[{kind:'action-economy',economy:'bonus-action',amount:1,consumeOn:'resolve'},
      {kind:'resource',resourceId:'dnd5e-sorcery-points',amount:{kind:'constant',value:6},consumeOn:'resolve'}],
    automation:cap('full'),outcomes:[{id:'manifest',when:{kind:'always'},operations:[{id:'manifest',kind:'apply-effect',target:'actor',effectId:'umbral-body'}]}],
    effects:[{schemaVersion:1,id:'umbral-body',name:'幽影形态',magical:true,duration:{kind:'rounds',rounds:10,expiresAt:'source-turn-start'},stacking:'replace',
      sourceLink:{sourceMustNotBeIncapacitated:true},breakOn:['source-dies'],
      modifiers:[{kind:'object-creature-traversal',difficultTerrain:true,endOwnTurnInsideObjectDamage:{amount:5,type:'force'}},
        ...(['acid','bludgeoning','cold','fire','lightning','necrotic','piercing','poison','psychic','slashing','thunder'] as const).map(damageType=>({kind:'damage-resistance' as const,damageType}))],
      grants:['dismiss-umbral-form']}],
  }
  const dismiss: Dnd5eActivityDefinitionV1 = {
    schemaVersion:1,id:'dismiss-umbral-form',name:'结束幽影形态',description:text,
    activation:{kind:'bonus-action'},invocation:{kind:'active',confirmation:'actor-choice'},legacySource:{kind:'feature',id:'umbral-form-native',magical:true},
    target:{kind:'self'},requirements:[{kind:'turn-owner',owner:'actor'}],requiresEffectGrant:true,
    consumption:[{kind:'action-economy',economy:'bonus-action',amount:1,consumeOn:'resolve'}],automation:cap('full'),
    outcomes:[{id:'dismiss',when:{kind:'always'},operations:[{id:'dismiss',kind:'remove-effect',target:'actor',effectId:'umbral-body',source:'self'}]}],
  }
  bundle.definitions.push({schemaVersion:1,namespace,version:'0.0.1',kind:'feature',id:'umbral-form-native',name:use.name,description:text,
    payload:{id:'umbral-form-native',name:use.name,description:text,summary:'Original18, BA6SP,1minute, resistance except force/radiant, actual object traversal/own-end damage; dismiss/incap/death lifecycle.',
      automation:'full',sourceClassId:'sorcerer',sourceSubclassId:namespace+':shadow-magic',minimumLevel:18,grantedBySubclass:true,classRequirements:[{classId:'sorcerer',minimumLevel:18}]},
    automation:cap('full'),activities:[use,dismiss]})
  const parsed=parseDnd5eUnifiedContentBundleV1(JSON.stringify(bundle))
  if (!parsed) throw Error('Actual registered Umbral source validation required')
  return parsed
}
