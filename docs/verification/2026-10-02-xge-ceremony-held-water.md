# 典礼术：他人持有水瓶的永久转换

典礼术v15部分包已导出并重新导入，实际外层法术事务完成普通/仪式、自持/他持四项本地验收。转换一瓶水为永久圣水，结果写回原持有者；25gp银粉由施法者消费，普通施法消耗一环位，仪式不消耗环位。角色重载后圣水保留。错误物主及施法期间水瓶转移拒绝，不生成结算应用。

通用 `alter-inventory-item` 新增永久转换的 `target:target` 路线。Host以已选目标身份映射到唯一角色库存，校验物主、实例、模板、数量和观察版本；客户端不能选择未选角色的库存。临时可恢复转换仍仅支持施法者，一次事务只处理一个堆叠。

证据：`.codex-logs/ceremony-held-water-source-r2.txt` 四项通过；`ceremony-held-water-target-r3.txt` 40项通过（包含八项新增绑定检查）；`ceremony-held-water-regression-r1.txt` 五文件112项通过，两组检查重叠不累加。生产实现最终类型检查会话74070退出0，日志 `ceremony-held-water-typecheck-r1.txt`。后续SDK文字更新单独验证。

后续收尾：玩家选择窗口按转换/附魔分别提示，转换缺少合格物品时不再误报仅接受武器或护甲；触发器物品窗口改用中性“作用的物品”。SDK说明32项通过，日志 `ceremony-held-water-sdk-r1.txt`；包含界面及SDK修改的最终类型检查会话29036退出0，日志 `ceremony-held-water-typecheck-r2.txt`。地图已有独立 `inventoryItem` 记录，但尚无永久转换结算，下一步需要地图物件目标路线，不能以库存转换代替。

归档位于本机 `C:/Users/Doco/AppData/Local/StarsApp/local-import-tests/fullbook-entry-repairs-20260930-r1/ceremony-partial-v15/`，`partial-acceptance.json` 保存实际文件哈希。原始转换稿及v14归档未改写。v15保持assisted/partial，未取得完整自动施法资格。

剩余：地图水瓶、真实玩家端他人库存选择及权限、全部典礼入口与完整长时施法双端、跨包终身受益历史、婚礼AC地图显示等仍待验收。上一版祈愿例外的双端证据仅覆盖预置保护尸体，不作为v15完整典礼施法证据。保留已有三个spell-not-headless失败及架构审计失败。

全书本地49/155，106条待验收，7条限定双端证据，纯叙事豁免0；本步不增加整条完成数。未调用付费API。
