import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { it, expect } from 'vitest';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eCombatantPairKey } from './headlessCombatEngine';
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement';
import { resolveDnd5eActionWithDamageReactions } from './damageReactionFlow';
async function fixture(spellId = 'fire-bolt', accept = true, miss = false) { const { package: pkg } = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson()); const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)); const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: id === 'caster' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false }); const caster = make('caster', 20); caster.classId = 'wizard'; caster.level = 1; caster.classLevels = { wizard: 1 }; caster.classSelections = { 'spell-cantrips': ['fire-bolt', 'ray-of-frost'] }; caster.pluginFeatureIds = [pkg.manifest.id + ':feat-flames-of-phlegethos']; let state = startDnd5eHeadlessCombat('real-ring', [caster, make('enemy', 10)]); state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'enemy')]: 5 }; const cast = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'caster', targetId: 'enemy', spellId, slotLevel: 0, d20: miss ? 1 : 18, effectRolls: miss ? [] : [1] }); expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true); if (!cast.ok)
    throw Error(cast.reason); const prompts: string[] = []; const armed = await settleDnd5eActivityTriggerWindowsV1({ state: cast.state, events: cast.events, eventBatchId: 'real-spell', combatRevision: 1, confirm: async (request) => { prompts.push(request.activity.id); return accept; }, roll: async () => { throw Error('ignition has no dice'); } }); state = armed.state; return { dispose, state, prompts, pkg }; }
it('does not offer the feat fire die again for its own maintained1d4 consequence', async () => { const f = await fixture(); try {
    f.state.initiativeIndex = 1;
    const result = await resolveDnd5eActionWithDamageReactions({ state: f.state, action: { type: 'attack', actorId: 'enemy', targetId: 'caster', attackModifier: 5, d20: 18, damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'slashing' }, classDamageContext: { mode: 'melee', weaponId: 'sword', weaponCategory: 'martial', weaponDamageSides: 6, damageType: 'slashing', finesse: false, strengthBased: true, adjacentEnemyOfTarget: false } }, combatRevision: 1, authorityUnchanged: () => true, confirm: async () => { throw Error('automatic consequence no choice'); }, roll: async (r) => { expect(r.sides).toBe(4); return [1]; }, chooseSpellDamageDice: async () => { throw Error('feat consequence is not spell damage'); } });
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
    if (!result.ok)
        throw Error(result.reason);
    expect(result.state.combatants.enemy.currentHp).toBe(f.state.combatants.enemy.currentHp - 1);
    expect(result.state.combatants.caster.turn.reactionAvailable).toBe(true);
}
finally {
    f.dispose();
} });
