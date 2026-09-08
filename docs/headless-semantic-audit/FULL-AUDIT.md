# 逐条 Headless 审查

## 法术（319）

| ID | 名称 | 来源 | 结论 | 缺口 | 直接测试 |
| --- | --- | --- | --- | --- | --- |
| acid-arrow | 强酸箭 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| acid-splash | 酸液飞溅 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/eldritchKnight.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| aid | 援助术 | audited-activity | verified-full |  | src/rulesets/dnd5e/pluginSpellTransaction.test.ts |
| alarm | 警报术 | audited-activity | verified-full |  | src/components/dm/dmCampaignStoryModel.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/pluginAreas.test.ts<br>src/rulesets/dnd5e/racialAutomation.test.ts |
| alter-self | 变身术 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据；原文要求 movement，Activity 及专用运行时均无完整证据；未证明能力 mode-choice | src/lib/dnd5eActionIcons.test.ts |
| animal-friendship | 化兽为友 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts |
| animal-messenger | 动物信使 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts |
| animal-shapes | 动物形态 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts |
| animate-dead | 操纵死尸 | audited-activity | partial | 原文要求 sustained-control，Activity 及专用运行时均无完整证据；原文要求 slot-scaling，Activity 及专用运行时均无完整证据 | src/lib/dnd5eActionIcons.test.ts |
| animate-objects | 活化物件 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据；原文要求 movement，Activity 及专用运行时均无完整证据；原文要求 slot-scaling，Activity 及专用运行时均无完整证据；未证明能力 world-object |  |
| antilife-shell | 防活物护罩 | audited-activity | verified-full |  | src/lib/mapGeometry.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/pluginAreas.test.ts |
| antimagic-field | 反魔法力场 | audited-activity | partial | 原文要求 condition，Activity 及专用运行时均无完整证据 | src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts |
| antipathy-sympathy | 嫌恶/关怀术 | audited-activity | partial | 原文要求 condition，Activity 及专用运行时均无完整证据；原文要求 turn-trigger，Activity 及专用运行时均无完整证据 |  |
| arcane-eye | 秘法眼 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/lib/playerVision.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityMapInteraction.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| arcane-hand | 奥术之手 | audited-activity | verified-full |  | src/rulesets/dnd5e/adjudicatedSpellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| arcane-lock | 秘法锁 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityMapInteraction.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/mapInteraction.test.ts<br>src/rulesets/dnd5e/mapObjectState.test.ts |
| arcane-sword | 奥术之剑 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| arcanists-magic-aura | 奥法师魔法灵光 | audited-activity | partial | 未证明能力 long-term-state | src/lib/dnd5eActionIcons.test.ts |
| astral-projection | 星界投影 | audited-activity | partial | 原文要求 condition，Activity 及专用运行时均无完整证据；原文要求 movement，Activity 及专用运行时均无完整证据；未证明能力 planar-state；未证明能力 death-handoff |  |
| augury | 卜筮术 | none | manual |  | src/rulesets/dnd5e/activities/dnd5eActivityExecutor.test.ts |
| awaken | 启蒙术 | audited-activity | partial |  | src/rulesets/dnd5e/monsterSchema.test.ts |
| bane | 灾祸术 | core-transaction | verified-full |  | src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| banishment | 放逐术 | core-transaction | verified-full |  | src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts |
| barkskin | 树肤术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts |
| beacon-of-hope | 希望信标 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| bestow-curse | 降咒 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据；原文要求 turn-trigger，Activity 及专用运行时均无完整证据；原文要求 slot-scaling，Activity 及专用运行时均无完整证据；未证明能力 mode-choice | src/lib/dnd5eActionIcons.test.ts |
| black-tentacles | 黑触手 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/localContentCollection.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| blade-barrier | 剑刃护壁 | core-transaction | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/combatPersistentSpellBatch.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/persistentAreaPresentation.test.ts<br>src/rulesets/dnd5e/persistentAreaTypes.test.ts |
| bless | 祝福术 | core-transaction | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/pages/maps/combatStartTokenMarks.test.ts<br>src/pages/maps/dmWallOfFireRemoval.test.ts<br>src/pages/maps/flamingSphereConcentration.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffectsHeadless.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityExecutor.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts<br>src/rulesets/dnd5e/classFeatureAction.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| blight | 枯萎术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| blindness-deafness | 目盲/耳聋术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| blink | 闪现术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts<br>src/rulesets/dnd5e/endTurnAction.test.ts |
| blur | 朦胧术 | core-transaction | verified-full |  | src/components/character/Dnd5eSpellbookPanel.test.tsx<br>src/components/map/Dnd5eActionIcon.test.tsx<br>src/components/map/tokenBorderFlow.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/equipmentAttackAction.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| branding-smite | 印记斩 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/presentation/maps/MapViewportLayer.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/pluginSpellTransaction.test.ts |
| burning-hands | 燃烧之手 | core-transaction | verified-full |  | src/components/map/combatSpellDamagePresentation.test.ts<br>src/lib/combatLogDetails.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/aoeTargetingSession.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/eldritchKnight.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts<br>src/rulesets/dnd5e/verticalCombatGeometry.test.ts |
| call-lightning | 召雷术 | core-transaction | verified-full |  | src/components/map/PlayerMapSpellHotbar.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterParryHeadless.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts<br>src/rulesets/dnd5e/spellPresentationCoverage.test.ts |
| calm-emotions | 安定心神 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据；原文要求 area，Activity 及专用运行时均无完整证据 | src/lib/dnd5eActionIcons.test.ts<br>src/pages/mapsPageHelpers.test.ts |
| chain-lightning | 连锁闪电 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| charm-person | 魅惑人类 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/activeEffectsHeadless.test.ts<br>src/rulesets/dnd5e/airborneFallActionResolution.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| chill-touch | 冻寒之触 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/spellPresentationCoverage.test.ts |
| circle-of-death | 死亡法阵 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| clairvoyance | 鹰眼术 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据；原文要求 condition，Activity 及专用运行时均无完整证据 |  |
| clone | 克隆术 | audited-activity | verified-full |  | src/lib/aiJobProtocol.test.ts<br>src/lib/dnd5eMonsterTurnPlannerWorker.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/settleDnd5eCombatResult.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityMapInteraction.test.ts<br>src/rulesets/dnd5e/airborneFallActionResolution.test.ts<br>src/rulesets/dnd5e/declarativeSubclassAbility.test.ts<br>src/rulesets/dnd5e/equipment.test.ts<br>src/rulesets/dnd5e/equipmentAttackAction.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/mapInteraction.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsterConditionalOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterDeathAreaRuntime.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterHealingTouch.test.ts<br>src/rulesets/dnd5e/monsterKrakenFling.test.ts<br>src/rulesets/dnd5e/monsterMummyRotMultiattack.test.ts<br>src/rulesets/dnd5e/monsterRelentless.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/rulesets/dnd5e/monsterVampireBiteEligibility.test.ts<br>src/rulesets/dnd5e/optionalBonusDieSpells.test.ts<br>src/rulesets/dnd5e/pluginSpellTransaction.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellAdvancement.test.ts |
| cloudkill | 死云术 | core-transaction | verified-full |  | src/components/map/flamingSphereHandoff.test.ts<br>src/components/map/MapPersistentAreaLayers.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/vfxSequence.test.ts<br>src/rulesets/dnd5e/combatPersistentSpellBatch.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts |
| color-spray | 七彩喷射 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| command | 命令术 | audited-activity | partial |  | src/application/commands/commandOutcome.test.ts<br>src/components/map/dnd5eMonsterPortraitPrompt.test.ts<br>src/components/map/PlayerCombatHotbar.test.ts<br>src/lib/combatCommandApi.test.ts<br>src/lib/pendingCombatCommandStore.test.ts<br>src/lib/roomCommandBus.test.ts<br>src/lib/roomCommunications.test.ts<br>src/lib/sharedServerCombatTransactions.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityCommand.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityExecutor.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/activities/dnd5eLongLivedSpellActivities.test.ts<br>src/rulesets/dnd5e/battleMasterHeadless.test.ts<br>src/rulesets/dnd5e/genericCombatPrimitives.test.ts<br>src/rulesets/dnd5e/inventoryHeadlessEffectAuthority.test.ts<br>src/rulesets/dnd5e/monsterContentDeepAnalysis.test.ts<br>src/rulesets/dnd5e/monsterStatBlockPaste.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts<br>src/store/roomCommands.test.ts |
| commune | 通神术 | none | manual |  |  |
| commune-with-nature | 问道自然 | none | manual |  |  |
| comprehend-languages | 通晓语言 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/spellPresentationCoverage.test.ts |
| compulsion | 强迫术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| cone-of-cold | 寒冰锥 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts |
| confusion | 困惑术 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据；原文要求 turn-trigger，Activity 及专用运行时均无完整证据；未证明能力 random-table | src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| conjure-animals | 召唤动物 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts |
| conjure-celestial | 召唤天界生物 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据 |  |
| conjure-elemental | 召唤元素生物 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据；原文要求 area，Activity 及专用运行时均无完整证据；原文要求 slot-scaling，Activity 及专用运行时均无完整证据 |  |
| conjure-fey | 召唤精类生物 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据 |  |
| conjure-minor-elementals | 召唤次级元素生物 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts |
| conjure-woodland-beings | 召唤林地之精 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts |
| contact-other-plane | 异界探知 | audited-activity | partial |  |  |
| contagion | 疫病术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| contingency | 触发术 | audited-activity | partial |  |  |
| continual-flame | 不灭明焰 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityMapInteraction.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| control-water | 操控水体 | audited-activity | partial | 原文要求 half-on-save，Activity 及专用运行时均无完整证据；原文要求 concentration，Activity 及专用运行时均无完整证据；原文要求 area，Activity 及专用运行时均无完整证据；原文要求 turn-trigger，Activity 及专用运行时均无完整证据；原文要求 movement，Activity 及专用运行时均无完整证据；未证明能力 mode-choice；未证明能力 terrain-geometry | src/lib/dnd5eActionIcons.test.ts |
| control-weather | 操控天气 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据；未证明能力 mode-choice |  |
| counterspell | 法术反制 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/pages/maps/ReactionInterruptPanels.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/inventoryReactionSpells.test.ts<br>src/rulesets/dnd5e/magicItems.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/pluginApi.test.ts<br>src/rulesets/dnd5e/postSpellRandomTable.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| create-food-and-water | 造粮术 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts |
| create-undead | 唤起死灵 | audited-activity | partial | 原文要求 sustained-control，Activity 及专用运行时均无完整证据；原文要求 slot-scaling，Activity 及专用运行时均无完整证据 |  |
| create-or-destroy-water | 造水/枯水术 | audited-activity | partial | 原文要求 area，Activity 及专用运行时均无完整证据；原文要求 slot-scaling，Activity 及专用运行时均无完整证据；未证明能力 mode-choice；未证明能力 world-object；未证明能力 terrain-geometry | src/lib/dnd5eActionIcons.test.ts |
| creation | 造物术 | audited-activity | partial | 原文要求 area，Activity 及专用运行时均无完整证据；原文要求 slot-scaling，Activity 及专用运行时均无完整证据 | src/rulesets/dnd5e/pluginApi.test.ts<br>src/rulesets/dnd5e/pluginSpellTransaction.test.ts<br>src/store/syncMerge.test.ts |
| cure-wounds | 疗伤术 | core-transaction | verified-full |  | src/lib/combatStatistics.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/magicItems.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/monsterHitPointMaximumReduction.test.ts<br>src/rulesets/dnd5e/plugins/pluginItemHeadlessProtocol.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| dancing-lights | 舞光术 | core-transaction | verified-full |  | src/application/combat/spells/SpellTargetingCoordinator.test.ts<br>src/components/map/PlayerCombatHotbar.test.ts<br>src/components/map/PlayerMapSpellHotbar.test.ts<br>src/lib/classResources.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/explorationSpellInitiative.test.ts<br>src/lib/playerActionAuthorityRouter.test.ts<br>src/lib/vfxSequence.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/racialAutomation.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts |
| darkness | 黑暗术 | core-transaction | verified-full |  | src/components/map/mapLightingPresentation.test.ts<br>src/components/map/MapPersistentAreaLayers.test.ts<br>src/lib/classResources.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/mapGeometry.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/dmWallOfFireRemoval.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityExecutor.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityMapInteraction.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/effectiveVision.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/racialAutomation.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts<br>src/store/characterTokenPresentation.test.ts<br>src/store/mapsMigrate.test.ts |
| darkvision | 黑暗视觉 | core-transaction | verified-full |  | src/components/map/combatSpellDamagePresentation.test.ts<br>src/components/map/mapLightingPresentation.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityExecutor.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/effectiveVision.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterStatBlockPaste.test.ts<br>src/rulesets/dnd5e/specialSenses.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/store/characterTokenPresentation.test.ts |
| daylight | 昼明术 | core-transaction | verified-full |  | src/components/map/MapPersistentAreaLayers.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/mapGeometry.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts |
| death-ward | 防死结界 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterComplexPoisonOnHit.test.ts |
| delayed-blast-fireball | 延迟爆裂火球 | audited-activity | partial | 原文要求 half-on-save，Activity 及专用运行时均无完整证据 |  |
| demiplane | 创造半位面 | audited-activity | partial |  |  |
| detect-evil-and-good | 侦测善恶 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts |
| detect-magic | 侦测魔法 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts |
| detect-poison-and-disease | 侦测毒性和疾病 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts |
| detect-thoughts | 侦测思想 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| dimension-door | 任意门 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts |
| disguise-self | 易容术 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts |
| disintegrate | 解离术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts |
| dispel-evil-and-good | 反制善恶 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| dispel-magic | 解除魔法 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/mapObjectState.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/pluginApi.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| divination | 预言术 | none | manual |  | src/rulesets/dnd5e/activities/dnd5eActivityExecutor.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| divine-favor | 神恩 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/opportunityAttackAction.test.ts |
| divine-word | 圣言术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts |
| dominate-beast | 支配野兽 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| dominate-monster | 支配怪物 | audited-activity | partial |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| dominate-person | 支配人类 | audited-activity | partial |  | src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| dream | 托梦术 | audited-activity | partial | 未证明能力 communication |  |
| druidcraft | 德鲁伊伎俩 | audited-activity | partial | 原文要求 area，Activity 及专用运行时均无完整证据；未证明能力 mode-choice |  |
| earthquake | 地震术 | audited-activity | partial |  | src/rulesets/dnd5e/spellCatalog.test.ts |
| eldritch-blast | 魔能爆 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/classes.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellAdvancement.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| enhance-ability | 强化属性 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/items.test.ts |
| enlarge-reduce | 变巨/缩小术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/checks.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| entangle | 纠缠术 | core-transaction | verified-full |  | src/components/map/MapPersistentAreaLayers.test.ts<br>src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/persistentAreaTypes.test.ts<br>src/rulesets/dnd5e/playerBasicAction.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| enthrall | 注目术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| etherealness | 以太化 | audited-activity | partial | 未证明能力 planar-state；未证明能力 effect-suppression | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| expeditious-retreat | 脚底抹油 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/sustainedSpellControls.test.ts |
| eyebite | 摄心目光 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| fabricate | 鬼斧神工 | audited-activity | partial | 原文要求 area，Activity 及专用运行时均无完整证据 |  |
| faerie-fire | 妖火 | core-transaction | verified-full |  | src/lib/classResources.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/localContentCollection.test.ts<br>src/rulesets/dnd5e/racialAutomation.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts<br>src/rulesets/dnd5e/subclassSpellLists.test.ts<br>src/rulesets/dnd5e/visibilityRegression.test.ts |
| faithful-hound | 忠犬术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| false-life | 虚假生命 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| fear | 恐惧术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activeEffectsHeadless.test.ts<br>src/rulesets/dnd5e/activities/legacyContentActivityAdapters.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| feather-fall | 羽落术 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/pluginSpellTransaction.test.ts<br>src/rulesets/dnd5e/traversalHeadless.test.ts |
| feeblemind | 弱智术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/campaignTimeRules.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| find-familiar | 获得魔宠 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts |
| find-steed | 召唤坐骑 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts |
| find-traps | 寻找陷阱 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts |
| find-the-path | 寻路术 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据 |  |
| finger-of-death | 死亡一指 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| fire-bolt | 火焰箭 | core-transaction | verified-full |  | src/components/map/PlayerCombatHotbar.test.ts<br>src/lib/characterExcelImport.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/lib/sharedServerHttp.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/spellAoeHighlight.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffectsHeadless.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts<br>src/rulesets/dnd5e/buildChoices.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/eldritchKnight.test.ts<br>src/rulesets/dnd5e/featHeadlessPrimitives.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterContentAutoParser.test.ts<br>src/rulesets/dnd5e/monsterContentDeepAnalysis.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsterStatBlockPaste.test.ts<br>src/rulesets/dnd5e/postSpellRandomTable.test.ts<br>src/rulesets/dnd5e/protectionFromEnergySpell.test.ts<br>src/rulesets/dnd5e/racialAutomation.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts<br>src/rulesets/dnd5e/spellDamageMaxDieBonus.test.ts<br>src/rulesets/dnd5e/spellModifierIntents.test.ts<br>src/rulesets/dnd5e/subclassSpellcasting.test.ts |
| fire-shield | 火焰护盾 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/pluginSpellTransaction.test.ts |
| fire-storm | 火焰风暴 | audited-activity | verified-full |  | src/rulesets/dnd5e/pluginSpellTransaction.test.ts |
| fireball | 火球术 | core-transaction | verified-full |  | src/components/map/CombatActionBanner.test.ts<br>src/components/map/Dnd5eActionIcon.test.ts<br>src/components/map/Dnd5eActionIcon.test.tsx<br>src/components/map/flamingSphereHandoff.test.ts<br>src/components/map/PlayerCombatHotbar.test.ts<br>src/lib/characterExcelImport.test.ts<br>src/lib/combatLogDetails.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/dnd5eCombatActionDescriptors.test.ts<br>src/lib/monsterManualSpell.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/aoeTargetingSession.test.ts<br>src/pages/maps/CombatLogEntryCard.test.ts<br>src/pages/maps/commitDnd5eCombatResult.test.ts<br>src/pages/maps/settleDnd5eCombatResult.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/presentation/maps/combatViewModel.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityIdentity.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/featHeadlessPrimitives.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/magicItems.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterContentAutoParser.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/pluginApi.test.ts<br>src/rulesets/dnd5e/plugins/pluginItemHeadlessProtocol.test.ts<br>src/rulesets/dnd5e/postSpellRandomTable.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts<br>src/rulesets/dnd5e/spellComponents.test.ts<br>src/rulesets/dnd5e/spellModifierIntents.test.ts<br>src/rulesets/dnd5e/spellPresentationCoverage.test.ts<br>src/rulesets/dnd5e/subclassSpellcasting.test.ts<br>src/rulesets/dnd5e/subclassSpellLists.test.ts<br>src/rulesets/dnd5e/verticalCombatGeometry.test.ts |
| flame-blade | 火焰刀 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/inventoryHeadlessCombat.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| flame-strike | 焰击术 | core-transaction | verified-full |  | src/components/map/combatSpellDamagePresentation.test.ts<br>src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| flaming-sphere | 炽焰法球 | core-transaction | verified-full |  | src/components/map/Dnd5eConcentrationTokenBadge.test.tsx<br>src/components/map/Dnd5eSpellEffectDetailPanel.test.tsx<br>src/components/map/flamingSphereHandoff.test.ts<br>src/components/map/PlayerCombatHotbar.test.ts<br>src/components/map/tokenStatusTooltip.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/dnd5eCombatActionDescriptors.test.ts<br>src/lib/sharedResourceValidation.test.ts<br>src/pages/maps/aoeTargetingSession.test.ts<br>src/pages/maps/combatStartTokenMarks.test.ts<br>src/pages/maps/concentrationTokenMarks.test.ts<br>src/pages/maps/dmWallOfFireRemoval.test.ts<br>src/pages/maps/flamingSphereConcentration.test.ts<br>src/pages/maps/persistentAreaTurnBoundary.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/pages/maps/tokenBorderPresentation.test.ts<br>src/rulesets/dnd5e/combatPersistentSpellBatch.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/genericCombatPrimitives.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/persistentAreaPresentation.test.ts<br>src/rulesets/dnd5e/pluginAreas.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/store/mapsMigrate.test.ts<br>src/store/roomCommands.test.ts<br>src/store/syncMerge.test.ts |
| flesh-to-stone | 石化术 | audited-activity | verified-full |  | src/rulesets/dnd5e/spellCatalog.test.ts |
| floating-disk | 浮碟术 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts |
| fly | 飞行术 | core-transaction | verified-full |  | src/lib/combatCommandApi.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/concentrationTokenMarks.test.ts<br>src/pages/maps/dmWallOfFireRemoval.test.ts<br>src/pages/maps/settleDnd5eCombatResult.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/flyingSnakeHeadless.test.ts<br>src/rulesets/dnd5e/genericCombatPrimitives.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/monsterMoveAction.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/playerMoveAction.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/traversal.test.ts<br>src/rulesets/dnd5e/traversalHeadless.test.ts<br>src/store/roomCommands.test.ts |
| fog-cloud | 云雾术 | core-transaction | verified-full |  | src/components/map/MapPersistentAreaLayers.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/mapGeometry.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| forbiddance | 禁制术 | audited-activity | partial |  |  |
| forcecage | 魔力监牢 | audited-activity | verified-full |  | src/lib/mapGeometry.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| foresight | 预警术 | audited-activity | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| freedom-of-movement | 行动自如 | audited-activity | verified-full |  | src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts<br>src/rulesets/dnd5e/playerMoveAction.test.ts |
| freezing-sphere | 冰封法球 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts |
| gaseous-form | 气化形体 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts |
| gate | 异界之门 | audited-activity | partial |  | src/components/dm/dmCampaignStoryModel.test.ts<br>src/lib/combatLogRollback.test.ts<br>src/lib/sceneOrchestration.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/dicePresentationGate.test.ts<br>src/rulesets/dnd5e/declarativeClass.test.ts |
| geas | 指使术 | audited-activity | partial | 原文要求 slot-scaling，Activity 及专用运行时均无完整证据 |  |
| gentle-repose | 遗体防腐 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| giant-insect | 巨虫术 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据 |  |
| glibness | 花言巧语 | audited-activity | partial |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| globe-of-invulnerability | 法术无效结界 | audited-activity | partial |  |  |
| glyph-of-warding | 守卫刻文 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts |
| goodberry | 神莓术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts |
| grease | 油腻术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/mapDifficultTerrain.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/monsterMoveAction.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/persistentAreaGeometry.test.ts<br>src/rulesets/dnd5e/persistentAreaTypes.test.ts<br>src/rulesets/dnd5e/playerMoveAction.test.ts<br>src/rulesets/dnd5e/pluginAreas.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/verticalCombatGeometry.test.ts |
| greater-invisibility | 高等隐形术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts |
| greater-restoration | 高等复原术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts |
| guardian-of-faith | 信仰守卫 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| guards-and-wards | 铜墙铁壁 | audited-activity | partial |  |  |
| guidance | 神导术 | core-transaction | verified-full |  | src/components/map/tokenStatusTooltip.test.ts<br>src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/presentation/maps/mapViewportCharacters.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/optionalBonusDieSpells.test.ts |
| guiding-bolt | 曳光弹 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterParryHeadless.test.ts |
| gust-of-wind | 造风术 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts |
| hallow | 圣居 | audited-activity | partial | 原文要求 condition，Activity 及专用运行时均无完整证据；原文要求 turn-trigger，Activity 及专用运行时均无完整证据；原文要求 movement，Activity 及专用运行时均无完整证据；未证明能力 mode-choice |  |
| hallucinatory-terrain | 幻景 | audited-activity | partial | 原文要求 area，Activity 及专用运行时均无完整证据；未证明能力 terrain-geometry |  |
| harm | 重伤术 | core-transaction | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| haste | 加速术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/subclassSpellLists.test.ts |
| heal | 医疗术 | core-transaction | verified-full |  | src/components/map/Dnd5eActionIcon.test.ts<br>src/lib/combatStatistics.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedResourceSubscription.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/legendaryActionBoundary.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityExecutor.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityRegistry.test.ts<br>src/rulesets/dnd5e/activities/dnd5eLongLivedSpellActivities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/fighter.test.ts<br>src/rulesets/dnd5e/genericCombatPrimitives.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/hitPoints.test.ts<br>src/rulesets/dnd5e/localContentAiImport.test.ts<br>src/rulesets/dnd5e/localContentCollection.test.ts<br>src/rulesets/dnd5e/magicItems.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterConditionalOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterHealingTouch.test.ts<br>src/rulesets/dnd5e/monsterMummyRotMultiattack.test.ts<br>src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterSupportCandidateGenerators.test.ts<br>src/rulesets/dnd5e/pluginSandboxCapabilities.test.ts<br>src/rulesets/dnd5e/prayerOfHealingHeadless.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| healing-word | 治愈真言 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| heat-metal | 灼热金属 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/sustainedSpellControls.test.ts |
| hellish-rebuke | 炼狱叱喝 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/inventoryReactionSpells.test.ts<br>src/rulesets/dnd5e/magicItems.test.ts<br>src/rulesets/dnd5e/racialAutomation.test.ts |
| heroes-feast | 英雄宴 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| heroism | 英雄气概 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| hideous-laughter | 狂笑术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/settleDnd5eCombatResult.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/combatScenarioRegression.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/localContentCollection.test.ts<br>src/rulesets/dnd5e/playerMoveAction.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| hold-monster | 怪物定身术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| hold-person | 人类定身术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/concentrationTokenMarks.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| holy-aura | 圣洁灵光 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eFormula.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| hunters-mark | 猎人印记 | core-transaction | verified-full |  | src/components/map/CombatActionBanner.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| hypnotic-pattern | 催眠图纹 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/playerBasicAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts |
| ice-storm | 冰风暴 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/playerMoveAction.test.ts<br>src/rulesets/dnd5e/pluginAreas.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts<br>src/rulesets/dnd5e/spellDamageMaxDieBonus.test.ts |
| identify | 鉴定术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts<br>src/rulesets/dnd5e/items.test.ts<br>src/rulesets/dnd5e/spellMaterials.test.ts<br>src/rulesets/dnd5e/spellPresentationCoverage.test.ts |
| illusory-script | 迷幻手稿 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts |
| imprisonment | 禁锢术 | audited-activity | partial |  | src/rulesets/dnd5e/spellCatalog.test.ts |
| incendiary-cloud | 焚云术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| inflict-wounds | 致伤术 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/monsterParryHeadless.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| insect-plague | 疫病虫群 | core-transaction | verified-full |  | src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/combatPersistentSpellBatch.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/persistentAreaPresentation.test.ts<br>src/rulesets/dnd5e/persistentAreaTypes.test.ts |
| instant-summons | 瞬间召唤 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eLongLivedSpellActivities.test.ts |
| invisibility | 隐形术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/activeEffectsHeadless.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/tokenStatusMarkers.test.ts |
| irresistible-dance | 迷舞术 | audited-activity | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| jump | 跳跃术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/classes.test.ts<br>src/rulesets/dnd5e/featHeadlessPrimitives.test.ts<br>src/rulesets/dnd5e/fighter.test.ts<br>src/rulesets/dnd5e/localContentCollection.test.ts<br>src/rulesets/dnd5e/magicItems.test.ts<br>src/rulesets/dnd5e/monsterMoveAction.test.ts<br>src/rulesets/dnd5e/plugins/pluginItemHeadlessProtocol.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/traversal.test.ts |
| knock | 敲击术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityMapInteraction.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/mapInteraction.test.ts<br>src/rulesets/dnd5e/totemWarrior.test.ts |
| legend-lore | 通晓传奇 | none | manual |  | src/lib/monsterManualSpell.test.ts<br>src/pages/maps/DmAdjudicationPanel.test.ts |
| lesser-restoration | 次级复原术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/magicItems.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| levitate | 浮空术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/pluginFeatureAction.test.ts |
| light | 光亮术 | audited-activity | verified-full |  | src/application/combat/spells/SpellTargetingCoordinator.test.ts<br>src/components/map/mapCanvasSurface.test.ts<br>src/components/map/mapLightingPresentation.test.ts<br>src/components/map/PlayerMapSpellHotbar.test.ts<br>src/components/map/tokenBorderFlow.test.ts<br>src/components/rules/Dnd5eActivityTemplateEditor.test.ts<br>src/lib/appTheme.test.ts<br>src/lib/campaignTime.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/explorationSpellInitiative.test.ts<br>src/lib/mapGeometry.test.ts<br>src/lib/playerActionAuthorityRouter.test.ts<br>src/lib/sceneOrchestration.test.ts<br>src/lib/sharedResourceValidation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/lib/uvttExport.test.ts<br>src/pages/maps/cuttingWordsVisibility.test.ts<br>src/presentation/maps/MapViewportLayer.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityCombatE2e.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityCommand.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityExecutor.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityInvocation.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityMapInteraction.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityWeaponAttackGrant.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/attackDisadvantageInterrupt.test.ts<br>src/rulesets/dnd5e/character.test.ts<br>src/rulesets/dnd5e/contentPackageV2.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/declarativeSubclassAbility.test.ts<br>src/rulesets/dnd5e/environmentRules.test.ts<br>src/rulesets/dnd5e/equipment.test.ts<br>src/rulesets/dnd5e/featHeadlessPrimitives.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/localContentCollection.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterAreaAction.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterMoveAction.test.ts<br>src/rulesets/dnd5e/monsterPersistentAreas.test.ts<br>src/rulesets/dnd5e/monsterStatBlockPaste.test.ts<br>src/rulesets/dnd5e/monsterStructuredSpecialActionBatch.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/playerMoveAction.test.ts<br>src/rulesets/dnd5e/pluginApi.test.ts<br>src/rulesets/dnd5e/pluginSpellTransaction.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/store/mapGeometry.test.ts<br>src/store/mapsMigrate.test.ts<br>src/store/sceneOrchestration.test.ts |
| lightning-bolt | 闪电束 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts<br>src/rulesets/dnd5e/verticalCombatGeometry.test.ts |
| locate-animals-or-plants | 动植物定位术 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据 | src/lib/dnd5eActionIcons.test.ts |
| locate-creature | 生物定位术 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据 |  |
| locate-object | 物件定位术 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据 | src/lib/dnd5eActionIcons.test.ts |
| longstrider | 大步奔行 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/protectionFromEnergySpell.test.ts |
| mage-armor | 法师护甲 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/damageMitigationInterrupt.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/items.test.ts<br>src/rulesets/dnd5e/localContentAiImport.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterContentDeepAnalysis.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/monsterStatBlockPaste.test.ts |
| mage-hand | 法师之手 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/persistentAreaPresentation.test.ts<br>src/rulesets/dnd5e/persistentAreaTypes.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts<br>src/rulesets/dnd5e/utilityProjection.test.ts |
| magic-circle | 防护法阵 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/persistentAreaGeometry.test.ts |
| magic-jar | 魔魂壶 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eLongLivedSpellActivities.test.ts |
| magic-missile | 魔法飞弹 | core-transaction | verified-full |  | src/application/combat/spells/SpellTargetingCoordinator.test.ts<br>src/components/map/combatSpellDamagePresentation.test.ts<br>src/components/map/PlayerCombatHotbar.test.ts<br>src/lib/characterExcelImport.test.ts<br>src/lib/combatLogDetails.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/dnd5eCombatActionDescriptors.test.ts<br>src/lib/explorationSpellInitiative.test.ts<br>src/lib/monsterManualSpell.test.ts<br>src/lib/sharedApi.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/CombatLogEntryCard.test.ts<br>src/pages/maps/commitDnd5eCombatResult.test.ts<br>src/pages/maps/DmAdjudicationPanel.test.ts<br>src/pages/maps/settleDnd5eCombatResult.test.ts<br>src/pages/maps/spellProjectileTargeting.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/eldritchKnight.test.ts<br>src/rulesets/dnd5e/genericCombatPrimitives.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/magicItems.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/postSpellRandomTable.test.ts<br>src/rulesets/dnd5e/racialAutomation.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts<br>src/rulesets/dnd5e/spellDamageMaxDieBonus.test.ts<br>src/rulesets/dnd5e/subclassSpellcasting.test.ts |
| magic-mouth | 魔嘴术 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts |
| magic-weapon | 魔化武器 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/equipmentAttackAction.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| magnificent-mansion | 豪宅术 | audited-activity | partial | 原文要求 area，Activity 及专用运行时均无完整证据 |  |
| major-image | 高等幻影 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts |
| mass-cure-wounds | 群体疗伤术 | core-transaction | verified-full |  | src/rulesets/dnd5e/magicItems.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| mass-heal | 群体医疗术 | core-transaction | verified-full |  | src/lib/vfxSequence.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| mass-healing-word | 群体治愈真言 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| mass-suggestion | 群体暗示术 | audited-activity | partial | 原文要求 condition，Activity 及专用运行时均无完整证据；原文要求 slot-scaling，Activity 及专用运行时均无完整证据 |  |
| maze | 迷宫术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| meld-into-stone | 融身入石 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activities/dnd5eLongLivedSpellActivities.test.ts |
| mending | 修复术 | audited-activity | partial | 未证明能力 world-object |  |
| message | 传讯术 | audited-activity | verified-full |  | src/components/map/Dnd5eActionIcon.test.ts<br>src/components/map/mapFreeDiceRoll.test.ts<br>src/components/map/MapSpellsPanel.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/dnd5eCombatSimulationJob.test.ts<br>src/lib/dnd5eMonsterTurnPlannerWorker.test.ts<br>src/lib/pdfCampaignAnalysis.test.ts<br>src/lib/sharedCombatReset.test.ts<br>src/lib/sharedResourceSubscription.test.ts<br>src/lib/sharedServerCombatTransactions.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/lib/tencentVerificationProvider.test.ts<br>src/pages/maps/combatEndCoordinator.test.ts<br>src/pages/maps/postSpellRandomTableAdjudication.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/localContentAiImport.test.ts<br>src/rulesets/dnd5e/pluginSandbox.test.ts |
| meteor-swarm | 流星爆 | core-transaction | verified-full |  | src/application/combat/spells/SpellTargetingCoordinator.test.ts<br>src/pages/maps/spellAoeHighlight.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts |
| mind-blank | 心灵屏障 | audited-activity | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| minor-illusion | 次级幻影 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/lib/vfxSequence.test.ts<br>src/rulesets/dnd5e/localContentCollection.test.ts<br>src/rulesets/dnd5e/racialAutomation.test.ts |
| mirage-arcane | 海市蜃楼 | audited-activity | partial | 未证明能力 terrain-geometry |  |
| mirror-image | 镜影术 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/dnd5eActiveEffectEditing.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/pluginSpellTransaction.test.ts |
| mislead | 假象术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| misty-step | 迷踪步 | core-transaction | verified-full |  | src/lib/combatLogDetails.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| modify-memory | 篡改记忆 | audited-activity | partial | 原文要求 slot-scaling，Activity 及专用运行时均无完整证据 |  |
| moonbeam | 月华之光 | core-transaction | verified-full |  | src/components/map/MapPersistentAreaLayers.test.ts<br>src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/persistentAreaGeometry.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/verticalCombatGeometry.test.ts<br>src/store/characterNormalizationDamageAudit.test.ts |
| move-earth | 地动术 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据；未证明能力 terrain-geometry |  |
| nondetection | 回避侦测 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| pass-without-trace | 行动无踪 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| passwall | 穿墙术 | audited-activity | verified-full |  | src/lib/mapGeometry.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| phantasmal-killer | 魅影杀手 | core-transaction | verified-full |  | src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| phantom-steed | 魅影驹 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/summonedCreatures.test.ts<br>src/store/mapsMigrate.test.ts |
| planar-ally | 异界盟誓 | audited-activity | partial |  |  |
| planar-binding | 异界誓缚 | audited-activity | partial | 原文要求 slot-scaling，Activity 及专用运行时均无完整证据 |  |
| plane-shift | 异界传送 | audited-activity | partial |  | src/rulesets/dnd5e/magicItems.test.ts<br>src/rulesets/dnd5e/srdContent.test.ts |
| plant-growth | 植物滋长 | audited-activity | partial | 未证明能力 terrain-geometry | src/lib/dnd5eActionIcons.test.ts |
| poison-spray | 毒气喷溅 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/optionalBonusDieSpells.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellSavePressure.test.ts |
| polymorph | 变形术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts |
| power-word-kill | 律令死亡 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| power-word-stun | 律令震慑 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| prayer-of-healing | 治疗祷言 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/prayerOfHealingHeadless.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts |
| prestidigitation | 魔法伎俩 | audited-activity | partial | 原文要求 area，Activity 及专用运行时均无完整证据；原文要求 turn-trigger，Activity 及专用运行时均无完整证据；未证明能力 mode-choice |  |
| prismatic-spray | 虹光喷射 | audited-activity | partial | 原文要求 half-on-save，Activity 及专用运行时均无完整证据；原文要求 condition，Activity 及专用运行时均无完整证据；原文要求 turn-trigger，Activity 及专用运行时均无完整证据；原文要求 movement，Activity 及专用运行时均无完整证据；未证明能力 random-table |  |
| prismatic-wall | 虹光法墙 | audited-activity | partial | 原文要求 half-on-save，Activity 及专用运行时均无完整证据；原文要求 condition，Activity 及专用运行时均无完整证据；原文要求 turn-trigger，Activity 及专用运行时均无完整证据；原文要求 movement，Activity 及专用运行时均无完整证据 |  |
| private-sanctum | 私人密室 | audited-activity | partial |  | src/lib/mapGeometry.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| produce-flame | 燃火术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts<br>src/rulesets/dnd5e/sustainedSpellControls.test.ts |
| programmed-illusion | 预置幻影 | audited-activity | partial | 原文要求 area，Activity 及专用运行时均无完整证据 |  |
| project-image | 投影术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| protection-from-energy | 防护能量伤害 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/protectionFromEnergySpell.test.ts |
| protection-from-evil-and-good | 防护善恶 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts<br>src/rulesets/dnd5e/spellMaterials.test.ts |
| protection-from-poison | 防护毒素 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffectsHeadless.test.ts<br>src/rulesets/dnd5e/endTurnAction.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts |
| purify-food-and-drink | 净化食粮 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts |
| raise-dead | 死者复活 | audited-activity | verified-full |  | src/rulesets/dnd5e/spellMaterials.test.ts |
| ray-of-enfeeblement | 衰弱射线 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| ray-of-frost | 冷冻射线 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedResourceValidation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterStatBlockPaste.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| regenerate | 再生术 | audited-activity | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| reincarnate | 转生术 | audited-activity | partial | 未证明能力 death-handoff；未证明能力 random-table |  |
| remove-curse | 移除诅咒 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| resilient-sphere | 弹力法球 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| resistance | 抗力术 | core-transaction | verified-full |  | src/application/combat/spells/SpellTargetingCoordinator.test.ts<br>src/lib/combatPresentation.test.ts<br>src/pages/maps/combatStartTokenMarks.test.ts<br>src/pages/maps/spellAoeHighlight.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/character.test.ts<br>src/rulesets/dnd5e/combatPersistentSpellBatch.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/contentPackageV2.test.ts<br>src/rulesets/dnd5e/coreRaceMechanics.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/damageDefenses.test.ts<br>src/rulesets/dnd5e/damageMitigationInterrupt.test.ts<br>src/rulesets/dnd5e/declarativeSubclassAbility.test.ts<br>src/rulesets/dnd5e/dnd5e2014Adapter.test.ts<br>src/rulesets/dnd5e/genericCombatPrimitives.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterBasiliskGazeHeadless.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterConditionalOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterForcedMovementMultiattack.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterHitPointMaximumReduction.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts<br>src/rulesets/dnd5e/monsterPersistentAreas.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterStatBlockPaste.test.ts<br>src/rulesets/dnd5e/optionalBonusDieSpells.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts<br>src/rulesets/dnd5e/pluginSpellTransaction.test.ts<br>src/rulesets/dnd5e/protectionFromEnergySpell.test.ts<br>src/rulesets/dnd5e/racialAutomation.test.ts<br>src/rulesets/dnd5e/sourceTurnPeriodicDamage.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/srdMonsterGenerator.test.ts |
| resurrection | 复生术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| reverse-gravity | 反重力 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| revivify | 回生术 | audited-activity | verified-full |  | src/rulesets/dnd5e/adjudicatedSpellAction.test.ts<br>src/rulesets/dnd5e/spellMaterials.test.ts |
| rope-trick | 魔绳术 | audited-activity | partial | 原文要求 condition，Activity 及专用运行时均无完整证据 | src/lib/dnd5eActionIcons.test.ts |
| sacred-flame | 圣火术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/featHeadlessPrimitives.test.ts<br>src/rulesets/dnd5e/genericCombatPrimitives.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/postD20Adjustment.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellPresentationCoverage.test.ts |
| sanctuary | 庇护术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| scorching-ray | 灼热射线 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/magicItems.test.ts<br>src/rulesets/dnd5e/plugins/pluginItemHeadlessProtocol.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellDamageMaxDieBonus.test.ts |
| scrying | 探知 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据 |  |
| secret-chest | 秘藏箱 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eLongLivedSpellActivities.test.ts<br>src/rulesets/dnd5e/campaignTimeRules.test.ts |
| see-invisibility | 识破隐形 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts |
| seeming | 伪装术 | audited-activity | partial |  | src/rulesets/dnd5e/spellCatalog.test.ts |
| sending | 短讯术 | audited-activity | partial | 未证明能力 communication |  |
| sequester | 隔离术 | audited-activity | partial | 未证明能力 long-term-state |  |
| shapechange | 形体变化 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据 | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/tokenStatusMarkers.test.ts |
| shatter | 粉碎音波 | core-transaction | verified-full |  | src/components/map/CombatActionBanner.test.ts<br>src/components/map/flamingSphereHandoff.test.ts<br>src/lib/combatKillStreak.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/lib/sharedServerHttp.test.ts<br>src/pages/maps/DmAdjudicationPanel.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/adjudicatedSpellAction.test.ts<br>src/rulesets/dnd5e/genericCombatPrimitives.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts |
| shield | 护盾术 | core-transaction | verified-full |  | src/lib/combatInterruptDmSettlement.test.ts<br>src/lib/combatInterruptPrompts.test.ts<br>src/lib/combatInterruptProtocol.test.ts<br>src/lib/combatInterruptSettlementRuntime.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/monsterManualSpell.test.ts<br>src/lib/sharedResourceValidation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/commitDnd5eCombatResult.test.ts<br>src/pages/maps/ReactionInterruptPanels.test.ts<br>src/rulesets/dnd5e/character.test.ts<br>src/rulesets/dnd5e/combatScenarioRegression.test.ts<br>src/rulesets/dnd5e/eldritchKnight.test.ts<br>src/rulesets/dnd5e/equipment.test.ts<br>src/rulesets/dnd5e/featHeadlessPrimitives.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/inventoryReactionSpells.test.ts<br>src/rulesets/dnd5e/magicItems.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterContentAutoParser.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/plugins/pluginItemHeadlessProtocol.test.ts<br>src/rulesets/dnd5e/pluginSpellTransaction.test.ts<br>src/rulesets/dnd5e/postSpellRandomTable.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellDescriptionsZh.test.ts |
| shield-of-faith | 虔诚护盾 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| shillelagh | 橡棍术 | core-transaction | verified-full |  | src/lib/vfxSequence.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/equipment.test.ts<br>src/rulesets/dnd5e/equipmentAttackAction.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts |
| shocking-grasp | 电爪 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| silence | 沉默术 | core-transaction | verified-full |  | src/lib/vfxSequence.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/persistentAreaGeometry.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| silent-image | 无声幻影 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据；原文要求 area，Activity 及专用运行时均无完整证据；未证明能力 entity-movement | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/pluginSpellTransaction.test.ts |
| simulacrum | 拟像术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityMapInteraction.test.ts |
| sleep | 睡眠术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/character.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/playerBasicAction.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| sleet-storm | 雪雨暴 | core-transaction | verified-full |  | src/components/map/MapPersistentAreaLayers.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts |
| slow | 缓慢术 | core-transaction | verified-full |  | src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterStructuredSpecialActionBatch.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/pluginApi.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts<br>src/rulesets/dnd5e/travel.test.ts |
| spare-the-dying | 维生术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| speak-with-animals | 动物交谈术 | none | manual |  | src/lib/dnd5eActionIcons.test.ts |
| speak-with-dead | 死者交谈 | none | manual |  | src/lib/dnd5eActionIcons.test.ts |
| speak-with-plants | 植物交谈 | audited-activity | partial | 原文要求 condition，Activity 及专用运行时均无完整证据；未证明能力 communication | src/lib/dnd5eActionIcons.test.ts |
| spider-climb | 蛛行术 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts |
| spike-growth | 荆棘丛生 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts |
| spirit-guardians | 灵体卫士 | core-transaction | verified-full |  | src/components/map/MapPersistentAreaLayers.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/mapDifficultTerrain.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/playerMoveAction.test.ts<br>src/rulesets/dnd5e/pluginAreas.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellbook.test.ts |
| spiritual-weapon | 灵体武器 | core-transaction | verified-full |  | src/components/map/combatSpellDamagePresentation.test.ts<br>src/components/map/PlayerCombatHotbar.test.ts<br>src/components/map/PlayerMapSpellHotbar.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterParryHeadless.test.ts<br>src/rulesets/dnd5e/pluginAreas.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/store/roomCommands.test.ts |
| stinking-cloud | 臭云术 | core-transaction | verified-full |  | src/components/map/MapPersistentAreaLayers.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts |
| stone-shape | 塑石术 | audited-activity | partial | 未证明能力 terrain-geometry；未证明能力 world-object |  |
| stoneskin | 石肤术 | audited-activity | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/pluginSpellTransaction.test.ts |
| storm-of-vengeance | 复仇风暴 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| suggestion | 暗示术 | audited-activity | partial |  | src/components/dm/pdfSourceBookmarkModel.test.ts |
| sunbeam | 阳炎射线 | core-transaction | verified-full |  | src/rulesets/dnd5e/sustainedSpellControls.test.ts |
| sunburst | 阳炎爆 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/endTurnAction.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| symbol | 魔法徽记 | audited-activity | partial | 原文要求 half-on-save，Activity 及专用运行时均无完整证据；原文要求 condition，Activity 及专用运行时均无完整证据；未证明能力 mode-choice |  |
| telekinesis | 心灵遥控 | audited-activity | partial |  | src/rulesets/dnd5e/spellCatalog.test.ts |
| telepathic-bond | 心灵联结 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| teleport | 传送术 | audited-activity | partial |  | src/lib/mapGeometry.test.ts<br>src/pages/maps/DmAdjudicationPanel.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityMapInteraction.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/eldritchKnight.test.ts<br>src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/rulesets/dnd5e/persistentAreaTypes.test.ts<br>src/store/mapsMigrate.test.ts<br>src/store/sceneOrchestration.test.ts |
| teleportation-circle | 传送法阵 | audited-activity | partial | 原文要求 turn-trigger，Activity 及专用运行时均无完整证据 |  |
| thaumaturgy | 奇术 | core-transaction | verified-full |  | src/lib/vfxSequence.test.ts |
| thunderwave | 雷鸣波 | core-transaction | verified-full |  | src/components/map/CombatActionBanner.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/lib/sharedServerHttp.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityExecutor.test.ts<br>src/rulesets/dnd5e/combatScenarioRegression.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts |
| time-stop | 时间停止 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts |
| tiny-hut | 小屋术 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/lib/mapGeometry.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityMapInteraction.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/pluginAreas.test.ts<br>src/store/mapsMigrate.test.ts |
| tongues | 巧言术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| transport-via-plants | 木遁术 | audited-activity | partial | 未证明能力 world-object |  |
| tree-stride | 树跃术 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据；未证明能力 world-object |  |
| true-polymorph | 完全变形术 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据 |  |
| true-resurrection | 完全复生术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| true-seeing | 真知术 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| true-strike | 克敌机先 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/pluginSpellTransaction.test.ts<br>src/rulesets/dnd5e/spellComponents.test.ts |
| unseen-servant | 隐形仆役 | audited-activity | partial | 原文要求 condition，Activity 及专用运行时均无完整证据；原文要求 movement，Activity 及专用运行时均无完整证据 | src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts |
| vampiric-touch | 吸血鬼之触 | core-transaction | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/sustainedSpellControls.test.ts |
| vicious-mockery | 恶言相加 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellCatalog.test.ts |
| wall-of-fire | 火墙术 | core-transaction | verified-full |  | src/components/map/flamingSphereHandoff.test.ts<br>src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/dmWallOfFireRemoval.test.ts<br>src/pages/maps/spellAoeHighlight.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/spellAction.test.ts<br>src/rulesets/dnd5e/spellDamageMaxDieBonus.test.ts<br>src/rulesets/dnd5e/wallOfFireGeometry.test.ts |
| wall-of-force | 力场墙 | core-transaction | verified-full |  | src/components/map/MapPersistentAreaLayers.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts |
| wall-of-ice | 冰墙术 | core-transaction | verified-full |  | src/components/map/MapPersistentAreaLayers.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts |
| wall-of-stone | 石墙术 | core-transaction | verified-full |  | src/components/map/MapPersistentAreaLayers.test.ts<br>src/lib/mapGeometry.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts |
| wall-of-thorns | 棘墙术 | core-transaction | verified-full |  | src/components/map/MapPersistentAreaLayers.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts |
| warding-bond | 守护之链 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts |
| water-breathing | 水下呼吸 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| water-walk | 水上行走 | audited-activity | verified-full |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| web | 蛛网术 | core-transaction | verified-full |  | src/lib/combatPresentation.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/concentrationTokenMarks.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/activeEffectsHeadless.test.ts<br>src/rulesets/dnd5e/coreSpellAreas.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/magicItems.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts<br>src/rulesets/dnd5e/monsterBasicAction.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| weird | 怪影杀手 | audited-activity | partial | 原文要求 concentration，Activity 及专用运行时均无完整证据；原文要求 turn-trigger，Activity 及专用运行时均无完整证据 |  |
| wind-walk | 御风而行 | audited-activity | verified-full |  | src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts |
| wind-wall | 风墙术 | core-transaction | verified-full |  | src/components/map/MapPersistentAreaLayers.test.ts<br>src/lib/dnd5eActionIcons.test.ts<br>src/lib/vfxSequence.test.ts<br>src/pages/maps/spellSettlementCoordinator.test.ts<br>src/rulesets/dnd5e/monsterAdvancedAbilities.test.ts |
| wish | 祈愿术 | audited-activity | partial |  | src/rulesets/dnd5e/spellCatalog.test.ts<br>src/rulesets/dnd5e/spellDescriptionsZh.test.ts |
| word-of-recall | 回返真言 | audited-activity | partial |  |  |
| zone-of-truth | 诚实之域 | audited-activity | partial |  | src/lib/dnd5eActionIcons.test.ts<br>src/rulesets/dnd5e/activities/dnd5eCoreSpellActivities.test.ts<br>src/rulesets/dnd5e/persistentAreaTypes.test.ts |

## 怪物动作（1078）

| 怪物 | 栏位 | 动作 | 结论 | 缺口 | 直接测试 |
| --- | --- | --- | --- | --- | --- |
| 底栖魔鱼 | actions | 多重攻击 | manual |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 底栖魔鱼 | actions | 触手 | manual | 原文骰池 1d12 未进入结构 | src/rulesets/dnd5e/monsterHeadlessSafetyPolicy.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 底栖魔鱼 | actions | 尾击 | verified-full |  | src/lib/enemyStatBlocks.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/legendaryActionWindow.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 底栖魔鱼 | actions | 奴役 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 底栖魔鱼 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 底栖魔鱼 | legendaryActions | 扫尾 | verified-full |  | src/lib/enemyStatBlocks.test.ts<br>src/rulesets/dnd5e/legendaryActionWindow.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 底栖魔鱼 | legendaryActions | 心灵汲取（消耗 2 动作） | verified-full |  | src/lib/enemyStatBlocks.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 侍僧 | actions | 木棒 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年黑龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCompositeMultiattack.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年黑龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCompositeMultiattack.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年黑龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/endTurnAction.test.ts<br>src/rulesets/dnd5e/monsterCompositeMultiattack.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年黑龙 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年黑龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsterCompositeMultiattack.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 成年黑龙 | actions | 强酸吐息 | verified-full |  | src/rulesets/dnd5e/endTurnAction.test.ts<br>src/rulesets/dnd5e/monsterCoreSpellAction.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年黑龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年黑龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 成年黑龙 | legendaryActions | 尾击攻击 | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 成年黑龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 成年蓝龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年蓝龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年蓝龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年蓝龙 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年蓝龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年蓝龙 | actions | 闪电吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年蓝龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年蓝龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年蓝龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 成年蓝龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年黄铜龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年黄铜龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年黄铜龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年黄铜龙 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年黄铜龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 成年黄铜龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年黄铜龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年黄铜龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 成年黄铜龙 | legendaryActions | 尾击攻击 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 成年黄铜龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 成年青铜龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年青铜龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年青铜龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年青铜龙 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年青铜龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 成年青铜龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAreaAction.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年青铜龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 成年青铜龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 成年青铜龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 成年青铜龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 成年赤铜龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年赤铜龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年赤铜龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年赤铜龙 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年赤铜龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年赤铜龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年赤铜龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 成年赤铜龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年赤铜龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 成年赤铜龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 成年金龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年金龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年金龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年金龙 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年金龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年金龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 成年金龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 成年金龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 成年金龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 成年金龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 成年绿龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年绿龙 | actions | 啃咬 | verified-full |  |  |
| 成年绿龙 | actions | 爪击 | verified-full |  |  |
| 成年绿龙 | actions | 尾击 | verified-full |  |  |
| 成年绿龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年绿龙 | actions | 毒气吐息 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年绿龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年绿龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年绿龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 成年绿龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年红龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年红龙 | actions | 啃咬 | verified-full |  |  |
| 成年红龙 | actions | 爪击 | verified-full |  |  |
| 成年红龙 | actions | 尾击 | verified-full |  |  |
| 成年红龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年红龙 | actions | 火焰吐息 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年红龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年红龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年红龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 成年红龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年银龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年银龙 | actions | 啃咬 | verified-full |  |  |
| 成年银龙 | actions | 爪击 | verified-full |  |  |
| 成年银龙 | actions | 尾击 | verified-full |  |  |
| 成年银龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年银龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年银龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年银龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年银龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 成年银龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年白龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年白龙 | actions | 啃咬 | verified-full |  |  |
| 成年白龙 | actions | 爪击 | verified-full |  |  |
| 成年白龙 | actions | 尾击 | verified-full |  |  |
| 成年白龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年白龙 | actions | 寒冰吐息 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年白龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年白龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 成年白龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 成年白龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 气元素 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 气元素 | actions | 猛击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 气元素 | actions | 旋风 | manual | 原文骰池 3d8+2 未进入结构；原文骰池 1d6 未进入结构；原文包含豁免，但动作无结构化豁免；原文包含状态/擒抱附效，但无结构化附效 | src/store/characterTokenPresentation.test.ts |
| 远古黑龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古黑龙 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古黑龙 | actions | 爪击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古黑龙 | actions | 尾击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古黑龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古黑龙 | actions | 强酸吐息 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古黑龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古黑龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古黑龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 远古黑龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古蓝龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古蓝龙 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古蓝龙 | actions | 爪击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古蓝龙 | actions | 尾击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古蓝龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古蓝龙 | actions | 闪电吐息 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古蓝龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古蓝龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古蓝龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 远古蓝龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古黄铜龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古黄铜龙 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古黄铜龙 | actions | 爪击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古黄铜龙 | actions | 尾击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古黄铜龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古黄铜龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古黄铜龙 | actions | 改变形态 | non-combat |  |  |
| 远古黄铜龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古黄铜龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古黄铜龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 远古黄铜龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古青铜龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 远古青铜龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 远古青铜龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 远古青铜龙 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 远古青铜龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 远古青铜龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 远古青铜龙 | actions | 改变形态 | non-combat |  |  |
| 远古青铜龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 远古青铜龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 远古青铜龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 远古青铜龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 远古赤铜龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 远古赤铜龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 远古赤铜龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 远古赤铜龙 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 远古赤铜龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 远古赤铜龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 远古赤铜龙 | actions | 改变形态 | non-combat |  |  |
| 远古赤铜龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 远古赤铜龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 远古赤铜龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 远古赤铜龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 远古金龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 远古金龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 远古金龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 远古金龙 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 远古金龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 远古金龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 远古金龙 | actions | 改变形态 | non-combat |  |  |
| 远古金龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 远古金龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 远古金龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 远古金龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 远古绿龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古绿龙 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古绿龙 | actions | 爪击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古绿龙 | actions | 尾击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古绿龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古绿龙 | actions | 毒气吐息 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古绿龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古绿龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古绿龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 远古绿龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古红龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古红龙 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古红龙 | actions | 爪击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古红龙 | actions | 尾击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古红龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古红龙 | actions | 火焰吐息 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古红龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古红龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古红龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 远古红龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古银龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 远古银龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 远古银龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 远古银龙 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 远古银龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 远古银龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 远古银龙 | actions | 改变形态 | non-combat |  |  |
| 远古银龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 远古银龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 远古银龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 远古银龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古白龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古白龙 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古白龙 | actions | 爪击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古白龙 | actions | 尾击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古白龙 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古白龙 | actions | 寒冰吐息 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 远古白龙 | actions | 多重攻击: Weapons Only | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古白龙 | legendaryActions | 侦测 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 远古白龙 | legendaryActions | 尾击攻击 | verified-full |  |  |
| 远古白龙 | legendaryActions | 翼击（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 雄性斯芬克斯 | actions | 多重攻击 | verified-full |  | src/components/map/DmMonsterControlDock.test.ts<br>src/lib/monsterManualControl.test.ts |
| 雄性斯芬克斯 | actions | 爪击 | verified-full |  | src/components/map/DmMonsterControlDock.test.ts<br>src/lib/monsterManualControl.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 雄性斯芬克斯 | actions | 咆哮 | verified-full |  | src/components/map/DmMonsterControlDock.test.ts<br>src/components/map/EnemyDetailPanel.test.tsx<br>src/lib/monsterManualControl.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 雄性斯芬克斯 | legendaryActions | 爪击攻击 | verified-full |  |  |
| 雄性斯芬克斯 | legendaryActions | 传送（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts |
| 雄性斯芬克斯 | legendaryActions | 施展法术（消耗 3 动作） | manual |  | src/rulesets/dnd5e/monsterCoreSpellAction.test.ts |
| 活化护甲 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 活化护甲 | actions | 猛击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 安赫格掘穴虫 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessActionTransaction.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterBasicAction.test.ts<br>src/rulesets/dnd5e/monsterMoveAction.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/playerBasicAction.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 安赫格掘穴虫 | actions | 强酸喷射 | verified-full |  | src/pages/maps/monsterTurnEventLog.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAreaAction.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 猿 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 猿 | actions | 拳击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 猿 | actions | 投石 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 大法师 | actions | 匕首 | verified-full |  | src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 刺客 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 刺客 | actions | 短剑 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 刺客 | actions | 轻弩 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 觉醒灌木 | actions | 撕抓 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 觉醒树木 | actions | 猛击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 斧喙鸟 | actions | 喙击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 艾泽 | actions | 战锤 | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts |
| 艾泽 | actions | 战锤 (Two-Handed) | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts |
| 狒狒 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 獾 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巴洛炎魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterForcedMovementMultiattack.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 巴洛炎魔 | actions | 长剑 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterForcedMovementMultiattack.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 巴洛炎魔 | actions | 长鞭 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterForcedMovementMultiattack.test.ts |
| 巴洛炎魔 | actions | 传送 | verified-full |  | src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 强盗 | actions | 弯刀 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 强盗 | actions | 轻弩 | verified-full |  |  |
| 强盗头目 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 强盗头目 | actions | 弯刀 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 强盗头目 | actions | 匕首 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 强盗头目 | actions | 多重攻击：匕首 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 强盗头目 | reactions | 招架 | verified-full |  | src/rulesets/dnd5e/monsterParryHeadless.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 针刺魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 针刺魔 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 针刺魔 | actions | 尾击 | verified-full |  | src/lib/combatLogDetails.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 针刺魔 | actions | 投掷火焰 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 针刺魔 | actions | 多重攻击：投掷火焰 ×2 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 石化蜥蜴 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蝙蝠 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 须魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 须魔 | actions | 胡须 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterConditionalOnHitBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 须魔 | actions | 长柄刀 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 贝希摩斯 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 贝希摩斯 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 贝希摩斯 | actions | 缠勒 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 贝希摩斯 | actions | 闪电吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 贝希摩斯 | actions | 吞咽 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 狂战士 | actions | 巨斧 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 黑熊 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 黑熊 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 黑熊 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 黑龙雏龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 黑龙雏龙 | actions | 强酸吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 黑布丁 | actions | 伪足 | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 黑布丁 | reactions | 分裂 | manual |  |  |
| 闪现犬 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 闪现犬 | actions | 传送 | manual |  | src/components/map/DmMonsterControlDock.test.ts<br>src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 血鹰 | actions | 喙击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 蓝龙雏龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蓝龙雏龙 | actions | 闪电吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 野猪 | actions | 獠牙 | verified-full |  | src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 骨魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 骨魔 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 骨魔 | actions | 螫刺 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 黄铜龙雏龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 黄铜龙雏龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 青铜龙雏龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青铜龙雏龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 棕熊 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 棕熊 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 棕熊 | actions | 双爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 熊地精 | actions | 晨星锤 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 熊地精 | actions | 标枪 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 掘地鲨 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 掘地鲨 | actions | 致命飞跃 | verified-full |  | src/rulesets/dnd5e/monsterAreaAction.test.ts |
| 骆驼 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 猫 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 半人马 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCentaurHeadless.test.ts |
| 半人马 | actions | 长枪 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCentaurHeadless.test.ts |
| 半人马 | actions | 蹄击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCentaurHeadless.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 半人马 | actions | 长弓 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCentaurHeadless.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 半人马 | actions | 多重攻击：长弓 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCentaurHeadless.test.ts |
| 锁链魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 锁链魔 | actions | 锁链 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterChainDevilUnnervingMaskHeadless.test.ts<br>src/rulesets/dnd5e/monsterDeathAreaAndUnnervingMaskCatalog.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 锁链魔 | actions | 活化锁链 | manual | 原文包含状态/擒抱附效，但无结构化附效 |  |
| 锁链魔 | reactions | 扰心面具 | verified-full |  | src/rulesets/dnd5e/monsterChainDevilUnnervingMaskHeadless.test.ts<br>src/rulesets/dnd5e/monsterDeathAreaAndUnnervingMaskCatalog.test.ts |
| 奇美拉 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 奇美拉 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 奇美拉 | actions | 双角 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 奇美拉 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 奇美拉 | actions | 火焰吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 奇美拉 | actions | 多重攻击：火焰吐息 ×3 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 奇美拉 | actions | 多重攻击：啃咬 ×3 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 楚尔异怪 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts |
| 楚尔异怪 | actions | 螯击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts |
| 楚尔异怪 | actions | 触手群攻 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts |
| 楚尔异怪 | actions | 多重攻击：螯击 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts |
| 黏土魔像 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 黏土魔像 | actions | 猛击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterHitPointMaximumReduction.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 黏土魔像 | actions | 加速 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 黏土魔像 | bonusActions | 猛击 (加速) | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 披风怪 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts |
| 披风怪 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 披风怪 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/tokenStatusMarkers.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 披风怪 | actions | 哀嚎 | verified-full |  | src/rulesets/dnd5e/monsterStructuredSpecialActionBatch.test.ts |
| 披风怪 | actions | 幻象 | manual |  |  |
| 云巨人 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 云巨人 | actions | 晨星锤 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 云巨人 | actions | 投石 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 鸡蛇兽 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterConditionalOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 平民 | actions | 木棒 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 蟒蛇 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蟒蛇 | actions | 缠勒 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 赤铜龙雏龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 赤铜龙雏龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 羽蛇 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterConditionalOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 羽蛇 | actions | 缠勒 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 羽蛇 | actions | 改变形态 | non-combat |  |  |
| 螃蟹 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 鳄鱼 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 邪教狂信徒 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 邪教狂信徒 | actions | 匕首 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 邪教徒 | actions | 弯刀 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 暗幕怪 | actions | 碾压 | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts |
| 暗幕怪 | actions | 黑暗灵光 | verified-full |  | src/rulesets/dnd5e/monsterPersistentAreas.test.ts |
| 死亡犬 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 死亡犬 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/campaignTimeRules.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessSafetyPolicy.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 地底侏儒（斯涅布力） | actions | 战镐 | verified-full |  |  |
| 地底侏儒（斯涅布力） | actions | 毒镖 | verified-full |  | src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts |
| 鹿 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 提婆 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 提婆 | actions | 硬头锤 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 提婆 | actions | 治疗之触 | verified-full |  | src/rulesets/dnd5e/monsterHealingTouch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 提婆 | actions | 改变形态 | non-combat |  |  |
| 恐狼 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 气巨灵 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 气巨灵 | actions | 弯刀 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 气巨灵 | actions | 创造旋风 | manual | 原文包含豁免，但动作无结构化豁免；原文包含状态/擒抱附效，但无结构化附效 |  |
| 气巨灵 | actions | 弯刀（雷鸣） | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts |
| 变形怪 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts |
| 变形怪 | actions | 猛击 | verified-full |  | src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 变形怪 | actions | 读取思想 | non-combat |  |  |
| 挽马 | actions | 蹄击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 龙龟 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterForcedMovementMultiattack.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 龙龟 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterForcedMovementMultiattack.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 龙龟 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 龙龟 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsterForcedMovementMultiattack.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 龙龟 | actions | 蒸汽吐息 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 龙龟 | actions | 多重攻击：啃咬 ×2 | verified-full |  | src/rulesets/dnd5e/monsterForcedMovementMultiattack.test.ts |
| 怯魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 怯魔 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 怯魔 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 怯魔 | actions | 恶臭云雾 | verified-full |  | src/rulesets/dnd5e/monsterPersistentAreas.test.ts |
| 蛛化精灵 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 蛛化精灵 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蛛化精灵 | actions | 长剑 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 蛛化精灵 | actions | 长弓 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蛛化精灵 | actions | 长剑（双手） | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts |
| 蛛化精灵 | actions | 多重攻击：长剑 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 蛛化精灵 | actions | 多重攻击：啃咬 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 蛛化精灵 | actions | 多重攻击：啃咬 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 卓尔 | actions | 短剑 | verified-full |  | src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 卓尔 | actions | 手弩 | verified-full |  | src/rulesets/dnd5e/monsterConditionalOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 德鲁伊 | actions | 长棍 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 德鲁伊 | actions | 长棍 (Two-Handed) | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 德鲁伊 | actions | 长棍 (Shillelagh) | manual | 命中加值与原文不一致 | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 树精 | actions | 木棒 | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 树精 | actions | 精类魅惑 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 树精 | actions | 木棒 (Shillelagh) | manual | 命中加值与原文不一致 | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts |
| 灰矮人 | actions | 变巨 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts<br>src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 灰矮人 | actions | 战镐 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts |
| 灰矮人 | actions | 标枪 | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 灰矮人 | actions | 隐形 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 灰矮人 | actions | 战镐 (Enlarged) | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts |
| 灰矮人 | actions | 标枪 (Enlarged) | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts |
| 尘土魔蝠 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 尘土魔蝠 | actions | 致盲吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 鹰 | actions | 利爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 土元素 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 土元素 | actions | 猛击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 火巨灵 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 火巨灵 | actions | 弯刀 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 火巨灵 | actions | 投掷火焰 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 火巨灵 | actions | 多重攻击：投掷火焰 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 大象 | actions | 顶撞 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 大象 | actions | 践踏 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 大象 | bonusActions | 践踏冲锋：践踏 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 麋鹿 | actions | 冲撞 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 麋鹿 | actions | 蹄击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 欲魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 欲魔 | actions | 长剑 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterParryHeadless.test.ts |
| 欲魔 | actions | 长弓 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 欲魔 | actions | 长剑（双手） | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts |
| 欲魔 | actions | 多重攻击：长剑 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 欲魔 | actions | 多重攻击：长剑 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 欲魔 | actions | 多重攻击：长弓 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 欲魔 | reactions | 招架 | verified-full |  | src/rulesets/dnd5e/monsterParryHeadless.test.ts |
| 蜘蛛人 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts |
| 蜘蛛人 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蜘蛛人 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蜘蛛人 | actions | 蛛网 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 双头巨人 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 双头巨人 | actions | 战斧 | verified-full |  |  |
| 双头巨人 | actions | 晨星锤 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 火元素 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 火元素 | actions | 触碰 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 火巨人 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 火巨人 | actions | 巨剑 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 火巨人 | actions | 投石 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 血肉魔像 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/fleshGolemHeadless.test.ts |
| 血肉魔像 | actions | 猛击 | verified-full |  | src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 飞蛇 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/flyingSnakeHeadless.test.ts<br>src/rulesets/dnd5e/monsterMoveAction.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 飞剑 | actions | 长剑 | verified-full |  |  |
| 霜巨人 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 霜巨人 | actions | 巨斧 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 霜巨人 | actions | 投石 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 石像鬼 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 石像鬼 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/flyingSnakeHeadless.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 石像鬼 | actions | 双爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 胶质立方怪 | actions | 伪足 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 胶质立方怪 | actions | 吞没 | manual | 原文骰池 3d6 未进入结构；原文骰池 6d6 未进入结构；原文包含豁免，但动作无结构化豁免；原文包含状态/擒抱附效，但无结构化附效 | src/store/characterTokenPresentation.test.ts |
| 尸妖 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 尸妖 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 幽灵 | actions | 凋零之触 | verified-full |  |  |
| 幽灵 | actions | 以太化 | manual |  |  |
| 幽灵 | actions | 恐怖面容 | manual | 原文骰池 1d4 未进入结构 | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessSafetyPolicy.test.ts |
| 幽灵 | actions | 附身 | manual | 原文包含豁免，但动作无结构化豁免；原文包含状态/擒抱附效，但无结构化附效 |  |
| 食尸鬼 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 食尸鬼 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨猿 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 巨猿 | actions | 拳击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巨猿 | actions | 投石 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巨獾 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 巨獾 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巨獾 | actions | 双爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巨型蝙蝠 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巨型野猪 | actions | 獠牙 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 巨型蜈蚣 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterComplexPoisonOnHit.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨蟒 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨蟒 | actions | 缠勒 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨蟹 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨型鳄鱼 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts |
| 巨型鳄鱼 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨型鳄鱼 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨鹰 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 巨鹰 | actions | 喙击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巨鹰 | actions | 利爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巨鹿 | actions | 冲撞 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨鹿 | actions | 蹄击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨型火甲虫 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巨蛙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨蛙 | actions | 吞咽 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 巨型山羊 | actions | 冲撞 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨型鬣狗 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巨蜥 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巨型章鱼 | actions | 触手群攻 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 巨型章鱼 | actions | 墨汁云 | verified-full |  | src/rulesets/dnd5e/monsterPersistentAreas.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨枭 | actions | 利爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巨型毒蛇 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨鼠 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 染病巨鼠 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨蝎 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨蝎 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 巨蝎 | actions | 螫刺 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨型海马 | actions | 冲撞 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨鲨 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨型蜘蛛 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexPoisonOnHit.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨型蜘蛛 | actions | 蛛网 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨蟾蜍 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨蟾蜍 | actions | 吞咽 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 巨型秃鹫 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 巨型秃鹫 | actions | 喙击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巨型秃鹫 | actions | 利爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巨蜂 | actions | 螫刺 | verified-full |  | src/rulesets/dnd5e/monsterComplexPoisonOnHit.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨型鼬 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巨型狼蛛 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterComplexPoisonOnHit.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 喋喋不休怪 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts |
| 喋喋不休怪 | actions | 群体啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts |
| 喋喋不休怪 | actions | 致盲唾液 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts |
| 喋喋不休怪 | actions | 多重攻击: 群体啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 格拉兹特魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts |
| 格拉兹特魔 | actions | 螯击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts |
| 格拉兹特魔 | actions | 拳击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 角斗士 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts |
| 角斗士 | actions | 长矛 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 角斗士 | actions | 盾击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 角斗士 | actions | 长矛（双手近战） | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts |
| 角斗士 | actions | 多重攻击：盾击 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 角斗士 | actions | 多重攻击：盾击 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 角斗士 | actions | 多重攻击：盾击 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 角斗士 | actions | 多重攻击：长矛 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 角斗士 | reactions | 招架 | verified-full |  | src/rulesets/dnd5e/monsterParryHeadless.test.ts |
| 豺狼人 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogCombatGapBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 豺狼人 | actions | 长矛 | manual | 原文骰池 1d8+2 未进入结构 | src/rulesets/dnd5e/monsterCatalogCombatGapBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 豺狼人 | actions | 长弓 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 山羊 | actions | 冲撞 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 地精 | actions | 弯刀 | verified-full |  | src/rulesets/dnd5e/activities/dnd5eActivityIdentity.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 地精 | actions | 短弓 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 金龙雏龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 金龙雏龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 铁甲牛 | actions | 顶撞 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 铁甲牛 | actions | 蹄击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 铁甲牛 | actions | 石化吐息 | verified-full |  | src/rulesets/dnd5e/monsterStructuredSpecialActionBatch.test.ts |
| 铁甲牛 | bonusActions | 践踏冲锋：蹄击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 灰泥怪 | actions | 伪足 | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 绿龙雏龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 绿龙雏龙 | actions | 毒气吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 绿鬼婆 | actions | 双爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 绿鬼婆 | actions | 幻象外貌 | non-combat |  |  |
| 绿鬼婆 | actions | 无痕隐行 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 格里克异怪 | actions | 多重攻击 | verified-full |  | src/pages/maps/monsterOccurrenceTargets.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts |
| 格里克异怪 | actions | 触手群攻 | verified-full |  | src/pages/maps/monsterOccurrenceTargets.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts |
| 格里克异怪 | actions | 喙击 | verified-full |  | src/pages/maps/monsterOccurrenceTargets.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 狮鹫 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 狮鹫 | actions | 喙击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 狮鹫 | actions | 双爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 格里姆洛克 | actions | 尖刺骨棒 | verified-full |  |  |
| 守卫 | actions | 长矛 | manual | 原文骰池 1d8+1 未进入结构 | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 守护纳迦 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogCombatGapBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 守护纳迦 | actions | 喷吐毒液 | verified-full |  | src/rulesets/dnd5e/monsterCatalogCombatGapBatch.test.ts |
| 雌性斯芬克斯 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 雌性斯芬克斯 | actions | 爪击 | verified-full |  | src/lib/combatInterruptProtocol.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 雌性斯芬克斯 | legendaryActions | 爪击攻击 | verified-full |  |  |
| 雌性斯芬克斯 | legendaryActions | 传送（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/legendaryActionWindow.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts |
| 雌性斯芬克斯 | legendaryActions | 施展法术（消耗 3 动作） | manual |  | src/rulesets/dnd5e/legendaryActionWindow.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 半红龙老兵 | actions | 多重攻击 | manual |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 半红龙老兵 | actions | 长剑 | manual | 原文骰池 1d10+3 未进入结构 | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 半红龙老兵 | actions | 短剑 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 半红龙老兵 | actions | 重弩 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 半红龙老兵 | actions | 火焰吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 鹰身女妖 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 鹰身女妖 | actions | 双爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 鹰身女妖 | actions | 木棒 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 鹰身女妖 | actions | 诱惑之歌 | manual | 原文包含豁免，但动作无结构化豁免；原文包含状态/擒抱附效，但无结构化附效；原文包含重复豁免，但结构未声明 | src/store/characterTokenPresentation.test.ts |
| 隼 | actions | 利爪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 地狱犬 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 地狱犬 | actions | 火焰吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 赫兹鲁魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 赫兹鲁魔 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 赫兹鲁魔 | actions | 双爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 丘陵巨人 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 丘陵巨人 | actions | 巨棒 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 丘陵巨人 | actions | 投石 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 骏鹰 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 骏鹰 | actions | 喙击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 骏鹰 | actions | 双爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 大地精 | actions | 长剑 | manual | 原文骰池 1d10+1 未进入结构 | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 大地精 | actions | 长弓 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 魔宠人偶 | actions | 啃咬 | manual | 原文骰池 1d10 未进入结构 | src/components/map/EnemyDetailPanel.test.tsx<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessSafetyPolicy.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 角魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 角魔 | actions | 叉刺 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 角魔 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 角魔 | actions | 投掷火焰 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 角魔 | actions | 多重攻击：叉刺 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 角魔 | actions | 多重攻击：叉刺 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 角魔 | actions | 多重攻击：叉刺 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 角魔 | actions | 多重攻击：尾击 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 角魔 | actions | 多重攻击：投掷火焰 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 猎鲨 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 多头蛇 | actions | 多重攻击 | verified-full |  | src/lib/enemyAi.test.ts<br>src/rulesets/dnd5e/combatSimulationMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHydraDynamicMultiattack.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 多头蛇 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHydraDynamicMultiattack.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 鬣狗 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 冰魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 冰魔 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 冰魔 | actions | 双爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 冰魔 | actions | 尾击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 冰魔 | actions | 冰墙 | manual | 原文骰池 10d6 未进入结构；原文骰池 5d6 未进入结构；原文包含豁免，但动作无结构化豁免；原文要求成功半伤，但结构未声明半伤；原文包含状态/擒抱附效，但无结构化附效 |  |
| 冰魔蝠 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 冰魔蝠 | actions | 霜冻吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 小魔鬼 | actions | 螫刺（野兽形态为啃咬） | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 小魔鬼 | actions | 隐形 | verified-full |  | src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 隐形追猎者 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 隐形追猎者 | actions | 猛击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 铁魔像 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 铁魔像 | actions | 猛击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 铁魔像 | actions | 剑 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 铁魔像 | actions | 毒气吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 铁魔像 | actions | 多重攻击：猛击 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 铁魔像 | actions | 多重攻击：剑 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 胡狼 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 虎鲸 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 骑士 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 骑士 | actions | 巨剑 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 骑士 | actions | 重弩 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 骑士 | actions | 领导力 | manual | 原文包含状态/擒抱附效，但无结构化附效 |  |
| 骑士 | reactions | 招架 | verified-full |  | src/rulesets/dnd5e/monsterParryHeadless.test.ts |
| 狗头人 | actions | 匕首 | verified-full |  |  |
| 狗头人 | actions | 投石索 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 海妖克拉肯 | actions | 多重攻击 | manual |  | src/lib/enemyAi.test.ts<br>src/pages/maps/monsterOccurrenceTargets.test.ts<br>src/rulesets/dnd5e/combatSimulationMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsterKrakenFling.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 海妖克拉肯 | actions | 啃咬 | manual | 命中加值与原文不一致；原文骰池 12d6 未进入结构；原文包含豁免，但动作无结构化豁免；原文包含状态/擒抱附效，但无结构化附效 | src/pages/maps/monsterOccurrenceTargets.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsterHeadlessSafetyPolicy.test.ts<br>src/rulesets/dnd5e/monsterKrakenFling.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 海妖克拉肯 | actions | 触手 | manual | 命中加值与原文不一致 | src/pages/maps/monsterOccurrenceTargets.test.ts<br>src/rulesets/dnd5e/combatSimulationMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsterHeadlessSafetyPolicy.test.ts<br>src/rulesets/dnd5e/monsterKrakenFling.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 海妖克拉肯 | actions | 甩掷 | manual | 原文骰池 1d6 未进入结构；原文包含豁免，但动作无结构化豁免 | src/lib/enemyAi.test.ts<br>src/pages/maps/monsterOccurrenceTargets.test.ts<br>src/rulesets/dnd5e/combatSimulationMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsterKrakenFling.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 海妖克拉肯 | actions | 闪电风暴 | verified-full |  | src/rulesets/dnd5e/monsterAreaAction.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 海妖克拉肯 | actions | 多重攻击：触手 ×3 | manual |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsterKrakenFling.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts |
| 海妖克拉肯 | actions | 多重攻击：触手 ×3 | manual |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts |
| 海妖克拉肯 | actions | 多重攻击：甩掷 ×3 | manual |  | src/lib/enemyAi.test.ts<br>src/pages/maps/monsterOccurrenceTargets.test.ts<br>src/rulesets/dnd5e/combatSimulationMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 海妖克拉肯 | legendaryActions | 触手攻击或甩掷 | manual |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 海妖克拉肯 | legendaryActions | 触手攻击或甩掷 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 海妖克拉肯 | legendaryActions | 闪电风暴（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 海妖克拉肯 | legendaryActions | 墨汁云（消耗 3 动作） | verified-full |  | src/rulesets/dnd5e/monsterPersistentAreas.test.ts |
| 拉弥亚 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts |
| 拉弥亚 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 拉弥亚 | actions | 匕首 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 拉弥亚 | actions | 迷醉之触 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts |
| 拉弥亚 | actions | 多重攻击：双爪 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts |
| 劣魔 | actions | 拳击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 巫妖 | actions | 麻痹之触 | verified-full |  | src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巫妖 | legendaryActions | 戏法 | manual |  |  |
| 巫妖 | legendaryActions | 麻痹之触（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 巫妖 | legendaryActions | 恐惧凝视（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterStructuredSpecialActionBatch.test.ts |
| 巫妖 | legendaryActions | 扰乱生命（消耗 3 动作） | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 狮子 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 狮子 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 狮子 | bonusActions | 猛扑：啃咬 | verified-full |  | src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 蜥蜴 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蜥蜴人 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 蜥蜴人 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蜥蜴人 | actions | 重棒 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 蜥蜴人 | actions | 标枪 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蜥蜴人 | actions | 尖刺盾 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 蜥蜴人 | actions | 多重攻击：啃咬 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 蜥蜴人 | actions | 多重攻击：啃咬 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 蜥蜴人 | actions | 多重攻击：重棒 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 蜥蜴人 | actions | 多重攻击：重棒 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 蜥蜴人 | actions | 多重攻击：标枪 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 法师 | actions | 匕首 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 岩浆魔蝠 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 岩浆魔蝠 | actions | 火焰吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 岩浆怪 | actions | 触碰 | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 猛犸象 | actions | 顶撞 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 猛犸象 | actions | 践踏 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 猛犸象 | bonusActions | 践踏冲锋：践踏 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 蝎尾狮 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackResources.test.ts |
| 蝎尾狮 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蝎尾狮 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蝎尾狮 | actions | 尾刺 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackResources.test.ts |
| 蝎尾狮 | actions | 多重攻击：尾刺 ×3 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackResources.test.ts |
| 六臂蛇魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 六臂蛇魔 | actions | 长剑 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterParryHeadless.test.ts |
| 六臂蛇魔 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterSourceLinkedAutoHit.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 六臂蛇魔 | actions | 传送 | verified-full |  | src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 六臂蛇魔 | reactions | 招架 | verified-full |  | src/rulesets/dnd5e/monsterParryHeadless.test.ts |
| 獒犬 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 美杜莎 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 美杜莎 | actions | 蛇发 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 美杜莎 | actions | 短剑 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 美杜莎 | actions | 长弓 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 美杜莎 | actions | 多重攻击：长弓 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 人鱼 | actions | 长矛 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 魔化人鱼 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterForcedMovementMultiattack.test.ts |
| 魔化人鱼 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterForcedMovementMultiattack.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 魔化人鱼 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 魔化人鱼 | actions | 鱼叉 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterForcedMovementMultiattack.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 魔化人鱼 | actions | 多重攻击：啃咬 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterForcedMovementMultiattack.test.ts |
| 拟态怪 | actions | 伪足 | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 拟态怪 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 拟态怪 | actions | 伪足 (Adhesive Object Form) | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts |
| 牛头人 | actions | 巨斧 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 牛头人 | actions | 顶撞 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 牛头人骷髅 | actions | 巨斧 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 牛头人骷髅 | actions | 顶撞 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 骡子 | actions | 蹄击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 木乃伊 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsterMummyRotMultiattack.test.ts |
| 木乃伊 | actions | 腐烂拳击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterMummyRotMultiattack.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 木乃伊 | actions | 恐怖凝视 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsterMummyRotMultiattack.test.ts |
| 木乃伊 | actions | 多重攻击: 腐烂拳击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterMummyRotMultiattack.test.ts |
| 木乃伊领主 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsterMummyRotMultiattack.test.ts |
| 木乃伊领主 | actions | 腐烂拳击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterMummyRotMultiattack.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 木乃伊领主 | actions | 恐怖凝视 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsterMummyRotMultiattack.test.ts |
| 木乃伊领主 | actions | 多重攻击: 腐烂拳击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterMummyRotMultiattack.test.ts |
| 木乃伊领主 | legendaryActions | 攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterMummyRotMultiattack.test.ts |
| 木乃伊领主 | legendaryActions | 攻击 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 木乃伊领主 | legendaryActions | 致盲尘土 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 木乃伊领主 | legendaryActions | 渎神真言（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 木乃伊领主 | legendaryActions | 引导负能量（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 木乃伊领主 | legendaryActions | 沙旋风（消耗 2 动作） | manual | 原文包含状态/擒抱附效，但无结构化附效 |  |
| 纳尔弗魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts |
| 纳尔弗魔 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 纳尔弗魔 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 纳尔弗魔 | actions | 恐怖光晕 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts |
| 纳尔弗魔 | actions | 传送 | verified-full |  | src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 纳尔弗魔 | actions | 多重攻击: 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 夜鬼婆 | actions | 双爪（仅鬼婆形态） | verified-full |  |  |
| 夜鬼婆 | actions | 改变形态 | non-combat |  |  |
| 夜鬼婆 | actions | 以太化 | manual |  |  |
| 夜鬼婆 | actions | 梦魇纠缠 | non-combat | 原文骰池 1d10 未进入结构；原文包含生命值上限改变，但结构未声明 | src/store/characterTokenPresentation.test.ts |
| 梦魇兽 | actions | 蹄击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 梦魇兽 | actions | 以太步行 | manual |  |  |
| 贵族 | actions | 刺剑 | verified-full |  |  |
| 贵族 | reactions | 招架 | verified-full |  | src/rulesets/dnd5e/monsterMechanicTriggers.test.ts<br>src/rulesets/dnd5e/monsterParryHeadless.test.ts |
| 赭冻怪 | actions | 伪足 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 赭冻怪 | reactions | 分裂 | manual |  |  |
| 章鱼 | actions | 触手群攻 | verified-full |  | src/rulesets/dnd5e/monsterCatalogCombatGapBatch.test.ts |
| 章鱼 | actions | 墨汁云 | verified-full |  | src/rulesets/dnd5e/monsterPersistentAreas.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 食人魔 | actions | 巨棒 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 食人魔 | actions | 标枪 | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 食人魔僵尸 | actions | 晨星锤 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 鬼人 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 鬼人 | actions | 爪击（仅鬼人形态） | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 鬼人 | actions | 长柄刀 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 鬼人 | actions | 改变形态 | non-combat |  |  |
| 鬼人 | actions | 长柄刀（小型／中型形态） | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts |
| 鬼人 | actions | 多重攻击：长柄刀 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 兽人 | actions | 巨斧 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 兽人 | actions | 标枪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 奥图克 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts |
| 奥图克 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/campaignTimeRules.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessSafetyPolicy.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 奥图克 | actions | 触手 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessSafetyPolicy.test.ts |
| 奥图克 | actions | 触手猛击 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 猫头鹰 | actions | 利爪 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 枭熊 | actions | 多重攻击 | verified-full |  | src/components/map/DmMonsterControlDock.test.ts<br>src/lib/enemyAi.test.ts<br>src/lib/monsterManualControl.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterRelentless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 枭熊 | actions | 喙击 | verified-full |  | src/components/map/DmMonsterControlDock.test.ts<br>src/lib/monsterManualControl.test.ts<br>src/rulesets/dnd5e/damageMitigationInterrupt.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 枭熊 | actions | 双爪 | verified-full |  | src/components/map/DmMonsterControlDock.test.ts<br>src/lib/combatInterruptDmSettlement.test.ts<br>src/lib/monsterManualControl.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 黑豹 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 黑豹 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 黑豹 | bonusActions | 猛扑：啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 飞马 | actions | 蹄击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 相位蜘蛛 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterComplexPoisonOnHit.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 深狱炼魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 深狱炼魔 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 深狱炼魔 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 深狱炼魔 | actions | 硬头锤 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 深狱炼魔 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 行星神使 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 行星神使 | actions | 巨剑 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 行星神使 | actions | 治疗之触 | verified-full |  | src/rulesets/dnd5e/monsterHealingTouch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蛇颈龙 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 毒蛇 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogCombatGapBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 北极熊 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 北极熊 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/genericCombatPrimitives.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 北极熊 | actions | 双爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 矮种马 | actions | 蹄击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 祭司 | actions | 硬头锤 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 伪龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterConditionalOnHitBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 伪龙 | actions | 螫刺 | verified-full |  | src/rulesets/dnd5e/monsterConditionalOnHitBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 紫虫 | actions | 多重攻击 | manual |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 紫虫 | actions | 啃咬 | manual | 命中加值与原文不一致 | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 紫虫 | actions | 尾部螫针 | manual | 命中加值与原文不一致 | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 夸塞魔 | actions | 爪击（野兽形态为啃咬） | verified-full |  | src/rulesets/dnd5e/monsterComplexPoisonOnHit.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 夸塞魔 | actions | 惊吓 | verified-full |  | src/rulesets/dnd5e/monsterStructuredSpecialActionBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 夸塞魔 | actions | 隐形 | verified-full |  | src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 食人鱼 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 罗刹 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 罗刹 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 老鼠 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 渡鸦 | actions | 喙击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 红龙雏龙 | actions | 啃咬 | verified-full |  | src/components/map/EnemyDetailPanel.test.tsx<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 红龙雏龙 | actions | 火焰吐息 | verified-full |  | src/components/map/DmMonsterControlDock.test.ts<br>src/rulesets/dnd5e/monsterAreaAction.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 礁鲨 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 寒炎虫 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 寒炎虫 | actions | 吞咽 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 犀牛 | actions | 顶撞 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 骑乘马 | actions | 蹄击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 鹏鸟 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts |
| 鹏鸟 | actions | 喙击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 鹏鸟 | actions | 利爪 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 绳索怪 | actions | 多重攻击 | verified-full |  | src/lib/enemyAi.test.ts<br>src/pages/maps/monsterOccurrenceTargets.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterRoperReelMultiattack.test.ts |
| 绳索怪 | actions | 啃咬 | verified-full |  | src/pages/maps/monsterOccurrenceTargets.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterRoperReelMultiattack.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 绳索怪 | actions | 卷须 | verified-full |  | src/pages/maps/monsterOccurrenceTargets.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterRoperReelMultiattack.test.ts |
| 绳索怪 | actions | 收线 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterRoperReelMultiattack.test.ts |
| 窒息地毯 | actions | 窒息包裹 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 锈蚀怪 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 锈蚀怪 | actions | 触须 | manual |  |  |
| 剑齿虎 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 剑齿虎 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 剑齿虎 | bonusActions | 猛扑：啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 沙华鱼人 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts |
| 沙华鱼人 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 沙华鱼人 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 沙华鱼人 | actions | 长矛 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 沙华鱼人 | actions | 长矛（双手近战） | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts |
| 沙华鱼人 | actions | 多重攻击：啃咬 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 火蜥蜴 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 火蜥蜴 | actions | 长矛 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 火蜥蜴 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterSourceLinkedAutoHit.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 火蜥蜴 | actions | 长矛（双手近战） | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts |
| 萨堤尔 | actions | 冲撞 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 萨堤尔 | actions | 短剑 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 萨堤尔 | actions | 短弓 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 蝎子 | actions | 螫刺 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogCombatGapBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 斥候 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 斥候 | actions | 短剑 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 斥候 | actions | 长弓 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 斥候 | actions | 多重攻击：长弓 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 海鬼婆 | actions | 双爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 海鬼婆 | actions | 死亡瞪视 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 海鬼婆 | actions | 幻象外貌 | non-combat |  |  |
| 幽影 | actions | 力量吸取 | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts |
| 蔓生怪 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterShamblingMoundEngulf.test.ts |
| 蔓生怪 | actions | 猛击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterShamblingMoundEngulf.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蔓生怪 | actions | 吞没 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterMoveAction.test.ts<br>src/rulesets/dnd5e/monsterShamblingMoundEngulf.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 盾卫者 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 盾卫者 | actions | 拳击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 盾卫者 | reactions | 盾牌 | manual |  | src/store/characterTokenPresentation.test.ts |
| 尖叫蕈 | reactions | 尖啸 | non-combat | 原文骰池 1d4 未进入结构 | src/store/characterTokenPresentation.test.ts |
| 银龙雏龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 银龙雏龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 骷髅 | actions | 短剑 | verified-full |  | src/rulesets/dnd5e/equipmentAttackAction.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 骷髅 | actions | 短弓 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 太阳神使 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 太阳神使 | actions | 巨剑 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 太阳神使 | actions | 屠戮长弓 | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts |
| 太阳神使 | actions | 飞剑 | manual |  | src/store/characterTokenPresentation.test.ts |
| 太阳神使 | actions | 治疗之触 | verified-full |  | src/rulesets/dnd5e/monsterHealingTouch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 太阳神使 | legendaryActions | 传送 | verified-full |  | src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 太阳神使 | legendaryActions | 灼热爆发（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 太阳神使 | legendaryActions | 致盲凝视（消耗 3 动作） | verified-full |  | src/rulesets/dnd5e/monsterStructuredSpecialActionBatch.test.ts |
| 幽魂 | actions | 生命吸取 | verified-full |  | src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 蜘蛛 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/activeEffects.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterCatalogCombatGapBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexPoisonOnHit.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 邪灵纳迦 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 小妖精 | actions | 长剑 | verified-full |  | src/rulesets/dnd5e/monsterCatalogCombatGapBatch.test.ts |
| 小妖精 | actions | 短弓 | verified-full |  | src/rulesets/dnd5e/monsterCatalogCombatGapBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 小妖精 | actions | 洞察心灵 | non-combat |  | src/store/characterTokenPresentation.test.ts |
| 小妖精 | actions | 隐形 | verified-full |  | src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 间谍 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 间谍 | actions | 短剑 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 间谍 | actions | 手弩 | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 蒸汽魔蝠 | actions | 双爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 蒸汽魔蝠 | actions | 蒸汽吐息 | verified-full |  | src/rulesets/dnd5e/monsterCatalogCombatGapBatch.test.ts |
| 吸血飞虫 | actions | 吸血 | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts |
| 石巨人 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 石巨人 | actions | 巨棒 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 石巨人 | actions | 投石 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 石巨人 | reactions | 接石 | manual |  |  |
| 石魔像 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 石魔像 | actions | 猛击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 石魔像 | actions | 缓慢 | verified-full |  | src/rulesets/dnd5e/monsterStructuredSpecialActionBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 风暴巨人 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 风暴巨人 | actions | 巨剑 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 风暴巨人 | actions | 投石 | verified-full |  | src/rulesets/dnd5e/monsterStructuredSpecialActionBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 风暴巨人 | actions | 闪电打击 | verified-full |  | src/rulesets/dnd5e/monsterStructuredSpecialActionBatch.test.ts |
| 魅魔／梦魔 | actions | 爪击（仅邪魔形态） | verified-full |  |  |
| 魅魔／梦魔 | actions | 魅惑 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 魅魔／梦魔 | actions | 吸能之吻 | manual | 原文骰池 5d10+5 未进入结构；原文包含豁免，但动作无结构化豁免；原文要求成功半伤，但结构未声明半伤；原文包含状态/擒抱附效，但无结构化附效；原文包含生命值上限改变，但结构未声明 |  |
| 魅魔／梦魔 | actions | 以太化 | manual |  |  |
| 蝙蝠群 | actions | 群体啃咬 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 甲虫群 | actions | 群体啃咬 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 蜈蚣群 | actions | 群体啃咬 | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts |
| 昆虫群 | actions | 群体啃咬 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 毒蛇群 | actions | 群体啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 食人鱼群 | actions | 群体啃咬 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 鼠群 | actions | 群体啃咬 | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts |
| 渡鸦群 | actions | 群喙啄击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 蜘蛛群 | actions | 群体啃咬 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 蜂群 | actions | 群体啃咬 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 塔拉斯克 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 塔拉斯克 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 塔拉斯克 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 塔拉斯克 | actions | 双角 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 塔拉斯克 | actions | 尾击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 塔拉斯克 | actions | 骇人威仪 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 塔拉斯克 | actions | 吞咽 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts |
| 塔拉斯克 | actions | 多重攻击：吞咽 ×5 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts |
| 塔拉斯克 | actions | 多重攻击：骇人威仪 ×6 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 塔拉斯克 | actions | 多重攻击：骇人威仪 ×6 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 塔拉斯克 | legendaryActions | 攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsterCompositeSpecialActions.test.ts<br>src/rulesets/dnd5e/monsterConditionalCompositeChildren.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 塔拉斯克 | legendaryActions | 移动 | verified-full |  | src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterComplexRelationMultiattacks.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 塔拉斯克 | legendaryActions | 猛咬（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 塔拉斯克 | legendaryActions | 猛咬（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 暴徒 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 暴徒 | actions | 硬头锤 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 暴徒 | actions | 重弩 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 老虎 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 老虎 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 老虎 | bonusActions | 猛扑：啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 树人 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 树人 | actions | 猛击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 树人 | actions | 投石 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 树人 | actions | 活化树木 | manual |  | src/store/characterTokenPresentation.test.ts |
| 部落战士 | actions | 长矛 | manual | 原文骰池 1d8+1 未进入结构 | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 三角龙 | actions | 顶撞 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 三角龙 | actions | 践踏 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 三角龙 | bonusActions | 践踏冲锋：践踏 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 巨魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 巨魔 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨魔 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/endTurnAction.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 霸王龙 | actions | 多重攻击 | verified-full |  | src/pages/maps/monsterOccurrenceTargets.test.ts<br>src/rulesets/dnd5e/combatSimulationMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 霸王龙 | actions | 啃咬 | verified-full |  | src/pages/maps/monsterOccurrenceTargets.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCatalogOnHitBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 霸王龙 | actions | 尾击 | verified-full |  | src/pages/maps/monsterOccurrenceTargets.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsterMultiattackTargets.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 独角兽 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 独角兽 | actions | 蹄击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 独角兽 | actions | 角撞 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 独角兽 | actions | 治疗之触 | verified-full |  | src/rulesets/dnd5e/monsterHealingTouch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 独角兽 | actions | 传送 | manual |  | src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 独角兽 | legendaryActions | 蹄击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 独角兽 | legendaryActions | 闪烁护盾（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 独角兽 | legendaryActions | 自我治疗（消耗 3 动作） | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 吸血鬼衍体 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/rulesets/dnd5e/monsterVampireBiteEligibility.test.ts |
| 吸血鬼衍体 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/rulesets/dnd5e/monsterHitPointMaximumReduction.test.ts<br>src/rulesets/dnd5e/monsterVampireBiteEligibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 吸血鬼衍体 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/rulesets/dnd5e/monsterVampireBiteEligibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 吸血鬼衍体 | actions | 双爪 (Grapple) | verified-full |  | src/rulesets/dnd5e/monsterVampireBiteEligibility.test.ts |
| 吸血鬼衍体 | actions | 多重攻击：双爪 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterVampireBiteEligibility.test.ts |
| 吸血鬼衍体 | actions | 多重攻击：双爪 ×2 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 吸血鬼衍体 | actions | 多重攻击：claws-grapple ×2 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 吸血鬼衍体 | actions | 多重攻击：claws-grapple ×2 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 吸血鬼衍体 | actions | 多重攻击：claws-grapple ×2 | verified-full |  | src/rulesets/dnd5e/monsterVampireBiteEligibility.test.ts |
| 吸血鬼（蝙蝠形态） | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 吸血鬼（蝙蝠形态） | actions | 魅惑 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 吸血鬼（蝙蝠形态） | actions | 夜之子嗣 | manual | 原文骰池 2d4 未进入结构；原文骰池 3d6 未进入结构；原文骰池 1d4 未进入结构 |  |
| 吸血鬼（蝙蝠形态） | legendaryActions | 移动 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 吸血鬼（蝙蝠形态） | legendaryActions | 徒手打击 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 吸血鬼（蝙蝠形态） | legendaryActions | 啃咬（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 吸血鬼（雾化形态） | legendaryActions | 移动 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 吸血鬼（雾化形态） | legendaryActions | 徒手打击 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 吸血鬼（雾化形态） | legendaryActions | 啃咬（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 吸血鬼（本体形态） | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterVampireBiteEligibility.test.ts |
| 吸血鬼（本体形态） | actions | 徒手打击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterVampireBiteEligibility.test.ts |
| 吸血鬼（本体形态） | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/rulesets/dnd5e/monsterHitPointMaximumReduction.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterVampireBiteEligibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 吸血鬼（本体形态） | actions | 魅惑 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 吸血鬼（本体形态） | actions | 夜之子嗣 | manual | 原文骰池 2d4 未进入结构；原文骰池 3d6 未进入结构；原文骰池 1d4 未进入结构 |  |
| 吸血鬼（本体形态） | actions | 徒手打击 (Grapple) | verified-full |  | src/rulesets/dnd5e/monsterVampireBiteEligibility.test.ts |
| 吸血鬼（本体形态） | actions | 多重攻击：徒手打击 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterVampireBiteEligibility.test.ts |
| 吸血鬼（本体形态） | actions | 多重攻击：徒手打击 ×2 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 吸血鬼（本体形态） | actions | 多重攻击：unarmed-strike-grapple ×2 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 吸血鬼（本体形态） | actions | 多重攻击：unarmed-strike-grapple ×2 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 吸血鬼（本体形态） | actions | 多重攻击：unarmed-strike-grapple ×2 | verified-full |  | src/rulesets/dnd5e/monsterVampireBiteEligibility.test.ts |
| 吸血鬼（本体形态） | legendaryActions | 移动 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 吸血鬼（本体形态） | legendaryActions | 徒手打击 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 吸血鬼（本体形态） | legendaryActions | 啃咬（消耗 2 动作） | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 老兵 | actions | 多重攻击 | manual |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 老兵 | actions | 长剑 | manual | 原文骰池 1d10+3 未进入结构 | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 老兵 | actions | 短剑 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 老兵 | actions | 重弩 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 紫罗兰蕈 | actions | 多重攻击 | verified-full |  | src/lib/enemyAi.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterRandomRepeatMultiattack.test.ts |
| 紫罗兰蕈 | actions | 腐烂之触 | verified-full |  | src/rulesets/dnd5e/monsterRandomRepeatMultiattack.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 弗洛魔 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 弗洛魔 | actions | 喙击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 弗洛魔 | actions | 利爪 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 弗洛魔 | actions | 孢子 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 弗洛魔 | actions | 震慑尖啸 | verified-full |  | src/rulesets/dnd5e/monsterStructuredSpecialActionBatch.test.ts |
| 秃鹫 | actions | 喙击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 战马 | actions | 蹄击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 战马 | bonusActions | 践踏冲锋：蹄击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 战马骷髅 | actions | 蹄击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 水元素 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 水元素 | actions | 猛击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 水元素 | actions | 压倒 | manual | 原文骰池 2d8+4 未进入结构；原文包含豁免，但动作无结构化豁免；原文包含状态/擒抱附效，但无结构化附效；原文包含逃脱 DC，但结构未声明逃脱 | src/store/characterTokenPresentation.test.ts |
| 鼬 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 熊人（熊形态） | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 熊人（熊形态） | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 熊人（熊形态） | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 熊人（人类形态） | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 熊人（人类形态） | actions | 巨斧 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 熊人（混合形态） | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 熊人（混合形态） | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 熊人（混合形态） | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 熊人（混合形态） | actions | 巨斧 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 熊人（混合形态） | actions | 多重攻击：巨斧 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 野猪人（野猪形态） | actions | 双獠牙 | verified-full |  | src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts |
| 野猪人（人类形态） | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterRelentless.test.ts |
| 野猪人（人类形态） | actions | 巨锤 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 野猪人（混合形态） | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterRelentless.test.ts |
| 野猪人（混合形态） | actions | 巨锤 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 野猪人（混合形态） | actions | 双獠牙 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts |
| 野猪人（混合形态） | actions | 多重攻击：巨锤 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts |
| 鼠人（人类形态） | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 鼠人（人类形态） | actions | 短剑 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 鼠人（人类形态） | actions | 手弩 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 鼠人（人类形态） | actions | 多重攻击：手弩 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 鼠人（混合形态） | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 鼠人（混合形态） | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 鼠人（混合形态） | actions | 短剑 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 鼠人（混合形态） | actions | 手弩 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 鼠人（混合形态） | actions | 多重攻击：手弩 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 鼠人（混合形态） | actions | 多重攻击：短剑 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 鼠人（混合形态） | actions | 多重攻击：短剑 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts |
| 鼠人（混合形态） | actions | 多重攻击：手弩 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 鼠人（巨鼠形态） | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 虎人（人类形态） | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 虎人（人类形态） | actions | 弯刀 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 虎人（人类形态） | actions | 长弓 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 虎人（人类形态） | actions | 多重攻击：长弓 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 虎人（混合形态） | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 虎人（混合形态） | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 虎人（混合形态） | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 虎人（混合形态） | actions | 弯刀 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 虎人（混合形态） | actions | 长弓 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 虎人（混合形态） | actions | 多重攻击：弯刀 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 虎人（混合形态） | actions | 多重攻击：长弓 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 虎人（混合形态） | bonusActions | 猛扑：啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 虎人（虎形态） | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 虎人（虎形态） | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 虎人（虎形态） | bonusActions | 猛扑：啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 狼人（人类形态） | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 狼人（人类形态） | actions | 长矛 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 狼人（人类形态） | actions | 长矛（双手近战） | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts |
| 狼人（人类形态） | actions | 多重攻击：长矛 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 狼人（混合形态） | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 狼人（混合形态） | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 狼人（混合形态） | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterCurseVariantMultiattack.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 狼人（狼形态） | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 白龙雏龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 白龙雏龙 | actions | 寒冰吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 尸鬼 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 尸鬼 | actions | 生命吸取 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterHitPointMaximumReduction.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 尸鬼 | actions | 长剑 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 尸鬼 | actions | 长弓 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 尸鬼 | actions | 长剑（双手） | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts |
| 尸鬼 | actions | 多重攻击：长剑 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 尸鬼 | actions | 多重攻击：生命吸取 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogFixedChildActions.test.ts<br>src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 鬼火 | actions | 电击 | verified-full |  |  |
| 鬼火 | actions | 隐形 | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 鬼火 | actions | Consume Life | verified-full |  | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts<br>src/rulesets/dnd5e/monsterTeleportInvisibility.test.ts |
| 冬狼 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 冬狼 | actions | 寒冰吐息 | verified-full |  | src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 狼 | actions | 啃咬 | verified-full |  | src/lib/combatPresentation.test.ts<br>src/rulesets/dnd5e/activities/dnd5eActivityHeadlessAuthorityBridge.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/genericCombatPrimitives.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterComplexPoisonOnHit.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 座狼 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 缚灵 | actions | 生命吸取 | verified-full |  | src/rulesets/dnd5e/monsterPrimarySettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 缚灵 | actions | 创造幽魂 | manual |  |  |
| 双足飞龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 双足飞龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 双足飞龙 | actions | 双爪 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 双足飞龙 | actions | 尾针 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 双足飞龙 | actions | 多重攻击：双爪 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts |
| 双足飞龙 | actions | 多重攻击：啃咬 ×2 | verified-full |  | src/rulesets/dnd5e/monsterCatalogMultiattackBatch.test.ts<br>src/rulesets/dnd5e/monsterMultiattackConstraints.test.ts |
| 索尔石怪 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterComplexActionContracts.test.ts |
| 索尔石怪 | actions | 啃咬 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 索尔石怪 | actions | 爪击 | verified-full |  | src/store/characterTokenPresentation.test.ts |
| 青年黑龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 青年黑龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年黑龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年黑龙 | actions | 强酸吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 青年蓝龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 青年蓝龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年蓝龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年蓝龙 | actions | 闪电吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts |
| 青年黄铜龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 青年黄铜龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年黄铜龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年黄铜龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 青年青铜龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 青年青铜龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年青铜龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年青铜龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 青年赤铜龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 青年赤铜龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年赤铜龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年赤铜龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 青年金龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 青年金龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年金龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年金龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |
| 青年绿龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 青年绿龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年绿龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年绿龙 | actions | 毒气吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年红龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 青年红龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年红龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年红龙 | actions | 火焰吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 青年银龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 青年银龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年银龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年银龙 | actions | 吐息武器 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 青年白龙 | actions | 多重攻击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts |
| 青年白龙 | actions | 啃咬 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年白龙 | actions | 爪击 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 青年白龙 | actions | 寒冰吐息 | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 僵尸 | actions | 猛击 | verified-full |  | src/store/characterTokenPresentation.test.ts |

## 怪物特质（551）

| 怪物 | 特质 | 规则 | 结论 | 缺口 | 直接测试 |
| --- | --- | --- | --- | --- | --- |
| 底栖魔鱼 | 两栖 |  | non-combat-or-narrative |  |  |
| 底栖魔鱼 | 黏液云 | mucous-cloud | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/tokenStatusMarkers.test.ts |
| 底栖魔鱼 | 探查心灵感应 |  | non-combat-or-narrative |  |  |
| 侍僧 | 施法 |  | delegated-to-monster-spells |  |  |
| 成年黑龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 成年黑龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 成年蓝龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 成年黄铜龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 成年青铜龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 成年青铜龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 成年赤铜龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 成年金龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 成年金龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 成年绿龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 成年绿龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 成年红龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 成年银龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 成年白龙 | 冰面行走 |  | exploration-manual-gap |  |  |
| 成年白龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 气元素 | 气体形态 |  | non-combat-or-narrative |  |  |
| 远古黑龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 远古黑龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 远古蓝龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 远古黄铜龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 远古青铜龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 远古青铜龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 远古赤铜龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 远古金龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 远古金龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 远古绿龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 远古绿龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 远古红龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 远古银龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 远古白龙 | 冰面行走 |  | exploration-manual-gap |  |  |
| 远古白龙 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 雄性斯芬克斯 | 无法窥测 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 雄性斯芬克斯 | 魔法武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 雄性斯芬克斯 | 施法 |  | delegated-to-monster-spells |  |  |
| 活化护甲 | 反魔法易感 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 活化护甲 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 大法师 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 大法师 | 施法 |  | delegated-to-monster-spells |  |  |
| 刺客 | 刺杀 | assassinate | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitDeclarations.test.ts |
| 刺客 | 闪避 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 | src/rulesets/dnd5e/monsterCatalogAttackTraitDeclarations.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts |
| 刺客 | 偷袭（每回合 1 次） | sneak-attack | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitDeclarations.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/domain/combat/combatMath.test.ts<br>src/rulesets/dnd5e/equipmentAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 觉醒灌木 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 觉醒树木 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 艾泽 | 灼热躯体 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 艾泽 | 灼热武器 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 艾泽 | 照明 |  | non-combat-or-narrative |  |  |
| 狒狒 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 獾 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 巴洛炎魔 | 临死爆发 | death-area-saving-throw | verified-full |  | src/rulesets/dnd5e/monsterDeathAreaAndUnnervingMaskCatalog.test.ts<br>src/rulesets/dnd5e/monsterDeathAreaRuntime.test.ts |
| 巴洛炎魔 | 火焰灵光 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 巴洛炎魔 | 魔法抗性 | magic-resistance | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 巴洛炎魔 | 魔法武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 针刺魔 | 倒刺外皮 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 针刺魔 | 魔鬼视界 |  | non-combat-or-narrative |  |  |
| 针刺魔 | 魔法抗性 | magic-resistance | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 石化蜥蜴 | 石化凝视 | turn-start-gaze | verified-full |  | src/rulesets/dnd5e/monsterBasiliskGazeHeadless.test.ts |
| 蝙蝠 | 回声定位 |  | exploration-manual-gap |  |  |
| 蝙蝠 | 敏锐听觉 |  | exploration-manual-gap |  |  |
| 须魔 | 魔鬼视界 |  | non-combat-or-narrative |  |  |
| 须魔 | 魔法抗性 | magic-resistance | verified-full |  | src/rulesets/dnd5e/monsterConditionalOnHitBatch.test.ts<br>src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 须魔 | 坚定 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 狂战士 | 鲁莽 | reckless | verified-full |  | src/rulesets/dnd5e/equipmentAttackAction.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts |
| 黑熊 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 黑龙雏龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 黑布丁 | 无定形 |  | non-combat-or-narrative |  |  |
| 黑布丁 | 腐蚀形态 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 黑布丁 | 蛛行 |  | exploration-manual-gap |  |  |
| 闪现犬 | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 血鹰 | 敏锐视觉 |  | exploration-manual-gap |  |  |
| 血鹰 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 野猪 | 冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 野猪 | 坚韧不屈 | relentless | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterRelentless.test.ts<br>src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 骨魔 | 魔鬼视界 |  | non-combat-or-narrative |  |  |
| 骨魔 | 魔法抗性 | magic-resistance | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 青铜龙雏龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 棕熊 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 熊地精 | 蛮力 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 熊地精 | 突袭攻击 | surprise-attack | verified-full |  | src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 掘地鲨 | 立定跳跃 |  | non-combat-or-narrative |  |  |
| 猫 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 半人马 | 冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 锁链魔 | 魔鬼视界 |  | non-combat-or-narrative |  |  |
| 锁链魔 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 楚尔异怪 | 两栖 |  | non-combat-or-narrative |  |  |
| 楚尔异怪 | 感知魔法 |  | exploration-manual-gap |  |  |
| 黏土魔像 | 强酸吸收 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 黏土魔像 | 狂暴失控 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 黏土魔像 | 不变形态 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 黏土魔像 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 黏土魔像 | 魔法武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 披风怪 | 伤害转移 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 披风怪 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 披风怪 | 畏光 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 云巨人 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 云巨人 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 羽蛇 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 羽蛇 | 魔法武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 羽蛇 | 心灵屏障 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 螃蟹 | 两栖 |  | non-combat-or-narrative |  |  |
| 鳄鱼 | 屏息 |  | non-combat-or-narrative |  |  |
| 邪教狂信徒 | 黑暗奉献 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 邪教狂信徒 | 施法 |  | delegated-to-monster-spells |  |  |
| 邪教徒 | 黑暗奉献 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 暗幕怪 | 回声定位 |  | exploration-manual-gap |  |  |
| 暗幕怪 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 死亡犬 | 双头生物 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 地底侏儒（斯涅布力） | 岩石伪装 |  | exploration-manual-gap |  |  |
| 地底侏儒（斯涅布力） | 侏儒狡黠 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 地底侏儒（斯涅布力） | 天生施法 |  | delegated-to-monster-spells |  |  |
| 提婆 | 天使武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 提婆 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 提婆 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 恐狼 | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 恐狼 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 气巨灵 | 元素消亡 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 气巨灵 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 变形怪 | 变形生物 |  | excluded-narrative-transform |  |  |
| 变形怪 | 伏击者 | ambusher-attack-advantage | verified-full |  | src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts |
| 变形怪 | 突袭攻击 | surprise-attack | verified-full |  | src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 龙龟 | 两栖 |  | non-combat-or-narrative |  |  |
| 蛛化精灵 | 精类血统 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 蛛化精灵 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 蛛化精灵 | 蛛行 |  | exploration-manual-gap |  |  |
| 蛛化精灵 | 阳光敏感 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 蛛化精灵 | 蛛网行者 |  | non-combat-or-narrative |  |  |
| 卓尔 | 精类血统 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 | src/rulesets/dnd5e/mapBridge.test.ts |
| 卓尔 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 卓尔 | 阳光敏感 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 德鲁伊 | 施法 |  | delegated-to-monster-spells |  | src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 树精 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 树精 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 树精 | 与动植物交谈 |  | non-combat-or-narrative |  |  |
| 树精 | 树跃 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 灰矮人 | 灰矮人韧性 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 灰矮人 | 阳光敏感 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 尘土魔蝠 | 死亡爆裂 | death-area-saving-throw | verified-full |  | src/rulesets/dnd5e/monsterDeathAreaAndUnnervingMaskCatalog.test.ts<br>src/rulesets/dnd5e/monsterDeathAreaRuntime.test.ts |
| 尘土魔蝠 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 鹰 | 敏锐视觉 |  | exploration-manual-gap |  |  |
| 土元素 | 土遁 |  | non-combat-or-narrative |  |  |
| 土元素 | 攻城怪物 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 火巨灵 | 元素消亡 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 火巨灵 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 大象 | 践踏冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 麋鹿 | 冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 欲魔 | 地狱武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 欲魔 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 蜘蛛人 | 蛛行 |  | exploration-manual-gap |  |  |
| 蜘蛛人 | 蛛网感知 |  | non-combat-or-narrative |  |  |
| 蜘蛛人 | 蛛网行者 |  | non-combat-or-narrative |  |  |
| 双头巨人 | 双头 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 双头巨人 | 警醒 |  | non-combat-or-narrative |  |  |
| 火元素 | 火焰形态 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 火元素 | 照明 |  | non-combat-or-narrative |  |  |
| 火元素 | 畏水 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 血肉魔像 | 狂暴失控 | berserk | verified-full |  | src/components/map/EnemyDetailPanel.test.tsx<br>src/pages/maps/monsterStatusTokenMarks.test.ts<br>src/pages/maps/monsterTurnEventLog.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/tokenStatusMarkers.test.ts<br>src/store/characterTokenPresentation.test.ts<br>src/store/roomCommands.test.ts |
| 血肉魔像 | 畏火 | damage-aversion | verified-full |  | src/components/map/EnemyDetailPanel.test.tsx<br>src/pages/maps/monsterStatusTokenMarks.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/tokenStatusMarkers.test.ts<br>src/store/roomCommands.test.ts |
| 血肉魔像 | 不变形态 | immutable-form | verified-full |  | src/rulesets/dnd5e/fleshGolemHeadless.test.ts |
| 血肉魔像 | 闪电吸收 | damage-absorption | verified-full |  | src/rulesets/dnd5e/fleshGolemHeadless.test.ts |
| 血肉魔像 | 魔法抗性 | magic-resistance | verified-full |  | src/rulesets/dnd5e/combatPersistentSpellBatch.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 血肉魔像 | 魔法武器 | magic-weapons | verified-full |  | src/lib/combatLogDetails.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 飞蛇 | 掠飞 | flyby | verified-full |  | src/rulesets/dnd5e/flyingSnakeHeadless.test.ts<br>src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 飞剑 | 反魔法易感 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 飞剑 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 青蛙 | 两栖 |  | non-combat-or-narrative |  |  |
| 青蛙 | 立定跳跃 |  | non-combat-or-narrative |  |  |
| 石像鬼 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 胶质立方怪 | 泥怪立方 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 胶质立方怪 | 透明 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 尸妖 | 恶臭 | turn-start-saving-throw-aura | verified-full |  | src/rulesets/dnd5e/monsterTurnStartAuraHeadless.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/turnStartSavingThrowAura.test.ts |
| 尸妖 | 抗拒驱散 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 幽灵 | 以太视觉 |  | non-combat-or-narrative |  |  |
| 幽灵 | 虚体移动 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 巨獾 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 巨型蝙蝠 | 回声定位 |  | exploration-manual-gap |  |  |
| 巨型蝙蝠 | 敏锐听觉 |  | exploration-manual-gap |  |  |
| 巨型野猪 | 冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 巨型野猪 | 坚韧不屈 | relentless | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterRelentless.test.ts<br>src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 巨蟹 | 两栖 |  | non-combat-or-narrative |  |  |
| 巨型鳄鱼 | 屏息 |  | non-combat-or-narrative |  |  |
| 巨鹰 | 敏锐视觉 |  | exploration-manual-gap |  |  |
| 巨鹿 | 冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 巨型火甲虫 | 照明 |  | non-combat-or-narrative |  |  |
| 巨蛙 | 两栖 |  | non-combat-or-narrative |  |  |
| 巨蛙 | 立定跳跃 |  | non-combat-or-narrative |  |  |
| 巨型山羊 | 冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 巨型山羊 | 稳步 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 巨型鬣狗 | 横冲直撞 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 巨型章鱼 | 屏息 |  | non-combat-or-narrative |  |  |
| 巨型章鱼 | 水下伪装 |  | exploration-manual-gap |  |  |
| 巨型章鱼 | 水下呼吸 |  | non-combat-or-narrative |  |  |
| 巨枭 | 掠飞 | flyby | verified-full |  | src/rulesets/dnd5e/flyingSnakeHeadless.test.ts<br>src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 巨枭 | 敏锐听觉与视觉 |  | exploration-manual-gap |  |  |
| 巨鼠 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 巨鼠 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts |
| 染病巨鼠 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 染病巨鼠 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 巨型海马 | 冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 巨型海马 | 水下呼吸 |  | non-combat-or-narrative |  |  |
| 巨鲨 | 嗜血狂暴 | blood-frenzy | verified-full |  | src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 巨鲨 | 水下呼吸 |  | non-combat-or-narrative |  |  |
| 巨型蜘蛛 | 蛛行 |  | exploration-manual-gap |  |  |
| 巨型蜘蛛 | 蛛网感知 |  | non-combat-or-narrative |  |  |
| 巨型蜘蛛 | 蛛网行者 |  | non-combat-or-narrative |  |  |
| 巨蟾蜍 | 两栖 |  | non-combat-or-narrative |  |  |
| 巨蟾蜍 | 立定跳跃 |  | non-combat-or-narrative |  |  |
| 巨型秃鹫 | 敏锐视觉与嗅觉 |  | exploration-manual-gap |  |  |
| 巨型秃鹫 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 巨型鼬 | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 巨型狼蛛 | 蛛行 |  | exploration-manual-gap |  |  |
| 巨型狼蛛 | 蛛网感知 |  | non-combat-or-narrative |  |  |
| 巨型狼蛛 | 蛛网行者 |  | non-combat-or-narrative |  |  |
| 喋喋不休怪 | 异变地面 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 喋喋不休怪 | 胡言乱语 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 格拉兹特魔 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 格拉兹特魔 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 角斗士 | 勇敢 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 角斗士 | 蛮力 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 豺狼人 | 横冲直撞 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 山羊 | 冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 山羊 | 稳步 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 地精 | 灵活逃脱 | nimble-escape | verified-full |  | src/lib/dmWorkshopMonsterHandoff.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterStatBlockPaste.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts |
| 金龙雏龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 铁甲牛 | 践踏冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 灰泥怪 | 无定形 |  | non-combat-or-narrative |  |  |
| 灰泥怪 | 腐蚀金属 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 灰泥怪 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 绿龙雏龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 绿鬼婆 | 两栖 |  | non-combat-or-narrative |  |  |
| 绿鬼婆 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 绿鬼婆 | 拟声 |  | exploration-manual-gap |  |  |
| 格里克异怪 | 岩石伪装 |  | exploration-manual-gap |  |  |
| 狮鹫 | 敏锐视觉 |  | exploration-manual-gap |  |  |
| 格里姆洛克 | 盲感官 |  | exploration-manual-gap |  |  |
| 格里姆洛克 | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 格里姆洛克 | 岩石伪装 |  | exploration-manual-gap |  |  |
| 守护纳迦 | 复苏 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 守护纳迦 | 施法 |  | delegated-to-monster-spells |  |  |
| 雌性斯芬克斯 | 无法窥测 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 雌性斯芬克斯 | 魔法武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 雌性斯芬克斯 | 施法 |  | delegated-to-monster-spells |  |  |
| 隼 | 敏锐视觉 |  | exploration-manual-gap |  |  |
| 地狱犬 | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 地狱犬 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 赫兹鲁魔 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 赫兹鲁魔 | 恶臭 | turn-start-saving-throw-aura | verified-full |  | src/rulesets/dnd5e/monsterTurnStartAuraHeadless.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/turnStartSavingThrowAura.test.ts |
| 骏鹰 | 敏锐视觉 |  | exploration-manual-gap |  |  |
| 大地精 | 武技优势 | martial-advantage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitDeclarations.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts |
| 魔宠人偶 | 心灵联结 |  | exploration-manual-gap |  |  |
| 角魔 | 魔鬼视界 |  | non-combat-or-narrative |  |  |
| 角魔 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 猎鲨 | 嗜血狂暴 | blood-frenzy | verified-full |  | src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 猎鲨 | 水下呼吸 |  | non-combat-or-narrative |  |  |
| 多头蛇 | 屏息 |  | non-combat-or-narrative |  |  |
| 多头蛇 | 多头 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 多头蛇 | 多头反应 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 多头蛇 | 警醒 |  | non-combat-or-narrative |  |  |
| 鬣狗 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 冰魔 | 魔鬼视界 |  | non-combat-or-narrative |  |  |
| 冰魔 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 冰魔蝠 | 死亡爆裂 | death-area-saving-throw | verified-full |  | src/rulesets/dnd5e/monsterDeathAreaAndUnnervingMaskCatalog.test.ts |
| 冰魔蝠 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 冰魔蝠 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 小魔鬼 | 变形生物 |  | excluded-narrative-transform |  |  |
| 小魔鬼 | 魔鬼视界 |  | non-combat-or-narrative |  |  |
| 小魔鬼 | 魔法抗性 | magic-resistance | verified-full |  | src/rulesets/dnd5e/monsterPersistentAreas.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 隐形追猎者 | 隐形 |  | non-combat-or-narrative |  |  |
| 隐形追猎者 | 无误追踪 |  | non-combat-or-narrative |  |  |
| 铁魔像 | 火焰吸收 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 铁魔像 | 不变形态 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 铁魔像 | 魔法抗性 | magic-resistance | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 铁魔像 | 魔法武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 胡狼 | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 胡狼 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 虎鲸 | 回声定位 |  | exploration-manual-gap |  |  |
| 虎鲸 | 屏息 |  | non-combat-or-narrative |  |  |
| 虎鲸 | 敏锐听觉 |  | exploration-manual-gap |  |  |
| 骑士 | 勇敢 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 狗头人 | 阳光敏感 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 狗头人 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 海妖克拉肯 | 两栖 |  | non-combat-or-narrative |  |  |
| 海妖克拉肯 | 行动自如 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 海妖克拉肯 | 攻城怪物 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 拉弥亚 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 劣魔 | 魔鬼视界 |  | non-combat-or-narrative |  |  |
| 劣魔 | 地狱再生 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 巫妖 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 巫妖 | 复苏 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 巫妖 | 施法 |  | delegated-to-monster-spells |  |  |
| 巫妖 | 驱散抗性 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 狮子 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 狮子 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 狮子 | 猛扑 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 狮子 | 助跑跳跃 |  | non-combat-or-narrative |  |  |
| 蜥蜴人 | 屏息 |  | non-combat-or-narrative |  |  |
| 法师 | 施法 |  | delegated-to-monster-spells |  |  |
| 岩浆魔蝠 | 死亡爆裂 | death-area-saving-throw | verified-full |  | src/rulesets/dnd5e/monsterDeathAreaAndUnnervingMaskCatalog.test.ts |
| 岩浆魔蝠 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 岩浆魔蝠 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 岩浆怪 | 死亡爆裂 | death-area-saving-throw | verified-full |  | src/rulesets/dnd5e/monsterDeathAreaAndUnnervingMaskCatalog.test.ts |
| 岩浆怪 | 燃火照明 |  | non-combat-or-narrative |  |  |
| 猛犸象 | 践踏冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 蝎尾狮 | 尾刺再生 |  | non-combat-or-narrative |  |  |
| 六臂蛇魔 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 六臂蛇魔 | 魔法武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 六臂蛇魔 | 多重反应 | reactive | verified-full |  | src/rulesets/dnd5e/monsterParryHeadless.test.ts<br>src/rulesets/dnd5e/turnEconomy.test.ts |
| 獒犬 | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 美杜莎 | 石化凝视 | turn-start-gaze | verified-full |  | src/rulesets/dnd5e/monsterBasiliskGazeHeadless.test.ts |
| 人鱼 | 两栖 |  | non-combat-or-narrative |  |  |
| 魔化人鱼 | 两栖 |  | non-combat-or-narrative |  |  |
| 拟态怪 | 变形生物 |  | excluded-narrative-transform |  |  |
| 拟态怪 | 黏附（仅物体形态） |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 拟态怪 | 虚假外表（仅物体形态） |  | non-combat-or-narrative |  |  |
| 拟态怪 | 擒抱者 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 牛头人 | 冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 牛头人 | 迷宫记忆 |  | non-combat-or-narrative |  |  |
| 牛头人 | 鲁莽 | reckless | verified-full |  | src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 牛头人骷髅 | 冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 骡子 | 驮兽 |  | non-combat-or-narrative |  |  |
| 骡子 | 稳步 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 木乃伊领主 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 木乃伊领主 | 复苏 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 木乃伊领主 | 施法 |  | delegated-to-monster-spells |  |  |
| 纳尔弗魔 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 夜鬼婆 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 夜鬼婆 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 夜鬼婆 | 夜鬼婆物品 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 梦魇兽 | 赋予火焰抗性 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 梦魇兽 | 照明 |  | non-combat-or-narrative |  |  |
| 赭冻怪 | 无定形 |  | non-combat-or-narrative |  |  |
| 赭冻怪 | 蛛行 |  | exploration-manual-gap |  |  |
| 章鱼 | 屏息 |  | non-combat-or-narrative |  |  |
| 章鱼 | 水下伪装 |  | exploration-manual-gap |  |  |
| 章鱼 | 水下呼吸 |  | non-combat-or-narrative |  |  |
| 食人魔僵尸 | 亡灵坚韧 | undead-fortitude | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts |
| 鬼人 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 鬼人 | 魔法武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 鬼人 | 再生 | regeneration | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/beginTurnAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 兽人 | 侵略性 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 奥图克 | 有限心灵感应 |  | non-combat-or-narrative |  |  |
| 猫头鹰 | 掠飞 | flyby | verified-full |  | src/rulesets/dnd5e/flyingSnakeHeadless.test.ts<br>src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 猫头鹰 | 敏锐听觉与视觉 |  | exploration-manual-gap |  |  |
| 枭熊 | 敏锐视觉与嗅觉 |  | exploration-manual-gap |  |  |
| 黑豹 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 黑豹 | 猛扑 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 相位蜘蛛 | 以太跃迁 |  | non-combat-or-narrative |  |  |
| 相位蜘蛛 | 蛛行 |  | exploration-manual-gap |  |  |
| 相位蜘蛛 | 蛛网行者 |  | non-combat-or-narrative |  |  |
| 深狱炼魔 | 恐惧灵光 | turn-start-saving-throw-aura | verified-full |  | src/rulesets/dnd5e/monsterTurnStartAuraHeadless.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/turnStartSavingThrowAura.test.ts |
| 深狱炼魔 | 魔法抗性 | magic-resistance | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 深狱炼魔 | 魔法武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 深狱炼魔 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 行星神使 | 天使武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 行星神使 | 神圣感知 |  | non-combat-or-narrative |  |  |
| 行星神使 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 行星神使 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 蛇颈龙 | 屏息 |  | non-combat-or-narrative |  |  |
| 北极熊 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 祭司 | 神圣威能 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 祭司 | 施法 |  | delegated-to-monster-spells |  |  |
| 伪龙 | 敏锐感官 |  | exploration-manual-gap |  |  |
| 伪龙 | 魔法抗性 | magic-resistance | verified-full |  | src/rulesets/dnd5e/monsterConditionalOnHitBatch.test.ts<br>src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 伪龙 | 有限心灵感应 |  | non-combat-or-narrative |  |  |
| 紫虫 | 掘穴者 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 夸塞魔 | 变形生物 |  | excluded-narrative-transform |  |  |
| 夸塞魔 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 食人鱼 | 嗜血狂暴 | blood-frenzy | verified-full |  | src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 食人鱼 | 水下呼吸 |  | non-combat-or-narrative |  |  |
| 罗刹 | 有限魔法免疫 | limited-magic-immunity | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/pluginSpellTransaction.test.ts |
| 罗刹 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 老鼠 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 渡鸦 | 拟声 |  | exploration-manual-gap |  |  |
| 礁鲨 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 礁鲨 | 水下呼吸 |  | non-combat-or-narrative |  |  |
| 寒炎虫 | 灼热躯体 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 犀牛 | 冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 鹏鸟 | 敏锐视觉 |  | exploration-manual-gap |  |  |
| 绳索怪 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 绳索怪 | 攫握卷须 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 绳索怪 | 蛛行 |  | exploration-manual-gap |  |  |
| 窒息地毯 | 反魔法易感 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 窒息地毯 | 伤害转移 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 窒息地毯 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 锈蚀怪 | 嗅铁 |  | non-combat-or-narrative |  |  |
| 锈蚀怪 | 锈蚀金属 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 剑齿虎 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 剑齿虎 | 猛扑 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 沙华鱼人 | 嗜血狂暴 | blood-frenzy | verified-full |  | src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 沙华鱼人 | 有限两栖 |  | non-combat-or-narrative |  |  |
| 沙华鱼人 | 鲨鱼心灵感应 |  | non-combat-or-narrative |  |  |
| 火蜥蜴 | 灼热躯体 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 火蜥蜴 | 灼热武器 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 萨堤尔 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 斥候 | 敏锐听觉与视觉 |  | exploration-manual-gap |  |  |
| 海鬼婆 | 两栖 |  | non-combat-or-narrative |  |  |
| 海鬼婆 | 骇人外貌 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 海马 | 水下呼吸 |  | non-combat-or-narrative |  |  |
| 幽影 | 无定形 |  | non-combat-or-narrative |  |  |
| 幽影 | 阴影隐匿 |  | exploration-manual-gap |  |  |
| 幽影 | 阳光弱点 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 蔓生怪 | 闪电吸收 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 盾卫者 | 受缚 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 盾卫者 | 再生 | regeneration | verified-full |  | src/rulesets/dnd5e/beginTurnAction.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 盾卫者 | 储存法术 |  | non-combat-or-narrative |  |  |
| 尖叫蕈 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 太阳神使 | 天使武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 太阳神使 | 神圣感知 |  | non-combat-or-narrative |  |  |
| 太阳神使 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 太阳神使 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 幽魂 | 虚体移动 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 幽魂 | 阳光敏感 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 蜘蛛 | 蛛行 |  | exploration-manual-gap |  |  |
| 蜘蛛 | 蛛网感知 |  | non-combat-or-narrative |  |  |
| 蜘蛛 | 蛛网行者 |  | non-combat-or-narrative |  |  |
| 邪灵纳迦 | 复苏 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 邪灵纳迦 | 施法 |  | delegated-to-monster-spells |  |  |
| 间谍 | 狡诈动作 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 间谍 | 偷袭（每回合 1 次） | sneak-attack | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitDeclarations.test.ts<br>src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/domain/combat/combatMath.test.ts<br>src/rulesets/dnd5e/equipmentAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 蒸汽魔蝠 | 死亡爆裂 | death-area-saving-throw | verified-full |  | src/rulesets/dnd5e/monsterDeathAreaAndUnnervingMaskCatalog.test.ts<br>src/rulesets/dnd5e/monsterDeathAreaRuntime.test.ts |
| 蒸汽魔蝠 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 石巨人 | 岩石伪装 |  | exploration-manual-gap |  |  |
| 石魔像 | 不变形态 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 石魔像 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 石魔像 | 魔法武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 风暴巨人 | 两栖 |  | non-combat-or-narrative |  |  |
| 风暴巨人 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 魅魔／梦魔 | 心灵联结 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 魅魔／梦魔 | 变形生物 |  | excluded-narrative-transform |  |  |
| 蝙蝠群 | 回声定位 |  | exploration-manual-gap |  |  |
| 蝙蝠群 | 敏锐听觉 |  | exploration-manual-gap |  |  |
| 蝙蝠群 | 群集 | swarm | verified-full |  | src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 甲虫群 | 群集 | swarm | verified-full |  | src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 蜈蚣群 | 群集 | swarm | verified-full |  | src/rulesets/dnd5e/monsterRemainingSettlementBatch.test.ts<br>src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 昆虫群 | 群集 | swarm | verified-full |  | src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 毒蛇群 | 群集 | swarm | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 食人鱼群 | 嗜血狂暴 | blood-frenzy | verified-full |  | src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 食人鱼群 | 群集 | swarm | verified-full |  | src/rulesets/dnd5e/monsterTriggeredAttackTraits.test.ts<br>src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 食人鱼群 | 水下呼吸 |  | non-combat-or-narrative |  |  |
| 鼠群 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 鼠群 | 群集 | swarm | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts<br>src/store/characterTokenPresentation.test.ts |
| 渡鸦群 | 群集 | swarm | verified-full |  | src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 蜘蛛群 | 群集 | swarm | verified-full |  | src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 蜘蛛群 | 蛛行 |  | exploration-manual-gap |  |  |
| 蜘蛛群 | 蛛网感知 |  | non-combat-or-narrative |  |  |
| 蜘蛛群 | 蛛网行者 |  | non-combat-or-narrative |  |  |
| 蜂群 | 群集 | swarm | verified-full |  | src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterResourceActions.test.ts |
| 塔拉斯克 | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 塔拉斯克 | 魔法抗性 | magic-resistance | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 塔拉斯克 | 反射甲壳 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 塔拉斯克 | 攻城怪物 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 暴徒 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 老虎 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 老虎 | 猛扑 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 树人 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 树人 | 攻城怪物 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 部落战士 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 三角龙 | 践踏冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 巨魔 | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 巨魔 | 再生 | regeneration | verified-full |  | src/lib/combatTokens.test.ts<br>src/pages/maps/monsterStatusTokenMarks.test.ts<br>src/rulesets/dnd5e/endTurnAction.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/tokenStatusMarkers.test.ts<br>src/store/roomCommands.test.ts<br>src/rulesets/dnd5e/beginTurnAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 独角兽 | 冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 独角兽 | 天生施法 |  | delegated-to-monster-spells |  |  |
| 独角兽 | 魔法抗性 | magic-resistance | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 独角兽 | 魔法武器 | magic-weapons | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/mapBridge.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 吸血鬼衍体 | 再生 | regeneration | verified-full |  | src/rulesets/dnd5e/beginTurnAction.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 吸血鬼衍体 | 蛛行 |  | exploration-manual-gap |  |  |
| 吸血鬼衍体 | 吸血鬼弱点 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 吸血鬼（蝙蝠形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 吸血鬼（蝙蝠形态） | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 吸血鬼（蝙蝠形态） | 雾化逃脱 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 吸血鬼（蝙蝠形态） | 再生 | regeneration | verified-full |  | src/rulesets/dnd5e/beginTurnAction.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 吸血鬼（蝙蝠形态） | 蛛行 |  | exploration-manual-gap |  |  |
| 吸血鬼（蝙蝠形态） | 吸血鬼弱点 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 吸血鬼（雾化形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 吸血鬼（雾化形态） | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 吸血鬼（雾化形态） | 雾化逃脱 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 吸血鬼（雾化形态） | 再生 | regeneration | verified-full |  | src/rulesets/dnd5e/beginTurnAction.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 吸血鬼（雾化形态） | 蛛行 |  | exploration-manual-gap |  |  |
| 吸血鬼（雾化形态） | 吸血鬼弱点 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 吸血鬼（本体形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 吸血鬼（本体形态） | 传奇抗性 | legendary-resistance | verified-full |  | src/lib/sharedServerCore.test.ts<br>src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsterLegendaryResistanceTraits.test.ts |
| 吸血鬼（本体形态） | 雾化逃脱 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 吸血鬼（本体形态） | 再生 | regeneration | verified-full |  | src/rulesets/dnd5e/beginTurnAction.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 吸血鬼（本体形态） | 蛛行 |  | exploration-manual-gap |  |  |
| 吸血鬼（本体形态） | 吸血鬼弱点 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 紫罗兰蕈 | 虚假外表 |  | excluded-narrative-transform |  |  |
| 弗洛魔 | 魔法抗性 | magic-resistance | verified-full |  | src/components/map/Dnd5eMonsterAbilityTemplateLibrary.test.tsx<br>src/lib/combatResolutionTrace.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/fleshGolemHeadless.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts<br>src/rulesets/dnd5e/passiveDefenses.test.ts |
| 秃鹫 | 敏锐视觉与嗅觉 |  | exploration-manual-gap |  |  |
| 秃鹫 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 战马 | 践踏冲锋 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 水元素 | 水体形态 |  | non-combat-or-narrative |  |  |
| 水元素 | 冻结 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 鼬 | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 熊人（熊形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 熊人（熊形态） | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 熊人（人类形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 熊人（人类形态） | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 熊人（混合形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 熊人（混合形态） | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 野猪人（野猪形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 野猪人（野猪形态） | 冲锋（仅野猪或混合形态） |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 野猪人（野猪形态） | 坚韧不屈 | relentless | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterRelentless.test.ts<br>src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 野猪人（人类形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 野猪人（人类形态） | 坚韧不屈 | relentless | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterRelentless.test.ts<br>src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 野猪人（混合形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 野猪人（混合形态） | 冲锋（仅野猪或混合形态） |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 野猪人（混合形态） | 坚韧不屈 | relentless | verified-full |  | src/rulesets/dnd5e/monsterHeadlessCoverage.test.ts<br>src/rulesets/dnd5e/monsterRelentless.test.ts<br>src/store/characterTokenPresentation.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 鼠人（人类形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 鼠人（人类形态） | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 鼠人（混合形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 鼠人（混合形态） | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 鼠人（巨鼠形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 鼠人（巨鼠形态） | 敏锐嗅觉 |  | exploration-manual-gap |  |  |
| 虎人（人类形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 虎人（人类形态） | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 虎人（混合形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 虎人（混合形态） | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 虎人（混合形态） | 猛扑 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 虎人（虎形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 虎人（虎形态） | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 虎人（虎形态） | 猛扑 | charge-damage | verified-full |  | src/rulesets/dnd5e/monsterCatalogAttackTraitRuntime.test.ts<br>src/rulesets/dnd5e/customMonsterWorkshop.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterWorkshopAbilityTemplates.test.ts |
| 狼人（人类形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 狼人（人类形态） | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 狼人（混合形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 狼人（混合形态） | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 狼人（狼形态） | 变形生物 |  | excluded-narrative-transform |  |  |
| 狼人（狼形态） | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 尸鬼 | 阳光敏感 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 鬼火 | 吞噬生命 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 | src/rulesets/dnd5e/monsterCombatActionCoverageBatch.test.ts |
| 鬼火 | 虚体短暂 |  | non-combat-or-narrative |  |  |
| 鬼火 | 虚体移动 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 鬼火 | 可变照明 |  | non-combat-or-narrative |  |  |
| 冬狼 | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 冬狼 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 冬狼 | 雪地伪装 |  | exploration-manual-gap |  |  |
| 狼 | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 狼 | 集群战术 | pack-tactics | verified-full |  | src/rulesets/dnd5e/combatSimulation.test.ts<br>src/rulesets/dnd5e/monsterAttackAction.test.ts<br>src/rulesets/dnd5e/monsterGenericAbilities.test.ts<br>src/rulesets/dnd5e/monsters.test.ts<br>src/rulesets/dnd5e/monsterTurnPlanner.test.ts<br>src/rulesets/dnd5e/monsterSchema.test.ts |
| 座狼 | 敏锐听觉与嗅觉 |  | exploration-manual-gap |  |  |
| 缚灵 | 虚体移动 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 缚灵 | 阳光敏感 |  | combat-manual-gap | 原文包含战斗效果但仍依赖 DM 裁定 |  |
| 索尔石怪 | 土遁 |  | non-combat-or-narrative |  |  |
| 索尔石怪 | 岩石伪装 |  | exploration-manual-gap |  |  |
| 索尔石怪 | 宝藏感知 |  | non-combat-or-narrative |  |  |
| 青年黑龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 青年青铜龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 青年金龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 青年绿龙 | 两栖 |  | non-combat-or-narrative |  |  |
| 青年白龙 | 冰面行走 |  | exploration-manual-gap |  |  |
| 僵尸 | 亡灵坚韧 | undead-fortitude | verified-full |  | src/rulesets/dnd5e/headlessCombatEngine.test.ts<br>src/rulesets/dnd5e/monsters.test.ts |

## 怪物法术引用（313）

| 怪物 | 法术 | 法术审查 | 结论 | 缺口 |
| --- | --- | --- | --- | --- |
| 侍僧 | 光亮术 | verified-full | semantic-gap | No core Headless spell definition. |
| 侍僧 | 圣火术 | verified-full | verified-full |  |
| 侍僧 | 奇术 | verified-full | semantic-gap | 效果类型 narrative-effect 尚未进入怪物核心施法白名单 |
| 侍僧 | 祝福术 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 侍僧 | 疗伤术 | verified-full | verified-full |  |
| 侍僧 | 庇护术 | verified-full | verified-full |  |
| 雄性斯芬克斯 | 圣火术 | verified-full | verified-full |  |
| 雄性斯芬克斯 | 维生术 | verified-full | verified-full |  |
| 雄性斯芬克斯 | 奇术 | verified-full | semantic-gap | 效果类型 narrative-effect 尚未进入怪物核心施法白名单 |
| 雄性斯芬克斯 | 命令术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 雄性斯芬克斯 | 侦测善恶 | verified-full | semantic-gap | No core Headless spell definition. |
| 雄性斯芬克斯 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 雄性斯芬克斯 | 次级复原术 | verified-full | verified-full |  |
| 雄性斯芬克斯 | 诚实之域 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 雄性斯芬克斯 | 解除魔法 | verified-full | verified-full |  |
| 雄性斯芬克斯 | 巧言术 | verified-full | semantic-gap | No core Headless spell definition. |
| 雄性斯芬克斯 | 放逐术 | verified-full | verified-full |  |
| 雄性斯芬克斯 | 行动自如 | verified-full | semantic-gap | No core Headless spell definition. |
| 雄性斯芬克斯 | 焰击术 | verified-full | semantic-gap | 包含多种伤害分量 |
| 雄性斯芬克斯 | 高等复原术 | verified-full | semantic-gap | No core Headless spell definition. |
| 雄性斯芬克斯 | 英雄宴 | verified-full | semantic-gap | No core Headless spell definition. |
| 大法师 | 易容术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 大法师 | 隐形术 | verified-full | verified-full |  |
| 大法师 | 火焰箭 | verified-full | verified-full |  |
| 大法师 | 光亮术 | verified-full | semantic-gap | No core Headless spell definition. |
| 大法师 | 法师之手 | verified-full | semantic-gap | 该持续区域尚未进入怪物核心法术事务白名单 |
| 大法师 | 魔法伎俩 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 大法师 | 电爪 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 大法师 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 大法师 | 鉴定术 | verified-full | semantic-gap | No core Headless spell definition. |
| 大法师 | 法师护甲 | verified-full | verified-full |  |
| 大法师 | 魔法飞弹 | verified-full | verified-full |  |
| 大法师 | 侦测思想 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 大法师 | 镜影术 | verified-full | semantic-gap | No core Headless spell definition. |
| 大法师 | 迷踪步 | verified-full | verified-full |  |
| 大法师 | 法术反制 | verified-full | semantic-gap | 效果类型 counterspell 尚未进入怪物核心施法白名单 |
| 大法师 | 飞行术 | verified-full | verified-full |  |
| 大法师 | 闪电束 | verified-full | verified-full |  |
| 大法师 | 放逐术 | verified-full | verified-full |  |
| 大法师 | 火焰护盾 | verified-full | semantic-gap | No core Headless spell definition. |
| 大法师 | 石肤术 | verified-full | semantic-gap | No core Headless spell definition. |
| 大法师 | 寒冰锥 | verified-full | verified-full |  |
| 大法师 | 探知 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 大法师 | 力场墙 | verified-full | verified-full |  |
| 大法师 | 法术无效结界 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 大法师 | 传送术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 大法师 | 心灵屏障 | verified-full | semantic-gap | No core Headless spell definition. |
| 大法师 | 时间停止 | verified-full | semantic-gap | No core Headless spell definition. |
| 云巨人 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 云巨人 | 云雾术 | verified-full | verified-full |  |
| 云巨人 | 光亮术 | verified-full | semantic-gap | No core Headless spell definition. |
| 云巨人 | 羽落术 | verified-full | semantic-gap | No core Headless spell definition. |
| 云巨人 | 飞行术 | verified-full | verified-full |  |
| 云巨人 | 迷踪步 | verified-full | verified-full |  |
| 云巨人 | 心灵遥控 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 云巨人 | 操控天气 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 云巨人 | 气化形体 | verified-full | semantic-gap | No core Headless spell definition. |
| 羽蛇 | 侦测善恶 | verified-full | semantic-gap | No core Headless spell definition. |
| 羽蛇 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 羽蛇 | 侦测思想 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 羽蛇 | 祝福术 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 羽蛇 | 造粮术 | verified-full | semantic-gap | No core Headless spell definition. |
| 羽蛇 | 疗伤术 | verified-full | verified-full |  |
| 羽蛇 | 次级复原术 | verified-full | verified-full |  |
| 羽蛇 | 防护毒素 | verified-full | verified-full |  |
| 羽蛇 | 庇护术 | verified-full | verified-full |  |
| 羽蛇 | 护盾术 | verified-full | semantic-gap | 效果类型 armor-class-buff 尚未进入怪物核心施法白名单 |
| 羽蛇 | 托梦术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 羽蛇 | 高等复原术 | verified-full | semantic-gap | No core Headless spell definition. |
| 羽蛇 | 探知 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 邪教狂信徒 | 光亮术 | verified-full | semantic-gap | No core Headless spell definition. |
| 邪教狂信徒 | 圣火术 | verified-full | verified-full |  |
| 邪教狂信徒 | 奇术 | verified-full | semantic-gap | 效果类型 narrative-effect 尚未进入怪物核心施法白名单 |
| 邪教狂信徒 | 命令术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 邪教狂信徒 | 致伤术 | verified-full | verified-full |  |
| 邪教狂信徒 | 虔诚护盾 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 邪教狂信徒 | 人类定身术 | verified-full | verified-full |  |
| 邪教狂信徒 | 灵体武器 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 地底侏儒（斯涅布力） | 回避侦测 | verified-full | semantic-gap | No core Headless spell definition. |
| 地底侏儒（斯涅布力） | 目盲/耳聋术 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 地底侏儒（斯涅布力） | 朦胧术 | verified-full | verified-full |  |
| 地底侏儒（斯涅布力） | 易容术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 提婆 | 侦测善恶 | verified-full | semantic-gap | No core Headless spell definition. |
| 提婆 | 通神术 | manual | semantic-gap | 继承法术结论：manual；No core Headless spell definition. |
| 提婆 | 死者复活 | verified-full | semantic-gap | No core Headless spell definition. |
| 气巨灵 | 侦测善恶 | verified-full | semantic-gap | No core Headless spell definition. |
| 气巨灵 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 气巨灵 | 雷鸣波 | verified-full | verified-full |  |
| 气巨灵 | 造粮术 | verified-full | semantic-gap | No core Headless spell definition. |
| 气巨灵 | 巧言术 | verified-full | semantic-gap | No core Headless spell definition. |
| 气巨灵 | 御风而行 | verified-full | semantic-gap | No core Headless spell definition. |
| 气巨灵 | 召唤元素生物 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 气巨灵 | 造物术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 气巨灵 | 气化形体 | verified-full | semantic-gap | No core Headless spell definition. |
| 气巨灵 | 隐形术 | verified-full | verified-full |  |
| 气巨灵 | 高等幻影 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 气巨灵 | 异界传送 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 蛛化精灵 | 舞光术 | verified-full | semantic-gap | 该持续区域尚未进入怪物核心法术事务白名单 |
| 蛛化精灵 | 黑暗术 | verified-full | verified-full |  |
| 蛛化精灵 | 妖火 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 卓尔 | 舞光术 | verified-full | semantic-gap | 该持续区域尚未进入怪物核心法术事务白名单 |
| 卓尔 | 黑暗术 | verified-full | verified-full |  |
| 卓尔 | 妖火 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 德鲁伊 | 德鲁伊伎俩 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 德鲁伊 | 燃火术 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 德鲁伊 | 橡棍术 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 德鲁伊 | 纠缠术 | verified-full | verified-full |  |
| 德鲁伊 | 大步奔行 | verified-full | verified-full |  |
| 德鲁伊 | 动物交谈术 | manual | semantic-gap | 继承法术结论：manual；No core Headless spell definition. |
| 德鲁伊 | 雷鸣波 | verified-full | verified-full |  |
| 德鲁伊 | 动物信使 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 德鲁伊 | 树肤术 | verified-full | verified-full |  |
| 树精 | 德鲁伊伎俩 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 树精 | 纠缠术 | verified-full | verified-full |  |
| 树精 | 神莓术 | verified-full | semantic-gap | No core Headless spell definition. |
| 树精 | 树肤术 | verified-full | verified-full |  |
| 树精 | 行动无踪 | verified-full | semantic-gap | No core Headless spell definition. |
| 树精 | 橡棍术 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 尘土魔蝠 | 睡眠术 | verified-full | verified-full |  |
| 火巨灵 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 火巨灵 | 变巨/缩小术 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 火巨灵 | 巧言术 | verified-full | semantic-gap | No core Headless spell definition. |
| 火巨灵 | 召唤元素生物 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 火巨灵 | 气化形体 | verified-full | semantic-gap | No core Headless spell definition. |
| 火巨灵 | 隐形术 | verified-full | verified-full |  |
| 火巨灵 | 高等幻影 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 火巨灵 | 异界传送 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 火巨灵 | 火墙术 | verified-full | verified-full |  |
| 格拉兹特魔 | 黑暗术 | verified-full | verified-full |  |
| 格拉兹特魔 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 格拉兹特魔 | 解除魔法 | verified-full | verified-full |  |
| 格拉兹特魔 | 困惑术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 格拉兹特魔 | 飞行术 | verified-full | verified-full |  |
| 格拉兹特魔 | 律令震慑 | verified-full | verified-full |  |
| 绿鬼婆 | 舞光术 | verified-full | semantic-gap | 该持续区域尚未进入怪物核心法术事务白名单 |
| 绿鬼婆 | 次级幻影 | verified-full | semantic-gap | 效果类型 narrative-effect 尚未进入怪物核心施法白名单 |
| 绿鬼婆 | 恶言相加 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 守护纳迦 | 修复术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 守护纳迦 | 圣火术 | verified-full | verified-full |  |
| 守护纳迦 | 奇术 | verified-full | semantic-gap | 效果类型 narrative-effect 尚未进入怪物核心施法白名单 |
| 守护纳迦 | 命令术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 守护纳迦 | 疗伤术 | verified-full | verified-full |  |
| 守护纳迦 | 虔诚护盾 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 守护纳迦 | 安定心神 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 守护纳迦 | 人类定身术 | verified-full | verified-full |  |
| 守护纳迦 | 降咒 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 守护纳迦 | 鹰眼术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 守护纳迦 | 放逐术 | verified-full | verified-full |  |
| 守护纳迦 | 行动自如 | verified-full | semantic-gap | No core Headless spell definition. |
| 守护纳迦 | 焰击术 | verified-full | semantic-gap | 包含多种伤害分量 |
| 守护纳迦 | 指使术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 守护纳迦 | 真知术 | verified-full | semantic-gap | No core Headless spell definition. |
| 雌性斯芬克斯 | 法师之手 | verified-full | semantic-gap | 该持续区域尚未进入怪物核心法术事务白名单 |
| 雌性斯芬克斯 | 次级幻影 | verified-full | semantic-gap | 效果类型 narrative-effect 尚未进入怪物核心施法白名单 |
| 雌性斯芬克斯 | 魔法伎俩 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 雌性斯芬克斯 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 雌性斯芬克斯 | 鉴定术 | verified-full | semantic-gap | No core Headless spell definition. |
| 雌性斯芬克斯 | 护盾术 | verified-full | semantic-gap | 效果类型 armor-class-buff 尚未进入怪物核心施法白名单 |
| 雌性斯芬克斯 | 黑暗术 | verified-full | verified-full |  |
| 雌性斯芬克斯 | 物件定位术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 雌性斯芬克斯 | 暗示术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 雌性斯芬克斯 | 解除魔法 | verified-full | verified-full |  |
| 雌性斯芬克斯 | 移除诅咒 | verified-full | semantic-gap | No core Headless spell definition. |
| 雌性斯芬克斯 | 巧言术 | verified-full | semantic-gap | No core Headless spell definition. |
| 雌性斯芬克斯 | 放逐术 | verified-full | verified-full |  |
| 雌性斯芬克斯 | 高等隐形术 | verified-full | verified-full |  |
| 雌性斯芬克斯 | 通晓传奇 | manual | semantic-gap | 继承法术结论：manual；No core Headless spell definition. |
| 冰魔蝠 | 云雾术 | verified-full | verified-full |  |
| 拉弥亚 | 易容术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 拉弥亚 | 高等幻影 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 拉弥亚 | 魅惑人类 | verified-full | verified-full |  |
| 拉弥亚 | 镜影术 | verified-full | semantic-gap | No core Headless spell definition. |
| 拉弥亚 | 探知 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 拉弥亚 | 暗示术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 拉弥亚 | 指使术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 巫妖 | 法师之手 | verified-full | semantic-gap | 该持续区域尚未进入怪物核心法术事务白名单 |
| 巫妖 | 魔法伎俩 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 巫妖 | 冷冻射线 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 巫妖 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 巫妖 | 魔法飞弹 | verified-full | verified-full |  |
| 巫妖 | 护盾术 | verified-full | semantic-gap | 效果类型 armor-class-buff 尚未进入怪物核心施法白名单 |
| 巫妖 | 雷鸣波 | verified-full | verified-full |  |
| 巫妖 | 强酸箭 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 巫妖 | 侦测思想 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 巫妖 | 隐形术 | verified-full | verified-full |  |
| 巫妖 | 镜影术 | verified-full | semantic-gap | No core Headless spell definition. |
| 巫妖 | 操纵死尸 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 巫妖 | 法术反制 | verified-full | semantic-gap | 效果类型 counterspell 尚未进入怪物核心施法白名单 |
| 巫妖 | 解除魔法 | verified-full | verified-full |  |
| 巫妖 | 火球术 | verified-full | verified-full |  |
| 巫妖 | 枯萎术 | verified-full | semantic-gap | 构装/亡灵免疫与植物目标最大伤害尚未结构化 |
| 巫妖 | 任意门 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 巫妖 | 死云术 | verified-full | verified-full |  |
| 巫妖 | 探知 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 巫妖 | 解离术 | verified-full | semantic-gap | 降至 0 HP 时的解离结果尚未结构化 |
| 巫妖 | 法术无效结界 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 巫妖 | 死亡一指 | verified-full | semantic-gap | 击杀人形生物后的僵尸创建尚未结构化 |
| 巫妖 | 异界传送 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 巫妖 | 支配怪物 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 巫妖 | 律令震慑 | verified-full | verified-full |  |
| 巫妖 | 律令死亡 | verified-full | verified-full |  |
| 法师 | 火焰箭 | verified-full | verified-full |  |
| 法师 | 光亮术 | verified-full | semantic-gap | No core Headless spell definition. |
| 法师 | 法师之手 | verified-full | semantic-gap | 该持续区域尚未进入怪物核心法术事务白名单 |
| 法师 | 魔法伎俩 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 法师 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 法师 | 法师护甲 | verified-full | verified-full |  |
| 法师 | 魔法飞弹 | verified-full | verified-full |  |
| 法师 | 护盾术 | verified-full | semantic-gap | 效果类型 armor-class-buff 尚未进入怪物核心施法白名单 |
| 法师 | 迷踪步 | verified-full | verified-full |  |
| 法师 | 暗示术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 法师 | 法术反制 | verified-full | semantic-gap | 效果类型 counterspell 尚未进入怪物核心施法白名单 |
| 法师 | 火球术 | verified-full | verified-full |  |
| 法师 | 飞行术 | verified-full | verified-full |  |
| 法师 | 高等隐形术 | verified-full | verified-full |  |
| 法师 | 冰风暴 | verified-full | semantic-gap | 包含多种伤害分量 |
| 法师 | 寒冰锥 | verified-full | verified-full |  |
| 岩浆魔蝠 | 灼热金属 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 木乃伊领主 | 圣火术 | verified-full | verified-full |  |
| 木乃伊领主 | 奇术 | verified-full | semantic-gap | 效果类型 narrative-effect 尚未进入怪物核心施法白名单 |
| 木乃伊领主 | 命令术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 木乃伊领主 | 曳光弹 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 木乃伊领主 | 虔诚护盾 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 木乃伊领主 | 人类定身术 | verified-full | verified-full |  |
| 木乃伊领主 | 沉默术 | verified-full | verified-full |  |
| 木乃伊领主 | 灵体武器 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 木乃伊领主 | 操纵死尸 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 木乃伊领主 | 解除魔法 | verified-full | verified-full |  |
| 木乃伊领主 | 预言术 | manual | semantic-gap | 继承法术结论：manual；No core Headless spell definition. |
| 木乃伊领主 | 信仰守卫 | verified-full | semantic-gap | No core Headless spell definition. |
| 木乃伊领主 | 疫病术 | verified-full | semantic-gap | No core Headless spell definition. |
| 木乃伊领主 | 疫病虫群 | verified-full | verified-full |  |
| 木乃伊领主 | 重伤术 | verified-full | verified-full |  |
| 夜鬼婆 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 夜鬼婆 | 魔法飞弹 | verified-full | verified-full |  |
| 夜鬼婆 | 异界传送 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 夜鬼婆 | 衰弱射线 | verified-full | semantic-gap | No core Headless spell definition. |
| 夜鬼婆 | 睡眠术 | verified-full | verified-full |  |
| 鬼人 | 黑暗术 | verified-full | verified-full |  |
| 鬼人 | 隐形术 | verified-full | verified-full |  |
| 鬼人 | 魅惑人类 | verified-full | verified-full |  |
| 鬼人 | 寒冰锥 | verified-full | verified-full |  |
| 鬼人 | 气化形体 | verified-full | semantic-gap | No core Headless spell definition. |
| 鬼人 | 睡眠术 | verified-full | verified-full |  |
| 深狱炼魔 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 深狱炼魔 | 火球术 | verified-full | verified-full |  |
| 深狱炼魔 | 怪物定身术 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 深狱炼魔 | 火墙术 | verified-full | verified-full |  |
| 行星神使 | 侦测善恶 | verified-full | semantic-gap | No core Headless spell definition. |
| 行星神使 | 隐形术 | verified-full | verified-full |  |
| 行星神使 | 剑刃护壁 | verified-full | verified-full |  |
| 行星神使 | 反制善恶 | verified-full | semantic-gap | No core Headless spell definition. |
| 行星神使 | 焰击术 | verified-full | semantic-gap | 包含多种伤害分量 |
| 行星神使 | 死者复活 | verified-full | semantic-gap | No core Headless spell definition. |
| 行星神使 | 通神术 | manual | semantic-gap | 继承法术结论：manual；No core Headless spell definition. |
| 行星神使 | 操控天气 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 行星神使 | 疫病虫群 | verified-full | verified-full |  |
| 祭司 | 光亮术 | verified-full | semantic-gap | No core Headless spell definition. |
| 祭司 | 圣火术 | verified-full | verified-full |  |
| 祭司 | 奇术 | verified-full | semantic-gap | 效果类型 narrative-effect 尚未进入怪物核心施法白名单 |
| 祭司 | 疗伤术 | verified-full | verified-full |  |
| 祭司 | 曳光弹 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 祭司 | 庇护术 | verified-full | verified-full |  |
| 祭司 | 次级复原术 | verified-full | verified-full |  |
| 祭司 | 灵体武器 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 祭司 | 解除魔法 | verified-full | verified-full |  |
| 祭司 | 灵体卫士 | verified-full | verified-full |  |
| 罗刹 | 侦测思想 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 罗刹 | 易容术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 罗刹 | 法师之手 | verified-full | semantic-gap | 该持续区域尚未进入怪物核心法术事务白名单 |
| 罗刹 | 次级幻影 | verified-full | semantic-gap | 效果类型 narrative-effect 尚未进入怪物核心施法白名单 |
| 罗刹 | 魅惑人类 | verified-full | verified-full |  |
| 罗刹 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 罗刹 | 隐形术 | verified-full | verified-full |  |
| 罗刹 | 高等幻影 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 罗刹 | 暗示术 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 罗刹 | 支配人类 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 罗刹 | 飞行术 | verified-full | verified-full |  |
| 罗刹 | 异界传送 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 罗刹 | 真知术 | verified-full | semantic-gap | No core Headless spell definition. |
| 太阳神使 | 侦测善恶 | verified-full | semantic-gap | No core Headless spell definition. |
| 太阳神使 | 隐形术 | verified-full | verified-full |  |
| 太阳神使 | 剑刃护壁 | verified-full | verified-full |  |
| 太阳神使 | 反制善恶 | verified-full | semantic-gap | No core Headless spell definition. |
| 太阳神使 | 复生术 | verified-full | semantic-gap | No core Headless spell definition. |
| 太阳神使 | 通神术 | manual | semantic-gap | 继承法术结论：manual；No core Headless spell definition. |
| 太阳神使 | 操控天气 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 邪灵纳迦 | 法师之手 | verified-full | semantic-gap | 该持续区域尚未进入怪物核心法术事务白名单 |
| 邪灵纳迦 | 次级幻影 | verified-full | semantic-gap | 效果类型 narrative-effect 尚未进入怪物核心施法白名单 |
| 邪灵纳迦 | 冷冻射线 | verified-full | semantic-gap | 包含持续、专注或命中附带效果 |
| 邪灵纳迦 | 魅惑人类 | verified-full | verified-full |  |
| 邪灵纳迦 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 邪灵纳迦 | 睡眠术 | verified-full | verified-full |  |
| 邪灵纳迦 | 侦测思想 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 邪灵纳迦 | 人类定身术 | verified-full | verified-full |  |
| 邪灵纳迦 | 闪电束 | verified-full | verified-full |  |
| 邪灵纳迦 | 水下呼吸 | verified-full | semantic-gap | No core Headless spell definition. |
| 邪灵纳迦 | 枯萎术 | verified-full | semantic-gap | 构装/亡灵免疫与植物目标最大伤害尚未结构化 |
| 邪灵纳迦 | 任意门 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 邪灵纳迦 | 支配人类 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 蒸汽魔蝠 | 朦胧术 | verified-full | verified-full |  |
| 风暴巨人 | 侦测魔法 | verified-full | semantic-gap | No core Headless spell definition. |
| 风暴巨人 | 羽落术 | verified-full | semantic-gap | No core Headless spell definition. |
| 风暴巨人 | 浮空术 | verified-full | semantic-gap | No core Headless spell definition. |
| 风暴巨人 | 光亮术 | verified-full | semantic-gap | No core Headless spell definition. |
| 风暴巨人 | 操控天气 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 风暴巨人 | 水下呼吸 | verified-full | semantic-gap | No core Headless spell definition. |
| 独角兽 | 侦测善恶 | verified-full | semantic-gap | No core Headless spell definition. |
| 独角兽 | 德鲁伊伎俩 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 独角兽 | 行动无踪 | verified-full | semantic-gap | No core Headless spell definition. |
| 独角兽 | 安定心神 | partial | semantic-gap | 继承法术结论：partial；No core Headless spell definition. |
| 独角兽 | 反制善恶 | verified-full | semantic-gap | No core Headless spell definition. |
| 独角兽 | 纠缠术 | verified-full | verified-full |  |
