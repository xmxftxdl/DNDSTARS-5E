import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { it, expect } from 'vitest';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine';
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement';
it('offers actual cast-time optional flames before own Fireball damage incapacitates the caster', async () => {
    const { package: pkg } = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson());
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg));
    try {
        const caster = createDnd5eCombatant({ id: 'caster', name: 'Caster', initiative: 20, controller: 'player', abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, proficiencyBonus: 3, armorClass: 10, currentHp: 3, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false, classId: 'wizard', level: 5, classLevels: { wizard: 5 }, classSelections: { 'spell-prepared': ['fireball'] }, classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } }, pluginFeatureIds: [pkg.manifest.id + ':feat-flames-of-phlegethos'] });
        const enemy = createDnd5eCombatant({ id: 'enemy', name: 'Enemy', initiative: 10, controller: 'dm', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 30, y: 0 }, concentrating: false });
        const state = startDnd5eHeadlessCombat('own-fire', [caster, enemy]);
        const cast = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'caster', targetId: 'caster', targetIds: ['caster'], spellId: 'fireball', slotLevel: 3, savingThrowD20: 1, effectRolls: [1, 1, 1, 1, 1, 1, 1, 1] });
        expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true);
        if (!cast.ok)
            throw Error(cast.reason);
        expect(cast.state.combatants.caster.currentHp).toBe(0);
        const prompts: string[] = [];
        await settleDnd5eActivityTriggerWindowsV1({ state: cast.state, events: cast.events, eventBatchId: 'actual-own-fire', combatRevision: 1, confirm: async (r) => { prompts.push(r.activity.id); return true; }, roll: async () => { throw Error('ignition has no dice'); } });
        expect(prompts).toEqual(['flames-ring']);
    }
    finally {
        dispose();
    }
});
