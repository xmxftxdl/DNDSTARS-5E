import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { applyDnd5eInventoryMutation } from './items';
import { it, expect } from 'vitest';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { normalizeCharacter } from '../../store/characters';
import { prepareDnd5eSpellCast, resolvePreparedDnd5eSpellCast } from './spellAction';
import { collectDnd5ePersistentAreaTriggers } from './pluginAreas';
import { prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions';
import type { BattleMap, Token } from '../../store/maps';
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes';
it.each([1, 6])('rerolls actual Flaming Sphere fire damage from its real cast area on the target turn: %s', async (reroll) => { const { package: pkg } = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson()); const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)); try {
    let actor = normalizeCharacter({ id: 'wizard', name: 'Wizard', race: '提夫林', dnd5eRaceId: 'tiefling', charClass: '法师', level: 5, abilities: { str: 10, dex: 14, con: 14, int: 16, wis: 10, cha: 10 }, dnd5eFeatIds: [pkg.manifest.id + ':flames-of-phlegethos'], dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['flaming-sphere'] } } } }, equipment: {}, maxHp: 30, currentHp: 30, classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 3 } } });
    const supply = applyDnd5eInventoryMutation([actor], { type: 'grant', characterId: actor.id, templateId: 'srd-5.1:item:component-pouch', quantity: 1 });
    expect(supply.ok).toBe(true);
    actor = supply.characters[0];
    const token = (id: string, type: Token['type'], x: number, characterId?: string): Token => ({ id, label: id, x, y: 25, color: '', emoji: '', size: 1, type, characterId, hp: 30, maxHp: 30 });
    const caster = token('caster', 'player', 25, actor.id), enemy = token('enemy', 'enemy', 275);
    const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [caster, enemy] };
    const order = [caster, enemy].map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20 - i }));
    const action: SharedPlayerActionState = { id: 'cast-area', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: caster.id, characterId: actor.id, dnd5eSpellCast: { spellId: 'flaming-sphere', castingClassId: 'wizard', slotLevel: 2, targetTokenId: caster.id, targetTokenIds: [], areaTargetCell: { col: 4, row: 0 } }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
    const ready = prepareDnd5eSpellCast({ action, map, characters: [actor], initiativeOrder: order });
    expect(ready.ok, ready.ok ? undefined : ready.reason).toBe(true);
    if (!ready.ok)
        throw Error(ready.reason);
    const cast = resolvePreparedDnd5eSpellCast({ prepared: ready.prepared, effectRolls: [] });
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true);
    if (!cast.application)
        throw Error('missing actual cast application');
    const candidates = collectDnd5ePersistentAreaTriggers({ map: cast.application.map, timing: 'turn-end', round: 1, targetTokenId: enemy.id, turnKey: '1:enemy' });
    expect(candidates).toHaveLength(1);
    const candidate = candidates[0], prepared = prepareDnd5ePersistentAreaTrigger({ map: cast.application.map, characters: cast.application.characters, initiativeOrder: order, combatId: 'combat', round: 1, candidate });
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true);
    if (!prepared.ok)
        throw Error(prepared.reason);
    const original = structuredClone(prepared.prepared);
    const use = { featureId: pkg.manifest.id + ':feat-flames-of-phlegethos', rollId: 'persistent:' + candidate.area.id + ':' + candidate.trigger.id, dieIndex: 0, reroll };
    const result = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared, d20: 1, damageRolls: [1, 4], spellDamageDieRerolls: [use] });
    expect(result.result.ok, result.result.ok ? undefined : result.result.reason).toBe(true);
    expect(result.application?.map.tokens.find(t => t.id === enemy.id)?.hp).toBe(30 - 4 - reroll);
    expect(result.result.events).toContainEqual(expect.objectContaining({ type: 'spell-damage-dice-rerolled', actorId: caster.id, spellId: 'flaming-sphere', originalValues: [1, 4], values: [reroll, 4] }));
    expect(prepared.prepared).toEqual(original);
}
finally {
    dispose();
} });
