import {normalizeCharacter} from '../../store/characters'
import {resolveDnd5eActivity} from './activities/dnd5eActivityExecutor'
import {validateDnd5eActivityDefinitionV1} from './activities/dnd5eActivityValidation'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import { expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { dnd5eSourceKnowsTargetLocation } from './sourceLocationAwareness'

function fixture() {
  const effect = createDnd5eMechanicalEffect({ definitionId: 'test:location', label: 'Location',
    source: { kind: 'spell', actorId: 'caster' }, targetId: 'target',
    modifiers: { locationKnownToSource: true } })
  return { observerMap: { id: 'a', dnd5ePlane: 'material' } as BattleMap,
    targetMap: { id: 'b', dnd5ePlane: 'material' } as BattleMap,
    observer: { id: 'caster', type: 'enemy' } as Token,
    target: { id: 'target', type: 'enemy', dnd5eCombatState: { activeEffects: [effect] } } as Token, characters: [] }
}

it('retains the mechanical modifier through normalization and limits it to the source', () => {
  const input = fixture()
  const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(input.target.dnd5eCombatState!.activeEffects)))
  expect(validateDnd5eActiveEffectsStrict(effects).ok).toBe(true)
  expect(effects[0].modifiers?.locationKnownToSource).toBe(true)
  input.target.dnd5eCombatState!.activeEffects = effects
  expect(dnd5eSourceKnowsTargetLocation(input)).toBe(true)
  expect(dnd5eSourceKnowsTargetLocation({ ...input, observer: { ...input.observer, id: 'other' } })).toBe(false)
  expect(validateDnd5eActiveEffectsStrict([{ ...effects[0], modifiers: { locationKnownToSource: 'yes' } }]).ok).toBe(false)
})

it('does not infer a shared remote plane and resumes when explicit plane identity matches', () => {
  const input = fixture()
  input.targetMap.dnd5ePlane = undefined
  expect(dnd5eSourceKnowsTargetLocation(input)).toBe(false)
  input.targetMap.dnd5ePlane = 'shadow'
  expect(dnd5eSourceKnowsTargetLocation(input)).toBe(false)
  input.targetMap.dnd5ePlane = 'material'
  expect(dnd5eSourceKnowsTargetLocation(input)).toBe(true)
  input.target.dnd5eCombatState!.activeEffects = []
  expect(dnd5eSourceKnowsTargetLocation(input)).toBe(false)
})

it('validates and compiles the imported modifier into the effect proposal',()=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'locate',name:'Locate',activation:{kind:'action'},
  target:{kind:'creature',relation:'any',count:1},automation:automationCapabilityFromLegacyStatus('full'),
  effects:[{schemaVersion:1,id:'location',name:'Location',duration:{kind:'concentration',maximumRounds:600},concentration:true,
   modifiers:[{kind:'source-location-awareness'}],stacking:'replace'}],
  outcomes:[{id:'apply',when:{kind:'always'},operations:[{id:'apply',kind:'apply-effect',target:'target',effectId:'location'}]}]}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 const actor={id:'caster',controller:'players' as const,level:5,proficiencyBonus:3,abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},armorClass:12,conditions:[],currentHp:30,maxHp:30}
 const result=resolveDnd5eActivity({activity,actor,targets:[{...actor,id:'target',controller:'dm'}],rolls:{}})
 expect(result).toMatchObject({ok:true,proposals:[{kind:'apply-effect',targetId:'target',concentration:true,modifierGroups:[{locationKnownToSource:true}]}]})
})

it('uses stable source character identity after the caster changes map tokens',()=>{
 const input=fixture()
 const effect=input.target.dnd5eCombatState!.activeEffects![0]
 effect.source={...effect.source,actorId:'old-token',characterId:'hero'}
 const observer={...input.observer,id:'new-token',characterId:'hero'}
 const character=normalizeCharacter({id:'hero',name:'Caster',maxHp:30,currentHp:30})
 expect(dnd5eSourceKnowsTargetLocation({...input,observer,characters:[character]})).toBe(true)
 expect(dnd5eSourceKnowsTargetLocation({...input,observer:{...observer,characterId:'other'},characters:[normalizeCharacter({id:'other',name:'Other',maxHp:30,currentHp:30})]})).toBe(false)
})
