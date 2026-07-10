# 迴圈工程（Loop Engineering）

最後更新：2026-07-10。本專案的迭代開發方法：不做一次性大爆改，每輪小範圍推進並完整驗證。

## 變更風險分級

不同類型的變更走不同驗證流程，避免小修改被過重流程拖慢，但不可跳過必要驗收。

### 完整流程（Verify + Review）

以下類型變更必須走完整六步驟（Plan → Patch → Verify → Review → Document → Commit-ready），不可縮短：

- **規則引擎**（`src/game/` 邏輯、效果執行、費用、時機、勝負）
- **卡牌池**（`data/cards/`、`src/cards/` 轉接層、效果解析、卡牌匯入）
- **AI 決策**（`src/game/ai.ts`、AI 等級、對戰行為）
- **線上對戰**（WebSocket、server、連線狀態、房間管理）
- **安全相關**（權限、資料驗證、輸入消毒）
- **部署與 CI**（build pipeline、CI workflow、vercel.json、環境變數）

### 短流程（lint/build + 受影響操作）

以下類型可走短流程，但仍須通過 `lint` + `build` 並驗證受影響的實際操作：

- **純文案**（UI 文字、錯誤訊息、工具提示）
- **小樣式**（CSS 微調、間距、顏色，不涉及版面結構或 RWD）
- **文件格式修正**（不涉及規則或流程變更的 typo、格式調整）

短流程不可跳過的必要驗收：
- `npm run lint` + `npm run build`
- 實際瀏覽器確認受影響畫面正常
- 若涉及卡片顯示文案，仍需確認卡牌詳情 modal 可正常呈現

## 每輪六步驟

1. **Plan** — 說明本輪目標與修改範圍；超出範圍的發現記入 roadmap / known-risks，不順手擴scope。
2. **Patch** — 小範圍修改；架構、資料庫、部署、安全或大規模重構必須先提計畫等維護者確認。
3. **Verify** — `validate:cards → test → lint → typecheck → build` 全綠；UI 變更加瀏覽器驗證；行為變更需實際觀察（不能只靠型別檢查通過）。
4. **Review** — 列出風險、未完成項、下一輪建議；同一錯誤修兩次仍失敗就停下做根因分析。
5. **Document** — 同步 docs（roadmap 狀態、known-risks、CHANGELOG Unreleased、流程文件）；改規則必改文件。
6. **Commit-ready** — 英文 conventional commit、開 PR（保持 open 等交叉驗證，見 [release-process.md](release-process.md)）。

## 每輪輸出格式

- 本輪修改檔案
- 本輪完成事項
- 測試結果（實測數字，不引用舊數字）
- 是否有失敗
- 下一輪建議
- 是否需要人工決策

## 多 agent 協作慣例

- 分支前綴標明來源：`claude/`、`codex/`；PR 標題加 `[claude]` 等前綴。
- PR base `main` 但不立即合併，由維護者以另一平台交叉驗證後手動合併。
- 同時存在多支 open PR 時，各分支避免修改彼此已動過的檔案；有依賴就 stack 並註明。
- 維護者以「同意執行 X」授權動工；完成後回報 PR 連結即停，不催合併。

## 硬邊界（所有輪次適用）

- 每個玩家操作經過規則層驗證；UI/AI 不另寫權威規則。
- 不刪重要資料或卡牌資料，除非先備份或說明原因。
- 不改核心遊戲規則而不更新文件；待確認官方規則不得寫成已完成。
- 不新增大型依賴，除非說明理由與替代方案。
- 不在無測試與驗收下合併重大重構。
