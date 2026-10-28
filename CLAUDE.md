# Daily Ink · 项目说明（给 Claude Code）

让 4.2 寸蓝牙墨水屏每天换一张卡片。作者 zzz (Ellie Zhang)，GitHub `ELLIEZHANG893`。
作者是编程初学者：回复用中文，解释通俗，改完要说明改了什么、怎么验证。

## 两种形态，共用同一套前端
- **网页版**：GitHub Pages，`main` 分支根目录，https://elliezhang893.github.io/daily-ink-zzz/ ，用 Web Bluetooth。
- **Mac 桌面版**：Electron，`desktop/main.js` 加载同一个 `index.html`。区别：自动选设备（`select-bluetooth-device`）、菜单栏常驻、每日定时发送、读取「备忘录」、开机启动。页面通过 `window.dailyInkDesktop`（`desktop/preload.js`）判断是否在桌面版，`body.desktop` 控制 `.desktop-only` / `.web-only` 显示。

## 文件
| 文件 | 作用 |
|---|---|
| `index.html` | 全部界面和样式（左侧导航 + 数据块 + 白卡片，参考后台面板风格） |
| `js/app.js` | 页面逻辑、表单存储（localStorage `daily-ink`）、连接/发送、桌面版定时任务 |
| `js/epd.js` | 蓝牙协议：`InkDevice`、图像编码、RLE 压缩、槽位、轮播、电量换算 |
| `js/cards.js` | 卡片模板（运势签/每日一句/月历/待办/状态牌/文字/照片）和三色量化。`setSize(w, h)` 切换屏幕尺寸：宽高比 ≤2 用标准排版（逻辑高 300，按屏幕缩放，宽屏排版变宽）；>2 的长条小屏用紧凑排版（逻辑高 128）。`SCREENS` 是常见尺寸列表 |
| `js/fortune.js` | 八字排盘、十神、运势签内容（依赖 `vendor/lunar.js` 的全局 `Solar`） |
| `js/fortune-texts.js` | 运势签文案库：10 种十神 × 37 句签语 + 主题/宜/忌词库，按日期轮换，一年内不重复 |
| `js/guide.js` | 新手引导：黑猫墨墨形状的异型弹窗，首次打开自动出现，右上角「新手引导」可重看 |
| `js/momo.js` / `js/momo-img.js` | 吉祥物墨墨：每日一句文案库（366 句，一年每天一句）、矢量备用画法、墨水屏版正面猫（data URL，避免 file:// 下画布被污染） |
| `assets/` | 墨墨三视图抠图、logo、导航小图标 |
| `build/` | App 图标、Release 说明模板、.dmg 内的「打不开请看我.txt」 |
| `.github/workflows/release.yml` | 发布 Release 时在 macOS runner 打包 arm64/x64 .dmg 并上传；手动运行则上传为 Actions 产物 |

## AI 专属签文（仅桌面版，可选）
- 用户在运势签设置里选服务商并填自己的 API key：DeepSeek、Kimi、通义千问、OpenAI、Claude，或「其他（OpenAI 兼容接口）」自填地址。预设列表在 `desktop/main.js` 的 `AI_PROVIDERS`。
- key 按服务商分别用 Electron `safeStorage`（系统钥匙串）加密存在 `settings.json`，只在主进程解密，不传给页面。
- Claude 用 `@anthropic-ai/sdk` + 结构化输出；其余走 OpenAI 兼容的 `/chat/completions`（Node 自带 fetch），提示词约定 JSON，DeepSeek/OpenAI 另加 `response_format: json_object`。返回后统一检查字数，超出排版就退回内置签文。
- 模型名变化快：页面有「获取模型列表」（调用 `/models`），模型框也可以手填。
- 只发送日主、强弱、喜用五行和当天干支/十神/星级，不发送生日和称呼。同一天同一八字只生成一次（页面 localStorage `daily-ink-ai` 缓存）。
- 如果 npm 默认用的是私有镜像，装依赖时加 `--registry=https://registry.npmjs.org`，避免 package-lock 里出现私有镜像地址。

## 屏幕尺寸与通用性
- 预览尺寸由「屏幕预览」的下拉框决定，存在 localStorage；连上 EPD-nRF5 屏后自动切到该屏分辨率（`DRIVERS` 里的 `w/h`）并锁定。
- 「下载图片」导出当前预览（已量化）为 PNG 或 24 位 BMP，让不支持蓝牙协议的墨水屏也能用。
- 以后支持新尺寸的 EPD-nRF5 屏：在 `js/epd.js` 的 `DRIVERS` 登记驱动编号、颜色模式和分辨率即可。

## 蓝牙协议要点（作者的屏实测）
- 服务 `62750001-d828-918d-fb46-b6c11c675aec`，特征 `…0002`；设备名 `NRF_EPD_xxxx`（作者的是 `NRF_EPD_613F`）。
- 指令：INIT 0x01、CLEAR 0x02、REFRESH 0x05、SET_TIME 0x20、WRITE_IMG 0x30、SET_SLOT 0x31、FREE_SLOT 0x32、SET_SLIDE 0x33。
- 作者的屏：驱动 0x16（4.2 寸三色 SSD1683），MTU 244，支持 RLE，**15 个图片槽位**，固件**不通过蓝牙报告电量**（`t=` 消息里没有 `bat=`）。
- 三色屏必须发黑白层 + 红色层；有槽位的固件要先 `SET_SLOT [0, slot]`、写完 `SET_SLOT [1, slot]` 再 REFRESH；只存不刷新用 `REFRESH [0xA5]`。
- 每块数据都要等写入确认（`writeValueWithResponse`），否则会丢包导致全黑。
- 这块屏连接很慢，常要重试多次：`_open()` 里每次 20 秒超时、最多 6 次。同一时间只接受一个连接。
- 协议参考开源 EPD-nRF5（GPL-3.0）。**不要复制 epdiy.cn 的代码**，只能独立实现。

## 测试方式
- 语法：`node --check js/*.js desktop/*.js`
- 页面渲染：Playwright 打开 `file://…/index.html` 截图（拦截 fonts.googleapis.com）。
- 桌面版：`npm install` 后 `xvfb-run node_modules/electron/dist/electron --no-sandbox <测试脚本>`；Linux 上无蓝牙适配器，只能验证界面和报错提示。
- 真机蓝牙只能由作者在自己的 Mac 上验证；网页版连上 = 蓝牙逻辑正确。

## 发布流程
1. 改 `package.json` 的 `version`，提交推送到 `main`（网页版自动更新）。
2. 作者在 GitHub「Releases → New release」填同名 tag（如 `v0.3.2`）发布 → Actions 自动打包并把 .dmg 和安装说明附到 Release。
3. 云端会话无法创建/删除 Release 或推送 tag，这几步需要作者在网页上操作。

## 规则
- **不得在仓库里出现作者或其家人的任何个人信息**（生日、出生时间、八字、真名昵称等）。表单默认留空，示例用「甲子 丙寅 戊辰 庚申」「小墨」。历史已于 2026-10-28 用 git filter-repo 清理过。
- 墨墨形象为作者原创（图标与三视图），不要换成任何已有 IP 角色。
- 提交作者：`ELLIEZHANG893 <ELLIEZHANG893@users.noreply.github.com>`。

## 待办
- [ ] 作者删除 v0.3.0 的 Release 和 tag（仍指向含个人信息的旧提交），删除后用 `git ls-remote --tags origin` 确认。
- [ ] 作者发布 v0.3.2 Release，确认 Release 页面带安装说明、.dmg 内有「打不开请看我.txt」。
- [ ] 作者在 Mac 上验证桌面版 v0.3.2 能自动连上屏幕并发送。
- [ ] 可选：苹果开发者签名（¥688/年）后，在 workflow 里加签名和公证（需要作者把证书等放进 GitHub Secrets）。
- [ ] 可选：EasyInput（ESP32-S3 键盘开发板）旋钮/按键遥控墨水屏翻页。
