/*
 * 蓝牙墨水屏通信（兼容 EPD-nRF5 协议的 4.2 寸屏）
 * 协议参考开源项目 EPD-nRF5（tsl0922，GPL-3.0），本文件为独立实现。
 * daily-ink-zzz · by zzz (Ellie Zhang) · GPL-3.0
 */
(function (root) {
  const SERVICE = "62750001-d828-918d-fb46-b6c11c675aec";
  const CHAR = "62750002-d828-918d-fb46-b6c11c675aec";
  const CMD = { INIT: 0x01, CLEAR: 0x02, REFRESH: 0x05, SET_TIME: 0x20, WRITE_IMG: 0x30, SET_SLOT: 0x31, SET_SLIDE: 0x33 };

  // 4.2 寸各驱动的颜色模式
  const DRIVERS = {
    0x01: { name: "4.2寸 黑白 UC8176", mode: "BW" },
    0x04: { name: "4.2寸 黑白 SSD1619", mode: "BW" },
    0x17: { name: "4.2寸 黑白 SSD1683", mode: "BW" },
    0x03: { name: "4.2寸 三色 UC8176", mode: "BWR" },
    0x02: { name: "4.2寸 三色 SSD1619", mode: "BWR" },
    0x16: { name: "4.2寸 三色 SSD1683", mode: "BWR" },
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- 图像编码 ----------
  /** 把 400x300 的 RGBA 数据转成 黑白层 + 红色层（1 = 白 / 无红） */
  function encodePlanes(imageData) {
    const { width: w, height: h, data } = imageData;
    const bw = Math.ceil(w / 8);
    const black = new Uint8Array(bw * h), red = new Uint8Array(bw * h).fill(0xff);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
      const byte = y * bw + (x >> 3), bit = 0x80 >> (x & 7);
      const isRed = r > 160 && r > g + 40 && r > b + 40;
      if (isRed) { red[byte] &= ~bit; } // 红色像素：红层置 0，黑层保持 0（与官方上位机一致）
      else if (0.299 * r + 0.587 * g + 0.114 * b >= 140) black[byte] |= bit;
    }
    return { black, red };
  }

  function rleCompress(input, maxLit) {
    const out = []; let i = 0; const n = input.length;
    while (i < n) {
      let run = 1;
      while (i + run < n && run < 130 && input[i + run] === input[i]) run++;
      if (run >= 3) { out.push(0x80 | (run - 3), input[i]); i += run; continue; }
      const start = i; let lit = 0;
      while (i < n && lit < maxLit) {
        if (i + 2 < n && input[i] === input[i + 1] && input[i] === input[i + 2]) break;
        lit++; i++;
      }
      if (lit === 0) { out.push(0, input[i++]); }
      else { out.push(lit - 1); for (let j = start; j < start + lit; j++) out.push(input[j]); }
    }
    return Uint8Array.from(out);
  }

  /** 压缩后按码边界切块，每块不超过 size 字节 */
  function rleChunks(data, size) {
    const s = rleCompress(data, Math.min(size - 1, 128));
    const chunks = []; let i = 0, start = 0;
    while (i < s.length) {
      const len = s[i] & 0x80 ? 2 : s[i] + 2;
      if (i - start + len > size && i > start) { chunks.push(s.slice(start, i)); start = i; }
      i += len;
    }
    if (i > start) chunks.push(s.slice(start, i));
    return chunks;
  }

  // ---------- 设备 ----------
  class InkDevice {
    constructor(log) {
      this.log = log || (() => {});
      this.device = null; this.char = null;
      this.reset();
    }
    reset() {
      this.driver = null; this.mtu = 20; this.rle = false;
      this.slotCount = 0; this.slot = 0; this.battery = null; this.firstNotify = true;
    }
    get connected() { return !!(this.device && this.device.gatt.connected && this.char); }
    get info() { return DRIVERS[this.driver] || null; }

    async connect(prefix = "NRF_EPD_") {
      if (!navigator.bluetooth) throw new Error("这个浏览器不支持网页蓝牙。电脑/安卓请用 Chrome 或 Edge，iPhone 请用 Bluefy 浏览器。");
      this.device = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: prefix }], optionalServices: [SERVICE] });
      this.device.addEventListener("gattserverdisconnected", () => { this.char = null; this.log("连接已断开"); this.onchange && this.onchange(); });
      await this._open();
    }

    async reconnect() {
      if (!this.device) throw new Error("请先点「连接」选择设备");
      await this._open();
    }

    async _open() {
      this.reset();
      this.log(`正在连接 ${this.device.name}…`);
      let server, err;
      for (let i = 0; i < 4; i++) {
        try { server = await this.device.gatt.connect(); break; }
        catch (e) { err = e; await sleep(400 * (i + 1)); }
      }
      if (!server) throw err;
      const svc = await server.getPrimaryService(SERVICE);
      this.char = await svc.getCharacteristic(CHAR);
      await this.char.startNotifications();
      this.char.addEventListener("characteristicvaluechanged", (e) => this._notify(new Uint8Array(e.target.value.buffer)));
      await this.write(CMD.INIT);
      await sleep(1200);
      const d = this.info;
      this.log(`已连接 ${this.device.name}` + (d ? `（${d.name}）` : this.driver != null ? `（未知驱动 0x${this.driver.toString(16)}）` : ""));
      this.onchange && this.onchange();
    }

    _notify(data) {
      if (this.firstNotify) {
        this.firstNotify = false;
        if (data.length > 7) this.driver = data[7];
        return;
      }
      const msg = new TextDecoder().decode(data).replace(/\0+$/, "");
      if (msg.startsWith("mtu=")) { this.mtu = parseInt(msg.slice(4)) || 20; this.rle = msg.includes("rle=1"); }
      else if (msg.startsWith("slots=")) {
        const p = msg.slice(6).split(" ");
        this.slotCount = parseInt(p[0]) || 0;
        if (p.length > 2) this.slot = parseInt(p[2]) || 0;
      } else if (msg.startsWith("t=")) {
        const m = msg.match(/bat=(\d+)/); if (m) this.battery = parseInt(m[1]);
      } else if (msg.startsWith("UNREGISTERED")) {
        this.log("提示：设备返回「未注册」，部分功能可能受限。");
      }
    }

    async write(cmd, data) {
      if (!this.char) throw new Error("设备未连接");
      const payload = new Uint8Array(1 + (data ? data.length : 0));
      payload[0] = cmd; if (data) payload.set(data, 1);
      await this.char.writeValueWithResponse(payload);
    }

    async _writePlane(data, step, onProgress, base, span) {
      const size = this.mtu - 2;
      let chunks = this.rle ? rleChunks(data, size) : null;
      const useRle = !!chunks && chunks.reduce((t, c) => t + c.length, 0) < data.length;
      if (!useRle) { chunks = []; for (let i = 0; i < data.length; i += size) chunks.push(data.slice(i, i + size)); }
      for (let i = 0; i < chunks.length; i++) {
        const head = this.rle
          ? (step === "bw" ? 0 : 1) | (i === 0 ? 2 : 0) | (useRle ? 4 : 0)
          : (step === "bw" ? 0x0f : 0x00) | (i === 0 ? 0 : 0xf0);
        const p = new Uint8Array(chunks[i].length + 1); p[0] = head; p.set(chunks[i], 1);
        await this.write(CMD.WRITE_IMG, p); // 每块都等设备确认，避免丢包
        onProgress && onProgress(base + span * (i + 1) / chunks.length);
      }
    }

    /** 发送一张 400x300 的图片并刷新屏幕 */
    async sendImage(imageData, onProgress) {
      const d = this.info;
      if (!d) throw new Error("暂不支持这块屏的驱动" + (this.driver != null ? ` 0x${this.driver.toString(16)}` : "") + "，目前只支持 4.2 寸黑白/三色屏。");
      const { black, red } = encodePlanes(imageData);
      const useSlot = this.slotCount > 0;
      if (useSlot) await this.write(CMD.SET_SLOT, Uint8Array.of(0, this.slot));
      await this.write(CMD.INIT); await sleep(200);
      if (d.mode === "BWR") {
        await this._writePlane(black, "bw", onProgress, 0, 50);
        await this._writePlane(red, "red", onProgress, 50, 50);
      } else {
        await this._writePlane(black, "bw", onProgress, 0, 100);
      }
      await sleep(300);
      if (useSlot) await this.write(CMD.SET_SLOT, Uint8Array.of(1, this.slot));
      await this.write(CMD.REFRESH);
    }

    async calendarMode() { await this._setTime(1); }
    async _setTime(mode) {
      const t = Math.floor(Date.now() / 1000);
      await this.write(CMD.SET_TIME, Uint8Array.of(t >>> 24 & 255, t >>> 16 & 255, t >>> 8 & 255, t & 255, -new Date().getTimezoneOffset() / 60, mode));
    }
    async clear() { await this.write(CMD.CLEAR); }
    disconnect() { if (this.device && this.device.gatt.connected) this.device.gatt.disconnect(); }
  }

  const api = { InkDevice, encodePlanes, rleCompress, rleChunks, DRIVERS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EPD = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
