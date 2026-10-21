# Typed map consumable purification

The map-write guard discarded purification proposals even though a typed consumable handler existed. Capability analysis therefore correctly refused to certify the whole Activity, also preventing its supported inventory branch from entering the live spell facade.

This batch enables only `purify-map-consumables`. It removes declared contaminants from valid Host food/drink obstacle records, excludes magical objects and creatures, checks occupied cells, current line-of-effect barriers and vertical extent, and preserves undeclared contaminants and unrelated metadata. Other disabled object operations retain their gates. The handler clones the map; a later failed movement returns failure without mutating the original.

Verification:

- Map handoffs and mechanism registry: 87 tests passed, including two new multi-case purification scenarios. Cases cover magic, height, distance, barriers appearing after selection, creatures, untyped objects, partial purification, JSON reload, idempotent replay, missing placement and failed later handoff. Log: `.codex-logs/map-consumables-20260930.txt`.
- Existing inventory purification live spell facade regression: 1 passed, 145 unrelated tests skipped. Log: `.codex-logs/map-consumables-facade-20260930.txt`. The previous Purify Food and Drink gate failure is resolved; the other three previously recorded map-gate failures were not changed or re-certified.
- Full `npm run typecheck`: exit 0, session 16897, `.codex-logs/map-consumables-types-20260930.txt`.
- Fullbook offline preflight r24: 29 ready, 125 blocked, 1 without a parseable current draft. Initial invocation incorrectly passed an absolute report path and failed the filename guard; the corrected filename invocation passed (session 74405). No source draft was edited.

This is local mechanism evidence, not browser DM/player persistence certification or whole-source automatic conversion certification. API calls: 0. Real rooms were not modified. Fullbook goal remains active; preflight readiness remains 29/155 (18.7%).
