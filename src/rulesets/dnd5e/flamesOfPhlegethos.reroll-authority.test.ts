import { it, expect } from 'vitest';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { collectDnd5eSpellDamageDieRerolls, applyDnd5eSpellDamageDieRerolls, type Dnd5eSpellDamageDieRerollUse } from './spellDamageDieRerolls';
function setup() { const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.flames', name: 'Synthetic dice rule', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) { api.registerFeat({ id: 'flames', name: 'Flames', summary: 'Synthetic', description: 'Synthetic', automation: 'full', declarativeAbility: { schemaVersion: 1, id: 'reroll', name: 'Reroll', description: 'Synthetic', level: 1, trigger: { kind: 'passive' }, cost: { economy: 'none' }, targeting: { kind: 'self' }, effects: [], mechanic: { kind: 'spell-damage-dice-reroll', damageTypes: ['fire'], originalFaces: [1], maximumRerollsPerDie: 1 }, automation: 'full' } }); } }); return { dispose, actor: { pluginFeatureIds: ['test.flames:feat-flames'] }, group: { id: 'effect', sides: 6, damageType: 'fire' as const, rolls: [1, 4, 1] }, use: { featureId: 'test.flames:feat-flames', rollId: 'effect', dieIndex: 0, reroll: 1 } }; }
it.each([1, 6])('keeps original faces immutable and accepts the chosen replacement even when it is1: %s', reroll => { const f = setup(); try {
    const before = structuredClone(f.group), result = applyDnd5eSpellDamageDieRerolls(f.actor, [f.group], [{ ...f.use, reroll }]);
    expect(result.get('effect')).toEqual([reroll, 4, 1]);
    expect(f.group).toEqual(before);
}
finally {
    f.dispose();
} });
it('allows any subset, including none and multiple original1 dice', () => { const f = setup(); try {
    expect(applyDnd5eSpellDamageDieRerolls(f.actor, [f.group], []).get('effect')).toEqual([1, 4, 1]);
    expect(applyDnd5eSpellDamageDieRerolls(f.actor, [f.group], [{ ...f.use, reroll: 2 }, { ...f.use, dieIndex: 2, reroll: 5 }]).get('effect')).toEqual([2, 4, 5]);
}
finally {
    f.dispose();
} });
it.each(['unowned', 'wrong-feature', 'nonfire', 'nonone', 'duplicate', 'again-after-new1', 'wrong-roll', 'out-of-range', 'invalid-face'])('rejects an unauthorized or repeated replacement: %s', mode => { const f = setup(); try {
    const actor = mode === 'unowned' ? { pluginFeatureIds: [] } : f.actor, group = mode === 'nonfire' ? { ...f.group, damageType: 'cold' as const } : f.group;
    let uses: Dnd5eSpellDamageDieRerollUse[] = [f.use];
    if (mode === 'wrong-feature')
        uses = [{ ...f.use, featureId: 'other:feat-flames' }];
    if (mode === 'nonone')
        uses = [{ ...f.use, dieIndex: 1 }];
    if (mode === 'duplicate' || mode === 'again-after-new1')
        uses = [f.use, { ...f.use, reroll: 6 }];
    if (mode === 'wrong-roll')
        uses = [{ ...f.use, rollId: 'another' }];
    if (mode === 'out-of-range')
        uses = [{ ...f.use, dieIndex: 3 }];
    if (mode === 'invalid-face')
        uses = [{ ...f.use, reroll: 7 }];
    expect(() => applyDnd5eSpellDamageDieRerolls(actor, [group], uses)).toThrow('spell-damage-die-reroll-invalid');
}
finally {
    f.dispose();
} });
it('collects only owned original fire1 dice, preserving subset choices and accepting replacement1', async () => { const f = setup(); try {
    const choices: number[] = [], rolls: number[] = [];
    const source = structuredClone(f.group);
    const uses = await collectDnd5eSpellDamageDieRerolls({ actor: f.actor, groups: [f.group, { ...f.group, id: 'cold', damageType: 'cold' }], choose: async (r) => { choices.push(r.dieIndex); return r.dieIndex === 0; }, roll: async (r) => { rolls.push(r.dieIndex); return 1; } });
    expect(choices).toEqual([0, 2]);
    expect(rolls).toEqual([0]);
    expect(uses).toEqual([f.use]);
    expect(f.group).toEqual(source);
}
finally {
    f.dispose();
} });
it('does not ask or roll when the character does not own the feat', async () => { const f = setup(); try {
    const uses = await collectDnd5eSpellDamageDieRerolls({ actor: { pluginFeatureIds: [] }, groups: [f.group], choose: async () => { throw Error('unowned choice'); }, roll: async () => { throw Error('unowned roll'); } });
    expect(uses).toEqual([]);
}
finally {
    f.dispose();
} });
