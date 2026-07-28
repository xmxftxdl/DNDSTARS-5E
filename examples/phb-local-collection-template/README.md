# Local 2014 rules collection template

This directory intentionally contains no book text, official artwork, or
pre-filled commercial content.

1. Copy the entire directory outside the repository.
2. Change the manifest ID, name, version, publisher, and local license label.
3. Add locally controlled data to the referenced JSON arrays or CSV tables.
4. Put PNG, JPEG, or WebP files under `images/` and declare each file in the
   `images` array in `collection.json`.
5. Add every intended stable ID to `expected` and update `count`. Set
   `imageRequired` when every entry in that category must have an image.
6. Select the copied directory with **导入房间临时合集**.

The untouched template is intentionally not importable: the installer requires
at least one real rule entry. This prevents an empty package from appearing as a
successful PHB import.

The application already has the twelve base 2014 classes. This V2 template
therefore imports subclasses, not replacement base classes.

`subclass-protocol.example.json` is an unreferenced, synthetic example of the
subclass extension protocol. Copy an entry from it into `subclasses.json` and
replace the demo data with locally controlled data. The example demonstrates
leveled cumulative choices, resource dice, one-third spellcasting metadata,
controlled combat hooks, and a Host-owned after-hit resource-die recipe. It is
not imported by the untouched template and contains no book text or official
setting material.
