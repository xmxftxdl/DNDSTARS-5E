# 星痕移动玩家端

这是与桌面 DM 网页分离的 React Native + Skia 玩家客户端。当前版本已经接入正式房间协议：

- 登录、注册、战役房间加入与身份恢复；
- 角色卡、生命、状态、资源、法术书、物品与战斗快捷操作；
- 攻击、法术、种族能力、职业能力、物品、基础行动、检定、移动和死亡豁免；
- 多目标／多发法术、区域选点、场景互动点与 Headless Interrupt；
- 聊天、私聊 DM、自由投骰、战斗日志、战役篇章、图片讲义与共享笔记；
- 短休／长休全局恢复报告、生命骰、奥术回想／自然回想与法术位维护；
- 人物与先攻立绘、当前回合地图高亮、状态与专注投影；
- LiveKit 房间语音；
- 玩家专属地图投影、迷雾、墙体、Token 与 Lite / Standard / High 三档画质。
- 带序列去重、断线重连、缺口恢复与前后台恢复的实时 Room Event Stream；
- 版本化 Action／Interrupt 注册表，房间 JSON 规则包可自动向移动端注册能力与裁决界面。

所有规则行动只提交玩家意图，距离、目标、资源、伤害、状态和权限仍由房间 Host 权威校验。移动端不包含 DM 功能。

房间规则包会先下载并校验完整性，成功后移动端才会向 Host 报告“规则已就绪”。插件更新会由事件流立即触发重新下载和注册；下载失败时保持 fail-closed，不会显示一个无法安全执行的伪按钮。移动端只读取声明式 JSON，不执行插件 JavaScript、`eval` 或 `Function`。

## 本地联调（无语音）

电脑和手机连接同一 Wi-Fi，先启动正式 DM/玩家服务，再启动 Metro：

```powershell
npm run dev:dm
npm run dev:player
npm run dev:mobile -- --lan
```

移动端服务地址填写 `http://电脑局域网IP:5273`。Windows 防火墙需允许 Node.js 的专用网络访问。

## iPhone 语音开发构建

LiveKit 使用原生 WebRTC，不能在 Expo Go 中工作。首次测试需要生成开发构建：

```powershell
cd apps/player-mobile
npx eas login
npx eas build --platform ios --profile development
```

安装构建后执行 `npm run start:lan`，再由开发构建扫描二维码。需要 Apple Developer 账号注册设备。

## 检查与构建

```powershell
cd apps/player-mobile
npm run typecheck
npm test
npm run doctor
npm run export:ios
```

`npm run export:ios` 会执行完整 iOS JavaScript/原生模块打包检查。分发 `.ipa` 仍需要 Apple Developer 账号并执行 `eas build --platform ios --profile preview`。

移动端不会承载 DM、地图编辑器、插件工坊与账号角色建卡／逐级升级编辑器。现有角色可以完整参与房间运行；新建角色和升级仍使用桌面玩家端，避免移动端形成第二套角色规则写入链路。
