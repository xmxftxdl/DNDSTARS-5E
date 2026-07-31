# 内置美术资产包

怪物 Token、先攻头像、动作图标和 VFX 继续使用原有的同源 URL：

```text
/assets/portraits/...
/assets/icons/...
/assets/vfx/...
```

源码中的文件仍保存在 `public/assets`，因此本地 Vite 开发不需要改变素材导入方式。
生产构建不会再把这三个目录复制进 `dist`；Node 静态服务从只读资产根提供同一路径。

清单将资源分成两层：

- 运行时白名单包含 1,797 个文件：当前怪物图鉴的所有 Token/先攻头像和视觉变体、
  旧存档兼容图、动作图标及 VFX。
- 688 个 master/raw 制作原图继续保留在 `public/assets`，但不会被生产 HTTP 服务或
  启动校验扫描；它们仍可用于后续导出新变体。

玩家上传的角色立绘、自定义怪物图片和地图 Token 图片仍沿用 data URL 或
`/api/images/:id`，与本资产包互不迁移。

## Docker 部署

在服务器 `.env` 中配置：

```dotenv
STARS_ART_ASSET_HOST_PATH=/opt/astraltrace/app/public
STARS_REQUIRE_ART_ASSET_PACK=true
```

如果需要额外固定清单文件本身，可把 `sha256sum
public/runtime-assets/art-asset-pack.json` 的第一列填入
`STARS_ART_ASSET_MANIFEST_SHA256`。它不是清单 JSON 内的 `contentSha256` 字段。

更新代码后先完整拉取 LFS：

```bash
git lfs pull
npm run audit:art-assets
docker compose build dndstars
docker compose up -d dndstars
```

Compose 会把宿主机的 `public` 目录只读挂载到 `/art-assets`。核心镜像不包含约 3 GiB
美术文件，但浏览器地址、旧存档中的 URL、怪物视觉变体以及 Canvas 加载路径均不改变。
镜像内同时保存同一版本的清单，启动时会用它校验挂载资源，因此代码、清单和图片不会
在版本不一致时静默混用。

不要把该公开、只读的内置资产包放入 `/api/images`。后者是房间上传文件，具有成员授权、
配额、备份与删除语义。

## 缺失资源

生产环境启用 `STARS_REQUIRE_ART_ASSET_PACK=true` 后，清单缺失、LFS 指针未展开、
文件大小或哈希不一致都会阻止服务以“就绪”状态启动。不要用关闭校验的方式掩盖缺图；
应重新执行 `git lfs pull` 和资产审计。

部署后可检查：

```bash
curl -fsS https://astraltracevtt.com/api/readyz
curl -I https://astraltracevtt.com/assets/portraits/goblin-forest-scout-token.png
```

第二个请求应返回图片 MIME 和 `ETag`，不存在的图片应返回 `404`，不会回退到
`index.html`。
