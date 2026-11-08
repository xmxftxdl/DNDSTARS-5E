import{readActualPluginSpellPrimaryPrepareTime}from'./actualPluginSpellPrepareTime.page.fixture'
import{loadBountifulActivityOriginalSource,loadBountifulPluginSpellAbilityOriginalSource}from'../../composition/browserSharedRoomResources';
import{readBountifulActivityOriginalPlayerDiceOwner,hasIssuedBountifulActivityOriginalRequest,recordBountifulActivityOriginalHostRaw,recordBountifulActivityOriginalHostConfirmation}from'./bountifulActivityOriginalRaw'
import{resolvePreparedDnd5eSpellCast}from'../../rulesets/dnd5e/spellAction'
import{resolvePreparedDnd5eMonsterAttack}from'../../rulesets/dnd5e/monsterAttackAction'
import{readBountifulDamageZeroOriginalPlayerDiceOwner}from'../../rulesets/dnd5e/bountifulDamageZeroOriginalRaw'
import{resolvePreparedDnd5eEquipmentAttack}from'../../rulesets/dnd5e/equipmentAttackAction'
import{applyDnd5eActivityDeferredMapHandoffs}from'../../rulesets/dnd5e/activities/dnd5eActivityDeferredMapHandoffs'
import{normalizeSharedCampaignTime}from'../../lib/campaignTime'
import{useCampaignTimeStore}from'../../store/campaignTime'
import{readBrowserSceneWorldMinute}from'../../composition/browserSceneClock'
import{dnd5ePluginSpellDefinition}from'../../rulesets/dnd5e/plugins/pluginContentCatalog'
import{dnd5eActivityAutomationAnalysisV1}from'../../rulesets/dnd5e/plugins/pluginMechanicsRegistry'
import{prepareDnd5eRandomTargetPluginSpellCast}from'../../rulesets/dnd5e/randomPluginSpellTargets'
import{waitMastermindMagicTruthOwner}from'./mastermindMagicTruthRoom'
import{readDnd5eMagicTruthOriginal}from'../../rulesets/dnd5e/mastermindMagicTruthParent'
import type{Character}from'../../types/character'
import{beginMastermindMagicTruthOriginal,withMastermindMagicTruthRoomSpell,completeMastermindMagicTruthBase,type MastermindMagicTruthGateway}from'./mastermindMagicTruthRoom'
import{prepareMastermindMagicTruthPublication,publishMastermindMagicTruthAck}from'./mastermindMagicTruthPublication'
import{issueMastermindNativeThoughtContinuationDispatch,readMastermindNativeThoughtContinuationDispatch,restoreMastermindNativeThoughtContinuationDispatch}from'./mastermindNativeThoughtContinuationDispatch'
import{readMastermindThoughtNativeContinuationIssuedOriginal,readMastermindThoughtNativeContinuationCompleted}from'./mastermindThoughtContinuation'
import{prepareMastermindNativeThoughtContinuationPublication,publishMastermindNativeThoughtContinuation}from'./mastermindNativeThoughtContinuationPublication'
import{dnd5eExecutionEventKey}from'../../rulesets/dnd5e/activities/dnd5eActivityIdentity'
import{captureDnd5eMagicTruthPreparedParent,readDnd5eMagicTruthPreparedParent,withDnd5eMagicTruthSpellProduction,wrapDnd5eMagicTruthPreparedFactory}from'../../rulesets/dnd5e/mastermindMagicTruthParent'
import{registerDnd5eUnifiedContentPackageV1}from'../../rulesets/dnd5e/activities/dnd5eUnifiedContentRegistry'
import{validateDnd5eActivityDefinitionV1}from'../../rulesets/dnd5e/activities/dnd5eActivityValidation'
import{dnd5eActivityManualAdjudicationOperationsV1,compileDnd5eActivityHeadlessAction}from'../../rulesets/dnd5e/activities/dnd5eActivityHeadlessCompiler'
import{dnd5eEffectiveSpellcastingSources,dnd5ePatchEffectiveSpellSelections}from'../../rulesets/dnd5e'
import{readBountifulOpportunitySequencePlayerDiceOwner,readBountifulOpportunitySequenceLockedRaw}from'../../rulesets/dnd5e/bountifulOpportunitySequenceSource'
import{issueMastermindNativeThoughtDispatch,restoreMastermindNativeThoughtDispatch,listMastermindNativeThoughtDispatches,readMastermindNativeThoughtDispatch,isMastermindNativeThoughtDispatch}from'./mastermindNativeThoughtDispatch'
import{inspectMastermindThoughtContest}from'./mastermindThoughtContestPrefix'
import{prepareMastermindNativeThoughtPublication,publishMastermindNativeThought}from'./mastermindNativeThoughtPublication'
import{prepareMastermindThoughtNativeOriginal}from'./mastermindThoughtReadingParent'
import{settleDnd5eMountedBalanceCheckpoint}from'../../rulesets/dnd5e/mountedBalanceCheckpoint'
import{createDnd5eMapCombatSnapshot}from'../../application/combat/dnd5eCombatRules'
import willingPageSource from'../MapsWorkspacePage?raw'
import{getRegisteredDnd5eActivity}from'../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import{dnd5ePluginGrantedActivityDefinitionV1}from'../../rulesets/dnd5e/pluginApi'
import{dnd5eActivityChoicesFromPayload}from'./dnd5eActivityHandoffLogDetails'
import{readMastermindThoughtPlayerDiceOwner,lockMastermindThoughtRawBeforeConfirmation}from'./mastermindThoughtDiceTransport'
import{settleAuthoritativeDicePresentation}from'./dicePresentationGate'
import{resolveDnd5ePlayerEndTurn}from'../../rulesets/dnd5e/endTurnAction'
import{createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy}from'../../rulesets/dnd5e/turnEconomy'
import{dnd5eHeadlessTurnKey}from'../../rulesets/dnd5e/headlessCombatEngine'
import{isAssistedDmBoundaryChoice}from'../../lib/combatInterruptProtocol'
import{playerMapGrantedActivityControls}from'../../components/map/playerMapPersistentAreas'
import*as continuationRoomSession from'../../lib/roomSession'
import{collectMastermindThoughtContinuationPhysical}from'./mastermindThoughtContinuation'
import{captureSoulOfDeceitReading,resolveSoulOfDeceitReading,withSoulOfDeceitReadingPermission}from'../../rulesets/dnd5e/mastermindSoulOfDeceit'
import{prepareMastermindThoughtContinuationOriginal,resolveMastermindThoughtContinuation as resolveCore,withMastermindThoughtContinuationProduction,readMastermindThoughtContinuationNativeResolution,issueMastermindThoughtContinuationContest,readMastermindThoughtContinuationResolved,readMastermindThoughtContinuationDmContext,completeMastermindThoughtContinuationBase}from'./mastermindThoughtContinuation'
import{dnd5ePluginFeaturesAvailableForCharacter}from'../../rulesets/dnd5e/pluginApi'
import{durableD20RollId}from'../../lib/rollConfirmation'
import{assertDiceOwnership,isDiceCharacterOwnedByCurrentDm,isDiceCharacterControlledByRemotePlayer}from'./diceOwnership'
import{resolveCombatD20RollerSide,shouldHideCombatRollForExplicitRoller}from'./combatRollVisibility'
import{dnd5eCombatTokenSide}from'../../lib/opportunityAttacks'
import{automationCapabilityFromLegacyStatus}from"../../domain/automation/automationCapability"
import{afterEach,expect,it,vi}from"vitest"
import{registerDnd5eRulesPlugin}from"../../rulesets/dnd5e/pluginApi"
import{dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1,validateDnd5eUnifiedContentBundleV1}from"../../rulesets/dnd5e/unifiedContent"
import{normalizeCharacter}from"../../store/characters"
import{applyDnd5eLevelAdvancement,buildDnd5eLevelAdvancementPlan}from"../../rulesets/dnd5e/levelAdvancement"
import{defaultDnd5eStartingEquipmentSelection,dnd5eStartingEquipmentPlan,resolveDnd5eStartingEquipment}from"../../rulesets/dnd5e/startingEquipment"
import{buildDnd5eSpellAdvancementPlanFromSelections}from"../../rulesets/dnd5e/spellAdvancement"
import{syncCharacterClassResources}from"../../lib/classResources"
import{ensureDnd5eCoreSpellActivitiesRegisteredV1}from"../../rulesets/dnd5e/activities/dnd5eCoreSpellActivities"
import{prepareDnd5ePluginSpellCast,resolvePreparedDnd5ePluginSpellCast,type PreparedDnd5ePluginSpellCast}from"../../rulesets/dnd5e/pluginSpellTransaction"
import{type BattleMap}from"../../store/maps"
import{type SharedPlayerActionState}from"../../lib/sharedCombatTypes"
import fsp from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import{Readable}from"node:stream"
import{type IncomingMessage}from"node:http"
import{createHash,randomBytes}from"node:crypto"
import{SHARED_PROTOCOL_VERSION,handleSharedApi,projectEventPayloadForViewer}from"../../../scripts/shared-server-core.mjs"
import{answerMastermindThoughtReading,listMastermindThoughtPrompts,prepareMastermindThoughtReadingOriginal,type MastermindThoughtGateway}from"./mastermindThoughtReadingParent"
import ts from "typescript"
import vm from "node:vm"
import{completeMastermindThoughtBaseOriginal,issueMastermindThoughtContestRolls,prepareMastermindThoughtContestPrefix,resolveMastermindThoughtFalseOriginal,withMastermindThoughtProduction}from"./mastermindThoughtContestPrefix"
import{prepareMastermindThoughtPublication,publishMastermindThoughtAck,readMastermindThoughtResult}from"./mastermindThoughtPublication"
import{readDnd5eCompletedCombatBase,settleDnd5eConcentrationChecks}from"./settleDnd5eCombatResult"
import{coordinateResolvedSpellSettlement}from"../../application/combat/spells/SpellSettlementCoordinator"
import{resolveDnd5ePreparedWithMaterialDamageReactions,resolveDnd5eDamageBoundaryWithMaterials}from"../../rulesets/dnd5e/damageReactionFlow"
import{previewDnd5eMountedBalance}from"../../application/combat/dnd5eCombatRules"
import{secondChancePreparedAdapterId}from"./secondChancePreparedParent"
import{cloneDnd5eHostTransactionInput}from"../../rulesets/dnd5e/hostTransactionClone"
import{buildPlayerActionAck,buildPlayerActionProcessedState}from"../../lib/playerActionAck"
import actualMapsSource from'../MapsWorkspacePage.tsx?raw'
const mastermindSubclass='local.xge-mastermind:mastermind'
const originalNativeBundle:Dnd5eUnifiedContentBundleV1={
  "format": "dndstars5e-unified-content",
  "schemaVersion": 1,
  "manifest": {
    "id": "local.xge-mastermind",
    "name": "策士（原生机制开发稿）",
    "version": "1.0.0",
    "apiVersion": 2,
    "rulesetId": "dnd5e-2014-srd-5.1",
    "publisher": "Local source conversion",
    "license": "local-only",
    "distributionPolicy": "local-only",
    "contentCategory": "mixed"
  },
  "assets": [],
  "definitions": [
    {
      "schemaVersion": 1,
      "namespace": "local.xge-mastermind",
      "version": "1.0.0",
      "kind": "subclass",
      "id": "mastermind",
      "name": "策士",
      "automation": {
        "schemaVersion": 1,
        "level": "full",
        "supportedPhases": [
          "eligibility",
          "cost",
          "targeting",
          "attack-roll",
          "saving-throw",
          "damage",
          "healing",
          "effects",
          "duration",
          "interrupt",
          "persistence"
        ],
        "manualPhases": [],
        "limitations": []
      },
      "payload": {
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
    }
  ]
}
function mastermindBundle(){return structuredClone(originalNativeBundle)}
function install(outer:'full'|'manual'|'partial'='full'){const bundle=mastermindBundle();bundle.definitions[0].automation=automationCapabilityFromLegacyStatus(outer);expect(validateDnd5eUnifiedContentBundleV1(bundle)).toEqual([]);return registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))}
function growMastermind(target=3,id='mastermind',initialSkills=['stealth','acrobatics','perception','deception'],initialExpertise=['stealth','perception']){const gearPlan=dnd5eStartingEquipmentPlan('游荡者','骗子'),gear=resolveDnd5eStartingEquipment(id,gearPlan,defaultDnd5eStartingEquipmentSelection(gearPlan));let character=normalizeCharacter({id,name:'策士',charClass:'游荡者',level:1,rulesetId:'dnd5e-2014-srd-5.1',abilities:{str:10,dex:16,con:12,int:14,wis:12,cha:14},skills:initialSkills,dnd5eClassLevels:{rogue:1},dnd5eClassChoices:{classes:{rogue:{selections:{expertise:initialExpertise}}}},equipment:gear.equipment,dnd5eInventory:gear.inventory,maxHp:9,currentHp:9});const steps=[];for(let level=2;level<=target;level++){const plan=buildDnd5eLevelAdvancementPlan(character,'rogue',1,mastermindSubclass)!;expect(plan).toBeDefined();const classChoiceSelections=Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,[...r.currentSelections,...r.options.map(o=>o.id).filter(id=>!r.currentSelections.includes(id)&&(r.key!=='expertise'||character.skills.includes(id)||id==='thieves-tools'))].slice(0,r.targetLimit)])),contentChoiceSelections=Object.fromEntries(plan.contentAdvancements.map(content=>[content.contentId,Object.fromEntries(content.requirements.map(r=>[r.id,r.options.slice(0,r.count).map(o=>o.id)]))])),asiAbility=character.abilities.dex<=18?'dex':'int';const next=applyDnd5eLevelAdvancement(character,{schemaVersion:1,classId:'rogue',subclassId:mastermindSubclass,levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:plan.asiLevels.map(classLevel=>({classLevel,choice:{kind:'ability-score' as const,increases:{[asiAbility]:2}}})),classChoiceSelections,contentChoiceSelections});expect(next.ok,JSON.stringify(next)).toBe(true);if(!next.ok)throw Error(next.reason);steps.push({level,requirements:plan.contentAdvancements,character:next.character});character=next.character}return{character,steps}}

function growWizard(int=16,subclass='evocation',targetLevel=3){const gearPlan=dnd5eStartingEquipmentPlan('法师','贤者'),gear=resolveDnd5eStartingEquipment('mage',gearPlan,defaultDnd5eStartingEquipmentSelection(gearPlan));const first=buildDnd5eSpellAdvancementPlanFromSelections({classId:'wizard',fromClassLevel:0,toClassLevel:1,selections:{}})!;let cantrips=['fire-bolt',...first.cantripOptions.map(o=>o.id).filter(id=>id!=='fire-bolt')].slice(0,first.targetCantripCount),book=['mage-armor','magic-missile',...first.spellOptions.map(o=>o.id).filter(id=>!['mage-armor','magic-missile'].includes(id))].slice(0,first.targetWizardSpellbookCount!);let c=normalizeCharacter({id:'mage',name:'War Mage',charClass:'法师',level:1,rulesetId:'dnd5e-2014-srd-5.1',abilities:{str:10,dex:14,con:12,int,wis:10,cha:14},maxHp:7,currentHp:7,equipment:gear.equipment,dnd5eInventory:gear.inventory,dnd5eClassLevels:{wizard:1},dnd5eClassChoices:{classes:{wizard:{selections:{[first.cantripSelectionKey]:cantrips,'wizard-spellbook':book,'spell-prepared':book.slice(0,4)}}}}});for(let level=2;level<=targetLevel;level++){const p=buildDnd5eLevelAdvancementPlan(c,'wizard',1,subclass)!,s=p.spellAdvancement!;cantrips=[...cantrips,...s.cantripOptions.map(o=>o.id).filter(id=>!cantrips.includes(id))].slice(0,s.targetCantripCount);const preferred=['detect-thoughts','counterspell','dispel-magic','scorching-ray','blight',...s.spellOptions.map(o=>o.id)].filter((id,index,all)=>all.indexOf(id)===index&&s.spellOptions.some(o=>o.id===id)&&!book.includes(id));book=[...book,...preferred.slice(0,2)];const next=applyDnd5eLevelAdvancement(c,{schemaVersion:1,classId:'wizard',subclassId:subclass,levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:level===4?[{classLevel:4,choice:{kind:'ability-score',increases:{dex:2}}}]:[],spellSelections:{cantrips,wizardSpellbook:book}});expect(next.ok,JSON.stringify(next)).toBe(true);if(!next.ok)throw Error(next.reason);c=next.character}const final=syncCharacterClassResources(c);final.dnd5eClassChoices!.classes!.wizard!.selections!['spell-prepared']=book.slice().sort((a,b)=>(a==='detect-thoughts'?-1:b==='detect-thoughts'?1:0)).slice(0,Math.max(1,Math.floor((int-10)/2)+targetLevel));return final}

function readingFixture(level=17,parentId='actual-detect-thoughts-parent'){ensureDnd5eCoreSpellActivitiesRegisteredV1();const reader=growWizard(),owner=growMastermind(level,'owner').character;const map:BattleMap={id:'real-read-map',name:'Read map',showGrid:true,width:400,height:400,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,tokens:[{id:'reader-token',type:'player',characterId:reader.id,label:'法师',x:25,y:25,size:1,color:'',emoji:''},{id:'owner-token',type:'enemy',characterId:owner.id,label:'策士',x:75,y:25,size:1,color:'',emoji:''}]},action:SharedPlayerActionState={id:parentId,mapId:map.id,type:'dnd5e-spell-cast',status:'pending',sourceMode:'player',characterId:reader.id,actorTokenId:'reader-token',targetTokenId:'owner-token',dnd5eSpellCast:{spellId:'detect-thoughts',castingClassId:'wizard',slotLevel:2,targetTokenId:'owner-token'},round:1,initiativeIndex:0,seq:1,updatedAt:1};const ready=prepareDnd5ePluginSpellCast({action,map,characters:[reader,owner],initiativeOrder:map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i}))});expect(ready.ok,ready.ok?'':ready.reason).toBe(true);if(!ready.ok)throw Error(ready.reason);return{ready:ready.prepared,action,reader,owner,cast:()=>resolvePreparedDnd5ePluginSpellCast({prepared:ready.prepared,rolls:{activityRolls:{},activityInterruptChoiceId:'dm-apply'}})}}

const base=path.resolve(os.tmpdir(),'stars-mastermind-native-publication-permanent-api'),roots:string[]=[]
afterEach(async()=>{for(const root of roots.splice(0)){if(path.dirname(path.resolve(root))!==base||!path.basename(root).startsWith('room-'))throw Error('API fixture cleanup outside its own root');await fsp.rm(root,{recursive:true,force:true,maxRetries:4,retryDelay:20})}})
async function createNativeEnvelopeApi(docs:Record<string,any>){
 await fsp.mkdir(base,{recursive:true});const root=await fsp.mkdtemp(path.join(base,'room-')),stateRoot=path.join(root,'rooms','room'),lobbyRoot=path.join(root,'lobby');roots.push(root);await fsp.mkdir(stateRoot,{recursive:true});await fsp.mkdir(lobbyRoot,{recursive:true})
 const tokens={dm:randomBytes(32).toString('base64url'),player:randomBytes(32).toString('base64url'),reader:randomBytes(32).toString('base64url')},hash=(s:string)=>createHash('sha256').update(s).digest('hex')
 await fsp.writeFile(path.join(lobbyRoot,'room.json'),JSON.stringify({id:'room',host:{memberId:'dm',roomTokenHash:hash(tokens.dm)},players:[{memberId:'player',role:'player',roomTokenHash:hash(tokens.player)},{memberId:'reader',role:'player',roomTokenHash:hash(tokens.reader)}]}))
 const ctx:any={stateRoot:root,lobbyRoot,imageRoot:root,legacyStateRoot:root,legacyImageRoot:root,quarantineRoot:root,snapshotRoot:root,eventClients:new Map(),eventBacklog:new Map(),eventSequences:new Map(),rateLimits:new Map()}
 for(const[name,value]of Object.entries(docs)){docs[name]={...value,_sync:{schemaVersion:1,revision:value._sync?.revision??1,writerId:'fixture-dm',writtenAt:1}};await fsp.writeFile(path.join(stateRoot,name+'.json'),JSON.stringify(docs[name]))}
 const read=async(name:string)=>{try{return JSON.parse(await fsp.readFile(path.join(stateRoot,name+'.json'),'utf8'))}catch{return null}}
 async function post(endpoint:string,body:unknown,member:'dm'|'player'|'reader'='dm',method:'POST'|'PUT'|'PATCH'|'DELETE'|'GET'='POST'){
  const req=Readable.from([Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;Object.assign(req,{method,headers:{'x-stars-member':member,'x-stars-room-token':tokens[member],'x-stars-protocol':String(SHARED_PROTOCOL_VERSION),'x-stars-writer':'actual-sc-native-envelope-'+member,...(method==='PUT'?{'x-stars-expected-revision':String((body as any)?._sync?.revision??0)}:{})},socket:{remoteAddress:'fixture-local'}})
  const response:any={status:0,body:'',headers:{},setHeader(name:string,value:unknown){this.headers[name]=value},getHeader(name:string){return this.headers[name]},writeHead(status:number,headers:any){this.status=status;Object.assign(this.headers,headers??{})},end(body:unknown){this.body=String(body??'')}}
  expect(await handleSharedApi(req,response,new URL('http://localhost/api/state/'+endpoint+(endpoint.includes('?')?'&':'?')+'room=room'),ctx)).toBe(true)
  return{status:response.status,payload:JSON.parse(response.body)}
 }
 const gateway={loadResource:async<T>(name:string)=>await read(name)as T,saveResourcesAtomically:vi.fn(async(writes:any[],options:any)=>{
  const response=await post('transaction',{writes,transactionId:options.transactionId,readRevisions:options.readRevisions??{}})
  if(response.status!==200||!response.payload.ok)throw Error('actual-api-transaction:'+response.status+':'+JSON.stringify(response.payload))
  for(const write of writes)docs[write.name]=await read(write.name)
  return{status:'committed' as const,transactionId:options.transactionId,revisions:response.payload.revisions??{}}
 })}
 return{read,post,gateway,async persistEquipment(owner:unknown){const characters=await read('characters');await gateway.saveResourcesAtomically([{name:'characters',expectedRevision:characters._sync.revision,data:{...characters,characters:[owner]}}],{transactionId:'real-equip',readRevisions:{}})}}
}

async function setup(insightExpert=false,parentId='actual-detect-thoughts-parent'){const f=readingFixture(17,parentId);if(insightExpert){for(let level=1;level<=2;level++){const plan=buildDnd5eLevelAdvancementPlan(f.reader,'rogue',1)!;const selections=Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,[...r.currentSelections,...['insight','thievesTools',...r.options.map(o=>o.id)].filter((id,index,all)=>all.indexOf(id)===index&&r.options.some(o=>o.id===id)&&!r.currentSelections.includes(id))].slice(0,r.targetLimit)]));const next=applyDnd5eLevelAdvancement(f.reader,{schemaVersion:1,classId:'rogue',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:[],classChoiceSelections:selections});expect(next.ok,JSON.stringify({result:next,requirements:plan.choiceRequirements})).toBe(true);if(!next.ok)throw Error(next.reason);f.reader=next.character}}const owner={...f.owner,roomId:'room',roomMemberId:'player'},reader={...f.reader,roomId:'room',roomMemberId:'reader'},action={...f.action,combatId:'reading-combat'},order=f.ready.map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i})),api=await createNativeEnvelopeApi({characters:{characters:[reader,owner]},maps:{maps:[f.ready.map]},combat:{active:true,mapId:f.ready.map.id,combatId:'reading-combat',round:1,initiativeIndex:0,initiativeOrder:order}});const response=await api.post('player-action-requests/append',{action},'reader');expect(response.status,JSON.stringify(response.payload)).toBe(200);const g=(member:'dm'|'player'|'reader'):MastermindThoughtGateway=>({session:()=>({roomId:'room',memberId:member,role:member==='dm'?'dm':'player'}),loadResource:api.read,request:async(operation,input)=>{const r=await api.post('mastermind-thought-reading/'+operation,input,member);if(r.status!==200)throw Error('real-http:'+r.status+':'+r.payload.error);return r.payload}});return{...f,action,api,host:g('dm'),ownerGateway:g('player'),readerGateway:g('reader')}}

const source=actualMapsSource,file=ts.createSourceFile('actual-r42-page.tsx',source,99,true,4)
function initializer(name:string){let body:string|undefined;function visit(node:ts.Node){if(ts.isVariableDeclaration(node)&&node.name.getText(file)===name&&node.initializer)body=node.initializer.getText(file);ts.forEachChild(node,visit)}visit(file);if(!body)throw Error('actual R42 production initializer missing '+name);return body}
function actualUninitializedLocal(name:string){let declaration:string|undefined;function visit(node:ts.Node){if(ts.isVariableDeclaration(node)&&node.name.getText(file)===name){if(node.initializer||!ts.isVariableDeclarationList(node.parent)||!ts.isVariableStatement(node.parent.parent))throw Error('Actual original local must be uninitialized');declaration=node.parent.parent.getText(file)}ts.forEachChild(node,visit)}visit(file);if(!declaration)throw Error('Actual Page original local missing '+name);return declaration}
function actual<T>(name:string,bindings:Record<string,unknown>):T{const js=ts.transpileModule(name==='resolveFeatureWithInterruptions'?'(()=>{'+actualUninitializedLocal('activityHoldEntry')+';return ('+initializer(name)+')})()':(initializer(name).startsWith('await ')||['mastermindThoughtPublication','mastermindMagicTruthPublication','magicTruthOriginal','resolvedPluginSpell'].includes(name))?'(async()=>('+initializer(name)+'))()':'('+initializer(name)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return vm.runInNewContext(js,{resolvePreparedDnd5eSpellCast,resolvePreparedDnd5eMonsterAttack,pluginTempestuousResolved:undefined,pluginTempestuousRoom:undefined,...bindings,console,crypto,Promise})as T}
const no=async()=>{throw Error('Detect Thoughts must not invent a damage/CON/reaction roll')}
it.each(['deny','allow-real-thoughts','present-false-thoughts']as const)('current Page native facade → actual Base → original ACK commits private reading exactly once (%s)',async choice=>{
 const dispose=install();try{
  const f=await setup(true),original=await prepareMastermindThoughtReadingOriginal(f.action.id,f.host),prompt=(await listMastermindThoughtPrompts(f.ownerGateway))[0]
  await answerMastermindThoughtReading(prompt.id,choice,choice==='present-false-thoughts'?'一片海岸。':undefined,f.ownerGateway)
  if(choice==='present-false-thoughts')for(const request of await issueMastermindThoughtContestRolls(original!,f.host)){expect((await f.api.post('mastermind-thought-reading/raw',{id:prompt.id,role:request.role,requestId:request.requestId,values:[request.role==='owner'?18:1]},request.role==='owner'?'player':'reader')).status).toBe(200);expect((await f.api.post('mastermind-thought-reading/confirm',{id:prompt.id,role:request.role,requestId:request.requestId,values:[request.role==='owner'?20:1]},'dm')).status).toBe(200)}
  const prefix=choice==='present-false-thoughts'?await prepareMastermindThoughtContestPrefix(original!,f.host):undefined,before=await f.api.read('characters')
  await withMastermindThoughtProduction(original!,prefix,f.host,async(pluginCast,thoughtNativeResolver)=>{
   expect(()=>thoughtNativeResolver({prepared:JSON.parse(JSON.stringify(pluginCast)),rolls:{activityRolls:{}}})).toThrow('same-issued-prepared')
   expect(()=>thoughtNativeResolver({prepared:cloneDnd5eHostTransactionInput(pluginCast),rolls:{activityRolls:{},activityInterruptChoiceId:'dm-apply'}})).not.toThrow()
   const stores={maps:[pluginCast.map],characters:pluginCast.characters},base={pluginCast,thoughtNativeResolver,currentLongCastingCombatState:undefined,useMapStore:{getState:()=>({maps:stores.maps})},useCharacterStore:{getState:()=>({characters:stores.characters})},preparedPluginSpellRolls:{activityRolls:{},activityInterruptChoiceId:'dm-apply'},sourceSlotSpellHealingTargets:undefined,activityInterruptChoiceId:'dm-apply',runtimeNow:()=>Date.now()}
   const facade=actual<(r:typeof thoughtNativeResolver,i:Parameters<typeof thoughtNativeResolver>[0],m:typeof pluginCast.map)=>Promise<ReturnType<typeof thoughtNativeResolver>>>('resolveDnd5eFacadeWithAirborneFalls',{getRoomSession:()=>({role:'dm'}),activeInterruptTransactionIdRef:{current:f.action.id},secondChancePreparedAdapterId,resolvePreparedDnd5eEquipmentAttack,resolveDnd5ePreparedWithMaterialDamageReactions,damageReactionOptionsForMap:()=>({authorityUnchanged:()=>true,charactersByCombatantId:Object.fromEntries(Object.entries(pluginCast.characterIdByCombatantId).map(([id,cid])=>[id,pluginCast.characters.find(c=>c.id===cid)]))}),previewDnd5eMountedBalance,rollDiceBoxD20:no,rollDiceBoxValues:no})
   const resolvedPluginSpell=await actual<Promise<ReturnType<typeof thoughtNativeResolver>>>('resolvedPluginSpell',{...base,magicTruthOriginal:undefined,nativeMagicTruthOriginal:undefined,resolveDnd5eFacadeWithAirborneFalls:facade})
   expect(resolvedPluginSpell.result.ok).toBe(true)
   const noPorts=Object.fromEntries(['requestOptionalDamageSave','rollDnd5eUnsupportedAirborneFalls','settleDnd5eMapMountedBalance','rollDiceBoxD20','rollDiceBoxValues','requestSharedHellishRebukeChoice','collectSharedSpellDamageDieChoices','requestDnd5eSavingThrowRerollDice','requestDnd5eBardicInspirationRoll','requestDnd5eOptionalBonusDieUse','requestDnd5eDarkOnesOwnLuckRoll','requestSharedPostSpellRandomTableChoice','requestSharedPostSpellRandomTableAdjudication'].map(k=>[k,no]))
   const pluginSettlement=await actual<Promise<{ok:false;reason:string}|{ok:true;settled:Awaited<ReturnType<typeof settleDnd5eConcentrationChecks>>}>>('pluginSettlement',{...base,...noPorts,resolvedPluginSpell,coordinateResolvedSpellSettlement,settleDnd5eConcentrationChecks,castingProximityReadyToCommit:()=>true})
   if(!pluginSettlement.ok)throw Error(pluginSettlement.reason)
   const mastermindThoughtPublication=await actual<Promise<Awaited<ReturnType<typeof prepareMastermindThoughtPublication>>>>('mastermindThoughtPublication',{thoughtOriginal:original,activityAdjudicationNote:'正在想一条回家的路线。',resolvedPluginSpell,settledPluginSpell:pluginSettlement.settled,thoughtGateway:f.host,prepareMastermindThoughtPublication,completeMastermindThoughtBaseOriginal})
   const queue=await f.api.read('player-action-requests'),action=queue.requests.find((row:{id:string})=>row.id===f.action.id),combat=await f.api.read('combat'),processedPrior=await f.api.read('player-action-processed'),ack=buildPlayerActionAck({action,status:'accepted',mapId:f.action.mapId,round:combat.round,initiativeIndex:combat.initiativeIndex,appliedAt:3}),processed=buildPlayerActionProcessedState({action,current:processedPrior,updatedAt:3}),snapshots={characters:pluginSettlement.settled.application.characters,maps:[pluginSettlement.settled.application.map],combat,updatedAt:3},transactionSideEffects={mastermindThoughtPublication},commits=vi.fn(f.api.gateway.saveResourcesAtomically)
   const publishOriginal=actual<(action:typeof f.action,input:Parameters<typeof publishMastermindThoughtAck>[2])=>Promise<void>>('publishOriginal',{loadBountifulActivityOriginalSource,loadBountifulPluginSpellAbilityOriginalSource,transactionSideEffects,publishMastermindThoughtAck})
   const ackBindings={provisionalMovePublicationsRef:{current:new Map()},publishOriginal,action,nativeHostWeapon:false,transactionSideEffects,ack,snapshots,processed,saveSharedResourceWithResult:async()=>{throw Error('no standalone writes')},saveSharedResourcesAtomically:commits,loadSharedResource:f.api.read,publishSharedEvent:async()=>{}}
   await actual<Promise<void>>('commit',ackBindings)
   expect(commits).toHaveBeenCalledTimes(1);expect(commits.mock.calls[0][0]).toHaveLength(6)
   const after=await f.api.read('characters'),reader=after.characters.find((c:{id:string})=>c.id===f.reader.id)
   expect(reader.classResources['dnd5e-spell-slot-2'].current).toBe(before.characters.find((c:{id:string})=>c.id===f.reader.id).classResources['dnd5e-spell-slot-2'].current-1)
   expect((await f.api.read('mastermind-thought-readings')).parents[prompt.id].phase).toBe('published');const ownResults=await f.api.post('mastermind-thought-reading/read-results',{},'reader');expect(ownResults.status).toBe(200);expect(ownResults.payload.results).toHaveLength(1);expect(ownResults.payload.results[0].kind).toBe(choice==='deny'?'unavailable':'thoughts');expect(ownResults.payload.results[0].thoughts).toBe(choice==='present-false-thoughts'?'一片海岸。':choice==='allow-real-thoughts'?'正在想一条回家的路线。':undefined);for(const resource of['combat','maps','player-action-ack']){const published=JSON.stringify(await f.api.read(resource));expect(published).not.toContain('一片海岸。');expect(published).not.toContain('正在想一条回家的路线。')};expect(JSON.stringify(ownResults.payload)).not.toContain('false-thoughts');expect(JSON.stringify(ownResults.payload)).not.toContain('sourceDefinition');for(const member of['player','dm']as const){const other=await f.api.post('mastermind-thought-reading/read-results',{},member);expect(other.status).toBe(200);expect(other.payload.results).toEqual([])}
   await actual<Promise<void>>('commit',ackBindings);expect(commits).toHaveBeenCalledTimes(1)
  })
 }finally{dispose()}
})

it('only this native original actual Base completion advances the private result witness; JSON, another actual invocation and source loss cannot',async()=>{
 const dispose=install();try{
  const f=await setup(true),original=await prepareMastermindThoughtReadingOriginal(f.action.id,f.host),prompt=(await listMastermindThoughtPrompts(f.ownerGateway))[0]
  await answerMastermindThoughtReading(prompt.id,'present-false-thoughts','一片海岸。',f.ownerGateway)
  for(const request of await issueMastermindThoughtContestRolls(original!,f.host)){const role=request.role,member=role==='owner'?'player':'reader';expect((await f.api.post('mastermind-thought-reading/raw',{id:prompt.id,role,requestId:request.requestId,values:[role==='owner'?18:1]},member)).status).toBe(200);expect((await f.api.post('mastermind-thought-reading/confirm',{id:prompt.id,role,requestId:request.requestId,values:[role==='owner'?20:1]},'dm')).status).toBe(200)}
  const prefix=await prepareMastermindThoughtContestPrefix(original!,f.host),native=await resolveMastermindThoughtFalseOriginal(original!,prefix!,{activityRolls:{},activityInterruptChoiceId:'dm-apply'},f.host)
  if(!native.native.result.ok||!native.native.application)throw Error('actual native failed')
  const options={result:native.native.result,map:native.native.application.map,characters:native.native.application.characters,priorApplication:native.native.application,characterIdByCombatantId:f.ready.characterIdByCombatantId,rollD20:async()=>{throw Error('Detect Thoughts must not invent CON')},rollD4:async()=>{throw Error('unexpected d4')},rollDice:async()=>{throw Error('unexpected dice')}}
  const completed=await settleDnd5eConcentrationChecks(options)
  expect(readDnd5eCompletedCombatBase(native.native.result,completed)).toBe(completed)
  await expect(completeMastermindThoughtBaseOriginal(native,JSON.parse(JSON.stringify(completed)),f.host)).rejects.toThrow('actual-unchanged-completion')
  const otherInput=structuredClone(native.native.result),otherCompleted=await settleDnd5eConcentrationChecks({...options,result:otherInput})
  await expect(completeMastermindThoughtBaseOriginal(native,otherCompleted,f.host)).rejects.toThrow('actual-unchanged-completion')
  const final=await completeMastermindThoughtBaseOriginal(native,completed,f.host)
  await expect(prepareMastermindThoughtPublication(final,f.host)).resolves.toBeDefined()
  expect(await f.api.read('player-action-ack')).toBeNull()
  const saved=await f.api.read('characters');expect(saved.characters.find((c:{id:string})=>c.id===f.reader.id).classResources['dnd5e-spell-slot-2'].current).toBe(f.reader.classResources!['dnd5e-spell-slot-2'].current)
  dispose()
  await expect(completeMastermindThoughtBaseOriginal(native,completed,f.host)).rejects.toThrow('source-changed')
 }finally{dispose()}
})

it.each(['owner-wins','owner-loses','lost-reply','clock-stale','queue-stale','omit-journal','raw-tamper','wrong-parent','forged-ack']as const)('true opposed checks and native Detect Thoughts settle with one original ACK/private result atomic publication (%s)',async mode=>{
 const dispose=install();try{
 const f=await setup(true),original=await prepareMastermindThoughtReadingOriginal(f.action.id,f.host),prompt=(await listMastermindThoughtPrompts(f.ownerGateway))[0];await answerMastermindThoughtReading(prompt.id,'present-false-thoughts','我正在想一片海岸。',f.ownerGateway);
 for(const request of await issueMastermindThoughtContestRolls(original!,f.host)){const role=request.role,member=role==='owner'?'player':'reader',raw=role==='owner'?18:mode==='owner-loses'?20:1,confirmed=role==='owner'?mode==='owner-loses'?2:20:raw;expect((await f.api.post('mastermind-thought-reading/raw',{id:prompt.id,role,requestId:request.requestId,values:[raw]},member)).status).toBe(200);expect((await f.api.post('mastermind-thought-reading/confirm',{id:prompt.id,role,requestId:request.requestId,values:[confirmed]},'dm')).status).toBe(200)}
 const prefix=await prepareMastermindThoughtContestPrefix(original!,f.host),resolved=await resolveMastermindThoughtFalseOriginal(original!,prefix!,{activityRolls:{},activityInterruptChoiceId:'dm-apply'},f.host);expect(resolved.native.result.ok).toBe(true);expect(resolved.native.application).toBeDefined();const plan=await prepareMastermindThoughtPublication(resolved,f.host);await expect(prepareMastermindThoughtPublication(JSON.parse(JSON.stringify(resolved)),f.host)).rejects.toThrow('actual-native-result');
 expect((await f.api.post('mastermind-thought-reading/read-result',{id:prompt.id},'reader')).status).toBe(404);const before=await f.api.read('characters'),combat=await f.api.read('combat'),queue=await f.api.read('player-action-requests'),action=queue.requests.find((a:{id:string})=>a.id===f.action.id),ack=buildPlayerActionAck({action,status:'accepted',mapId:action.mapId,round:combat.round,initiativeIndex:combat.initiativeIndex,appliedAt:3}),processedPrior=await f.api.read('player-action-processed'),processed=buildPlayerActionProcessedState({action,current:processedPrior,updatedAt:3}),ackPrior=await f.api.read('player-action-ack'),metadata:Record<string,number>={'player-action-processed':processedPrior?._sync?.revision??0,'player-action-ack':ackPrior?._sync?.revision??0},commits=vi.fn(),announcements=vi.fn(async()=>{});let rejectedWorld=before;
 const input={ack,processed,snapshots:{characters:resolved.native.application!.characters,maps:[resolved.native.application!.map],combat,updatedAt:3},loadSharedResource:f.api.read,saveSharedResource:async()=>{throw Error('unexpected standalone fallback')},publishAck:announcements,commitSharedResources:async(writes:readonly{ name:string;data:unknown;expectedRevision?:number }[],options:any)=>{
  expect(await f.api.read('characters')).toEqual(before);expect(writes).toHaveLength(6);expect(writes.map(w=>w.name).sort()).toEqual(['characters','combat','maps','mastermind-thought-readings','player-action-ack','player-action-processed']);expect(options.readRevisions).toMatchObject({'campaign-time':0,'map-geometry':0,'player-action-requests':queue._sync.revision});let outgoing=writes.map(w=>({...w,expectedRevision:w.expectedRevision??metadata[w.name],data:structuredClone(w.data)}));
  if(mode==='omit-journal')outgoing=outgoing.filter(w=>w.name!=='mastermind-thought-readings');if(mode==='raw-tamper'){const journal=outgoing.find(w=>w.name==='mastermind-thought-readings')!.data as any;journal.parents[prompt.id].rollRequests.owner.raw.values=[1]}if(mode==='wrong-parent'){const journal=outgoing.find(w=>w.name==='mastermind-thought-readings')!.data as any;journal.parents[prompt.id].parentTransactionId+=':other'}
  if(mode==='forged-ack')expect((await f.api.post('player-action-ack',ack,'dm','PUT')).status).toBe(200);if(mode==='clock-stale')expect((await f.api.post('campaign-time/mutation',{operation:'advance-seconds',seconds:6},'dm','PATCH')).status).toBe(200);if(mode==='queue-stale')expect((await f.api.post('player-action-requests/append',{action:{...f.action,id:f.action.id+':other'}},'reader')).status).toBe(200);rejectedWorld=await f.api.read('characters');commits(outgoing,options);const result=await f.api.gateway.saveResourcesAtomically(outgoing,options);if(mode==='lost-reply')throw TypeError('Failed to fetch');return result
 }};
 if(['clock-stale','queue-stale','omit-journal','raw-tamper','wrong-parent','forged-ack'].includes(mode)){await expect(publishMastermindThoughtAck(action,plan,input)).rejects.toThrow(mode==='forged-ack'?'committed-private-result-required':'409');expect(await f.api.read('characters')).toEqual(rejectedWorld);if(mode!=='forged-ack')expect(await f.api.read('player-action-ack')).toBeNull();else expect((await f.api.post('mastermind-thought-reading/read-result',{id:prompt.id},'reader')).status).toBe(404);expect((await f.api.read('mastermind-thought-readings')).parents[prompt.id].phase).toBe('answered');expect(announcements).not.toHaveBeenCalled();return}
 await publishMastermindThoughtAck(action,plan,input);const saved=await f.api.read('characters'),row=(await f.api.read('mastermind-thought-readings')).parents[prompt.id];expect(row.phase).toBe('published');expect(row.rollRequests.owner.raw.values).toEqual([18]);expect(row.rollRequests.owner.confirmed.values).toEqual([mode==='owner-loses'?2:20]);expect(commits).toHaveBeenCalledTimes(1);expect((await f.api.read('combat')).dnd5eTurnEconomyByToken['reader-token'].action.current).toBe(0);expect(saved.characters.find((c:{id:string})=>c.id===f.reader.id).classResources['dnd5e-spell-slot-2'].current).toBe(before.characters.find((c:{id:string})=>c.id===f.reader.id).classResources['dnd5e-spell-slot-2'].current-1);const result=await readMastermindThoughtResult(prompt.id,f.readerGateway);expect(result.result.kind).toBe(mode==='owner-loses'?'unavailable':'thoughts');expect(JSON.stringify(result)).not.toContain('false-thoughts');expect(JSON.stringify(result)).not.toContain('sourceDefinition');expect(result.result.thoughts).toBe(mode==='owner-loses'?undefined:'我正在想一片海岸。');expect(JSON.stringify(await f.api.read('combat'))).not.toContain('我正在想一片海岸。');expect(JSON.stringify(await f.api.read('player-action-ack'))).not.toContain('我正在想一片海岸。');for(const member of['player','dm']as const)expect((await f.api.post('mastermind-thought-reading/read-result',{id:prompt.id},member)).status).toBe(403);await publishMastermindThoughtAck(action,plan,input);expect(commits).toHaveBeenCalledTimes(1);expect(await f.api.read('characters')).toEqual(saved);const publicQueue=await f.api.post('player-action-requests',{},'reader','GET');expect(JSON.stringify(publicQueue.payload)).not.toContain(action.id)
 }finally{dispose()}
})

it.each(['allow','false','still-paused','foreign-interrupt','cancelled','round','economy','roster','effective-rules','clock','geometry','queue','source','stale-after-plan']as const)('approved actual original DM pause/resume preserves exact source and atomic publication (%s)',async mode=>{
 const dispose=install();try{
 const f=await setup(true,'real-adjudication-'+mode),original=await prepareMastermindThoughtReadingOriginal(f.action.id,f.host),prompt=(await listMastermindThoughtPrompts(f.ownerGateway))[0],journalBefore=await f.api.read('mastermind-thought-readings'),issuedCombat=await f.api.read('combat'),before=await f.api.read('characters');
 await answerMastermindThoughtReading(prompt.id,mode==='false'?'present-false-thoughts':'allow-real-thoughts',mode==='false'?'私有虚假思想。':undefined,f.ownerGateway);
 if(mode==='false')for(const request of await issueMastermindThoughtContestRolls(original!,f.host)){expect((await f.api.post('mastermind-thought-reading/raw',{id:prompt.id,role:request.role,requestId:request.requestId,values:[request.role==='owner'?18:1]},request.role==='owner'?'player':'reader')).status).toBe(200);expect((await f.api.post('mastermind-thought-reading/confirm',{id:prompt.id,role:request.role,requestId:request.requestId,values:[request.role==='owner'?20:1]},'dm')).status).toBe(200)}
 const prefix=mode==='false'?await prepareMastermindThoughtContestPrefix(original!,f.host):undefined;
 await withMastermindThoughtProduction(original!,prefix,f.host,async(prepared,resolver)=>{
 const native=resolver({prepared:cloneDnd5eHostTransactionInput(prepared),rolls:{activityRolls:{},activityInterruptChoiceId:'dm-apply'}});expect(native.result.ok).toBe(true);if(!native.result.ok||!native.application)throw Error('native application required');
 const id='dm-adjudication:'+f.action.id+(mode==='foreign-interrupt'?':foreign':'')+':activity',interrupt={id,mapId:f.action.mapId,transactionId:mode==='foreign-interrupt'?f.action.id+':foreign':f.action.id,kind:'dm-adjudication',status:'pending',phase:'before-action',timeoutPolicy:'wait-for-dm',actorCharId:f.reader.id,targetCharId:f.owner.id,createdAt:1,updatedAt:1,payload:{contextKind:'activity-boundary',actionId:f.action.id,casterTokenId:'reader-token',spellId:'detect-thoughts'}};
 const writeCombat=async(patch:Record<string,unknown>)=>{const current=await f.api.read('combat');const response=await f.api.post('combat',{...current,...patch,updatedAt:Date.now()},'dm','PUT');expect(response.status,JSON.stringify(response.payload)).toBe(200)};
 await writeCombat({flowPause:{schemaVersion:1,reason:'dm-adjudication',phase:'adjudicating',pausedAt:1,interruptId:id}});
 expect((await f.api.post('combat-interrupts/interrupt',{operation:'upsert',mapId:f.action.mapId,interrupt},'dm','PATCH')).status).toBe(200);
 expect((await f.api.post('combat-interrupts/interrupt',{operation:'answer',mapId:f.action.mapId,id,response:{decision:mode==='cancelled'?'cancelled':'approved',effects:[],note:'只向原读心者公开。'}},'dm','PATCH')).status).toBe(200);
 expect((await f.api.post('combat-interrupts/interrupt',{operation:'finish',mapId:f.action.mapId,id},'dm','PATCH')).status).toBe(200);
 await writeCombat({flowPause:{schemaVersion:1,reason:'dm-adjudication',phase:'awaiting-resume',pausedAt:1,resolvedAt:2,interruptId:id}});
 if(mode!=='still-paused')await writeCombat({flowPause:undefined});
 if(mode==='round')await writeCombat({round:2});if(mode==='economy')await writeCombat({dnd5eTurnEconomyByToken:{'reader-token':{action:{current:0,max:1}}}});
 if(mode==='roster')await writeCombat({initiativeOrder:[...(await f.api.read('combat')).initiativeOrder].reverse()});if(mode==='effective-rules'){const{createDnd5eEffectiveRulesContextV1}=await import('../../rulesets/dnd5e/effectiveRulesContext');await writeCombat({effectiveRules:createDnd5eEffectiveRulesContextV1({hash:'changed-rules'})})}
 if(mode==='clock')expect((await f.api.post('campaign-time/mutation',{operation:'advance-seconds',seconds:6},'dm','PATCH')).status).toBe(200);
 if(mode==='geometry')expect((await f.api.post('map-geometry',{schemaVersion:3,maps:[],updatedAt:1},'dm','PUT')).status).toBe(200);
 if(mode==='source')dispose();
 const rejectedWorld=await f.api.read('characters'),completed=await settleDnd5eConcentrationChecks({result:native.result,map:native.application.map,characters:native.application.characters,priorApplication:native.application,characterIdByCombatantId:prepared.characterIdByCombatantId,rollD20:no,rollD4:no,rollDice:no});
 if(!['allow','false','queue','stale-after-plan'].includes(mode)){await expect(completeMastermindThoughtBaseOriginal(native,completed,f.host)).rejects.toThrow();expect(await f.api.read('characters')).toEqual(rejectedWorld);expect(await f.api.read('player-action-ack')).toBeNull();return}
 const resolution=await completeMastermindThoughtBaseOriginal(native,completed,f.host),plan=await prepareMastermindThoughtPublication(resolution,f.host,'私有真实思想。'),combat=await f.api.read('combat'),action=(await f.api.read('player-action-requests')).requests.find((a:any)=>a.id===f.action.id),ack=buildPlayerActionAck({action,status:'accepted',mapId:action.mapId,round:combat.round,initiativeIndex:combat.initiativeIndex,appliedAt:3}),processed=buildPlayerActionProcessedState({action,current:await f.api.read('player-action-processed'),updatedAt:3});
 if(mode==='stale-after-plan')await writeCombat({round:2});
 if(mode==='queue')expect((await f.api.post('player-action-requests/append',{action:{...f.action,id:f.action.id+':other'}},'reader')).status).toBe(200);
 const commits=vi.fn(async(writes:readonly{name:string;data:unknown;expectedRevision?:number}[],options:any)=>f.api.gateway.saveResourcesAtomically([...writes],options)),input={ack,processed,snapshots:{characters:completed.application.characters,maps:[completed.application.map],combat,updatedAt:3},loadSharedResource:f.api.read,saveSharedResource:async()=>{throw Error('standalone forbidden')},publishAck:async()=>{},commitSharedResources:commits};
 if(mode==='stale-after-plan'){await expect(publishMastermindThoughtAck(action,plan,input)).rejects.toThrow();expect(commits).not.toHaveBeenCalled();expect(await f.api.read('characters')).toEqual(before);return}
 if(mode==='queue'){await expect(publishMastermindThoughtAck(action,plan,input)).rejects.toThrow('409');expect(await f.api.read('characters')).toEqual(before);expect(await f.api.read('player-action-ack')).toBeNull();return}
 await publishMastermindThoughtAck(action,plan,input);expect(commits).toHaveBeenCalledTimes(1);expect(commits.mock.calls[0][0]).toHaveLength(6);expect(commits.mock.calls[0][0].find((w:any)=>w.name==='combat')?.expectedRevision).toBe(issuedCombat._sync.revision+3);
 const row=(await f.api.read('mastermind-thought-readings')).parents[prompt.id];expect(row.versions).toEqual(journalBefore.parents[prompt.id].versions);expect(row.phase).toBe('published');expect((await f.api.read('characters')).characters.find((c:any)=>c.id===f.reader.id).classResources['dnd5e-spell-slot-2'].current).toBe(before.characters.find((c:any)=>c.id===f.reader.id).classResources['dnd5e-spell-slot-2'].current-1);
 await publishMastermindThoughtAck(action,plan,input);expect(commits).toHaveBeenCalledTimes(1);for(const member of['player','dm']as const)expect((await f.api.post('mastermind-thought-reading/read-results',{},member)).payload.results).toEqual([]);
 });
 }finally{dispose()}
})
it.each(['upsert','answer','finish','put','atomic']as const)('only authenticated Host may approve a DM adjudication (%s)',async operation=>{
 const dispose=install();try{const f=await setup(),original=await prepareMastermindThoughtReadingOriginal(f.action.id,f.host);expect(original).toBeDefined();const id='dm-adjudication:'+f.action.id+':activity',interrupt={id,mapId:f.action.mapId,transactionId:f.action.id,kind:'dm-adjudication',status:'pending',phase:'before-action',timeoutPolicy:'wait-for-dm',createdAt:1,updatedAt:1,payload:{contextKind:'activity-boundary',actionId:f.action.id,casterTokenId:'reader-token',spellId:'detect-thoughts'}};
 if(operation==='upsert'){const response=await f.api.post('combat-interrupts/interrupt',{operation:'upsert',mapId:f.action.mapId,interrupt},'player','PATCH');expect(response.status).toBe(403);expect(await f.api.read('combat-interrupts')).toBeNull();return}
 expect((await f.api.post('combat-interrupts/interrupt',{operation:'upsert',mapId:f.action.mapId,interrupt},'dm','PATCH')).status).toBe(200);const before=await f.api.read('combat-interrupts'),forged={...before,interrupts:[{...before.interrupts[0],status:'done',response:{decision:'approved',effects:[]}}]};
 const response=operation==='put'?await f.api.post('combat-interrupts',forged,'player','PUT'):operation==='atomic'?await f.api.post('transaction',{transactionId:'forged-DM-approval',writes:[{name:'combat-interrupts',data:forged,expectedRevision:before._sync.revision}]},'player'):await f.api.post('combat-interrupts/interrupt',{operation,mapId:f.action.mapId,id,response:{decision:'approved',effects:[]}},'player','PATCH');
 expect(response.status).toBe(403);expect(await f.api.read('combat-interrupts')).toEqual(before);expect(await f.api.read('player-action-ack')).toBeNull();
 }finally{dispose()}
})

async function realOwnedThoughtPool(f:Awaited<ReturnType<typeof setup>>,requestId:string,role:'owner'|'reader',count=1,legacy=false){
 const map=(await f.api.read('maps')).maps[0],characters=(await f.api.read('characters')).characters,owners=new Map<string,string>(),events:any[]=[],host={roomId:'room',memberId:'dm',role:'dm'},tokenId=role==='owner'?'owner-token':'reader-token',characterId=role==='owner'?f.owner.id:f.reader.id,member=role==='owner'?'player':'reader';
 const none=()=>undefined,bindings:Record<string,unknown>={readBountifulActivityOriginalPlayerDiceOwner,hasIssuedBountifulActivityOriginalRequest,recordBountifulActivityOriginalHostRaw,recordBountifulActivityOriginalHostConfirmation,combatEndingRef:{current:false},assertDiceOwnership,isDM:true,mode:'dm',activeMap:map,characters,findExplicitDiceToken:(id:string)=>map.tokens.find((t:any)=>t.id===id),dnd5eCombatTokenSide,isDiceCharacterOwnedByCurrentDm,isDiceCharacterControlledByRemotePlayer,getRoomSession:()=>host,combatActiveRef:{current:true},combatIdRef:{current:'reading-combat'},activeInterruptTransactionIdRef:{current:f.action.id},secondChanceContinuationDiceParentRef:{current:undefined},d20RollSequenceByTransactionRef:{current:new Map()},diceBoxRollRequestCounterRef:{current:0},d20RequestCounterRef:{current:0},runtimeNow:()=>1234,seededDieValue:()=>1,durableD20RollId,MAX_DICE_POOL_COUNT:100,rememberDiceOwner:(id:string,t:any)=>owners.set(id,t.id),randomDieValue:()=>7,setDiceBoxRoll:(r:any)=>r.resolve(r.values),completeDiceBoxRoll:()=>{},settleAuthoritativeDicePresentation,DICE_TIMING:{SECRET_SETTLED_HOLD_MS:0,ROLL_FAILSAFE_MS:100,ROLL_SETTLED_HOLD_MS:0},readBountifulDamageZeroOriginalPlayerDiceOwner,readBountifulOpportunitySequencePlayerDiceOwner,readBountifulOpportunitySequenceLockedRaw,readBountifulNativeDiceRoute:none,readBountifulOpportunitySettlementDiceRoute:none,readMastermindThoughtPlayerDiceOwner:(input:any)=>readMastermindThoughtPlayerDiceOwner(input,(operation,input)=>f.host.request(operation,input)),readArcaneMovementPlayerDiceOwner:async()=>undefined,readArcaneBasePrefixPlayerDiceOwner:async()=>undefined,readBountifulOpportunitySettlementLockedRaw:none,readDicePoolCheckpoint:none,writeDicePoolCheckpoint:()=>{},resolveCombatD20RollerSide,shouldHideCombatRollForExplicitRoller,shouldHideCurrentMonsterCombatRoll:()=>false,shouldHideDmControlledCombatRoll:()=>false,COMBAT_INTERRUPT_RESOURCE:'combat-interrupts',loadSharedResource:f.api.read,requestPlayerDiceRoll:async(input:any)=>{
  const event={...input,mapId:map.id,combatId:'reading-combat',rollerTokenId:owners.get(input.requestId),delivery:'player-roll-request',sourceMode:'dm',values:[],updatedAt:1};events.push(event);
  const sent=await f.api.post('../events/dice-roll-request-dm-to-player',event,'dm');if(sent.status!==200)throw Error('actual-physical-request:'+sent.status+':'+sent.payload.error);
  if(legacy)return[7];
  const parent=requestId.slice(0,requestId.lastIndexOf(':')),projected=await f.api.post('mastermind-thought-reading/roll-request',{id:parent,requestId:input.requestId},member);if(projected.status!==200)throw Error('actual-owned-request:'+projected.status);
  const raw=await f.api.post('mastermind-thought-reading/raw',{id:parent,role,requestId:input.requestId,values:Array(input.count).fill(7)},member);if(raw.status!==200)throw Error('actual-physical-raw:'+raw.status);
  const returned=await f.api.post('../events/dice-roll-request-player-to-dm',{...event,delivery:'player-roll-result',sourceMode:'player',values:Array(input.count).fill(7)},member);if(returned.status!==200)throw Error('actual-physical-result:'+returned.status);return Array(input.count).fill(7)
 }};
 const scalar=actual<(label:string,target:string,options:object)=>Promise<number>>('rollDiceBoxD20InCombat',bindings);bindings.rollDiceBoxD20=scalar;
 const pool=actual<(count:number,sides:number,label:string,target:string,options:object)=>Promise<number[]>>('rollDiceBoxValuesInCombat',bindings),session=vi.spyOn(continuationRoomSession,'getRoomSession').mockReturnValue(host as any);let values:number[];try{values=await pool(count,20,'思想读取检定',characterId,{...(legacy?{}:{durableRollRequestId:requestId}),rollerTokenId:tokenId,rollerCharacterId:characterId,d20RollKind:'ability-check',d20RollMode:'normal',skipDmConfirmation:true,skipChoiceReroll:true,broadcast:false})}finally{session.mockRestore()}
 return{values,events}
}
it.each(['owner','reader','unissued','wrong-owner','wrong-pool','legacy']as const)('actual Page preserves issued private D20 pool and its authenticated roller (%s)',async mode=>{
 const dispose=install();try{const f=await setup(true,'owned-pool-original-'+mode),maps=await f.api.read('maps');maps.maps[0].tokens=maps.maps[0].tokens.map((t:any)=>({...t,type:'player'}));expect((await f.api.post('maps',maps,'dm','PUT')).status).toBe(200);
 const original=await prepareMastermindThoughtReadingOriginal(f.action.id,f.host),prompt=(await listMastermindThoughtPrompts(f.ownerGateway))[0];await answerMastermindThoughtReading(prompt.id,'present-false-thoughts','私有思想。',f.ownerGateway);const issued=await issueMastermindThoughtContestRolls(original!,f.host),role=mode==='reader'||mode==='legacy'?'reader':'owner',requestId=mode==='unissued'?prompt.id+':missing':issued.find(r=>r.role===role)!.requestId,before=await f.api.read('mastermind-thought-readings');
 if(['unissued','wrong-owner','wrong-pool'].includes(mode)){await expect(realOwnedThoughtPool(f,requestId,mode==='wrong-owner'?'reader':role,mode==='wrong-pool'?2:1)).rejects.toThrow();expect(await f.api.read('mastermind-thought-readings')).toEqual(before);expect(await f.api.read('player-action-ack')).toBeNull();return}
 const physical=await realOwnedThoughtPool(f,requestId,role,1,mode==='legacy');expect(physical.values).toEqual([7]);expect(physical.events).toHaveLength(1);if(mode==='legacy'){expect(physical.events[0].requestId).toBe(durableD20RollId({mapId:f.action.mapId,sourceMode:'dm',transactionId:f.action.id,occurrenceIndex:0}));expect(await f.api.read('mastermind-thought-readings')).toEqual(before);return}
 expect(physical.events[0].requestId).toBe(requestId);expect(physical.events[0].rollerTokenId).toBe(role==='owner'?'owner-token':'reader-token');const raw=(await f.api.read('mastermind-thought-readings')).parents[prompt.id].rollRequests[role];expect(raw.raw.values).toEqual([7]);expect(raw.raw.memberId).toBe(role==='owner'?'player':'reader');expect(raw.confirmed).toBeUndefined();
 expect((await f.api.post('mastermind-thought-reading/confirm',{id:prompt.id,role,requestId,values:[1]},'dm')).status).toBe(200);const confirmed=(await f.api.read('mastermind-thought-readings')).parents[prompt.id].rollRequests[role];expect(confirmed.raw.values).toEqual([7]);expect(confirmed.confirmed.values).toEqual([1]);expect(confirmed.confirmed.memberId).toBe('dm');expect(await f.api.read('player-action-ack')).toBeNull();
 }finally{dispose()}
})

const resolveMastermindThoughtContinuation:typeof resolveCore=async(original,input,g)=>withMastermindThoughtContinuationProduction(original,g,async(prepared,resolve)=>{
 await expect(resolve({...input,prepared:JSON.parse(JSON.stringify(prepared))})).rejects.toThrow('same-issued-prepared')
 const native=await resolve({...input,prepared:cloneDnd5eHostTransactionInput(prepared)})
 expect(()=>readMastermindThoughtContinuationNativeResolution(JSON.parse(JSON.stringify(native)))).toThrow('actual-issued-native-result')
 return readMastermindThoughtContinuationNativeResolution(native)
})

async function setupContinuation(kind:'surface'|'probe',expert=false){
 const f=readingFixture(17,'actual-native-first-consented-parent');let nativeReader=f.reader
 if(expert)for(let level=1;level<=2;level++){const plan=buildDnd5eLevelAdvancementPlan(nativeReader,'rogue',1)!,selections=Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,[...r.currentSelections,...['insight','thievesTools',...r.options.map(o=>o.id)].filter((id,index,all)=>all.indexOf(id)===index&&r.options.some(o=>o.id===id)&&!r.currentSelections.includes(id))].slice(0,r.targetLimit)])),next=applyDnd5eLevelAdvancement(nativeReader,{schemaVersion:1,classId:'rogue',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:[],classChoiceSelections:selections});expect(next.ok).toBe(true);if(!next.ok)throw Error(next.reason);nativeReader=next.character}
 const ready=prepareDnd5ePluginSpellCast({action:f.action,map:f.ready.map,characters:[nativeReader,f.owner],initiativeOrder:f.ready.map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i}))});if(!ready.ok)throw Error(ready.reason)
 const h=captureSoulOfDeceitReading(ready.prepared.state,{parentId:f.action.id,ownerId:'owner-token',readerId:'reader-token'})!,allow=resolveSoulOfDeceitReading(h,{parentId:f.action.id,choice:'allow-real-thoughts'});if(!('permission'in allow)||!allow.permission)throw Error('Real native first-cast permission missing')
 const cast=withSoulOfDeceitReadingPermission(allow.permission,()=>resolvePreparedDnd5ePluginSpellCast({prepared:ready.prepared,rolls:{activityRolls:{},activityInterruptChoiceId:'dm-apply'}}));expect(cast.result.ok).toBe(true);if(!cast.application)throw Error('Real native cast missing')
 const reader={...cast.application.characters.find(c=>c.id===f.reader.id)!,roomId:'room',roomMemberId:'reader'},owner={...cast.application.characters.find(c=>c.id===f.owner.id)!,roomId:'room',roomMemberId:'player'},effect=reader.dnd5eCombatState!.activeEffects!.find(e=>e.grantedActivities?.includes('spell:detect-thoughts:'+kind))!;expect(effect).toBeDefined()
 const map=cast.application.map,order=map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i})),api=await createNativeEnvelopeApi({characters:{characters:[reader,owner]},maps:{maps:[map]},combat:{active:true,mapId:map.id,combatId:'reading-combat',round:2,initiativeIndex:0,initiativeOrder:order}})
 const action:SharedPlayerActionState={...f.action,id:'actual-native-'+kind+'-parent',type:'dnd5e-plugin-action',combatId:'reading-combat',roomMemberId:'reader',dnd5eSpellCast:undefined,dnd5ePluginAction:{featureId:'srd-5.1:effect-control.spell:detect-thoughts:'+kind,payload:{activeEffectId:effect.id}},round:2}
 expect((await api.post('player-action-requests/append',{action},'reader')).status).toBe(200)
 const gateway=(member:'dm'|'reader'|'player'):MastermindThoughtGateway=>({session:()=>({roomId:'room',memberId:member,role:member==='dm'?'dm':'player'}),loadResource:api.read,request:async<T>(operation:string,input:unknown)=>{const r=await api.post('mastermind-thought-reading/'+operation,input,member);if(r.status!==200)throw Error('real-api:'+r.status+':'+JSON.stringify(r.payload));return r.payload as T}})
 return{api,action,host:gateway('dm'),owner:gateway('player'),reader:gateway('reader'),slot:reader.classResources!['dnd5e-spell-slot-2'].current}
}
it.each(['surface','probe'].flatMap(kind=>['allow-real-thoughts','deny','false-win','false-loss'].map(choice=>({kind:kind as 'surface'|'probe',choice}))))('real source-granted $kind/$choice → new owner answer → same original six-write ACK/private result',async({kind,choice})=>{
 const dispose=install();try{
  const f=await setupContinuation(kind,true),original=await prepareMastermindThoughtContinuationOriginal(f.action.id,f.host);expect(original).toBeDefined();const prompt=(await listMastermindThoughtPrompts(f.owner))[0]
  expect((await f.api.post('mastermind-thought-reading/answer',{id:prompt.id,expectedRecordRevision:prompt.revision,choice:'allow-real-thoughts'},'dm')).status).toBe(403)
  const falseChoice=choice.startsWith('false'),answer=falseChoice?'present-false-thoughts':choice as 'deny'|'allow-real-thoughts'
  await answerMastermindThoughtReading(prompt.id,answer,falseChoice?'主人展示的持续虚假思想。':undefined,f.owner)
  if(falseChoice){const requests=await issueMastermindThoughtContinuationContest(original!,f.host);for(const role of ['owner','reader']as const){const request=requests[role]!;expect((await f.api.post('mastermind-thought-reading/raw',{id:prompt.id,role,requestId:request.id,values:Array(request.count).fill(role==='owner'?18:1)},role==='owner'?'reader':'player')).status).toBe(403);expect((await f.api.post('mastermind-thought-reading/raw',{id:prompt.id,role,requestId:request.id,values:Array(request.count).fill(role==='owner'?18:1)},role==='owner'?'player':'reader')).status).toBe(200);expect((await f.api.post('mastermind-thought-reading/confirm',{id:prompt.id,role,requestId:request.id,values:Array(request.count).fill(role==='owner'?(choice==='false-loss'?2:20):(choice==='false-loss'?20:1))},'dm')).status).toBe(200)}}
  await expect(resolveMastermindThoughtContinuation(JSON.parse(JSON.stringify(original)),{},f.host)).rejects.toThrow('issued-original')
  const request:Parameters<typeof resolveMastermindThoughtContinuation>[1]={interruptChoiceId:'dm-apply',rolls:kind==='probe'?{'detect-thoughts-probe-save-d20:owner-token':{values:[1],modifier:0,total:1}}:{}},first=await resolveMastermindThoughtContinuation(original!,request,f.host),priorJournal=await f.api.read('mastermind-thought-readings'),fresh=(await prepareMastermindThoughtContinuationOriginal(f.action.id,f.host))!,resolution=await resolveMastermindThoughtContinuation(fresh,request,f.host),view=await readMastermindThoughtContinuationResolved(resolution,f.host)
  expect(await f.api.read('mastermind-thought-readings')).toEqual(priorJournal);expect(view.native).toEqual((await readMastermindThoughtContinuationResolved(first,f.host)).native)
  const permitted=choice==='allow-real-thoughts'||choice==='false-win';expect(view.native.result.ok).toBe(true);expect(view.kind).toBe(choice==='allow-real-thoughts'?'real-consent':choice==='false-win'?'false-thoughts':'blocked')
  const plan=await prepareMastermindThoughtPublication(resolution,f.host,'只有真实读者可见的继续读取。'),action=view.originalAction,ack=buildPlayerActionAck({action,status:'accepted',mapId:action.mapId,combatId:action.combatId,round:action.round,initiativeIndex:action.initiativeIndex,appliedAt:3}),processed=buildPlayerActionProcessedState({action,current:await f.api.read('player-action-processed'),updatedAt:3}),announce=vi.fn(async()=>{})
  const input={ack,processed,snapshots:{characters:view.native.application!.characters,maps:[view.native.application!.map],combat:await f.api.read('combat'),updatedAt:3},loadSharedResource:f.api.read,saveSharedResource:async()=>{throw Error('No split publication')},publishAck:announce,commitSharedResources:async(writes:readonly import('../../lib/sharedApi').SharedResourceTransactionWrite[],options:any)=>f.api.gateway.saveResourcesAtomically([...writes],options)}
  await publishMastermindThoughtAck(action,plan,input)
  expect(f.api.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1);expect(f.api.gateway.saveResourcesAtomically.mock.calls[0][0]).toHaveLength(6)
  const result=await readMastermindThoughtResult(prompt.id,f.reader);expect(result.result.kind).toBe(permitted?'thoughts':'unavailable');expect(result.result.thoughts).toBe(choice==='allow-real-thoughts'?'只有真实读者可见的继续读取。':choice==='false-win'?'主人展示的持续虚假思想。':undefined);expect(JSON.stringify(result)).not.toContain('false-thoughts');expect((await f.api.post('mastermind-thought-reading/read-result',{id:prompt.id},'player')).status).toBe(403)
  const characters=await f.api.read('characters');expect(characters.characters.find((c:any)=>c.id===action.characterId).classResources['dnd5e-spell-slot-2'].current).toBe(f.slot)
  expect((await f.api.read('combat')).dnd5eTurnEconomyByToken['reader-token'].action.current).toBe(0)
  expect(JSON.stringify(await f.api.read('player-action-ack'))).not.toContain('继续读取');expect(JSON.stringify(await f.api.read('maps'))).not.toContain('继续读取')
  await publishMastermindThoughtAck(action,plan,input);expect(f.api.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1);expect(await f.api.read('characters')).toEqual(characters)
 }finally{dispose()}
})

it.each(['missing-queue','wrong-reader','missing-controller','foreign-effect-source','no-concentration','probe-no-focus'] as const)('authenticated begin rejects %s without minting another parent or changing native costs',async mode=>{
 const dispose=install();try{
  const f=await setupContinuation(mode==='probe-no-focus'?'probe':'surface'),original=await prepareMastermindThoughtContinuationOriginal(f.action.id,f.host);expect(original).toBeDefined()
  const saved=await f.api.read('mastermind-thought-readings'),row=Object.values(saved.parents)[0] as any,input:any=Object.fromEntries(['id','parentTransactionId','mapId','readerTokenId','ownerTokenId','readerCharacterId','ownerCharacterId','featureId','sourceDefinitionSignature','versions'].map(k=>[k,row[k]]));input.id+=':negative'
  if(mode==='missing-queue')input.parentTransactionId+=':not-queued'
  if(mode==='wrong-reader')input.readerCharacterId=row.ownerCharacterId
  if(['missing-controller','foreign-effect-source','no-concentration','probe-no-focus'].includes(mode)){
   const chars=await f.api.read('characters'),reader=chars.characters.find((c:any)=>c.id===row.readerCharacterId),owner=chars.characters.find((c:any)=>c.id===row.ownerCharacterId)
   if(mode==='missing-controller')reader.dnd5eCombatState.activeEffects=[]
   if(mode==='foreign-effect-source')reader.dnd5eCombatState.activeEffects.find((e:any)=>e.grantedActivities).source.actorId='another-native-caster'
   if(mode==='no-concentration')reader.concentrating=false
   if(mode==='probe-no-focus')owner.dnd5eCombatState.activeEffects=[]
   expect((await f.api.post('characters',chars,'dm','PUT')).status).toBe(200)
   input.versions={...input.versions,characters:(await f.api.read('characters'))._sync.revision}
   await expect(prepareMastermindThoughtContinuationOriginal(f.action.id,f.host)).rejects.toThrow()
  }
  const before=await f.api.read('characters'),response=await f.api.post('mastermind-thought-reading/begin',input,'dm')
  expect(response.status).toBe(409);expect(await f.api.read('mastermind-thought-readings')).toEqual(saved);expect(await f.api.read('characters')).toEqual(before);expect(await f.api.read('player-action-ack')).toBeNull()
 }finally{dispose()}
})

it.each(['clock','geometry','current-source-uninstall'] as const)('an answered genuine continuation rejects %s change with zero original publication',async mode=>{
 let dispose=install();try{
  const f=await setupContinuation('surface'),original=(await prepareMastermindThoughtContinuationOriginal(f.action.id,f.host))!,prompt=(await listMastermindThoughtPrompts(f.owner))[0];await answerMastermindThoughtReading(prompt.id,'allow-real-thoughts',undefined,f.owner)
  if(mode==='clock')expect((await f.api.post('campaign-time/mutation',{operation:'advance-seconds',seconds:6},'dm','PATCH')).status).toBe(200)
  if(mode==='geometry')expect((await f.api.post('map-geometry',{schemaVersion:2,maps:[]},'dm','PUT')).status).toBe(200)
  if(mode==='current-source-uninstall'){dispose();dispose=install()}
  const before=await f.api.read('characters');await expect(resolveMastermindThoughtContinuation(original,{interruptChoiceId:'dm-apply',rolls:{}},f.host)).rejects.toThrow();expect(await f.api.read('characters')).toEqual(before);expect(await f.api.read('player-action-ack')).toBeNull();expect(f.api.gateway.saveResourcesAtomically).not.toHaveBeenCalled();expect((await f.api.read('mastermind-thought-readings')).parents[prompt.id].phase).toBe('answered')
 }finally{dispose()}
})

it('queue changes after a genuine continuation publication plan reject the original atomic transaction without native costs/private result',async()=>{
 const dispose=install();try{
  const f=await setupContinuation('surface'),original=(await prepareMastermindThoughtContinuationOriginal(f.action.id,f.host))!,prompt=(await listMastermindThoughtPrompts(f.owner))[0];await answerMastermindThoughtReading(prompt.id,'allow-real-thoughts',undefined,f.owner)
  const resolution=await resolveMastermindThoughtContinuation(original,{interruptChoiceId:'dm-apply',rolls:{}},f.host),view=await readMastermindThoughtContinuationResolved(resolution,f.host),plan=await prepareMastermindThoughtPublication(resolution,f.host,'绝不能提前发布的私人思想。'),action=view.originalAction,ack=buildPlayerActionAck({action,status:'accepted',mapId:action.mapId,combatId:action.combatId,round:action.round,initiativeIndex:action.initiativeIndex,appliedAt:3}),processed=buildPlayerActionProcessedState({action,current:await f.api.read('player-action-processed'),updatedAt:3})
  expect((await f.api.post('player-action-requests/append',{action:{...f.action,id:f.action.id+':another-legitimate-pending'}},'reader')).status).toBe(200)
  const before=await f.api.read('characters'),input={ack,processed,snapshots:{characters:view.native.application!.characters,maps:[view.native.application!.map],combat:await f.api.read('combat'),updatedAt:3},loadSharedResource:f.api.read,saveSharedResource:async()=>{throw Error('No split publication')},publishAck:vi.fn(async()=>{}),commitSharedResources:async(writes:readonly import('../../lib/sharedApi').SharedResourceTransactionWrite[],options:any)=>f.api.gateway.saveResourcesAtomically([...writes],options)}
  await expect(publishMastermindThoughtAck(action,plan,input)).rejects.toThrow('409');expect(await f.api.read('characters')).toEqual(before);expect(await f.api.read('player-action-ack')).toBeNull();expect((await f.api.read('mastermind-thought-readings')).parents[prompt.id].phase).toBe('answered');expect(input.publishAck).not.toHaveBeenCalled()
 }finally{dispose()}
})

it('player-created imported JSON cannot mint a native Detect Thoughts controller source for a new private continuation',async()=>{
 const dispose=install();try{
  const f=await setupContinuation('surface'),chars=await f.api.read('characters'),reader=chars.characters.find((c:any)=>c.id===f.action.characterId),imported=structuredClone(reader);imported.id='imported-reader';imported.name='Imported self-reported reader';imported.roomMemberId='reader'
  for(const effect of imported.dnd5eCombatState.activeEffects){effect.source.actorId='imported-reader-token';effect.source.characterId=imported.id;if(effect.duration?.sourceActorId)effect.duration.sourceActorId='imported-reader-token'}
  expect((await f.api.post('characters',{...chars,characters:[...chars.characters,imported]},'reader','PUT')).status).toBe(200)
  const savedCharacters=await f.api.read('characters'),savedReader=savedCharacters.characters.find((c:any)=>c.id===reader.id),savedImport=savedCharacters.characters.find((c:any)=>c.id===imported.id);expect(savedReader.dnd5eCombatState).toEqual(reader.dnd5eCombatState);expect(savedImport.dnd5eCombatState.activeEffects[0].label).toBe(imported.dnd5eCombatState.activeEffects[0].label);expect(savedImport.dnd5eCombatState.activeEffects[0].grantedActivities??[]).not.toContain('spell:detect-thoughts:surface')
  const maps=await f.api.read('maps'),map=maps.maps[0];map.tokens.push({...map.tokens.find((t:any)=>t.id==='reader-token'),id:'imported-reader-token',characterId:imported.id,label:imported.name,y:75});expect((await f.api.post('maps',maps,'dm','PUT')).status).toBe(200)
  const combat=await f.api.read('combat');combat.initiativeOrder=[{...combat.initiativeOrder[0],tokenId:'imported-reader-token',label:imported.name},...combat.initiativeOrder];expect((await f.api.post('combat',combat,'dm','PUT')).status).toBe(200)
  const action={...f.action,id:'imported-source-parent',actorTokenId:'imported-reader-token',characterId:imported.id};expect((await f.api.post('player-action-requests/append',{action},'reader')).status).toBe(200)
  const before=await f.api.read('characters');await expect(prepareMastermindThoughtContinuationOriginal(action.id,f.host)).rejects.toThrow();const feature=dnd5ePluginFeaturesAvailableForCharacter(before.characters.find((c:any)=>c.id==='owner')).find(f=>f.declarativeAbility?.mechanic?.kind==='soul-of-deceit')!;expect(feature).toBeDefined();const versions:Record<string,number>={};for(const name of['characters','maps','combat','map-geometry','campaign-time'])versions[name]=(await f.api.read(name))?._sync?.revision??0
  expect((await f.api.post('mastermind-thought-reading/begin',{id:'mastermind-thought-reading:forged-import-source',parentTransactionId:action.id,mapId:action.mapId,readerTokenId:action.actorTokenId,ownerTokenId:'owner-token',readerCharacterId:imported.id,ownerCharacterId:'owner',featureId:feature.id,sourceDefinitionSignature:JSON.stringify(feature),versions},'dm')).status).toBe(409)
  expect(await f.api.read('characters')).toEqual(before);expect(await f.api.read('mastermind-thought-readings')).toBeNull();expect(await f.api.read('player-action-ack')).toBeNull()
 }finally{dispose()}
})

async function publishExactReading(f:Pick<Awaited<ReturnType<typeof setup>>,'api'|'host'>,actionId:string,token:object,application:{characters:any[];map:BattleMap},note?:string,actualPlan?:Awaited<ReturnType<typeof prepareMastermindThoughtPublication>>){
 const plan=actualPlan??await prepareMastermindThoughtPublication(token,f.host,note),combat=await f.api.read('combat'),action=(await f.api.read('player-action-requests')).requests.find((a:any)=>a.id===actionId),ack=buildPlayerActionAck({action,status:'accepted',mapId:action.mapId,combatId:action.combatId,round:combat.round,initiativeIndex:combat.initiativeIndex,appliedAt:Date.now()}),processed=buildPlayerActionProcessedState({action,current:await f.api.read('player-action-processed'),updatedAt:Date.now()}),commits=vi.fn(async(writes:readonly{name:string;data:unknown;expectedRevision?:number}[],options:any)=>f.api.gateway.saveResourcesAtomically([...writes],options));
 const input={ack,processed,snapshots:{characters:application.characters,maps:[application.map],combat,updatedAt:Date.now()},loadSharedResource:f.api.read,saveSharedResource:async()=>{throw Error('standalone forbidden')},publishAck:async()=>{},commitSharedResources:commits};await publishMastermindThoughtAck(action,plan,input);await publishMastermindThoughtAck(action,plan,input);expect(commits).toHaveBeenCalledTimes(1);expect(commits.mock.calls[0][0]).toHaveLength(6);return{plan,action,input,commits}
}
async function setupAuthenticatedContinuation(kind:'surface'|'probe'){
 const f=await setup(true,'first-authenticated-cast-'+kind),original=await prepareMastermindThoughtReadingOriginal(f.action.id,f.host),prompt=(await listMastermindThoughtPrompts(f.ownerGateway))[0];await answerMastermindThoughtReading(prompt.id,'allow-real-thoughts',undefined,f.ownerGateway);
 await withMastermindThoughtProduction(original!,undefined,f.host,async(prepared,resolve)=>{const native=resolve({prepared,rolls:{activityRolls:{},activityInterruptChoiceId:'dm-apply'}});if(!native.result.ok||!native.application)throw Error('real initial native cast required');const completed=await settleDnd5eConcentrationChecks({result:native.result,map:native.application.map,characters:native.application.characters,priorApplication:native.application,characterIdByCombatantId:prepared.characterIdByCombatantId,rollD20:no,rollD4:no,rollDice:no});await publishExactReading(f,f.action.id,await completeMastermindThoughtBaseOriginal(native,completed,f.host),completed.application,'初次私人思想。')});
 for(let index=0;index<2;index++){
  const characters=await f.api.read('characters'),maps=await f.api.read('maps'),combat=await f.api.read('combat'),actorId=combat.initiativeOrder[combat.initiativeIndex].tokenId,actor=maps.maps[0].tokens.find((t:any)=>t.id===actorId),turnAction:SharedPlayerActionState={id:'real-host-end-turn-'+kind+'-'+index,type:'end-turn',status:'pending',sourceMode:'dm',mapId:maps.maps[0].id,combatId:combat.combatId,actorTokenId:actorId,characterId:actor.characterId,round:combat.round,initiativeIndex:combat.initiativeIndex,seq:index,updatedAt:1},ended=resolveDnd5ePlayerEndTurn({action:turnAction,map:maps.maps[0],characters:characters.characters,initiativeOrder:combat.initiativeOrder,turnEconomy:combat.dnd5eTurnEconomyByToken?.[actorId]});
  if(!ended.ok||!ended.result.ok)throw Error('actual native turn transition failed');expect(ended.result.events.some(e=>e.type==='turn-started')).toBe(true);
  const economies={...combat.dnd5eTurnEconomyByToken};for(const[id,unit]of Object.entries(ended.result.state.combatants)){const begun=ended.result.events.some(e=>e.type==='turn-started'&&e.actorId===id),previous=begun||!economies[id]?createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(ended.result.state,id),unit.speed):economies[id];economies[id]=projectDnd5eHeadlessTurnEconomy(previous,unit.turn,unit.speed)}
  await f.api.gateway.saveResourcesAtomically([{name:'characters',expectedRevision:characters._sync.revision,data:{...characters,characters:ended.application.characters}},{name:'maps',expectedRevision:maps._sync.revision,data:{...maps,maps:[ended.application.map]}},{name:'combat',expectedRevision:combat._sync.revision,data:{...combat,round:ended.result.state.round,initiativeIndex:ended.result.state.initiativeIndex,dnd5eTurnEconomyByToken:economies}}],{transactionId:turnAction.id,readRevisions:{'campaign-time':0,'map-geometry':0}})
 }
 const characters=await f.api.read('characters'),maps=await f.api.read('maps'),combat=await f.api.read('combat'),reader=characters.characters.find((c:any)=>c.id===f.reader.id),control=playerMapGrantedActivityControls(maps.maps[0],reader).find(control=>control.activityId==='spell:detect-thoughts:'+kind);expect(control).toBeDefined();expect(control?.effectId).toBeDefined();if(!control?.effectId)throw Error('actual current granted control required');expect(combat.round).toBe(2);expect(combat.dnd5eTurnEconomyByToken['reader-token'].action.current).toBe(1);
 const action:SharedPlayerActionState={...f.action,id:'real-page-continuation-'+kind,type:'dnd5e-plugin-action',dnd5eSpellCast:undefined,dnd5ePluginAction:{featureId:control.featureId,payload:{activeEffectId:control.effectId}},round:combat.round,initiativeIndex:combat.initiativeIndex};expect((await f.api.post('player-action-requests/append',{action},'reader')).status).toBe(200);return{...f,action,initialId:prompt.id}
}
const continuedPageCases=[...(['surface','probe']as const).flatMap(kind=>(['allow','deny','false-win','false-lose']as const).map(mode=>({kind,mode,fault:'none'}))),...['still-paused','wrong-parent','wrong-feature','wrong-audience','wrong-map','clock','geometry','economy','source','cancelled'].map(fault=>({kind:'surface' as const,mode:'allow' as const,fault}))]
it.each(continuedPageCases)('actual Page source-granted resolver and its DM-only pause remain on the original ACK ($kind/$mode/$fault)',async({kind,mode,fault})=>{
 const dispose=install();try{
 const f=await setupAuthenticatedContinuation(kind),original=(await prepareMastermindThoughtContinuationOriginal(f.action.id,f.host))!,prompt=(await listMastermindThoughtPrompts(f.ownerGateway)).find(p=>p.id!==f.initialId)!,choice=mode==='allow'?'allow-real-thoughts':mode==='deny'?'deny':'present-false-thoughts';await answerMastermindThoughtReading(prompt.id,choice,choice==='present-false-thoughts'?'续读中的虚假思想。':undefined,f.ownerGateway);const before=await f.api.read('characters');
 if(choice==='present-false-thoughts'){
  const session=vi.spyOn(continuationRoomSession,'getRoomSession').mockReturnValue({roomId:'room',memberId:'dm',role:'dm',clientId:'fixture-ui-client',roomName:'fixture',roomToken:'client-only-placeholder-not-used-for-HTTP',displayName:'DM',createdAt:1,rulesetId:'dnd5e-2014-srd-5.1'});try{await collectMastermindThoughtContinuationPhysical(original,f.host,{rollOriginalWithoutConfirmation:async row=>{const raw=await f.api.post('mastermind-thought-reading/raw',{id:row.parentId,role:row.role,requestId:row.id,values:Array(row.count).fill(7)},row.role==='owner'?'player':'reader');expect(raw.status).toBe(200);return Array(row.count).fill(7)},confirmStored:async(row,raw)=>{expect(raw).toEqual(Array(row.count).fill(7));const face=mode==='false-win'?row.role==='owner'?20:1:row.role==='owner'?1:20,response=await f.api.post('mastermind-thought-reading/confirm',{id:row.parentId,role:row.role,requestId:row.id,values:Array(row.count).fill(face)},'dm');expect(response.status).toBe(200);return Array(row.count).fill(face)}})}finally{session.mockRestore()}
 }
 await withMastermindThoughtContinuationProduction(original,f.host,async(prepared,resolve)=>{
  const control=async(flowPause:unknown)=>{const combat=await f.api.read('combat');expect((await f.api.post('combat',{...combat,flowPause,updatedAt:Date.now()},'dm','PUT')).status).toBe(200)};
  const decide=actual<(cap:typeof original,inputPrepared:typeof prepared,gateway:typeof f.host)=>Promise<{optionId:string;thoughts?:string}>>('requestMastermindThoughtContinuationChoice',{readMastermindThoughtContinuationDmContext,isAssistedDmBoundaryChoice,activateDmAdjudicationPause:async({interruptId}:any)=>control({schemaVersion:1,reason:'dm-adjudication',phase:'adjudicating',pausedAt:1,interruptId}),waitForDmAdjudicationResume:async({id}:any)=>{await control({schemaVersion:1,reason:'dm-adjudication',phase:'awaiting-resume',pausedAt:1,resolvedAt:2,interruptId:id});if(fault!=='still-paused')await control(undefined);if(fault==='clock')expect((await f.api.post('campaign-time/mutation',{operation:'advance-seconds',seconds:6},'dm','PATCH')).status).toBe(200);if(fault==='geometry')expect((await f.api.post('map-geometry',{schemaVersion:3,maps:[],updatedAt:1},'dm','PUT')).status).toBe(200);if(fault==='economy'){const combat=await f.api.read('combat');await control(undefined);combat._sync=(await f.api.read('combat'))._sync;combat.dnd5eTurnEconomyByToken['reader-token'].action.current=0;expect((await f.api.post('combat',combat,'dm','PUT')).status).toBe(200)}if(fault==='source')dispose()},requestSharedChoiceWindow:async(input:any)=>{
   expect(input.id).toBe('plugin-choice:'+f.action.id);expect(input.audience).toBe('dm');expect(input.featureId).toBe(prepared.feature.id);expect(input.fields).toEqual(mode==='allow'?[{id:'thoughts',label:'仅向施法者描述此刻的思想',kind:'text',required:true}]:undefined);const payload={pluginId:input.pluginId,featureId:fault==='wrong-feature'?input.featureId+':other':input.featureId,featureName:input.featureName,prompt:input.prompt,audience:fault==='wrong-audience'?'target':input.audience,options:input.options,defaultOptionId:input.defaultOptionId,fields:input.fields},interrupt={id:input.id,mapId:fault==='wrong-map'?prepared.map.id+':other':prepared.map.id,transactionId:fault==='wrong-parent'?f.action.id+':other':f.action.id,kind:'plugin-choice',status:'pending',phase:'before-action',timeoutPolicy:'wait-for-dm',actorCharId:prepared.actor.id,targetCharId:prepared.targetToken.characterId,payload,createdAt:1,updatedAt:1};expect((await f.api.post('combat-interrupts/interrupt',{operation:'upsert',mapId:interrupt.mapId,interrupt},'dm','PATCH')).status).toBe(200);
   const optionId=fault==='cancelled'?input.defaultOptionId:'dm-apply',mutation={operation:'answer',id:input.id,mapId:interrupt.mapId,response:{optionId,...(mode==='allow'?{fieldValues:{thoughts:'私人续读文本-'+kind}}:{})}};expect((await f.api.post('combat-interrupts/interrupt',mutation,'player','PATCH')).status).toBe(fault==='wrong-audience'?200:403);expect((await f.api.post('combat-interrupts/interrupt',mutation,'dm','PATCH')).status).toBe(200);expect((await f.api.post('combat-interrupts/interrupt',{operation:'finish',mapId:interrupt.mapId,id:input.id},'dm','PATCH')).status).toBe(200);input.onFieldValues?.({thoughts:'私人续读文本-'+kind});return optionId
  }});
  await expect(decide(original,JSON.parse(JSON.stringify(prepared)),f.host)).rejects.toThrow('actual-issued-prepared');const publicationCount=f.api.gateway.saveResourcesAtomically.mock.calls.length;
  if(fault!=='none'&&fault!=='cancelled'){await expect(decide(original,prepared,f.host)).rejects.toThrow();expect((await f.api.read('characters')).characters.find((c:any)=>c.id===f.reader.id).classResources).toEqual(before.characters.find((c:any)=>c.id===f.reader.id).classResources);expect((await f.api.read('player-action-ack')).actionId).not.toBe(f.action.id);expect(f.api.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(publicationCount);return}
  const decision=await decide(original,prepared,f.host);if(fault==='cancelled'){expect(decision.optionId).toBe(prepared.feature.action!.interrupt!.defaultOptionId);expect(decision.thoughts).toBeUndefined();await expect(resolve({prepared,interruptChoiceId:'dm-apply',rolls:{}})).rejects.toThrow();expect(f.api.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(publicationCount);expect((await f.api.read('player-action-ack')).actionId).not.toBe(f.action.id);return}expect(decision.thoughts).toBe(mode==='allow'?'私人续读文本-'+kind:undefined);
  const options={authorityUnchanged:()=>true,charactersByCombatantId:Object.fromEntries(Object.entries(prepared.characterIdByCombatantId).map(([id,cid])=>[id,prepared.characters.find(c=>c.id===cid)]))},facade=actual<any>('resolveDnd5eFacadeWithAirborneFalls',{getRoomSession:()=>({role:'dm'}),activeInterruptTransactionIdRef:{current:f.action.id},secondChancePreparedAdapterId,resolvePreparedDnd5eEquipmentAttack,resolveDnd5ePreparedWithMaterialDamageReactions,damageReactionOptionsForMap:()=>options,previewDnd5eMountedBalance,rollDiceBoxD20:no,rollDiceBoxValues:no});
  const actualResolver=actual<()=>ReturnType<typeof resolve>>('resolveFeatureWithInterruptions',{resolveDnd5eFacadeWithAirborneFalls:facade,thoughtContinuationResolver:resolve,featureMagicOriginal:undefined,nativeFeatureMagicOriginal:undefined,getSharedResourceRevisionWatermark:()=>0,prepared:{ok:true,prepared},pluginRolls:kind==='probe'?{'detect-thoughts-probe-save-d20:owner-token':{values:[1],modifier:0,total:1}}:{},featureNegationDice:undefined,featureEffectRollDice:{},restResolutionClock:undefined,restCommitRevisions:undefined,authoritativePayload:undefined,pluginChoiceId:decision.optionId,summonInitiativeD20:undefined,resolveDnd5eDamageBoundaryWithMaterials,featureDamageOptions:options});
  const beforeWillingPayload=JSON.stringify(prepared.headlessAction.payload);await actualPageWillingPreflight(prepared,original);const native=await actualResolver();expect(native.result.ok).toBe(true);expect(JSON.stringify(prepared.headlessAction.payload)).toBe(beforeWillingPayload);if(!native.application)throw Error('actual native application required');expect(native.result.events.some(event=>event.type==='ability-check-resolved')).toBe(false);const tail=await actualContinuationBaseTail(f,original,prepared,native);expect(tail.baseCalls).toBe(1);const token=tail.completion??readMastermindThoughtContinuationNativeResolution(native);await expect(completeMastermindThoughtContinuationBase({},tail.completed,f.host)).rejects.toThrow();
if(kind==='surface'&&mode==='allow'){
 const raw=readMastermindThoughtContinuationNativeResolution(native);await expect(completeMastermindThoughtContinuationBase(raw,JSON.parse(JSON.stringify(tail.completed)),f.host)).rejects.toThrow('actual-unchanged-completion-required');await expect(readMastermindThoughtContinuationResolved(JSON.parse(JSON.stringify(token)),f.host)).rejects.toThrow('actual-native-result-required');
 if(!native.result.ok)throw Error('Actual successful native result required');const wrongInput=cloneDnd5eHostTransactionInput(native.result),otherCompleted=await settleDnd5eConcentrationChecks({result:wrongInput,map:native.application.map,characters:native.application.characters,priorApplication:native.application,characterIdByCombatantId:prepared.characterIdByCombatantId,rollD20:no,rollD4:no,rollDice:no});await expect(completeMastermindThoughtContinuationBase(raw,otherCompleted,f.host)).rejects.toThrow('actual-unchanged-completion-required');
 const projection=await readMastermindThoughtContinuationResolved(token,f.host),round=projection.native.result.state.round;projection.native.result.state.round+=10;expect((await readMastermindThoughtContinuationResolved(token,f.host)).native.result.state.round).toBe(round);expect((await f.api.read('player-action-ack')).actionId).not.toBe(f.action.id);
}
const plan=await actualContinuationPublication({thoughtContinuationOriginal:original,thoughtContinuationCompleted:tail.completion,resolved:tail.native,thoughtContinuationGateway:f.host,thoughtContinuationDecision:decision,prepareMastermindThoughtPublication,readMastermindThoughtContinuationNativeResolution});await publishExactReading(f,f.action.id,token,tail.application,decision.thoughts,plan);
  const after=await f.api.read('characters'),row=(await f.api.read('mastermind-thought-readings')).parents[prompt.id];expect(row.phase).toBe('published');expect(row.versions.combat).toBe((await f.api.read('combat'))._sync.revision-4);expect(after.characters.find((c:any)=>c.id===f.reader.id).classResources['dnd5e-spell-slot-2'].current).toBe(before.characters.find((c:any)=>c.id===f.reader.id).classResources['dnd5e-spell-slot-2'].current);expect((await f.api.read('combat')).dnd5eTurnEconomyByToken['reader-token'].action.current).toBe(0);expect((await readMastermindThoughtResult(prompt.id,f.readerGateway)).result.thoughts).toBe(mode==='allow'?decision.thoughts:mode==='false-win'?'续读中的虚假思想。':undefined);
  for(const member of['player','reader']as const){const publicQueue=await f.api.post('combat-interrupts',{},member,'GET');expect(JSON.stringify(publicQueue.payload)).not.toContain('私人续读文本');expect((await f.api.post('mastermind-thought-readings',{},member,'GET')).status).toBe(403)}expect((await f.api.post('mastermind-thought-reading/read-result',{id:prompt.id},'player')).status).toBe(403);
 })
 }finally{dispose()}
})

it('actual Page delegates an issued thought pool to its canonical PC owner even on an enemy token',async()=>{
 const dispose=install();try{const f=await setup(true,'enemy-pc-thought-pool'),maps=await f.api.read('maps');expect(maps.maps[0].tokens.find((t:any)=>t.id==='owner-token').type).toBe('enemy');
 const original=await prepareMastermindThoughtReadingOriginal(f.action.id,f.host),prompt=(await listMastermindThoughtPrompts(f.ownerGateway))[0];await answerMastermindThoughtReading(prompt.id,'present-false-thoughts','私有思想。',f.ownerGateway);const issued=await issueMastermindThoughtContestRolls(original!,f.host),requestId=issued.find(r=>r.role==='owner')!.requestId;
 const physical=await realOwnedThoughtPool(f,requestId,'owner');expect(physical.values).toEqual([7]);expect(physical.events).toHaveLength(1);expect(physical.events[0].targetCharacterId).toBe(f.owner.id);const row=(await f.api.read('mastermind-thought-readings')).parents[prompt.id].rollRequests.owner;expect(row.raw.memberId).toBe('player');expect(row.raw.values).toEqual([7]);expect(row.confirmed).toBeUndefined();expect((await f.api.post('mastermind-thought-reading/confirm',{id:prompt.id,role:'owner',requestId,values:[1]},'dm')).status).toBe(200);const done=(await f.api.read('mastermind-thought-readings')).parents[prompt.id].rollRequests.owner;expect(done.raw.values).toEqual([7]);expect(done.confirmed.values).toEqual([1]);expect(await f.api.read('player-action-ack')).toBeNull();
 }finally{dispose()}
})

it.each(['map','token','character','count','sides','unissued','non-host','host-owned']as const)('issued thought controller routing rejects foreign pools and retains actual Host raw (%s)',async mode=>{
 const dispose=install();let session:ReturnType<typeof vi.spyOn>|undefined;try{const f=await setup(true,'exact-thought-route-'+mode);if(mode==='host-owned'){const chars=await f.api.read('characters');chars.characters.find((c:any)=>c.id===f.owner.id).roomMemberId='dm';expect((await f.api.post('characters',chars,'dm','PUT')).status).toBe(200)}
 const original=await prepareMastermindThoughtReadingOriginal(f.action.id,f.host),owner=mode==='host-owned'?f.host:f.ownerGateway,prompt=(await listMastermindThoughtPrompts(owner))[0];await answerMastermindThoughtReading(prompt.id,'present-false-thoughts','私有思想。',owner);const issued=await issueMastermindThoughtContestRolls(original!,f.host),requestId=issued.find(r=>r.role==='owner')!.requestId,before=await f.api.read('mastermind-thought-readings'),api=<T>(operation:any,input:unknown)=>f.host.request<T>(operation,input),input={requestId,mapId:f.action.mapId,rollerTokenId:'owner-token',rollerCharacterId:f.owner.id,count:1,sides:20};
 session=vi.spyOn(continuationRoomSession,'getRoomSession').mockReturnValue({roomId:'room',memberId:mode==='non-host'?'player':'dm',role:mode==='non-host'?'player':'dm'} as any);
 if(mode==='host-owned'){expect(await readMastermindThoughtPlayerDiceOwner(input,api)).toEqual({characterId:f.owner.id,memberId:'dm',hostMemberId:'dm'});session.mockRestore();session=undefined;const physical=await realOwnedThoughtPool(f,requestId,'owner');expect(physical.events).toEqual([]);expect(physical.values).toEqual([7]);session=vi.spyOn(continuationRoomSession,'getRoomSession').mockReturnValue({roomId:'room',memberId:'dm',role:'dm'}as any);await lockMastermindThoughtRawBeforeConfirmation({requestId,rollerTokenId:'owner-token',sides:20,values:physical.values},api);const row=(await f.api.read('mastermind-thought-readings')).parents[prompt.id].rollRequests.owner;expect(row.raw.memberId).toBe('dm');expect(row.raw.values).toEqual([7]);expect(row.confirmed).toBeUndefined();return}
 if(mode==='map')input.mapId='foreign';if(mode==='token')input.rollerTokenId='reader-token';if(mode==='character')input.rollerCharacterId=f.reader.id;if(mode==='count')input.count=2;if(mode==='sides')input.sides=6;if(mode==='unissued')input.requestId=prompt.id+':missing';
 await expect(readMastermindThoughtPlayerDiceOwner(input,api)).rejects.toThrow();expect(await f.api.read('mastermind-thought-readings')).toEqual(before);expect(await f.api.read('player-action-ack')).toBeNull();
 const called=vi.fn(),ordinaryApi:typeof api=(operation,input)=>{called();return api(operation,input)};expect(await readMastermindThoughtPlayerDiceOwner({...input,requestId:'ordinary-unrelated-roll'},ordinaryApi)).toBeUndefined();expect(called).not.toHaveBeenCalled();
 }finally{session?.mockRestore();dispose()}
})

/** This is the exact current generic Page statement, not a copied comparator or
 * a payload normalizer. The absence of any willing declaration is asserted. */
async function actualPageWillingPreflight(prepared:Parameters<Parameters<typeof withMastermindThoughtContinuationProduction>[2]>[0],original:object|undefined){
 const parsed=ts.createSourceFile('actual-willing-page.tsx',willingPageSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),candidates:ts.IfStatement[]=[]
 function visit(node:ts.Node){if(ts.isIfStatement(node)&&node.thenStatement.getText(parsed).includes('Discard caller-supplied consent; only the target controller can grant it.'))candidates.push(node);ts.forEachChild(node,visit)}visit(parsed);const statement=candidates.sort((a,b)=>a.getText(parsed).length-b.getText(parsed).length)[0];if(!statement)throw Error('Actual generic Page willing collector statement missing')
 const activity=getRegisteredDnd5eActivity(prepared.headlessAction.pluginId,prepared.headlessAction.actionId)??dnd5ePluginGrantedActivityDefinitionV1(prepared.feature.id);if(!activity)throw Error('Actual granted activity missing');expect(activity.target.kind).toBe('creature');expect(activity.checks?.some(c=>c.kind==='saving-throw'&&c.allowWillingFailure)??false).toBe(false)
 const requests=vi.fn(async()=>{throw Error('This actual source does not authorize a willing target question')}),js=ts.transpileModule('(async()=>{'+statement.getText(parsed)+'})()',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
 await vm.runInNewContext(js,{resolvePreparedDnd5eSpellCast,resolvePreparedDnd5eMonsterAttack,prepared:{ok:true,prepared},activity,thoughtContinuationOriginal:original,authoritativePayload:prepared.headlessAction.payload,dnd5eActivityChoicesFromPayload,characters:prepared.characters,isDiceCharacterOwnedByCurrentDm,getRoomSession:()=>({roomId:'room',memberId:'dm',role:'dm'}),requestSharedChoiceWindow:requests,acknowledgePlayerAction:()=>{throw Error('Unexpected rejected target')},completePlayerActionRequest:()=>{throw Error('Unexpected completed target')},console,Promise})
 expect(requests).not.toHaveBeenCalled()
}
it.each(['ordinary-default','forged-willing-claim']as const)('actual willing collector keeps ordinary semantics and cannot turn a caller claim into continuation authority (%s)',async mode=>{
 const dispose=install();try{const f=await setupAuthenticatedContinuation('surface'),original=(await prepareMastermindThoughtContinuationOriginal(f.action.id,f.host))!,prompt=(await listMastermindThoughtPrompts(f.ownerGateway)).find(p=>p.id!==f.initialId)!;await answerMastermindThoughtReading(prompt.id,'allow-real-thoughts',undefined,f.ownerGateway);const before=await f.api.read('characters');
 await withMastermindThoughtContinuationProduction(original,f.host,async(prepared,resolve)=>{if(mode==='forged-willing-claim')prepared.headlessAction.payload={...(prepared.headlessAction.payload as Record<string,unknown>),activityWillingTargetIds:['owner-token']};await actualPageWillingPreflight(prepared,mode==='ordinary-default'?undefined:original);expect((prepared.headlessAction.payload as Record<string,unknown>).activityWillingTargetIds).toEqual([]);if(mode==='forged-willing-claim')await expect(resolve({prepared,rolls:{},interruptChoiceId:'dm-apply'})).rejects.toThrow('same-issued-prepared-required')});
 expect(await f.api.read('characters')).toEqual(before);expect((await f.api.read('player-action-ack')).actionId).not.toBe(f.action.id);expect((await f.api.read('mastermind-thought-readings')).parents[prompt.id].phase).toBe('answered')
 }finally{dispose()}
})


/** Execute the real Page final Base statement as well as the real facade. This
 * deliberately includes its UI snapshot rebuild, which the old fixture missed. */
async function actualContinuationBaseTail(f:{api:{read:(name:string)=>Promise<any>};action:SharedPlayerActionState;host:MastermindThoughtGateway},original:object,prepared:Parameters<Parameters<typeof withMastermindThoughtContinuationProduction>[2]>[0],native:Awaited<ReturnType<typeof import('../../rulesets/dnd5e/pluginFeatureAction').resolvePreparedDnd5ePluginFeatureAction>>){
 const file=ts.createSourceFile('actual-base-page.tsx',willingPageSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes:ts.IfStatement[]=[];
 function visit(n:ts.Node){if(ts.isIfStatement(n)&&n.getText(file).includes('resolved.result.state = following.result.state')&&n.getText(file).includes('const following = await settleDnd5eConcentrationChecks'))nodes.push(n);ts.forEachChild(n,visit)}visit(file);const statement=nodes.sort((a,b)=>a.getText(file).length-b.getText(file).length)[0];if(!statement)throw Error('Actual Page final Base statement missing');
 const combat=await f.api.read('combat'),maps=await f.api.read('maps');let completed:Awaited<ReturnType<typeof settleDnd5eConcentrationChecks>>|undefined;const calls=vi.fn(async(input:Parameters<typeof settleDnd5eConcentrationChecks>[0])=>{completed=await settleDnd5eConcentrationChecks(input);return completed});
 const body='(async()=>{let resolved=inputNative,pluginApplication=inputNative.application,thoughtContinuationCompleted;const settledPluginFeatureEvents=[...inputNative.result.events];'+statement.getText(file)+';return {native:resolved,application:pluginApplication,completion:thoughtContinuationCompleted}})()';
 const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const tail=await vm.runInNewContext(js,{resolvePreparedDnd5eSpellCast,resolvePreparedDnd5eMonsterAttack,featureMagicOriginal:undefined,nativeFeatureMagicOriginal:undefined,inputNative:native,prepared:{ok:true,prepared},thoughtContinuationOriginal:original,thoughtContinuationGateway:f.host,completeMastermindThoughtContinuationBase,readMastermindThoughtContinuationNativeResolution,readMastermindThoughtContinuationResolved,cloneDnd5eHostTransactionInput,createDnd5eMapCombatSnapshot,useMapStore:{getState:()=>({maps:maps.maps})},readBrowserSceneWorldMinute:()=>480,action:f.action,liveRound:combat.round,initiativeOrderRef:{current:combat.initiativeOrder},settleDnd5eConcentrationChecks:calls,requestOptionalDamageSave:no,rollDnd5eUnsupportedAirborneFalls:no,settleDnd5eMapMountedBalance:(input:any,result:any)=>settleDnd5eMountedBalanceCheckpoint({...input,before:input.state,result,isCurrent:()=>true,save:no,reaction:no,landing:no,damage:no}),rollDiceBoxD20:no,rollDiceBoxValues:no,requestSharedHellishRebukeChoice:no,collectSharedSpellDamageDieChoices:no,requestDnd5eSavingThrowRerollDice:no,requestDnd5eBardicInspirationRoll:no,requestDnd5eOptionalBonusDieUse:no,requestDnd5eDarkOnesOwnLuckRoll:no,console,Promise});
 if(!completed)throw Error('Actual Base was not called');return{...tail,completed,baseCalls:calls.mock.calls.length};
}

async function actualContinuationPublication(bindings:Record<string,unknown>):Promise<Awaited<ReturnType<typeof prepareMastermindThoughtPublication>>>{
 const file=ts.createSourceFile('actual-publication.tsx',willingPageSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression:string|undefined;function visit(n:ts.Node){if(ts.isVariableDeclaration(n)&&n.name.getText(file)==='thoughtContinuationPublication')expression=n.initializer?.getText(file);ts.forEachChild(n,visit)}visit(file);if(!expression)throw Error('Actual continuation publication missing');const js=ts.transpileModule('(async()=>('+expression+'))()',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return vm.runInNewContext(js,{resolvePreparedDnd5eSpellCast,resolvePreparedDnd5eMonsterAttack,...bindings,console,Promise});
}


async function setupNativeThought(parentId:string,readerInsightExpertise=false,hostOwner=false){
 const f=readingFixture(17,parentId);if(readerInsightExpertise){for(let level=1;level<=2;level++){const plan=buildDnd5eLevelAdvancementPlan(f.reader,'rogue',1)!;const selections=Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,[...r.currentSelections,...['insight','thievesTools',...r.options.map(o=>o.id)].filter((id,index,all)=>all.indexOf(id)===index&&r.options.some(o=>o.id===id)&&!r.currentSelections.includes(id))].slice(0,r.targetLimit)]));const next=applyDnd5eLevelAdvancement(f.reader,{schemaVersion:1,classId:'rogue',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:[],classChoiceSelections:selections});expect(next.ok,JSON.stringify({result:next,requirements:plan.choiceRequirements})).toBe(true);if(!next.ok)throw Error(next.reason);f.reader=next.character}}const reader=f.reader,owner=hostOwner?{...f.owner}:{...f.owner,roomId:'room',roomMemberId:'player'},action:SharedPlayerActionState={...f.action,sourceMode:'dm',roomMemberId:'dm'},order=[...f.ready.map.tokens].sort((a,b)=>Number(b.id==='reader-token')-Number(a.id==='reader-token')).map((t,i)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i})),api=await createNativeEnvelopeApi({characters:{characters:[reader,owner],selectedId:reader.id},maps:{maps:[f.ready.map],selectedId:f.ready.map.id},combat:{active:true,mapId:f.ready.map.id,combatId:'reading-combat',round:1,initiativeIndex:0,initiativeOrder:order,dnd5eTurnEconomyByToken:Object.fromEntries(order.map(row=>[row.tokenId,createDnd5eTurnEconomyCounts('reading-combat:1:'+row.tokenId)]))}})
 const gateway=(member:'dm'|'player'|'reader'):MastermindThoughtGateway=>({session:()=>({roomId:'room',memberId:member,role:member==='dm'?'dm':'player'}),loadResource:api.read,request:async(operation,input)=>{const r=await api.post('mastermind-thought-reading/'+operation,input,member);if(r.status!==200)throw Error('native-real-http:'+r.status+':'+r.payload.error);return r.payload}})
 return{...f,reader,owner,action,api,host:gateway('dm'),ownerGateway:gateway(hostOwner?'dm':'player'),save:{...gateway('dm'),saveResourcesAtomically:(...args:Parameters<typeof import('../../lib/sharedApi').saveSharedResourcesAtomically>)=>api.gateway.saveResourcesAtomically([...args[0]],args[1])}}
}
async function actualNativePublicationBranch(bindings:Record<string,unknown>){
 const f=ts.createSourceFile('actual.tsx',actualMapsSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found:string|undefined;function visit(n:ts.Node){if(ts.isIfStatement(n)&&n.expression.getText(f)==='hostThoughtOriginal'&&n.thenStatement.getText(f).includes('prepareMastermindNativeThoughtPublication'))found=n.getText(f);ts.forEachChild(n,visit)}visit(f);if(!found)throw Error('Actual native publication branch missing');const js=ts.transpileModule('(async()=>{'+found+'})()',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return vm.runInNewContext(js,{resolvePreparedDnd5eSpellCast,resolvePreparedDnd5eMonsterAttack,...bindings,console,Promise})
}
async function actualNativeReadingBoundary(f:Awaited<ReturnType<typeof setupNativeThought>>){
 const id='dm-adjudication:'+f.action.id+':activity',mapId=f.action.mapId,put=async(flowPause:unknown)=>{const combat=await f.api.read('combat');expect((await f.api.post('combat',{...combat,flowPause,updatedAt:Date.now()},'dm','PUT')).status).toBe(200)}
 await put({schemaVersion:1,reason:'dm-adjudication',phase:'adjudicating',pausedAt:1,interruptId:id})
 const interrupt={id,mapId,transactionId:f.action.id,kind:'dm-adjudication',status:'pending',phase:'before-action',timeoutPolicy:'wait-for-dm',actorCharId:f.reader.id,targetCharId:f.owner.id,payload:{contextKind:'activity-boundary',actionId:f.action.id,casterTokenId:'reader-token',spellId:'detect-thoughts'},createdAt:1,updatedAt:1}
 expect((await f.api.post('combat-interrupts/interrupt',{operation:'upsert',mapId,interrupt},'dm','PATCH')).status).toBe(200)
 const answer={operation:'answer',mapId,id,response:{decision:'approved',effects:[]}};expect((await f.api.post('combat-interrupts/interrupt',answer,'player','PATCH')).status).toBe(403);expect((await f.api.post('combat-interrupts/interrupt',answer,'dm','PATCH')).status).toBe(200);expect((await f.api.post('combat-interrupts/interrupt',{operation:'finish',mapId,id},'dm','PATCH')).status).toBe(200)
 await put({schemaVersion:1,reason:'dm-adjudication',phase:'awaiting-resume',pausedAt:1,resolvedAt:2,interruptId:id});await put(undefined)
}
it.each(['deny','allow','false-win','false-lose','lost-reply','clock-stale','geometry-stale','host-owner-deny','host-owner-false-win']as const)('native Host original uses real consent, native Base and one no-PC-ACK HTTP CAS (%s)',async scenario=>{const hostOwner=scenario.startsWith('host-owner-'),mode=scenario.replace('host-owner-','');
 const dispose=install();try{const f=await setupNativeThought('native-original-'+scenario,mode==='false-lose',hostOwner),before=await f.api.read('characters');expect(f.reader.roomId).toBeUndefined();expect(f.reader.roomMemberId).toBeUndefined();expect(await f.api.read('player-action-requests')).toBeNull()
 const capturedDispatch:SharedPlayerActionState[]=[];const castingStates:boolean[]=[];const start=actual<(reader:string,owner:string)=>Promise<void>>('startMastermindNativeThoughtCast',{isDM:true,activeMap:f.ready.map,nativeThoughtCastingRef:{current:false},pendingPlayerActionRef:{current:null},setNativeThoughtCasting:(value:boolean)=>castingStates.push(value),loadSharedResource:f.host.loadResource,requestSharedMastermindThoughtReading:f.host.request,getRoomSession:f.host.session,issueMastermindNativeThoughtDispatch,processPlayerActionRequest:async(action:SharedPlayerActionState)=>{capturedDispatch.push(action)},showCombatNotice:no});await start(f.action.actorTokenId!,f.action.targetTokenId!);expect(castingStates).toEqual([true,false]);if(capturedDispatch.length!==1)throw Error('Actual Page native producer did not dispatch exactly once');const dispatch=capturedDispatch[0]!;f.action=dispatch;expect(isMastermindNativeThoughtDispatch(dispatch)).toBe(true);expect(await readMastermindNativeThoughtDispatch(JSON.parse(JSON.stringify(dispatch)),f.host)).toBeUndefined();let original=(await readMastermindNativeThoughtDispatch(dispatch,f.host))!,prompt=(await listMastermindThoughtPrompts(f.ownerGateway))[0],choice:Parameters<typeof answerMastermindThoughtReading>[1]=mode==='deny'?'deny':mode.startsWith('false')?'present-false-thoughts':'allow-real-thoughts';expect(original).toBeDefined();expect(await prepareMastermindThoughtNativeOriginal(f.action,f.host)).toBeDefined();await expect(issueMastermindNativeThoughtDispatch({id:'another-live:'+f.action.id,mapId:f.action.mapId,readerTokenId:f.action.actorTokenId!,ownerTokenId:f.action.targetTokenId!},f.host)).rejects.toThrow('native-parent-pending')
 await answerMastermindThoughtReading(prompt.id,choice,choice==='present-false-thoughts'?'仅有认证 owner 提交的虚假思想。':undefined,f.ownerGateway)
 if(choice==='present-false-thoughts')for(const request of await issueMastermindThoughtContestRolls(original,f.host)){
  const right=request.role==='owner'&&!hostOwner?'player':'dm',wrong=right==='dm'?'player':'dm',beforeRaw=await f.api.read('mastermind-thought-readings');expect((await f.api.post('mastermind-thought-reading/raw',{id:prompt.id,role:request.role,requestId:request.requestId,values:[2]},wrong)).status).toBe(403);expect(await f.api.read('mastermind-thought-readings')).toEqual(beforeRaw)
  expect((await f.api.post('mastermind-thought-reading/raw',{id:prompt.id,role:request.role,requestId:request.requestId,values:[request.role==='owner'?2:9]},right)).status).toBe(200);expect((await f.api.post('mastermind-thought-reading/confirm',{id:prompt.id,role:request.role,requestId:request.requestId,values:[request.role==='owner'?(mode==='false-lose'?1:20):(mode==='false-lose'?20:1)]},'dm')).status).toBe(200)
 }
 let prefix=choice==='present-false-thoughts'?await prepareMastermindThoughtContestPrefix(original,f.host):undefined;if(prefix)expect((await inspectMastermindThoughtContest(original,prefix,f.host)).won).toBe(mode==='false-win');await actualNativeReadingBoundary(f);const fresh=await restoreMastermindNativeThoughtDispatch(f.action.id,f.host);expect(fresh).not.toBe(dispatch);original=(await readMastermindNativeThoughtDispatch(fresh,f.host))!;prefix=choice==='present-false-thoughts'?await prepareMastermindThoughtContestPrefix(original,f.host):undefined;expect(await listMastermindNativeThoughtDispatches(f.action.mapId,f.host)).toMatchObject([{parentId:f.action.id}]);
 await withMastermindThoughtProduction(original,prefix,f.host,async(pluginCast,thoughtNativeResolver)=>{
  const stores={maps:[pluginCast.map],characters:pluginCast.characters},base={pluginCast,thoughtNativeResolver,currentLongCastingCombatState:undefined,useMapStore:{getState:()=>({maps:stores.maps})},useCharacterStore:{getState:()=>({characters:stores.characters})},preparedPluginSpellRolls:{activityRolls:{},activityInterruptChoiceId:'dm-apply'},sourceSlotSpellHealingTargets:undefined,activityInterruptChoiceId:'dm-apply',runtimeNow:()=>Date.now()}
  const facade=actual<(r:typeof thoughtNativeResolver,i:Parameters<typeof thoughtNativeResolver>[0],m:typeof pluginCast.map)=>Promise<ReturnType<typeof thoughtNativeResolver>>>('resolveDnd5eFacadeWithAirborneFalls',{getRoomSession:()=>({role:'dm'}),activeInterruptTransactionIdRef:{current:f.action.id},secondChancePreparedAdapterId,resolvePreparedDnd5eEquipmentAttack,resolveDnd5ePreparedWithMaterialDamageReactions,damageReactionOptionsForMap:()=>({authorityUnchanged:()=>true,charactersByCombatantId:Object.fromEntries(Object.entries(pluginCast.characterIdByCombatantId).map(([id,cid])=>[id,pluginCast.characters.find(c=>c.id===cid)]))}),previewDnd5eMountedBalance,rollDiceBoxD20:no,rollDiceBoxValues:no})
  const native=await actual<Promise<ReturnType<typeof thoughtNativeResolver>>>('resolvedPluginSpell',{...base,magicTruthOriginal:undefined,nativeMagicTruthOriginal:undefined,resolveDnd5eFacadeWithAirborneFalls:facade});if(!native.result.ok)throw Error('True native original failed');const noPorts=Object.fromEntries(['requestOptionalDamageSave','rollDnd5eUnsupportedAirborneFalls','settleDnd5eMapMountedBalance','rollDiceBoxD20','rollDiceBoxValues','requestSharedHellishRebukeChoice','collectSharedSpellDamageDieChoices','requestDnd5eSavingThrowRerollDice','requestDnd5eBardicInspirationRoll','requestDnd5eOptionalBonusDieUse','requestDnd5eDarkOnesOwnLuckRoll','requestSharedPostSpellRandomTableChoice','requestSharedPostSpellRandomTableAdjudication'].map(k=>[k,no]))
  const completed=await actual<Promise<{ok:false;reason:string}|{ok:true;settled:Awaited<ReturnType<typeof settleDnd5eConcentrationChecks>>}>>('pluginSettlement',{...base,...noPorts,resolvedPluginSpell:native,coordinateResolvedSpellSettlement,settleDnd5eConcentrationChecks,castingProximityReadyToCommit:()=>true});if(!completed.ok)throw Error(completed.reason)
  await expect(prepareMastermindNativeThoughtPublication(JSON.parse(JSON.stringify(native)),completed.settled,f.save,'不可授权的 JSON。')).rejects.toThrow('actual-native-result-required')
  await expect(prepareMastermindNativeThoughtPublication(native,JSON.parse(JSON.stringify(completed.settled)),f.save,'不可授权的 JSON。')).rejects.toThrow()
  const commits=vi.fn(async(...args:Parameters<typeof import('../../lib/sharedApi').saveSharedResourcesAtomically>)=>{const result=await f.api.gateway.saveResourcesAtomically([...args[0]],args[1]);if(mode==='lost-reply')throw Error('Lost true committed reply');return result}),gateway={...f.host,saveResourcesAtomically:commits},plan=await prepareMastermindNativeThoughtPublication(native,completed.settled,gateway,'仅主持人读者可见的真实思想。')
  if(mode==='clock-stale'||mode==='geometry-stale'){if(mode==='clock-stale')expect((await f.api.post('campaign-time/mutation',{operation:'advance-seconds',seconds:6},'dm','PATCH')).status).toBe(200);else expect((await f.api.post('map-geometry',{schemaVersion:3,maps:[],updatedAt:1},'dm','PUT')).status).toBe(200);const afterLegitimateWorldUpdate=await f.api.read('characters');await expect(publishMastermindNativeThought(plan)).rejects.toThrow();expect(await f.api.read('characters')).toEqual(afterLegitimateWorldUpdate);for(const character of before.characters){const current=afterLegitimateWorldUpdate.characters.find((c:any)=>c.id===character.id);expect(current.currentHp).toBe(character.currentHp);expect(current.classResources).toEqual(character.classResources)}expect((await f.api.read('mastermind-thought-readings')).parents[prompt.id].phase).toBe('answered');expect(commits).not.toHaveBeenCalled();const next=await issueMastermindNativeThoughtDispatch({id:'fresh-after-stale:'+f.action.id,mapId:f.action.mapId,readerTokenId:f.action.actorTokenId!,ownerTokenId:f.action.targetTokenId!},f.host);expect(next.id).not.toBe(f.action.id);expect((await f.api.read('mastermind-thought-readings')).parents[prompt.id].phase).toBe('answered');expect(commits).not.toHaveBeenCalled();return}
  await expect(publishMastermindNativeThought(JSON.parse(JSON.stringify(plan)))).rejects.toThrow('issued-fixed-plan-required');const reload=vi.fn(async()=>{await Promise.all(['characters','maps','combat'].map(name=>f.api.read(name)))});await actualNativePublicationBranch({hostThoughtOriginal:original,resolvedPluginSpell:native,settledPluginSpell:completed.settled,thoughtGateway:gateway,saveSharedResourcesAtomically:commits,activityAdjudicationNote:'仅主持人读者可见的真实思想。',prepareMastermindNativeThoughtPublication,publishMastermindNativeThought,reloadDnd5eAuthorityState:reload});expect(reload).toHaveBeenCalledTimes(1);expect(commits).toHaveBeenCalledTimes(1);const writes=commits.mock.calls[0][0];expect(writes.map(w=>w.name).sort()).toEqual(['characters','combat','maps','mastermind-thought-readings'].sort());expect(commits.mock.calls[0][1]?.readRevisions).toEqual({'campaign-time':0,'map-geometry':0})
  const final=await f.api.read('characters'),journal=await f.api.read('mastermind-thought-readings');expect(final.selectedId).toBe(before.selectedId);expect(final.characters.find((c:any)=>c.id===f.reader.id).classResources['dnd5e-spell-slot-2'].current).toBe(before.characters.find((c:any)=>c.id===f.reader.id).classResources['dnd5e-spell-slot-2'].current-1);for(const character of before.characters)expect(final.characters.find((c:any)=>c.id===character.id).currentHp).toBe(character.currentHp);expect((await f.api.read('combat')).dnd5eTurnEconomyByToken['reader-token'].action.current).toBe(0);expect(journal.parents[prompt.id].origin).toBe('native');expect(journal.parents[prompt.id].phase).toBe('published');expect(journal.parents[prompt.id].originalAction.sourceMode).toBe('dm');expect(journal.parents[prompt.id].versions.combat).toBe(1)
  for(const name of['player-action-requests','player-action-processed','player-action-ack'])expect(await f.api.read(name)).toBeNull()
  const own=await f.api.post('mastermind-thought-reading/read-result',{id:prompt.id},'dm');expect(own.status).toBe(200);expect(own.payload.result.kind).toBe(mode==='deny'||mode==='false-lose'?'unavailable':'thoughts');expect(own.payload.result.thoughts).toBe(mode==='false-win'?'仅有认证 owner 提交的虚假思想。':mode==='deny'||mode==='false-lose'?undefined:'仅主持人读者可见的真实思想。');expect(JSON.stringify(own.payload)).not.toContain('false-thoughts');expect((await f.api.post('mastermind-thought-reading/read-result',{id:prompt.id},'player')).status).toBe(403)
  await publishMastermindNativeThought(plan);expect(commits).toHaveBeenCalledTimes(1);for(const resource of['characters','maps','combat']){expect(JSON.stringify(await f.api.read(resource))).not.toContain('仅有认证 owner');expect(JSON.stringify(await f.api.read(resource))).not.toContain('仅主持人读者')}
 })
 }finally{dispose()}
})

it.each(['surface','probe']as const)('actual native Host source-granted %s requires a fresh owner answer and a no-PC original',async kind=>{
 const dispose=install();try{const f=await setupNativeThought('native-initial-for-'+kind),initial=await prepareMastermindThoughtNativeOriginal(f.action,f.host);if(!initial)throw Error('Actual native initial original required');let prompt=(await listMastermindThoughtPrompts(f.ownerGateway))[0];await answerMastermindThoughtReading(prompt.id,'allow-real-thoughts',undefined,f.ownerGateway);
 await withMastermindThoughtProduction(initial,undefined,f.host,async(prepared,resolve)=>{const native=resolve({prepared,rolls:{activityRolls:{},activityInterruptChoiceId:'dm-apply'}});if(!native.result.ok||!native.application)throw Error('Actual initial native Detect Thoughts required');const completed=await settleDnd5eConcentrationChecks({result:native.result,map:native.application.map,characters:native.application.characters,priorApplication:native.application,characterIdByCombatantId:prepared.characterIdByCombatantId,rollD20:no,rollD4:no,rollDice:no});await publishMastermindNativeThought(await prepareMastermindNativeThoughtPublication(native,completed,f.save,'合法初次思想。'))});
 for(let index=0;index<2;index++){const characters=await f.api.read('characters'),maps=await f.api.read('maps'),combat=await f.api.read('combat'),actorId=combat.initiativeOrder[combat.initiativeIndex].tokenId,actor=maps.maps[0].tokens.find((t:any)=>t.id===actorId),action:SharedPlayerActionState={id:'actual-native-turn-'+kind+'-'+index,type:'end-turn',status:'pending',sourceMode:'dm',mapId:maps.maps[0].id,combatId:combat.combatId,actorTokenId:actorId,characterId:actor.characterId,round:combat.round,initiativeIndex:combat.initiativeIndex,seq:index,updatedAt:1},ended=resolveDnd5ePlayerEndTurn({action,map:maps.maps[0],characters:characters.characters,initiativeOrder:combat.initiativeOrder,turnEconomy:combat.dnd5eTurnEconomyByToken?.[actorId]});if(!ended.ok||!ended.result.ok)throw Error('Genuine native turn transition required');const economies={...combat.dnd5eTurnEconomyByToken};for(const[id,unit]of Object.entries(ended.result.state.combatants)){const begun=ended.result.events.some(e=>e.type==='turn-started'&&e.actorId===id),previous=begun||!economies[id]?createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(ended.result.state,id),unit.speed):economies[id];economies[id]=projectDnd5eHeadlessTurnEconomy(previous,unit.turn,unit.speed)}await f.api.gateway.saveResourcesAtomically([{name:'characters',expectedRevision:characters._sync.revision,data:{...characters,characters:ended.application.characters}},{name:'maps',expectedRevision:maps._sync.revision,data:{...maps,maps:[ended.application.map]}},{name:'combat',expectedRevision:combat._sync.revision,data:{...combat,round:ended.result.state.round,initiativeIndex:ended.result.state.initiativeIndex,dnd5eTurnEconomyByToken:economies}}],{transactionId:action.id,readRevisions:{'campaign-time':0,'map-geometry':0}})}
 const characters=await f.api.read('characters'),maps=await f.api.read('maps'),reader=characters.characters.find((c:any)=>c.id===f.reader.id),control=playerMapGrantedActivityControls(maps.maps[0],reader).find(c=>c.activityId==='spell:detect-thoughts:'+kind);if(!control?.effectId)throw Error('Actual native spell-granted continuation control required');expect(reader.roomId).toBeUndefined();expect(reader.roomMemberId).toBeUndefined();const journal=await f.api.read('mastermind-thought-readings'),old=journal.parents[prompt.id],parentTransactionId='actual-native-continued-'+kind,versions=Object.fromEntries(await Promise.all(['characters','maps','combat','map-geometry','campaign-time'].map(async name=>[name,(await f.api.read(name))?._sync?.revision??0]))),input={id:'mastermind-thought-reading:'+dnd5eExecutionEventKey(parentTransactionId),parentTransactionId,mapId:maps.maps[0].id,readerTokenId:'reader-token',ownerTokenId:'owner-token',readerCharacterId:reader.id,ownerCharacterId:f.owner.id,featureId:old.featureId,sourceDefinitionSignature:old.sourceDefinitionSignature,versions,continuationKind:kind,activeEffectId:control.effectId};
 const before=await f.api.read('characters'),requests=await f.api.read('player-action-requests'),privateBefore=await f.api.read('mastermind-thought-readings');
 expect((await f.api.post('mastermind-thought-reading/begin-native',input,'reader')).status).toBe(403);
 expect((await f.api.post('mastermind-thought-reading/begin-native',{...input,id:input.id+':json',prepared:{}},'dm')).status).toBe(400);
 expect((await f.api.post('mastermind-thought-reading/begin-native',{...input,id:input.id+':wrong-effect',activeEffectId:control.effectId+':not-issued'},'dm')).status).toBe(409);
 expect(await f.api.read('mastermind-thought-readings')).toEqual(privateBefore);
 const response=await f.api.post('mastermind-thought-reading/begin-native',input,'dm');expect(response.status,JSON.stringify(response.payload)).toBe(200);
 expect(await f.api.read('player-action-requests')).toEqual(requests);expect(await f.api.read('characters')).toEqual(before);prompt=(await listMastermindThoughtPrompts(f.ownerGateway)).find(row=>row.id===input.id)!;expect(prompt).toMatchObject({phase:'waiting'});expect(prompt.id).not.toBe(old.id);expect((await f.api.read('mastermind-thought-readings')).parents[input.id].originalAction).toMatchObject({type:'dnd5e-plugin-action',sourceMode:'dm',roomMemberId:'dm',dnd5ePluginAction:{featureId:control.featureId,payload:{activeEffectId:control.effectId}}});
 const dispatched:SharedPlayerActionState[]=[],start=actual<(reader:string,owner:string,kind:'surface'|'probe',effect:string)=>Promise<void>>('startMastermindNativeThoughtContinuation',{isDM:true,activeMap:maps.maps[0],nativeThoughtCastingRef:{current:false},pendingPlayerActionRef:{current:null},setNativeThoughtCasting:()=>{},loadSharedResource:f.host.loadResource,requestSharedMastermindThoughtReading:f.host.request,getRoomSession:f.host.session,issueMastermindNativeThoughtContinuationDispatch:(intent:Parameters<typeof issueMastermindNativeThoughtContinuationDispatch>[0],gateway:MastermindThoughtGateway)=>issueMastermindNativeThoughtContinuationDispatch({...intent,id:parentTransactionId},gateway),processPlayerActionRequest:async(action:SharedPlayerActionState)=>{dispatched.push(action)},showCombatNotice:no});await start(input.readerTokenId,input.ownerTokenId,kind,control.effectId);expect(dispatched).toHaveLength(1);f.action=dispatched[0]!;expect(await readMastermindNativeThoughtContinuationDispatch(JSON.parse(JSON.stringify(f.action)),f.host)).toBeUndefined();const continuation=(await readMastermindNativeThoughtContinuationDispatch(f.action,f.host))!,issued=await readMastermindThoughtNativeContinuationIssuedOriginal(continuation,f.host);expect(issued.originalAction.type).toBe('dnd5e-plugin-action');expect(issued.originalAction.sourceMode).toBe('dm');await expect(readMastermindThoughtNativeContinuationIssuedOriginal(JSON.parse(JSON.stringify(continuation)),f.host)).rejects.toThrow('issued-native-original-required');
 expect((await f.api.post('mastermind-thought-reading/answer',{id:prompt.id,expectedRecordRevision:prompt.revision,choice:'allow-real-thoughts'},'dm')).status).toBe(403);await answerMastermindThoughtReading(prompt.id,kind==='surface'?'deny':'allow-real-thoughts',undefined,f.ownerGateway);
 const freshAction=await restoreMastermindNativeThoughtContinuationDispatch(parentTransactionId,f.host);if(!freshAction)throw Error('Actual restored dispatch required');f.action=freshAction;const fresh=(await readMastermindNativeThoughtContinuationDispatch(freshAction,f.host))!;expect(fresh).not.toBe(continuation);
 await withMastermindThoughtContinuationProduction(fresh,f.host,async(prepared,resolve)=>{await actualPageWillingPreflight(prepared,fresh);const facade=actual<(r:typeof resolve,i:Parameters<typeof resolve>[0],m:typeof prepared.map)=>Promise<Awaited<ReturnType<typeof resolve>>>>('resolveDnd5eFacadeWithAirborneFalls',{getRoomSession:()=>({role:'dm'}),activeInterruptTransactionIdRef:{current:f.action.id},secondChancePreparedAdapterId,resolvePreparedDnd5eEquipmentAttack,resolveDnd5ePreparedWithMaterialDamageReactions,damageReactionOptionsForMap:()=>({authorityUnchanged:()=>true,charactersByCombatantId:Object.fromEntries(Object.entries(prepared.characterIdByCombatantId).map(([id,cid])=>[id,prepared.characters.find(c=>c.id===cid)]))}),previewDnd5eMountedBalance,rollDiceBoxD20:no,rollDiceBoxValues:no}),actualResolver=actual<()=>ReturnType<typeof resolve>>('resolveFeatureWithInterruptions',{resolveDnd5eFacadeWithAirborneFalls:facade,thoughtContinuationResolver:resolve,featureMagicOriginal:undefined,nativeFeatureMagicOriginal:undefined,getSharedResourceRevisionWatermark:()=>0,prepared:{ok:true,prepared},pluginRolls:kind==='probe'?{'detect-thoughts-probe-save-d20:owner-token':{values:[1],modifier:0,total:1}}:{},featureNegationDice:undefined,featureEffectRollDice:{},restResolutionClock:undefined,restCommitRevisions:undefined,authoritativePayload:undefined,pluginChoiceId:'dm-apply',summonInitiativeD20:undefined,resolveDnd5eDamageBoundaryWithMaterials,featureDamageOptions:{authorityUnchanged:()=>true,charactersByCombatantId:Object.fromEntries(Object.entries(prepared.characterIdByCombatantId).map(([id,cid])=>[id,prepared.characters.find(c=>c.id===cid)]))}}),native=await actualResolver();expect(native.result.ok).toBe(true);if(!native.result.ok||!native.application)throw Error('Real source-granted native materialization required');const raw=readMastermindThoughtContinuationNativeResolution(native);await expect(prepareMastermindNativeThoughtContinuationPublication(raw,f.save,'未经Base的文本。')).rejects.toThrow('actual-native-base-required');const tail=await actualContinuationBaseTail(f,fresh,prepared,native),complete=tail.completion;expect(tail.baseCalls).toBe(1);await expect(readMastermindThoughtNativeContinuationCompleted(JSON.parse(JSON.stringify(complete)),f.host)).rejects.toThrow('actual-native-base-required');const count=f.api.gateway.saveResourcesAtomically.mock.calls.length,plan=await prepareMastermindNativeThoughtContinuationPublication(complete,f.save,'仅主持人读者的持续思想。');await expect(publishMastermindNativeThoughtContinuation(JSON.parse(JSON.stringify(plan)))).rejects.toThrow('issued-fixed-plan-required');const tree=ts.createSourceFile('actual-native-continuation.tsx',actualMapsSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let branch:string|undefined;function find(n:ts.Node){if(ts.isIfStatement(n)&&n.expression.getText(tree)==='hostThoughtContinuationOriginal'&&n.thenStatement.getText(tree).includes('prepareMastermindNativeThoughtContinuationPublication')){if(!n.parent||!ts.isBlock(n.parent))throw Error('Actual shared commit block required');const selected=n.parent.statements.filter(s=>s===n||(ts.isExpressionStatement(s)&&ts.isCallExpression(s.expression)&&s.expression.expression.getText(tree)==='applyCoordinatedDnd5eCombatResult'));if(selected.length!==2)throw Error('Actual common store commit and native branch required');branch=selected.map(s=>s.getText(tree)).join('\n')}ts.forEachChild(n,find)}find(tree);if(!branch)throw Error('Actual native continuation final branch required');const prematureStore=vi.fn(()=>{const beforePromise=f.api.read('characters').then(async(doc:any)=>{doc.characters[0].name+=' premature-local-store';await f.api.gateway.saveResourcesAtomically([{name:'characters',data:doc,expectedRevision:doc._sync.revision}],{transactionId:'test-actual-store-autosave:'+kind})});return beforePromise});let autosave:Promise<unknown>=Promise.resolve();const js=ts.transpileModule('(async()=>{'+branch+'})()',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,reload=vi.fn();await vm.runInNewContext(js,{resolvePreparedDnd5eSpellCast,resolvePreparedDnd5eMonsterAttack,pluginApplication:native.application,authorityMap:prepared.map,applyDnd5eCombatCharacterUpdate:()=>{},applyAuthorityTokenUpdate:()=>{},applyAuthorityMapUpdate:()=>{},applyCoordinatedDnd5eCombatResult:()=>{autosave=prematureStore()},hostThoughtContinuationOriginal:fresh,thoughtContinuationCompleted:complete,thoughtContinuationGateway:f.host,saveSharedResourcesAtomically:f.save.saveResourcesAtomically,thoughtContinuationDecision:{thoughts:'仅主持人读者的持续思想。'},prepareMastermindNativeThoughtContinuationPublication:async(...args:Parameters<typeof prepareMastermindNativeThoughtContinuationPublication>)=>{await autosave;return prepareMastermindNativeThoughtContinuationPublication(...args)},publishMastermindNativeThoughtContinuation,reloadDnd5eAuthorityState:reload,console,Promise});expect(prematureStore).not.toHaveBeenCalled();expect(reload).toHaveBeenCalledTimes(1);await publishMastermindNativeThoughtContinuation(plan);expect(f.api.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(count+1);expect(f.api.gateway.saveResourcesAtomically.mock.calls.at(-1)![0].map((w:any)=>w.name).sort()).toEqual(['characters','maps','combat','mastermind-thought-readings'].sort());
 const after=await f.api.read('characters'),published=await f.api.read('mastermind-thought-readings');for(const character of before.characters){const current=after.characters.find((c:any)=>c.id===character.id);expect(current.currentHp).toBe(character.currentHp);expect(current.classResources).toEqual(character.classResources)}expect(published.parents[input.id].phase).toBe('published');expect(published.parents[input.id].result.kind).toBe(kind==='surface'?'blocked':'real-consent');expect((await f.api.read('combat')).dnd5eTurnEconomyByToken['reader-token'].action.current).toBe(0);for(const name of['player-action-requests','player-action-processed','player-action-ack'])expect(await f.api.read(name)).toEqual(name==='player-action-requests'?requests:null);const result=await f.api.post('mastermind-thought-reading/read-result',{id:input.id},'dm');expect(result.status).toBe(200);expect(result.payload.result.kind).toBe(kind==='surface'?'unavailable':'thoughts');expect(result.payload.result.thoughts).toBe(kind==='surface'?undefined:'仅主持人读者的持续思想。');expect((await f.api.post('mastermind-thought-reading/read-result',{id:input.id},'player')).status).toBe(403);for(const name of['characters','maps','combat'])expect(JSON.stringify(await f.api.read(name))).not.toContain('仅主持人读者的持续思想。');
 })

 }finally{dispose()}
})

const truthTestNamespace='test.mastermind-magic-truth',truthTestSpell=truthTestNamespace+':truth-assay'
function magicTruthDiagnosticBundle(){const automation=automationCapabilityFromLegacyStatus('full');return{format:'dndstars5e-unified-content',schemaVersion:1,manifest:{id:truthTestNamespace,name:'Custom magical truth adjudication diagnostic',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Local test',license:'CC0',distributionPolicy:'local-only',contentCategory:'mixed'},assets:[],definitions:[{schemaVersion:1,namespace:truthTestNamespace,version:'1.0.0',id:'truth-assay',kind:'spell',name:'Custom truth assay (not an official spell)',automation,payload:{id:'truth-assay',name:'Custom truth assay (not an official spell)',level:1,school:'divination',ritual:false,castingTime:{value:1,unit:'action'},range:{type:'distance',feet:30},targeting:{relation:'any',includeSelf:false,maximumTargets:1},components:{verbal:true,somatic:true,material:false},duration:{type:'instantaneous',concentration:false},classes:['wizard'],description:'Explicit custom registered test recipe for a DM-adjudicated magical determination. It is not an official source spell.',automation:{mode:'headless-action',actionId:'truth-assay'}},activities:[{schemaVersion:1,id:'truth-assay',name:'Custom truth assay',activation:{kind:'action'},target:{kind:'creature',relation:'any',count:1,rangeFeet:30},legacySource:{kind:'spell',id:'truth-assay',magical:true},automation,outcomes:[{id:'adjudicate',when:{kind:'always'},operations:[{id:'magic-truth',kind:'manual-adjudication',prompt:'DM determines the ordinary magical verdict for this statement.',reason:'Custom magic explicitly determines spoken truth; narrative facts remain a DM adjudication.',requiresDmApproval:true,purpose:'magical-truth-detection',target:'target'},{id:'ordinary-verdict-prompt',kind:'narrative-prompt',prompt:'This custom magic yields only its actual DM-adjudicated verdict for this statement.'}]}]}]}]} satisfies Dnd5eUnifiedContentBundleV1}
it.each(['ordinary','bad-purpose','bad-target']as const)('magical truth recipe keeps ordinary boundaries and rejects an unissued purpose shape (%s)',mode=>{const bundle=magicTruthDiagnosticBundle(),activity=structuredClone(bundle.definitions[0].activities![0]);const operation=activity.outcomes[0].operations[0]as unknown as Record<string,unknown>;if(mode==='ordinary'){delete operation.purpose;delete operation.target}else if(mode==='bad-purpose')operation.purpose='all-magical-checks';else operation.target='actor';const errors=validateDnd5eActivityDefinitionV1(activity);if(mode==='ordinary')expect(errors).toEqual([]);else expect(errors).not.toEqual([])})
it('magical truth recipe is genuinely registered, learned by native Wizard advancement and prepared at its actual manual boundary',()=>{const disposeMM=install(),bundle=magicTruthDiagnosticBundle();expect(validateDnd5eUnifiedContentBundleV1(bundle)).toEqual([]);const disposeMagic=registerDnd5eRulesPlugin({manifest:bundle.manifest,setup(api){const registration=registerDnd5eUnifiedContentPackageV1({packageId:truthTestNamespace,packageVersion:'1.0.0',definitions:bundle.definitions});try{api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(bundle.definitions[0].activities![0],{outerSpellTransaction:true}));api.registerSpell({...bundle.definitions[0].payload,automation:{mode:'headless-action',actionId:'truth-assay'}})}catch(error){registration.dispose();throw error}return registration.dispose}});try{const first=growWizard(16,'evocation',1),plan=buildDnd5eLevelAdvancementPlan(first,'wizard',1,'evocation')!,spell=plan.spellAdvancement!,before=first.dnd5eClassChoices!.classes!.wizard!.selections!,book=[...before['wizard-spellbook'],truthTestSpell,...spell.spellOptions.map(o=>o.id).filter(id=>id!==truthTestSpell&&!before['wizard-spellbook'].includes(id)).slice(0,1)];expect(spell.spellOptions.some(o=>o.id===truthTestSpell)).toBe(true);const next=applyDnd5eLevelAdvancement(first,{schemaVersion:1,classId:'wizard',subclassId:'evocation',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:[],spellSelections:{cantrips:before[spell.cantripSelectionKey],wizardSpellbook:book}});expect(next.ok,JSON.stringify(next)).toBe(true);if(!next.ok)throw Error(next.reason);const source=dnd5eEffectiveSpellcastingSources(next.character).find(s=>s.classId==='wizard')!;const reader={...next.character,...dnd5ePatchEffectiveSpellSelections(next.character,source,{...next.character.dnd5eClassChoices!.classes!.wizard!.selections!,'spell-prepared':[truthTestSpell]})};expect(reader.dnd5eClassLevels?.wizard).toBe(2);const f=readingFixture(17,'actual-custom-magic-truth-parent'),action={...f.action,dnd5eSpellCast:{spellId:truthTestSpell,castingClassId:'wizard',slotLevel:1,targetTokenId:'owner-token'}}as const,prepared=prepareDnd5ePluginSpellCast({action,map:f.ready.map,characters:[reader,f.owner],initiativeOrder:f.ready.map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:"",color:"",roll:20-i}))});expect(prepared.ok,prepared.ok?'':prepared.reason).toBe(true);if(!prepared.ok)throw Error(prepared.reason);expect(prepared.prepared.activity?.legacySource?.magical).toBe(true);const operations=dnd5eActivityManualAdjudicationOperationsV1(prepared.prepared.activity!);expect(operations).toHaveLength(1);expect(operations[0]).toMatchObject({purpose:'magical-truth-detection',target:'target'});const saved=structuredClone(reader.classResources),pending=resolvePreparedDnd5ePluginSpellCast({prepared:prepared.prepared,rolls:{activityRolls:{}}});expect(pending.result).toMatchObject({ok:false,reason:'dm-adjudication-pending'});expect(pending.application).toBeUndefined();expect(reader.classResources).toEqual(saved)}finally{disposeMagic();disposeMM()}})

async function withActualMagicTruth(level:number,operation:(f:{prepared:PreparedDnd5ePluginSpellCast;unregisterSource:()=>void;registerSource:()=>()=>void;unregisterOwner:()=>void;registerOwner:()=>()=>void})=>Promise<void>){const disposeMM=install(),bundle=magicTruthDiagnosticBundle();expect(validateDnd5eUnifiedContentBundleV1(bundle)).toEqual([]);const registerSource=()=>registerDnd5eRulesPlugin({manifest:bundle.manifest,setup(api){const registration=registerDnd5eUnifiedContentPackageV1({packageId:truthTestNamespace,packageVersion:'1.0.0',definitions:bundle.definitions});try{api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(bundle.definitions[0].activities![0],{outerSpellTransaction:true}));api.registerSpell({...bundle.definitions[0].payload,automation:{mode:'headless-action',actionId:'truth-assay'}})}catch(error){registration.dispose();throw error}return registration.dispose}});const disposeMagic=registerSource();try{const first=growWizard(16,'evocation',1),plan=buildDnd5eLevelAdvancementPlan(first,'wizard',1,'evocation')!,spell=plan.spellAdvancement!,before=first.dnd5eClassChoices!.classes!.wizard!.selections!,book=[...before['wizard-spellbook'],truthTestSpell,...spell.spellOptions.map(o=>o.id).filter(id=>id!==truthTestSpell&&!before['wizard-spellbook'].includes(id)).slice(0,1)];expect(spell.spellOptions.some(o=>o.id===truthTestSpell)).toBe(true);const next=applyDnd5eLevelAdvancement(first,{schemaVersion:1,classId:'wizard',subclassId:'evocation',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:[],spellSelections:{cantrips:before[spell.cantripSelectionKey],wizardSpellbook:book}});expect(next.ok,JSON.stringify(next)).toBe(true);if(!next.ok)throw Error(next.reason);const source=dnd5eEffectiveSpellcastingSources(next.character).find(s=>s.classId==='wizard')!;const reader={...next.character,...dnd5ePatchEffectiveSpellSelections(next.character,source,{...next.character.dnd5eClassChoices!.classes!.wizard!.selections!,'spell-prepared':[truthTestSpell]})};expect(reader.dnd5eClassLevels?.wizard).toBe(2);const f=readingFixture(level,'actual-custom-magic-truth-parent'),action={...f.action,dnd5eSpellCast:{spellId:truthTestSpell,castingClassId:'wizard',slotLevel:1,targetTokenId:'owner-token'}}as const,prepared=prepareDnd5ePluginSpellCast({action,map:f.ready.map,characters:[reader,f.owner],initiativeOrder:f.ready.map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:"",color:"",roll:20-i}))});expect(prepared.ok,prepared.ok?'':prepared.reason).toBe(true);if(!prepared.ok)throw Error(prepared.reason);expect(prepared.prepared.activity?.legacySource?.magical).toBe(true);const operations=dnd5eActivityManualAdjudicationOperationsV1(prepared.prepared.activity!);expect(operations).toHaveLength(1);expect(operations[0]).toMatchObject({purpose:'magical-truth-detection',target:'target'});return await operation({prepared:prepared.prepared,unregisterSource:disposeMagic,registerSource,unregisterOwner:disposeMM,registerOwner:install})}finally{disposeMagic();disposeMM()}}

it.each([true,false]as const)('magical truth recipe consumes its real native Soul17 appearance choice without adding a check, compulsion or reading grant (%s)',async chosen=>withActualMagicTruth(17,async f=>{const frame=captureDnd5eMagicTruthPreparedParent(f.prepared);expect(frame).toBeDefined();if(!frame)throw Error('Genuine native frame missing');expect(readDnd5eMagicTruthPreparedParent(frame)).toMatchObject({sourceKind:'spell',parentId:f.prepared.action.id,actorId:'reader-token',ownerId:'owner-token'});const before=structuredClone(f.prepared.characters),result=await withDnd5eMagicTruthSpellProduction(frame,chosen,async(prepared,resolve)=>resolve({prepared,rolls:{activityRolls:{},activityInterruptChoiceId:'dm-apply'}}));expect(result.result.ok).toBe(true);expect(result.application).toBeDefined();expect(result.result.events.some(e=>e.type==='activity-narrative-prompt'&&e.prompt==='这次魔法显现出目标所言真实的迹象。')).toBe(chosen);expect(result.result.events.some(e=>e.type==='ability-check-resolved')).toBe(false);const beforeSlot=f.prepared.actor.classResources?.['dnd5e-spell-slot-1'],afterSlot=result.application?.characters.find(c=>c.id===f.prepared.actor.id)?.classResources?.['dnd5e-spell-slot-1'];if(!beforeSlot||!afterSlot)throw Error('Actual native Wizard first-level slot required');expect(afterSlot.current).toBe(beforeSlot.current-1);expect(f.prepared.characters).toEqual(before);for(const owner of Object.values(result.result.state.combatants)){expect(owner.conditions).not.toContain('charmed');expect(owner.classState.activeEffects?.some(effect=>effect.legacyCondition==='truth-bound')).not.toBe(true)}}))
it('magical truth recipe preserves the ordinary actual manual result for a native level16 target',async()=>withActualMagicTruth(16,async f=>{expect(captureDnd5eMagicTruthPreparedParent(f.prepared)).toBeUndefined();const result=resolvePreparedDnd5ePluginSpellCast({prepared:f.prepared,rolls:{activityRolls:{},activityInterruptChoiceId:'dm-apply'}});expect(result.result.ok).toBe(true);expect(result.result.events.some(e=>e.type==='activity-narrative-prompt'&&e.prompt==='这次魔法显现出目标所言真实的迹象。')).toBe(false)}))
it.each(['JSON-prepared','fake-factory','JSON-frame','changed-prepared','changed-condition','changed-world','source-unregister-reinstall','owner-source-unregister-reinstall']as const)('magical truth recipe rejects %s with no native cost or verdict',async mode=>withActualMagicTruth(17,async f=>{const frame=captureDnd5eMagicTruthPreparedParent(f.prepared)!;expect(frame).toBeDefined();const before=structuredClone(f.prepared.characters);if(mode==='JSON-prepared')expect(()=>captureDnd5eMagicTruthPreparedParent(JSON.parse(JSON.stringify(f.prepared)))).toThrow('actual-prepared-parent-required');else if(mode==='fake-factory'){const fake=wrapDnd5eMagicTruthPreparedFactory(()=>({ok:true,prepared:JSON.parse(JSON.stringify(f.prepared))}));expect(()=>captureDnd5eMagicTruthPreparedParent(fake().prepared)).toThrow('actual-prepared-parent-required')}else if(mode==='JSON-frame')expect(()=>readDnd5eMagicTruthPreparedParent(JSON.parse(JSON.stringify(frame)))).toThrow('issued-parent-required');else if(mode==='source-unregister-reinstall'||mode==='owner-source-unregister-reinstall'){if(mode==='source-unregister-reinstall')f.unregisterSource();else f.unregisterOwner();expect(()=>readDnd5eMagicTruthPreparedParent(frame)).toThrow('original-or-source-changed');const dispose=mode==='source-unregister-reinstall'?f.registerSource():f.registerOwner();try{expect(()=>readDnd5eMagicTruthPreparedParent(frame)).toThrow('original-or-source-changed')}finally{dispose()}}else await expect(withDnd5eMagicTruthSpellProduction(frame,true,async(prepared,resolve)=>resolve({prepared:mode==='changed-prepared'?{...prepared,action:{...prepared.action,id:prepared.action.id+':not-original'}}:mode==='changed-condition'?{...prepared,state:{...prepared.state,combatants:{...prepared.state.combatants,'owner-token':{...prepared.state.combatants['owner-token'],conditions:[...prepared.state.combatants['owner-token'].conditions,'prone' as const]}}}}:prepared,...(mode==='changed-world'?{currentRoom:{maps:[{...prepared.map,name:prepared.map.name+':changed'}],characters:prepared.characters}}:{}),rolls:{activityRolls:{},activityInterruptChoiceId:'dm-apply'}}))).rejects.toThrow(mode==='changed-world'?'current-world-changed':'same-original-prepared-required');expect(f.prepared.characters).toEqual(before)}))

it.each(['truthful','ordinary','lost-reply','clock-stale','queue-stale','omit-private','source-lost','missing-clock','zero-clock','missing-clock-local480','missing-clock-stale','actual-noop-handoff']as const)('magical truth room binds a true queued Wizard recipe to only its authenticated Soul17 owner and original normal ACK (%s)',async mode=>withActualMagicTruth(17,async f=>{
 const reader={...f.prepared.actor,roomId:'room',roomMemberId:'reader'},owner={...f.prepared.characters.find(c=>c.id===f.prepared.characterIdByCombatantId['owner-token'])!,roomId:'room',roomMemberId:'player'},map=f.prepared.map,order=map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i})),action={...f.prepared.action,combatId:'magic-truth-combat',sourceMode:'player' as const,round:1,initiativeIndex:0};
 const api=await createNativeEnvelopeApi({...(mode==='zero-clock'?{'campaign-time':normalizeSharedCampaignTime({worldMinute:0})}:{}),characters:{characters:[reader,owner]},maps:{maps:[map]},combat:{active:true,mapId:map.id,combatId:action.combatId,round:1,initiativeIndex:0,initiativeOrder:order}});
  if(!mode.startsWith('missing-clock')&&mode!=='zero-clock')expect((await api.post('campaign-time/mutation',{operation:'advance-seconds',seconds:6},'dm','PATCH')).status).toBe(200);const actualClock=await api.read('campaign-time');if(mode.startsWith('missing-clock'))expect(actualClock).toBeNull();else if(mode==='zero-clock')expect(actualClock.worldMinute).toBe(0);else expect(actualClock.worldSecondRemainder).toBe(6);expect((await api.post('player-action-requests/append',{action},'reader')).status).toBe(200);const queue=await api.read('player-action-requests'),queued=queue.requests.find((row:SharedPlayerActionState)=>row.id===action.id);expect(queued.roomMemberId).toBe('reader');
 const canonicalCharacters=(await api.read('characters')).characters,canonicalMap=(await api.read('maps')).maps.find((m:BattleMap)=>m.id===map.id);if(!canonicalMap)throw Error('Actual queued spell map required');const primaryClockLoader=vi.fn(async(identity:Parameters<Parameters<typeof readActualPluginSpellPrimaryPrepareTime>[2]>[0])=>{const response=await api.post('bountiful-plugin-spell-saving-original/source',{...identity,poolKind:'primary'},'dm');if(response.status!==200)throw Error(String(response.payload.error));return response.payload}),retainedPrimaryPrepareTime=await readActualPluginSpellPrimaryPrepareTime(actualMapsSource,{action:queued,map:canonicalMap,spell:f.prepared.spell,castingSession:undefined},primaryClockLoader);expect(f.prepared.spell.automation).toMatchObject({mode:'headless-action',actionId:'truth-assay'});expect(retainedPrimaryPrepareTime).toBeUndefined();expect(primaryClockLoader).not.toHaveBeenCalled();const prepared=actual<ReturnType<typeof prepareDnd5ePluginSpellCast>>('preparedPluginSpell',{retainedPrimaryPrepareTime,castingSession:undefined,prepareDnd5eRandomTargetPluginSpellCast,selectRandomCreatureTarget:()=>{throw Error('No random-target source')},authorityMap:canonicalMap,readBrowserSceneWorldMinute:()=>mode==='missing-clock-local480'?480:actualClock?.worldMinute,pluginAuthorityAction:queued,liveRound:1,useMapStore:{getState:()=>({maps:[canonicalMap]})},useCharacterStore:{getState:()=>({characters:canonicalCharacters})},spellInitiativeOrder:order,turnEconomy:undefined,turnEconomyByToken:undefined,roomSession:undefined,effectiveRulesRef:{current:undefined},runtimeNow:()=>3});expect(prepared.ok,prepared.ok?'':prepared.reason).toBe(true);if(!prepared.ok)throw Error(prepared.reason);const frame=actual<Parameters<typeof beginMastermindMagicTruthOriginal>[0]|undefined>('magicTruthFrame',{thoughtOriginal:undefined,action:queued,pluginCast:prepared.prepared,captureDnd5eMagicTruthPreparedParent});if(!frame)throw Error('Real learned custom source and native Soul17 frame required');expect(readDnd5eMagicTruthOriginal(frame).worldMinute).toBe(mode==='missing-clock-local480'?480:actualClock?.worldMinute);
 const gateway=(member:'dm'|'player'|'reader'):MastermindMagicTruthGateway=>({session:()=>({roomId:'room',memberId:member,role:member==='dm'?'dm':'player'}),loadResource:api.read,request:async(operation,input)=>{const result=await api.post('mastermind-magic-truth/'+operation,input,member);if(result.status!==200)throw Error('magic-real-HTTP:'+result.status+':'+JSON.stringify(result.payload));return result.payload}}),host=gateway('dm'),before=await api.read('characters'),mapsBefore=await api.read('maps'),combatBefore=await api.read('combat');
 await expect(beginMastermindMagicTruthOriginal(JSON.parse(JSON.stringify(frame)),host)).rejects.toThrow('issued-parent-required');if(mode==='missing-clock-local480'){await expect(actual<Promise<Awaited<ReturnType<typeof beginMastermindMagicTruthOriginal>>>>('magicTruthOriginal',{action:queued,magicTruthFrame:frame,beginMastermindMagicTruthOriginal,magicTruthGateway:host})).rejects.toThrow('actual-source-snapshot-required');expect(await api.read('mastermind-magic-truth')).toBeNull();for(const[name,doc]of Object.entries({characters:before,maps:mapsBefore,combat:combatBefore}))expect(await api.read(name)).toEqual(doc);return}const original=await actual<Promise<Awaited<ReturnType<typeof beginMastermindMagicTruthOriginal>>>>('magicTruthOriginal',{action:queued,magicTruthFrame:frame,beginMastermindMagicTruthOriginal,magicTruthGateway:host}),privateBefore=await api.read('mastermind-magic-truth'),id=Object.keys(privateBefore.parents)[0],row=privateBefore.parents[id];expect(row.originalAction).toEqual(queued);expect(row.source.kind).toBe('spell');expect(row.source.id).toBe(truthTestSpell);expect(row.ownerMemberId).toBe('player');const actualBegin=Object.fromEntries(['id','parentTransactionId','mapId','actorId','ownerId','actorCharacterId','ownerCharacterId','source','versions','queueRevision'].map(key=>[key,row[key]]));expect((await api.post('mastermind-magic-truth/begin',actualBegin,'reader')).status).toBe(403);expect((await api.post('mastermind-magic-truth/begin',{...actualBegin,prepared:{}},'dm')).status).toBe(400);expect((await api.post('mastermind-magic-truth/begin',{...actualBegin,source:{...row.source,kind:'ability-check'}},'dm')).status).toBe(409);expect(await api.read('mastermind-magic-truth')).toEqual(privateBefore);const ownedList=await api.post('mastermind-magic-truth/list',{},'player'),foreignList=await api.post('mastermind-magic-truth/list',{},'reader');expect(ownedList.status).toBe(200);expect(ownedList.payload.parents).toHaveLength(1);expect(ownedList.payload.parents[0]).toMatchObject({id,canAnswer:true});expect(ownedList.payload.parents[0].source).toBeUndefined();expect(ownedList.payload.parents[0].originalAction).toBeUndefined();expect(foreignList.status).toBe(200);expect(foreignList.payload.parents).toEqual([]);expect(projectEventPayloadForViewer('_all',{channel:'shared-state-changed',payload:{name:'mastermind-magic-truth',id}}, {role:'player',memberId:'reader'})).toMatchObject({channel:'_private',payload:null});
 expect((await api.post('mastermind-magic-truth/answer',{id,expectedRevision:row.revision,truthfulAppearance:true},'dm')).status).toBe(403);expect((await api.post('mastermind-magic-truth/answer',{id,expectedRevision:row.revision,truthfulAppearance:true},'reader')).status).toBe(403);expect(await api.read('mastermind-magic-truth')).toEqual(privateBefore);
 expect((await api.post('mastermind-magic-truth',privateBefore,'player','GET')).status).toBe(403);expect((await api.post('mastermind-magic-truth',{...privateBefore,parents:{}},'dm','PUT')).status).toBe(403);expect((await api.post('transaction',{transactionId:'fake-choice',writes:[{name:'mastermind-magic-truth',expectedRevision:privateBefore._sync.revision,data:{...privateBefore,parents:{...privateBefore.parents,[id]:{...row,phase:'answered',revision:row.revision+1,answer:{truthfulAppearance:true,memberId:'player',at:1}}}}}]},'dm')).status).toBe(409);
 expect((await api.post('mastermind-magic-truth/project',{id},'reader')).status).toBe(403);const prompt=await api.post('mastermind-magic-truth/project',{id},'player');expect(prompt.status).toBe(200);expect(prompt.payload.parent.canAnswer).toBe(true);expect(prompt.payload.parent.source).toBeUndefined();expect(prompt.payload.parent.originalAction).toBeUndefined();
 await expect(withMastermindMagicTruthRoomSpell(original,async()=>{})).rejects.toThrow('authenticated-owner-answer-required');const chosen=mode!=='ordinary';expect((await api.post('mastermind-magic-truth/answer',{id,expectedRevision:row.revision,truthfulAppearance:chosen},'player')).status).toBe(200);expect((await api.post('mastermind-magic-truth/answer',{id,expectedRevision:row.revision,truthfulAppearance:!chosen},'player')).status).toBe(409);
 expect((await waitMastermindMagicTruthOwner(original,100))?.row.answer?.truthfulAppearance).toBe(chosen);
 if(mode==='source-lost'){f.unregisterSource();await expect(withMastermindMagicTruthRoomSpell(original,async()=>{})).rejects.toThrow('original-or-source-changed');for(const[name,doc]of Object.entries({characters:before,maps:mapsBefore,combat:combatBefore}))expect(await api.read(name)).toEqual(doc);return}
 await withMastermindMagicTruthRoomSpell(original,async(cast,resolve)=>{const facade=actual<(r:typeof resolve,i:Parameters<typeof resolve>[0],m:typeof cast.map)=>Promise<Awaited<ReturnType<typeof resolve>>>>('resolveDnd5eFacadeWithAirborneFalls',{getRoomSession:host.session,activeInterruptTransactionIdRef:{current:queued.id},secondChancePreparedAdapterId,resolvePreparedDnd5eEquipmentAttack,resolveDnd5ePreparedWithMaterialDamageReactions,damageReactionOptionsForMap:()=>({authorityUnchanged:()=>true,charactersByCombatantId:Object.fromEntries(Object.entries(cast.characterIdByCombatantId).map(([id,cid])=>[id,cast.characters.find(c=>c.id===cid)]))}),previewDnd5eMountedBalance,rollDiceBoxD20:no,rollDiceBoxValues:no}),native=await actual<()=>Promise<Awaited<ReturnType<typeof resolve>>>>('resolveMagicTruthOriginal',{magicTruthOriginal:original,withMastermindMagicTruthRoomSpell,resolveDnd5eFacadeWithAirborneFalls:facade,currentLongCastingCombatState:undefined,useMapStore:{getState:()=>({maps:[cast.map]})},useCharacterStore:{getState:()=>({characters:cast.characters})},preparedPluginSpellRolls:{activityRolls:{}},sourceSlotSpellHealingTargets:undefined,activityInterruptChoiceId:'dm-apply',runtimeNow:()=>3,pluginCast:cast})();expect(native.result.ok).toBe(true);if(!native.result.ok||!native.application)throw Error('Actual native application required');expect(native.result.events.some(e=>e.type==='activity-narrative-prompt'&&e.prompt==='这次魔法显现出目标所言真实的迹象。')).toBe(chosen);expect(native.result.events.some(e=>e.type==='ability-check-resolved')).toBe(false);
 const following=await settleDnd5eConcentrationChecks({result:native.result,priorState:cast.state,map:native.application.map,characters:native.application.characters,priorApplication:native.application,characterIdByCombatantId:cast.characterIdByCombatantId,rollD20:no,rollD4:no,rollDice:no});await expect(completeMastermindMagicTruthBase(JSON.parse(JSON.stringify(native)),following)).rejects.toThrow('actual-native-result-required');const completed=await completeMastermindMagicTruthBase(native,following);await expect(prepareMastermindMagicTruthPublication(JSON.parse(JSON.stringify(completed)),host)).rejects.toThrow('actual-completed-Base-required');const plan=await actual<Promise<Awaited<ReturnType<typeof prepareMastermindMagicTruthPublication>>>>('mastermindMagicTruthPublication',{magicTruthOriginal:original,prepareMastermindMagicTruthPublication,completeMastermindMagicTruthBase,resolvedPluginSpell:native,settledPluginSpell:following,magicTruthGateway:host}),ack=buildPlayerActionAck({action:queued,status:'accepted',mapId:map.id,round:1,initiativeIndex:0,appliedAt:3}),processed=buildPlayerActionProcessedState({action:queued,updatedAt:3}),publish=vi.fn(async()=>{}),count=api.gateway.saveResourcesAtomically.mock.calls.length;
 if(mode==='actual-noop-handoff'){const beforeNative=JSON.stringify(following),handoffs=following.result.activityHandoffs,definition=following.result.activityDefinition;if(!handoffs||!definition)throw Error('Actual Base recipe handoff required');const applied=applyDnd5eActivityDeferredMapHandoffs({map:following.application.map,characters:following.application.characters,sourceLimitMaps:[following.application.map],activity:definition,actorMovementRemainingFeet:following.result.state.combatants[cast.actorToken.id].turn.movementRemaining,packageId:cast.spell.ownerPluginId,actionId:queued.id,actorId:cast.actorToken.id,sourceSaveDc:cast.saveDc,concentrationId:cast.spell.id,round:1,combatId:queued.combatId,worldMinute:readBrowserSceneWorldMinute(),handoffs,selection:{summonCells:[],summonInitiativeD20s:[],movementCellsByOperationId:{},flamesByOperationId:{},watersByOperationId:{}}});expect(applied.ok,JSON.stringify(applied)).toBe(true);if(!applied.ok)throw Error(applied.reason);expect(applied.actorMovementRemainingFeet).toBe(following.result.state.combatants[cast.actorToken.id].turn.movementRemaining);const tree=ts.createSourceFile('current-Page.tsx',actualMapsSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let branch:string|undefined;function visit(n:ts.Node){if(ts.isIfStatement(n)&&n.expression.getText(tree).includes('applied.actorMovementRemainingFeet')&&n.thenStatement.getText(tree).includes('settledPluginSpell.result.state.combatants'))branch=n.getText(tree);ts.forEachChild(n,visit)}visit(tree);if(!branch)throw Error('Actual Page movement accounting block missing');vm.runInNewContext(ts.transpileModule(branch,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{resolvePreparedDnd5eSpellCast,resolvePreparedDnd5eMonsterAttack,applied,settledPluginSpell:following,actorToken:cast.actorToken});expect(JSON.stringify(following),'No-op map handoff must not mutate the actually branded Base result before its strict original ACK').toBe(beforeNative)}
 let lost=mode==='lost-reply';const commits=vi.fn(async(writes:readonly import('../../lib/sharedApi').SharedResourceTransactionWrite[],options:any)=>{const result=await api.gateway.saveResourcesAtomically(mode==='omit-private'?[...writes].filter(w=>w.name!=='mastermind-magic-truth'):[...writes],options);if(lost){lost=false;throw Error('Failed to fetch')}return result}),input={ack,processed,snapshots:{characters:following.application.characters,maps:[following.application.map],combat:await api.read('combat'),updatedAt:3},loadSharedResource:api.read,saveSharedResource:async()=>{throw Error('No split write')},commitSharedResources:commits,publishAck:publish},actualPublish=actual<(action:SharedPlayerActionState,payload:typeof input)=>ReturnType<typeof publishMastermindMagicTruthAck>>('publishOriginal',{loadBountifulActivityOriginalSource,loadBountifulPluginSpellAbilityOriginalSource,transactionSideEffects:{mastermindMagicTruthPublication:plan},publishMastermindMagicTruthAck});
 if(mode==='queue-stale'){expect((await api.post('player-action-requests/append',{action:{...queued,id:queued.id+':legitimate-next',seq:2,updatedAt:4}},'reader')).status).toBe(200);await expect(actualPublish(queued,input)).rejects.toThrow('original-or-world-changed');expect(commits).not.toHaveBeenCalled();for(const[name,doc]of Object.entries({characters:before,maps:mapsBefore,combat:combatBefore}))expect(await api.read(name)).toEqual(doc);expect(await api.read('player-action-ack')).toBeNull();return}
 if(mode==='omit-private'){await expect(actualPublish(queued,input)).rejects.toThrow('409');expect(commits).toHaveBeenCalledTimes(1);for(const[name,doc]of Object.entries({characters:before,maps:mapsBefore,combat:combatBefore}))expect(await api.read(name)).toEqual(doc);expect((await api.read('mastermind-magic-truth')).parents[id].phase).toBe('answered');expect(await api.read('player-action-ack')).toBeNull();expect(await api.read('player-action-processed')).toBeNull();return}
 if(mode==='clock-stale'||mode==='missing-clock-stale'){expect((await api.post('campaign-time/mutation',{operation:'advance-seconds',seconds:1},'dm','PATCH')).status).toBe(200);const permittedClockWorld={characters:await api.read('characters'),maps:await api.read('maps'),combat:await api.read('combat')};await expect(actualPublish(queued,input)).rejects.toThrow('original-or-world-changed');expect(commits).not.toHaveBeenCalled();for(const[name,doc]of Object.entries(permittedClockWorld))expect(await api.read(name)).toEqual(doc);expect((await api.read('characters')).characters.find((c:Character)=>c.id===reader.id).classResources).toEqual(reader.classResources);expect((await api.read('mastermind-magic-truth')).parents[id].phase).toBe('answered');return}
 await expect(publishMastermindMagicTruthAck(queued,JSON.parse(JSON.stringify(plan)),input)).rejects.toThrow('issued-plan-required');await actualPublish(queued,input);await actualPublish(queued,input);expect(commits).toHaveBeenCalledTimes(1);expect(api.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(count+1);expect(commits.mock.calls[0][0].map(w=>w.name).sort()).toEqual(['characters','maps','combat','player-action-ack','player-action-processed','mastermind-magic-truth'].sort());expect((await api.read('mastermind-magic-truth')).parents[id]).toMatchObject({phase:'consumed',answer:{truthfulAppearance:chosen,memberId:'player'}});expect((await api.read('characters')).characters.find((c:Character)=>c.id===reader.id).classResources['dnd5e-spell-slot-1'].current).toBe(reader.classResources!['dnd5e-spell-slot-1'].current-1);expect((await api.read('player-action-processed')).actionIds.filter((v:string)=>v===queued.id)).toHaveLength(1);expect((await api.read('player-action-ack')).recipientMemberId).toBe('reader');expect(Object.keys((await api.read('player-action-ack')).authorityRevisions)).toHaveLength(6);for(const name of['characters','maps','combat'])expect(JSON.stringify(await api.read(name))).not.toContain('truthfulAppearance');
 });
}));

it.each(['purpose','ordinary-manual','nonmagical','outer-partial','extra-manual','payload-only']as const)('unified owner magical truth retains explicit DM adjudication without promoting ordinary manual recipes (%s)',async mode=>{
 const disposeMM=install(),bundle:Dnd5eUnifiedContentBundleV1=magicTruthDiagnosticBundle(),definition=bundle.definitions[0];if(definition.kind!=='spell')throw Error('Actual spell definition required');const activity=definition.activities![0],manual=activity.outcomes[0].operations[0];if(manual.kind!=='manual-adjudication')throw Error('Actual manual operation required');if(mode==='ordinary-manual'||mode==='payload-only'){delete manual.purpose;delete manual.target}if(mode==='nonmagical')activity.legacySource!.magical=false;if(mode==='outer-partial')definition.automation=automationCapabilityFromLegacyStatus('partial');if(mode==='extra-manual')activity.outcomes[0].operations=[...activity.outcomes[0].operations,{...manual,id:'other-manual',purpose:undefined,target:undefined}];expect(validateDnd5eUnifiedContentBundleV1(bundle)).toEqual([]);const disposeMagic=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle));try{
 const registered=dnd5ePluginSpellDefinition(truthTestSpell)!;expect(registered).toBeDefined();const nativeEntry=mode==='purpose';expect(registered.automation?.mode).toBe(nativeEntry?'headless-action':'reference-only');const recipe=getRegisteredDnd5eActivity(truthTestNamespace,'truth-assay')!;expect(recipe).toBeDefined();const analysis=dnd5eActivityAutomationAnalysisV1(recipe);expect(analysis.capability.level).not.toBe('full');expect(analysis.missingComponents).toContain('operation:manual-adjudication');
 const first=growWizard(16,'evocation',1),plan=buildDnd5eLevelAdvancementPlan(first,'wizard',1,'evocation')!,spell=plan.spellAdvancement!,before=first.dnd5eClassChoices!.classes!.wizard!.selections!,book=[...before['wizard-spellbook'],truthTestSpell,...spell.spellOptions.map(o=>o.id).filter(id=>id!==truthTestSpell&&!before['wizard-spellbook'].includes(id)).slice(0,1)];expect(spell.spellOptions.some(o=>o.id===truthTestSpell)).toBe(true);const advanced=applyDnd5eLevelAdvancement(first,{schemaVersion:1,classId:'wizard',subclassId:'evocation',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:[],spellSelections:{cantrips:before[spell.cantripSelectionKey],wizardSpellbook:book}});if(!advanced.ok)throw Error(advanced.reason);const wizardSource=dnd5eEffectiveSpellcastingSources(advanced.character).find(s=>s.classId==='wizard')!,reader={...advanced.character,...dnd5ePatchEffectiveSpellSelections(advanced.character,wizardSource,{...advanced.character.dnd5eClassChoices!.classes!.wizard!.selections!,'spell-prepared':[truthTestSpell]})},owner=growMastermind(17,'owner').character,f=readingFixture(17,'actual-unified-truth-parent'),action={...f.action,dnd5eSpellCast:{spellId:truthTestSpell,castingClassId:'wizard' as const,slotLevel:1,targetTokenId:'owner-token',...(mode==='payload-only'?{magicalTruthPurpose:'magical-truth-detection'}:{})}},prepared=prepareDnd5ePluginSpellCast({action,map:f.ready.map,characters:[reader,owner],initiativeOrder:f.ready.map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,color:'',emoji:'',roll:20-i}))});
 if(!nativeEntry){expect(prepared.ok).toBe(false);if(!prepared.ok)expect(prepared.reason).toBe('spell-not-headless');return}expect(prepared.ok,prepared.ok?'':prepared.reason).toBe(true);if(!prepared.ok)throw Error(prepared.reason);const pending=resolvePreparedDnd5ePluginSpellCast({prepared:prepared.prepared,rolls:{activityRolls:{}}});expect(pending.result).toMatchObject({ok:false,reason:'dm-adjudication-pending'});const frame=captureDnd5eMagicTruthPreparedParent(prepared.prepared)!;expect(frame).toBeDefined();await withDnd5eMagicTruthSpellProduction(frame,true,async(cast,resolve)=>{const result=resolve({prepared:cast,rolls:{activityRolls:{},activityInterruptChoiceId:'dm-apply'}});expect(result.result.ok).toBe(true);expect(result.result.events.some(e=>e.type==='activity-narrative-prompt'&&e.prompt==='这次魔法显现出目标所言真实的迹象。')).toBe(true)})
 }finally{disposeMagic();disposeMM()}
});

it('unified owner magical truth supports its genuine self-cast without borrowing the other-reader restriction',async()=>{const disposeMM=install(),bundle:Dnd5eUnifiedContentBundleV1=magicTruthDiagnosticBundle(),definition=bundle.definitions[0];if(definition.kind!=='spell')throw Error('Real spell required');definition.payload.targeting={...definition.payload.targeting,includeSelf:true};const activity=definition.activities![0];if(activity.target.kind!=='creature')throw Error('Real creature recipe');activity.target.includeSelf=true;const disposeMagic=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle));try{let c=growMastermind(17,'self-native').character;for(let level=1;level<=2;level++){const plan=buildDnd5eLevelAdvancementPlan(c,'wizard',1,'evocation')!,spell=plan.spellAdvancement!,prior=c.dnd5eClassChoices?.classes?.wizard?.selections??{},cantrips=[...(prior[spell.cantripSelectionKey]??[]),...spell.cantripOptions.map(o=>o.id)].filter((id,index,all)=>all.indexOf(id)===index).slice(0,spell.targetCantripCount),book=[...(prior['wizard-spellbook']??[]),truthTestSpell,...spell.spellOptions.map(o=>o.id)].filter((id,index,all)=>all.indexOf(id)===index).slice(0,spell.targetWizardSpellbookCount);expect(spell.spellOptions.some(o=>o.id===truthTestSpell)||book.includes(truthTestSpell)).toBe(true);const advanced=applyDnd5eLevelAdvancement(c,{schemaVersion:1,classId:'wizard',subclassId:'evocation',levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:[],classChoiceSelections:Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,[...r.currentSelections,...r.options.map(o=>o.id)].filter((id,index,all)=>all.indexOf(id)===index).slice(0,r.targetLimit)])),spellSelections:{cantrips,wizardSpellbook:book}});expect(advanced.ok,JSON.stringify(advanced)).toBe(true);if(!advanced.ok)throw Error(advanced.reason);c=advanced.character}expect(c.dnd5eClassLevels).toMatchObject({rogue:17,wizard:2});const wizard=dnd5eEffectiveSpellcastingSources(c).find(s=>s.classId==='wizard')!,owner={...c,...dnd5ePatchEffectiveSpellSelections(c,wizard,{...c.dnd5eClassChoices!.classes!.wizard!.selections!,'spell-prepared':[truthTestSpell]}),roomId:'room',roomMemberId:'reader'},map:BattleMap={id:'self-map',name:'Self magic',showGrid:true,width:400,height:400,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,tokens:[{id:'self-token',type:'player',characterId:owner.id,label:owner.name,x:25,y:25,size:1,color:'',emoji:''}]},order=[{tokenId:'self-token',label:owner.name,color:'',emoji:'',roll:20}],action:SharedPlayerActionState={id:'self-magic-parent',mapId:map.id,combatId:'self-combat',type:'dnd5e-spell-cast',status:'pending',sourceMode:'player',characterId:owner.id,actorTokenId:'self-token',targetTokenId:'self-token',dnd5eSpellCast:{spellId:truthTestSpell,castingClassId:'wizard',slotLevel:1,targetTokenId:'self-token'},round:1,initiativeIndex:0,seq:1,updatedAt:1},api=await createNativeEnvelopeApi({characters:{characters:[owner]},maps:{maps:[map]},combat:{active:true,mapId:map.id,combatId:action.combatId,round:1,initiativeIndex:0,initiativeOrder:order}});expect((await api.post('player-action-requests/append',{action},'reader')).status).toBe(200);const queue=await api.read('player-action-requests'),prepared=prepareDnd5ePluginSpellCast({worldMinute:undefined,action:queue.requests[0],map,characters:[owner],initiativeOrder:order});if(!prepared.ok)throw Error(prepared.reason);const frame=captureDnd5eMagicTruthPreparedParent(prepared.prepared);expect(frame).toBeDefined();if(!frame)throw Error('Actual self native frame');const host:MastermindMagicTruthGateway={session:()=>({roomId:'room',memberId:'dm',role:'dm'}),loadResource:api.read,request:async(operation,input)=>{const response=await api.post('mastermind-magic-truth/'+operation,input,'dm');if(response.status!==200)throw Error(JSON.stringify(response));return response.payload}},original=await beginMastermindMagicTruthOriginal(frame,host),journal=await api.read('mastermind-magic-truth'),id=Object.keys(journal.parents)[0],row=journal.parents[id];expect(row.ownerMemberId).toBe('reader');expect((await api.post('mastermind-magic-truth/answer',{id,expectedRevision:row.revision,truthfulAppearance:true},'dm')).status).toBe(403);expect((await api.post('mastermind-magic-truth/answer',{id,expectedRevision:row.revision,truthfulAppearance:true},'reader')).status).toBe(200);await withMastermindMagicTruthRoomSpell(original,async(cast,resolve)=>{const result=resolve({prepared:cast,rolls:{activityRolls:{},activityInterruptChoiceId:'dm-apply'}});expect(result.result.ok).toBe(true);expect(result.result.events.some(e=>e.type==='activity-narrative-prompt'&&e.actorId==='self-token'&&e.prompt==='这次魔法显现出目标所言真实的迹象。')).toBe(true)});expect((await api.read('characters')).characters[0].classResources).toEqual(owner.classResources);expect(await api.read('player-action-ack')).toBeNull();
 }finally{disposeMagic();disposeMM()}});

it('magical truth room binds the real unhydrated room-clock composition to undefined rather than its local 480 display default',()=>{const before=useCampaignTimeStore.getState();try{useCampaignTimeStore.setState({state:normalizeSharedCampaignTime(null),hydratedRoomId:null});expect(useCampaignTimeStore.getState().state.worldMinute).toBe(480);expect(readBrowserSceneWorldMinute()).toBeUndefined()}finally{useCampaignTimeStore.setState(before)}})
