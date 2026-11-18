# dsh-secret-variables

[English](README.en.md) | [简体中文](README.md)

A DeepSeek Harness plugin that keeps secrets out of the model context.

You declare a variable once; the model only ever sees `$DSH_SECRET_<NAME>` and the value is materialized into the environment of one-shot `bash` / `pwsh` commands at execution time. Values stay out of prompts, tool results, session logs, and the plugin's metadata store by default — with "by default" meaning matches of 12 characters or more are replaced; shorter values are covered in the redaction bullet below.

<a href="docs/images/flow.png"><img src="docs/images/flow.png" width="860" alt="Diagram: the value is saved into the Host credential store, the model only sees a reference, and the value is injected only into a one-shot bash/pwsh command"></a>

*Diagram labels are in Chinese.*

## What it gives you

- **Four scopes**: global (all projects or selected projects), project, session, and auto-detected secrets found in the conversation.
- **Per-row switch**: enable a global for this project / this session, without touching the value.
- **Values are write-only for the UI**: you type a value, it is stored by the Host credential API, and it is never shown again.
- **Redaction**: known values are replaced with their reference in tool output and history (values shorter than 12 characters are injected but not matched by default; saving one opens a dialog that offers forced redaction, which matches down to 4 characters in output only — injection always happens).
- **Guard**: persistent terminals and other shells do not receive the values; using a reference there is rejected instead of silently expanding to nothing.

## UI entry points

<a href="docs/images/entry.png"><img src="docs/images/entry.png" width="860" alt="Diagram: one app window with the three entry points numbered — sidebar, workspace row menu and conversation tab, mapped to the global, project and session scopes"></a>

All three entries open the same panels with a different scope: the sidebar edits globals, the workspace row manages this project, and the conversation tab only affects the current session. The sidebar entry sits under **Automated tasks**.

The images below are diagrams; variable names and values are examples.

### Global page

<a href="docs/images/global.png"><img src="docs/images/global.png" width="860" alt="Diagram: global page, with the enabled count next to the title, the add row and the variable list"></a>

The enabled count sits next to the title. The add row is name, value, availability, **Enable after adding**, and **Add**; **Enable after adding** starts unchecked here and checked on the project and session pages.

One row, left to right:

| Part | Shows | Example |
| --- | --- | --- |
| Name / env | model-visible handle | `OPENAI_API_KEY` · `$DSH_SECRET_OPENAI_API_KEY` |
| Scope / source | availability on the global page; source on the project and session pages | `All projects` / `dsh, tmp` / `Project` / `Global` / `Auto` |
| State | the masking badge when a value is set, otherwise `No value` | `Output: auto` / `Output: forced` / `Output: none` |
| Switch | enabled in this scope (auto-detected rows cannot be toggled) | ● |
| Actions | replace value, delete | `Replace value` · `✕` |

The availability picker opens as a dropdown: **All projects** by default, one checkbox per project. Ticking a project clears **All projects**; unticking the last one falls back to it. A duplicate name inside one scope is rejected; the same name at a narrower scope is the supported override.

Names are normalized: upper-cased, non-alphanumeric runs become `_`, leading and trailing underscores are trimmed, and the result is capped at 40 characters — `openai-api-key` and `OPENAI_API_KEY` both yield `OPENAI_API_KEY`; a purely non-Latin name becomes `SECRET_<8-character hash>`. The environment name adds the `DSH_SECRET_` prefix. Duplicate detection runs on the normalized name, so `a`, `A`, and `a!` collide.

The masking badge lives in the state column: `Output: auto` (green) means the value is 12 characters or more and is replaced in output; `Output: forced` (yellow) means the variable opted in and the value has at least 4 characters; `Output: none` (red) means the value is too short (below 12, or below 4 with forced redaction). Injection is never affected. An unset value shows `No value`; `Saved` appears only on auto-detected rows — they have no metadata row, so the UI can only confirm the value lives in this process.

### Project dialog (workspace row "⋯" → Secrets)

<a href="docs/images/project.png"><img src="docs/images/project.png" width="860" alt="Diagram: project dialog, with the project name under the title and the project and global variable groups"></a>

The project name sits under the title. Project variables can be edited or deleted here; global variables only expose the switch and **Edit at its source**. When a project variable shares a name with a global one and both are enabled, the global row is marked **Overridden**.

### Session tab (Chat | Trajectory | Secrets)

<a href="docs/images/session.png"><img src="docs/images/session.png" width="860" alt="Diagram: session secrets tab with the session, project, global and detected groups"></a>

The groups are session / project / global / detected, each with a count and a one-line hint. Empty groups are hidden — except **Detected**, which explains its trigger when nothing matched yet. An `AUTO_n` under **Detected** is a fallback variable claimed from the conversation; it lives in this process only.

Duplicate names take the most specific **enabled** definition (session → project → global); turning a narrower definition off falls back to the next layer. An enabled definition that loses to a more specific enabled one is listed as **Overridden** (dimmed, switch disabled) and is never injected.

An **Only enabled** filter sits below the add row.

## Install (from source)

Requires DSH **>= 0.2.2-rc.1** and Node **>= 20**. Source-only distribution — the package is not published to npm.

`dsh.bundle.patch` in `package.json` points at the bundled `cordis.patch.yml`. Clone this repository and install it as a bundle into your profile:

```sh
dsh plugin --profile web add /path/to/dsh-secret-variables
```

Restart DSH, then make sure `@local/dsh-secret-variables` is enabled in the plugin manager (插件管理器); installing the bundle from the plugin manager works the same way. Open **Secrets** (密钥管理) in the sidebar afterwards.

## Use a secret

The model writes the reference; the Host substitutes the value into the command environment:

```sh
curl -s -H "Authorization: Bearer $DSH_SECRET_OPENAI_API_KEY" https://api.example.com/
```

## Auto-detection (fallback)

Unregistered credentials are scanned in three text streams: tool results, PTC dispatch logs, and messages right before they reach the model (including your own messages). A hit becomes `$DSH_SECRET_AUTO_n` and is listed under **Detected** (自动检测) on the session page.

Matching is format-based only — no length or entropy heuristics:

| Format | Example |
| --- | --- |
| PEM private key | `-----BEGIN … PRIVATE KEY-----` |
| Password inside a URL | `postgres://user:pass@host` |
| OpenAI-style key | `sk-…` (20+ characters after `sk-`, contains a digit) |
| Google API key | `AIza…` |
| GitHub token / PAT | `ghp_…` / `github_pat_…` |
| GitLab / npm / HuggingFace | `glpat-…` / `npm_…` / `hf_…` |
| AWS / Alibaba Cloud / Tencent Cloud | `AKIA…` / `LTAI…` / `AKID…` |
| Slack / Stripe / Webhook | `xoxb-…` / `sk_live_…` / `whsec_…` |
| JWT | `eyJ….eyJ….…` |

After a hit:

- The default budget is 16 entries per session (`maxAuto`, configurable from 1 to 64); once it is full, new format hits are left as-is.
- Process memory only: gone when the session is disposed or the plugin reloads — never written to disk or to the credential file.
- Injected only into one-shot `bash` / `pwsh`. The Detected block is always shown, even without hits, and explains the trigger.

**Not detected**: bare strings that do not match the table. For example the random characters after `Authorization: Bearer <random string>` carry no prefix or structure, so they are neither claimed nor masked when printed. Register such a value by hand — add a session variable on the session page, paste the value, then reference it as `$DSH_SECRET_<NAME>`.

## Scopes and precedence

| Scope | Where | Lifetime |
| --- | --- | --- |
| Global | sidebar 密钥管理 | until deleted, stored on disk |
| Project | workspace "⋯" menu | until deleted, stored on disk |
| Session | conversation tab | stored on disk; unusable after the session is disposed, metadata is not cleaned up automatically |
| Auto | detected in the conversation | process memory only (default ≤16 per session) |

Resolution goes session → project → global by sanitized name (case-insensitive) and takes the most specific **enabled** definition; a narrower one that is off falls back to the next layer. Within one scope, names must be unique (`a`, `A`, `a!` normalize to the same env name).

## Security model

This plugin prevents **accidental** leakage: registered values stay out of prompts, tool results, logs, and API responses by default (12-character floor, see above). It does **not** defend against an agent that deliberately extracts a value (for example `base64 $DSH_SECRET_X`) or against a same-user process reading the credential file. See [docs/SECURITY.md](docs/SECURITY.md) (Chinese) for the full guarantees / non-guarantees list.

## Development

```sh
npm install   # test dependencies only (React / happy-dom)
npm test
```

137 tests (host logic + UI smoke), no runtime dependencies, no build step. `client.js` is loaded as-is by the Harness web UI. The host suite runs without installing anything: `node --test test/*.test.js`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
