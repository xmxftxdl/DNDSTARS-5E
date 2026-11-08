import {FALSE_HYDRA} from './falseHydraDefinition'
import type {Dnd5eContentPackageV2} from '../contentPackageV2'
export function createFalseHydraPackage():Dnd5eContentPackageV2 {
 return {format:'dndstars5e-content',schemaVersion:2,
  manifest:{id:'local.doco.false-hydra-2014',name:'伪海德拉 · 四头负伤版',version:'1.0.0',apiVersion:2,
    rulesetId:'dnd5e-2014-srd-5.1',publisher:'Doco',license:'LicenseRef-UserProvided',distributionPolicy:'room-ephemeral',contentCategory:'mixed',
    description:'用户提供的自定义怪物。必须先部署支持 false-hydra-v1 的服务器和前端；旧版本不能完整运行。寂静挽歌采用耳聋可见规则。'},
  provenance:{edition:'2014',contentMode:'incremental',sourceTitle:'用户提供：伪海德拉 False Hydra（四头负伤版）'},assets:[],
  content:{races:[],backgrounds:[],features:[],feats:[],spells:[],items:[],abilityGenerationMethods:[],headlessActions:[],subclasses:[],classes:[],monsters:[structuredClone(FALSE_HYDRA)]}}
}
