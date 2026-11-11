# Changelog

## 0.1.0 — 2026

First public release.

- Four scopes: global (all / selected projects), project, session, auto-detected.
- Values stored through the Host credential API, injected only into one-shot `bash` / `pwsh` commands.
- Redaction of known values in tool output and history (minimum redactable length 12).
- Availability picker for global variables (all projects by default, multi-select projects).
- Unique names inside a scope; the same name at a narrower scope overrides a wider one.
- Inline row editing with Save / Cancel; duplicate names rejected with HTTP 409.
- 105 unit and contract tests, no runtime dependencies.
