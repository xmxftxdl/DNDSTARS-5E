import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { it, expect } from 'vitest';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine';
import { createDnd5eMechanicalEffect } from './activeEffects';
it.each(['new-one', 'new-six', 'bearer-only', 'feature-source', 'cold', 'nonone', 'duplicate'] as const)('rerolls only the concrete caster own persistent spell fire dice on another turn: %s', async (mode) => { const { package: pkg } = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson()); const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)); try {
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative, abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false });
    const caster = make('caster', 20), target = make('target', 10), feature = pkg.manifest.id + ':feat-flames-of-phlegethos';
    caster.pluginFeatureIds = mode === 'bearer-only' ? [] : [feature];
    target.pluginFeatureIds = mode === 'bearer-only' ? [feature] : [];
    const burn = createDnd5eMechanicalEffect({ id: 'source-bound-burn', definitionId: 'source-bound-burn', label: 'Source-bound spell burn', targetId: target.id, source: { kind: mode === 'feature-source' ? 'feature' : 'spell', actorId: caster.id, rulesId: 'installed-fire-spell' }, periodicDamage: { timing: 'target-turn-end', count: 2, sides: 6, type: mode === 'cold' ? 'cold' : 'fire' } });
    target.classState.activeEffects = [burn];
    const state = startDnd5eHeadlessCombat('periodic-spell', [caster, target]);
    state.initiativeIndex = 1;
    const before = structuredClone(state), use = { featureId: feature, rollId: 'periodic:' + burn.id + ':' + target.id, dieIndex: mode === 'nonone' ? 1 : 0, reroll: mode === 'new-six' ? 6 : 1 };
    const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: target.id, deferNextTurnStart: true, activeEffectPeriodicDamageRolls: [{ effectId: burn.id, targetId: target.id, rolls: [1, 4], spellDamageDieRerolls: mode === 'duplicate' ? [use, use] : [use] }] });
    const expected = mode === 'new-one' || mode === 'new-six';
    expect(result.ok, result.ok ? undefined : result.reason).toBe(expected);
    if (result.ok) {
        expect(result.state.combatants.target.currentHp).toBe(100 - 4 - use.reroll);
        expect(result.state.combatants.caster.currentHp).toBe(100);
        expect(result.state.combatants.caster.turn.reactionAvailable).toBe(true);
        expect(result.events).toContainEqual(expect.objectContaining({ type: 'spell-damage-dice-rerolled', actorId: 'caster', originalValues: [1, 4], values: [use.reroll, 4] }));
    }
    expect(state).toEqual(before);
}
finally {
    dispose();
} });
