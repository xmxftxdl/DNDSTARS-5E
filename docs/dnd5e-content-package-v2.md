# D&D 5e incremental content package V2

`dndstars5e-content` is the pure-JSON package format for locally supplied 2014-era
incremental rules content. The browser parses the file as data; it does not execute
JavaScript from the package.

The importable original-content example is:

`examples/original-content-v2.dndstars5e`

## Required envelope

```json
{
  "format": "dndstars5e-content",
  "schemaVersion": 2,
  "manifest": {},
  "provenance": {
    "edition": "2014",
    "contentMode": "incremental",
    "sourceTitle": "Name of the locally controlled source"
  },
  "assets": [],
  "content": {}
}
```

The `manifest` uses Rules Plugin API V2 and the ruleset ID
`dnd5e-2014-srd-5.1`. It must declare the actual publisher, license, and
distribution policy.

- `local-only`: may be installed outside a multiplayer room and is stored only
  in that browser profile's IndexedDB. The normal client refuses to upload it
  to an account library, room, or marketplace.
- `room-distributable`: may be uploaded by a DM and sent to room members. Use
  this only when the package owner has the right to redistribute every included
  text and image.
- `room-ephemeral`: is produced from a DM-selected local collection. Only a
  mechanically sufficient runtime projection is sent to the current room. It
  is held in browser memory, excluded from account storage and campaign
  exports, and removed from room storage when the DM closes the room.
- `account-entitled`: reserved for an entitlement-backed distribution flow and
  is not currently accepted as a room upload.

The package is incremental: it adds namespaced entries and cannot replace an
SRD core ID.

## Contributions

`content` accepts these arrays:

- `races`
- `backgrounds`
- `features`
- `feats`
- `spells`
- `items`
- `abilityGenerationMethods`
- `headlessActions`
- `subclasses`
- `monsters`

Passive race and feat mechanics use `staticModifiers`. Supported fields are:

- `armorClassBonus`
- `initiativeBonus`
- `speedBonusFeet`
- `savingThrowBonus`
- `darkvisionRangeFeet`
- `damageResistances`
- `damageImmunities`
- `conditionImmunities`

Active features and spells bind to entries in `headlessActions`. Those actions
are compiled by the host into the existing allowlisted damage, healing, and
standard-condition operations.

## Subclass extension protocol

Each `subclasses` entry remains a pure-data `schemaVersion: 1` declaration.
The following optional fields are additive, so older subclass entries remain
valid:

- `choiceGroups`: persistent character choices. `maxSelectionsByLevel` raises
  the cumulative limit at later class levels.
- `resources[].die`: resource-die metadata with optional
  `sidesByClassLevel` growth. Resource counts and die size are separate.
- `resources[].maximumByClassLevel`: exact later resource maxima when a
  formula cannot represent a subclass progression table.
- `spellcasting`: currently accepts `one-third` + `known`, an ability, a
  registered spell-list class, 20-entry cantrip/spell-known tables, optional
  school restrictions, and unrestricted-spell counts.
- `combatHooks`: binds an ability ID to an allowlisted event timing and an
  explicit decision owner (`automatic`, `actor-choice`, `target-choice`, or
  `dm-confirm`). An actor-owned `after-attack-hit` hook may declare
  `activation: "prearm"` so the player enables it before choosing an attack
  instead of receiving a prompt on every attack. Its `retention` may be
  `single-attempt`, `until-triggered`, or `until-turn-end`. `exclusiveGroup`
  makes arming one intent automatically replace another intent in the same
  group, and Headless rejects forged attacks carrying two group members.
- `predicates.subclassChoices`: binds an ability to a persisted option in one
  of the same subclass's choice groups. Both character UI eligibility and
  Headless resolution rebuild and validate this requirement.

The Host validates unique IDs, ordered level tables, referenced ability and
resource IDs, spell-school values, and all 20 class-level entries before
registration. Fighter extension choices are copied into the authoritative
Headless snapshot. An attack request carries only its armed feature IDs; the
Host rebuilds hook timing, ownership, costs, effects, and retention from the
registered package, and Headless rejects forged or duplicate IDs.
`until-triggered` remains armed after a miss and is removed only after an
authoritative trigger result. Unsupported hook/decision combinations are
registered as metadata but downgrade the bound ability to partial automation
with a Host-authored compatibility reason; imported JSON never receives
executable callback access.

Prearmed after-hit damage or healing rolls may opt into a Host-owned resource
die recipe:

```json
{
  "dice": { "count": 1, "sides": 6 },
  "hostRoll": {
    "timing": "on-trigger",
    "die": { "kind": "resource-die", "resourceId": "technique-focus" },
    "critical": "double-dice"
  }
}
```

The referenced resource must declare `resources[].die`, the ability must spend
that same resource, and the base `dice.sides` must match the resource's base
die. Active-use abilities and actor-owned `after-attack-hit` prearm hooks can
use this recipe. After the authoritative trigger is known, the Host derives the
current die size and any level-scaled dice count from the combatant snapshot,
rolls publicly, and passes the results to Headless. Damage can request
`critical: "double-dice"` and use `damageType: "parent-weapon"` on a prearmed
after-hit roll; the latter is supplied only by the private attack event path.
Headless rebuilds the declaration and rejects missing, extra, out-of-range,
wrong-size, or forged results. A miss neither rolls nor spends the resource.
Temporary-hit-point effects may use a validated `rollId`, allowing active
resource-die abilities to combine a Host roll with a declarative ability
modifier.

The importable, rights-safe Battle Master collection is:

`examples/battle-master-local-collection/`

It contains structured values and original short summaries only. Supported
Battle Master mechanics use the audited `battle-master-2014` mechanic tag.
Headless now settles all sixteen maneuver choices: Host resource-die rolls,
attack timing, resources and action economy, saving throws, conditions,
advantage/disadvantage, forced or reaction movement, temporary hit points,
AC changes, Parry, Riposte, Commander’s Strike, and Relentless.

Attack maneuvers travel in `declarativeIntentFeatureIds` with Host-created
`declarativeIntentRolls`. Saves and geometry-dependent choices are signed in
`declarativeIntentPayloads`; Parry and Riposte use
`declarativeTargetReaction`. Headless rebuilds the registered definition,
checks feature ownership, die size, resource availability, reaction/action
economy, target relationship, size, distance and destination limits, then
emits `battle-master-maneuver-resolved`. The browser never receives or stores
any PHB prose or official artwork from this example.

The rights-safe, unreferenced example is:

`examples/phb-local-collection-template/subclass-protocol.example.json`

## Image assets

Each image entry contains `id`, `mediaType`, and `dataBase64`. PNG, JPEG, and
WebP are accepted. SVG and other executable/vector formats are rejected.

An asset is limited to 384 KiB. Normal packages are limited to 6 MiB of image
assets; a `room-ephemeral` runtime package is limited to 24 MiB. Content entries
reference a local image with `iconAssetId`; the host converts it to the package
namespace during installation.

## Local JSON/CSV collection with AI-generated images

The DM can choose **设置 → 规则插件 → 导入房间临时合集** and select a directory.
The browser requires exactly one `collection.json`, compiles it locally, and
does not upload that manifest, any CSV file, an image prompt, or model metadata.

```json
{
  "format": "dndstars5e-local-collection",
  "schemaVersion": 1,
  "manifest": {
    "id": "local.my-table.2014-content",
    "name": "My local 2014 collection",
    "version": "1.0.0",
    "apiVersion": 2,
    "rulesetId": "dnd5e-2014-srd-5.1",
    "publisher": "Local DM",
    "license": "Private local use",
    "contentCategory": "mixed"
  },
  "provenance": {
    "sourceTitle": "Locally controlled collection"
  },
  "content": {
    "races": [],
    "backgrounds": [],
    "features": [],
    "feats": [],
    "spells": [],
    "items": [],
    "abilityGenerationMethods": [],
    "headlessActions": [],
    "subclasses": [],
    "monsters": []
  },
  "json": {
    "races": "tables/races.json",
    "subclasses": "tables/subclasses.json"
  },
  "csv": {
    "features": "tables/features.csv",
    "spells": "tables/spells.csv",
    "monsters": "tables/monsters.csv"
  },
  "expected": {
    "races": {
      "count": 2,
      "ids": ["local-race-a", "local-race-b"],
      "imageRequired": true
    },
    "subclasses": {
      "count": 1,
      "ids": ["local-subclass-a"]
    }
  },
  "images": [
    {
      "id": "ash-wyrm",
      "file": "images/ash-wyrm.webp",
      "origin": "ai-generated",
      "prompt": "kept locally and never copied into the room package",
      "model": "optional local record",
      "targets": [
        { "category": "monster", "id": "ash-wyrm", "slot": "portrait" }
      ]
    },
    {
      "id": "ember-bolt",
      "file": "images/ember-bolt.webp",
      "origin": "ai-generated",
      "targets": [
        { "category": "spell", "id": "ember-bolt", "slot": "icon" },
        { "category": "feature", "id": "ember-bolt-feature", "slot": "icon" }
      ]
    }
  ]
}
```

CSV uses one row per entry and top-level field names as headers. Plain numbers,
`true`, `false`, `null`, JSON objects, and JSON arrays are parsed automatically.
Nested mechanics such as `staticModifiers`, `castingTime`, `components`,
`actions`, or `abilities` should therefore be JSON inside a quoted CSV cell.
For large or deeply nested monster/spell records, inline JSON is easier to
maintain than CSV.

Each path in `json` must contain a JSON array for that category. Inline
`content`, separate `json` arrays, and `csv` rows are merged before validation.
The `expected` block is optional and remains local. It lets the compiler report
count shortfalls, missing stable IDs, and missing image bindings before upload.
The downloadable audit includes only counts and IDs; it excludes content names,
source prose, image bytes, and generation prompts.

An empty, rights-safe starter directory is available at
`examples/phb-local-collection-template`. It contains no PHB text or official
art. The application already supplies the twelve base 2014 classes, so this
template uses `subclasses` rather than a `classes` import.

Image targets are stable local IDs:

- `race`, `feature`, `feat`, `spell`, and `item` use `slot: "icon"`.
- `monster` accepts `portrait` (both views), `tokenPortrait`, or
  `initiativePortrait`.

Only local PNG, JPEG, and WebP files are accepted. External URLs and SVG are
not accepted. Prefer 256×256 or 512×512 WebP images and keep each below
384 KiB. `origin` is a required operator declaration; it does not itself prove
rights. Do not use official book art, logos, or an output that reproduces a
protected work merely because an image generator was involved.

## Installation and multiplayer

The settings page inspects a V2 file before installation and shows source,
license, distribution policy, and contribution counts. Installed bytes are
SHA-256 pinned.

For `local-only`, the account-library client rejects the package before making
a network request. The account server also refuses that policy as a defense in
depth and does not store the bytes. Room heartbeats omit the local package ID,
version, and SHA-256. The loader also refuses to activate a `local-only`
package while an online room session exists, preventing private mechanics from
silently changing an authoritative multiplayer battle.

In a multiplayer room, both the client and room server reject packages that do
not declare `room-distributable` or `room-ephemeral`. Declarative package bytes
are also checked against the uploaded manifest ID, version, and distribution
policy.

For `room-ephemeral`, the browser creates a second V2 runtime package. It keeps
stable IDs, names, structured mechanics, and declared image bytes, but replaces
descriptions, summaries, rules text, material text, and similar prose with a
fixed platform-authored placeholder. The server accepts this policy only when
the projection marker is present and the prose-reduction checks pass. Closing
the room deletes the hosted runtime bytes; clients also discard their in-memory
copy. Starting another room therefore requires selecting the local collection
again.

After inspecting a V2 package, the settings page can download a local
automation-coverage JSON report. The report contains counts, stable package
IDs, and Host-authored compatibility reasons only. It deliberately excludes
source text, human-readable content names, and all image bytes.

This format deliberately supplies no third-party book text or artwork. A user
must provide content they are authorized to use. `local-only` is a technical
privacy boundary, not a determination that a particular source copy or
conversion is legally authorized.
