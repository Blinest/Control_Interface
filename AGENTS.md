# AGENTS.md

This repository is governed by the Superpowers workflow.

Follow these defaults for all future development in this repo:

- Start with the `using-superpowers` mindset and check for relevant skills before acting.
- For any nontrivial change, brainstorm before coding.
- After design approval, use a brief written plan with verifiable steps.
- Prefer small, surgical edits over broad rewrites.
- Use test-driven development for behavior changes when practical.
- Verify the result before declaring the task done.
- Keep changes tightly scoped to the user's request.
- Treat this repository as the SoftUI upper-computer migration project only. Do not use, launch, copy from, or validate against sibling projects such as `ThreeSoft` unless the user explicitly asks for an archival copy.
- Before opening the app, verify the executable and dev server belong to this workspace. SoftUI uses Tauri from `softui-desktop` and reserves dev port `1421` to avoid collisions with sibling Vite projects.
- After each code modification, close and clean up any prior SoftUI app window and SoftUI-owned `1421` dev server before opening the latest build. Do not stop unrelated services.
- The migration target is the SRS/TDS-defined desktop upper-computer: Rust owns serial I/O, Legacy Protocol V1, device runtime, safety/control, storage, logging, and diagnostics; React is only the UI layer.

If a request conflicts with these instructions, follow the user's explicit instruction first.
