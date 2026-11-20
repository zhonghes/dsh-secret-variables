# Changelog

## 0.3.0 — 2026

- The global and project scopes now share one sidebar page: switch with
  **全局 | 项目** tabs below the title; the active scope is underlined.
- The project scope renders inline with a workspace picker instead of a dialog.
  The workspace row "⋯" context-menu entry and its overlay dialog are gone.
- The project page keeps the project/global groups, the same add row and the
  overridden marker; the session tab is unchanged.
- Docs and diagrams: README updated; all five diagrams redrawn for the merged
  page (flow, entry, global, project, session), with SVG sources beside the PNGs.
- 139 tests.

## 0.2.1 — 2026

- Same-name definitions now resolve to the most specific **enabled** one:
  turning a narrower definition off falls back to the next layer instead of
  leaving the name unused.
- Definitions that lose to an enabled narrower one are listed as **Overridden**
  (dimmed, switch disabled, tooltip explains why) instead of disappearing;
  they never contribute to injection or the prompt.
- New `resolveVariables` keeps the winning definition plus the definitions that
  did not win; the session view counts only injecting rows as enabled.
- UI smoke tests (happy-dom) now cover the session view and project dialog
  wiring; React and happy-dom are test-only devDependencies.
- 137 tests.

## 0.2.0 — 2026

- Short values (below 12 characters) now open a save-time dialog that explains the
  risk; values of 4 or more characters can opt into forced redaction.
- New `forceRedact` metadata for global, project and session variables, plus the
  `setForceRedact` API; forced values are masked down to 4 characters.
- The state column shows a masking badge: output auto / output forced / output none. The edit
  row carries a checkbox to switch forced redaction on or off; values shorter than
  4 characters are told that forced redaction cannot match them.
- The project dialog now uses the same 960px content column as the global and session pages.
- 115 tests, no runtime dependencies.

## 0.1.0 — 2026

First public release.

- Four scopes: global (all / selected projects), project, session, auto-detected.
- Values stored through the Host credential API, injected only into one-shot `bash` / `pwsh` commands.
- Redaction of known values in tool output and history (minimum redactable length 12).
- Availability picker for global variables (all projects by default, multi-select projects).
- Unique names inside a scope; the same name at a narrower scope overrides a wider one.
- Inline row editing with Save / Cancel; duplicate names rejected with HTTP 409.
- 105 unit and contract tests, no runtime dependencies.
