import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { it, expect } from 'vitest';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { normalizeCharacter } from '../../store/characters';
import { applyDnd5eInventoryMutation } from './items';
import { prepareDnd5ePluginSpellCast, resolvePreparedDnd5ePluginSpellCast } from './pluginSpellTransaction';
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './activities/dnd5eCoreSpellActivities';
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement';
import { collectDnd5eSpellDamageDieRerolls } from './spellDamageDieRerolls';
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine';
import type { BattleMap, Token } from '../../store/maps';
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes';
it.each(['warm', 'chill'] as const)('classifies actual Fire Shield selected %s source and rerolls only its later own fire retaliation', async (mode) => { ensureDnd5eCoreSpellActivitiesRegisteredV1(); const { package: pkg } = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson()); const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)); try {
    let actor = normalizeCharacter({ id: 'wizard', name: 'Wizard', race: '提夫林', dnd5eRaceId: 'tiefling', charClass: '法师', level: 7, abilities: { str: 10, dex: 14, con: 14, int: 16, wis: 10, cha: 10 }, dnd5eFeatIds: [pkg.manifest.id + ':flames-of-phlegethos'], dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['fire-shield'] } } } }, equipment: {}, maxHp: 30, currentHp: 30, classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } } });
    const supply = applyDnd5eInventoryMutation([actor], { type: 'grant', characterId: actor.id, templateId: 'srd-5.1:item:component-pouch', quantity: 1 });
    expect(supply.ok).toBe(true);
    actor = supply.characters[0];
    const token = (id: string, type: Token['type'], x: number, characterId?: string): Token => ({ id, label: id, x, y: 25, color: '', emoji: '', size: 1, type, characterId, hp: 30, maxHp: 30 });
    const caster = token('caster', 'player', 25, actor.id), enemy = token('enemy', 'enemy', 75);
    const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [caster, enemy] };
    const action: SharedPlayerActionState = { id: 'cast-shield', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: caster.id, characterId: actor.id, dnd5eSpellCast: { spellId: 'fire-shield', castingClassId: 'wizard', slotLevel: 4, targetTokenId: caster.id, activityChoices: { mode } }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
    const prepared = prepareDnd5ePluginSpellCast({ action, map, characters: [actor], initiativeOrder: [caster, enemy].map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20 - i })) });
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true);
    if (!prepared.ok)
        throw Error(prepared.reason);
    const cast = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: { activityRolls: {} } });
    expect(cast.result.ok, cast.result.ok ? undefined : cast.result.reason).toBe(true);
    if (!cast.result.ok)
        throw Error(cast.result.reason);
    const prompts: string[] = [];
    const declined = await settleDnd5eActivityTriggerWindowsV1({ state: cast.result.state, events: cast.result.events, eventBatchId: 'shield-cast', combatRevision: 1, confirm: async (r) => { prompts.push(r.activity.id); return false; }, roll: async () => { throw Error('casting shield has no dice'); } });
    expect(prompts).toEqual(mode === 'warm' ? ['flames-ring'] : []);
    const turn = resolveDnd5eHeadlessAction(declined.state, { type: 'end-turn', actorId: 'caster' });
    expect(turn.ok).toBe(true);
    if (!turn.ok)
        throw Error(turn.reason);
    const hit = resolveDnd5eHeadlessAction(turn.state, { type: 'attack', actorId: 'enemy', targetId: 'caster', attackModifier: 5, d20: 18, damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'slashing' }, classDamageContext: { mode: 'melee', weaponId: 'sword', weaponCategory: 'martial', weaponDamageSides: 6, damageType: 'slashing', finesse: false, strengthBased: true, adjacentEnemyOfTarget: false } });
    expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true);
    if (!hit.ok)
        throw Error(hit.reason);
    const choices: string[] = [];
    const retaliation = await settleDnd5eActivityTriggerWindowsV1({ state: hit.state, events: hit.events, eventBatchId: 'shield-hit', combatRevision: 2, charactersByCombatantId: { caster: actor }, confirm: async () => { throw Error('shield consequence automatic'); }, roll: async (r) => { expect([r.count, r.sides]).toEqual([2, 8]); return [1, 2]; }, chooseSpellDamageDice: async (request) => { const uses = await collectDnd5eSpellDamageDieRerolls({ actor: request.actor, groups: [request.group], choose: async (r) => { choices.push(r.group.id); return true; }, roll: async () => 8 }); return uses; } });
    expect(choices).toHaveLength(mode === 'warm' ? 1 : 0);
    expect(retaliation.state.combatants.enemy.currentHp, JSON.stringify(retaliation.diagnostics)).toBe(mode === 'warm' ? 20 : 27);
    expect(retaliation.state.combatants.caster.turn.reactionAvailable).toBe(true);
}
finally {
    dispose();
} });
