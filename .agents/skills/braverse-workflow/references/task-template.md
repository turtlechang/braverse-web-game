# Braverse 任務模板

用於開新 thread、整理需求、或交給 OpenCode Go 前壓縮上下文。

## 任務分類

- `rules`：規則引擎、卡牌效果、費用、時機、勝負、Refresh。
- `ui`：React 畫面、版面、互動、動畫、瀏覽器驗收。
- `ai`：AI 決策、完整對戰、自動操作上限、deterministic 策略。
- `tests`：單元測試、瀏覽器驗證、回歸種子、測試工具。
- `git-review`：diff、分支、提交、PR、CI 或 review comment。
- `docs-workflow`：AGENTS、Skill、README、流程、驗證模板。

## 使用者開場模板

```text
任務類型：rules / ui / ai / tests / git-review / docs-workflow
目標：
相關檔案：
不可修改：
驗收標準：
需跑驗證：
是否允許使用 sub-agents / OpenCode Go：
備註：
```

## 派工唯讀分析模板

```text
請唯讀分析，不要修改、stage 或 commit。

範圍：
- 檔案：
- 問題：

輸出：
1. 結論
2. 證據（檔案與行號）
3. 建議修改範圍
4. 未確認事項
```

## 實作派工模板

```text
請直接修改，但不要 stage 或 commit。

任務類型：
目標：
必讀檔案：
允許修改：
不可修改：
驗收標準：
需執行驗證：
回覆格式：修改檔案、驗證結果、風險或待確認事項。
```
