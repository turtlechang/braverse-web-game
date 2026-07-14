---
name: braverse-workflow
description: 規劃、拆分、分派、驗證與提交前檢查 Braverse 任務。處理任務契約、Codex 模型路由、平行代理、OpenCode Go 備援、驗證層級、Git review、AGENTS.md 或 Skill 工作流調整時使用；實作細節搭配 develop-braverse。
---

# Braverse 工作流

用最小任務契約管理 Braverse 工作的範圍、執行者、驗證與提交準備。需要修改遊戲功能、規則、UI 或 AI 時，搭配 `develop-braverse`。

## 快速流程

1. 將任務分類為 `rules`、`ui`、`ai`、`tests`、`git-review` 或 `docs-workflow`。
2. 依 [references/task-template.md](references/task-template.md) 建立最小任務契約。
3. 由 Codex 主線直接執行；需要模型分級、平行代理或外部備援時，讀 [references/delegation-template.md](references/delegation-template.md)。
4. 依 [references/verification-levels.md](references/verification-levels.md) 選擇必要驗證。
5. stage 或 commit 前執行 [references/pre-commit-review.md](references/pre-commit-review.md)。

## 依需求載入

- 新任務或新 thread：讀 `task-template.md`。
- 驗證決策：讀 `verification-levels.md`。
- Codex 模型分級、subagent 或 OpenCode Go：先讀 `delegation-template.md`；只有確定使用 OpenCode Go 時，才讀 `../develop-braverse/references/delegation.md`。
- commit 準備或 diff review：讀 `pre-commit-review.md`。

## 邊界

- 以根目錄 `AGENTS.md` 為硬規則入口。
- 不弱化 `AGENTS.md` 與 `develop-braverse` 的規則層、UI、AI、Git 或安全邊界。
- Codex 是預設主線；OpenCode Go 僅用於溢出、備援、低風險平行工或第二意見。
- 不讓多個執行者同時修改相同檔案或同一責任區。
- 將歷史 bug 矩陣與供應商模型細節留在 references 或 README，不放進每個任務提示。
