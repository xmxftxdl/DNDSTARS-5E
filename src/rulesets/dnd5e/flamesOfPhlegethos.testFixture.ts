/** Data-only complete feat; never reads a temporary archive or ledger. */
export function flamesOfPhlegethosContentJson(): string {
  return JSON.stringify({
  "name": "DM 本地规则",
  "version": "1.0.0",
  "races": [],
  "backgrounds": [],
  "features": [],
  "feats": [
    {
      "id": "flames-of-phlegethos",
      "name": "弗莱格索斯之焰",
      "summary": "提夫林专长：提升智力或魅力，并强化火焰法术与火焰光环。",
      "description": "先决条件：提夫林。你的智力或魅力提高1点，最高为20。当你为自己施展法术并投掷火焰伤害时，可以重骰其中结果为1的火焰伤害骰，但必须接受重骰结果。每当你施展造成火焰伤害的法术时，可以让火焰环绕自身，持续至你的下个回合结束；火焰不伤害你或你的物品，并提供30尺明亮光照及其外30尺微光光照。火焰存在期间，任何在你5尺内对你发动近战攻击且命中的生物受到1d4火焰伤害。",
      "automation": "full",
      "prerequisite": {
        "raceIds": [
          "tiefling"
        ]
      },
      "advancements": [
        {
          "schemaVersion": 1,
          "id": "flames-of-phlegethos-ability-choice",
          "level": 1,
          "kind": "select",
          "label": "提升智力或魅力",
          "description": "选择智力或魅力提高1点，最高为20。",
          "count": 1,
          "options": [
            {
              "id": "intelligence",
              "label": "智力",
              "grants": [
                {
                  "kind": "ability-score",
                  "ability": "int",
                  "amount": 1,
                  "maximumScore": 20
                }
              ]
            },
            {
              "id": "charisma",
              "label": "魅力",
              "grants": [
                {
                  "kind": "ability-score",
                  "ability": "cha",
                  "amount": 1,
                  "maximumScore": 20
                }
              ]
            }
          ]
        }
      ],
      "declarativeAbility": {
        "schemaVersion": 1,
        "id": "flames-fire-dice",
        "name": "弗莱格索斯之焰·火焰伤害骰",
        "description": "自己施展法术的火焰伤害骰为1时可以重骰一次，必须采用新结果。",
        "level": 1,
        "trigger": {
          "kind": "passive"
        },
        "cost": {
          "economy": "none"
        },
        "targeting": {
          "kind": "self"
        },
        "effects": [],
        "mechanic": {
          "kind": "spell-damage-dice-reroll",
          "damageTypes": [
            "fire"
          ],
          "originalFaces": [
            1
          ],
          "maximumRerollsPerDie": 1
        },
        "automation": "full"
      }
    }
  ],
  "spells": [],
  "items": [],
  "abilityGenerationMethods": [],
  "headlessActions": [],
  "activities": [
    {
      "schemaVersion": 1,
      "id": "flames-ring",
      "name": "弗莱格索斯之焰·环焰",
      "activation": {
        "kind": "free"
      },
      "invocation": {
        "kind": "triggered",
        "event": "spell-cast",
        "confirmation": "actor-choice",
        "retention": "single-event"
      },
      "target": {
        "kind": "self"
      },
      "requirements": [
        {
          "kind": "spell-used",
          "damageTypes": [
            "fire"
          ]
        }
      ],
      "effects": [
        {
          "schemaVersion": 1,
          "id": "flames-ring-effect",
          "name": "弗莱格索斯之焰",
          "stacking": "refresh-duration",
          "duration": {
            "kind": "rounds",
            "rounds": 1,
            "expiresAt": "source-turn-end",
            "includeCreationTurn": false
          },
          "modifiers": [
            {
              "kind": "emitted-light",
              "brightRadiusFeet": 30,
              "dimRadiusFeet": 30,
              "color": "#f97316"
            }
          ],
          "grants": [
            "flames-ring-retaliation"
          ]
        }
      ],
      "outcomes": [
        {
          "id": "ignite",
          "when": {
            "kind": "always"
          },
          "operations": [
            {
              "id": "ring",
              "kind": "apply-effect",
              "target": "actor",
              "effectId": "flames-ring-effect"
            }
          ]
        }
      ],
      "automation": {
        "schemaVersion": 1,
        "level": "full",
        "supportedPhases": [
          "eligibility",
          "cost",
          "targeting",
          "attack-roll",
          "saving-throw",
          "damage",
          "healing",
          "effects",
          "duration",
          "interrupt",
          "persistence"
        ],
        "manualPhases": [],
        "limitations": []
      },
      "legacySource": {
        "kind": "feat",
        "id": "flames-of-phlegethos"
      }
    },
    {
      "schemaVersion": 1,
      "id": "flames-ring-retaliation",
      "name": "弗莱格索斯之焰·灼烧命中者",
      "activation": {
        "kind": "special",
        "timing": "hit"
      },
      "invocation": {
        "kind": "triggered",
        "event": "reaction-window",
        "confirmation": "automatic",
        "retention": "single-event"
      },
      "requiresEffectGrant": true,
      "usableWhileIncapacitated": true,
      "target": {
        "kind": "creature",
        "relation": "any",
        "count": 1
      },
      "requirements": [
        {
          "kind": "active-effect",
          "subject": "actor",
          "present": true,
          "source": "self",
          "effectId": "flames-ring-effect"
        },
        {
          "kind": "attack-delivery",
          "delivery": "melee"
        },
        {
          "kind": "distance",
          "maximumFeet": 5
        },
        {
          "kind": "target-identity",
          "identity": "other"
        }
      ],
      "outcomes": [
        {
          "id": "fire",
          "when": {
            "kind": "always"
          },
          "operations": [
            {
              "id": "fire",
              "kind": "damage",
              "target": "target",
              "damageType": "fire",
              "amount": {
                "kind": "dice",
                "rollId": "flames-retaliation",
                "count": 1,
                "sides": 4
              }
            }
          ]
        }
      ],
      "automation": {
        "schemaVersion": 1,
        "level": "full",
        "supportedPhases": [
          "eligibility",
          "cost",
          "targeting",
          "attack-roll",
          "saving-throw",
          "damage",
          "healing",
          "effects",
          "duration",
          "interrupt",
          "persistence"
        ],
        "manualPhases": [],
        "limitations": []
      },
      "legacySource": {
        "kind": "feat",
        "id": "flames-of-phlegethos"
      }
    }
  ],
  "classes": [],
  "subclasses": [],
  "monsters": []
})
}
