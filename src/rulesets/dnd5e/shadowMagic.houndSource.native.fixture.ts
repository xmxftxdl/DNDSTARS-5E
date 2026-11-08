import { nativeUmbralSource, namespace } from './shadowMagic.umbralSource.native.fixture'
import { parseDnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { automationCapabilityFromLegacyStatus as cap } from '../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
export { namespace }
export const houndFeatureId=namespace+':hound-native'

/** Private working fixture. No archive/whole-Hound certification until every original gate passes. */
export async function nativeHoundSource() {
  const prior=structuredClone(await nativeUmbralSource()),bundle={...prior,definitions:[...prior.definitions]}
  const sub=bundle.definitions.find(definition=>definition.kind==='subclass')!.payload as any
  const summary=sub.abilities.find((ability:any)=>ability.id==='hound-of-ill-omen')
  if(!summary)throw Error('Original Hound source required')
  const text=summary.description
  summary.automation='manual';summary.trigger={kind:'passive'};summary.targeting={kind:'self'};summary.effects=[]
  for(const key of['cost','requirements','limits','duration','mechanic','choices','rolls','predicates'])delete summary[key]
  delete summary.passiveImplementationReferences
  sub.advancements=[...(sub.advancements??[]),{schemaVersion:1,id:'hound-native-grant',level:6,kind:'build-grant',grants:[{kind:'feature',featureId:houndFeatureId}]}]
  const use:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'hound-of-ill-omen',name:'凶兆猎犬',description:text,
    activation:{kind:'bonus-action'},invocation:{kind:'active',confirmation:'actor-choice'},legacySource:{kind:'feature',id:'hound-native',magical:true},
    target:{kind:'creature',relation:'any',count:1,includeSelf:true,rangeFeet:120,requiresLineOfSight:true},
    requirements:[{kind:'class-level',classId:'sorcerer',minimum:6},{kind:'turn-owner',owner:'actor'}],
    consumption:[{kind:'action-economy',economy:'bonus-action',amount:1,consumeOn:'resolve'},
      {kind:'resource',resourceId:'dnd5e-sorcery-points',amount:{kind:'constant',value:3},consumeOn:'resolve'}],
    automation:cap('full'),outcomes:[{id:'call',when:{kind:'always'},operations:[{id:'call',kind:'summon',monsterId:'srd-5.1:dire-wolf',
      count:{kind:'constant',value:1},timing:'immediate',durationRounds:50,concentration:false,side:'ally',groupInitiative:false,illOmenHound:true}]}]}
  bundle.definitions.push({schemaVersion:1,namespace,version:'0.0.1',kind:'feature',id:'hound-native',name:use.name,description:text,
    payload:{id:'hound-native',name:use.name,description:text,summary:'PRIVATE UNSEALED Hound6 development; creation/policy consumers under actual native tests, no completion claim.',automation:'full',
      sourceClassId:'sorcerer',sourceSubclassId:namespace+':shadow-magic',minimumLevel:6,grantedBySubclass:true,classRequirements:[{classId:'sorcerer',minimumLevel:6}]},
    automation:cap('full'),activities:[use]})
  const parsed=parseDnd5eUnifiedContentBundleV1(JSON.stringify(bundle));if(!parsed)throw Error('Actual Hound source validation required');return parsed
}
