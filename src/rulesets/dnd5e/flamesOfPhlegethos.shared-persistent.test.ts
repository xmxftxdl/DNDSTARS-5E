import { it, expect } from 'vitest';
import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { normalizeCharacter } from '../../store/characters';
import { applyDnd5eInventoryMutation } from './items';
import { prepareDnd5eSpellCast, resolvePreparedDnd5eSpellCast } from './spellAction';
import { collectDnd5ePersistentAreaTriggers } from './pluginAreas';
import { createDnd5ePersistentAreaDamageRollCoordinator, prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions';
import { collectDnd5eSpellDamageDieRerolls, collectDnd5eSpellDamageDieRerollsForSharedPool, type Dnd5eSpellDamageDieRerollUse } from './spellDamageDieRerolls';
import type { BattleMap, Token } from '../../store/maps';
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes';
it.each([1, 8])('uses one actual Wall of Fire creation pool and one subset choice for both targets, accepting new%s', async (replacement) => {
    const { package: pkg } = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson());
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg));
    try {
        let actor = normalizeCharacter({ id: 'wizard', name: 'Wizard', race: '提夫林', dnd5eRaceId: 'tiefling', charClass: '法师', level: 7,
            abilities: { str: 10, dex: 14, con: 14, int: 16, wis: 10, cha: 10 }, dnd5eFeatIds: [pkg.manifest.id + ':flames-of-phlegethos'],
            dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['wall-of-fire'] } } } }, equipment: {},
            currentHp: 50, maxHp: 50, classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } } });
        const supply = applyDnd5eInventoryMutation([actor], { type: 'grant', characterId: actor.id, templateId: 'srd-5.1:item:component-pouch', quantity: 1 });
        expect(supply.ok).toBe(true);
        actor = supply.characters[0];
        const token = (id: string, type: Token['type'], x: number, characterId?: string): Token => ({ id, label: id, x, y: 25, color: '', emoji: '', size: 1, type, characterId, hp: 50, maxHp: 50 });
        const caster = token('caster', 'player', 25, actor.id), first = token('first', 'enemy', 125), second = token('second', 'enemy', 175);
        caster.y = 225;
        const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [caster, first, second] };
        const order = map.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20 - i }));
        const action: SharedPlayerActionState = { id: 'real-wall', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: caster.id, characterId: actor.id,
            dnd5eSpellCast: { spellId: 'wall-of-fire', castingClassId: 'wizard', slotLevel: 4, targetTokenId: first.id, areaTargetCell: { col: 2, row: 0 } }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
        const ready = prepareDnd5eSpellCast({ action, map, characters: [actor], initiativeOrder: order });
        expect(ready.ok, ready.ok ? undefined : ready.reason).toBe(true);
        if (!ready.ok)
            throw Error(ready.reason);
        const cast = resolvePreparedDnd5eSpellCast({ prepared: ready.prepared, effectRolls: [] });
        expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true);
        if (!cast.application)
            throw Error('missing actual wall cast application');
        const area = cast.application.map.dnd5ePluginAreas?.find(area => area.coreSpellId === 'wall-of-fire');
        expect(area).toBeDefined();
        if (!area)
            throw Error('missing actual wall');
        const candidates = collectDnd5ePersistentAreaTriggers({ map: cast.application.map, timing: 'on-create', round: 1, areaId: area.id, turnKey: '1:caster' });
        expect(candidates.map(candidate => candidate.targetToken.id)).toEqual(['first', 'second']);
        let damageRollCount = 0, choiceCollections = 0;
        const chosenIndices: number[] = [], pools: (readonly number[])[] = [];
        const coordinate = createDnd5ePersistentAreaDamageRollCoordinator(async (count, sides) => { damageRollCount++; expect([count, sides]).toEqual([5, 8]); return [1, 1, 1, 1, 1]; });
        const cache = new WeakMap<readonly number[], Promise<readonly Dnd5eSpellDamageDieRerollUse[]>>();
        let application = cast.application;
        for (const candidate of candidates) {
            const prepared = prepareDnd5ePersistentAreaTrigger({ map: application.map, characters: application.characters, initiativeOrder: order, combatId: 'combat', round: 1, candidate });
            expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true);
            if (!prepared.ok)
                throw Error(prepared.reason);
            const raw = await coordinate({ areaId: area.id, rollerTokenId: caster.id, triggerId: candidate.trigger.id, timing: candidate.trigger.timing, count: 5, sides: 8, label: 'Wall of Fire', targetName: candidate.targetToken.label });
            pools.push(raw);
            const source = prepared.prepared.state.combatants[caster.id];
            const group = { id: 'persistent:' + area.id + ':' + candidate.trigger.id, sides: 8, damageType: 'fire' as const, rolls: raw };
            const uses = await collectDnd5eSpellDamageDieRerollsForSharedPool(cache, raw, () => {
                choiceCollections++;
                return collectDnd5eSpellDamageDieRerolls({ actor: source, groups: [group], choose: async (request) => { chosenIndices.push(request.dieIndex); return request.dieIndex === 0 || request.dieIndex === 2; }, roll: async () => replacement });
            });
            const resolved = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared, d20: 1, damageRolls: raw, spellDamageDieRerolls: uses });
            expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true);
            if (!resolved.application)
                throw Error('missing real wave application');
            expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'spell-damage-dice-rerolled', actorId: caster.id, spellId: 'wall-of-fire', originalValues: [1, 1, 1, 1, 1], values: [replacement, 1, replacement, 1, 1] }));
            application = resolved.application;
        }
        expect(damageRollCount).toBe(1);
        expect(choiceCollections).toBe(1);
        expect(chosenIndices).toEqual([0, 1, 2, 3, 4]);
        expect(pools[0]).toBe(pools[1]);
        for (const id of [first.id, second.id])
            expect(application.map.tokens.find(t => t.id === id)?.hp).toBe(50 - 3 - 2 * replacement);
        expect(application.characters[0].classResources?.['dnd5e-spell-slot-4'].current).toBe(0);
    }
    finally {
        dispose();
    }
});
