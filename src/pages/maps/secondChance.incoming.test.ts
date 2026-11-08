import { it, expect } from 'vitest';
import { incomingAttackOutcome, secondChanceHostEligibility, selectSecondChanceAttackDie, prepareSecondChanceCommit, recoverSecondChanceResource, type IncomingAttackReceipt, type SecondChanceHostSnapshot } from '../../lib/secondChanceIncomingAttack';
const attack = (changes: Partial<IncomingAttackReceipt> = {}): IncomingAttackReceipt => ({ schemaVersion: 1, id: 'attack-1', transactionId: 'weapon-1', mapId: 'map', combatId: 'combat', rollerTokenId: 'orc', rollerControllerMemberId: 'dm', targetTokenId: 'hero-token', targetCharacterId: 'hero', targetControllerMemberId: 'player', dice: [18], mode: 'normal', modifier: 5, armorClass: 16, criticalThreshold: 20, phase: 'hit-confirmation', ...changes });
const owner = (changes: Partial<SecondChanceHostSnapshot> = {}): SecondChanceHostSnapshot => ({ featureId: 'candidate:second-chance', featureLabel: '花开二度', ownerCharacterId: 'hero', ownerName: 'Hero', ownerTokenId: 'hero-token', ownedFeatureIds: ['candidate:second-chance'], canSeeRoller: true, reactionAvailable: true, reactionReserved: false, resourceKey: 'candidate:uses', resourceCurrent: 1, resourceMaximum: 1, ...changes });
function use(a: IncomingAttackReceipt, index: number, reroll: number, o = owner()) {
    return prepareSecondChanceCommit({ attack: a, owner: o, authenticatedReactionMemberId: 'player', decision: 'use', selection: selectSecondChanceAttackDie(a, 'dm', index), hostRerollD20: reroll, now: 100 })!;
}
it('uses the real confirmation ledger for one new d20, changes hit/critical, and prepares both reaction and resource costs', () => {
    const a = attack({ dice: [20] });
    const before = structuredClone(a);
    const result = use(a, 0, 2);
    expect(result).toMatchObject({ beforeDice: [20], afterDice: [2], adoptedD20: 2, total: 7, hit: false, critical: false, nextResourceCurrent: 0, nextReactionAvailable: false });
    expect(result.confirmation.choiceReroll).toMatchObject({ selectionPolicy: 'must-use-latest', originalValue: 20, rerollValue: 2, selectedValue: 2, resourceCosts: [{ resourceKey: 'candidate:uses', amount: 1 }] });
    expect(a).toEqual(before);
    expect(use(attack(), 0, 20)).toMatchObject({ adoptedD20: 20, hit: true, critical: true });
    expect(use(attack(), 0, 19)).toMatchObject({ adoptedD20: 19, hit: true, critical: false });
});
for (const [mode, dice, index, newDie, expected] of [
    ['advantage', [18, 17], 0, 2, 17], ['advantage', [18, 17], 1, 20, 20],
    ['disadvantage', [18, 17], 1, 20, 18], ['disadvantage', [18, 17], 0, 1, 1],
] as const)
    it(`retains the other ${mode} die when replacing index ${index} with ${newDie}`, () => {
        const a = attack({ mode, dice });
        const result = use(a, index, newDie);
        expect(result.adoptedD20).toBe(expected);
        expect(result.afterDice[1 - index]).toBe(dice[1 - index]);
        expect(result.afterDice[index]).toBe(newDie);
        expect(result.total).toBe(expected + 5);
    });
it('separates the original roller die-selection permission from the defender reaction permission', () => {
    const a = attack({ mode: 'advantage', dice: [18, 17] });
    expect(() => selectSecondChanceAttackDie(a, 'player', 0)).toThrow('roller-selection-not-authorized');
    expect(() => prepareSecondChanceCommit({ attack: a, owner: owner(), authenticatedReactionMemberId: 'dm', decision: 'use', selection: selectSecondChanceAttackDie(a, 'dm', 0), hostRerollD20: 2 })).toThrow('reaction-not-authorized');
    const playerAttack = attack({ rollerControllerMemberId: 'other-player', rollerCharacterId: 'other-hero' });
    expect(() => selectSecondChanceAttackDie(playerAttack, 'dm', 0)).toThrow('roller-selection-not-authorized');
    expect(selectSecondChanceAttackDie(playerAttack, 'other-player', 0)).toMatchObject({ rollerTokenId: 'orc', dieIndex: 0 });
});
for (const [patch, reason] of [
    [{ canSeeRoller: false }, 'attacker-not-visible'], [{ reactionAvailable: false }, 'reaction-unavailable'], [{ reactionReserved: true }, 'reaction-unavailable'], [{ resourceCurrent: 0 }, 'resource-unavailable'], [{ ownedFeatureIds: [] }, 'feature-not-owned'], [{ ownerTokenId: 'other' }, 'not-own-incoming-attack'], [{ ownerCharacterId: 'other' }, 'not-own-incoming-attack']
] as const)
    it(`rejects authoritative unavailable boundary ${reason}`, () => {
        expect(secondChanceHostEligibility(attack(), owner(patch))).toEqual({ ok: false, reason });
        expect(() => use(attack(), 0, 2, owner(patch))).toThrow(reason);
    });
it('derives hit from the persisted attack dice, modifier and AC; no hit boolean is accepted', () => {
    expect(secondChanceHostEligibility(attack({ dice: [1], modifier: 100 }), owner())).toMatchObject({ ok: false, reason: 'attack-missed' });
    expect(secondChanceHostEligibility(attack({ dice: [5] }), owner())).toMatchObject({ ok: false, reason: 'attack-missed' });
    expect(incomingAttackOutcome(attack({ dice: [20], modifier: -100 }))).toMatchObject({ hit: true, critical: true });
    for (const phase of ['damage-committed', 'cancelled'] as const)
        expect(secondChanceHostEligibility(attack({ phase }), owner())).toMatchObject({ ok: false, reason: 'attack-not-awaiting-hit-confirmation' });
});
it('declining does not spend or require a replacement roll and a completed prior receipt is replayed without a second spend', () => {
    const a = attack();
    const o = owner();
    const before = structuredClone(o);
    expect(prepareSecondChanceCommit({ attack: a, owner: o, authenticatedReactionMemberId: 'player', decision: 'decline' })).toBeUndefined();
    expect(o).toEqual(before);
    const receipt = use(a, 0, 2);
    expect(prepareSecondChanceCommit({ attack: a, owner: owner({ resourceCurrent: 0, reactionAvailable: false }), authenticatedReactionMemberId: 'player', decision: 'use', prior: receipt })).toBe(receipt);
    expect(() => prepareSecondChanceCommit({ attack: attack({ id: 'other' }), owner: o, authenticatedReactionMemberId: 'player', decision: 'use', prior: receipt })).toThrow('prior-receipt-mismatch');
});
it('rejects another attack receipt, wrong roller token, out-of-range selection and missing Host reroll', () => {
    const a = attack();
    const selection = selectSecondChanceAttackDie(a, 'dm', 0);
    for (const changed of [{ ...selection, attackReceiptId: 'other' }, { ...selection, rollerTokenId: 'other' }, { ...selection, dieIndex: 1 }])
        expect(() => prepareSecondChanceCommit({ attack: a, owner: owner(), authenticatedReactionMemberId: 'player', decision: 'use', selection: changed, hostRerollD20: 2 })).toThrow('selection-receipt-mismatch');
    expect(() => prepareSecondChanceCommit({ attack: a, owner: owner(), authenticatedReactionMemberId: 'player', decision: 'use', selection })).toThrow('host-reroll-required');
});
it('restores only completed rests or recorded actual combat-start initiative rolls, idempotently across a later spend', () => {
    const state = { current: 0, processedRecoveryReceiptIds: [] };
    const event = { kind: 'rolled-initiative', receiptId: 'initiative-roll-1', ownerCharacterId: 'hero', combatId: 'combat-2', phase: 'combat-start', hostDice: [13], mode: 'normal' } as const;
    const recovered = recoverSecondChanceResource(state, 'hero', event);
    expect(recovered.current).toBe(1);
    const spent = { ...recovered, current: 0 };
    expect(recoverSecondChanceResource(spent, 'hero', event)).toBe(spent);
    for (const kind of ['short-rest', 'long-rest'] as const)
        expect(recoverSecondChanceResource(state, 'hero', { kind, receiptId: kind, ownerCharacterId: 'hero', completed: true }).current).toBe(1);
    expect(() => recoverSecondChanceResource(state, 'other', event)).toThrow('invalid-recovery-owner');
    expect(() => recoverSecondChanceResource(state, 'hero', { ...event, hostDice: [] })).toThrow('invalid-initiative-recovery');
});
