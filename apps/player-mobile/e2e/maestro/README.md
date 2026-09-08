# iPhone 真机验收

使用 Development Build 或 TestFlight 包，设置三项仅存在于测试机器的环境变量后运行：

```powershell
$env:STARS_MOBILE_E2E_SERVER = "https://staging.astraltracevtt.com"
$env:STARS_MOBILE_E2E_USERNAME = "<staging 测试账号>"
$env:STARS_MOBILE_E2E_PASSWORD = "<测试密码>"
maestro test .\e2e\maestro\login-smoke.yaml
```

该流程验证冷启动、HTTPS 网络层、账号登录、安全凭证落盘和战役大厅恢复。密码不得写入仓库或 EAS 配置文件。

DM 保持测试房间在线后，可继续运行完整房间冒烟：

```powershell
$env:STARS_MOBILE_E2E_ROOM = "<6 位 staging 房间码>"
$env:STARS_MOBILE_E2E_ROOM_PASSWORD = "<无密码时留空>"
maestro test .\e2e\maestro\room-critical-path.yaml
```

它会验证账号登录、加入房间、实时玩家投影，以及冒险、地图、角色、通讯、设置五个原生页面的切换。真机上的推送授权和通知到达仍需人工确认，因为 iOS 系统授权框不能由测试账号预先代答。
