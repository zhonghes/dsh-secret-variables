# dsh-secret-variables

[English](README.md) | [简体中文](README.zh-CN.md)

A [DeepSeek Harness](https://github.com/zhonghes/dsh-secret-variables) plugin that keeps secrets out of the model context.

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
Sidebar                     Workspace row "⋯"            Conversation tabs
─────────                   ─────────────────            ─────────────────
自动化任务                   重命名                       对话 | 轨迹 | 密钥管理
└─ 🔑 密钥管理  ← global     打开                               ↑ session scope
                             └─ 密钥管理  ← project
```

### Global page

```
┌ 密钥管理 ────────────────────────────────── 已启用 2 / 5 ─┐
│ 名称 [________] 值 [________] 生效范围 [全部项目 ▾]        │
│ ☐ 创建后启用                                [添加]         │
├────────────────────────────────────────────────────────────┤
│ a     $DSH_SECRET_A       全部项目   已设置  ●   更换值 ✕   │
│ token $DSH_SECRET_TOKEN   dsh、tmp   已设置  ●   更换值 ✕   │
└────────────────────────────────────────────────────────────┘
```

The availability picker opens as a dropdown: 全部项目 by default, each project is a checkbox. Ticking a project clears 全部项目; unticking the last project falls back to 全部项目. Same name inside one scope is rejected (`duplicate name`); the same name at a narrower scope is the supported override.

### Project dialog (workspace row "⋯" → 密钥管理)

```
┌ 密钥管理 · 项目 ──────────────────────────────────┐
│ ▸ 本项目变量 2 ─────────────────── 本项目内共享    │
│   API_KEY  $DSH_SECRET_API_KEY  已设置 ● 更换值 ✕  │
│ ▸ 全局变量 1 ───────────────────── 所有项目可用    │
│   token    $DSH_SECRET_TOKEN    已设置 ● 请在所属页修改 │
└───────────────────────────────────────────────────┘
```

### Session tab (对话 | 轨迹 | 密钥管理)

```
┌ 本会话变量 1 ─────── 仅本会话可用 ────────────────┐
│ SESSION_TOKEN  $DSH_SECRET_SESSION_TOKEN  ● 更换值 ✕ │
├ 本项目变量 1 ─────── 本项目内共享 ────────────────┤
│ API_KEY        $DSH_SECRET_API_KEY      ● 请在所属页修改 │
├ 全局变量 1 ───────── 所有项目可用 ────────────────┤
│ token          $DSH_SECRET_TOKEN        ● 请在所属页修改 │
├ 自动检测 1 ───────── 从对话中识别，仅本次会话 ────┤
│ AUTO_1         $DSH_SECRET_AUTO_1       ● 自动      │
└──────────────────────────────────────────────────┘
```

## Install (from source)

Requires DSH **>= 0.2.2-rc.1** and Node **>= 20**. Source-only distribution — the package is not published to npm.

The package ships a bundle patch (`dsh.bundle.patch`), so install it as a DSH bundle into your profile:

```sh
dsh plugin --profile web add <this repository url>
```

Restart DSH, then make sure `@local/dsh-secret-variables` is enabled in the plugin manager (插件管理器); installing the bundle from the plugin manager works the same way. Open **密钥管理** in the sidebar afterwards.

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
