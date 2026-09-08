import fs from 'node:fs'
import path from 'node:path'

const directory = path.resolve(process.env.STARS_MONSTER_INVENTORY_DIR ?? '.codex-temp/monster-verification-20260904')
if (path.relative(process.cwd(), directory).startsWith('..')) throw new Error('output must be inside repository')
const catalog = JSON.parse(fs.readFileSync(path.join(directory, 'catalog.json'), 'utf8'))
const weaponFixtures = JSON.parse(fs.readFileSync(path.join(directory, 'weapon-ui-fixtures.json'), 'utf8'))
const fixtures = Object.fromEntries(weaponFixtures.map(fixture => [`${fixture.slug}/${fixture.actionId}`, fixture]))
const challengeValue = rating => {
  const [numerator, denominator] = String(rating ?? '0').split('/').map(Number)
  return denominator ? numerator / denominator : numerator || 0
}
const cases = catalog.map(monster => {
  const action = monster.actions.find(candidate => candidate.automation === 'headless' && candidate.attack
    && !candidate.requiredActiveEffectDefinitionId && !candidate.targetEligibility && !candidate.relationRequirement)
    ?? monster.actions.find(candidate => candidate.automation === 'headless' && candidate.attack)
  return { slug: monster.slug, name: monster.name, actionId: action?.id ?? null, actionName: action?.name ?? null,
    kind: action?.kind ?? 'inspect-only', section: 'actions', challengeRating: monster.challenge.rating }
}).sort((left, right) =>
  challengeValue(right.challengeRating) - challengeValue(left.challengeRating) ||
  left.name.localeCompare(right.name, 'zh-CN'))
const weapons = weaponFixtures.map(fixture => {
  const monster = catalog.find(candidate => candidate.slug === fixture.slug)
  const action = monster.actions.find(candidate => candidate.id === fixture.actionId)
  return { slug: monster.slug, name: monster.name, actionId: action.id, actionName: action.name, kind: action.kind, section: 'actions' }
})
const specials = [
  ['adult-red-dragon', 'detect', true, 'none'],
  ['adult-red-dragon', 'wing-attack-costs-2-actions', true, 'cancel'],
  ['adult-red-dragon', 'wing-attack-costs-2-actions', true, 'move'],
  ['vampire-vampire', 'move', true, 'move'],
  ['vampire-bat', 'move', true, 'move'],
  ['vampire-mist', null, true, 'none'],
  ['kraken', 'lightning-storm', false, 'none'],
].map(([slug, actionId, legendary, movement]) => {
  const monster = catalog.find(entry => entry.slug === slug)
  const action = monster[legendary ? 'legendaryActions' : 'actions']?.find(entry => entry.id === actionId)
  return { slug, name: monster.name, actionId, actionName: action?.name, legendary, movement,
    fixtureActionId: cases.find(entry => entry.slug === slug)?.actionId, section: legendary ? 'legendaryActions' : 'actions' }
})
const data = JSON.stringify({ catalog, fixtures, modes: { monsters: cases, weapons, specials } }).replaceAll('<', '\\u003c')
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>怪物隔离验证 · 场景夹具</title>
<style>body{font:16px system-ui;background:#141624;color:#eef;margin:30px;max-width:1100px}button,input,select{font:inherit;padding:10px;margin:6px}pre{white-space:pre-wrap;line-height:1.5;background:#24263b;padding:20px}a{color:#9edaff}</style>
<h1>怪物隔离验证 · 场景夹具</h1><p>仅在专用 6973 / 6974 服务使用。载入前请将两个战斗客户端导航到空白页。这里只准备场景；攻击必须在实际战斗 UI 中点击执行。</p>
<label>验证范围<select id="mode"><option value="monsters">逐怪物首个武器动作</option><option value="weapons">所有 Headless 武器动作</option><option value="specials">传奇与特殊动作专项</option></select></label>
<label>场景编号<input id="index" type="number" value="0" min="0"></label><button id="load">载入当前场景</button><button id="next">载入下一场景</button>
<p id="status" role="status">尚未载入</p><pre id="scenario"></pre><pre id="result"></pre>
<script type="module">
const data = ${data};
const mode = document.querySelector('#mode'), index = document.querySelector('#index'), status = document.querySelector('#status');
const choices = () => data.modes[mode.value];
function selected(){return choices()[Number(index.value)]}
function show(){document.querySelector('#scenario').textContent=JSON.stringify({...selected(),index:Number(index.value),total:choices().length},null,2)}
mode.onchange=()=>{index.value=0;show()};index.onchange=show;show();
async function put(name,value){const read=await fetch('/api/state/'+name);const revision=read.headers.get('X-Stars-State-Revision')||'0';const response=await fetch('/api/state/'+name,{method:'PUT',headers:{'Content-Type':'application/json','X-Stars-Protocol':'5','X-Stars-Writer':'monster-verification-fixture','X-Stars-Expected-Revision':revision},body:JSON.stringify(value)});if(!response.ok)throw Error(name+': '+response.status+' '+await response.text())}
async function seed(){
 if(location.origin!=='http://127.0.0.1:6973')throw Error('仅允许专用 DM 6973 端口');
 const scene=selected();if(!scene)throw Error('场景编号越界');
 const monster=data.catalog.find(entry=>entry.slug===scene.slug), fixture=data.fixtures[scene.slug+'/'+(scene.fixtureActionId||scene.actionId)];
 const now=Date.now(),mapId='verify-ui-'+scene.slug+'-'+(scene.actionId||'inspect')+'-'+now,combatId=mapId+':combat';
 function state(value){return JSON.parse(JSON.stringify(value||{}).replaceAll(fixture?.combatId||'__NO_OLD_KEY__',combatId))}
 const targetState=state(fixture?.targetState);
 const projectedConditions=[...new Set((targetState.activeEffects||[]).filter(effect=>!effect.suspendedBy?.length).map(effect=>effect.legacyCondition||effect.standardCondition).filter(Boolean))];
 const hero={id:'hero',name:'验证目标',player:'玩家1',avatar:'H',accent:'',race:'人类',charClass:'法师',dnd5eClassId:'wizard',dnd5eClassLevels:{wizard:20},rulesetId:'dnd5e-2014-srd-5.1',level:20,background:'',experience:0,reputation:0,abilities:{str:10,dex:10,con:30,int:10,wis:10,cha:10},savingThrows:[],skills:[],hitPointMaximumMode:'manual',hitPointRolls:Array(20).fill(6),maxHp:100000,currentHp:fixture?.targetHp??100000,tempHp:0,hitDice:'20d6',ac:10,speed:30,initiativeBonus:0,saveDC:10,passivePerception:10,inspiration:0,conditions:projectedConditions,notes:'',dmNotes:'',visibleToPlayers:true,dnd5eCombatState:targetState};
 const footprint={'微型':1,'小型':1,'中型':1,'大型':2,'超大型':3,'巨型':4}[monster.size];
 const targetFootprint=(fixture?.targetSizeRank??2)===0?0.5:1;
 const actor={id:'actor',label:monster.name,x:(2+footprint/2)*70,y:(3+footprint/2)*70,color:'#ef4444',emoji:'M',size:footprint,creatureSize:monster.size,type:'enemy',poolId:monster.id,hp:monster.hitPoints.average,maxHp:monster.hitPoints.average,dnd5eCombatState:state(fixture?.actorState)};
 const target={id:'target',label:hero.name,x:(2+footprint+0.5)*70,y:245,color:'#3b82f6',emoji:'H',size:targetFootprint,creatureSize:['微型','小型','中型','大型','超大型','巨型'][fixture?.targetSizeRank??2],type:'player',characterId:hero.id,hp:hero.currentHp,maxHp:hero.maxHp};
 const definition=monster.actions.find(action=>action.id===scene.actionId);if(definition?.attack?.reachFeet===0){target.x=actor.x;target.y=actor.y;}
 const witness={id:'witness',label:'旁观卫兵',x:945,y:525,color:'#666',emoji:'W',size:1,type:'enemy',poolId:'srd-5.1:commoner',hp:4,maxHp:4};
 const sceneTokens=scene.legendary?[actor,target,witness]:[actor,target];
 const initiativeTokens=scene.legendary?[target,witness,actor]:[actor,target];
 const map={id:mapId,name:'怪物验证 · '+monster.name,width:1120,height:700,gridSize:70,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:sceneTokens};
 await put('characters',{characters:[hero],selectedId:hero.id,updatedAt:now});
 await put('maps',{maps:[map],selectedId:mapId,updatedAt:now});
 await put('map-geometry',{schemaVersion:2,updatedAt:now,maps:[{mapId,walls:[],doors:[],windows:[],lights:[],obstacles:[],vision:{enabled:false,defaultRangeFeet:60,sharePartyVision:true,ambientLight:'bright'},updatedAt:now}]});
 await put('combat-log',{mapId,entries:[],updatedAt:now});await put('dice-events',{mapId,events:[],updatedAt:now});
 await put('combat-interrupts',{mapId,interrupts:[],updatedAt:now,revision:0});
 await put('player-action-requests',{mapId,combatId,requests:[],updatedAt:now});await put('player-action-processed',{mapId,combatId,actionIds:[],updatedAt:now});
 await put('combat',{mapId,combatId,active:true,round:1,initiativeIndex:0,settlementMode:'automatic',monsterControl:{schemaVersion:1,mode:'manual',pauseRequested:false,controlledTokenId:actor.id,updatedAt:now},initiativeOrder:initiativeTokens.map((token,i)=>({tokenId:token.id,slotId:token.id,label:token.label,emoji:token.emoji,color:token.color,roll:scene.legendary?20-i*5:20-i*10})),updatedAt:now});
 document.querySelector('#result').textContent=JSON.stringify({mapId,combatId,actorPosition:{x:actor.x,y:actor.y},targetPosition:{x:target.x,y:target.y}},null,2);
 status.textContent='场景已就绪';
}
async function load(next){document.querySelectorAll('button').forEach(button=>button.disabled=true);try{if(next)index.value=Number(index.value)+1;show();status.textContent='正在准备场景';await seed()}catch(error){status.textContent='失败：'+error.message}finally{document.querySelectorAll('button').forEach(button=>button.disabled=false)}}
document.querySelector('#load').onclick=()=>load(false);document.querySelector('#next').onclick=()=>load(true);
</script></html>`
fs.writeFileSync(path.join(directory, 'ui-controller.html'), html)
console.log(`Generated ${cases.length} monster scenes and ${weapons.length} weapon scenes.`)
