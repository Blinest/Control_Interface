# SoftUI UI Layout System Redesign

Date: 2026-07-29

## Goal

Improve the existing SoftUI desktop application's visual organization without changing device, recording, playback, logging, or authentication behavior. The first phase focuses on making the app feel like a stable engineering workstation instead of a set of loosely stacked cards.

## Current Problems

The current interface has a usable foundation, but the visual system is inconsistent:

- Pages rely too heavily on independent `.panel` cards, so related controls appear scattered.
- Some pages have large unused empty areas while other pages are horizontally cramped.
- The top action bar contains too many full text buttons and can be clipped.
- Settings fields are compressed into one row, making paths and long values unreadable.
- Empty states usually show only one sentence and do not guide the next action.
- Several containers use `overflow: hidden`, which can silently cut off important content.
- Disabled button styling is inconsistent outside the login page.
- Long engineering values such as paths, session names, device ids, and log messages do not have a consistent display strategy.

## Design Direction

Use a workstation layout model:

- Each page should have one dominant primary work area.
- Supporting controls should live in a stable side panel, top filter bar, or compact summary strip.
- Cards should frame meaningful tools or repeated items, not be used as the default page structure.
- Empty states should preserve layout height and include useful context plus a primary next action.
- Internal scrolling should happen inside table/list/chart regions, while the page frame remains stable.

## Page Templates

### Workbench Layout

Used by pages where the user performs operational work.

Structure:

- Left rail or side panel for controls, status, and parameters.
- Right/main region for live data, table, chart, or history.
- Side panel fills available height instead of stacking many short cards.

Target pages:

- Sessions
- Workspace
- Charts

### Table Layout

Used by pages whose primary job is search, filtering, and inspection.

Structure:

- Top filter bar.
- Full-height table/list body.
- Sticky footer for row count or status.

Target pages:

- Logs
- Session history region

### Settings Layout

Used by configuration and account management.

Structure:

- Stable sections or tabs for `Application`, `Accounts`, `Diagnostics`, and `Migration`.
- Path values use multi-line wrapping or full-value tooltips.
- Diagnostic and migration actions are secondary sections, not narrow panels clipped off to the right.

Target pages:

- Settings

### Dashboard Layout

Used by the monitoring overview.

Structure:

- Compact metric summary strip.
- One main operational status area.
- Secondary recent events/health information grouped below or to the side with aligned heights.

Target pages:

- Dashboard

## First-Phase Scope

The first implementation phase should improve the highest-visibility layout problems:

1. Top action bar overflow.
2. Sessions page scattered cards and large empty space.
3. Settings page horizontal compression and right-panel clipping.
4. Logs page table/list layout discipline.
5. Shared empty state and disabled button styling.
6. Shared long-text behavior for paths, device ids, session names, and log messages.

Charts and Workspace should receive only low-risk CSS adjustments in this phase unless a change is required by shared layout rules.

## Detailed Design

### Top Action Bar

Keep direct buttons for high-frequency actions:

- Theme toggle
- Refresh
- Connection enable/disable
- Recording

Move lower-frequency or account-like actions into compact groups:

- Save layout becomes icon-only or secondary.
- Logout becomes account button text with a compact username, or moves into a trailing account action.
- Buttons must wrap or shrink before clipping.

The `.actions` container should support responsive wrapping or an overflow-safe layout. No button should be clipped at 1554px wide.

### Sessions Page

Replace the current left stack of two short panels with one full-height recording workbench panel.

Left panel content:

- Current recording state.
- Session name input.
- Start/pause/resume/stop controls.
- Total sessions.
- Current session name.
- Elapsed time and frame count when active.

Right panel content:

- Header with search.
- Full-height session table.
- Footer with visible/total count.

Empty state:

- Centered in the right panel.
- Shows no sessions message.
- Shows the next action: start recording from the left workbench.
- Shows useful context such as current save behavior and that sessions appear here after stopping recording.

Expected outcome:

- No short isolated stats card.
- Right history area fills remaining height.
- No large meaningless blank region below unrelated card fragments.

### Settings Page

Make settings readable and non-clipping.

Application configuration:

- Use 2 or 3 columns depending on width.
- Path-like values wrap or expose the full value with `title`.
- Avoid forcing six values into one row.

Accounts:

- Current user, role, and user count become a compact key-value summary strip.
- User list remains distinct from create/reset forms.
- Forms wrap cleanly instead of squeezing buttons.

Diagnostics and migration:

- They can stack below accounts or become secondary sections.
- They must not sit in a narrow right column that is clipped by the viewport.

### Logs Page

Use a full-height table/list shape.

Structure:

- Header/filter area.
- Scrollable log list.
- Sticky count/footer region.

Long log messages should truncate in row view but allow the row to remain aligned. The implementation can use `title` for the full message in this phase.

### Empty State

Add shared empty-state styling:

- Stable minimum height.
- Centered content.
- Clear title.
- Supporting text.
- Optional primary action slot.

This should be applied first to Sessions and later reused by Logs or other empty data views.

### Disabled Buttons

Add explicit disabled styles for:

- `.primary-btn:disabled`
- `.ghost-btn:disabled`
- `.ghost-btn-sm:disabled`

Both light and dark themes need readable text, visible border, and a non-interactive cursor. Disabled state should not rely only on opacity.

### Long Text

Introduce reusable classes:

- `.text-truncate`
- `.text-wrap`
- `.path-value`

Use truncation for row/table cells and wrapping for configuration values where the full value matters.

## Non-Goals

This phase does not:

- Change serial protocol behavior.
- Change recording or playback commands.
- Replace uPlot or Three.js.
- Redesign the brand identity.
- Split the large `App.tsx` file unless required for the targeted page changes.
- Fix all mojibake/encoding text in the same pass, although the implementation must avoid adding new corrupted strings.

## Testing And Verification

Verification should include:

- `npm run build`
- Existing UI regression script.
- A new static layout regression script that checks the presence of the shared layout classes and critical page class names.
- Visual screenshots of login, sessions, settings, and logs at desktop width.
- Process responsiveness check after launching the Tauri app.

## Implementation Notes

The project is not currently a git repository, so the design document cannot be committed from this workspace. The file is saved under `docs/superpowers/specs/` for review and later transfer into version control if needed.
