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

  // 文案库在 js/fortune-texts.js（浏览器里是全局 FortuneTexts）
  const texts = () => root.FortuneTexts || require("./fortune-texts.js");
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

  /**
   * 当天的文案。同一个人的同一种十神每 10 天出现一次，
   * 按「第几次出现」轮换 37 句签语，所以一年内同一句不会重复。
   */
  function textOf(god, date) {
    const t = texts()[god];
    const k = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000 / 10);
    const pick = (pool, n, salt) => pool.slice().sort((a, b) => hash(salt + k + a) - hash(salt + k + b)).slice(0, n);
    return { theme: t.themes[k % t.themes.length], yi: pick(t.yi, 3, "宜"), ji: pick(t.ji, 2, "忌"), line: t.lines[k % t.lines.length] };
  }

  /** 排出八字，并用简化法判断日主强弱与喜用五行 */
  /** 解析手动输入的四柱，如「甲子 丙寅 戊辰 庚申」；时柱不知道可以只填三柱 */
  function parsePillars(text) {
    const chars = String(text).replace(/[^甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/g, "");
    if (chars.length !== 6 && chars.length !== 8) throw new Error("请填 3 柱或 4 柱干支，例如：甲子 丙寅 戊辰 庚申");
    const pillars = [];
    for (let i = 0; i < chars.length; i += 2) {
      const s = chars[i], b = chars[i + 1];
      if (!STEMS.includes(s) || !BR.includes(b)) throw new Error(`「${s}${b}」不是有效的干支，天干在前、地支在后`);
      if (STEMS.indexOf(s) % 2 !== BR.indexOf(b) % 2) throw new Error(`「${s}${b}」不是有效的六十甲子组合，请检查`);
      pillars.push(s + b);
    }
    return pillars;
  }

  function natal(birth) {
    let pillars;
    if (birth.pillars) pillars = Array.isArray(birth.pillars) ? birth.pillars : parsePillars(birth.pillars);
    else {
      const ec = root.Solar.fromYmdHms(birth.y, birth.m, birth.d, birth.h, birth.mi, 0).getLunar().getEightChar();
      pillars = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()];
    }
    const dm = pillars[2][0];
    const dmWx = wxOfStem(dm);
    const resource = Object.keys(GEN).find((k) => GEN[k] === dmWx);
    const chars = [];
    pillars.forEach((p, i) => { if (i !== 2) chars.push(wxOfStem(p[0])); chars.push(wxOfBr(p[1])); });
    const support = chars.filter((w) => w === dmWx || w === resource).length; // 除日主外，帮身的字数
    const weak = support < chars.length / 2;
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
    const { theme, yi, ji, line } = textOf(god, date);
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

  const api = { reading, natal, tenGod, parsePillars };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Fortune = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
