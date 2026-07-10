# Release 流程（Release Process）

最後更新：2026-07-10。適用於所有進入 `main` 的變更；新卡牌另見 [card-update-process.md](card-update-process.md)。

## 1. 分支與 PR 慣例

1. 從最新 `origin/main` 開分支（先 `git fetch`）。
2. 分支命名標明來源 agent：Claude 用 `claude/<topic>`、Codex 用 `codex/<topic>`；PR 標題加 `[claude]` 等對應前綴。
3. **PR base `main` 但保持 open**：由維護者以另一個 agent 平台交叉驗證、Vercel preview 驗收後，自行決定合併時機。agent 不代為合併。
4. 若新工作依賴尚未合併的 PR，stack 在該 PR 分支上並在描述註明依賴順序；互不依賴則從 main 開，且**避免修改其他 open PR 已動過的檔案**以減少衝突。
5. Commit 訊息使用英文（conventional prefix：feat / fix / docs / refactor / style / test / chore）。

## 2. 提交前驗證門檻（全綠才可開 PR）

```bash
npm run validate:cards   # 卡牌資料完整性
npm test                 # 1449+ 項單元測試
npm run lint
npm run typecheck        # app + server 全量型別檢查
npm run build            # tsc -b + vite build（不可只跑 tsc --noEmit）
```

- UI 變更另跑瀏覽器驗證（`npm run build` 後 `npm run test:ai:browser`），並依 [manual-playtest-checklist.md](manual-playtest-checklist.md) 抽查受影響流程。
- AI 行為變更需確認等級門檻測試與 5×5 對局矩陣未退化。
- 回歸重點見 [regression-test-checklist.md](regression-test-checklist.md)。

## 3. PR → 部署管線

1. 開 PR 後 GitHub Actions 自動執行 `validate:cards → test → lint → build`。
2. Vercel Git Integration 自動產生 **Preview URL**：在 preview 上做可玩性驗收（開局、對戰、牌組編輯器、重新整理不 404）。
3. 維護者交叉驗證通過後合併；合併進 `main` 觸發 Vercel production 部署。
4. 線上對戰 server（Render）與 Vercel 前端分離部署；server 變更合併後 Render 自動重建（見 [online-server-hosting.md](online-server-hosting.md)）。

## 4. 合併後

1. 確認 `main` 的 CI 綠燈與 production 部署成功。
2. `CHANGELOG.md`：合併時將對應項目從 `[Unreleased]` 移到日期段落（PR 內先寫在 Unreleased）。
3. 有新規則裁定、工作流程變更時同步 `AGENTS.md` / 相關 docs / 專案 Skills。
4. 重大功能合併後執行一次手動 playtest 抽查（[manual-playtest-checklist.md](manual-playtest-checklist.md)）。

## 5. 版本策略

目前為持續部署（main = production），CHANGELOG 以日期記錄。若未來對外發布正式版本，再引入語意化版號與 git tag；屆時於本文件補充 tag 與 release note 流程。
