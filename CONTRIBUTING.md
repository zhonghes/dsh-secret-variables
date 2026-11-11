# Contributing

中文说明见文末。

## Ground rules

- **Never put a real secret in a test, fixture, issue, or commit.** Use obviously fake values such as `sk-test-...` and keep them short enough to be harmless.
- One change per pull request; describe the user-visible effect.
- No new runtime dependencies. The plugin intentionally ships without any.
- Keep the threat model honest: if a change weakens the guarantees in [docs/SECURITY.md](docs/SECURITY.md), update that file in the same PR.

## Development

```sh
node --test test/*.test.js
```

There is no build step. `client.js` runs directly in the Harness web UI; `src/` is plain ESM for the Host half.

When you change the Host half, re-enable the plugin in the plugin manager to reload it; when you change `client.js`, refresh the page.

## Commit messages

Short imperative subject, a blank line, then why the change is needed. English or Chinese is fine.

## Pull request checklist

- [ ] `node --test test/*.test.js` passes
- [ ] No real credentials, tokens, or personal paths in the diff
- [ ] Docs updated when behavior or the threat model changes

---

## 中文

- 测试里禁止放真实密钥，用明显假的短值即可。
- 一个 PR 只做一件事；无新增运行时依赖。
- 改动 Host 半需在插件管理器里重新启用插件；改 `client.js` 刷新页面即可。
- 若改动了安全边界，请同步更新 [docs/SECURITY.md](docs/SECURITY.md)。
