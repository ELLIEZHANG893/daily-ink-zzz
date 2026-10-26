/*
 * 每日运势签算法（仅供娱乐参考）
 * 输入：出生公历日期时间 + 要看的日期；输出：当天的十神、星级、宜忌、幸运色等。
 * 依赖 lunar-javascript（浏览器里是全局 Solar）。
 * daily-ink-zzz · by zzz (Ellie Zhang) · GPL-3.0
 */
(function (root) {
  const STEMS = "甲乙丙丁戊己庚辛壬癸";
  const STEM_WX = "木木火火土土金金水水";
  const BR = "子丑寅卯辰巳午未申酉戌亥";
  const BR_WX = "水土木木土火火土金金土水";
  const GEN = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" }; // 生
  const CTRL = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" }; // 克
  const CHONG = { 子: "午", 午: "子", 丑: "未", 未: "丑", 寅: "申", 申: "寅", 卯: "酉", 酉: "卯", 辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳" };
  const LIUHE = { 子: "丑", 丑: "子", 寅: "亥", 亥: "寅", 卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰", 巳: "申", 申: "巳", 午: "未", 未: "午" };

  const GOD_TEXT = {
    比肩: ["同伴助力", ["约好友", "团队协作", "运动"], ["独自硬扛", "攀比"], "有人同行，路就不难走。"],
    劫财: ["人缘活跃", ["社交", "分享", "合作"], ["借钱", "冲动消费"], "热闹之中，守住钱包也守住心。"],
    食神: ["灵感舒展", ["创作", "美食", "放松"], ["熬夜", "拖延"], "心松一点，好点子自然来。"],
    伤官: ["才华外露", ["表达", "提案", "学新技能"], ["顶撞上级", "口快"], "锋芒用在作品上，不用在口舌上。"],
    正财: ["踏实有得", ["理财", "整理账目", "按计划办事"], ["投机", "贪多"], "一步一印，稳稳收获。"],
    偏财: ["机会意外", ["把握机会", "拓展人脉"], ["赌运气", "大额投资"], "机会来了，先看清再伸手。"],
    正官: ["贵人赏识", ["汇报", "面试", "守规矩"], ["迟到", "越权"], "认真做事，自有人看见。"],
    七杀: ["压力化动力", ["攻坚难题", "健身"], ["与人争执", "情绪化"], "压力是磨刀石，不是绊脚石。"],
    正印: ["贵人护佑", ["读书", "请教长辈", "陪家人"], ["想太多", "犹豫不决"], "被支持的日子，大胆向前。"],
    偏印: ["直觉敏锐", ["独处思考", "研究", "冥想"], ["钻牛角尖", "疑神疑鬼"], "听听心里的声音，它比你想的更聪明。"],
  };
  const COLORS = { 金: "白色·金色", 水: "黑色·深蓝", 木: "绿色·青色", 火: "红色·紫色", 土: "黄色·棕色" };
  const DIRS = { 金: "西方", 水: "北方", 木: "东方", 火: "南方", 土: "中央" };
  const NUMS = { 金: "4·9", 水: "1·6", 木: "3·8", 火: "2·7", 土: "5·0" };

  const isYang = (stem) => STEMS.indexOf(stem) % 2 === 0;
  const wxOfStem = (s) => STEM_WX[STEMS.indexOf(s)];
  const wxOfBr = (b) => BR_WX[BR.indexOf(b)];

  function tenGod(dm, other) {
    const a = wxOfStem(dm), b = wxOfStem(other);
    const same = isYang(dm) === isYang(other);
    if (a === b) return same ? "比肩" : "劫财";
    if (GEN[a] === b) return same ? "食神" : "伤官";
    if (CTRL[a] === b) return same ? "偏财" : "正财";
    if (CTRL[b] === a) return same ? "七杀" : "正官";
    return same ? "偏印" : "正印"; // b 生 a
  }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /** 排出八字，并用简化法判断日主强弱与喜用五行 */
  function natal(birth) {
    const S = root.Solar;
    const ec = S.fromYmdHms(birth.y, birth.m, birth.d, birth.h, birth.mi, 0).getLunar().getEightChar();
    const pillars = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()];
    const dm = pillars[2][0];
    const dmWx = wxOfStem(dm);
    const resource = Object.keys(GEN).find((k) => GEN[k] === dmWx);
    const chars = [];
    pillars.forEach((p, i) => { if (i !== 2) chars.push(wxOfStem(p[0])); chars.push(wxOfBr(p[1])); });
    const support = chars.filter((w) => w === dmWx || w === resource).length; // 7 个字里帮身的数量
    const weak = support < 4;
    const favorable = weak ? [resource, dmWx] : [GEN[dmWx], CTRL[dmWx], Object.keys(CTRL).find((k) => CTRL[k] === dmWx)];
    return { pillars, dm, dmWx, weak, favorable, branches: pillars.map((p) => p[1]) };
  }

  /** 某一天的运势签 */
  function reading(birth, date) {
    const n = natal(birth);
    const lunar = root.Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunar();
    const gz = lunar.getDayInGanZhi();
    const stem = gz[0], br = gz[1];
    const god = tenGod(n.dm, stem);
    const sc = (w) => (n.favorable.includes(w) ? 2 : -1);
    let score = 3 + (sc(wxOfStem(stem)) + sc(wxOfBr(br))) / 2;
    let note = "";
    const clash = n.branches.find((b) => CHONG[br] === b);
    const he = n.branches.find((b) => LIUHE[br] === b);
    if (clash) { score -= 1; note = `${br}冲${clash}，凡事慢半拍`; }
    else if (he) { score += 0.5; note = `${br}合${he}，人和事顺`; }
    const stars = Math.max(1, Math.min(5, Math.round(score)));
    const [theme, yi, ji, line] = GOD_TEXT[god];
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const luckyWx = n.favorable.includes(wxOfStem(stem)) ? wxOfStem(stem) : n.favorable[hash(key) % n.favorable.length];
    const jq = lunar.getJieQi();
    return {
      date, gz, god, theme, stars, note, yi, ji, line,
      week: "日一二三四五六"[date.getDay()],
      lunar: `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      jieqi: jq || "",
      color: COLORS[luckyWx], direction: DIRS[luckyWx], num: NUMS[luckyWx],
      natal: n,
    };
  }

  const api = { reading, natal, tenGod };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Fortune = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
