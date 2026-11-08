import type { Dnd5ePluginFeatDefinition } from '../../rulesets/dnd5e/pluginApi';
// Self-contained source-faithful test fixture. No runtime package/ledger/filesystem dependency.
export const secondChanceTestContent: {
    name: string;
    version: string;
    feats: Dnd5ePluginFeatDefinition[];
} = {
    "name": "花开二度待实现候选",
    "version": "1.0.0",
    "feats": [
        {
            "id": "second-chance",
            "name": "花开二度",
            "summary": "半身人的可选属性提升；命中后的重骰反应尚未自动化。",
            "description": "花开二度 S ECOND C HANCE\n先决条件 :\n半身人\n命运在有人想要伤害你时眷顾于你，你获得下列\n增益：\n 你的敏捷、体质、或魅力 +1 ，上限为 20 。\n 当一个你可见的生物以攻击检定命中你时，\n你可以使用你的反应迫使那个生物重骰之。\n此能力一旦被使用，直到你下次在战斗开始\n时骰先攻、你完成一次短休、或你完成一次\n长休之前都无法再次使用它。",
            "automation": "manual",
            "prerequisite": {
                "raceIds": [
                    "halfling"
                ]
            },
            "advancements": [
                {
                    "schemaVersion": 1,
                    "id": "second-chance-ability",
                    "level": 1,
                    "kind": "select",
                    "label": "花开二度属性提升",
                    "count": 1,
                    "options": [
                        {
                            "id": "dex",
                            "label": "dex",
                            "grants": [
                                {
                                    "kind": "ability-score",
                                    "ability": "dex",
                                    "amount": 1,
                                    "maximumScore": 20
                                }
                            ]
                        },
                        {
                            "id": "con",
                            "label": "con",
                            "grants": [
                                {
                                    "kind": "ability-score",
                                    "ability": "con",
                                    "amount": 1,
                                    "maximumScore": 20
                                }
                            ]
                        },
                        {
                            "id": "cha",
                            "label": "cha",
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
            ]
        }
    ]
};
