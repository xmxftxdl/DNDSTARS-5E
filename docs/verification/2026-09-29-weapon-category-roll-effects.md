# 武器类别限制的持续攻击效果

核对缓存原文：谭森变形术，来源 0996cf1c03dffb49c5d0cf4777c0d1e4c27eda75f32dd1ff8ff82afc99ddd38b:169:0。诊断 441fb4b2e8b0cee14cf7336450973abf10da048944519c6ee68edcf8ffae73bb 指出简易/军用武器攻击优势不能由原有泛武器攻击字段表达。

新增 weapon-attack-roll.weaponCategories，可选择 simple / martial。执行器转换为活动效果 weaponCategoryRollModes；提交、克隆、序列化、严格验证和回读保留数据。类别、法术/武器攻击分类均需匹配；暂停的效果不参与。无分类字段保留原有武器攻击效果语义。

行为证据：dnd5eWeaponAttackRollEffect.test.ts 经 Activity 执行及 Host 提交、JSON 重载后，实际攻击验证限定类别、未知类别、徒手、暂停和两种掷骰模式；纯判断矩阵排除即使携带武器类别的法术攻击。另有模块双次导出/导入/注册/执行。equipmentAttackAction.test.ts 验证真实装备攻击准备模式与结算一致。现有 monsterAttackAction 回归未受影响。

3 文件 138 项通过：.codex-logs/weapon-category-effects-final-20260929.txt。完整类型检查另记录。本批不调用 AI API。

限制：仅此条款的表达能力和合成行为已验证。原书配置未重新生成，原书法术未整体认证；临时盔甲/武器熟练、其他增益、施法结束豁免仍需各自证据。原生怪物攻击未知装备类别时不猜测资格。未进行浏览器双端验收。

完整typecheck48895已明确exit0：.codex-logs/weapon-category-types-20260929.txt。另2文件131项效果/配置校验回归通过：.codex-logs/weapon-category-validation-20260929.txt。
