import { it, expect } from 'vitest';
import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { registerDnd5eRulesPlugin, dnd5ePluginFeatureDefinition } from './pluginApi';
import { dnd5eSpellDamageDieRerollRules, collectDnd5eSpellDamageDieRerolls, applyDnd5eSpellDamageDieRerolls } from './spellDamageDieRerolls';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { normalizeCharacter } from '../../store/characters';
import { applyDnd5eInventoryMutation } from './items';
import { prepareDnd5eSpellCast, resolvePreparedDnd5eSpellCast } from './spellAction';
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement';
import { dnd5eActiveEmittedLight } from './activeEffects';
import type { BattleMap, Token } from '../../store/maps';
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes';
it.each(['manual', 'partial'] as const)('never mechanically executes a legally registered full feature with %s inner ability', async (automation) => {
    let featureId = '';
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.flames-mixed', name: 'Mixed authored automation', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
            api.registerFeat({ id: 'flames', name: 'Flames', summary: 'Authored source boundary', description: 'Full outer entry does not authorize manual inner mechanics.', automation: 'full',
                declarativeAbility: { schemaVersion: 1, id: 'reroll', name: 'Reroll', description: 'Manual or partial authored rule.', level: 1, trigger: { kind: 'passive' }, cost: { economy: 'none' }, targeting: { kind: 'self' }, effects: [],
                    mechanic: { kind: 'spell-damage-dice-reroll', damageTypes: ['fire'], originalFaces: [1], maximumRerollsPerDie: 1 }, automation } });
            featureId = 'test.flames-mixed:feat-flames';
        } });
    try {
        expect(dnd5ePluginFeatureDefinition(featureId)).toMatchObject({ automation: 'full', declarativeAbility: { automation } });
        const actor = { pluginFeatureIds: [featureId] }, group = { id: 'effect', sides: 6, damageType: 'fire' as const, rolls: [1, 4] };
        expect(dnd5eSpellDamageDieRerollRules(actor)).toEqual([]);
        const uses = await collectDnd5eSpellDamageDieRerolls({ actor, groups: [group], choose: async () => { throw Error('manual rule must not prompt'); }, roll: async () => { throw Error('manual rule must not roll'); } });
        expect(uses).toEqual([]);
        expect(() => applyDnd5eSpellDamageDieRerolls(actor, [group], [{ featureId, rollId: 'effect', dieIndex: 0, reroll: 6 }])).toThrow('spell-damage-die-reroll-invalid');
    }
    finally {
        dispose();
    }
});
it.each(['human', 'tiefling'] as const)('uses real Map prerequisite authority despite copied feat id and original spell pool: %s', async (race) => {
    const { package: pkg } = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson());
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg));
    try {
        const featureId = pkg.manifest.id + ':feat-flames-of-phlegethos';
        let actor = normalizeCharacter({ id: 'wizard', name: 'Wizard', race, dnd5eRaceId: race, charClass: '法师', level: 5,
            abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 }, dnd5eFeatIds: [pkg.manifest.id + ':flames-of-phlegethos'],
            dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['fireball'] } } } }, equipment: {}, currentHp: 30, maxHp: 30,
            classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } } });
        const supply = applyDnd5eInventoryMutation([actor], { type: 'grant', characterId: actor.id, templateId: 'srd-5.1:item:component-pouch', quantity: 1 });
        expect(supply.ok).toBe(true);
        actor = supply.characters[0];
        expect(actor.dnd5eFeatIds).toContain(pkg.manifest.id + ':flames-of-phlegethos');
        const token = (id: string, type: Token['type'], x: number, characterId?: string): Token => ({ id, label: id, x, y: 25, color: '', emoji: '', size: 1, type, characterId, hp: 30, maxHp: 30 });
        const caster = token('caster', 'player', 25, actor.id), enemy = token('enemy', 'enemy', 275);
        const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [caster, enemy] };
        const action: SharedPlayerActionState = { id: 'real-prerequisite', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: caster.id, characterId: actor.id,
            dnd5eSpellCast: { spellId: 'fireball', castingClassId: 'wizard', slotLevel: 3, targetTokenId: enemy.id, targetTokenIds: [enemy.id], areaTargetCell: { col: 5, row: 0 } }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
        const prepared = prepareDnd5eSpellCast({ action, map, characters: [actor], initiativeOrder: [caster, enemy].map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20 - i })) });
        expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true);
        if (!prepared.ok)
            throw Error(prepared.reason);
        expect(prepared.prepared.state.combatants.caster.pluginFeatureIds.includes(featureId)).toBe(race === 'tiefling');
        const before = structuredClone(prepared.prepared), rolls = Array(8).fill(1);
        const rerolled = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, savingThrowD20: 1, effectRolls: rolls, spellDamageDieRerolls: [{ featureId, rollId: 'effect', dieIndex: 0, reroll: 6 }] });
        expect(rerolled.result.ok).toBe(race === 'tiefling');
        if (race === 'human') {
            expect(rerolled.result.ok ? undefined : rerolled.result.reason).toBe('invalid-dice');
            expect(rerolled.application).toBeUndefined();
        }
        expect(prepared.prepared).toEqual(before);
        const ordinary = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, savingThrowD20: 1, effectRolls: rolls });
        expect(ordinary.result.ok, ordinary.result.ok ? undefined : ordinary.result.reason).toBe(true);
        if (!ordinary.result.ok)
            throw Error(ordinary.result.reason);
        expect(ordinary.application?.characters[0].classResources?.['dnd5e-spell-slot-3'].current).toBe(0);
        expect(ordinary.application?.map.tokens.find(t => t.id === enemy.id)?.hp).toBe(22);
        const prompts: string[] = [];
        const settled = await settleDnd5eActivityTriggerWindowsV1({ state: ordinary.result.state, events: ordinary.result.events, eventBatchId: 'prerequisite-cast', combatRevision: 1,
            confirm: async (request) => { prompts.push(request.activity.id); return true; }, roll: async () => { throw Error('ring has no roll'); } });
        expect(prompts).toEqual(race === 'tiefling' ? ['flames-ring'] : []);
        expect(dnd5eActiveEmittedLight(settled.state.combatants.caster.classState.activeEffects) != null).toBe(race === 'tiefling');
    }
    finally {
        dispose();
    }
});
