# dsh-secret-variables

[English](README.en.md) | [简体中文](README.md)

A DeepSeek Harness plugin that keeps secrets out of the model context.

You declare a variable once; the model only ever sees `$DSH_SECRET_<NAME>` and the value is materialized into one-shot `bash` / `pwsh` commands at execution time. Values never enter prompts, tool results, session logs, or the plugin's metadata store.

```
   you set the value            host stores it               the model sees
   ─────────────────            ─────────────                ──────────────
   OPENAI_API_KEY=sk-…   ──►    credentials (0600)    ──►    $DSH_SECRET_OPENAI_API_KEY
                                       │
                                       ▼
                              bash/pwsh environment at exec time
```

## What it gives you

- **Four scopes**: global (all projects or selected projects), project, session, and auto-detected secrets found in the conversation.
- **Per-row switch**: enable a global for this project / this session, without touching the value.
- **Values are write-only for the UI**: you type a value, it is stored by the Host credential API, and it is never shown again.
- **Redaction**: known values are replaced with their reference in tool output and history (values shorter than 12 characters are injected but never matched against arbitrary text).
- **Guard**: persistent terminals and other shells do not receive the values; using a reference there is rejected instead of silently expanding to nothing.

## UI entry points

```
Where it lives
├─ Sidebar → 🔑 Secrets            global scope
├─ Workspace row ⋯ → Secrets       this project
└─ Conversation tabs → Secrets     this session
```

### Global page

```
Global page
├─ Add row: Name · Value · Availability · ☐ Enable after adding · Add
└─ Variable rows, one line each:
   ├─ OPENAI_API_KEY  $DSH_SECRET_OPENAI_API_KEY  All projects · Saved · ● · Replace value · ✕
   └─ GITHUB_TOKEN    $DSH_SECRET_GITHUB_TOKEN     dsh, tmp     · Saved · ● · Replace value · ✕
```

One row, left to right:

| Part | Shows | Example |
| --- | --- | --- |
| Name / env | model-visible handle | `OPENAI_API_KEY` · `$DSH_SECRET_OPENAI_API_KEY` |
| Availability | where it applies | `All projects` / `dsh, tmp` |
| State | value stored or not | `Saved` |
| Switch | enabled in this scope | ● |
| Actions | replace value, delete | `Replace value` · `✕` |

The availability picker opens as a dropdown: **All projects** by default, one checkbox per project. Ticking a project clears **All projects**; unticking the last one falls back to it. A duplicate name inside one scope is rejected; the same name at a narrower scope is the supported override.

Name variables with upper-case letters, digits and underscores (`SERVICE_PURPOSE`, for example `OPENAI_API_KEY`). The environment name gets a `DSH_SECRET_` prefix; names with non-Latin characters fall back to a stable hash suffix.

### Project dialog (workspace row "⋯" → Secrets)

```
Project · Secrets
├─ Project variables (1) — shared inside this project
│  └─ DATABASE_URL · $DSH_SECRET_DATABASE_URL · Saved · ● · Replace value · ✕
└─ Global variables (1) — available everywhere, edit at the global page
   └─ OPENAI_API_KEY · $DSH_SECRET_OPENAI_API_KEY · Saved · ● · Edit at its source
```

### Session tab (Chat | Trajectory | Secrets)

```
Session · Secrets
├─ Session variables (1) — this session only
│  └─ SENTRY_AUTH_TOKEN · $DSH_SECRET_SENTRY_AUTH_TOKEN · Saved · ● · Replace value · ✕
├─ Project variables (1) — shared inside this project
│  └─ DATABASE_URL · $DSH_SECRET_DATABASE_URL · Saved · ● · Edit at its source
├─ Global variables (1) — available everywhere
│  └─ OPENAI_API_KEY · $DSH_SECRET_OPENAI_API_KEY · Saved · ● · Edit at its source
└─ Detected (1) — found in the conversation, this session only
   └─ AUTO_1 · $DSH_SECRET_AUTO_1 · Saved · ● · Auto
```

## Install (from source)

Requires DSH **>= 0.2.2-rc.1** and Node **>= 20**. Source-only distribution — the package is not published to npm.

The package ships a bundle patch (`dsh.bundle.patch`), so install it as a DSH bundle into your profile:

```sh
dsh plugin --profile web add <this repository url>
```

Restart DSH, then make sure `@local/dsh-secret-variables` is enabled in the plugin manager (插件管理器); installing the bundle from the plugin manager works the same way. Open **Secrets** (密钥管理) in the sidebar afterwards.

## Use a secret

The model writes the reference; the Host substitutes the value into the command environment:

```sh
curl -s -H "Authorization: Bearer $DSH_SECRET_OPENAI_API_KEY" https://api.example.com/
```

A reference that appears in an unregistered secret is turned into `$DSH_SECRET_AUTO_n` and listed under **自动检测** (this session only, never persisted).

## Scopes and precedence

| Scope | Where | Lifetime |
| --- | --- | --- |
| Global | sidebar 密钥管理 | until deleted, stored on disk |
| Project | workspace "⋯" menu | until deleted, stored on disk |
| Session | conversation tab | until the session is disposed, stored on disk |
| Auto | detected in the conversation | process memory only |

Resolution goes session → project → global by sanitized name (case-insensitive): a narrower definition overrides a wider one. Within one scope, names must be unique (`a`, `A`, `a!` normalize to the same env name).

## Security model

This plugin prevents **accidental** leakage: values stay out of prompts, tool results, logs, and API responses. It does **not** defend against an agent that deliberately extracts a value (for example `base64 $DSH_SECRET_X`) or against a same-user process reading the credential file. See [docs/SECURITY.md](docs/SECURITY.md) (Chinese) for the full guarantees / non-guarantees list.

## Development

```sh
node --test test/*.test.js
```

105 tests, no dependencies, no build step. `client.js` is loaded as-is by the Harness web UI. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
