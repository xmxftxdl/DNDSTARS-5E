import type{DeclarativeSubclassDefinitionV1}from'./declarativeSubclassAbility'
export const nativeMastermindSubclass:DeclarativeSubclassDefinitionV1={
  "schemaVersion": 1,
  "id": "mastermind",
  "classId": "rogue",
  "name": "策士",
  "summary": "专注于影响他人、获取秘密并操纵局势的游荡者子职。",
  "abilities": [
    {
      "schemaVersion": 1,
      "id": "master-of-intrigue",
      "name": "谋陷大师",
      "description": "从3级起，获得易容工具、文书伪造工具和一种自选赌博工具的熟练项，并习得两门自选语言。若听过懂得该语言的生物讲话至少1分钟，可以准确模仿其语气和口音。",
      "level": 3,
      "trigger": {
        "kind": "passive"
      },
      "targeting": {
        "kind": "self"
      },
      "effects": [],
      "automation": "full",
      "mechanic": {
        "kind": "mastermind-observation",
        "purpose": "mimicry"
      }
    },
    {
      "schemaVersion": 1,
      "id": "master-of-tactics",
      "name": "战术大师",
      "description": "从3级起，可以用附赠动作执行协助动作。当用协助支援盟友攻击某个生物时，该攻击目标可以在30尺内，而非通常的5尺范围；攻击目标必须能看到或听到你。",
      "level": 3,
      "trigger": {
        "kind": "passive"
      },
      "targeting": {
        "kind": "self"
      },
      "effects": [],
      "automation": "full",
      "mechanic": {
        "kind": "help-tactics",
        "attackRangeFeet": 30
      }
    },
    {
      "schemaVersion": 1,
      "id": "insightful-manipulator",
      "name": "帷幄之士",
      "description": "从9级起，在战斗外花费至少1分钟观察或与其他生物互动后，选择智力、感知、魅力和职业等级中的两项。DM告知目标在所选项目上相对自身更高、相等或更低；DM也可以提供目标的经历或性格信息。",
      "level": 9,
      "trigger": {
        "kind": "passive"
      },
      "targeting": {
        "kind": "self"
      },
      "effects": [],
      "automation": "full",
      "mechanic": {
        "kind": "mastermind-observation",
        "purpose": "comparison"
      }
    },
    {
      "schemaVersion": 1,
      "id": "misdirection",
      "name": "误导",
      "description": "从13级起，当你成为一次攻击的目标，且你周围5尺内有另一个生物为你提供掩护时，可以用反应将该攻击的目标改为那个生物。",
      "level": 13,
      "trigger": {
        "kind": "before-attack-roll"
      },
      "cost": {
        "economy": "reaction"
      },
      "targeting": {
        "kind": "self"
      },
      "effects": [],
      "automation": "full",
      "mechanic": {
        "kind": "cover-attack-redirection"
      }
    },
    {
      "schemaVersion": 1,
      "id": "soul-of-deceit",
      "name": "瞒天之魂",
      "description": "从17级起，除非你同意，否则你的思想不能被心灵感应或其他能力读取。你可以进行魅力（欺瞒）检定对抗思想阅读者的感知（洞悉）检定；成功时可让其读取到虚假思想。你可以选择让魔法判定你所说为真并显现相应迹象，也不会因魔法效应被强迫说真话。",
      "level": 17,
      "trigger": {
        "kind": "passive"
      },
      "targeting": {
        "kind": "self"
      },
      "effects": [],
      "automation": "full",
      "mechanic": {
        "kind": "soul-of-deceit"
      }
    }
  ],
  "advancements": [
    {
      "schemaVersion": 1,
      "id": "intrigue-tools",
      "level": 3,
      "kind": "build-grant",
      "grants": [
        {
          "kind": "proficiency",
          "category": "tool",
          "id": "disguise-kit"
        },
        {
          "kind": "proficiency",
          "category": "tool",
          "id": "forgery-kit"
        }
      ]
    },
    {
      "schemaVersion": 1,
      "id": "intrigue-gaming-set",
      "level": 3,
      "kind": "proficiency",
      "category": "tool",
      "count": 1,
      "choices": [
        "dice-set",
        "dragonchess-set",
        "playing-card-set",
        "three-dragon-ante-set"
      ]
    },
    {
      "schemaVersion": 1,
      "id": "intrigue-languages",
      "level": 3,
      "kind": "select",
      "label": "谋陷大师：选择两门语言",
      "count": 2,
      "options": [
        {
          "id": "dwarvish",
          "label": "矮人语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "dwarvish"
            }
          ]
        },
        {
          "id": "elvish",
          "label": "精灵语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "elvish"
            }
          ]
        },
        {
          "id": "giant",
          "label": "巨人语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "giant"
            }
          ]
        },
        {
          "id": "gnomish",
          "label": "侏儒语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "gnomish"
            }
          ]
        },
        {
          "id": "goblin",
          "label": "地精语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "goblin"
            }
          ]
        },
        {
          "id": "halfling",
          "label": "半身人语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "halfling"
            }
          ]
        },
        {
          "id": "orc",
          "label": "兽人语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "orc"
            }
          ]
        },
        {
          "id": "abyssal",
          "label": "深渊语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "abyssal"
            }
          ]
        },
        {
          "id": "celestial",
          "label": "天界语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "celestial"
            }
          ]
        },
        {
          "id": "draconic",
          "label": "龙语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "draconic"
            }
          ]
        },
        {
          "id": "deep-speech",
          "label": "深潜语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "deep-speech"
            }
          ]
        },
        {
          "id": "infernal",
          "label": "炼狱语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "infernal"
            }
          ]
        },
        {
          "id": "primordial",
          "label": "原初语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "primordial"
            }
          ]
        },
        {
          "id": "sylvan",
          "label": "木族语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "sylvan"
            }
          ]
        },
        {
          "id": "undercommon",
          "label": "地底通用语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "undercommon"
            }
          ]
        },
        {
          "id": "common",
          "label": "通用语",
          "grants": [
            {
              "kind": "tag",
              "key": "language",
              "value": "common"
            }
          ]
        }
      ],
      "customTag": {
        "key": "language",
        "label": "其他已存在的语言"
      }
    }
  ]
}
import{normalizeCharacter}from'../../store/characters'
import{applyDnd5eLevelAdvancement,buildDnd5eLevelAdvancementPlan}from'./levelAdvancement'
import{dnd5eStartingEquipmentPlan,defaultDnd5eStartingEquipmentSelection,resolveDnd5eStartingEquipment}from'./startingEquipment'
const mastermindSubclass='test.mm-native-archive:mastermind'
export function growNativeMastermind(target=3,id='mastermind'){const gearPlan=dnd5eStartingEquipmentPlan('游荡者','骗子'),gear=resolveDnd5eStartingEquipment(id,gearPlan,defaultDnd5eStartingEquipmentSelection(gearPlan));let character=normalizeCharacter({id,name:'策士',charClass:'游荡者',level:1,rulesetId:'dnd5e-2014-srd-5.1',abilities:{str:10,dex:16,con:12,int:14,wis:12,cha:14},skills:['stealth','acrobatics','perception','deception'],dnd5eClassLevels:{rogue:1},dnd5eClassChoices:{classes:{rogue:{selections:{expertise:['stealth','perception']}}}},equipment:gear.equipment,dnd5eInventory:gear.inventory,maxHp:9,currentHp:9});const steps=[];for(let level=2;level<=target;level++){const plan=buildDnd5eLevelAdvancementPlan(character,'rogue',1,mastermindSubclass)!;if(!plan)throw Error('Native Rogue advancement plan missing');const classChoiceSelections=Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,[...r.currentSelections,...r.options.map(o=>o.id).filter(id=>!r.currentSelections.includes(id)&&(r.key!=='expertise'||character.skills.includes(id)||id==='thieves-tools'))].slice(0,r.targetLimit)])),contentChoiceSelections=Object.fromEntries(plan.contentAdvancements.map(content=>[content.contentId,Object.fromEntries(content.requirements.map(r=>[r.id,r.options.slice(0,r.count).map(o=>o.id)]))])),asiAbility=character.abilities.dex<=18?'dex':'int';const next=applyDnd5eLevelAdvancement(character,{schemaVersion:1,classId:'rogue',subclassId:mastermindSubclass,levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:plan.asiLevels.map(classLevel=>({classLevel,choice:{kind:'ability-score' as const,increases:{[asiAbility]:2}}})),classChoiceSelections,contentChoiceSelections});if(!next.ok)throw Error(next.reason);steps.push({level,requirements:plan.contentAdvancements,character:next.character});character=next.character}return{character,steps}}
