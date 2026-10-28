/*
 * 卡片模板：运势签 / 每日一句 / 月历 / 待办 / 状态牌 / 文字卡片 / 图片
 * 适配不同尺寸的墨水屏：
 * - 4.2 寸（400×300）及更大的屏：用标准排版，按屏幕高度整体放大，宽屏的排版会跟着变宽
 * - 2.13 / 2.9 寸这类长条小屏（宽高比 > 2）：用专门的紧凑排版
 * 只用三种颜色：黑 #000、白 #fff、红 #f00（三色屏会显示红色，黑白屏红色会变成白）
 * daily-ink-zzz · by zzz (Ellie Zhang) · GPL-3.0
 */
(function (root) {
  const SERIF = '"Noto Serif SC", "Songti SC", serif';
  const SANS = '"Noto Sans SC", "PingFang SC", sans-serif';
  const INK = "#000", PAPER = "#fff", RED = "#f00";
  const WEEK = "日一二三四五六";
  const pad2 = (n) => String(n).padStart(2, "0");

  // 屏幕真实像素 PW×PH；排版用的尺寸 W×H（标准排版高 300，小屏紧凑排版高 128），画的时候整体缩放 S 倍
  let PW = 400, PH = 300, W = 400, H = 300, S = 1, OY = 0, small = false;
  function setSize(w, h) {
    PW = w; PH = h; OY = 0;
    small = w / h > 2;
    if (small) { H = 128; S = h / H; W = Math.round(w / S); }
    else if (w / h >= 4 / 3) { H = 300; S = h / H; W = Math.round(w / S); }
    else { W = 400; H = 300; S = w / W; OY = (h / S - H) / 2; } // 比 4:3 更方的屏：内容居中，上下留白
  }

  async function fontsReady(samples) {
    if (!document.fonts) return;
    const jobs = [];
    for (const f of [`900 64px ${SERIF}`, `700 18px ${SANS}`, `500 15px ${SANS}`])
      jobs.push(document.fonts.load(f, samples || "今日运势签宜忌0123456789"));
    try { await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 4000))]); } catch (e) {}
  }

  function base(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, PW, PH);
    ctx.setTransform(S, 0, 0, S, 0, OY * S);
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

  function centerTextAt(ctx, text, cx, y, font, color) {
    ctx.font = font; ctx.fillStyle = color;
    ctx.fillText(text, cx - ctx.measureText(text).width / 2, y);
  }

  /** 一行字放不下就缩小字号；返回最后用的字号 */
  function fitFont(ctx, text, maxW, weight, size, family, minSize = 9) {
    let s = size;
    ctx.font = `${weight} ${s}px ${family}`;
    while (ctx.measureText(text).width > maxW && s > minSize) { s--; ctx.font = `${weight} ${s}px ${family}`; }
    return s;
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

  /** 多行文字：从 size 往下缩，直到 maxLines 行、总高不超过 maxH */
  function fitWrap(ctx, text, maxW, maxH, weight, size, family, minSize, lh = 1.5) {
    let s = size, lines;
    for (;;) {
      ctx.font = `${weight} ${s}px ${family}`;
      lines = wrap(ctx, text, maxW);
      if (lines.length * s * lh <= maxH || s <= minSize) break;
      s--;
    }
    return { size: s, lines, lh: s * lh };
  }

  function drawMomoImg(ctx, x, y, bw, bh, cx, cy, s, accent) {
    const img = root.Momo.frontImg;
    if (img && img.complete && img.naturalWidth) {
      // 墨墨正面形象：放进 bw×bh 的区域底部，保持比例
      const sc = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
      const w = img.naturalWidth * sc, h = img.naturalHeight * sc;
      ctx.drawImage(img, x + (bw - w) / 2, y + (bh - h), w, h);
    } else {
      root.Momo.drawMomo(ctx, cx, cy, s, accent);
    }
  }

  /** 运势签 */
  function drawFortune(ctx, r, opt) {
    const accent = opt.useRed ? RED : INK;
    base(ctx);
    if (small) return fortuneSmall(ctx, r, opt, accent);
    frame(ctx);
    const d = r.date;
    ctx.fillStyle = INK;
    ctx.font = `500 15px ${SANS}`; ctx.fillText(`${d.getFullYear()}.${pad2(d.getMonth() + 1)}`, 22, 18);
    ctx.font = `900 66px ${SERIF}`; ctx.fillText(pad2(d.getDate()), 18, 32);
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

  function fortuneSmall(ctx, r, opt, accent) {
    const d = r.date;
    ctx.fillStyle = INK;
    ctx.font = `500 11px ${SANS}`; ctx.fillText(`${d.getFullYear()}.${pad2(d.getMonth() + 1)}`, 8, 6);
    ctx.font = `900 40px ${SERIF}`; ctx.fillText(pad2(d.getDate()), 6, 19);
    ctx.font = `500 11px ${SANS}`;
    ctx.fillText(`周${r.week} ${r.gz}日`, 8, 64);
    ctx.fillText(r.lunar.replace("农历", ""), 8, 79);
    ctx.fillRect(80, 8, 1, 82);
    const x0 = 88, maxW = W - x0 - 8;
    fitFont(ctx, r.theme, maxW, 900, 20, SERIF, 14); ctx.fillText(r.theme, x0, 5);
    for (let i = 0; i < 5; i++) star(ctx, x0 + 7 + i * 15, 39, 6.5, i < r.stars, accent);
    ctx.fillStyle = INK; ctx.font = `700 12px ${SANS}`; ctx.fillText(`${r.god}日`, x0 + 82, 32);
    const tag = (y, ch, color, items) => {
      ctx.fillStyle = color; ctx.fillRect(x0, y, 16, 16);
      ctx.fillStyle = PAPER; ctx.font = `700 12px ${SANS}`; ctx.fillText(ch, x0 + 2, y + 1);
      ctx.fillStyle = INK; fitFont(ctx, items, maxW - 22, 700, 12, SANS); ctx.fillText(items, x0 + 22, y + 1);
    };
    tag(52, "宜", accent, r.yi.slice(0, 3).join(" "));
    tag(72, "忌", INK, r.ji.slice(0, 2).join(" "));
    ctx.fillStyle = INK; ctx.fillRect(8, 97, W - 16, 1);
    const s = fitFont(ctx, r.line, W - 16, 500, 13, SANS);
    centerText(ctx, r.line, 104 + (13 - s) / 2, `500 ${s}px ${SANS}`, INK);
  }

  /** 状态牌 */
  function drawStatus(ctx, opt) {
    base(ctx);
    const accent = opt.useRed ? RED : INK;
    const t = new Date();
    const updated = `更新于 ${t.getMonth() + 1}月${t.getDate()}日 ${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
    if (small) {
      ctx.fillStyle = accent; ctx.fillRect(0, 0, W, 24);
      centerText(ctx, opt.badge || "STATUS", 5, `700 13px ${SANS}`, PAPER);
      const size = fitFont(ctx, opt.title || "", W - 20, 900, 38, SERIF, 16);
      centerText(ctx, opt.title || "", 56 - size / 2, `900 ${size}px ${SERIF}`, INK);
      if (opt.sub) { const s = fitFont(ctx, opt.sub, W - 20, 500, 13, SANS); centerText(ctx, opt.sub, 88, `500 ${s}px ${SANS}`, INK); }
      centerText(ctx, updated, 110, `500 10px ${SANS}`, INK);
      return;
    }
    ctx.fillStyle = accent; ctx.fillRect(0, 0, W, 54);
    centerText(ctx, opt.badge || "STATUS", 14, `700 22px ${SANS}`, PAPER);
    const size = fitFont(ctx, opt.title || "", W - 40, 900, 56, SERIF, 24);
    centerText(ctx, opt.title || "", 150 - size / 2, `900 ${size}px ${SERIF}`, INK);
    if (opt.sub) centerText(ctx, opt.sub, 196, `500 18px ${SANS}`, INK);
    ctx.fillStyle = INK; ctx.fillRect(40, 244, W - 80, 1);
    centerText(ctx, updated, 256, `500 14px ${SANS}`, INK);
  }

  /** 文字卡片 */
  function drawQuote(ctx, opt) {
    base(ctx);
    const accent = opt.useRed ? RED : INK;
    if (small) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(3, 3, W - 6, H - 6);
      ctx.fillStyle = accent; ctx.font = `900 40px ${SERIF}`; ctx.fillText("“", 10, 0);
      const f = fitWrap(ctx, opt.text || "", W - 48, opt.author ? 78 : 96, 700, 18, SERIF, 10, 1.45);
      const top = 22 + ((opt.author ? 78 : 96) - f.lines.length * f.lh) / 2;
      ctx.fillStyle = INK; f.lines.forEach((l, i) => ctx.fillText(l, 30, top + i * f.lh));
      if (opt.author) { ctx.font = `500 11px ${SANS}`; const s = `—— ${opt.author}`; ctx.fillText(s, W - 14 - ctx.measureText(s).width, H - 22); }
      return;
    }
    frame(ctx);
    ctx.fillStyle = accent;
    ctx.font = `900 72px ${SERIF}`; ctx.fillText("“", 24, 6);
    const f = fitWrap(ctx, opt.text || "", W - 80, 170, 700, 26, SERIF, 14);
    ctx.fillStyle = INK;
    const top = 60 + (170 - f.lines.length * f.lh) / 2;
    f.lines.forEach((l, i) => ctx.fillText(l, 40, top + i * f.lh));
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
    base(ctx);
    if (small) {
      drawMomoImg(ctx, 6, 6, 84, 116, 48, 66, 0.55, accent);
      const x0 = 98, maxW = W - x0 - 8;
      ctx.fillStyle = INK; ctx.font = `900 20px ${SERIF}`;
      ctx.fillText(`${d.getMonth() + 1}.${pad2(d.getDate())}`, x0, 7);
      const sub = `周${WEEK[d.getDay()]}${opt.lunar ? " · " + opt.lunar : ""}`;
      fitFont(ctx, sub, maxW, 500, 11, SANS); ctx.fillText(sub, x0, 32);
      ctx.fillStyle = accent; ctx.fillRect(x0, 50, 22, 2);
      const f = fitWrap(ctx, opt.text || "", maxW, 66, 700, 16, SERIF, 10, 1.45);
      ctx.fillStyle = INK; f.lines.forEach((l, i) => ctx.fillText(l, x0, 58 + i * f.lh));
      return;
    }
    frame(ctx);
    drawMomoImg(ctx, 17, 24, 150, 200, 92, 118, 1.05, accent);
    centerTextAt(ctx, "—— 墨墨说", 92, 236, `700 15px ${SANS}`, INK);
    // 日期
    ctx.font = `900 30px ${SERIF}`; ctx.fillStyle = INK;
    ctx.fillText(`${d.getMonth() + 1}.${pad2(d.getDate())}`, 196, 26);
    ctx.font = `500 14px ${SANS}`;
    ctx.fillText(`周${WEEK[d.getDay()]}${opt.lunar ? " · " + opt.lunar : ""}`, 198, 64);
    ctx.fillStyle = accent; ctx.fillRect(198, 88, 28, 3);
    // 一句话（屏幕越宽，这一栏越宽）
    const f = fitWrap(ctx, opt.text || "", W - 232, 150, 700, 22, SERIF, 14, 1.55);
    ctx.fillStyle = INK;
    f.lines.forEach((l, i) => ctx.fillText(l, 198, 106 + i * f.lh));
    ctx.font = `500 12px ${SANS}`;
    ctx.fillText("Daily Ink", W - 22 - ctx.measureText("Daily Ink").width, 268);
  }

  /** 月历：整月日历，今天用红圈标出 */
  function drawCalendar(ctx, opt) {
    const accent = opt.useRed ? RED : INK;
    const d = opt.date || new Date();
    const y = d.getFullYear(), m = d.getMonth();
    base(ctx);
    // 左侧大日期（小屏用窄一点的色块）
    const band = small ? 64 : 128, c = band / 2;
    ctx.fillStyle = accent; ctx.fillRect(0, 0, band, H);
    if (small) {
      centerTextAt(ctx, `${y}年${m + 1}月`, c, 8, `700 10px ${SANS}`, PAPER);
      centerTextAt(ctx, String(d.getDate()), c, 24, `900 38px ${SERIF}`, PAPER);
      centerTextAt(ctx, `星期${WEEK[d.getDay()]}`, c, 72, `700 11px ${SANS}`, PAPER);
      const extra = opt.jieqi ? `「${opt.jieqi}」` : (opt.lunar || "").replace("农历", "");
      if (extra) { const s = fitFont(ctx, extra, band - 6, 700, 10, SANS, 8); centerTextAt(ctx, extra, c, 92, `700 ${s}px ${SANS}`, PAPER); }
    } else {
      centerTextAt(ctx, `${y}年`, c, 22, `700 16px ${SANS}`, PAPER);
      centerTextAt(ctx, `${m + 1}月`, c, 44, `700 22px ${SANS}`, PAPER);
      centerTextAt(ctx, String(d.getDate()), c, 86, `900 72px ${SERIF}`, PAPER);
      centerTextAt(ctx, `星期${WEEK[d.getDay()]}`, c, 174, `700 18px ${SANS}`, PAPER);
      if (opt.lunar) centerTextAt(ctx, opt.lunar.replace("农历", ""), c, 204, `700 16px ${SANS}`, PAPER);
      if (opt.gz) centerTextAt(ctx, opt.gz, c, 228, `700 16px ${SANS}`, PAPER);
      if (opt.jieqi) centerTextAt(ctx, `「${opt.jieqi}」`, c, 254, `700 16px ${SANS}`, PAPER);
    }
    // 右侧月格（宽度随屏幕变化）
    const weekStart = opt.weekStart ?? 1; // 1 = 周一开头
    const names = weekStart === 1 ? "一二三四五六日" : "日一二三四五六";
    const x0 = band + (small ? 4 : 12), cw = (W - x0 - (small ? 4 : 8)) / 7;
    const head = small ? 3 : 16, line = small ? 16 : 36, top = small ? 18 : 40;
    const hf = small ? `700 10px ${SANS}` : `700 13px ${SANS}`;
    for (let i = 0; i < 7; i++) centerTextAt(ctx, names[i], x0 + cw * i + cw / 2, head, hf, INK);
    ctx.fillStyle = INK; ctx.fillRect(x0 + 4, line, cw * 7 - 8, 1);
    const first = new Date(y, m, 1).getDay();
    const offset = (first - weekStart + 7) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const rows = Math.ceil((offset + days) / 7);
    const rowH = Math.min(small ? 18 : 40, (H - top - (small ? 2 : 6)) / rows);
    const fs = small ? 11 : 17, rad = small ? 8 : 15;
    for (let day = 1; day <= days; day++) {
      const idx = offset + day - 1, col = idx % 7, row = Math.floor(idx / 7);
      const cx = x0 + cw * col + cw / 2, cy = top + rowH * row + rowH / 2;
      const weekend = col === (weekStart === 1 ? 5 : 0) || col === 6;
      if (day === d.getDate()) {
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
        centerTextAt(ctx, String(day), cx, cy - fs * 0.55, `700 ${fs}px ${SANS}`, PAPER);
      } else {
        centerTextAt(ctx, String(day), cx, cy - fs * 0.55, `${weekend ? 700 : 500} ${fs}px ${SANS}`, INK);
      }
    }
  }

  /** 待办清单 */
  function drawTodo(ctx, opt) {
    const accent = opt.useRed ? RED : INK;
    const d = opt.date || new Date();
    base(ctx);
    const k = small ? 0.62 : 1; // 小屏整体缩小
    const pad = small ? 8 : 24;
    if (!small) frame(ctx);
    const ds = `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK[d.getDay()]}`;
    ctx.fillStyle = INK; ctx.font = `500 ${small ? 10 : 14}px ${SANS}`;
    const dsW = ctx.measureText(ds).width;
    ctx.fillText(ds, W - pad - dsW, small ? 9 : 30);
    const title = opt.title || "今日待办";
    fitFont(ctx, title, W - pad * 2 - dsW - 8, 900, small ? 16 : 26, SERIF, 10); ctx.fillText(title, pad, small ? 5 : 20);
    ctx.fillStyle = accent; ctx.fillRect(pad, small ? 26 : 58, W - pad * 2, 2);
    const max = small ? 4 : 7;
    const items = (opt.items || []).filter((s) => s.text.trim()).slice(0, max);
    const lh = small ? 20 : items.length > 5 ? 30 : 36;
    const fs = Math.round(17 * k) + (small ? 1 : 0), box = small ? 11 : 18, top = small ? 32 : 72;
    items.forEach((it, i) => {
      const y = top + i * lh, bx = pad + 2;
      ctx.strokeStyle = INK; ctx.lineWidth = small ? 1.5 : 2; ctx.strokeRect(bx, y + 2, box, box);
      if (it.done) {
        ctx.strokeStyle = accent; ctx.lineWidth = small ? 2 : 3;
        ctx.beginPath(); ctx.moveTo(bx + box * 0.17, y + 2 + box * 0.5); ctx.lineTo(bx + box * 0.45, y + 2 + box * 0.83); ctx.lineTo(bx + box * 0.95, y + 2 + box * 0.1); ctx.stroke();
      }
      const tx = bx + box + (small ? 7 : 12);
      ctx.fillStyle = INK; ctx.font = `700 ${fs}px ${SANS}`;
      let t = it.text.trim();
      while (ctx.measureText(t).width > W - tx - pad && t.length > 1) t = t.slice(0, -1);
      if (t !== it.text.trim()) t = t.slice(0, -1) + "…";
      ctx.fillText(t, tx, y + 1);
      if (it.done) ctx.fillRect(tx, y + 1 + fs * 0.6, ctx.measureText(t).width, 1.5);
    });
    if (!items.length) centerText(ctx, "今天没有待办，好好休息～", small ? 60 : 140, `500 ${small ? 12 : 17}px ${SANS}`, INK);
    const all = (opt.items || []).filter((s) => s.text.trim());
    const left = all.filter((i) => !i.done).length;
    if (all.length) {
      ctx.font = `500 ${small ? 10 : 13}px ${SANS}`; ctx.fillStyle = INK;
      const foot = `还剩 ${left} 件 · 共 ${all.length} 件`;
      if (small) ctx.fillText(foot, W - pad - ctx.measureText(foot).width, H - 14);
      else ctx.fillText(foot, 24, 266);
    }
  }

  /** 解析待办文本：每行一件；以 [x]、√、✓ 开头的算已完成 */
  function parseTodos(text) {
    return String(text).split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const done = /^(\[x\]|\[X\]|√|✓|✔)/.test(l);
      return { done, text: l.replace(/^(\[[ xX]?\]|[-*•·]|√|✓|✔|☐|☑|\d+[.、)])\s*/, "") };
    });
  }

  /** 图片：按屏幕实际像素裁剪铺满 */
  function drawImage(ctx, img, opt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, PW, PH);
    ctx.textBaseline = "top";
    if (!img) { ctx.setTransform(S, 0, 0, S, 0, OY * S); centerText(ctx, "选择一张图片", H / 2 - 10, `500 18px ${SANS}`, INK); return; }
    const s = Math.max(PW / img.width, PH / img.height) * (opt.zoom || 1);
    const w = img.width * s, h = img.height * s, k = PH / 300; // 左右、上下的滑块按 400×300 设计，按屏幕大小换算
    ctx.drawImage(img, (PW - w) / 2 + (opt.dx || 0) * k, (PH - h) / 2 + (opt.dy || 0) * k, w, h);
  }

  /**
   * 把画布量化成屏幕真正能显示的三种颜色。
   * dither=true 用 Floyd-Steinberg 抖动（适合照片），否则直接阈值（适合文字）。
   */
  function quantize(ctx, { dither, useRed }) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const img = ctx.getImageData(0, 0, PW, PH), d = img.data;
    const gray = new Float32Array(PW * PH), isRed = new Uint8Array(PW * PH);
    for (let i = 0; i < PW * PH; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      if (useRed && r > 160 && r > g + 40 && r > b + 40) isRed[i] = 1;
      gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const i = y * PW + x;
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
        if (x + 1 < PW) gray[i + 1] += e * 7 / 16;
        if (y + 1 < PH) {
          if (x > 0) gray[i + PW - 1] += e * 3 / 16;
          gray[i + PW] += e * 5 / 16;
          if (x + 1 < PW) gray[i + PW + 1] += e / 16;
        }
      }
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return img;
  }

  /** 常见墨水屏尺寸（按屏幕像素） */
  const SCREENS = {
    "4.2": { name: "4.2 寸 · 400×300", w: 400, h: 300 },
    "2.13": { name: "2.13 寸 · 250×122", w: 250, h: 122 },
    "2.9": { name: "2.9 寸 · 296×128", w: 296, h: 128 },
    "5.83": { name: "5.83 寸 · 648×480", w: 648, h: 480 },
    "7.5": { name: "7.5 寸 · 800×480", w: 800, h: 480 },
  };

  root.Cards = {
    get W() { return PW; }, get H() { return PH; }, SCREENS, setSize,
    fontsReady, drawFortune, drawStatus, drawQuote, drawDaily, drawCalendar, drawTodo, parseTodos, drawImage, quantize,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
