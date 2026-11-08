
import{automationCapabilityFromLegacyStatus}from"../../domain/automation/automationCapability"
import{afterEach,expect,vi}from"vitest"
import{registerDnd5eRulesPlugin}from"../../rulesets/dnd5e/pluginApi"
import{dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1,validateDnd5eUnifiedContentBundleV1}from"../../rulesets/dnd5e/unifiedContent"
import{normalizeCharacter}from"../../store/characters"
import{applyDnd5eLevelAdvancement,buildDnd5eLevelAdvancementPlan}from"../../rulesets/dnd5e/levelAdvancement"
import{defaultDnd5eStartingEquipmentSelection,dnd5eStartingEquipmentPlan,resolveDnd5eStartingEquipment}from"../../rulesets/dnd5e/startingEquipment"
import{buildDnd5eSpellAdvancementPlanFromSelections}from"../../rulesets/dnd5e/spellAdvancement"
import{syncCharacterClassResources}from"../../lib/classResources"
import fsp from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import{Readable}from"node:stream"
import{type IncomingMessage}from"node:http"
import{createHash,randomBytes}from"node:crypto"
import{SHARED_PROTOCOL_VERSION,handleSharedApi}from"../../../scripts/shared-server-core.mjs"
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
export function mastermindBundle(){return structuredClone(originalNativeBundle)}
export function install(outer:'full'|'manual'|'partial'='full'){const bundle=mastermindBundle();bundle.definitions[0].automation=automationCapabilityFromLegacyStatus(outer);expect(validateDnd5eUnifiedContentBundleV1(bundle)).toEqual([]);return registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))}
export function growMastermind(target=3,id='mastermind',initialSkills=['stealth','acrobatics','perception','deception'],initialExpertise=['stealth','perception']){const gearPlan=dnd5eStartingEquipmentPlan('游荡者','骗子'),gear=resolveDnd5eStartingEquipment(id,gearPlan,defaultDnd5eStartingEquipmentSelection(gearPlan));let character=normalizeCharacter({id,name:'策士',charClass:'游荡者',level:1,rulesetId:'dnd5e-2014-srd-5.1',abilities:{str:10,dex:16,con:12,int:14,wis:12,cha:14},skills:initialSkills,dnd5eClassLevels:{rogue:1},dnd5eClassChoices:{classes:{rogue:{selections:{expertise:initialExpertise}}}},equipment:gear.equipment,dnd5eInventory:gear.inventory,maxHp:9,currentHp:9});const steps=[];for(let level=2;level<=target;level++){const plan=buildDnd5eLevelAdvancementPlan(character,'rogue',1,mastermindSubclass)!;expect(plan).toBeDefined();const classChoiceSelections=Object.fromEntries(plan.choiceRequirements.map(r=>[r.key,[...r.currentSelections,...r.options.map(o=>o.id).filter(id=>!r.currentSelections.includes(id)&&(r.key!=='expertise'||character.skills.includes(id)||id==='thieves-tools'))].slice(0,r.targetLimit)])),contentChoiceSelections=Object.fromEntries(plan.contentAdvancements.map(content=>[content.contentId,Object.fromEntries(content.requirements.map(r=>[r.id,r.options.slice(0,r.count).map(o=>o.id)]))])),asiAbility=character.abilities.dex<=18?'dex':'int';const next=applyDnd5eLevelAdvancement(character,{schemaVersion:1,classId:'rogue',subclassId:mastermindSubclass,levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:plan.asiLevels.map(classLevel=>({classLevel,choice:{kind:'ability-score' as const,increases:{[asiAbility]:2}}})),classChoiceSelections,contentChoiceSelections});expect(next.ok,JSON.stringify(next)).toBe(true);if(!next.ok)throw Error(next.reason);steps.push({level,requirements:plan.contentAdvancements,character:next.character});character=next.character}return{character,steps}}

export function growWizard(int=16,subclass='evocation',targetLevel=3,featId?:string,learnedSpell?:string){const gearPlan=dnd5eStartingEquipmentPlan('法师','贤者'),gear=resolveDnd5eStartingEquipment('mage',gearPlan,defaultDnd5eStartingEquipmentSelection(gearPlan));const first=buildDnd5eSpellAdvancementPlanFromSelections({classId:'wizard',fromClassLevel:0,toClassLevel:1,selections:{}})!;let cantrips=['fire-bolt',...first.cantripOptions.map(o=>o.id).filter(id=>id!=='fire-bolt')].slice(0,first.targetCantripCount),book=['mage-armor','magic-missile',...first.spellOptions.map(o=>o.id).filter(id=>!['mage-armor','magic-missile'].includes(id))].slice(0,first.targetWizardSpellbookCount!);let c=normalizeCharacter({id:'mage',name:'War Mage',charClass:'法师',level:1,rulesetId:'dnd5e-2014-srd-5.1',abilities:{str:10,dex:14,con:12,int,wis:10,cha:14},maxHp:7,currentHp:7,equipment:gear.equipment,dnd5eInventory:gear.inventory,dnd5eClassLevels:{wizard:1},dnd5eClassChoices:{classes:{wizard:{selections:{[first.cantripSelectionKey]:cantrips,'wizard-spellbook':book,'spell-prepared':book.slice(0,4)}}}}});for(let level=2;level<=targetLevel;level++){const p=buildDnd5eLevelAdvancementPlan(c,'wizard',1,subclass)!,s=p.spellAdvancement!;cantrips=[...cantrips,...s.cantripOptions.map(o=>o.id).filter(id=>!cantrips.includes(id))].slice(0,s.targetCantripCount);const preferred=[...(learnedSpell?[learnedSpell]:[]),'detect-thoughts','counterspell','dispel-magic','scorching-ray','blight',...s.spellOptions.map(o=>o.id)].filter((id,index,all)=>all.indexOf(id)===index&&s.spellOptions.some(o=>o.id===id)&&!book.includes(id));book=[...book,...preferred.slice(0,2)];const next=applyDnd5eLevelAdvancement(c,{schemaVersion:1,classId:'wizard',subclassId:subclass,levelsGained:1,hitPointMethod:'fixed',hitPointRolls:[],asiChoices:level===4?[{classLevel:4,choice:featId?{kind:'feat',featId}:{kind:'ability-score',increases:{dex:2}}}]:[],spellSelections:{cantrips,wizardSpellbook:book}});expect(next.ok,JSON.stringify(next)).toBe(true);if(!next.ok)throw Error(next.reason);c=next.character}const final=syncCharacterClassResources(c);final.dnd5eClassChoices!.classes!.wizard!.selections!['spell-prepared']=book.slice().sort((a,b)=>(a===(learnedSpell??'detect-thoughts')?-1:b===(learnedSpell??'detect-thoughts')?1:0)).slice(0,Math.max(1,Math.floor((int-10)/2)+targetLevel));return final}

const base=path.resolve(os.tmpdir(),'stars-mastermind-native-publication-permanent-api'),roots:string[]=[]
afterEach(async()=>{for(const root of roots.splice(0)){if(path.dirname(path.resolve(root))!==base||!path.basename(root).startsWith('room-'))throw Error('API fixture cleanup outside its own root');await fsp.rm(root,{recursive:true,force:true,maxRetries:4,retryDelay:20})}})
export async function createNativeEnvelopeApi(docs:Record<string,any>){
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
 const gateway={loadResource:async<T>(name:string)=>await read(name)as T,saveResourcesAtomically:vi.fn(async(writes:readonly any[],options:any)=>{
  const response=await post('transaction',{writes,transactionId:options.transactionId,readRevisions:options.readRevisions??{}})
  if(response.status!==200||!response.payload.ok)throw Error('actual-api-transaction:'+response.status+':'+JSON.stringify(response.payload))
  for(const write of writes)docs[write.name]=await read(write.name)
  return{status:'committed' as const,transactionId:options.transactionId,revisions:response.payload.revisions??{}}
 })}
 return{read,post,gateway,async persistEquipment(owner:unknown){const characters=await read('characters');await gateway.saveResourcesAtomically([{name:'characters',expectedRevision:characters._sync.revision,data:{...characters,characters:[owner]}}],{transactionId:'real-equip',readRevisions:{}})}}
}
const truthTestNamespace='test.mastermind-magic-truth';
export function magicTruthDiagnosticBundle(){const automation=automationCapabilityFromLegacyStatus('full');return{format:'dndstars5e-unified-content',schemaVersion:1,manifest:{id:truthTestNamespace,name:'Custom magical truth adjudication diagnostic',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Local test',license:'CC0',distributionPolicy:'local-only',contentCategory:'mixed'},assets:[],definitions:[{schemaVersion:1,namespace:truthTestNamespace,version:'1.0.0',id:'truth-assay',kind:'spell',name:'Custom truth assay (not an official spell)',automation,payload:{id:'truth-assay',name:'Custom truth assay (not an official spell)',level:1,school:'divination',ritual:false,castingTime:{value:1,unit:'action'},range:{type:'distance',feet:30},targeting:{relation:'any',includeSelf:false,maximumTargets:1},components:{verbal:true,somatic:true,material:false},duration:{type:'instantaneous',concentration:false},classes:['wizard'],description:'Explicit custom registered test recipe for a DM-adjudicated magical determination. It is not an official source spell.',automation:{mode:'headless-action',actionId:'truth-assay'}},activities:[{schemaVersion:1,id:'truth-assay',name:'Custom truth assay',activation:{kind:'action'},target:{kind:'creature',relation:'any',count:1,rangeFeet:30},legacySource:{kind:'spell',id:'truth-assay',magical:true},automation,outcomes:[{id:'adjudicate',when:{kind:'always'},operations:[{id:'magic-truth',kind:'manual-adjudication',prompt:'DM determines the ordinary magical verdict for this statement.',reason:'Custom magic explicitly determines spoken truth; narrative facts remain a DM adjudication.',requiresDmApproval:true,purpose:'magical-truth-detection',target:'target'},{id:'ordinary-verdict-prompt',kind:'narrative-prompt',prompt:'This custom magic yields only its actual DM-adjudicated verdict for this statement.'}]}]}]}]} satisfies Dnd5eUnifiedContentBundleV1}
export function featureDiagnosticBundle():Dnd5eUnifiedContentBundleV1{const source=magicTruthDiagnosticBundle(),definition=source.definitions[0];if(definition.kind!=='spell'||!definition.activities?.[0])throw Error('Actual diagnostic recipe required');const activity={...structuredClone(definition.activities[0]),id:'truth-assay-feature',legacySource:{kind:'feat' as const,id:'truth-assay-feat',magical:true}},feat={schemaVersion:1 as const,namespace:source.manifest.id,version:'1.0.0',id:'truth-assay-feat',kind:'feat' as const,name:'Custom diagnostic magical truth feat (not official)',automation:definition.automation,payload:{id:'truth-assay-feat',name:'Custom diagnostic magical truth feat',summary:'A genuinely acquired diagnostic feat granting its magical native feature.',description:'Explicit custom registered diagnostic feat; not an official feature or spell. Its sole feature executes this approved manual-adjudicated magical truth recipe.',automation:'full' as const},activities:[activity]};return{...source,definitions:[...source.definitions,feat]}}
