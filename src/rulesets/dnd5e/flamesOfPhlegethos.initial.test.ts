import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { it, expect } from 'vitest';
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine';
import { dnd5eActivityTriggerContextsFromCombatEventV1 } from './activities/dnd5eActivityTriggerWindows';
import { dnd5eContextPredicateSatisfiedV1 } from './activities/dnd5eActivityInvocation';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eContentPackageAutomationCoverageV2 } from './contentPackageV2';
it('compiles the complete original-text candidate through actual API0 local collection without manual gaps', async () => {
    const prepared = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson());
    const coverage = dnd5eContentPackageAutomationCoverageV2(prepared.package).entries.find(e => e.category === 'feat' && e.id === 'flames-of-phlegethos');
    expect(coverage?.status, JSON.stringify(coverage)).toBe('full');
});
it.each([['fire-bolt', true], ['ray-of-frost', false]] as const)('binds the ring fire predicate to actual native spell cast metadata: %s', (spellId, expected) => {
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: id === 'caster' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false });
    const caster = make('caster', 20);
    caster.classId = 'wizard';
    caster.level = 1;
    caster.classLevels = { wizard: 1 };
    caster.classSelections = { 'spell-cantrips': ['fire-bolt', 'ray-of-frost'] };
    const state = startDnd5eHeadlessCombat('flames-native', [caster, make('enemy', 10)]);
    const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'caster', targetId: 'enemy', spellId, slotLevel: 0, d20: 18, effectRolls: [1] });
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
    if (!result.ok)
        throw Error(result.reason);
    const index = result.events.findIndex(e => e.type === 'spell-cast');
    expect(index).toBeGreaterThanOrEqual(0);
    const context = dnd5eActivityTriggerContextsFromCombatEventV1(result.state, result.events[index], index, 'flames-real-native', result.events).find(c => c.event === 'spell-cast');
    const predicate = { kind: 'spell-used' as const, damageTypes: ['fire' as const] };
    expect(dnd5eContextPredicateSatisfiedV1(predicate, context)).toBe(expected);
});
