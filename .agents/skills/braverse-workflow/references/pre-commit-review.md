# Pre-Commit Review

提交前用這份清單確認範圍乾淨、驗證可追溯。

## Git 檢查

```powershell
git status --short --branch
git diff --check
git diff --stat
git diff
```

## 範圍檢查

- 只 stage 本次任務檔案。
- 排除無關工作區變更與未追蹤檔案。
- 不提交 `node_modules/`、`dist/`、`test-results/`、建置產物、測試截圖、密鑰、Token 或個人認證資料。
- 若修改功能或準備 commit，更新 `README.md` 的「開發背景」、「目前進度」與「下一步計畫」。
- 若測試總數或瀏覽器驗證範圍改變，同步更新 `AGENTS.md` 與 `README.md`。

## 回報模板

```text
變更範圍：
已排除檔案：
驗證：
- pass/fail/未執行（原因）
已知風險：
commit 訊息草案：
```
