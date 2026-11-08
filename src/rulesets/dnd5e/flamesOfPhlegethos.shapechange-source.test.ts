import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { it, expect } from 'vitest';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin, dnd5ePluginHeadlessActionDefinition } from './pluginApi';
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine';
import { dnd5eActivityTriggerContextsFromCombatEventV1 } from './activities/dnd5eActivityTriggerWindows';
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement';
it.each([undefined, 1, 6] as const)('retains the real feat through Shapechange, optional original1→%s, and actual innate Fireball ring', async (replacement) => {
    const { package: pkg } = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson());
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg));
    try {
        dnd5ePluginHeadlessActionDefinition('srd-5.1', 'spell:shapechange');
        const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: id === 'caster' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 20, wis: 10, cha: 16 }, proficiencyBonus: 6, armorClass: 10, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: id === 'caster' ? 0 : 30, y: 0 }, concentrating: false });
        const caster = make('caster', 20);
        caster.classId = 'wizard';
        caster.level = 20;
        caster.classLevels = { wizard: 20 };
        caster.classSelections = { 'spell-prepared': ['shapechange'] };
        caster.classSelectionsByClass = { wizard: { 'spell-prepared': ['shapechange'] } };
        caster.classResources = { 'dnd5e-spell-slot-9': { current: 1, max: 1 } };
        caster.pluginFeatureIds = [pkg.manifest.id + ':feat-flames-of-phlegethos'];
        let state = startDnd5eHeadlessCombat('shapechange-own-fire', [caster, make('enemy', 10)]);
        const transformed = resolveDnd5eHeadlessAction(state, { type: 'plugin-spell-activity', actorId: 'caster', pluginAction: { type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:shapechange', transactionId: 'real-shapechange', actorId: 'caster', targetId: 'caster', targetIds: ['caster'], distanceFeet: 0, castLevel: 9, payload: { activityChoices: { mode: 'srd-5.1:pit-fiend', equipment: 'merge' } }, rolls: {}, interruptChoiceId: 'dm-apply' }, spell: { castingClassId: 'wizard', spellId: 'shapechange', spellName: '形体变化', spellLevel: 9, slotLevel: 9, castingTime: 'action', declaredTargetIds: ['caster'], concentrationRounds: 600, concentrationTargetIds: ['caster'], spellSchool: 'transmutation' } });
        expect(transformed.ok, transformed.ok ? undefined : transformed.reason).toBe(true);
        if (!transformed.ok)
            throw Error(transformed.reason);
        expect(transformed.state.combatants.caster.classState.wildShapeMode).toBe('shapechange');
        expect(transformed.state.combatants.caster.pluginFeatureIds).toContain(pkg.manifest.id + ':feat-flames-of-phlegethos');
        state = transformed.state;
        for (const actorId of ['caster', 'enemy']) {
            const turn = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId });
            expect(turn.ok).toBe(true);
            if (!turn.ok)
                throw Error(turn.reason);
            state = turn.state;
        }
        const cast = resolveDnd5eHeadlessAction(state, { type: 'monster-core-spell', actorId: 'caster', spellId: 'fireball', slotLevel: 3, resolution: { ...(replacement === undefined ? {} : { spellDamageDieRerolls: [{ featureId: pkg.manifest.id + ':feat-flames-of-phlegethos', rollId: 'monster-core:0', dieIndex: 0, reroll: replacement }] }), schemaVersion: 1, targetIds: ['enemy'], targetSavingThrows: [{ targetId: 'enemy', d20: 1 }], effectRolls: [[1, 1, 1, 1, 1, 1, 1, 1]] } });
        expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true);
        if (!cast.ok)
            throw Error(cast.reason);
        expect(cast.state.combatants.enemy.currentHp).toBe(92 - (replacement ?? 1) + 1);
        expect(cast.state.combatants.caster.turn.reactionAvailable).toBe(true);
        const audit = cast.events.filter(e => e.type === 'spell-damage-dice-rerolled');
        expect(audit).toHaveLength(replacement === undefined ? 0 : 1);
        if (audit[0]?.type === 'spell-damage-dice-rerolled') {
            expect(audit[0].originalValues).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
            expect(audit[0].values).toEqual([replacement, 1, 1, 1, 1, 1, 1, 1]);
        }
        const castIndex = cast.events.findIndex(e => e.type === 'monster-spell-cast');
        const contexts = dnd5eActivityTriggerContextsFromCombatEventV1(cast.state, cast.events[castIndex], castIndex, 'actual-innate-fire', cast.events);
        expect(contexts[0].eligibleTargetIds).toEqual(['enemy']);
        const prompts: string[] = [];
        await settleDnd5eActivityTriggerWindowsV1({ state: cast.state, events: cast.events, eventBatchId: 'actual-innate-fire', combatRevision: 1, confirm: async (r) => { prompts.push(r.activity.id); return false; }, roll: async () => { throw Error('ring cast no dice'); } });
        expect(prompts).toEqual(['flames-ring']);
    }
    finally {
        dispose();
    }
});
