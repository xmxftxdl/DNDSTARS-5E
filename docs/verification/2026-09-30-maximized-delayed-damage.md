# Maximized delayed damage provenance

New maximized Acid Arrow delayed effects retain `maximizedDamageRoll: { count, sides, bonus }` alongside the existing base `potency`. Effect constructors, normalization, strict validation and combat cloning preserve this metadata. Validation requires bounded integral dice data and exact agreement with the nonnegative maximized base potency; malformed metadata invalidates the effect instead of silently downgrading it to legacy behavior.

At the delayed boundary, the Host reconstructs the maximum dice result and applies current target/source bonuses before clamping and defenses. It emits `damage-roll-bonus-applied` with group `delayed-damage` and the effect id. Foreign, suspended and removed marks do not qualify. Ordinary new delayed rolls already use the periodic resolver.

Old potency-only effects remain final stored base damage without a newly inferred roll bonus. No migration guesses whether an old potency was rolled, maximized or adjusted. New metadata is runtime provenance for this deferred maximum path, not a claim that arbitrary imported effects can schedule damage merely by containing this field.

## Verification

- Six end-to-end Overchannel Acid Arrow scenarios: own source, foreign source, suspended/removed mark, legacy metadata omission and acid resistance. Verify JSON reload, 8-point maximum base plus eligible 2-point bonus, effect expiration and no repeated damage on the following round.
- Strict serialization case checks valid roundtrip and rejects zero/excessive dice count, unsupported sides, inconsistent potency and string bonus.
- The first fixture omitted class-specific subclass entitlement; adding `subclassIds`/`classLevels` matched the actual prepared caster representation without changing validation.
- Four-file final regression: 278 passed, including spell preparation/casting, ActiveEffects and periodic target bonuses (`.codex-logs/maximum-delay-source-bonus-final.txt`).
- Full typecheck session 15261 exited 0 (`.codex-logs/maximum-delay-source-bonus-types.txt`); changed-file whitespace checks passed. All verification processes ended.

## Remaining scope

Independent special attacks, on-hit saves and other damage entrypoints still require audit/integration. Full-support modifier registration remains withheld. Original fullbook preflight remains 29/155 (18.7%); review r37, coverage r41, batch r23 unchanged. API calls 0, original AI configurations and production rooms untouched.
