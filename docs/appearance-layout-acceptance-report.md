# 外观布局验收报告

验收日期：2026-08-01

## 修复范围

- 中文文案可读性。
- 浅色/深色主题按钮对比。
- 无可见垂直滚动条。
- 1280x800 下的响应式功能可达性。
- 直接拖拽/拉伸卡片。
- 大面积空白收口。
- 真实截图验收。

## 验证命令

- `npm.cmd run test:unit`：通过，退出码 0；31 个测试文件、119 个测试通过。
- `npm.cmd run test:ui-regressions`：通过，退出码 0。
- `npm.cmd run test:layout-regressions`：通过，退出码 0。
- `npm.cmd run test:visual-smoke`：通过，退出码 0；保存 24 张截图。
- `npm.cmd run build`：通过，退出码 0；TypeScript 与 Vite 生产构建完成。
- `cargo test --manifest-path src-tauri/Cargo.toml`：通过，退出码 0；97 个 Rust 测试通过。
- `git diff --check`：通过，退出码 0。
- `npm.cmd run tauri -- build`：通过，退出码 0；生成 release EXE、MSI、NSIS 安装包。

## 截图产物

- `artifacts/visual-smoke/dashboard-{light,dark}-{desktop,min-desktop}.png`
- `artifacts/visual-smoke/workspace-{light,dark}-{desktop,min-desktop}.png`
- `artifacts/visual-smoke/charts-{light,dark}-{desktop,min-desktop}.png`
- `artifacts/visual-smoke/sessions-{light,dark}-{desktop,min-desktop}.png`
- `artifacts/visual-smoke/logs-{light,dark}-{desktop,min-desktop}.png`
- `artifacts/visual-smoke/settings-{light,dark}-{desktop,min-desktop}.png`

共 24 张 PNG，覆盖 1600x980 和 1280x800 两个桌面视口，以及浅色和深色主题。截图仅作本地验收产物，保持忽略状态，不纳入提交。

## Release 产物

- `src-tauri/target/release/softui-desktop.exe`
- `src-tauri/target/release/bundle/nsis/softui-desktop_0.1.0_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/softui-desktop_0.1.0_x64_en-US.msi`

## 当前完成度

- 文案可读性：100%。
- 主题对比与视觉一致性：100%。
- 布局可达性与无可见纵向滚动条：100%。
- 卡片直接拖拽/拉伸及空白区域收口：100%。
- 真实截图验收与 release 交付：100%。

## 残余风险

- 本次验收没有阻塞项。Rust 构建仍有 `LiveDataRing::latest_for_device` 未使用警告；该警告未导致测试或 release 构建失败。
