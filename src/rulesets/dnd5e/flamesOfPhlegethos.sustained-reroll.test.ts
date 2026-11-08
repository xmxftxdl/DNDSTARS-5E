import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { it, expect } from 'vitest';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eCombatantPairKey } from './headlessCombatEngine';
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement';
it('rerolls a real sustained Flame Blade attack but cannot re-ignite flames as if casting again', async () => { const { package: pkg } = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson()); const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)); try {
    const abilities = { str: 10, dex: 14, con: 16, int: 10, wis: 20, cha: 10 };
    const caster = createDnd5eCombatant({ id: 'caster', name: 'Caster', controller: 'player', initiative: 20, classId: 'druid', level: 7, abilities, proficiencyBonus: 3, armorClass: 15, currentHp: 50, maxHp: 50, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false, classSelections: { 'spell-prepared': ['flame-blade'] }, classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } }, pluginFeatureIds: [pkg.manifest.id + ':feat-flames-of-phlegethos'] });
    const enemy = createDnd5eCombatant({ id: 'enemy', name: 'Enemy', controller: 'dm', initiative: 10, abilities, proficiencyBonus: 2, armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 5, y: 0 }, concentrating: false });
    const state = startDnd5eHeadlessCombat('sustained-fire', [caster, enemy]);
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(caster.id, enemy.id)]: 5 };
    const cast = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: caster.id, targetId: caster.id, spellId: 'flame-blade', slotLevel: 4, effectRolls: [] });
    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true);
    if (!cast.ok)
        throw Error(cast.reason);
    const prompts: string[] = [];
    const decline = await settleDnd5eActivityTriggerWindowsV1({ state: cast.state, events: cast.events, eventBatchId: 'actual-blade-cast', combatRevision: 1, confirm: async (r) => { prompts.push(r.activity.id); return false; }, roll: async () => { throw Error('no ignition dice'); } });
    expect(prompts).toEqual(['flames-ring']);
    const attack = resolveDnd5eHeadlessAction(decline.state, { type: 'cast-spell', actorId: caster.id, targetId: enemy.id, targetIds: [enemy.id], spellId: 'flame-blade', slotLevel: 4, sustainedEffectAttack: 'flame-blade', d20: 15, effectRolls: [1, 2, 3, 4], spellDamageDieRerolls: [{ featureId: pkg.manifest.id + ':feat-flames-of-phlegethos', rollId: 'effect', dieIndex: 0, reroll: 6 }] });
    expect(attack.ok, attack.ok ? undefined : attack.reason).toBe(true);
    if (!attack.ok)
        throw Error(attack.reason);
    expect(attack.state.combatants.enemy.currentHp).toBe(15);
    expect(attack.state.combatants.caster.classResources['dnd5e-spell-slot-4'].current).toBe(0);
    expect(attack.events.some(e => e.type === 'spell-cast')).toBe(false);
    await settleDnd5eActivityTriggerWindowsV1({ state: attack.state, events: attack.events, eventBatchId: 'actual-blade-sustain', combatRevision: 2, confirm: async () => { throw Error('sustaining is not another cast'); }, roll: async () => { throw Error('no ignition dice'); } });
}
finally {
    dispose();
} });
