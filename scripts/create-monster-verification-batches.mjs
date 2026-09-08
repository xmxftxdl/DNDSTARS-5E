import fs from 'node:fs'
import path from 'node:path'

const directory = path.resolve(process.env.STARS_MONSTER_INVENTORY_DIR ?? '.codex-temp/monster-verification-20260904')
if (path.relative(process.cwd(), directory).startsWith('..')) throw new Error('output must be inside repository')
const catalog = JSON.parse(fs.readFileSync(path.join(directory, 'catalog.json'), 'utf8'))
const fixtures = JSON.parse(fs.readFileSync(path.join(directory, 'weapon-ui-fixtures.json'), 'utf8'))
const cases = catalog.map((monster, index) => {
  const action = monster.actions.find(candidate => candidate.automation === 'headless' && candidate.attack
    && !candidate.requiredActiveEffectDefinitionId && !candidate.targetEligibility && !candidate.relationRequirement)
    ?? monster.actions.find(candidate => candidate.automation === 'headless' && candidate.attack)
  return { index, monster, action, fixture: fixtures.find(fixture => fixture.slug === monster.slug && fixture.actionId === action?.id) }
}).filter(entry => entry.action)
const data = JSON.stringify(cases).replaceAll('<', '\\u003c')
fs.writeFileSync(path.join(directory, 'ui-batches.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>怪物战斗批次夹具</title>
<style>body{font:16px system-ui;background:#15172a;color:white;margin:30px}button,input{font:inherit;padding:10px;margin:8px}pre{white-space:pre-wrap}</style>
<h1>怪物战斗批次夹具</h1><p>专用 6973 / 6974 环境。此页仅创建战斗，动作由实际 DM 控制台执行。</p>
<label>起始目录编号<input id="start" type="number" min="0" value="7"></label><label>批次大小<input id="count" type="number" min="1" max="24" value="12"></label><button id="load">创建战斗批次</button>
<p id="status" role="status">尚未创建</p><pre id="result"></pre>
<script type="module">
const cases=${data};
async function put(name,value){const previous=await fetch('/api/state/'+name);const revision=previous.headers.get('X-Stars-State-Revision')||'0';const response=await fetch('/api/state/'+name,{method:'PUT',headers:{'Content-Type':'application/json','X-Stars-Protocol':'5','X-Stars-Writer':'monster-verification-fixture','X-Stars-Expected-Revision':revision},body:JSON.stringify(value)});if(!response.ok)throw Error(name+': '+response.status+' '+await response.text())}
document.querySelector('#load').onclick=async()=>{const button=document.querySelector('#load'),status=document.querySelector('#status');button.disabled=true;status.textContent='正在准备批次';try{
if(location.origin!=='http://127.0.0.1:6973')throw Error('仅允许专用端口');
const start=Number(document.querySelector('#start').value),count=Math.min(24,Math.max(1,Number(document.querySelector('#count').value)));
const selected=cases.filter(entry=>entry.index>=start).slice(0,count);if(!selected.length)throw Error('没有场景');
const now=Date.now(),mapId='verify-batch-'+start+'-'+now,combatId=mapId+':combat',characters=[],actors=[],targets=[],scenes=[];
for(const {index,monster,action,fixture} of selected){
 const actorId='actor-'+index,targetId='target-'+index,heroId='hero-'+index,heroName='验证目标 '+index;
 function rewrite(value){if(typeof value==='string'){if(value==='actor')return actorId;if(value==='target')return targetId;return value.replaceAll(fixture?.combatId||'__NO_KEY__',combatId).replaceAll(':actor',':'+actorId).replaceAll(':target',':'+targetId)}if(Array.isArray(value))return value.map(rewrite);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,rewrite(item)]));return value}
 const hero={id:heroId,name:heroName,player:'玩家1',avatar:'H',accent:'',race:'人类',charClass:'法师',dnd5eClassId:'wizard',dnd5eClassLevels:{wizard:20},rulesetId:'dnd5e-2014-srd-5.1',level:20,background:'',experience:0,reputation:0,abilities:{str:10,dex:10,con:30,int:10,wis:10,cha:10},savingThrows:[],skills:[],hitPointMaximumMode:'manual',hitPointRolls:Array(20).fill(6),maxHp:320,currentHp:320,tempHp:0,hitDice:'20d6',ac:10,speed:30,initiativeBonus:0,saveDC:10,passivePerception:10,inspiration:0,conditions:[],notes:'',dmNotes:'',visibleToPlayers:true,dnd5eCombatState:rewrite(fixture?.targetState||{})};
 const footprint={'微型':1,'小型':1,'中型':1,'大型':2,'超大型':3,'巨型':4}[monster.size],rank=fixture?.targetSizeRank??2;
 const position=actors.length,col=position%4,row=Math.floor(position/4),left=2+col*9,top=2+row*7;
 const actor={id:actorId,label:monster.name,x:(left+footprint/2)*70,y:(top+footprint/2)*70,color:'#ef4444',emoji:'M',size:footprint,creatureSize:monster.size,type:'enemy',poolId:monster.id,hp:monster.hitPoints.average,maxHp:monster.hitPoints.average,dnd5eCombatState:rewrite(fixture?.actorState||{})};
 const target={id:targetId,label:heroName,x:(left+footprint+0.5)*70,y:(top+0.5)*70,color:'#3b82f6',emoji:'H',size:rank===0?0.5:1,creatureSize:['微型','小型','中型'][rank]||'中型',type:'player',characterId:heroId,hp:320,maxHp:320};
 actors.push(actor);targets.push(target);characters.push(hero);scenes.push({index,slug:monster.slug,name:monster.name,actionId:action.id,actionName:action.name,actorId,targetId,heroId,targetName:heroName,initialHp:320});
}
const map={id:mapId,name:'怪物批次验证 '+start,width:2800,height:(Math.ceil(actors.length/4)*7+4)*70,gridSize:70,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[...actors,...targets]};
await put('characters',{characters,selectedId:characters[0].id,updatedAt:now});await put('maps',{maps:[map],selectedId:mapId,updatedAt:now});
await put('map-geometry',{schemaVersion:2,updatedAt:now,maps:[{mapId,walls:[],doors:[],windows:[],lights:[],obstacles:[],vision:{enabled:false,defaultRangeFeet:60,sharePartyVision:true,ambientLight:'bright'},updatedAt:now}]});
await put('combat-log',{mapId,entries:[],updatedAt:now});await put('dice-events',{mapId,events:[],updatedAt:now});await put('combat-interrupts',{mapId,interrupts:[],updatedAt:now,revision:0});await put('player-action-requests',{mapId,combatId,requests:[],updatedAt:now});await put('player-action-processed',{mapId,combatId,actionIds:[],updatedAt:now});
await put('combat',{mapId,combatId,active:true,round:1,initiativeIndex:0,settlementMode:'automatic',monsterControl:{schemaVersion:1,mode:'manual',pauseRequested:false,controlledTokenId:actors[0].id,updatedAt:now},initiativeOrder:[...actors,...targets].map((token,i)=>({tokenId:token.id,slotId:token.id,label:token.label,emoji:token.emoji,color:token.color,roll:100-i})),updatedAt:now});
document.querySelector('#result').textContent=JSON.stringify({mapId,combatId,scenes},null,2);status.textContent='批次已就绪';
}catch(error){status.textContent='失败：'+error.message}finally{button.disabled=false}};
</script></html>`)
console.log(`Generated real-UI batch fixtures for ${cases.length} monsters with Headless weapon actions.`)
