/*
 * 墨墨：Daily Ink 的原创吉祥物，一只黑得像墨汁的小猫。
 * 形象与每日一句文案均为本项目原创。
 * daily-ink-zzz · by zzz (Ellie Zhang) · GPL-3.0
 */
(function (root) {
  // 每日一句：墨墨的小声提醒（原创）
  const QUOTES = [
    "今天也要好好吃饭，像我吃小鱼干一样认真。",
    "晒太阳不算偷懒，是在给自己充电。",
    "伸个懒腰再出发，路不会跑掉的。",
    "慢慢来，猫走路也从不着急。",
    "被窝很暖，但今天的你更值得期待。",
    "累了就眯一会儿，醒来又是一只好猫。",
    "把烦恼团成毛线球，拍到沙发底下去。",
    "你已经做得很好了，墨墨盖章认证。",
    "先喝口水，再去拯救世界。",
    "今天的小目标：完成一件小事就好。",
    "别人的节奏是别人的，你踩你自己的猫步。",
    "窗外有风，心里也要留一扇窗。",
    "不想说话的时候，就安静地发会儿呆。",
    "好事会悄悄靠近，像猫一样没有脚步声。",
    "做不完的事，明天的你会接着做。",
    "今天也请温柔地对待自己。",
    "偶尔打翻一个杯子，也没关系的。",
    "把手机放下五分钟，看看窗外吧。",
    "勇敢一点点，就像第一次跳上高高的柜子。",
    "你的努力，墨墨都在角落里看见了。",
    "心情乱糟糟时，先把桌子收拾干净。",
    "饿了要吃，困了要睡，这是猫生真理。",
    "今天也是不必讨好任何人的一天。",
    "小步小步走，也能走到很远的屋顶。",
    "允许自己有一点点不完美。",
    "开心的事要记下来，难过的事交给时间。",
    "认真工作，然后认真偷懒。",
    "世界很吵，你可以只听自己的心跳。",
    "给喜欢的人发一句：今天过得好吗？",
    "钻进纸箱的快乐，就是这么简单。",
    "早起的猫，有早起的阳光。",
    "犹豫的时候，先迈出左前爪。",
    "别急着长大，先好好过完今天。",
    "把今天的好运，悄悄分一点给身边的人。",
    "做一只有边界感的猫：不想被摸就走开。",
    "雨天也很好，适合窝着读一本书。",
    "你不需要每天都闪闪发光。",
    "记得抬头，云在变形状。",
    "睡前想三件今天值得开心的事。",
    "把复杂的事拆小，像把小鱼干掰成小块。",
    "今天的风，适合出门走一走。",
    "有点难的事，往往也有点值得。",
    "累的时候，就假装自己是一只躺平的猫。",
    "相信时间，它会把答案慢慢送来。",
    "你本来的样子，就已经很可爱了。",
    "少想一点“如果”，多做一点“现在”。",
    "墨墨今天也在为你打呼噜加油。",
    "把房间开窗透透气，心情也会跟着换气。",
    "别人怎么看，没有你怎么过重要。",
    "好好说话，也要好好听自己说话。",
    "今天也要做一只有好奇心的猫。",
    "想念谁，就去联系谁吧。",
    "给今天的自己，留一点空白时间。",
    "就算慢一点，也是在往前走。",
    "哪怕只是整理了抽屉，也算有收获。",
    "猫的秘诀：舒服的姿势最重要。",
    "失败只是换了个方向的跳跃。",
    "夜深了，把今天轻轻合上吧。",
    "今天的你，比昨天多懂了一点点。",
    "一切都会好起来的，墨墨保证。",
  ];

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /** 按日期选当天的一句（同一天固定，不同天轮换） */
  function quoteOf(date) {
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const dayIndex = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    return QUOTES[(dayIndex + (hash(key) % 7)) % QUOTES.length];
  }

  /**
   * 画墨墨：圆脸黑猫，眯眯笑眼，脖子上一条红色小围巾。
   * cx, cy 为脸中心，s 为缩放（1 ≈ 脸宽 80px）。accent 为围巾颜色。
   */
  function drawMomo(ctx, cx, cy, s, accent) {
    const INK = "#000", PAPER = "#fff";
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(s, s);
    // 尾巴
    ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(30, 62); ctx.bezierCurveTo(70, 70, 72, 20, 52, 18); ctx.stroke();
    // 身体
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(0, 62, 34, 28, 0, 0, Math.PI * 2); ctx.fill();
    // 耳朵
    ctx.beginPath(); ctx.moveTo(-36, -12); ctx.lineTo(-30, -50); ctx.lineTo(-8, -32); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(36, -12); ctx.lineTo(30, -50); ctx.lineTo(8, -32); ctx.closePath(); ctx.fill();
    // 脸
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 36, 0, 0, Math.PI * 2); ctx.fill();
    // 眯眯眼（白色弧线）
    ctx.strokeStyle = PAPER; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.arc(-15, 0, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(15, 0, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    // 鼻子和嘴
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.moveTo(-3, 9); ctx.lineTo(3, 9); ctx.lineTo(0, 12.5); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-3.5, 13, 3.5, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(3.5, 13, 3.5, 0, Math.PI); ctx.stroke();
    // 胡须
    ctx.lineWidth = 1.6;
    for (const sgn of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sgn * 22, 10); ctx.lineTo(sgn * 50, 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sgn * 22, 15); ctx.lineTo(sgn * 50, 17); ctx.stroke();
    }
    // 红围巾
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.ellipse(0, 36, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(14, 38); ctx.lineTo(26, 58); ctx.lineTo(16, 60); ctx.lineTo(8, 40); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  root.Momo = { QUOTES, quoteOf, drawMomo };
})(typeof globalThis !== "undefined" ? globalThis : this);
