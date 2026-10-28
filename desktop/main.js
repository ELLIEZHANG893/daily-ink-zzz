/*
 * Daily Ink 桌面版（Mac）主进程
 * - 加载与网页版相同的界面
 * - 自动选中 NRF_EPD_ 开头的蓝牙墨水屏（不弹选择框）
 * - 菜单栏常驻、每天定时发送、Mac 唤醒后补发
 * - 读取「备忘录」里的笔记作为待办
 * daily-ink-zzz · by zzz (Ellie Zhang) · GPL-3.0
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, powerMonitor, shell, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

const PREFIX = "NRF_EPD_";
let win = null, tray = null, quitting = false;

// ---------- 设置文件 ----------
const settingsPath = () => path.join(app.getPath("userData"), "settings.json");
function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), "utf8")); } catch (e) { return {}; }
}
function writeSettings(patch) {
  const s = { ...readSettings(), ...patch };
  try { fs.mkdirSync(path.dirname(settingsPath()), { recursive: true }); fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2)); } catch (e) {}
  return s;
}

// 确保网页蓝牙可用（部分平台默认未开启）
app.commandLine.appendSwitch("enable-experimental-web-platform-features");
app.commandLine.appendSwitch("enable-web-bluetooth");

// ---------- 只允许运行一个 ----------
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on("second-instance", () => showWindow());

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  if (process.platform === "darwin") app.dock && app.dock.show();
}

function createWindow(hidden) {
  win = new BrowserWindow({
    width: 1120, height: 920, minWidth: 420, minHeight: 600,
    title: "Daily Ink", show: !hidden, backgroundColor: "#f4efe6",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false,
      backgroundThrottling: false, // 窗口隐藏时定时任务也要正常运行
    },
  });
  win.loadFile(path.join(__dirname, "..", "index.html"));

  // 外部链接用系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });

  // 关闭窗口 = 隐藏到菜单栏，定时任务继续
  win.on("close", (e) => {
    if (quitting) return;
    e.preventDefault(); win.hide();
    if (process.platform === "darwin" && app.dock) app.dock.hide();
  });

  // 自动选择蓝牙设备：优先上次连过的那块屏，否则选第一个 NRF_EPD_ 开头的。
  // 扫描过程实时告诉页面（扫到了几个设备、有没有墨水屏），扫不到时页面会提示原因。
  win.webContents.on("select-bluetooth-device", (event, devices, callback) => {
    event.preventDefault();
    if (!pick) {
      pick = { callback, seen: new Map(), started: Date.now(), timer: setTimeout(() => finishPick(""), 25000) };
      sendToPage("bt:scan", { phase: "start" });
    } else pick.callback = callback;
    devices.forEach((d) => pick.seen.set(d.deviceId, d.deviceName || ""));
    const list = [...pick.seen].map(([id, name]) => ({ id, name }));
    sendToPage("bt:scan", { phase: "update", total: list.length, named: list.filter((d) => d.name) });
    const last = readSettings().deviceName;
    const match = devices.find((d) => last && d.deviceName === last) || devices.find((d) => (d.deviceName || "").startsWith(PREFIX));
    if (match) finishPick(match.deviceId, match.deviceName);
  });
}

let pick = null;
function sendToPage(ch, data) { try { win && win.webContents.send(ch, data); } catch (e) {} }
function finishPick(id, name) {
  if (!pick) return;
  clearTimeout(pick.timer);
  const p = pick; pick = null;
  if (id && name) writeSettings({ deviceName: name });
  sendToPage("bt:scan", { phase: id ? "picked" : "timeout", name: name || "", total: p.seen.size });
  p.callback(id || "");
}
// 页面里手动点选某个设备（自动匹配不到时的备用方案）
ipcMain.handle("bt:choose", (_e, id) => {
  if (!pick) return false;
  finishPick(id, pick.seen.get(id) || "");
  return true;
});
ipcMain.handle("bt:cancel", () => { finishPick(""); return true; });

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "trayTemplate.png"));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip("Daily Ink");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "打开 Daily Ink", click: showWindow },
    { label: "现在发送一次", click: () => runNow() },
    { type: "separator" },
    { label: "退出", click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on("click", showWindow);
}

// ---------- 定时任务 ----------
let schedule = { enabled: false, time: "10:00" };
let attemptedDay = "";
const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function runNow() {
  if (!win) return;
  // 第二个参数 true = 视为用户操作，网页里才能发起蓝牙连接
  win.webContents.executeJavaScript("window.__dailyInkRun && window.__dailyInkRun()", true).catch(() => {});
}

async function checkSchedule() {
  if (!win || !schedule.enabled) return;
  const now = new Date();
  const [h, m] = (schedule.time || "10:00").split(":").map(Number);
  const due = new Date(now); due.setHours(h, m, 0, 0);
  if (now < due || attemptedDay === dayKey(now)) return;
  let done = false;
  try { done = await win.webContents.executeJavaScript("window.__dailyInkRanToday && window.__dailyInkRanToday()"); } catch (e) {}
  attemptedDay = dayKey(now);
  if (!done) runNow();
}

// ---------- 读取备忘录 ----------
function readNote(name) {
  return new Promise((resolve, reject) => {
    if (process.platform !== "darwin") return reject(new Error("只有 Mac 支持读取备忘录"));
    const safe = String(name).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const script = `tell application "Notes" to get body of first note whose name is "${safe}"`;
    execFile("osascript", ["-e", script], { timeout: 15000 }, (err, stdout) => {
      if (err) return reject(new Error(/Can.t get|无法获得/.test(String(err.message)) ? `找不到标题为「${name}」的笔记` : "请在弹窗里允许 Daily Ink 访问「备忘录」"));
      // 备忘录正文是 HTML：把段落和换行转成文本行，去掉第一行标题
      const text = stdout
        .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(div|p|li|h\d)>/gi, "\n")
        .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .split("\n").map((l) => l.trim()).filter(Boolean);
      if (text.length && text[0] === name) text.shift();
      resolve(text.join("\n"));
    });
  });
}

// ---------- AI 专属签文（用户自己的 Claude API key） ----------
// key 用系统钥匙串加密后存在本机 settings.json，只在主进程里解密使用，不会传给页面。
const AI_MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
function aiConfig() {
  const s = readSettings().ai || {};
  return { enabled: !!s.enabled, model: AI_MODELS.includes(s.model) ? s.model : AI_MODELS[0], hasKey: !!s.key };
}
function aiKey() {
  const enc = (readSettings().ai || {}).key;
  if (!enc) return "";
  try { return safeStorage.decryptString(Buffer.from(enc, "base64")); } catch (e) { return ""; }
}

const AI_PROMPT = `你是「Daily Ink 每日一墨」的运势签文案作者，为一张小小的墨水屏卡片写当天的签文。
用户会给你：当天日期、干支和节气；用户八字的日主、强弱和喜用五行；以及程序已经算好的当天十神、星级（1-5）和冲合提示。
请结合这些信息，写出贴合这一天、这个人的文案。语气温暖、积极、生活化，像朋友的提醒。
不要恐吓，不要绝对化的断言，不给医疗、投资、彩票方面的建议。星级低时语气更温和、多些安抚；星级高时可以更有冲劲。
卡片空间很小，必须严格遵守字数（按汉字计）：
- theme：今日主题，2-5 个字
- yi：宜做的 3 件事，每件 2-4 个字
- ji：忌做的 2 件事，每件 2-4 个字
- line：一句签语，10-18 个字，最多一个逗号，结尾用句号`;

const AI_SCHEMA = {
  type: "object",
  properties: {
    theme: { type: "string" },
    yi: { type: "array", items: { type: "string" } },
    ji: { type: "array", items: { type: "string" } },
    line: { type: "string" },
  },
  required: ["theme", "yi", "ji", "line"],
  additionalProperties: false,
};

async function aiFortune(info) {
  const key = aiKey();
  if (!key) throw new Error("还没有填写 API key");
  const { model } = aiConfig();
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key, timeout: 90 * 1000 });
  const body = {
    model, max_tokens: 16000,
    output_config: { effort: "low", format: { type: "json_schema", schema: AI_SCHEMA } },
    system: AI_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(info) }],
  };
  let res;
  try {
    // Opus / Sonnet 偶尔会被安全策略误拒，开启「被拒时自动换模型重试」；Haiku 不支持这个参数
    res = model === "claude-haiku-5-5"
      ? await client.messages.create(body)
      : await client.beta.messages.create({ ...body, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error("API key 无效，请检查是否填对");
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error("这个 key 没有使用该模型的权限");
    if (e instanceof Anthropic.RateLimitError) throw new Error("请求太频繁或额度不足，稍后再试");
    if (e instanceof Anthropic.APIConnectionError) throw new Error("连不上 Anthropic，请检查网络");
    if (e instanceof Anthropic.APIError) throw new Error(`Claude 接口出错（${e.status || "?"}）：${e.message}`);
    throw e;
  }
  if (res.stop_reason === "refusal") throw new Error("模型这次没有生成，先用内置签文");
  if (res.stop_reason === "max_tokens") throw new Error("生成被截断了，先用内置签文");
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const out = JSON.parse(text);
  // 再检查一遍长度，超出卡片排版就不用
  const len = (s) => [...String(s || "").trim()].length;
  const yi = (out.yi || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 3);
  const ji = (out.ji || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 2);
  const ok = len(out.theme) >= 2 && len(out.theme) <= 6 && yi.length === 3 && ji.length === 2
    && yi.every((s) => len(s) <= 5) && ji.every((s) => len(s) <= 5) && len(out.line) >= 4 && len(out.line) <= 22;
  if (!ok) throw new Error("AI 写的字数超出了卡片，先用内置签文");
  return { theme: out.theme.trim(), yi, ji, line: out.line.trim(), model: res.model };
}

ipcMain.handle("ai:get", () => aiConfig());
ipcMain.handle("ai:set", (_e, s) => {
  const ai = { ...(readSettings().ai || {}), enabled: !!s.enabled, model: AI_MODELS.includes(s.model) ? s.model : AI_MODELS[0] };
  if (typeof s.key === "string" && s.key.trim()) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("这台 Mac 暂时无法加密保存 key");
    ai.key = safeStorage.encryptString(s.key.trim()).toString("base64");
  }
  if (s.clearKey) ai.key = "";
  writeSettings({ ai });
  return aiConfig();
});
ipcMain.handle("ai:fortune", (_e, info) => aiFortune(info));

// ---------- 与页面通信 ----------
ipcMain.handle("schedule:set", (_e, s) => {
  schedule = { enabled: !!s.enabled, time: s.time || "10:00" };
  writeSettings({ schedule });
  checkSchedule();
  return true;
});
ipcMain.handle("login:set", (_e, on) => {
  if (process.platform === "darwin") app.setLoginItemSettings({ openAtLogin: !!on, openAsHidden: true });
  return true;
});
ipcMain.handle("notes:read", (_e, name) => readNote(name));
ipcMain.handle("notify", (_e, title, body) => {
  if (Notification.isSupported()) new Notification({ title, body: body || "" }).show();
  return true;
});
ipcMain.handle("ready", () => true);

// ---------- 启动 ----------
app.whenReady().then(() => {
  schedule = readSettings().schedule || schedule;
  const hidden = app.getLoginItemSettings().wasOpenedAsHidden || process.argv.includes("--hidden");
  createWindow(hidden);
  if (hidden && process.platform === "darwin" && app.dock) app.dock.hide();
  createTray();
  setInterval(checkSchedule, 30 * 1000);
  // Mac 从睡眠唤醒或解锁后，补发当天错过的卡片
  // （当天已经成功发送过就不会重复发）
  powerMonitor.on("resume", () => { attemptedDay = ""; setTimeout(checkSchedule, 15000); });
  powerMonitor.on("unlock-screen", () => { attemptedDay = ""; setTimeout(checkSchedule, 5000); });
});

app.on("activate", showWindow);
app.on("before-quit", () => { quitting = true; });
app.on("window-all-closed", (e) => e.preventDefault && e.preventDefault());
