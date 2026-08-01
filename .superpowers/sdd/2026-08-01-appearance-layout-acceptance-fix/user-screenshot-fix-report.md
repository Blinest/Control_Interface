Changes
- Reworked charts into six independently assigned subplots with sidebar assignment controls and a filled primary chart grid.
- Removed the stale App.css chart row recipe and added static plus visual smoke geometry guards for chart underfill.
- Changed workspace motor summary cells to two rows: motor ID plus red/green lamp, then current value.
- Gave warning/error/info/bug filters and badges distinct tone classes and backgrounds.
- Hid prominent card drag/resize icon buttons as accessible fallbacks and added direct pointer resize zones plus long-press drag activation.
- Expanded mojibake coverage across source, scripts, and docs while keeping the shared denylist as the central guard.

Red-Green Evidence
- RED: `npm.cmd run test:unit -- src/features/charts/ChartsPage.test.tsx src/components/cards/CardLayoutEditor.test.tsx src/features/device-workspace/DeviceWorkspacePage.test.tsx src/features/logs/LogsPage.test.tsx src/styles/visualText.test.ts` failed for missing six subplots, visible card controls, three-row motor cells, missing log tone classes, and widened mojibake scan.
- RED: `npm.cmd run test:layout-regressions` failed with `App.css must not keep the stale chart row recipe that underfills the chart page`.
- GREEN: Required unit command passed with 8 files and 27 tests.
- GREEN: UI regressions, layout regressions, visual smoke, build, and diff check passed.

Verification
- `npm.cmd run test:unit -- src/features/charts/ChartsPage.test.tsx src/features/device-workspace/DeviceWorkspacePage.test.tsx src/features/logs/LogsPage.test.tsx src/components/cards src/components/data/data-components.test.tsx src/styles/visualText.test.ts`
- `npm.cmd run test:ui-regressions`
- `npm.cmd run test:layout-regressions`
- `npm.cmd run test:visual-smoke`
- `npm.cmd run build`
- `git diff --check`
- `git status --short`

Commit
- Pending at report creation; final commit hash is reported in the task response.

Concerns
- None.
