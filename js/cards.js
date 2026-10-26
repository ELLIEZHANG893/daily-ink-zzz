/*
 * 400x300 卡片模板：运势签 / 状态牌 / 文字卡片 / 图片
 * 只用三种颜色：黑 #000、白 #fff、红 #f00（三色屏会显示红色，黑白屏红色会变成白）
 * daily-ink-zzz · by zzz (Ellie Zhang) · GPL-3.0
 */
(function (root) {
  const W = 400, H = 300;
  const SERIF = '"Noto Serif SC", "Songti SC", serif';
  const SANS = '"Noto Sans SC", "PingFang SC", sans-serif';
  const INK = "#000", PAPER = "#fff", RED = "#f00";

  async function fontsReady(samples) {
    if (!document.fonts) return;
    const jobs = [];
    for (const f of [`900 64px ${SERIF}`, `700 18px ${SANS}`, `500 15px ${SANS}`])
      jobs.push(document.fonts.load(f, samples || "今日运势签宜忌0123456789"));
    try { await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 4000))]); } catch (e) {}
  }

  function base(ctx) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "top";
  }

  function frame(ctx) {
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(5, 5, W - 10, H - 10);
    ctx.lineWidth = 1; ctx.strokeRect(10.5, 10.5, W - 21, H - 21);
  }

  function star(ctx, cx, cy, R, filled, color) {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? R * 0.45 : R;
      ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
    if (filled) { ctx.fillStyle = color; ctx.fill(); } else { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); }
  }

  function centerText(ctx, text, y, font, color) {
    ctx.font = font; ctx.fillStyle = color || INK;
    ctx.fillText(text, (W - ctx.measureText(text).width) / 2, y);
  }

  function wrap(ctx, text, maxW) {
    const lines = [];
    for (const para of String(text).split("\n")) {
      let line = "";
      for (const ch of para) {
        if (ctx.measureText(line + ch).width > maxW && line) {
          if ("，。！？、；：”）》…".includes(ch)) { lines.push(line.slice(0, -1)); line = line.slice(-1) + ch; }
          else { lines.push(line); line = ch; }
        } else line += ch;
      }
      lines.push(line);
    }
    return lines;
  }

  /** 运势签 */
  function drawFortune(ctx, r, opt) {
    const accent = opt.useRed ? RED : INK;
    base(ctx); frame(ctx);
    const d = r.date;
    ctx.fillStyle = INK;
    ctx.font = `500 15px ${SANS}`; ctx.fillText(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`, 22, 18);
    ctx.font = `900 66px ${SERIF}`; ctx.fillText(String(d.getDate()).padStart(2, "0"), 18, 32);
    ctx.font = `500 15px ${SANS}`;
    ctx.fillText(`周${r.week} ${r.lunar}`, 22, 108);
    ctx.fillText(`${r.gz}日${r.jieqi ? " · " + r.jieqi : ""}`, 22, 128);

    ctx.fillRect(155, 22, 1, 126);
    const x0 = 170;
    ctx.font = `500 15px ${SANS}`; ctx.fillText(opt.name ? `${opt.name}的今日运势签` : "今日运势签", x0, 18);
    ctx.font = `900 27px ${SERIF}`; ctx.fillText(r.theme, x0, 38);
    ctx.font = `700 18px ${SANS}`; ctx.fillText(`${r.god}日`, x0, 76);
    for (let i = 0; i < 5; i++) star(ctx, x0 + 11 + i * 30, 117, 11, i < r.stars, accent);
    if (r.note) { ctx.fillStyle = INK; ctx.font = `500 13px ${SANS}`; ctx.fillText(r.note, x0, 132); }

    ctx.fillStyle = INK; ctx.fillRect(20, 156, W - 40, 2);
    const tag = (y, ch, color) => {
      ctx.fillStyle = color; ctx.fillRect(20, y, 26, 26);
      ctx.fillStyle = PAPER; ctx.font = `700 18px ${SANS}`; ctx.fillText(ch, 24, y + 2);
    };
    tag(166, "宜", accent);
    ctx.fillStyle = INK; ctx.font = `700 18px ${SANS}`; ctx.fillText(r.yi.slice(0, 3).join("  "), 56, 168);
    tag(200, "忌", INK);
    ctx.fillStyle = INK; ctx.fillText(r.ji.slice(0, 2).join("  "), 56, 202);
    ctx.font = `500 15px ${SANS}`;
    ctx.fillText(`幸运色 ${r.color}   方位 ${r.direction}   数字 ${r.num}`, 20, 236);
    ctx.fillRect(20, 260, W - 40, 1);
    centerText(ctx, r.line, 267, `500 15px ${SANS}`, INK);
  }

  /** 状态牌 */
  function drawStatus(ctx, opt) {
    base(ctx);
    const accent = opt.useRed ? RED : INK;
    ctx.fillStyle = accent; ctx.fillRect(0, 0, W, 54);
    centerText(ctx, opt.badge || "STATUS", 14, `700 22px ${SANS}`, PAPER);
    ctx.font = `900 56px ${SERIF}`;
    let size = 56;
    while (ctx.measureText(opt.title).width > W - 40 && size > 24) { size -= 2; ctx.font = `900 ${size}px ${SERIF}`; }
    centerText(ctx, opt.title || "", 150 - size / 2, `900 ${size}px ${SERIF}`, INK);
    if (opt.sub) centerText(ctx, opt.sub, 196, `500 18px ${SANS}`, INK);
    ctx.fillStyle = INK; ctx.fillRect(40, 244, W - 80, 1);
    const t = new Date();
    centerText(ctx, `更新于 ${t.getMonth() + 1}月${t.getDate()}日 ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`, 256, `500 14px ${SANS}`, INK);
  }

  /** 文字卡片 */
  function drawQuote(ctx, opt) {
    base(ctx); frame(ctx);
    ctx.fillStyle = opt.useRed ? RED : INK;
    ctx.font = `900 72px ${SERIF}`; ctx.fillText("“", 24, 6);
    let size = 26, lines;
    for (;;) {
      ctx.font = `700 ${size}px ${SERIF}`;
      lines = wrap(ctx, opt.text || "", W - 80);
      if (lines.length * size * 1.5 <= 170 || size <= 14) break;
      size -= 2;
    }
    ctx.fillStyle = INK;
    const lh = size * 1.5, top = 60 + (170 - lines.length * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, 40, top + i * lh));
    if (opt.author) {
      ctx.font = `500 15px ${SANS}`;
      const s = `—— ${opt.author}`;
      ctx.fillText(s, W - 36 - ctx.measureText(s).width, 250);
    }
  }

  /** 每日一句：左边小黑猫墨墨，右边当天的一句话 */
  function drawDaily(ctx, opt) {
    const accent = opt.useRed ? RED : INK;
    const d = opt.date || new Date();
    base(ctx); frame(ctx);
    root.Momo.drawMomo(ctx, 92, 118, 1.05, accent);
    ctx.fillStyle = INK; ctx.font = `700 15px ${SANS}`;
    centerTextAt(ctx, "—— 墨墨说", 92, 236, `700 15px ${SANS}`, INK);
    // 日期
    ctx.font = `900 30px ${SERIF}`; ctx.fillStyle = INK;
    ctx.fillText(`${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`, 196, 26);
    ctx.font = `500 14px ${SANS}`;
    ctx.fillText(`周${"日一二三四五六"[d.getDay()]}${opt.lunar ? " · " + opt.lunar : ""}`, 198, 64);
    ctx.fillStyle = accent; ctx.fillRect(198, 88, 28, 3);
    // 一句话
    let size = 22, lines;
    for (;;) {
      ctx.font = `700 ${size}px ${SERIF}`;
      lines = wrap(ctx, opt.text || "", 168);
      if (lines.length * size * 1.55 <= 150 || size <= 14) break;
      size -= 1;
    }
    ctx.fillStyle = INK;
    lines.forEach((l, i) => ctx.fillText(l, 198, 106 + i * size * 1.55));
    ctx.font = `500 12px ${SANS}`;
    ctx.fillText("Daily Ink", W - 22 - ctx.measureText("Daily Ink").width, 268);
  }

  function centerTextAt(ctx, text, cx, y, font, color) {
    ctx.font = font; ctx.fillStyle = color;
    ctx.fillText(text, cx - ctx.measureText(text).width / 2, y);
  }

  /** 月历：整月日历，今天用红圈标出 */
  function drawCalendar(ctx, opt) {
    const accent = opt.useRed ? RED : INK;
    const d = opt.date || new Date();
    const y = d.getFullYear(), m = d.getMonth();
    base(ctx);
    // 左侧大日期
    ctx.fillStyle = accent; ctx.fillRect(0, 0, 128, H);
    centerTextAt(ctx, `${y}年`, 64, 22, `700 16px ${SANS}`, PAPER);
    centerTextAt(ctx, `${m + 1}月`, 64, 44, `700 22px ${SANS}`, PAPER);
    centerTextAt(ctx, String(d.getDate()), 64, 86, `900 72px ${SERIF}`, PAPER);
    centerTextAt(ctx, `星期${"日一二三四五六"[d.getDay()]}`, 64, 174, `700 18px ${SANS}`, PAPER);
    if (opt.lunar) centerTextAt(ctx, opt.lunar.replace("农历", ""), 64, 204, `700 16px ${SANS}`, PAPER);
    if (opt.gz) centerTextAt(ctx, opt.gz, 64, 228, `700 16px ${SANS}`, PAPER);
    if (opt.jieqi) centerTextAt(ctx, `「${opt.jieqi}」`, 64, 254, `700 16px ${SANS}`, PAPER);
    // 右侧月格
    const weekStart = opt.weekStart ?? 1; // 1 = 周一开头
    const names = weekStart === 1 ? "一二三四五六日" : "日一二三四五六";
    const x0 = 140, cw = 36, top = 40, rh = 40;
    for (let i = 0; i < 7; i++) centerTextAt(ctx, names[i], x0 + cw * i + cw / 2, 16, `700 13px ${SANS}`, INK);
    ctx.fillStyle = INK; ctx.fillRect(x0 + 4, 36, cw * 7 - 8, 1);
    const first = new Date(y, m, 1).getDay();
    const offset = (first - weekStart + 7) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const rows = Math.ceil((offset + days) / 7);
    const rowH = Math.min(rh, (H - top - 6) / rows);
    for (let day = 1; day <= days; day++) {
      const idx = offset + day - 1, col = idx % 7, row = Math.floor(idx / 7);
      const cx = x0 + cw * col + cw / 2, cy = top + rowH * row + rowH / 2;
      const isToday = day === d.getDate();
      const weekend = (col === (weekStart === 1 ? 5 : 0)) || (col === (weekStart === 1 ? 6 : 6));
      if (isToday) {
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.fill();
        centerTextAt(ctx, String(day), cx, cy - 9, `700 17px ${SANS}`, PAPER);
      } else {
        centerTextAt(ctx, String(day), cx, cy - 9, `${weekend ? 700 : 500} 17px ${SANS}`, INK);
      }
    }
  }

  /** 待办清单 */
  function drawTodo(ctx, opt) {
    const accent = opt.useRed ? RED : INK;
    const d = opt.date || new Date();
    base(ctx); frame(ctx);
    ctx.fillStyle = INK; ctx.font = `900 26px ${SERIF}`;
    ctx.fillText(opt.title || "今日待办", 24, 20);
    ctx.font = `500 14px ${SANS}`;
    const ds = `${d.getMonth() + 1}月${d.getDate()}日 周${"日一二三四五六"[d.getDay()]}`;
    ctx.fillText(ds, W - 24 - ctx.measureText(ds).width, 30);
    ctx.fillStyle = accent; ctx.fillRect(24, 58, W - 48, 2);
    const items = (opt.items || []).filter((s) => s.text.trim()).slice(0, 7);
    const lh = items.length > 5 ? 30 : 36;
    ctx.font = `700 17px ${SANS}`;
    items.forEach((it, i) => {
      const y = 72 + i * lh;
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(26, y + 2, 18, 18);
      if (it.done) {
        ctx.strokeStyle = accent; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(29, y + 11); ctx.lineTo(34, y + 17); ctx.lineTo(43, y + 4); ctx.stroke();
      }
      ctx.fillStyle = INK; ctx.font = `700 17px ${SANS}`;
      let t = it.text.trim();
      while (ctx.measureText(t).width > W - 90 && t.length > 1) t = t.slice(0, -1);
      if (t !== it.text.trim()) t = t.slice(0, -1) + "…";
      ctx.fillText(t, 56, y + 1);
      if (it.done) { ctx.fillRect(56, y + 11, ctx.measureText(t).width, 1.5); }
    });
    if (!items.length) centerText(ctx, "今天没有待办，好好休息～", 140, `500 17px ${SANS}`, INK);
    const left = items.filter((i) => !i.done).length;
    ctx.font = `500 13px ${SANS}`; ctx.fillStyle = INK;
    const foot = items.length ? `还剩 ${left} 件 · 共 ${items.length} 件` : "";
    ctx.fillText(foot, 24, 266);
  }

  /** 解析待办文本：每行一件；以 [x]、√、✓ 开头的算已完成 */
  function parseTodos(text) {
    return String(text).split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const done = /^(\[x\]|\[X\]|√|✓|✔)/.test(l);
      return { done, text: l.replace(/^(\[[ xX]?\]|[-*•·]|√|✓|✔|☐|☑|\d+[.、)])\s*/, "") };
    });
  }

  /** 图片：裁剪铺满 400x300 */
  function drawImage(ctx, img, opt) {
    base(ctx);
    if (!img) { centerText(ctx, "选择一张图片", 140, `500 18px ${SANS}`, INK); return; }
    const s = Math.max(W / img.width, H / img.height) * (opt.zoom || 1);
    const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, (W - w) / 2 + (opt.dx || 0), (H - h) / 2 + (opt.dy || 0), w, h);
  }

  /**
   * 把画布量化成屏幕真正能显示的三种颜色。
   * dither=true 用 Floyd-Steinberg 抖动（适合照片），否则直接阈值（适合文字）。
   */
  function quantize(ctx, { dither, useRed }) {
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    const gray = new Float32Array(W * H), isRed = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      if (useRed && r > 160 && r > g + 40 && r > b + 40) isRed[i] = 1;
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!dither) {
        // 文字/卡片：取黑、白、红中最接近的颜色，红底白字的细笔画也能保留
        const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
        const dW = (255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2;
        const dK = 0.675 * (r * r + g * g + b * b); // 偏向黑色，相当于灰度阈值 140，细字更清楚
        const dR = useRed ? (255 - r) ** 2 + g * g + b * b : Infinity;
        const c = dR < dW && dR < dK ? [255, 0, 0] : dW <= dK ? [255, 255, 255] : [0, 0, 0];
        d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
        continue;
      }
      if (isRed[i]) { d[i * 4] = 255; d[i * 4 + 1] = 0; d[i * 4 + 2] = 0; continue; }
      const old = gray[i], v = old >= 128 ? 255 : 0;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      if (dither) {
        const e = old - v;
        if (x + 1 < W) gray[i + 1] += e * 7 / 16;
        if (y + 1 < H) {
          if (x > 0) gray[i + W - 1] += e * 3 / 16;
          gray[i + W] += e * 5 / 16;
          if (x + 1 < W) gray[i + W + 1] += e / 16;
        }
      }
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return img;
  }

  root.Cards = { W, H, fontsReady, drawFortune, drawStatus, drawQuote, drawDaily, drawCalendar, drawTodo, parseTodos, drawImage, quantize };
})(typeof globalThis !== "undefined" ? globalThis : this);
