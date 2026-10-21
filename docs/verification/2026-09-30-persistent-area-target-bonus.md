# Persistent-area source-qualified damage bonuses

The shared persistent-area trigger resolver now adds a source-qualified target bonus to its validated damage roll modifier before zero-clamping, saves, resistance and optional DM damage adjustment. It preserves workshop modifiers, on-create Empowered Evocation and maximum-die bonus handling. Damage evidence retains the augmented modifier; bonus events use `group: persistent-area`.

Only a positive dice count qualifies. Fixed damage and healing do not receive the bonus. Source qualification uses the area's actual source combatant and current recipient effects. Creation, entry and turn boundaries each support new rolls. These resolver tests do not prove transport replay protection: trigger eligibility/de-duplication remains the calling coordinator's responsibility.

## Delayed-path inspection

Ordinary newly cast Acid Arrow stores `periodicDamage`, so its deferred roll already uses the common periodic target bonus. The legacy fallback accepts stored potency without a dice record and must not assume a fresh qualifying roll. The current maximized delayed-damage branch also stores potency; its roll qualification needs explicit provenance before safe integration. Neither case is declared complete by this change.

## Verification

- New 14-case suite covers ordinary damage; half saves with vulnerability/resistance; foreign, suspended and removed marks; fixed damage; negative modifiers before clamping; invalid dice rollback; four timing values; fresh subsequent rolls and healing exclusion.
- Initial three-file suite: 52 passed (`.codex-logs/persistent-area-target-bonus.txt`). Final six-file regression: 448 passed (`.codex-logs/persistent-area-target-bonus-final.txt`), including plugin areas, max-die bonuses and full core engine. Full typecheck session 7043 exited 0 (`.codex-logs/persistent-area-target-bonus-types.txt`). All verification processes ended.
- Targeted whitespace check passed.

## Scope

Independent special/on-hit-save damage and unresolved delayed provenance still require work. Full-support registration remains withheld. Original preflight 29/155 (18.7%); review r37, coverage r41, batch r23 unchanged. API calls 0, original generated configuration and production rooms untouched.
