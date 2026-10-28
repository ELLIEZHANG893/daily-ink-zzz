/* daily-ink-zzz · 页面逻辑（网页版和 Mac 桌面版共用） · by zzz (Ellie Zhang) · GPL-3.0 */
(function () {
  const $ = (id) => document.getElementById(id);
  const desktop = window.dailyInkDesktop || null; // 只有桌面 App 里才有
  if (desktop) document.body.classList.add("desktop");

  const canvas = $("preview"), ctx = canvas.getContext("2d", { willReadFrequently: true });
  let tab = "fortune", busy = false, renderSeq = 0;
  let photos = [], photoIdx = 0, shuffle = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- 日志 ----------
  function log(msg) {
    const t = new Date().toTimeString().slice(0, 8);
    $("log").textContent += `${t}  ${msg}\n`;
    $("log").scrollTop = $("log").scrollHeight;
  }

  // ---------- 本地记住设置（只存在本机） ----------
  const SAVE_IDS = ["fBirthDate", "fBirthTime", "fPillars", "fName", "dText", "cWeekStart", "tTitle", "tText", "tNoteName",
    "sTitle", "sSub", "sBadge", "qText", "qAuthor", "iInterval", "aTime", "aCard"];
  const SAVE_CHECKS = ["useRed", "iDither", "aEnable", "aLogin"];
  function store() { try { return JSON.parse(localStorage.getItem("daily-ink") || "{}"); } catch (e) { return {}; } }
  function load() {
    const s = store();
    SAVE_IDS.forEach((id) => { if (s[id] != null && $(id)) $(id).value = s[id]; });
    SAVE_CHECKS.forEach((id) => { if (s[id] != null && $(id)) $(id).checked = s[id]; });
    if (s.fMode) document.querySelectorAll('input[name="fMode"]').forEach((r) => (r.checked = r.value === s.fMode));
    if (s.tab) tab = s.tab;
  }
  function save() {
    try {
      const s = store();
      s.tab = tab; s.fMode = fMode();
      SAVE_IDS.forEach((id) => $(id) && (s[id] = $(id).value));
      SAVE_CHECKS.forEach((id) => $(id) && (s[id] = $(id).checked));
      localStorage.setItem("daily-ink", JSON.stringify(s));
    } catch (e) {}
  }

  // ---------- 工具 ----------
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function dateOf(id) {
    const v = $(id).value || todayStr();
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const fMode = () => (document.querySelector('input[name="fMode"]:checked') || {}).value || "birth";
  function lunarInfo(date) {
    const l = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunar();
    return { lunar: `农历${l.getMonthInChinese()}月${l.getDayInChinese()}`, gz: `${l.getDayInGanZhi()}日`, jieqi: l.getJieQi() || "" };
  }
  /** 读取生辰；还没填时返回 null（不提供任何默认生日） */
  function birthInput() {
    if (fMode() === "pillars") return $("fPillars").value.trim() ? { pillars: $("fPillars").value } : null;
    if (!$("fBirthDate").value) return null;
    const [y, m, d] = $("fBirthDate").value.split("-").map(Number);
    const [h, mi] = ($("fBirthTime").value || "12:00").split(":").map(Number);
    return { y, m, d, h, mi };
  }

  // ---------- AI 专属签文（仅桌面版；key 只在桌面 App 的主进程里） ----------
  let aiEnabled = false;
  const AI_STORE = "daily-ink-ai";
  function aiCache() { try { return JSON.parse(localStorage.getItem(AI_STORE) || "{}"); } catch (e) { return {}; } }
  /** 同一天、同一个八字只生成一次 */
  const aiKeyOf = (r) => `${todayStr(r.date)}|${r.natal.pillars.join("")}`;
  async function aiGenerate(birth, day) {
    const r = Fortune.reading(birth, day);
    const key = aiKeyOf(r), cache = aiCache();
    if (cache[key]) return cache[key];
    const n = r.natal;
    const res = await desktop.aiFortune({
      日期: `${todayStr(day)} 周${r.week}`, 当日干支: `${r.gz}日`, 农历: r.lunar, 节气: r.jieqi || "无",
      日主: `${n.dm}${n.dmWx}`, 日主强弱: n.weak ? "偏弱" : "偏强", 喜用五行: n.favorable.join("、"),
      当日十神: r.god, 星级: r.stars, 冲合提示: r.note || "无",
    });
    const next = {}; // 只留最近 30 条
    Object.keys(cache).sort().slice(-30).forEach((k) => (next[k] = cache[k]));
    next[key] = res;
    try { localStorage.setItem(AI_STORE, JSON.stringify(next)); } catch (e) {}
    return res;
  }

  /**
   * 把某种卡片画到预览画布上。date 不传就用表单里的日期；自动更新时传今天。
   */
  async function drawCard(kind, date) {
    const seq = ++renderSeq;
    const useRed = $("useRed").checked;
    let dither = false;
    const stale = () => seq !== renderSeq;

    if (kind === "fortune") {
      const day = date || dateOf("fDay");
      const birth = birthInput();
      if (!birth) {
        $("fNatal").textContent = fMode() === "pillars" ? "请填写四柱八字，例如：甲子 丙寅 戊辰 庚申" : "请先填写出生日期。出生时间不知道可以留空，会按中午 12 点计算。";
        await Cards.fontsReady("填写生日就能看到你的每日运势签");
        if (stale()) return false;
        Cards.drawStatus(ctx, { title: "填写生日", sub: "就能看到你的每日运势签", badge: "运势签", useRed });
        Cards.quantize(ctx, { dither: false, useRed });
        return true;
      }
      try {
        const r = Fortune.reading(birth, day);
        const n = r.natal;
        const ai = aiEnabled && aiCache()[aiKeyOf(r)];
        if (ai) Object.assign(r, { theme: ai.theme, yi: ai.yi, ji: ai.ji, line: ai.line });
        $("fNatal").textContent = `八字：${n.pillars.join(" ")}　日主 ${n.dm}${n.dmWx}（${n.weak ? "偏弱" : "偏强"}），喜用 ${n.favorable.join("、")}` + (ai ? "　· 签文由 AI 撰写" : "");
        await Cards.fontsReady(r.theme + r.line + r.yi.join("") + r.ji.join("") + r.lunar + r.note + $("fName").value);
        if (stale()) return false;
        Cards.drawFortune(ctx, r, { useRed, name: $("fName").value.trim() });
      } catch (e) {
        $("fNatal").textContent = "⚠️ " + e.message;
        Cards.drawStatus(ctx, { title: "八字有误", sub: "请检查输入", badge: "!" });
      }
    } else if (kind === "daily") {
      const day = date || dateOf("dDay");
      const own = $("dText").value.trim();
      let text = own;
      if (!text) {
        const base = Momo.quoteOf(day);
        text = shuffle && !date ? Momo.QUOTES[(Momo.QUOTES.indexOf(base) + shuffle) % Momo.QUOTES.length] : base;
      }
      $("dText").placeholder = own ? "" : text;
      const li = lunarInfo(day);
      await Cards.fontsReady(text + li.lunar + "墨墨说周");
      if (stale()) return false;
      Cards.drawDaily(ctx, { text, date: day, lunar: li.lunar, useRed });
    } else if (kind === "calendar") {
      const day = date || dateOf("cDay");
      const li = lunarInfo(day);
      await Cards.fontsReady("年月星期" + li.lunar + li.gz + li.jieqi + "一二三四五六日");
      if (stale()) return false;
      Cards.drawCalendar(ctx, { date: day, ...li, useRed, weekStart: +$("cWeekStart").value });
    } else if (kind === "todo") {
      const items = Cards.parseTodos($("tText").value);
      await Cards.fontsReady($("tTitle").value + $("tText").value + "月日周还剩件共");
      if (stale()) return false;
      Cards.drawTodo(ctx, { title: $("tTitle").value.trim(), items, date: date || new Date(), useRed });
    } else if (kind === "status") {
      const opt = { title: $("sTitle").value, sub: $("sSub").value, badge: $("sBadge").value, useRed };
      await Cards.fontsReady(opt.title + opt.sub + opt.badge + "更新于月日");
      if (stale()) return false;
      Cards.drawStatus(ctx, opt);
    } else if (kind === "quote") {
      const opt = { text: $("qText").value, author: $("qAuthor").value.trim(), useRed };
      await Cards.fontsReady(opt.text + opt.author + "“——");
      if (stale()) return false;
      Cards.drawQuote(ctx, opt);
    } else {
      const p = photos[photoIdx];
      Cards.drawImage(ctx, p && p.img, p || {});
      dither = $("iDither").checked && !!p;
    }
    Cards.quantize(ctx, { dither, useRed: useRed && !dither });
    return true;
  }

  async function render() { await drawCard(tab); save(); }

  const TITLES = {
    fortune: ["运势签", "按八字和当天干支生成你自己的每日运势"],
    daily: ["每日一句", "小黑猫墨墨每天说一句不一样的话"],
    calendar: ["月历", "整月日历，附农历、干支和节气"],
    todo: ["待办", "把今天要做的事挂在桌上"],
    status: ["状态牌", "一键切换「专注中」「开会中」"],
    quote: ["文字卡片", "写一句想对自己说的话"],
    image: ["照片", "把照片变成墨水屏点阵，也可以多图轮播"],
  };
  function setTab(name, silent) {
    tab = name;
    const t = TITLES[name] || ["", ""];
    $("pageTitle").textContent = t[0]; $("pageSub").textContent = t[1];
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    document.querySelectorAll(".form").forEach((f) => f.classList.toggle("active", f.dataset.form === name));
    if (!silent) render();
  }

  // ---------- 照片（可多张） ----------
  function renderThumbs() {
    $("iThumbs").innerHTML = "";
    photos.forEach((p, i) => {
      const im = document.createElement("img");
      im.src = p.url; im.title = `第 ${i + 1} 张`;
      im.className = i === photoIdx ? "active" : "";
      im.onclick = () => { photoIdx = i; syncPhotoControls(); renderThumbs(); render(); };
      $("iThumbs").appendChild(im);
    });
    refreshConn();
  }
  function syncPhotoControls() {
    const p = photos[photoIdx] || { zoom: 1, dx: 0, dy: 0 };
    $("iZoom").value = p.zoom; $("iDx").value = p.dx; $("iDy").value = p.dy;
  }
  ["iZoom", "iDx", "iDy"].forEach((id) => $(id).addEventListener("input", () => {
    const p = photos[photoIdx]; if (!p) return;
    p.zoom = +$("iZoom").value; p.dx = +$("iDx").value; p.dy = +$("iDy").value;
  }));
  $("iFile").onchange = async (e) => {
    const files = [...e.target.files].slice(0, 15);
    if (!files.length) return;
    photos = await Promise.all(files.map((f) => new Promise((res) => {
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => res({ img, url, zoom: 1, dx: 0, dy: 0 });
      img.src = url;
    })));
    photoIdx = 0; syncPhotoControls(); renderThumbs(); render();
  };

  /** 把每张照片画好并量化，返回要发给屏幕的图像数据 */
  function photoFrames() {
    const c = document.createElement("canvas"); c.width = Cards.W; c.height = Cards.H;
    const x = c.getContext("2d", { willReadFrequently: true });
    return photos.map((p) => {
      Cards.drawImage(x, p.img, p);
      return Cards.quantize(x, { dither: $("iDither").checked, useRed: false });
    });
  }

  // ---------- 设备 ----------
  const ink = new EPD.InkDevice(log);
  function refreshConn() {
    const on = ink.connected;
    $("dot").classList.toggle("on", on);
    $("connTitle").textContent = on ? ink.device.name : "未连接";
    const d = ink.info;
    let sub = desktop ? "点击连接，会自动找到 NRF_EPD_ 开头的屏幕" : "点击连接，在弹窗里选择 NRF_EPD_ 开头的设备";
    if (on) {
      sub = d ? d.name : (ink.driver != null ? `未支持的驱动 0x${ink.driver.toString(16)}` : "已连接");
      if (ink.slotCount) sub += ` · ${ink.slotCount} 个图片槽位`;
      if (ink.battery) sub += ` · 电量 ${EPD.batteryPercent(ink.battery)}%`;
    } else if (ink.device) sub = "已断开，点击「重新连接」";
    $("connSub").textContent = sub;
    $("statDevice").textContent = on ? ink.device.name : "未连接";
    $("statDeviceSub").textContent = on ? (d ? d.name : "已连接") : (ink.device ? "已断开，可在下方重新连接" : "在下方「设备」里点连接");
    const slots = ink.slotCount ? `${ink.slotCount} 个图片槽位` : "无图片槽位";
    if (on && ink.battery) {
      const pct = EPD.batteryPercent(ink.battery);
      $("statBattery").textContent = `${pct}%`;
      $("statBattery").style.color = pct <= 20 ? "var(--warn)" : "";
      $("statBatterySub").textContent = `${(ink.battery / 1000).toFixed(2)} V · ${slots}${pct <= 20 ? " · 电量低，记得换电池" : ""}`;
    } else if (on) {
      $("statBattery").textContent = ink.timeReported ? "固件未提供" : "读取中…";
      $("statBattery").style.color = "";
      $("statBatterySub").textContent = ink.timeReported ? `这块屏不通过蓝牙报告电量，可切到屏幕自带日历查看 · ${slots}` : slots;
    } else {
      $("statBattery").textContent = "—"; $("statBattery").style.color = "";
      $("statBatterySub").textContent = "连接后显示";
    }
    $("btnConnect").textContent = on ? "已连接" : ink.device ? "重新连接" : "连接";
    $("btnConnect").disabled = on || busy || !navigator.bluetooth;
    ["btnCalendar", "btnClear", "btnDisconnect", "btnSend", "btnStopSlide"].forEach((id) => ($(id).disabled = !on || busy));
    $("btnSlide").disabled = !on || busy || photos.length < 2;
  }
  ink.onchange = refreshConn;
  ink.onprogress = (i, n) => showScan("", `<span class="spin"></span>正在连接 <b>${ink.device ? ink.device.name : "墨水屏"}</b>…${i > 1 ? `（第 ${i}/${n} 次尝试，这块屏常要多试几次）` : ""}`);

  async function guard(fn, okMsg) {
    busy = true; refreshConn();
    try { await fn(); if (okMsg) log(okMsg); return true; }
    catch (e) {
      if (e && e.name === "BluetoothOff") log("蓝牙不可用");
      else if (e && e.name === "NotFoundError") {
        log("没有找到或没有选择设备");
        // 桌面版：扫描超时会自己给出原因；如果连扫描都没开始，说明蓝牙没权限或没打开
        if (desktop && !$("scanBox").classList.contains("bad")) showScan("bad", NO_PERMISSION);
        if (!desktop) hideScan();
      }
      else {
        log("出错：" + (e && e.message || e));
        $("logBox").open = true;
        if (!autoRunning) showScan("bad", `<b>出错了</b><div>${String(e && e.message || e).replace(/</g, "&lt;")}</div><div class="hint">详细信息见右侧「运行日志」</div>`);
      }
      return false;
    } finally { busy = false; refreshConn(); }
  }

  async function ensureConnected() {
    if (ink.connected) return;
    if (ink.device) { try { await ink.reconnect(); hideScan(); return; } catch (e) { log("重连失败，重新搜索设备…"); } }
    // 先确认蓝牙可用：Mac 蓝牙关着，或者 App 没有蓝牙权限时，这里会是 false
    let available = true;
    try { available = await Promise.race([navigator.bluetooth.getAvailability(), sleep(1500).then(() => true)]); } catch (e) {}
    if (!available) {
      showScan("bad", desktop ? BT_OFF_DESKTOP : BT_OFF_WEB);
      const err = new Error("蓝牙不可用"); err.name = "BluetoothOff"; throw err;
    }
    if (!desktop) showScan("", '<span class="spin"></span>请在浏览器弹窗里选择 <b>NRF_EPD_</b> 开头的设备');
    try {
      await ink.connect("NRF_EPD_", { scanAll: !!desktop });
      showScan("good", `✅ 已连接 ${ink.device.name}`);
      setTimeout(hideScan, 4000);
    } catch (e) {
      if (!desktop) hideScan();
      throw e;
    }
  }

  // ---------- 扫描提示 ----------
  function showScan(kind, html) { const b = $("scanBox"); b.className = "scan show " + (kind || ""); b.innerHTML = html; }
  function hideScan() { $("scanBox").className = "scan"; }
  const NO_PERMISSION = `<b>没有扫描到任何蓝牙设备</b>
    <div>多半是 Daily Ink 还没有蓝牙权限：</div>
    <ol><li>打开「系统设置 → 隐私与安全性 → 蓝牙」</li><li>找到 <b>Daily Ink</b> 并打开开关（列表里没有就点「+」添加「应用程序」里的 Daily Ink）</li><li>完全退出 Daily Ink（菜单栏小黑猫 → 退出），再重新打开</li></ol>
    <div>也请确认 Mac 的蓝牙是打开的。</div>`;
  const BT_OFF_DESKTOP = `<b>蓝牙不可用</b>
    <ol><li>确认 Mac 的蓝牙已打开（屏幕右上角控制中心 → 蓝牙）</li><li>打开「系统设置 → 隐私与安全性 → 蓝牙」，把 <b>Daily Ink</b> 的开关打开（没有就点「+」添加）</li><li>完全退出 Daily Ink（菜单栏小黑猫 → 退出），再重新打开</li></ol>`;
  const BT_OFF_WEB = `<b>蓝牙不可用</b><div>请确认电脑的蓝牙已打开，并允许浏览器使用蓝牙。</div>`;
  const NO_SCREEN = (n) => `<b>扫描到 ${n} 个蓝牙设备，但没有找到墨水屏</b>
    <ol><li>屏幕可能正被别的设备连着（手机、网页、终端脚本），先断开它们</li><li>屏幕离电脑太远，或者没电了</li><li>按一下屏幕背面的按钮唤醒它，再点连接</li></ol>`;

  if (desktop && desktop.onScan) {
    let lastTotal = 0;
    desktop.onScan((m) => {
      if (m.phase === "start") { lastTotal = 0; showScan("", '<span class="spin"></span>正在扫描附近的蓝牙设备…'); log("开始扫描蓝牙设备"); }
      else if (m.phase === "update") {
        lastTotal = m.total;
        const names = m.named.map((d) => d.name).filter(Boolean);
        const others = names.length ? `已发现：${names.slice(0, 6).join("、")}${names.length > 6 ? " 等" : ""}` : "";
        showScan("", `<span class="spin"></span>正在寻找墨水屏…已扫描到 ${m.total} 个设备<div class="hint">${others}</div>
          ${m.named.length ? '<div class="hint">如果你的屏幕名字不是 NRF_EPD_ 开头，点它手动连接：</div><div class="devlist">' +
            m.named.slice(0, 12).map((d) => `<button class="chip" data-dev="${d.id}">${d.name.replace(/</g, "&lt;")}</button>`).join("") + "</div>" : ""}`);
        $("scanBox").querySelectorAll("[data-dev]").forEach((b) => (b.onclick = () => desktop.chooseDevice(b.dataset.dev)));
      } else if (m.phase === "picked") { log(`找到墨水屏：${m.name}，正在连接…`); showScan("", `<span class="spin"></span>找到 <b>${m.name}</b>，正在连接…`); }
      else if (m.phase === "timeout") {
        log(m.total ? `扫描到 ${m.total} 个设备，但没有墨水屏` : "没有扫描到任何蓝牙设备（可能缺少蓝牙权限）");
        showScan("bad", m.total ? NO_SCREEN(m.total) : NO_PERMISSION);
      }
    });
  }

  async function sendCurrent() {
    $("bar").style.width = "0";
    const img = ctx.getImageData(0, 0, Cards.W, Cards.H);
    const t0 = Date.now();
    log("开始发送…");
    await ink.sendImage(img, (p) => ($("bar").style.width = p + "%"));
    $("bar").style.width = "100%";
    log(`发送完成，用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒，屏幕正在刷新`);
  }

  $("btnConnect").onclick = () => guard(ensureConnected);
  $("btnDisconnect").onclick = () => { ink.disconnect(); refreshConn(); };
  $("btnCalendar").onclick = () => confirm("切换到屏幕自带的日历模式？") && guard(() => ink.calendarMode(), "已切换到日历模式，屏幕稍后刷新");
  // 月历：一键让屏幕用自带日历每天零点自己翻页（没连接就先连上）
  $("cAutoScreen").onclick = () => guard(async () => { await ensureConnected(); await ink.calendarMode(); },
    "已开启：屏幕会用自带日历，每天零点自己翻页，不需要电脑");
  $("btnClear").onclick = () => confirm("确定清除屏幕内容？") && guard(() => ink.clear(), "已发送清屏指令");
  $("btnSend").onclick = () => guard(sendCurrent);
  $("btnSlide").onclick = () => {
    const min = +$("iInterval").value || 1440;
    if (!confirm(`把 ${Math.min(photos.length, ink.slotCount || photos.length)} 张图存进屏幕，每 ${min} 分钟换一张？\n这是实验功能，存图过程需要一两分钟，请保持连接。`)) return;
    guard(() => ink.slideshow(photoFrames(), min, (p) => ($("bar").style.width = p + "%")), "轮播设置完成");
  };
  $("btnStopSlide").onclick = () => guard(() => ink.stopSlideshow(), "已停止轮播（间隔调为最长），屏幕保持当前画面");

  // ---------- 表单事件 ----------
  document.querySelectorAll(".tab").forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
  document.querySelectorAll("[data-status]").forEach((b) => (b.onclick = () => {
    const [t, s] = b.dataset.status.split("|"); $("sTitle").value = t; $("sSub").value = s; render();
  }));
  document.querySelectorAll('input[name="fMode"]').forEach((r) => (r.onchange = () => { syncFortuneMode(); render(); }));
  function syncFortuneMode() {
    const p = fMode() === "pillars";
    $("fBirthBox").style.display = p ? "none" : "grid";
    $("fPillarsBox").style.display = p ? "grid" : "none";
  }
  $("dShuffle").onclick = () => { shuffle++; $("dText").value = ""; render(); };
  document.querySelectorAll("input, textarea, select").forEach((el) => {
    if (el.id === "iFile" || el.name === "fMode" || el.id.startsWith("a")) return;
    el.addEventListener("input", render);
  });

  // ---------- 桌面版：备忘录与每日自动更新 ----------
  let autoRunning = false;
  if (desktop) {
    $("tFromNotes").onclick = async () => {
      const name = $("tNoteName").value.trim();
      if (!name) { alert("请先填写备忘录里那条笔记的标题"); return; }
      try {
        const text = await desktop.readNote(name);
        $("tText").value = text; log(`已从备忘录「${name}」读取 ${text.split("\n").filter(Boolean).length} 行`);
        render();
      } catch (e) { alert("读取备忘录失败：" + (e.message || e)); }
    };

    const pushSchedule = () => {
      save();
      desktop.setSchedule({ enabled: $("aEnable").checked, time: $("aTime").value || "10:00" });
      desktop.setLoginItem($("aLogin").checked);
      showLast();
    };
    ["aEnable", "aTime", "aCard", "aLogin"].forEach((id) => $(id).addEventListener("change", pushSchedule));

    // 月历：一键开启「每天零点后自动发送月历」，睡眠中错过的醒来补发
    $("cAutoDesktop").onclick = () => {
      $("aCard").value = "calendar"; $("aTime").value = "00:05"; $("aEnable").checked = true;
      pushSchedule();
      log("已开启：每天 00:05 自动发送月历");
      $("autoBox").scrollIntoView({ behavior: "smooth", block: "center" });
    };

    // AI 专属签文的设置
    const aiMsg = (e) => String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, "");
    const setOptions = (list, ids) => { list.innerHTML = ""; ids.forEach((id) => list.appendChild(Object.assign(document.createElement("option"), { value: id }))); };
    function showAI(cfg, note) {
      aiEnabled = cfg.enabled && cfg.hasKey;
      const p = cfg.providers.find((x) => x.id === cfg.provider);
      if (!$("aiProvider").options.length) {
        cfg.providers.forEach((x) => $("aiProvider").appendChild(Object.assign(document.createElement("option"), { value: x.id, textContent: x.name })));
      }
      $("aiProvider").value = cfg.provider;
      $("aiEnable").checked = cfg.enabled;
      $("aiModel").value = cfg.model;
      setOptions($("aiModelList"), p.models);
      $("aiBase").value = cfg.base;
      $("aiBaseBox").style.display = cfg.provider === "custom" ? "" : "none";
      $("aiSite").textContent = cfg.provider === "custom" ? "填写服务商提供的 OpenAI 兼容接口地址和模型名。"
        : `接口地址：${p.base || "官方 SDK"}。还没有 key？到 ${p.site.replace("https://", "")} 注册后在控制台创建。`;
      $("aiKey").value = ""; $("aiKey").placeholder = cfg.hasKey ? "已保存（重新填写可替换）" : "粘贴你的 API key";
      $("aiForget").disabled = !cfg.hasKey;
      if (note) $("aiStatus").textContent = note;
    }
    const saveAI = (extra) => desktop.setAI({
      enabled: $("aiEnable").checked, provider: $("aiProvider").value, model: $("aiModel").value, base: $("aiBase").value, key: $("aiKey").value, ...extra,
    });
    desktop.getAI().then((cfg) => { showAI(cfg); render(); });
    // 切换服务商：显示这家之前保存过的模型和 key 状态
    $("aiProvider").onchange = async () => {
      showAI(await desktop.setAI({ enabled: $("aiEnable").checked, provider: $("aiProvider").value }), " ");
    };
    $("aiSave").onclick = async () => {
      try {
        const cfg = await saveAI();
        showAI(cfg, !cfg.enabled ? "已保存，目前使用内置签文。" : cfg.hasKey ? "已保存。点「用 AI 写这一天的签」试试看。" : "已保存。还需要填写 API key 才能使用。");
        render();
      } catch (e) { $("aiStatus").textContent = "保存失败：" + aiMsg(e); }
    };
    $("aiList").onclick = async () => {
      $("aiList").disabled = true;
      try {
        showAI(await saveAI());
        const ids = await desktop.aiModels();
        setOptions($("aiModelList"), ids);
        $("aiStatus").textContent = ids.length ? `找到 ${ids.length} 个模型，点「模型」输入框就能选。` : "没有找到可用的模型，可以直接手填模型名。";
      } catch (e) { $("aiStatus").textContent = "获取模型列表失败：" + aiMsg(e); }
      $("aiList").disabled = false;
    };
    $("aiForget").onclick = async () => {
      showAI(await saveAI({ enabled: false, key: "", clearKey: true }), "key 已从这台 Mac 删除。");
      render();
    };
    $("aiGen").onclick = async () => {
      const birth = birthInput();
      if (!birth) { $("aiStatus").textContent = "请先填写生日或八字。"; return; }
      if (!aiEnabled) { $("aiStatus").textContent = "请先勾选开启、填写 key，再点「保存设置」。"; return; }
      $("aiGen").disabled = true;
      $("aiStatus").innerHTML = '<span class="spin"></span>墨墨正在请 AI 写签，大约要十几秒…';
      try {
        await aiGenerate(birth, dateOf("fDay"));
        $("aiStatus").textContent = "写好啦，预览里就是 AI 写的签文。";
        log("AI 签文已生成");
        render();
      } catch (e) {
        $("aiStatus").textContent = "这次没写成：" + aiMsg(e);
        log("AI 签文失败：" + aiMsg(e));
      }
      $("aiGen").disabled = false;
    };
    $("aRunNow").onclick = () => runScheduled(true);

    function showLast() {
      const s = store().lastRun;
      const plan = $("aEnable").checked ? `已开启：每天 ${$("aTime").value} 发送「${$("aCard").selectedOptions[0].text}」。` : "未开启。";
      $("aStatus").textContent = plan + (s ? ` 上次运行：${s.at}，${s.ok ? "成功" : "失败（" + s.err + "）"}` : "");
      $("statAuto").textContent = $("aEnable").checked ? `每天 ${$("aTime").value}` : "未开启";
      $("statAutoSub").textContent = $("aEnable").checked
        ? `发送「${$("aCard").selectedOptions[0].text}」` + (s ? ` · 上次${s.ok ? "成功" : "失败"}` : "")
        : "在右侧「每日自动更新」里开启";
    }

    /** 由桌面 App 在设定时间调用（带用户手势，可以自动连接蓝牙） */
    async function runScheduled(manual) {
      if (autoRunning) return;
      autoRunning = true;
      const kind = $("aCard").value;
      log(`${manual ? "手动" : "定时"}运行：发送「${$("aCard").selectedOptions[0].text}」`);
      let err = "";
      try {
        if (kind === "todo" && $("tNoteName").value.trim()) {
          try { $("tText").value = await desktop.readNote($("tNoteName").value.trim()); }
          catch (e) { log("读取备忘录失败，使用上次的待办：" + (e.message || e)); }
        }
        if (kind === "fortune" && !birthInput()) throw new Error("还没填写出生日期，请在「运势签」里填好");
        if (kind === "fortune" && aiEnabled) {
          try { await aiGenerate(birthInput(), new Date()); log("AI 签文已生成"); }
          catch (e) { log("AI 签文失败，使用内置签文：" + aiMsg(e)); }
        }
        await drawCard(kind, new Date());
        let ok = false;
        for (let i = 1; i <= 3 && !ok; i++) {
          ok = await guard(async () => { await ensureConnected(); await sendCurrent(); });
          if (!ok) { err = "连接或发送失败"; await sleep(10000 * i); }
        }
        if (ok) { err = ""; log("等待屏幕刷新完成…"); await sleep(40000); ink.disconnect(); refreshConn(); }
      } catch (e) { err = e.message || String(e); }
      const s = store(); s.lastRun = { at: new Date().toLocaleString(), day: todayStr(), ok: !err, err };
      try { localStorage.setItem("daily-ink", JSON.stringify(s)); } catch (e) {}
      desktop.notify(err ? "今天的卡片没发出去" : "今天的卡片已发到墨水屏", err ? err + "，可以打开 Daily Ink 再试一次" : "");
      showLast();
      autoRunning = false;
      render();
    }
    window.__dailyInkRun = () => runScheduled(false);
    window.__dailyInkRanToday = () => (store().lastRun || {}).day === todayStr() && (store().lastRun || {}).ok;
    desktop.ready();
    setTimeout(pushSchedule, 0);
  }

  // 墨墨的图片加载好后重画一次预览
  if (window.Momo && Momo.frontImg && !Momo.frontImg.complete) Momo.frontImg.addEventListener("load", render);

  // ---------- 启动 ----------
  if (!navigator.bluetooth) $("unsupported").style.display = "block";
  ["fDay", "dDay", "cDay"].forEach((id) => ($(id).value = todayStr()));
  // 日期框默认跟着「今天」走：过了零点自动换成新的一天（自己选了别的日期就不动）
  let today = todayStr();
  setInterval(() => {
    const now = todayStr();
    if (now === today) return;
    ["fDay", "dDay", "cDay"].forEach((id) => { if ($(id).value === today) $(id).value = now; });
    today = now;
    render();
  }, 60 * 1000);
  load();
  syncFortuneMode();
  setTab(tab, true);
  refreshConn();
  render();
  if (document.fonts) document.fonts.ready.then(render);
})();
