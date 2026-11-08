import { secondChanceTestContent } from './secondChance.testFixture';
import { normalizeSharedCampaignTime } from '../../lib/campaignTime';
import { mutateCampaignTimeState } from '../../../scripts/shared-server-core.mjs';
import { reconcileDnd5eCharacterCampaignTime } from '../../rulesets/dnd5e/campaignTimeRules';
import { it, expect, afterEach } from 'vitest';
import { normalizeCharacter } from '../../store/characters';
import { registerDnd5eRulesPlugin } from '../../rulesets/dnd5e/pluginApi';
import { dnd5eAdvancementFeatOptions } from '../../components/character/featAdvancementOptions';
import { applyDnd5eLevelAdvancement } from '../../rulesets/dnd5e/levelAdvancement';
import { syncCharacterClassResources, spendClassResource, restoreClassResources } from '../../lib/classResources';
import { applyDnd5eGrantedShortRestBenefits, applyDnd5eLongRestBenefits } from '../../rulesets/dnd5e/campaignTimeRules';
const disposers: (() => void)[] = [];
afterEach(() => disposers.splice(0).forEach(dispose => dispose()));
function fixture() {
    const content = structuredClone(secondChanceTestContent), feat: import('../../rulesets/dnd5e/pluginApi').Dnd5ePluginFeatDefinition = { ...content.feats[0], automation: 'full', resources: [{ id: 'uses', label: '花开二度', maximum: 1, resetOn: 'short-rest' }], declarativeAbility: { schemaVersion: 1, id: 'incoming-hit', name: '花开二度', description: content.feats[0].description, level: 1, trigger: { kind: 'after-d20-roll' }, targeting: { kind: 'self' }, effects: [], automation: 'full', cost: { economy: 'reaction', resources: [{ resourceId: 'uses', amount: 1 }] }, mechanic: { kind: 'incoming-hit-attack-die-reroll' } } };
    disposers.push(registerDnd5eRulesPlugin({ manifest: { id: 'test.second-chance-lifecycle', name: 'Second Chance lifecycle', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Local', license: 'Private' }, setup(api) { api.registerFeat(feat); } }));
    const actor = normalizeCharacter({ id: 'hero', name: 'Hero', race: '半身人', dnd5eRaceId: 'halfling', charClass: '战士', level: 3, dnd5eClassLevels: { fighter: 3 }, dnd5eClassChoices: { fighter: { fightingStyles: ['archery'], subclass: 'champion' } }, abilities: { str: 10, dex: 19, con: 19, int: 10, wis: 10, cha: 19 } });
    const option = dnd5eAdvancementFeatOptions(actor).find((row: any) => row.name === '花开二度')!;
    expect(option).toBeTruthy();
    const decide = (ability: string): import('../../types/character').Dnd5eLevelAdvancementDecisionV1 => ({ schemaVersion: 1 as const, classId: 'fighter' as const, subclassId: 'champion', levelsGained: 1, hitPointMethod: 'fixed' as const, hitPointRolls: [], asiChoices: [{ classLevel: 4, choice: { kind: 'feat' as const, featId: option.id } }], contentChoiceSelections: { [option.id]: { 'second-chance-ability': [ability] } }, fighterFightingStyles: ['archery'] });
    return { actor, option, decide };
}
it('uses the actual character selection and level-up entitlement gate for halfling and rejects humans', () => { const { actor, option, decide } = fixture(); expect(option.eligible).toBe(true); const human = { ...actor, race: '人类', dnd5eRaceId: 'human' }; expect(dnd5eAdvancementFeatOptions(human).find((row: any) => row.id === option.id)?.eligible).toBe(false); expect(applyDnd5eLevelAdvancement(human, decide('dex'))).toMatchObject({ ok: false, reason: 'invalid-feat' }); });
for (const ability of ['dex', 'con', 'cha'] as const)
    it('applies the actual feat level-up ' + ability + ' increase and enforces20', () => { const { actor, option, decide } = fixture(); const result = applyDnd5eLevelAdvancement(actor, decide(ability)); expect(result.ok, JSON.stringify(result)).toBe(true); if (!result.ok)
        return; expect(result.character.abilities[ability]).toBe(20); expect(result.character.dnd5eFeatIds).toContain(option.id); expect(dnd5eAdvancementFeatOptions(result.character).find((row: any) => row.id === option.id)?.eligible).toBe(false); expect(applyDnd5eLevelAdvancement({ ...actor, abilities: { ...actor.abilities, [ability]: 20 } }, decide(ability))).toMatchObject({ ok: false, reason: 'invalid-content-choice' }); });
it('uses actual short and long rest resource rules while combat-start alone cannot restore', () => { const { actor, option } = fixture(); const owner = syncCharacterClassResources({ ...actor, dnd5eFeatIds: [option.id] }), key = 'test.second-chance-lifecycle:uses'; expect(owner.classResources?.[key]).toMatchObject({ current: 1, max: 1 }); const spent = spendClassResource(owner, key)!; expect(restoreClassResources(spent, 'combat').classResources?.[key].current).toBe(0); expect(applyDnd5eGrantedShortRestBenefits(spent, 600).classResources?.[key].current).toBe(1); expect(applyDnd5eLongRestBenefits(spent, 1080).classResources?.[key].current).toBe(1); });
for (const kind of ['short-rest', 'long-rest'] as const)
    it('restores only through the actual authenticated completed ' + kind + ' history, once after reload', () => {
        const { actor, option } = fixture(), key = 'test.second-chance-lifecycle:uses', owner = syncCharacterClassResources({ ...actor, dnd5eFeatIds: [option.id], dnd5eWorldTimeAppliedMinute: 480 }), spent = spendClassResource(owner, key)!, dm = { memberId: 'dm', role: 'dm' }, context = { host: dm, restCharacterIds: [actor.id] };
        expect(mutateCampaignTimeState(null, { operation: 'start-rest-session', id: 'real-rest', kind, characterIds: [actor.id], expectedWorldMinute: 480 }, 1, { memberId: 'intruder', role: 'player' }, context).ok).toBe(false);
        const start = mutateCampaignTimeState(null, { operation: 'start-rest-session', id: 'real-rest', kind, characterIds: [actor.id], expectedWorldMinute: 480 }, 1, dm, context);
        expect(start.ok).toBe(true);
        if (!start.ok)
            throw Error('actual rest start required');
        expect(reconcileDnd5eCharacterCampaignTime(spent, normalizeSharedCampaignTime(start.next)).character.classResources?.[key].current).toBe(0);
        const interrupted = mutateCampaignTimeState(start.next, { operation: 'advance-seconds', seconds: 6 }, 2, dm, context);
        expect(interrupted.ok).toBe(true);
        if (!interrupted.ok)
            throw Error('actual time advance required');
        expect(reconcileDnd5eCharacterCampaignTime(spent, normalizeSharedCampaignTime(interrupted.next)).character.classResources?.[key].current).toBe(0);
        const complete = mutateCampaignTimeState(start.next, { operation: 'complete-rest-session', id: 'real-rest', expectedWorldMinute: 480 }, 2, dm, context);
        expect(complete.ok).toBe(true);
        if (!complete.ok)
            throw Error('actual rest completion required');
        const restored = reconcileDnd5eCharacterCampaignTime(spent, normalizeSharedCampaignTime(complete.next)).character;
        expect(restored.classResources?.[key].current).toBe(1);
        const spentAgain = spendClassResource(restored, key)!, reloaded = normalizeCharacter(JSON.parse(JSON.stringify(spentAgain)));
        expect(reconcileDnd5eCharacterCampaignTime(reloaded, normalizeSharedCampaignTime(complete.next)).character.classResources?.[key].current).toBe(0);
    });
