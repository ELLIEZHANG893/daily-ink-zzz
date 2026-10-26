/* daily-ink-zzz · 页面逻辑 · by zzz (Ellie Zhang) · GPL-3.0 */
(function () {
  const $ = (id) => document.getElementById(id);
  const canvas = $("preview"), ctx = canvas.getContext("2d", { willReadFrequently: true });
  let tab = "fortune", photo = null, busy = false, renderSeq = 0;

  // ---------- 日志 ----------
  function log(msg) {
    const t = new Date().toTimeString().slice(0, 8);
    $("log").textContent += `${t}  ${msg}\n`;
    $("log").scrollTop = $("log").scrollHeight;
  }

  // ---------- 本地记住表单（只存在本浏览器） ----------
  const SAVE_IDS = ["fBirthDate", "fBirthTime", "fName", "sTitle", "sSub", "sBadge", "qText", "qAuthor"];
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem("daily-ink") || "{}");
      SAVE_IDS.forEach((id) => { if (s[id] != null) $(id).value = s[id]; });
      if (s.useRed != null) $("useRed").checked = s.useRed;
      if (s.tab) setTab(s.tab, true);
    } catch (e) {}
  }
  function save() {
    try {
      const s = { tab, useRed: $("useRed").checked };
      SAVE_IDS.forEach((id) => (s[id] = $(id).value));
      localStorage.setItem("daily-ink", JSON.stringify(s));
    } catch (e) {}
  }

  // ---------- 预览 ----------
  function todayStr(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async function render() {
    const seq = ++renderSeq;
    const useRed = $("useRed").checked;
    let dither = false;
    if (tab === "fortune") {
      const [y, m, d] = ($("fBirthDate").value || "2000-01-01").split("-").map(Number);
      const [h, mi] = ($("fBirthTime").value || "12:00").split(":").map(Number);
      const [ty, tm, td] = ($("fDay").value || todayStr()).split("-").map(Number);
      try {
        const r = Fortune.reading({ y, m, d, h, mi }, new Date(ty, tm - 1, td));
        const n = r.natal;
        $("fNatal").textContent = `八字：${n.pillars.join(" ")}　日主 ${n.dm}${n.dmWx}（${n.weak ? "偏弱" : "偏强"}），喜用 ${n.favorable.join("、")}`;
        await Cards.fontsReady(r.theme + r.line + r.yi.join("") + r.ji.join("") + r.lunar + r.note + ($("fName").value || ""));
        if (seq !== renderSeq) return;
        Cards.drawFortune(ctx, r, { useRed, name: $("fName").value.trim() });
      } catch (e) {
        Cards.drawStatus(ctx, { title: "日期有误", sub: "请检查出生日期和时间", badge: "!" });
        log("运势计算出错：" + e.message);
      }
    } else if (tab === "status") {
      const opt = { title: $("sTitle").value, sub: $("sSub").value, badge: $("sBadge").value, useRed };
      await Cards.fontsReady(opt.title + opt.sub + opt.badge + "更新于月日");
      if (seq !== renderSeq) return;
      Cards.drawStatus(ctx, opt);
    } else if (tab === "quote") {
      const opt = { text: $("qText").value, author: $("qAuthor").value.trim(), useRed };
      await Cards.fontsReady(opt.text + opt.author + "“——");
      if (seq !== renderSeq) return;
      Cards.drawQuote(ctx, opt);
    } else {
      Cards.drawImage(ctx, photo, { zoom: +$("iZoom").value, dx: +$("iDx").value, dy: +$("iDy").value });
      dither = $("iDither").checked && !!photo;
    }
    Cards.quantize(ctx, { dither, useRed: useRed && !dither });
    save();
  }

  function setTab(name, silent) {
    tab = name;
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    document.querySelectorAll(".form").forEach((f) => f.classList.toggle("active", f.dataset.form === name));
    if (!silent) render();
  }

  // ---------- 设备 ----------
  const ink = new EPD.InkDevice(log);
  function refreshConn() {
    const on = ink.connected;
    $("dot").classList.toggle("on", on);
    $("connTitle").textContent = on ? ink.device.name : "未连接";
    const d = ink.info;
    let sub = "点击连接，在弹窗里选择 NRF_EPD_ 开头的设备";
    if (on) {
      sub = d ? d.name : (ink.driver != null ? `未支持的驱动 0x${ink.driver.toString(16)}` : "已连接");
      if (ink.battery) sub += ` · 电池 ${(ink.battery / 1000).toFixed(2)}V`;
    } else if (ink.device) sub = "已断开，点击「重新连接」";
    $("connSub").textContent = sub;
    $("btnConnect").textContent = on ? "已连接" : ink.device ? "重新连接" : "连接";
    $("btnConnect").disabled = on || busy || !navigator.bluetooth;
    ["btnCalendar", "btnClear", "btnDisconnect", "btnSend"].forEach((id) => ($(id).disabled = !on || busy));
  }
  ink.onchange = refreshConn;

  async function guard(fn, okMsg) {
    busy = true; refreshConn();
    try { await fn(); if (okMsg) log(okMsg); }
    catch (e) {
      if (e && e.name === "NotFoundError") log("没有选择设备");
      else { log("出错：" + (e && e.message || e)); alert(e && e.message || String(e)); }
    } finally { busy = false; refreshConn(); }
  }

  $("btnConnect").onclick = () => guard(() => (ink.device ? ink.reconnect() : ink.connect()));
  $("btnDisconnect").onclick = () => { ink.disconnect(); refreshConn(); };
  $("btnCalendar").onclick = () => confirm("切换到屏幕自带的日历模式？") && guard(() => ink.calendarMode(), "已切换到日历模式，屏幕稍后刷新");
  $("btnClear").onclick = () => confirm("确定清除屏幕内容？") && guard(() => ink.clear(), "已发送清屏指令");
  $("btnSend").onclick = () => guard(async () => {
    $("bar").style.width = "0";
    const img = ctx.getImageData(0, 0, Cards.W, Cards.H);
    const t0 = Date.now();
    log("开始发送…");
    await ink.sendImage(img, (p) => ($("bar").style.width = p + "%"));
    $("bar").style.width = "100%";
    log(`发送完成，用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒，屏幕正在刷新`);
  });

  // ---------- 表单事件 ----------
  document.querySelectorAll(".tab").forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
  document.querySelectorAll("[data-status]").forEach((b) => (b.onclick = () => {
    const [t, s] = b.dataset.status.split("|"); $("sTitle").value = t; $("sSub").value = s; render();
  }));
  document.querySelectorAll("input, textarea").forEach((el) => {
    if (el.id === "iFile") return;
    el.addEventListener("input", render);
  });
  $("iFile").onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => { photo = img; ["iDx", "iDy"].forEach((id) => ($(id).value = 0)); $("iZoom").value = 1; render(); };
    img.src = URL.createObjectURL(f);
  };

  // ---------- 启动 ----------
  if (!navigator.bluetooth) { $("unsupported").style.display = "block"; $("btnConnect").disabled = true; }
  $("fDay").value = todayStr();
  load();
  setTab(tab, true);
  refreshConn();
  render();
  if (document.fonts) document.fonts.ready.then(render);
})();
