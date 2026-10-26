/* Daily Ink 桌面版：给页面开放的少量本机能力 · by zzz (Ellie Zhang) · GPL-3.0 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dailyInkDesktop", {
  setSchedule: (s) => ipcRenderer.invoke("schedule:set", s),
  setLoginItem: (on) => ipcRenderer.invoke("login:set", on),
  readNote: (name) => ipcRenderer.invoke("notes:read", name),
  notify: (title, body) => ipcRenderer.invoke("notify", title, body),
  ready: () => ipcRenderer.invoke("ready"),
  onScan: (cb) => ipcRenderer.on("bt:scan", (_e, data) => cb(data)),
  chooseDevice: (id) => ipcRenderer.invoke("bt:choose", id),
  cancelScan: () => ipcRenderer.invoke("bt:cancel"),
});
