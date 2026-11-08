import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { it, expect } from 'vitest';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { createDnd5eCombatant, startDnd5eHeadlessCombat, dnd5eCombatantPairKey } from './headlessCombatEngine';
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry';
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority';
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability';
it.each(['new-one', 'new-six', 'unowned', 'cold', 'nonspell', 'nonone', 'duplicate'] as const)('uses original own spell fire dice in real registered Activity authority: %s', async (mode) => { const { package: pkg } = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson()); const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)); let spellId = ''; const own = registerDnd5eRulesPlugin({ manifest: { id: 'test.flames-imported', name: 'Imported fire spell', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) { spellId = api.registerSpell({ id: 'fire-pulse', name: 'Imported fire pulse', level: 1, school: 'evocation', ritual: false, castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 30 }, components: { verbal: true, somatic: true, material: false }, duration: { type: 'instantaneous', concentration: false }, classes: ['wizard'], description: 'Synthetic test spell.', automation: { mode: 'reference-only' } }); } }); const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1 as const, id: 'fire-pulse-cast', name: 'Imported fire pulse', activation: { kind: 'action' as const }, target: { kind: 'creature' as const, relation: 'any' as const, count: 1, rangeFeet: 30 }, legacySource: mode === 'nonspell' ? { kind: 'feature' as const, id: 'pulse' } : { kind: 'spell' as const, id: 'fire-pulse' }, consumption: [{ kind: 'spell-slot' as const, minimumLevel: 1, level: 'selected' as const, amount: 1, consumeOn: 'resolve' as const }], outcomes: [{ id: 'fire', when: { kind: 'always' as const }, operations: [{ id: 'fire', kind: 'damage' as const, target: 'target' as const, damageType: mode === 'cold' ? 'cold' as const : 'fire' as const, amount: { kind: 'dice' as const, rollId: 'damage', count: 2, sides: 6 } }] }], automation: automationCapabilityFromLegacyStatus('full') }; const registration = registerDnd5eActivityPackage({ packageId: 'test.flames-imported', packageVersion: '1.0.0', activities: [activity] }); try {
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative, classId: 'wizard', level: 3, classLevels: { wizard: 3 }, abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 12, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false });
    const actor = make('caster', 20);
    actor.classSelections = { 'spell-prepared': [spellId] };
    actor.classResources = { 'dnd5e-spell-slot-1': { current: 1, max: 1 } };
    actor.pluginFeatureIds = mode === 'unowned' ? [] : [pkg.manifest.id + ':feat-flames-of-phlegethos'];
    if (mode === 'nonspell')
        actor.pluginFeatureIds = [...actor.pluginFeatureIds, 'test.flames-imported:pulse'];
    const state = startDnd5eHeadlessCombat('imported-spell', [actor, make('target', 10)]);
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'target')]: 5 };
    const before = structuredClone(state), use = { featureId: pkg.manifest.id + ':feat-flames-of-phlegethos', rollId: 'damage', dieIndex: mode === 'nonone' ? 1 : 0, reroll: mode === 'new-six' ? 6 : 1 };
    const result = resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1, command: { schemaVersion: 1, commandId: 'actual-imported-spell', actorId: 'caster', packageId: 'test.flames-imported', packageVersion: '1.0.0', activityId: activity.id, targetIds: ['target'], expectedRevision: 1, castLevel: 1 }, authoritativeRolls: { damage: { values: [1, 4], spellDamageDieRerolls: mode === 'duplicate' ? [use, use] : [use] } }, confirmedBy: 'actor' });
    const accepted = mode === 'new-one' || mode === 'new-six';
    expect(result.result.ok, JSON.stringify(result.result)).toBe(accepted);
    if (result.result.ok) {
        expect(result.result.state.combatants.target.currentHp).toBe(30 - 4 - use.reroll);
        expect(result.result.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(0);
    }
    expect(state).toEqual(before);
}
finally {
    registration.dispose();
    own();
    dispose();
} });
