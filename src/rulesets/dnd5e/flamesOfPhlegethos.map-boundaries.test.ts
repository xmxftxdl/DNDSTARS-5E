import { flamesOfPhlegethosContentJson } from './flamesOfPhlegethos.testFixture';
import { it, expect } from 'vitest';
import { prepareDnd5eLocalContentJson } from './localContentCollection';
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2';
import { registerDnd5eRulesPlugin } from './pluginApi';
import { registeredDnd5ePluginFeats, dnd5ePluginFeatAvailableForCharacter } from './plugins/pluginContentCatalog';
import { normalizeCharacter } from '../../store/characters';
import { applyDnd5eContentBuildChoicesV1 } from './buildChoices';
import { prepareDnd5eSpellCast, resolvePreparedDnd5eSpellCast } from './spellAction';
import type { BattleMap, Token } from '../../store/maps';
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes';
async function candidate() { const { package: pkg } = await prepareDnd5eLocalContentJson(flamesOfPhlegethosContentJson()); return { pkg, dispose: registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg)) }; }
it('enforces tiefling prerequisite and onlyINT/CHA one point maximum20 through actual build choices', async () => { const f = await candidate(); try {
    const feat = registeredDnd5ePluginFeats().find(feat => feat.id.startsWith(f.pkg.manifest.id + ':'));
    expect(feat).toBeDefined();
    if (!feat)
        throw Error('missing feat');
    const make = (race: string) => normalizeCharacter({ id: 'boundary', race, dnd5eRaceId: race, charClass: '法师', level: 4, abilities: { str: 10, dex: 10, con: 10, int: 19, wis: 10, cha: 19 } });
    expect(dnd5ePluginFeatAvailableForCharacter(feat, make('tiefling'))).toBe(true);
    for (const race of ['human', 'half-orc', 'dragonborn'])
        expect(dnd5ePluginFeatAvailableForCharacter(feat, make(race))).toBe(false);
    const advancement = feat.advancements?.find(a => a.kind === 'select');
    expect(advancement).toBeDefined();
    if (!advancement)
        throw Error('missing advancement');
    for (const ability of ['int', 'cha'] as const) {
        const original = make('tiefling');
        const result = applyDnd5eContentBuildChoicesV1({ character: original, contentId: feat.id, advancements: feat.advancements, selections: { [advancement.id]: [ability === 'int' ? 'intelligence' : 'charisma'] } });
        expect(result.ok).toBe(true);
        if (!result.ok)
            throw Error(result.reason);
        expect(result.character.abilities[ability]).toBe(20);
        expect(original.abilities[ability]).toBe(19);
        expect(applyDnd5eContentBuildChoicesV1({ character: { ...original, abilities: { ...original.abilities, [ability]: 20 } }, contentId: feat.id, advancements: feat.advancements, selections: { [advancement.id]: [ability] } }).ok).toBe(false);
    }
    for (const choices of [['strength'], ['intelligence', 'charisma']])
        expect(applyDnd5eContentBuildChoicesV1({ character: make('tiefling'), contentId: feat.id, advancements: feat.advancements, selections: { [advancement.id]: choices } }).ok).toBe(false);
}
finally {
    f.dispose();
} });
it.each([1, 10])('passes exact original die and chosen replacement through real map prepare/resolve: %s', async (reroll) => { const f = await candidate(); try {
    const actor = normalizeCharacter({ id: 'wizard', name: 'Wizard', race: '提夫林', dnd5eRaceId: 'tiefling', charClass: '法师', level: 5, abilities: { str: 10, dex: 14, con: 14, int: 16, wis: 10, cha: 10 }, dnd5eFeatIds: [f.pkg.manifest.id + ':flames-of-phlegethos'], dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-cantrips': ['fire-bolt'] } } } }, equipment: {}, maxHp: 30, currentHp: 30 });
    const token = (id: string, type: Token['type'], x: number, characterId?: string): Token => ({ id, label: id, x, y: 25, color: '', emoji: '', size: 1, type, characterId, hp: 30, maxHp: 30 });
    const caster = token('caster', 'player', 25, actor.id), enemy = token('enemy', 'enemy', 275);
    const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [caster, enemy] };
    const action: SharedPlayerActionState = { id: 'cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: caster.id, characterId: actor.id, targetTokenId: enemy.id, dnd5eSpellCast: { spellId: 'fire-bolt', slotLevel: 0, targetTokenId: enemy.id }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 };
    const prepared = prepareDnd5eSpellCast({ action, map, characters: [actor], initiativeOrder: [caster, enemy].map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20 - i })) });
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true);
    if (!prepared.ok)
        throw Error(prepared.reason);
    expect(prepared.prepared.state.combatants.caster.pluginFeatureIds).toContain(f.pkg.manifest.id + ':feat-flames-of-phlegethos');
    const result = resolvePreparedDnd5eSpellCast({ prepared: prepared.prepared, d20: 18, effectRolls: [1, 4], spellDamageDieRerolls: [{ featureId: f.pkg.manifest.id + ':feat-flames-of-phlegethos', rollId: 'effect', dieIndex: 0, reroll }] });
    expect(result.result.ok, result.result.ok ? undefined : result.result.reason).toBe(true);
    expect(result.application?.map.tokens.find(t => t.id === 'enemy')?.hp).toBe(30 - reroll - 4);
    expect(result.result.events).toContainEqual(expect.objectContaining({ type: 'spell-damage-dice-rerolled', originalValues: [1, 4], values: [reroll, 4] }));
}
finally {
    f.dispose();
} });
