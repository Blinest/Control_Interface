# SoftUI 上位机工作台重构路线

## 目标

把批准的界面设计拆为四个连续、可独立验收的实施计划。每个计划结束时，应用都必须保持可构建、可运行，不允许积累到最后一次性接线。

## 执行顺序

1. [阶段 1：设计系统与应用壳](./2026-07-29-ui-foundation-shell.md)
2. [阶段 2：设备工作台、安全交互与卡片布局](./2026-07-29-device-workbench-safety-cards.md)
3. [阶段 3：数据页面与设置迁移](./2026-07-29-data-pages-settings-migration.md)
4. [阶段 4：清理、响应式与桌面验收](./2026-07-29-ui-cleanup-visual-acceptance.md)

## 阶段门禁

每个阶段必须满足：

- 该阶段新增测试全部通过；
- `npm run build` 通过；
- 既有 `npm run test:ui-regressions` 与 `npm run test:layout-regressions` 通过，或在同一提交中按新结构更新且通过；
- 涉及 Rust 安全行为时运行 `cargo test --manifest-path src-tauri/Cargo.toml`；
- 工作树只包含该阶段预期修改；
- 完成一次独立代码审查后才进入下一阶段。

## 依赖关系

```text
主题令牌与测试基线
  -> AppShell 与页面模板
  -> 当前设备与统一命令策略
  -> 卡片布局和设备工作台
  -> 曲线 / 会话 / 日志 / 设置迁移
  -> 删除旧实现与视觉验收
```

## 规格覆盖

| 规格能力 | 实施计划 |
|---|---|
| 双主题、启动无闪烁、组件状态色 | 阶段 1 Task 2，阶段 4 Task 4 |
| 侧边栏、全局状态栏、标签、底栏 | 阶段 1 Task 3-5 |
| 五类页面模板与内部滚动 | 阶段 1 Task 4，阶段 3 Task 1-5 |
| 多设备监测、单当前控制设备 | 阶段 2 Task 1、Task 6 |
| 急停、恢复和危险操作确认 | 阶段 2 Task 2-3、Task 6 |
| 总览/监控卡片排序和四档尺寸 | 阶段 2 Task 4-6 |
| uPlot 与 Three.js 保留及稳定挂载 | 阶段 2 Task 6，阶段 3 Task 2，阶段 4 Task 5 |
| 会话空态、日志四级筛选、设置分类 | 阶段 3 Task 1、Task 3-5 |
| 响应式、长文本和旧 CSS 清理 | 阶段 4 Task 1-3 |
| 视觉矩阵和 Tauri 真实运行验收 | 阶段 4 Task 4-5 |

## 范围控制

- 不修改 STM32 协议字段或功能码。
- 不重写 Rust 控制算法。
- 不替换 uPlot、Three.js 或 Tauri。
- 不实现自由停靠、多窗口编排或任意像素卡片缩放。
- 运行数据继续使用 `D:\APP\ControlUI` 目录体系。
