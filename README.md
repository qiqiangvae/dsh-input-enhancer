# dsh-input-enhancer

中文 | [English](README.en.md)

一个 **DeepSeek Harness Web 插件**，增强聊天输入框：

- 点击输入框旁的锁形按钮，**锁定 Enter 发送** + **放大输入框**。
- 锁定后**仍然可以正常编辑输入框中的内容**，但按 Enter 不会发送消息。
- 再次点击按钮即可解锁，恢复默认输入框大小与 Enter 发送。

## 功能起因

DeepSeek Harness Web 的输入框默认在按下 Enter 时立即发送消息，且输入框高度有限。以下场景很容易出错：

- 使用中文输入法时，按 Enter 只是为了确认候选词，但消息被直接发送；
- 编辑长提示词、代码或结构化文本时，想继续编辑，却误按 Enter；
- 需要录入大段文字时，默认输入框太小、写起来憋屈；
- 输入框中的内容还没有编辑完，就意外进入了发送流程。

该插件补上了「发送前先解锁」这层保护，并在锁定同时放大输入框，方便长文编辑。

## 聚焦的功能

- **锁形按钮**：注册在官方 `conversation.input.right` 槽位，显示在输入框右下角、发送按钮附近；锁定状态为醒目的红色填充。
- **锁定 ⇔ 放大联动**：锁定即进入「长文本编辑模式」，输入框立即放大（`min-height: 40vh`），自动长高上限从默认 `336px` 抬到 `60vh`；解锁即恢复默认大小。
- **按会话隔离**：每个会话独立保存锁状态，切换会话互不影响。
- **不替换官方输入框**：只拦截键盘提交路径与叠加放大样式，保留官方输入状态机、命令菜单、队列、附件等能力。
- **中文输入法友好**：IME 组合期间的 Enter 永远放行。

## 状态样式说明

| 状态 | 锁图标样式 | 输入框 | 含义 |
| --- | --- | --- | --- |
| 解锁（普通状态） | 灰色描边图标 | 默认大小 | 当前 Enter 可正常发送消息 |
| 锁定（关锁状态） | **红色填充 + 白色锁图标** | **放大** | 当前 Enter 无法发送消息 |

鼠标悬浮到锁图标上时，tooltip 会显示当前状态的提示：

- 解锁：`已解锁，输入框为默认小大，Enter 可正常发送`
- 锁定：`已锁定并放大输入框，Enter 不会发送消息`

## 可以防止什么行为

锁定状态下，以下键盘发送行为都会被阻止：

- 普通 `Enter` 发送；
- `Ctrl+Enter` / `Cmd+Enter` 发送；
- 其他会触发官方提交路径的 Enter 组合；
- 尚未编辑完成的输入内容被意外提交。

同时保留这些正常行为：

- `Shift+Enter` 仍然插入换行；
- 输入法候选词确认的 Enter 不受影响；
- 输入框内容的编辑、复制、粘贴、附件操作不受影响；
- 鼠标点击官方发送按钮仍然可以发送——锁只防键盘误触。

## 三击回车解锁并发送

锁定状态下，如果临时想发送当前内容，无需先点锁：**连按 3 次 Enter**（每次间隔在 800ms 内）即可解锁并立即发送。

- 前两次 Enter 不会有任何副作用（不发送、不换行），只是累计计数；
- 连按 2 次后锁图标会**闪烁**一次，提示「再来一下」即可发送；
- 第 3 次 Enter 触发解锁并立即发送当前输入内容；
- 计数窗口超时、按了其他键、或切换会话都会重置计数。

> 注：三击解锁仅对已锁定的输入框生效；对空输入框不会发送空消息。

## 快捷键（后续待开发）

锁按钮本身之外，`Ctrl+Alt+L`（macOS 为 `Cmd+Alt+L`）等全局快捷键目前列为**后续待开发工作**。当前版本请使用输入框旁的锁按钮进行锁定和解锁；三击回车作为锁定态下的「解锁并发送」逃生门已经可用。

## 环境要求

- DeepSeek Harness `0.1.0-rc.6` 或更新版本；
- `web` profile；
- 基于 Chromium 的现代浏览器（Chrome / Edge 均可）。

## 安装

### 方式一：从本仓库 GitHub 安装

```sh
dsh plugin --profile web add github:qiqiangvae/dsh-input-enhancer
```

也可以显式使用 Git URL：

```sh
dsh plugin --profile web add https://github.com/qiqiangvae/dsh-input-enhancer.git
```

建议锁定到某个 commit 以保证可重复安装：

```sh
dsh plugin --profile web add 'github:qiqiangvae/dsh-input-enhancer#<commit-sha>'
```

### 方式二：从本地目录安装

```sh
git clone https://github.com/qiqiangvae/dsh-input-enhancer.git
dsh plugin --profile web add ./dsh-input-enhancer
```

### 验证安装

```sh
dsh --profile web --dump-config | grep dsh-input-enhancer
```

应能看到类似输出：

```yaml
# == dsh-input-enhancer
- id: dsh-input-enhancer
  name: dsh-input-enhancer
```

安装完成后重启 `dsh web` 并刷新页面。

## 使用方法

1. 启动 DeepSeek Harness Web：

   ```sh
   dsh web
   ```

2. 在聊天输入框右下角、模型选择器和发送按钮附近找到锁形按钮。

3. 锁定 / 解锁方式：

   - 点击输入框右下角的锁形按钮。

4. 锁定状态下：

   - 输入框**放大**，方便长文本编辑。
   - 普通 `Enter`：不发送。
   - `Ctrl+Enter` / `Cmd+Enter`：不发送。
   - `Shift+Enter`：仍然插入换行。
   - 输入法组合期间的 Enter：正常用于候选词确认，不受影响。
   - 点击官方发送按钮：仍可发送，锁只防键盘误触。
   - **连按 3 次 `Enter`**（每次间隔 800ms 内）：解锁并立即发送。

5. 锁状态按会话独立保存，刷新页面或重启后自动清除。

## 配置

插件默认零配置，不需要填写 API Key、设置项或 `settings.yaml`。锁状态仅保存在浏览器内存中。

## 功能与限制

- 锁定状态只保存在浏览器内存中，不写 `settings.yaml`，不发起网络请求。
- 插件使用官方 `conversation.input.right` 槽位，不替换官方 composer。
- 放大通过 CSS 变量实现（`min-height` 与 `--dsh-composer-text-max-height`），不修改官方组件逻辑；官方底部定位锚点 `--dsh-composer-height` 会随高度自动重算。
- 不干扰其他输入框、按钮、浏览器快捷键或全局快捷键。

## 疑难排查

### 输入框旁边看不到锁按钮

1. 确认插件已挂载：

   ```sh
   dsh --profile web --dump-config | grep dsh-input-enhancer
   ```

2. 重启 `dsh web` 并强制刷新页面（`Ctrl+F5`）。
3. 确认当前使用的是 `web` profile。

### 快捷键无法使用

快捷键功能当前尚未开放，属于后续待开发工作。请使用输入框旁的锁按钮操作。锁状态按会话保存：切换到新会话后，新会话默认是解锁状态。

### 锁定后仍然“发送”了

- `Shift+Enter` 是换行，不是发送。
- 鼠标点击官方发送按钮是刻意操作，锁不会阻止。
- 如果输入框中的内容意外发送，请检查锁按钮是否显示为红色填充的锁定状态，以及是否使用了其他 Enter 组合键。

### 锁定后输入框没有放大

- 确认锁按钮已变为红色填充的锁定状态。
- 若你曾通过其他插件或主题覆盖了 `--dsh-composer-text-max-height` 或 `[data-composer-card]` 的 `min-height`，本插件的放大样式可能被覆盖，请排查样式冲突。

## 卸载

```sh
dsh plugin --profile web remove dsh-input-enhancer
```

## 开发与构建

安装本仓库不需要构建：`lib/` 已提交预构建产物，且没有 `prepare` / `postinstall` 脚本。

如需修改源码后重新生成构建产物：

```sh
npm run build   # 生成 lib/index.js 与 lib/client.js
npm run check   # 结构检查
```

## 目录结构

```text
dsh-input-enhancer/
├── package.json          # dsh.bundle + dsh.client 插件声明
├── cordis.patch.yml      # profile bundle patch
├── src/
│   ├── index.js          # Host 半部（无依赖 no-op）
│   └── client.js         # Web 半部：按钮、Enter 拦截与放大样式
├── lib/                  # 构建产物
├── scripts/
│   ├── build.mjs
│   └── check.mjs
├── README.md
├── README.en.md
└── LICENSE
```

## 更新说明（从 dsh-enter-lock 更名而来）

本插件由 `dsh-enter-lock` 更名并增强而来。若你之前安装了旧名插件，请先卸载再安装本插件：

```sh
dsh plugin --profile web remove dsh-enter-lock
dsh plugin --profile web add github:qiqiangvae/dsh-input-enhancer
```

新版本在「锁定 Enter 发送」基础上新增「锁定即放大输入框」能力，适合长文本编辑场景。

## License

[MIT](./LICENSE)
