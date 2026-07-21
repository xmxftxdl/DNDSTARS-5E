# SRD 5.1 中文内容审校

核心中文规则只以 Wizards of the Coast 发布的英文 SRD 5.1 为规则源，并保留仓库根目录 `ATTRIBUTION.md` 中的 CC BY 4.0 署名。

翻译流程禁止调用 Lingva、Google Translate 等自动翻译服务：

1. 使用官方 `SRD_CC_v5.1.pdf` 运行对应审计脚本，导出带英文原文、官方页码和稳定 ID 的工作表。
2. 译者结合 D&D 5e 2014 规则语境填写中文正文；属性检定、豁免、动作经济、距离、伤害类型、状态、法术位、充能和同调等术语必须按项目词表统一。
3. 另一位审校者或独立复核轮次填写 `reviewedBy` 和 `reviewedAt`。
4. 只有白名单数量、ID、来源页、译文和审校字段全部通过校验，生成器才允许覆盖发布用 TypeScript 数据。

魔法物品工作表由以下命令生成：

```powershell
python scripts/generate-srd-magic-item-rules.py path\to\SRD_CC_v5.1.pdf
```

审校结果保存为 `content/srd51/magic-items.zh.reviewed.json`。审校批次可追加 `--emit-reviewed` 生成运行时覆盖层；全部 240 项完成后才可追加 `--emit` 生成完整发布数据。

法术工作表由以下命令生成：

```powershell
python scripts/generate-srd-spell-translations.py path\to\SRD_CC_v5.1.pdf
```

审校结果保存为 `content/srd51/spells.zh.reviewed.json`。审校批次可追加 `--emit-reviewed` 生成运行时覆盖层；全部 319 项完成后才可追加 `--emit` 生成完整发布数据。旧的 PHB PDF 提取器已从仓库移除，不能再用于核心包。

当前覆盖进度由工作表和运行时测试共同核对；不能用旧译文补齐 `reviewedBy`，也不能把“已有中文正文”误报成“已完成 SRD 语境审校”。
