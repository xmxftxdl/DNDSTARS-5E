# SRD 5.1 declarative spell data

This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

The Chinese translation and automation are adaptations, not an official Wizards of the Coast Chinese publication. The rules edition remains **2014 / SRD 5.1**.

- `manifest.json`: neutral built-in package identity and provenance.
- `core-spells.json`: 123 existing core spell records, with primary display text removed.
- `localization/zh-CN.json`, `localization/en-US.json`: core names and reviewed Chinese descriptions.
- `audited-spells.json`: precompiled definitions, Activities, triggered Activities and summon catalogues for the other 196 spells, plus the Minor Illusion core override.
- `localization/audited.zh-CN.json`: extracted names, descriptions, labels and summaries referenced by compiled rules.

Regenerate audited data with `npm run generate:srd-activities`. The compatibility authoring compiler lives under `scripts/content/` and is never imported by application code. Strict parity tests compare all generated values, including explicit undefined properties, against the compiler. `$text` and `$undefined` are internal generated-data encodings, not executable expressions or public module instructions.

The data migration preserves existing automation coverage. It does not turn manual adjudication into automatic rules, or remove trusted native settlement bindings for core spells.
