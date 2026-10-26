/*
 * Daily Ink 桌面版（Mac）主进程
 * - 加载与网页版相同的界面
 * - 自动选中 NRF_EPD_ 开头的蓝牙墨水屏（不弹选择框）
 * - 菜单栏常驻、每天定时发送、Mac 唤醒后补发
 * - 读取「备忘录」里的笔记作为待办
 * daily-ink-zzz · by zzz (Ellie Zhang) · GPL-3.0
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, Notification, nativeImage, powerMonitor, shell } = require("electron");
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
