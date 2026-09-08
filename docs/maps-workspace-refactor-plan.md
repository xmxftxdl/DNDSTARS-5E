# MapsWorkspace refactor guardrails

`MapsWorkspacePage.tsx` is a coordination boundary for combat state, map input, dice presentation,
spell targeting, movement, and room synchronization. It can be split safely, but only through small
behavior-preserving extractions with a stable regression gate.

## Baseline policy

The checked-in ceilings live in `scripts/architecture-ratchet.json`.

- `maximum` records the current no-growth ceiling. A change that increases it fails the architecture audit.
- `target` preserves the intended post-refactor budget. It must not be raised to make a failing change pass.
- When an extraction lowers a measured value, lower `maximum` in the same pull request. Never increase it.

The baseline points at the `main` commit from which the refactor series starts. It makes existing debt
visible without allowing new debt and restores `npm run build` as a meaningful gate.

The ESLint ratchet scans normal TypeScript files in bounded subprocesses. The 1.9 MB workspace file
uses `eslint.maps-workspace.config.js`, which retains TypeScript recommended checks, Hooks ordering and
dependency checks, and the project's forbidden browser-dialog APIs. The complete React compiler-rule
profile remains the target and should replace this temporary profile as soon as extraction makes the
file small enough to lint within the CI heap. Its five existing findings are tracked separately in
`.eslint-maps-workspace-ratchet.json`; that baseline may only decrease.

## Required regression gate

Run this focused suite before and after every `MapsWorkspacePage.tsx` extraction:

```bash
npm run test:maps-regression
```

It covers the boundaries most likely to regress while code moves:

- D20 interruption and inspiration ownership, including exactly-once continuation;
- spell-area highlighting and spell-sculpt target selection;
- opportunity-attack ownership and monster attack/damage logging;
- walking, flight, elevation, and movement-pool calculations;
- transformation-sensitive automatic activity settlement;
- dice presentation lifecycle and map-workspace render isolation.

The normal type-check, complete Vitest suite, architecture audit, production build, and browser release
gate remain mandatory. The focused suite is intentionally duplicated in CI so a refactor failure is
identified before the broader suite runs.

## Safe extraction sequence

Each pull request should move one cohesive seam and contain no intentional behavior change.

1. Extract pure selectors and view models. Keep state ownership and effects in the page.
2. Extract presentation-only panels. Pass serializable projections and explicit callbacks.
3. Extract target-selection state machines for attacks, areas, and spell sculpting.
4. Extract movement/elevation orchestration behind the existing movement coordinators.
5. Extract action settlement by transaction type. Preserve the current headless authority boundary.
6. Reduce the page to composition only after the above seams have stable behavior tests.

## Invariants for every extraction

- One authoritative owner settles each action; UI components only project state and send intent.
- Resources, spell slots, inspiration, and action economy are consumed at most once.
- An interrupted D20 roll resumes exactly once and always clears its pending dialog state.
- Target eligibility remains geometry-aware; invalid or out-of-range tokens cannot be selected.
- Spell-sculpt protection is offered only when enabled and uses the locked area snapshot.
- Walking, flying, altitude changes, falling, and opportunity attacks share one movement transaction.
- Transformation end restores the original form once, preserves overflow damage, and rechecks flight.
- Dice animation may delay presentation but never becomes the authority for the resolved result.
- Room writes retain their current idempotency key and ordering guarantees.

If a seam cannot preserve these invariants with explicit inputs and outputs, add characterization tests
before moving it rather than widening the extraction.
