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
  function birthInput() {
    if (fMode() === "pillars") return { pillars: $("fPillars").value };
    const [y, m, d] = ($("fBirthDate").value || "2000-01-01").split("-").map(Number);
    const [h, mi] = ($("fBirthTime").value || "12:00").split(":").map(Number);
    return { y, m, d, h, mi };
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
      try {
        const r = Fortune.reading(birthInput(), day);
        const n = r.natal;
        $("fNatal").textContent = `八字：${n.pillars.join(" ")}　日主 ${n.dm}${n.dmWx}（${n.weak ? "偏弱" : "偏强"}），喜用 ${n.favorable.join("、")}`;
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

  function setTab(name, silent) {
    tab = name;
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
      if (ink.battery) sub += ` · 电池 ${(ink.battery / 1000).toFixed(2)}V`;
    } else if (ink.device) sub = "已断开，点击「重新连接」";
    $("connSub").textContent = sub;
    $("btnConnect").textContent = on ? "已连接" : ink.device ? "重新连接" : "连接";
    $("btnConnect").disabled = on || busy || !navigator.bluetooth;
    ["btnCalendar", "btnClear", "btnDisconnect", "btnSend", "btnStopSlide"].forEach((id) => ($(id).disabled = !on || busy));
    $("btnSlide").disabled = !on || busy || photos.length < 2;
  }
  ink.onchange = refreshConn;

  async function guard(fn, okMsg) {
    busy = true; refreshConn();
    try { await fn(); if (okMsg) log(okMsg); return true; }
    catch (e) {
      if (e && e.name === "NotFoundError") log("没有找到或没有选择设备");
      else { log("出错：" + (e && e.message || e)); if (!autoRunning) alert(e && e.message || String(e)); }
      return false;
    } finally { busy = false; refreshConn(); }
  }

  async function ensureConnected() {
    if (ink.connected) return;
    if (ink.device) { try { await ink.reconnect(); return; } catch (e) { log("重连失败，重新搜索设备…"); } }
    await ink.connect();
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
    $("aRunNow").onclick = () => runScheduled(true);

    function showLast() {
      const s = store().lastRun;
      const plan = $("aEnable").checked ? `已开启：每天 ${$("aTime").value} 发送「${$("aCard").selectedOptions[0].text}」。` : "未开启。";
      $("aStatus").textContent = plan + (s ? ` 上次运行：${s.at}，${s.ok ? "成功" : "失败（" + s.err + "）"}` : "");
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

  // ---------- 启动 ----------
  if (!navigator.bluetooth) $("unsupported").style.display = "block";
  ["fDay", "dDay", "cDay"].forEach((id) => ($(id).value = todayStr()));
  load();
  syncFortuneMode();
  setTab(tab, true);
  refreshConn();
  render();
  if (document.fonts) document.fonts.ready.then(render);
})();
