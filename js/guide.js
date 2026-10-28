/*
 * 新手引导：墨墨形状的黑猫弹窗（猫耳、眨眼、小爪子、摇尾巴），一步步指给新用户看。
 * 第一次打开自动出现；点右上角「新手引导」可以再看一遍。
 * daily-ink-zzz · by zzz (Ellie Zhang) · GPL-3.0
 */
(function () {
  const DONE_KEY = "daily-ink-guide";
  const desktop = () => document.body.classList.contains("desktop");

  const STEPS = [
    { title: "喵～我是墨墨", text: "Daily Ink 的小黑猫。花一分钟，我带你把第一张卡片送上墨水屏。" },
    { target: ".side", title: "先挑一张卡片", text: "这里是卡片种类。什么都不想填的话，就选「每日一句」，墨墨每天换一句话给你。" },
    { target: ".grid > .stack:first-child > .panel:first-child", title: "在这里填内容", text: "每种卡片的设置都在这里。运势签要填生日，只在你的电脑里计算，不会上传。" },
    { target: ".device", title: "这就是屏幕上的样子", text: "改了设置，预览马上更新。黑、白、红三种颜色，看到什么，屏幕上就是什么。" },
    {
      target: "#btnConnect", title: "打开墨水屏，点「连接」",
      text: () => desktop() ? "墨墨会自动找到 NRF_EPD_ 开头的屏幕，不用你选。" : "在弹出的窗口里，选 NRF_EPD_ 开头的设备。",
    },
    { target: "#btnSend", title: "最后，发送！", text: "点这里，卡片就飞到屏幕上啦。没连接也没关系，墨墨会自动先连上。屏幕会闪十几秒，那是在刷新，别担心。" },
    { target: "#autoBox", desktopOnly: true, title: "想每天自动换？", text: "在这里打开每日自动更新，到点墨墨帮你发；Mac 睡醒后还会补发。" },
    { title: "准备好啦", text: "忘了怎么用的话，点右上角「新手引导」，墨墨随时再带你走一遍。", next: "开始吧" },
  ];

  let root = null, steps = [], idx = 0;

  function build() {
    root = document.createElement("div");
    root.className = "momo-guide";
    root.innerHTML = `
      <div class="mg-block"></div>
      <div class="mg-spot"></div>
      <div class="mg-card" role="dialog" aria-modal="true" aria-labelledby="mgTitle" aria-describedby="mgText">
        <span class="mg-ear l"></span><span class="mg-ear r"></span>
        <div class="mg-eyes" aria-hidden="true"><i></i><i></i></div>
        <b id="mgTitle"></b>
        <p id="mgText"></p>
        <div class="mg-foot">
          <span class="mg-dots" aria-hidden="true"></span>
          <button type="button" class="mg-skip">跳过</button>
          <button type="button" class="mg-next">下一步</button>
        </div>
        <span class="mg-paw l" aria-hidden="true"></span><span class="mg-paw r" aria-hidden="true"></span>
        <svg class="mg-tail" viewBox="0 0 48 64" aria-hidden="true"><path d="M4 10 C30 6 44 26 30 40 S20 58 40 56"/></svg>
      </div>`;
    document.body.appendChild(root);
    root.querySelector(".mg-next").onclick = next;
    root.querySelector(".mg-skip").onclick = finish;
    root.addEventListener("keydown", (e) => { if (e.key === "Escape") finish(); });
    window.addEventListener("resize", place);
  }

  function start() {
    steps = STEPS.filter((s) => !s.desktopOnly || desktop());
    idx = 0;
    if (!root) build();
    root.style.display = "block";
    show();
  }

  function show() {
    const s = steps[idx];
    const card = root.querySelector(".mg-card");
    root.querySelector("#mgTitle").textContent = s.title;
    root.querySelector("#mgText").textContent = typeof s.text === "function" ? s.text() : s.text;
    root.querySelector(".mg-next").textContent = s.next || (idx === steps.length - 1 ? "好的" : "下一步");
    root.querySelector(".mg-skip").style.visibility = idx === steps.length - 1 ? "hidden" : "visible";
    root.querySelector(".mg-dots").innerHTML = steps.map((_, i) => `<i class="${i === idx ? "on" : ""}"></i>`).join("");
    const el = s.target && document.querySelector(s.target);
    if (el && el.getClientRects().length) el.scrollIntoView({ block: "center", inline: "nearest" });
    place();
    // 每一步重新播放一次「弹出来」的动画
    card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
    root.querySelector(".mg-next").focus({ preventScroll: true });
  }

  /** 高亮目标，并把猫猫弹窗放在它下面（放不下就放上面、右边，实在不行放屏幕中间） */
  function place() {
    if (!root || root.style.display === "none") return;
    const s = steps[idx];
    const spot = root.querySelector(".mg-spot"), card = root.querySelector(".mg-card");
    const el = s.target && document.querySelector(s.target);
    const vw = window.innerWidth, vh = window.innerHeight, cw = card.offsetWidth, ch = card.offsetHeight;
    const M = 16, TAIL = 40; // 边距；右边给尾巴留的位置
    const clampX = (x) => Math.max(M, Math.min(x, vw - cw - TAIL));
    const clampY = (y) => Math.max(M + 24, Math.min(y, vh - ch - M - 12));
    let left = (vw - cw) / 2, top = (vh - ch) / 2;
    if (el && el.getClientRects().length) {
      const r = el.getBoundingClientRect();
      Object.assign(spot.style, { left: r.left - 6 + "px", top: r.top - 6 + "px", width: r.width + 12 + "px", height: r.height + 12 + "px", opacity: 1 });
      if (vw < 640) { left = clampX((vw - cw) / 2); top = r.bottom + ch + 50 < vh ? r.bottom + 34 : clampY(r.top - ch - 30); }
      else if (r.bottom + 34 + ch + 12 < vh) { left = clampX(r.left + r.width / 2 - cw / 2); top = r.bottom + 34; }
      else if (r.top - ch - 30 > M + 24) { left = clampX(r.left + r.width / 2 - cw / 2); top = r.top - ch - 30; }
      else if (r.right + 24 + cw + TAIL < vw) { left = r.right + 24; top = clampY(r.top + 30); }
      else if (r.left - cw - 24 > M) { left = r.left - cw - 24; top = clampY(r.top + 30); }
      else { left = clampX(left); top = clampY(vh - ch - 40); }
    } else {
      // 没有要指的东西：藏起高亮框，整页变暗
      Object.assign(spot.style, { left: vw / 2 + "px", top: vh / 2 + "px", width: 0, height: 0, opacity: 0 });
    }
    root.classList.toggle("dim", !(el && el.getClientRects().length));
    card.style.left = Math.round(left) + "px";
    card.style.top = Math.round(top) + "px";
  }

  function next() { if (idx < steps.length - 1) { idx++; show(); } else finish(); }

  function finish() {
    root.style.display = "none";
    try { localStorage.setItem(DONE_KEY, "1"); } catch (e) {}
  }

  window.MomoGuide = { start };
  document.getElementById("btnGuide").onclick = start;

  let seen = false;
  try { seen = !!localStorage.getItem(DONE_KEY); } catch (e) {}
  if (!seen) window.addEventListener("load", () => setTimeout(start, 500));
})();
