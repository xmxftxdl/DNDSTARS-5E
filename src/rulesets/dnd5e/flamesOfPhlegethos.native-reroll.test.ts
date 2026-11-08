import { it, expect } from 'vitest';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, type Dnd5eAction } from './headlessCombatEngine';
function fixture() { const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.flames-native', name: 'Native rule', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) { api.registerFeat({ id: 'flames', name: 'Flames', summary: 'Synthetic', description: 'Synthetic', automation: 'full', declarativeAbility: { schemaVersion: 1, id: 'reroll', name: 'Reroll', description: 'Synthetic', level: 1, trigger: { kind: 'passive' }, cost: { economy: 'none' }, targeting: { kind: 'self' }, effects: [], mechanic: { kind: 'spell-damage-dice-reroll', damageTypes: ['fire'], originalFaces: [1], maximumRerollsPerDie: 1 }, automation: 'full' } }); } }); const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: id === 'caster' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false }); const caster = make('caster', 20); caster.classId = 'wizard'; caster.level = 5; caster.classLevels = { wizard: 5 }; caster.classSelections = { 'spell-cantrips': ['fire-bolt', 'ray-of-frost'], 'spell-prepared': ['fireball'] }; caster.pluginFeatureIds = ['test.flames-native:feat-flames']; caster.classResources = { 'dnd5e-spell-slot-3': { current: 1, max: 1 } }; return { dispose, state: startDnd5eHeadlessCombat('flames-native-dice', [caster, make('enemy', 10)]), featureId: 'test.flames-native:feat-flames' }; }
it.each([1, 10])('executes actual native spell using replacement even if new1, without sorcery/reaction cost: %s', reroll => { const f = fixture(); try {
    const before = structuredClone(f.state);
    const result = resolveDnd5eHeadlessAction(f.state, { type: 'cast-spell', actorId: 'caster', targetId: 'enemy', spellId: 'fire-bolt', slotLevel: 0, d20: 18, effectRolls: [1, 4], spellDamageDieRerolls: [{ featureId: f.featureId, rollId: 'effect', dieIndex: 0, reroll }] });
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
    if (!result.ok)
        throw Error(result.reason);
    expect(result.state.combatants.enemy.currentHp).toBe(100 - reroll - 4);
    expect(result.events.find(event => event.type === 'spell-damage-dice-rerolled')).toMatchObject({ type: 'spell-damage-dice-rerolled', actorId: 'caster', spellId: 'fire-bolt', rollId: 'effect', originalValues: [1, 4], values: [reroll, 4], selections: [{ featureId: f.featureId, rollId: 'effect', dieIndex: 0, reroll }] });
    expect(result.state.combatants.caster.turn.reactionAvailable).toBe(true);
    expect(result.state.combatants.caster.classResources).toEqual(before.combatants.caster.classResources);
    expect(f.state).toEqual(before);
}
finally {
    f.dispose();
} });
it('executes actual fireball with one shared replacement and exactly one slot spent', () => { const f = fixture(); try {
    const result = resolveDnd5eHeadlessAction(f.state, { type: 'cast-spell', actorId: 'caster', targetId: 'enemy', targetIds: ['enemy'], spellId: 'fireball', slotLevel: 3, savingThrowD20: 1, effectRolls: Array(8).fill(1), spellDamageDieRerolls: [{ featureId: f.featureId, rollId: 'effect', dieIndex: 3, reroll: 6 }] });
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
    if (!result.ok)
        throw Error(result.reason);
    expect(result.state.combatants.enemy.currentHp).toBe(87);
    expect(result.state.combatants.caster.classResources['dnd5e-spell-slot-3'].current).toBe(0);
    expect(result.events.filter(e => e.type === 'spell-damage-dice-rerolled')).toHaveLength(1);
}
finally {
    f.dispose();
} });
it.each(['cold', 'unowned', 'not-one', 'duplicate', 'wrong-group'])('rejects forged native replacement atomically: %s', mode => { const f = fixture(); try {
    if (mode === 'unowned')
        f.state.combatants.caster.pluginFeatureIds = [];
    const before = structuredClone(f.state);
    const use = { featureId: f.featureId, rollId: mode === 'wrong-group' ? 'other' : 'effect', dieIndex: mode === 'not-one' ? 1 : 0, reroll: 6 };
    const action: Dnd5eAction = { type: 'cast-spell', actorId: 'caster', targetId: 'enemy', spellId: mode === 'cold' ? 'ray-of-frost' : 'fire-bolt', slotLevel: 0, d20: 18, effectRolls: [1, 4], spellDamageDieRerolls: mode === 'duplicate' ? [use, use] : [use] };
    const result = resolveDnd5eHeadlessAction(f.state, action);
    expect(result.ok).toBe(false);
    expect(result.state).toEqual(before);
    expect(f.state).toEqual(before);
}
finally {
    f.dispose();
} });
