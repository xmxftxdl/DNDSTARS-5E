import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { it, expect } from 'vitest';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry';
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler';
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement';
import { dnd5eActiveEmittedLight } from './activeEffects';
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability';
import { normalizeCharacter } from '../../store/characters';
import { prepareDnd5ePluginSpellCast, resolvePreparedDnd5ePluginSpellCast } from './pluginSpellTransaction';
import type { BattleMap, Token } from '../../store/maps';
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes';
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts';
it.each([['activity', 1], ['activity', 6], ['mechanics', 1], ['mechanics', 6]] as const)('settles a real imported %s spell in one map parent and offers flames from its trusted cast: %s', async (mode, reroll) => { const { package: pkg } = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson()); const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)); const namespace = 'test.flames-parent'; const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'fire-pulse-cast', name: 'Imported fire pulse', activation: { kind: 'free' }, target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 30 }, outcomes: [{ id: 'fire', when: { kind: 'always' }, operations: [{ id: 'fire', kind: 'damage', target: 'target', damageType: 'fire', amount: { kind: 'dice', rollId: 'damage', count: 2, sides: 6 } }] }], legacySource: { kind: 'spell', id: 'fire-pulse' }, automation: automationCapabilityFromLegacyStatus('full') }; let spellId = ''; const registration = mode === 'activity' ? registerDnd5eActivityPackage({ packageId: namespace, packageVersion: '1.0.0', activities: [activity] }) : undefined; const own = registerDnd5eRulesPlugin({ manifest: { id: namespace, name: 'Real imported spell path', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) { api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity, { outerSpellTransaction: true })); spellId = api.registerSpell({ id: 'fire-pulse', name: 'Imported fire pulse', level: 1, school: 'evocation', ritual: false, castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 30 }, components: { verbal: true, somatic: true, material: false }, duration: { type: 'instantaneous', concentration: false }, classes: ['wizard'], description: 'Synthetic original fire spell.', ...(mode === 'mechanics' ? { mechanics: { kind: 'damage' as const, resolution: 'automatic' as const, damage: { dice: { count: 2, sides: 6, bonus: 0 }, type: 'fire' as const } } } : {}), automation: { mode: 'headless-action', actionId: activity.id } }); } }); try {
    const actor = normalizeCharacter({ id: 'wizard', name: 'Wizard', race: '提夫林', dnd5eRaceId: 'tiefling', charClass: '法师', level: 5, abilities: { str: 10, dex: 14, con: 14, int: 16, wis: 10, cha: 10 }, dnd5eFeatIds: [pkg.manifest.id + ':flames-of-phlegethos'], dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': [spellId] } } } }, equipment: {}, maxHp: 30, currentHp: 30, classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } } });
    const token = (id: string, type: Token['type'], x: number, characterId?: string): Token => ({ id, label: id, x, y: 25, color: '', emoji: '', size: 1, type, characterId, hp: 30, maxHp: 30 });
    const caster = token('caster', 'player', 25, actor.id), enemy = token('enemy', 'enemy', 275);
    const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [caster, enemy] };
    const action: SharedPlayerActionState = { id: 'cast-imported', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: caster.id, characterId: actor.id, targetTokenId: enemy.id, dnd5eSpellCast: { spellId, castingClassId: 'wizard', slotLevel: 1, targetTokenId: enemy.id }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
    const prepared = prepareDnd5ePluginSpellCast({ action, map, characters: [actor], initiativeOrder: [caster, enemy].map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20 - i })) });
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true);
    if (!prepared.ok)
        throw Error(prepared.reason);
    expect(!!prepared.prepared.activity).toBe(mode === 'activity');
    const use = { featureId: pkg.manifest.id + ':feat-flames-of-phlegethos', rollId: mode === 'activity' ? 'damage' : 'plugin-target:0:enemy', dieIndex: 0, reroll };
    const result = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, currentRoom: { maps: [map], characters: [actor] }, rolls: mode === 'activity' ? { activityRolls: { damage: { values: [1, 4], modifier: 0, total: 5, spellDamageDieRerolls: [use] } } } : { targetRolls: [{ damageRolls: [1, 4] }], spellDamageDieRerolls: [use] } });
    expect(result.result.ok, result.result.ok ? undefined : result.result.reason).toBe(true);
    if (!result.result.ok)
        throw Error(result.result.reason);
    expect(result.application?.map.tokens.find(t => t.id === 'enemy')?.hp).toBe(30 - 4 - reroll);
    expect(result.application?.characters.find(c => c.id === actor.id)?.classResources?.['dnd5e-spell-slot-1'].current).toBe(0);
    expect(result.result.events).toContainEqual(expect.objectContaining({ type: 'spell-cast', actorId: 'caster', spellId, damageTypes: ['fire'] }));
    const prompts: string[] = [];
    const armed = await settleDnd5eActivityTriggerWindowsV1({ state: result.result.state, events: result.result.events, eventBatchId: 'real-imported-cast', combatRevision: 1, confirm: async (request) => { prompts.push(request.activity.id); return true; }, roll: async () => { throw Error('flames ignition has no dice'); } });
    expect(prompts).toEqual(['flames-ring']);
    expect(dnd5eActiveEmittedLight(armed.state.combatants.caster.classState.activeEffects)).toMatchObject({ brightRadiusFeet: 30, dimRadiusFeet: 30 });
}
finally {
    own();
    registration?.dispose();
    dispose();
} });
