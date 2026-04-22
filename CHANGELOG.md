# Changelog

## [0.0.9] - 2026-04-22
- Compress demo GIF in README.md
- Add default keybinding `Ctrl+Shift+Q` (`Cmd+Shift+Q` on macOS) to open the QuickRun panel (can be changed via Keyboard Shortcuts)
- Add command palette support: run any saved command via `QuickRun: Run Command...` (`Ctrl+Shift+P`)
- Fix: Hide internal tree-item commands (execute, edit, delete, stop, etc.) from the command palette

## [0.0.8] - 2026-04-15
- Update readme containing a section on known issue

## [0.0.7] - 2026-04-08
### Added
- **Stop button**: a `$(stop-circle)` inline button appears next to any running command. Clicking it kills the terminal immediately.
- **Per-command terminal mode**: each command now has a "Terminal" setting in the edit panel: `Reuse terminal` (create once, reuse on re-run) or `New terminal on every run`
- **Animated spinner**: the command icon switches to a `$(loading~spin)` spinner while the command is running
- **`running` description badge**: the `project`/`global` badge changes to `running` in the tree item while a command is active
- Single-clicking a tree item focuses the existing terminal.
- **Redesigned command panel**: the Add/Edit panel now has a cleaner layout with named sections, a collapsible icon picker, pill toggles for Terminal Behaviour and Scope, and a contextual hint explaining each terminal mode option
- **Command description**: commands can now have an optional description. Hovering over a command in the sidebar shows the description and the raw shell command in a tooltip

## [0.0.6] - 2026-04-01
 - Update the README and activity bar icon

## [0.0.4] - 2026-03-29
### Fix
 - Icons should now load properly in the command panel

## [0.0.1] - 2026-03-29
### Added
- Sidebar panel with commands and groups
- Run commands in the active terminal with one click
- Add, edit, and delete commands and groups
- Icon picker with 60+ VS Code codicons per command or group
- Config persistence - commands saved to `.vscode/quickrun.json` (project scope) or `settings.json` (global scope)
- Scope selector when adding commands and groups
- Auto-reload when `.vscode/quickrun.json` is changed externally
- Source badge (`project` / `global`) shown on every tree item
