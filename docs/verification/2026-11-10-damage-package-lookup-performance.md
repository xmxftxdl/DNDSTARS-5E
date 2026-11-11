# Damage settlement: package lookup performance

The user reports waiting after dice have stopped and before damage/HP results.
This change removes unnecessary full-catalog copies from five settlement paths:
Activity command validation, compiled plugin actions, damage reaction guards,
registered weapon-hit replay guards and spell damage-group discovery.

Version checks now read a fresh detached package identity from the registry.
Spell damage discovery copies only the requested package's activities. Definitions,
version comparisons, pending-choice validation and authoritative damage remain
unchanged. No combat state, dice, HP result or player decision is cached.

The catalog-signature and frozen-selection caches already exist on cloud base
`cbb07fd6`; they are not new changes or new performance gains in this patch.

## Measurement

`activityPackageLookupPerformance.test.ts` installs 40 packages with 50 activities
each. In a local run, 20 original version lookups (copy every package, then find
one) took 516.43 ms. The same 20 direct identity lookups took 0.334 ms, with no
structuredClone calls. Reading one complete package clones 50 selected activities
instead of traversing/copying all 2,000, and its editable output remains isolated.

These Node/Vitest timings describe this lookup only, not an entire attack, a
browser CPU-throttling profile or the user's computer. The test prints timings
without a machine-dependent pass/fail threshold.

## Validation scope

227 tests passed across 17 focused suites. They verify version mismatch rejection, lifecycle/current identity,
caller mutation isolation, unchanged command proposals, attack/damage reactions,
weapon-hit replay and materials. Production TypeScript and architecture checks
passed separately. This is not full private-content acceptance or a live cloud
measurement.

Targeted lint reports the pre-existing unused `_kind` and `_operationId` at
`dnd5eActivityHeadlessCompiler.ts:1309`, present in the unchanged cloud base.
The other changed production modules pass the targeted lint check. Lint is not
reported as globally passing.

Cloud deployment and end-to-end latency measurement are still required before
claiming the reported pause has been eliminated.
