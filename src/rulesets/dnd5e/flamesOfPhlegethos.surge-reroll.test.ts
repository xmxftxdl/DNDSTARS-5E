import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { it, expect } from 'vitest';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eCombatantPairKey } from './headlessCombatEngine';
import { collectDnd5eSpellDamageDieRerolls } from './spellDamageDieRerolls';
import { settleDnd5eConcentrationChecks } from '../../pages/maps/settleDnd5eCombatResult';
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement';
import { normalizeCharacter } from '../../store/characters';
import type { BattleMap } from '../../store/maps';
it('rerolls the one shared actual self-centered Fireball produced by a real post-spell table, not the nonfire triggering spell', async () => { const { package: pkg } = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson()); const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)); const own = registerDnd5eRulesPlugin({ manifest: { id: 'test.flames-surge', name: 'Synthetic actual table', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) { api.registerFeature({ id: 'table', name: 'Actual post-spell table', summary: 'Test', description: 'Test', automation: 'partial', declarativeAbility: { schemaVersion: 1, id: 'table', name: 'Actual post-spell table', description: 'Test', level: 1, trigger: { kind: 'after-spell-cast' }, targeting: { kind: 'self' }, effects: [], automation: 'partial', mechanic: { kind: 'post-spell-random-table', spellcastingClassId: 'sorcerer', minimumSpellLevel: 1, triggerDieSides: 20, triggerValues: [1], tableDieSides: 100, outcomes: [{ id: 'fireball', minimum: 42, maximum: 42, effect: { kind: 'self-centered-core-spell', spellId: 'fireball', slotLevel: 3 } }] } } }); } }); try {
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: id === 'caster' ? 'player' : 'dm', initiative, abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 18 }, proficiencyBonus: 3, armorClass: 12, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false });
    const caster = make('caster', 20), enemy = make('enemy', 10);
    caster.classId = 'sorcerer';
    caster.level = 5;
    caster.classLevels = { sorcerer: 5 };
    caster.classSelections = { 'spell-known': ['magic-missile'] };
    caster.classResources = { 'dnd5e-spell-slot-1': { current: 1, max: 4 } };
    caster.pluginFeatureIds = [pkg.manifest.id + ':feat-flames-of-phlegethos', 'test.flames-surge:table'];
    const state = startDnd5eHeadlessCombat('real-surge', [caster, enemy]);
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(caster.id, enemy.id)]: 5 };
    const cast = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: caster.id, targetId: enemy.id, spellId: 'magic-missile', slotLevel: 1, projectileTargetIds: [enemy.id, enemy.id, enemy.id], effectRolls: [1, 2, 3] });
    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true);
    if (!cast.ok)
        throw Error(cast.reason);
    expect(cast.events.some(e => e.type === 'post-spell-random-table-check-required')).toBe(true);
    const character = normalizeCharacter({ id: 'caster-char', name: 'Caster', race: '提夫林', dnd5eRaceId: 'tiefling', charClass: '术士', level: 5, abilities: caster.abilities, currentHp: 100, maxHp: 100, dnd5eFeatIds: [pkg.manifest.id + ':flames-of-phlegethos'] });
    const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [{ id: 'caster', characterId: character.id, type: 'player', label: 'Caster', x: 25, y: 25, color: '', emoji: '', size: 1, hp: 100, maxHp: 100 }, { id: 'enemy', type: 'enemy', label: 'Enemy', x: 75, y: 25, color: '', emoji: '', size: 1, hp: 100, maxHp: 100 }] };
    const choices: string[] = [];
    const settled = await settleDnd5eConcentrationChecks({ result: cast, priorState: state, map, characters: [character], characterIdByCombatantId: { caster: character.id }, rollD20: async () => 1, rollD4: async () => 1, rollDice: async (count, sides) => { if (sides === 100)
            return [42]; expect([count, sides]).toEqual([8, 6]); return Array(8).fill(1); }, chooseSpellDamageDice: async (request) => { choices.push(request.group.id); return collectDnd5eSpellDamageDieRerolls({ actor: request.actor, groups: [request.group], choose: async (r) => r.dieIndex === 0, roll: async () => 6 }); } });
    expect(choices).toEqual(['post-spell-random-table']);
    expect(settled.result.state.combatants.caster.currentHp).toBe(87);
    expect(settled.result.events).toContainEqual(expect.objectContaining({ type: 'spell-damage-dice-rerolled', spellId: 'fireball', originalValues: Array(8).fill(1), values: [6, 1, 1, 1, 1, 1, 1, 1] }));
    expect(settled.result.events).toContainEqual(expect.objectContaining({ type: 'spell-cast', spellId: 'fireball', damageTypes: ['fire'], slotConsumed: false }));
    const prompts: string[] = [];
    await settleDnd5eActivityTriggerWindowsV1({ state: settled.result.state, events: settled.result.events, eventBatchId: 'actual-surge', combatRevision: 1, confirm: async (r) => { prompts.push(r.activity.id); return false; }, roll: async () => { throw Error('no ignition dice'); } });
    expect(prompts).toEqual(['flames-ring']);
}
finally {
    own();
    dispose();
} });
