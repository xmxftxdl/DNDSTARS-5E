import { resolveDnd5eHeadlessAction, dnd5eIncomingAttackRerollOptions, type Dnd5eAction, type Dnd5eHeadlessCombatState } from "../../application/combat/dnd5eCombatRules";
import { withIncomingAttackRerollCheckpoints, type IncomingAttackRollFacts, type IncomingAttackRerollChoice } from '../../rulesets/dnd5e/incomingAttackRerollCheckpoint';
class Pending extends Error {
    readonly facts: IncomingAttackRollFacts;
    readonly state: Dnd5eHeadlessCombatState;
    readonly occurrence: number;
    constructor(facts: IncomingAttackRollFacts, state: Dnd5eHeadlessCombatState, occurrence: number) { super('incoming-attack-reroll-choice-required'); this.facts = facts; this.state = state; this.occurrence = occurrence; }
}
type Step<Result> = {
    status: 'pending';
    facts: IncomingAttackRollFacts;
    snapshot: Dnd5eHeadlessCombatState;
    occurrence: number;
} | {
    status: 'resolved';
    result: Result;
} | {
    status: 'rejected';
    reason: 'stale-state' | 'stale-checkpoint' | 'session-ended';
};
/** Runs the original resolver from its immutable original input. No replacement
 * attack command is created, and only the final result may be published. */
export function createIncomingAttackReplaySession(source: Dnd5eHeadlessCombatState, action: Dnd5eAction) {
    const command = structuredClone(action);
    return createIncomingAttackResolutionSession(source, state => resolveDnd5eHeadlessAction(state, structuredClone(command)));
}
export function createIncomingAttackResolutionSession<Result>(source: Dnd5eHeadlessCombatState, resolve: (state: Dnd5eHeadlessCombatState) => Result) {
    const baseline = structuredClone(source), signature = JSON.stringify(baseline);
    const decisions = new Map<number, {
        facts: string;
        choice?: IncomingAttackRerollChoice;
    }>();
    let pending: Pending | undefined, ended = false;
    function run(current: Dnd5eHeadlessCombatState): Step<Result> {
        if (ended)
            return { status: 'rejected', reason: 'session-ended' };
        if (JSON.stringify(current) !== signature)
            return { status: 'rejected', reason: 'stale-state' };
        let occurrence = 0;
        try {
            const result = withIncomingAttackRerollCheckpoints((facts, state) => {
                if (!dnd5eIncomingAttackRerollOptions(state, facts.event).length)
                    return;
                const index = occurrence++, previous = decisions.get(index);
                if (previous) {
                    if (previous.facts !== JSON.stringify(facts))
                        throw Error('incoming-attack:changed-replay');
                    return previous.choice;
                }
                throw new Pending(facts, state, index);
            }, () => resolve(structuredClone(baseline)));
            ended = true;
            pending = undefined;
            return { status: 'resolved', result };
        }
        catch (error) {
            if (error instanceof Pending) {
                pending = error;
                return { status: 'pending', facts: structuredClone(error.facts), snapshot: structuredClone(error.state), occurrence: error.occurrence };
            }
            throw error;
        }
    }
    return { run, resume(current: Dnd5eHeadlessCombatState, occurrence: number, facts: IncomingAttackRollFacts, choice?: IncomingAttackRerollChoice): Step<Result> {
            if (ended)
                return { status: 'rejected', reason: 'session-ended' };
            if (!pending || pending.occurrence !== occurrence || JSON.stringify(pending.facts) !== JSON.stringify(facts))
                return { status: 'rejected', reason: 'stale-checkpoint' };
            decisions.set(occurrence, { facts: JSON.stringify(facts), choice: choice ? structuredClone(choice) : undefined });
            pending = undefined;
            return run(current);
        }, cancel() { ended = true; pending = undefined; } };
}
