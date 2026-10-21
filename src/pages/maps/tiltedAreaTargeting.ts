import type {Dnd5eSpellTargetingSession} from '../../application/combat/spells/SpellTargetingContracts'
import type {BattleMap,Dnd5ePluginArea} from '../../store/maps'
import type {GridCell} from '../../lib/gridCombat'
import {dnd5ePluginSpellDefinition} from '../../rulesets/dnd5e/pluginApi'
import {dnd5ePluginSpellActivity} from '../../rulesets/dnd5e/pluginSpellTransaction'
import {dnd5eActivityWithTargetChoicesV1} from '../../rulesets/dnd5e/activities/dnd5eActivityChoices'
import {resolveDnd5eActivityAreaMapSelectionV1} from '../../rulesets/dnd5e/activities/dnd5eActivityMapInteraction'
import {rectangularPrismOutline} from '../../../shared/rectangular-prism.mjs'

export function tiltableSpellActivity(targeting:Dnd5eSpellTargetingSession|null){
 const raw=targeting&&dnd5ePluginSpellActivity(dnd5ePluginSpellDefinition(targeting.spellId))
 if(!raw||!targeting)return undefined
 const activity=dnd5eActivityWithTargetChoicesV1(raw,targeting.activityChoices)
 return activity.target.kind==='area'&&activity.target.tiltable?activity:undefined
}

/** Preview calls the same Host selector. No client-supplied affected targets are trusted. */
export function tiltedAreaTargetingPreview(map:BattleMap,targeting:Dnd5eSpellTargetingSession,anchorCell:GridCell){
 const activity=tiltableSpellActivity(targeting)
 if(!activity||targeting.areaTargetPitchDegrees==null&&targeting.areaTargetRollDegrees==null)return undefined
 const actorToken=map.tokens.find(token=>token.characterId===targeting.characterId)
 const selected=actorToken&&resolveDnd5eActivityAreaMapSelectionV1({map,activity,actorToken,anchorCell,
  rectAngleDegrees:targeting.areaTargetAngleDegrees??0,rectPitchDegrees:targeting.areaTargetPitchDegrees??0,
  rectRollDegrees:targeting.areaTargetRollDegrees??0,targetElevationFeet:targeting.targetElevationFeet,
  dimensions:{widthFeet:targeting.areaTargetWidthFeet,heightFeet:targeting.areaTargetHeightFeet,
   lengthFeet:targeting.areaTargetLengthFeet,volumeHeightFeet:targeting.areaTargetVolumeHeightFeet}})
 if(!selected||!actorToken)return {cells:[anchorCell],valid:false,variant:'attack' as const}
 const area:Dnd5ePluginArea={id:'preview',pluginId:'preview',featureId:activity.id,label:activity.name,color:'#fff',
  sourceTokenId:actorToken.id,sourceCharacterId:targeting.characterId,createdRound:0,expiresAfterRound:0,
  anchorCell: selected.anchorCell,cells:[...selected.cells],rectGeometry:selected.rectGeometry,
  vertical:{mode:'volume',baseElevationFeet:selected.areaPlacement.elevationFeet??0,heightFeet:selected.areaPlacement.heightFeet!}}
 return {cells:[...selected.cells],valid:true,variant:'attack' as const,areaPolygon:rectangularPrismOutline(map,area)}
}
