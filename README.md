# Wizard: Necromancer (Unearthed Arcana)

A Foundry VTT module that adds the **Wizard: Necromancer** subclass from
Unearthed Arcana 8 (*Arcane Subclasses Update*, Sep 2025 playtest) to the
D&D 5e (2024 rules) system, with targeted JavaScript automation for
features whose UX would otherwise require manual macros.

## Features

| Level | Feature | Implementation |
|---|---|---|
| 3 | Necromancy Savant | Descriptive feat (free Necromancy spells in spellbook) |
| 3 | Necromancy Spellbook | Trait Advancement (Necrotic Resistance) + JS hook (Grim Harvest chat card) |
| 3 | Find Familiar (Undead) | Custom spell granted at level 3 with Skeleton/Zombie summons (paraphrased SRD) |
| 6 | Grave Power | JS hooks: Grave Resilience auto-decrements Exhaustion on Arcane Recovery use; Overwhelming Necrosis bypasses Necrotic resistance via the dnd5e damage application API |
| 6 | Undead Thralls | Cast activity (free 1/Long-Rest cast of Animate Dead, no slot cost) + JS hook adding +1 effective level (preSummon) |
| 6 | Animate Dead (Undead Thralls) | Custom spell with Undead Fortitude (HP boost) and Withering Strike (necrotic damage rider) baked into the Summon profile |
| 10 | Harvest Undead | JS hook detects Bloodied transition, posts a chat card; Reaction sacrifices a controlled Undead summon to heal the caster |
| 14 | Bolster Undead | Native Heal activity (Bonus Action, Temp HP = wizard level, 1/Long Rest) |
| 14 | Extinguish Undead | Save activity (10ft Emanation, Dex save, half on save) + JS hook for: target validation (Undead at 0 HP, owned via summon-origin), level-5+ slot prompt for non-owned targets, dynamic damage based on target's unspent Hit Dice, template auto-centered on the target |

## Requirements

- **Foundry VTT v14 or higher** (the subclass does not surface in the Compendium Browser on v13 or earlier).
- **D&D 5e system v4.0 or higher** (verified on v5.3.2).
- The dnd5e SRD spell pack must be available for the Find Familiar (Undead)
  and Animate Dead (Undead Thralls) custom variants to reference base content.

No third-party modules are required. The module is compatible with — but
does not depend on — automation modules such as MIDI-QOL, DAE, or Times Up.

## Installation

### Stable release (recommended)

In Foundry VTT, *Add-on Modules → Install Module* → paste the manifest URL:

```
https://github.com/erickhwk/wizard-necromancer-subclass-ua/releases/latest/download/module.json
```

### From source (development)

Clone this repository directly into your Foundry user data folder:

```
<FoundryVTT user data>/Data/modules/wizard-necromancer-subclass-ua/
```

Then enable the module from your world's Module Management screen.

## Build workflow

Compendia are compiled from YAML sources using the
[Foundry VTT CLI](https://github.com/foundryvtt/foundryvtt-cli):

```bash
npm install -g @foundryvtt/foundryvtt-cli
fvtt configure set installPath "C:/Program Files/Foundry Virtual Tabletop"
fvtt configure set dataPath "C:/Users/<you>/AppData/Local/FoundryVTT"
fvtt package workon "wizard-necromancer-subclass-ua" --type Module

# Compile YAML → LevelDB
fvtt package pack subclass-features \
  --in packs/_source/subclass-features \
  --out packs --yaml

# Extract LevelDB → YAML (after editing in Foundry's UI)
fvtt package unpack subclass-features \
  --in packs \
  --out packs/_source/subclass-features --yaml
```

The compiled `packs/subclass-features/` is what Foundry loads. The
`packs/_source/subclass-features/` folder holds the YAML sources used as the
git source of truth.

## Project layout

```
.
├── module.json                              Manifest
├── assets/icons/                            Custom artwork (subclass badge)
├── lang/                                    Translations (en, pt-BR)
├── packs/
│   ├── subclass-features/                   Compiled LevelDB pack (loaded by Foundry)
│   └── _source/subclass-features/           YAML source (versioned in git)
└── scripts/
    ├── main.mjs                             ESM entry, registers feature hooks
    ├── constants.mjs
    ├── util.mjs                             Shared helpers (multi-client dedup, etc.)
    └── features/
        ├── grim-harvest.mjs
        ├── grave-resilience.mjs
        ├── overwhelming-necrosis.mjs
        ├── undead-thralls.mjs
        ├── harvest-undead.mjs
        └── extinguish-undead.mjs
```

## Licensing & attribution

This module is published under the [MIT License](LICENSE) for the source
code, with the following attributions for game content:

### Unearthed Arcana playtest material

This module implements the Wizard: Necromancer subclass first published in
the *Unearthed Arcana 8 — Arcane Subclasses Update* playtest document
(Wizards of the Coast, Sep 2025). UA is unofficial Wizards Fan Content and
is published under the
[Wizards Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy).
Mechanical text in this module is paraphrased; flavor text is original
prose written for this module.

> *Wizard: Necromancer (Unearthed Arcana) is unofficial Fan Content
> permitted under the Wizards of the Coast Fan Content Policy. Not approved
> or endorsed by Wizards. Portions of the materials used are property of
> Wizards of the Coast. ©Wizards of the Coast LLC.*

### SRD spell content (CC-BY-4.0)

The *Find Familiar (Undead)* and *Animate Dead (Undead Thralls)* variants
shipped in the compendium are derived from the base spells in the
**System Reference Document 5.2** (Wizards of the Coast,
[CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/)), with original
modifications for Necromancer flavor and Undead Thralls bonuses.

## Issues & contributions

Please report bugs or feature requests at
<https://github.com/erickhwk/wizard-necromancer-subclass-ua/issues>.

Pull requests welcome.
