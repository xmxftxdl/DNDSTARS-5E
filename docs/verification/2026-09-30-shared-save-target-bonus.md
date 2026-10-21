# Source-linked bonuses on native shared saving-throw damage

The native saving-throw spell resolver now validates the shared primary/additional dice pools once, consumes Cutting Words once, and derives independent recipient components. A qualifying target bonus is added to the first rolled component before zero-clamping, shared damage reduction, saving-throw adjustment and defenses. Additional damage types do not receive a second bonus. Target state never mutates the shared components.

Single-target saves use the same path. Blight's plant maximum is derived per recipient before reductions; immune creature exclusions remain in the caller. The plant roll evidence now matches the maximum used. This also ensures Cutting Words is applied after the plant maximum instead of being discarded by the previous total override.

## Evidence

- Six new cases exercise shared marked/unmarked recipients with failed/successful saves and vulnerability, single-target half saves and resistance, and multi-type Ice Storm with/without a Cutting Words reaction.
- Three-file regression: 353 tests passed, including the entire headlessCombatEngine test file, native spell bonus suite and damageMitigationInterrupt suite. `.codex-logs/native-save-target-bonus-final.txt`.
- Full typecheck session 90225 exited 0 (`.codex-logs/native-save-target-bonus-types.txt`). Targeted whitespace check passed; all verification processes ended.

## Limits

This change covers the native cast-spell saving-throw branch. Automatic-damage/projectile pools, monster-specific resolution, persistent areas, specialized redirected attacks and legacy delayed damage remain separate work. Full-support registration remains withheld until remaining required paths and original source configurations are verified.

Original preflight unchanged: 29/155 (18.7%). No original AI configuration edited, no paid API calls, production room state untouched. Review r37, coverage r41, batch r23 unchanged.
