import {it,expect} from 'vitest'
import {createFalseHydraPackage} from './testFixtures/falseHydraPackage'
import {dnd5eRoomRuntimeProjectionV2,encodeDnd5eContentPackageV2,parseDnd5eContentPackageV2,dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {getDnd5eSrdMonster} from './monsters'
import {validateDnd5eMonsterSchema} from './monsterSchema'
it('round-trips and registers every head action, swallowing save choice, and legendary action',()=>{
 const source=createFalseHydraPackage(),parsed=parseDnd5eContentPackageV2(encodeDnd5eContentPackageV2(source))
 expect(parsed).toBeTruthy()
 expect(dnd5eRoomRuntimeProjectionV2(source).content.monsters[0].multipartRule).toBe('false-hydra-v1')
 if(!parsed)return
 expect(validateDnd5eMonsterSchema(parsed.content.monsters[0])).toEqual([])
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(parsed))
 try {
  const monster=getDnd5eSrdMonster(parsed.content.monsters[0].id)
  expect(monster?.multipartRule).toBe('false-hydra-v1')
  expect(monster?.actions.filter(a=>a.multipartHeadId)).toHaveLength(27)
  expect(monster?.legendaryActions).toHaveLength(18)
  const swallow=monster?.actions.find(a=>a.id==='swallow-head-1')
  expect(swallow?.rule?.kind==='source-linked-engulf'&&swallow.rule.effect.escapeSavingThrow?.alternativeAbility).toBe('dex')
 }finally{dispose()}
})
