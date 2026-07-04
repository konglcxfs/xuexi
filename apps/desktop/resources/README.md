# 把 logo.iconset/ 或 .icns / .ico / 512x512.png 放进这里用于三端打包

应用图标占位 —— 真实打包前替换：
- icon.icns       （macOS）
- icon.ico        （Windows）
- icon.png        （Linux，至少 512x512，electron-builder 需要 256/512/1024）

开源替换源：
- flaticon.com (CC BY)
- 自己用 sketch / figma 画

如果暂时没有图标，electron-builder 会用默认占位。
