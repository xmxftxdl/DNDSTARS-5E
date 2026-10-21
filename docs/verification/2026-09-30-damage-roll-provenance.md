# Activity damage dice provenance

This is implementation progress toward source-linked bonuses to qualifying damage rolls, not completion of the bonus mechanic or original XGE source configuration.

The formula evaluator can now report each validated dice node through a Host-owned callback. Evidence records the stable roll ID, actual consumed count, submitted count, original consumed values and effective values after die floors/maximization. It comes from evaluation rather than a separate guess at the submitted dice pool. Critical multipliers and non-critical targets consuming only the base portion of a shared critical pool are preserved. Arithmetic can reference the same roll more than once; each node remains visible and does not imply a fresh roll.

Damage proposals retain dice evidence and the difference between the effective dice sum and the final formula amount. Fixed damage has no dice evidence. Rolled formulas with a zero result keep their evidence. The existing Bestow Curse damage rider has a separate operation and pool record rather than being silently merged with primary damage.

Both registered and compiled Activity commits emit `activity-formula-roll-resolved` with `kind: damage`, before target defenses. Damage attribution uses the actual grant source while `executorId` identifies the bearer executing the grant. The original grant spell level is retained. Applied HP damage remains a separate event. Evidence arrays are copied at evaluation and commit boundaries. Log presentation distinguishes damage dice from healing and does not present the pre-defense total as applied HP loss.

## Validation

- Six new formula/proposal cases cover critical supersets, consumed dice, minimum die transforms, maximization, repeated roll references, fixed damage, zero results, shared targets and outer arithmetic.
- Synthetic exported-module test now verifies critical damage evidence through both registered and compiled paths.
- Grant-rider tests cover rolled/fixed damage, correct source versus executor, original spell level, missing source rejection and triggered recipient execution.
- Six-file regression initially had 146 passes and one new display assertion failure: the test omitted the existing unknown-rule-ID display wrapper. Only that expected string was corrected; the 45-case log suite then passed. Total distinct passing cases: 147.
- Logs: `.codex-logs/damage-evidence-final.txt`, `.codex-logs/damage-evidence-log-final.txt`. Full typecheck session 88963 exited 0, log `.codex-logs/damage-evidence-types.txt`; the subsequent edit only corrected the display assertion string. Changed-file whitespace checks passed. No live verification process remains.

## Outstanding

No generic damage bonus has been enabled. Native weapon/spell/periodic routes still need equivalent roll qualification and grouping, including how shared area rolls and multiple projectiles consume a source-target bonus before save/defense arithmetic. Formula-node evidence must not be mistaken for one bonus entitlement per node, die or log event.

Original fullbook preflight remains 29/155 (18.7%). Review r37, coverage r41 and batch r23 are unchanged. No source drafts were manually repaired, no API calls were made and real room state was not modified.
