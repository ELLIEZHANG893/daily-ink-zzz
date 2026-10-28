
---

## 📦 下载哪个？

- **Apple 芯片**（M1 / M2 / M3 / M4…）：下载 `DailyInk-…-arm64.dmg`
- **Intel 芯片**（较早的 Mac）：下载 `DailyInk-…-x64.dmg`

不确定？点屏幕左上角  →「关于本机」，「芯片」一栏写着 Apple 就选 arm64，写着 Intel 就选 x64。

## ⚠️ 打开时提示「无法验证开发者」或「已损坏」？

Daily Ink 是个人开源作品，暂时没有购买苹果开发者签名，所以 macOS 第一次会拦截。**点「完成」，不要点「移到废纸篓」**，然后：

1. 双击 .dmg，把 **Daily Ink** 拖进「应用程序」文件夹（不要直接在 .dmg 里打开）；
2. 打开「终端」（按 ⌘ + 空格，输入「终端」回车）；
3. 复制下面这一整行，粘贴到终端里，按回车：

```
xattr -cr "/Applications/Daily Ink.app" && open "/Applications/Daily Ink.app"
```

App 会直接打开，以后双击就能用。**每次更新到新版本，都需要再运行一次这行命令。**

不想用终端？也可以打开「系统设置 → 隐私与安全性」，滚到最下面，在「已阻止打开 Daily Ink」旁边点 **仍要打开**，输入电脑密码。

> 这行命令只是去掉 macOS 给「从网上下载的文件」打的隔离标记，不会改动系统设置。Daily Ink 的全部代码都公开在本仓库里。

---
Made with ♡ by zzz · Ellie Zhang
