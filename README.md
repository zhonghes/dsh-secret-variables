# dsh-secret-variables

[简体中文](README.md) | [English](README.en.md)

DeepSeek Harness 插件：让密钥不出现在模型的上下文里。

你只声明一次变量，模型看到的永远是 `$DSH_SECRET_<NAME>`，真值在执行一次性 `bash` / `pwsh` 命令时才被注入环境变量。值不会进入提示词、工具结果、会话日志，也不进插件自己的元数据存储。

```
   你设置值                    Host 保存                    模型看到
   ─────────                   ─────────                    ────────
   OPENAI_API_KEY=sk-…  ──►    凭据存储（0600）  ──►        $DSH_SECRET_OPENAI_API_KEY
                                    │
                                    ▼
                          执行命令时的 bash/pwsh 环境
```

## 能做什么

- **四个作用域**：全局（全部项目或指定项目）、项目、会话，以及从对话里自动识别的密钥。
- **每行一个开关**：某个全局密钥只在本项目 / 本会话启用，不用改值。
- **值对界面只写不读**：输入后由 Host 凭据接口保存，之后不再显示。
- **脱敏**：工具输出与历史里出现的已知值会替换成引用（短于 12 字符的值仍会注入，但不参与文本替换）。
- **守卫**：常驻终端等不注入值的 shell 里使用引用会被明确拒绝，而不是悄悄展开成空串。

## 界面入口

```
入口在哪
├─ 侧栏 → 🔑 密钥管理                全局作用域
├─ 工作区行 ⋯ → 密钥管理             本项目
└─ 会话标签行 → 密钥管理             本会话
```

### 全局页

```
全局页
├─ 添加行：名称 · 值 · 生效范围 · ☐ 创建后启用 · 添加
└─ 变量行，一行一条：
   ├─ OPENAI_API_KEY  $DSH_SECRET_OPENAI_API_KEY  全部项目 · 已设置 · ● · 更换值 · ✕
   └─ GITHUB_TOKEN    $DSH_SECRET_GITHUB_TOKEN     dsh、tmp · 已设置 · ● · 更换值 · ✕
```

一行从左到右：

| 部分 | 显示什么 | 例子 |
| --- | --- | --- |
| 名称 / 环境变量 | 模型看到的引用 | `OPENAI_API_KEY` · `$DSH_SECRET_OPENAI_API_KEY` |
| 生效范围 | 在哪里可用 | `全部项目` / `dsh、tmp` |
| 状态 | 值是否已设置 | `已设置` |
| 开关 | 在该作用域是否启用 | ● |
| 操作 | 更换值、删除 | `更换值` · `✕` |

生效范围是下拉：默认 **全部项目**，每个项目一个勾选项；勾项目自动取消「全部项目」，取消最后一个自动回退到它。同一作用域重名会被拒绝，不同作用域同名是覆盖机制。

名称用大写字母、数字和下划线（`SERVICE_PURPOSE` 形式，例如 `OPENAI_API_KEY`）；环境变量名会自动加 `DSH_SECRET_` 前缀，含非拉丁字符的名称会取稳定哈希作为后缀。

### 项目页（工作区行「⋯」→ 密钥管理）

```
密钥管理 · 项目
├─ 本项目变量 1 —— 本项目内共享
│  └─ DATABASE_URL · $DSH_SECRET_DATABASE_URL · 已设置 · ● · 更换值 · ✕
└─ 全局变量 1 —— 所有项目可用，改值请到全局页
   └─ OPENAI_API_KEY · $DSH_SECRET_OPENAI_API_KEY · 已设置 · ● · 请在所属页修改
```

### 会话页（对话 | 轨迹 | 密钥管理）

```
密钥管理 · 本会话
├─ 本会话变量 1 —— 仅本会话可用
│  └─ SENTRY_AUTH_TOKEN · $DSH_SECRET_SENTRY_AUTH_TOKEN · 已设置 · ● · 更换值 · ✕
├─ 本项目变量 1 —— 本项目内共享
│  └─ DATABASE_URL · $DSH_SECRET_DATABASE_URL · 已设置 · ● · 请在所属页修改
├─ 全局变量 1 —— 所有项目可用
│  └─ OPENAI_API_KEY · $DSH_SECRET_OPENAI_API_KEY · 已设置 · ● · 请在所属页修改
└─ 自动检测 1 —— 从对话中识别，仅本次会话
   └─ AUTO_1 · $DSH_SECRET_AUTO_1 · 已设置 · ● · 自动
```

## 安装（源码）

需要 DSH **>= 0.2.2-rc.1**、Node **>= 20**。只发源码，未发布到 npm。

包内自带 bundle patch（`dsh.bundle.patch`），按 bundle 装进 profile：

```sh
dsh plugin --profile web add <本仓库地址>
```

重启 DSH，确认插件管理器里 `@local/dsh-secret-variables` 已启用（直接在插件管理器里安装 bundle 效果相同），侧栏就会出现「密钥管理」。

## 使用

模型写引用，Host 在执行时把值换成环境变量：

```sh
curl -s -H "Authorization: Bearer $DSH_SECRET_OPENAI_API_KEY" https://api.example.com/
```

未登记的密钥出现在对话里时，会被自动转成 `$DSH_SECRET_AUTO_n` 并列在「自动检测」下（仅本次会话，不落盘）。

## 作用域与优先级

| 作用域 | 入口 | 生命周期 |
| --- | --- | --- |
| 全局 | 侧栏「密钥管理」 | 删除前一直有效，落盘 |
| 项目 | 工作区行「⋯」 | 删除前一直有效，落盘 |
| 会话 | 会话标签页 | 会话销毁为止，落盘 |
| 自动 | 对话中识别 | 仅进程内存 |

按归一化名称（忽略大小写）从会话 → 项目 → 全局解析，越具体优先级越高；同一作用域内不允许同名。

## 安全模型

插件防的是**意外泄漏**：值不进提示词、工具结果、日志和接口响应。它**不防**有 shell 的 agent 主动提取（例如 `base64 $DSH_SECRET_X`），也不防同用户进程直接读凭据文件。完整「保证 / 不保证」见 [docs/SECURITY.md](docs/SECURITY.md)。

## 开发

```sh
node --test test/*.test.js
```

105 个测试，无第三方依赖，无构建步骤；`client.js` 由 Harness Web 直接加载。见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
