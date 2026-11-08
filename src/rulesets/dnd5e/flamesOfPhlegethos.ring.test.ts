import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { it, expect } from 'vitest';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eCombatantPairKey, type Dnd5eAction } from './headlessCombatEngine';
import { createDnd5eConditionEffect, dnd5eActiveEmittedLight } from './activeEffects';
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement';
import { resolveDnd5eActionWithDamageReactions } from './damageReactionFlow';
import { createDnd5eDamageCommitSession } from './damageCommitSession';
async function fixture(spellId = 'fire-bolt', accept = true, miss = false) { const { package: pkg } = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson()); const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)); const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: id === 'caster' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false }); const caster = make('caster', 20); caster.classId = 'wizard'; caster.level = 1; caster.classLevels = { wizard: 1 }; caster.classSelections = { 'spell-cantrips': ['fire-bolt', 'ray-of-frost'] }; caster.pluginFeatureIds = [pkg.manifest.id + ':feat-flames-of-phlegethos']; let state = startDnd5eHeadlessCombat('real-ring', [caster, make('enemy', 10)]); state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'enemy')]: 5 }; const cast = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'caster', targetId: 'enemy', spellId, slotLevel: 0, d20: miss ? 1 : 18, effectRolls: miss ? [] : [1] }); expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true); if (!cast.ok)
    throw Error(cast.reason); const prompts: string[] = []; const armed = await settleDnd5eActivityTriggerWindowsV1({ state: cast.state, events: cast.events, eventBatchId: 'real-spell', combatRevision: 1, confirm: async (request) => { prompts.push(request.activity.id); return accept; }, roll: async () => { throw Error('ignition has no dice'); } }); state = armed.state; return { dispose, state, prompts, pkg }; }
it.each([['fire-bolt', true, false, true], ['fire-bolt', false, false, false], ['ray-of-frost', true, false, false], ['fire-bolt', true, true, true]] as const)('binds actual optional aura to fire spell cast even when miss: %s accept%s miss%s', async (spell, accept, miss, active) => { const f = await fixture(spell, accept, miss); try {
    expect(f.prompts).toEqual(spell === 'fire-bolt' ? ['flames-ring'] : []);
    expect(dnd5eActiveEmittedLight(f.state.combatants.caster.classState.activeEffects)).toEqual(active ? { brightRadiusFeet: 30, dimRadiusFeet: 30, color: '#f97316' } : undefined);
    expect(f.state.combatants.caster.turn.reactionAvailable).toBe(true);
    expect(f.state.combatants.caster.currentHp).toBe(100);
}
finally {
    f.dispose();
} });
it('keeps30+30light through creation-turn end and expires only at own next turn end', async () => { const f = await fixture(); try {
    let result = resolveDnd5eHeadlessAction(f.state, { type: 'end-turn', actorId: 'caster' });
    expect(result.ok).toBe(true);
    if (!result.ok)
        throw Error(result.reason);
    expect(dnd5eActiveEmittedLight(result.state.combatants.caster.classState.activeEffects)).toBeDefined();
    result = resolveDnd5eHeadlessAction(result.state, { type: 'end-turn', actorId: 'enemy' });
    if (!result.ok)
        throw Error(result.reason);
    expect(dnd5eActiveEmittedLight(result.state.combatants.caster.classState.activeEffects)).toBeDefined();
    result = resolveDnd5eHeadlessAction(result.state, { type: 'end-turn', actorId: 'caster' });
    if (!result.ok)
        throw Error(result.reason);
    expect(dnd5eActiveEmittedLight(result.state.combatants.caster.classState.activeEffects)).toBeUndefined();
}
finally {
    f.dispose();
} });
it.each(['melee', 'ranged', 'too-far', 'miss', 'zero-damage', 'incapacitated'] as const)('settles actual maintained ring1d4 in the parent hit, with no reaction cost: %s', async (mode) => { const f = await fixture(); try {
    const state = structuredClone(f.state);
    state.initiativeIndex = 1;
    if (mode === 'too-far')
        state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('caster', 'enemy')] = 10;
    if (mode === 'zero-damage')
        state.combatants.caster.damageImmunities = ['slashing'];
    if (mode === 'incapacitated') {
        state.combatants.caster.currentHp = 0;
        state.combatants.caster.classState.activeEffects?.push(createDnd5eConditionEffect({ condition: 'unconscious', source: { kind: 'system', rulesId: 'test-unconscious' }, targetId: 'caster' }));
    }
    const action: Dnd5eAction = { type: 'attack', actorId: 'enemy', targetId: 'caster', attackModifier: 5, d20: mode === 'miss' ? 1 : 18, d20Second: mode === 'incapacitated' ? 18 : undefined, damage: { count: 1, sides: 6, bonus: 0, rolls: mode === 'miss' ? [] : mode === 'incapacitated' ? [4, 4] : [4], type: 'slashing' }, classDamageContext: { mode: mode === 'ranged' ? 'ranged' : 'melee', weaponId: mode === 'too-far' ? 'glaive' : 'sword', weaponCategory: 'martial', weaponDamageSides: 6, reachFeet: mode === 'too-far' ? 10 : 5, damageType: 'slashing', finesse: false, strengthBased: true, adjacentEnemyOfTarget: false } };
    const original = structuredClone(state), rolls: string[] = [];
    const result = await resolveDnd5eActionWithDamageReactions({ state, action, combatRevision: 1, authorityUnchanged: () => true, confirm: async () => { throw Error('automatic ring never requests a reaction choice'); }, roll: async (request) => { rolls.push(request.id); expect(request.sides).toBe(4); expect(request.count).toBe(1); return [3]; } });
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
    if (!result.ok)
        throw Error(result.reason);
    const expected = !['ranged', 'too-far', 'miss'].includes(mode);
    expect(rolls).toHaveLength(expected ? 1 : 0);
    expect(result.state.combatants.enemy.currentHp).toBe(state.combatants.enemy.currentHp - (expected ? 3 : 0));
    expect(result.state.combatants.caster.turn.reactionAvailable).toBe(true);
    expect(state).toEqual(original);
}
finally {
    f.dispose();
} });
it('suspends before original damage and rejects forged mandatory retaliation dice without publishing HP', async () => { const f = await fixture(); try {
    f.state.initiativeIndex = 1;
    const action: Dnd5eAction = { type: 'attack', actorId: 'enemy', targetId: 'caster', attackModifier: 5, d20: 18, damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'slashing' }, classDamageContext: { mode: 'melee', weaponId: 'sword', weaponCategory: 'martial', weaponDamageSides: 6, damageType: 'slashing', finesse: false, strengthBased: true, adjacentEnemyOfTarget: false } };
    const before = structuredClone(f.state), session = createDnd5eDamageCommitSession(f.state, action, () => false), pending = session.run(f.state);
    expect(pending.status).toBe('pending-automatic-hit');
    if (pending.status !== 'pending-automatic-hit')
        throw Error(JSON.stringify(pending));
    expect(pending.snapshot.combatants.caster.currentHp).toBe(100);
    const bad = session.resumeAutomaticHit(f.state, pending.occurrence, pending.request, Object.fromEntries(pending.request.rolls.map(r => [r.id, { values: [5] }])));
    expect(bad.status).toBe('rejected');
    expect(f.state).toEqual(before);
}
finally {
    f.dispose();
} });
it('retaliates against a real melee spell hit, not only weapon attacks', async () => { const f = await fixture(); try {
    f.state.initiativeIndex = 1;
    f.state.combatants.caster.turn.reactionAvailable = false;
    const enemy = f.state.combatants.enemy;
    enemy.classId = 'wizard';
    enemy.level = 1;
    enemy.classLevels = { wizard: 1 };
    enemy.classSelections = { 'spell-cantrips': ['shocking-grasp'] };
    const result = await resolveDnd5eActionWithDamageReactions({ state: f.state, action: { type: 'cast-spell', actorId: 'enemy', targetId: 'caster', spellId: 'shocking-grasp', slotLevel: 0, d20: 18, effectRolls: [4] }, combatRevision: 1, authorityUnchanged: () => true, confirm: async () => { throw Error('automatic consequence has no choice'); }, roll: async (r) => { expect(r.sides).toBe(4); return [3]; } });
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
    expect(result.state.combatants.enemy.currentHp).toBe(96);
    expect(result.state.combatants.caster.turn.reactionAvailable).toBe(false);
}
finally {
    f.dispose();
} });

it('retaliates within the real native monster Inflict Wounds parent before committing its damage',async()=>{
  const f=await fixture()
  try{
    f.state.initiativeIndex=1
    const enemy=f.state.combatants.enemy
    enemy.statBlockId='srd-5.1:cult-fanatic'
    enemy.classState.monsterSpellSlots={'1':{current:4,max:4}}
    f.state.combatants.caster.turn.reactionAvailable=false
    const before=structuredClone(f.state),rolls:string[]=[]
    const result=await resolveDnd5eActionWithDamageReactions({state:f.state,action:{type:'monster-core-spell',actorId:'enemy',spellId:'inflict-wounds',slotLevel:1,resolution:{schemaVersion:1,targetIds:['caster'],d20:18,effectRolls:[[1,1,1]]}},combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>{throw Error('automatic ring has no reaction choice')},roll:async request=>{rolls.push(request.id);expect(request.count).toBe(1);expect(request.sides).toBe(4);return[3]}})
    expect(result.ok,result.ok?undefined:result.reason).toBe(true)
    if(!result.ok)throw Error(result.reason)
    expect(rolls).toHaveLength(1)
    expect(result.state.combatants.enemy.currentHp).toBe(before.combatants.enemy.currentHp-3)
    expect(result.state.combatants.caster.currentHp).toBe(97)
    expect(result.state.combatants.caster.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.enemy.classState.monsterSpellSlots?.['1'].current).toBe(3)
    expect(result.events.find(event=>event.type==='attack-resolved'&&event.actorId==='enemy')).toMatchObject({attackMode:'spell',attackCategory:'spell',attackDelivery:'melee',spellId:'inflict-wounds',hit:true})
    expect(f.state).toEqual(before)
  }finally{f.dispose()}
})

import { prepareDnd5eMonsterCoreSpell, resolvePreparedDnd5eMonsterCoreSpell } from './monsterCoreSpellAction'
import { resolveDnd5ePreparedWithMaterialDamageReactions } from './damageReactionFlow'
import type { BattleMap } from '../../store/maps'

it('settles a real maintained flame grant through the native monster Map facade before publishing HP or slots', async () => {
  const f = await fixture()
  try {
    // The grant comes from fixture's actual fire spell and accepted trigger, never a pre-equipped effect.
    const map: BattleMap = {id:'flames-map-facade', name:'Flames facade', width:200, height:100,
      gridSize:50, gridOffsetX:0, gridOffsetY:0, showGrid:true, feetPerCell:5, tokens:[
        {id:'caster',label:'Flames bearer',x:25,y:25,color:'',emoji:'',size:1,type:'enemy',dnd5eSide:'player',poolId:'srd-5.1:mage',hp:100,maxHp:100,
          dnd5eCombatState:{activeEffects:structuredClone(f.state.combatants.caster.classState.activeEffects)}},
        {id:'enemy',label:'Cult Fanatic',x:75,y:25,color:'',emoji:'',size:1,type:'enemy',poolId:'srd-5.1:cult-fanatic',hp:100,maxHp:100,
          dnd5eCombatState:{monsterSpellSlots:{1:{current:4,max:4}}}},
      ]}
    const initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index}))
    const ready=prepareDnd5eMonsterCoreSpell({combatId:'flames-map-facade',round:1,map,characters:[],initiativeOrder,
      actorTokenId:'enemy',targetTokenIds:['caster'],spellId:'inflict-wounds',slotLevel:1,currentInitiativeIndex:1})
    expect(ready.ok,ready.ok?undefined:ready.reason).toBe(true)
    if(!ready.ok)throw Error(ready.reason)
    const input={prepared:ready.prepared,deferForcedMovementLanding:true,resolution:{d20:18,effectRolls:[[1,1,1]]}}
    const before=structuredClone(map)
    // A caller omitting the real damage driver must reject, never silently skip mandatory dice.
    const naked=resolvePreparedDnd5eMonsterCoreSpell(input)
    expect(naked.result.ok).toBe(false)
    if(naked.result.ok)throw Error('Missing mandatory driver unexpectedly succeeded')
    expect(naked.result.reason).toBe('invalid-dice')
    expect(naked.application).toBeUndefined()
    let rolls=0
    const result=await resolveDnd5ePreparedWithMaterialDamageReactions({combatRevision:1,authorityUnchanged:()=>true,
      confirm:async()=>{throw Error('Automatic consequence does not consume the normal reaction')},
      roll:async request=>{expect(map).toEqual(before);expect(request.count).toBe(1);expect(request.sides).toBe(4);rolls++;return[4]},
    },input,resolvePreparedDnd5eMonsterCoreSpell)
    expect(result.result.ok,result.result.ok?undefined:result.result.reason).toBe(true)
    expect(rolls).toBe(1)
    expect(result.application?.map.tokens.find(token=>token.id==='caster')?.hp).toBe(97)
    expect(result.application?.map.tokens.find(token=>token.id==='enemy')?.hp).toBe(96)
    expect(result.application?.map.tokens.find(token=>token.id==='enemy')?.dnd5eCombatState?.monsterSpellSlots?.[1]).toEqual({current:3,max:4})
    expect(result.result.state.combatants.caster.turn.reactionAvailable).toBe(true)
    expect(map).toEqual(before)
  } finally {f.dispose()}
})
