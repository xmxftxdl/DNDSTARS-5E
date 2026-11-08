import type {Character} from '../../types/character'
import {dnd5eCharacterClassLevel} from '../../rulesets/dnd5e/classLevels'
import {dnd5eCharacterHasPluginFeature,runtimeDnd5ePluginFeatures} from '../../rulesets/dnd5e/plugins/pluginContentCatalog'

/** Registered owned capability only. A copied feature id or private binding is
 * insufficient. The new mechanic still needs its complete schema/consumers
 * before production integration, so current unregistered drafts fail closed.
 */
export function pactWeaponHasImprovedInvocation(owner:Character):boolean{
 if(dnd5eCharacterClassLevel(owner,'warlock')<3||!owner.dnd5eClassChoices?.classes?.warlock?.selections?.['pact-boon']?.includes('blade'))return false
 return runtimeDnd5ePluginFeatures().some(definition=>definition.automation==='full'&&
  definition.declarativeAbility?.automation==='full'&&String(definition.declarativeAbility.mechanic?.kind)==='improved-pact-weapon'&&
  dnd5eCharacterHasPluginFeature(owner,definition.id))
}
