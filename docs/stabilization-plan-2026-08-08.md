# 2026-08-08 穩定化對帳與執行計畫

本文件將 2026-08-07 的全面專案稽核（基準 `main`／`b88fda9`）與目前工作樹重新對帳。稽核是靜態快照；以下狀態以本輪實際執行的程式、測試與 Chrome 結果為準。

## 本輪基線

| 項目 | 2026-08-08 實測 |
| --- | --- |
| 正式卡池 | 12 個資料檔、836 種卡號，全部可轉換 |
| Vitest | 177 個測試檔、2,814 項通過 |
| AI Browser smoke | 20／20 完成，`stuck=0` |
| 牌組編輯器 Browser smoke | 桌機 1366×768、手機 280×720，共 2／2 通過 |
| 好友房 Browser smoke | 雙瀏覽器開局、同步、攻擊預覽、資源、拒絕、斷線與連線失敗全數通過 |
| BS2 Browser 歷史回歸 | 藍／紫 60／60、紅／黃／綠 21／21，共 81／81 通過 |
| 主 bundle | 664.15 KiB raw／169.74 KiB gzip |
| 既有 budget | 850 KiB raw／180 KiB gzip，通過；gzip 已使用 94.3% |
| Production 相依套件 | `npm audit --omit=dev`：0 個漏洞 |
| 全部相依套件 | 5 個 high，均位於開發相依鏈，待獨立升級與回歸 |

## 已完成的穩定化工作

### S0-1：AI benchmark 改為真正的品質閘門

- 所有一般 AI 等級 benchmark 現在會強制檢查 `stuck`、`deadlock`、`invalid action`、`turn cap` 與完成場數皆為 0／完整。
- Lv.2→Lv.1、Lv.3→Lv.2、Lv.4→Lv.3、Lv.3→Lv.1、Lv.4→Lv.1 的既有目標勝率已從報表文字改為測試 assertion。
- 任一品質門檻失敗時，會將 seed、雙方牌組、初始／失敗狀態、command log 與錯誤摘要輸出為 `ReplayIssueBundle`；CI 失敗時上傳 `test-results/ai-benchmark/`。
- 新閘門實際抓出 4 個卡死對局：Lv.2→Lv.1 seed 19、Lv.3→Lv.1 seed 29、Lv.4→Lv.1 seed 26／29。
- 根因是空戰鬥區仍有餅乾可補位時，合法操作列舉器錯誤提供 `skip-replacement`。目前只有戰鬥區仍有其他餅乾，或確實沒有補位候選時，才允許略過。

### S0-2：CI 型別與 lint 訊號

- 一般 CI 已加入 `npm run typecheck`，明確覆蓋前端 `tsc -b` 與 `server:typecheck`。
- ESLint 改用 `--max-warnings=0`；修正 `useBattleActions` 的 Hook dependency warning。
- 本輪以非 silent 模式重跑 177 檔／2,814 項 Vitest，未再出現稽核提到的 React `act(...)`／stderr warning；若後續新增 warning，仍應修正根因，不能用隱藏輸出取代處理。

### S0-3：Chrome 與歷史卡牌回歸

- `test:ai:browser` 在系統 Google Chrome 找出一個真實互動 bug：手牌動作按鈕取得焦點時，`overflow: hidden` 的牌桌會被 Chrome 程式化捲動，造成 `pointerdown` 命中「登場」、但 `mouseup` 落到卡面而不會執行。
- `.table-area` 改用 `overflow: clip`，保留裁切效果並禁止焦點驅動捲動；正式 Chrome click 已確認手牌移除且效果框開啟。
- `break-to-trash` 測試狀態的場上餅乾改為至少 1 HP，避免 `0 HP` 餅乾與正式昏厥規則衝突。
- AI Browser 多解析度與互動 gate 已通過；BS2 五色 81 張歷史 Browser 情境也全部通過。

## 尚未完成

### 公開測試前仍需完成

1. **Current HEAD 真人 Playtest**：至少 5 人（2 位熟悉 Braverse、2 位熟悉其他 TCG、1 位非核心玩家），記錄首次完成一局比例、第一次合法操作時間、誤觸、付款錯誤、回應窗口漏看與 Battle Log 使用情況。自動 Browser 測試不能取代此項。
2. **發布基線決策**：確認是否以目前穩定化結果準備 `0.10.0`；在決定前不直接修改版號或建立 tag。
3. **Preview／Production 驗收**：本批合併後，重新確認 Vercel 前端、Render WebSocket、冷啟動與 rollback 步驟。

### 下一批工程硬化

1. 將 AI、牌組編輯器與好友房 Browser smoke 由 `main` push 後驗證提升為 PR gate，搭配 path filter 控制成本。
2. 升級開發相依鏈中的 `brace-expansion`、`postcss`、`shell-quote`／`concurrently` 與 `undici`，不得使用 `npm audit fix --force`；升級後重跑完整 CI 與 Browser gate。
3. 建立 Bundle Gate V2：計算 HTML 初始同步依賴圖、最大 chunk、初始 gzip、CSS gzip 與相對基線增幅。現行主 bundle gzip 已占 180 KiB 門檻 94.3%，不宜繼續只看單一 `index-*.js`。
4. 依序規劃 effect adapter 拆分、BattleScreen ViewModel、online protocol envelope（`protocolVersion`／`commandId`／`expectedStateVersion`）與英文／繁中 i18n。
5. 規劃官方素材緊急停用開關；既有「收到異議再移除」是已接受風險，不是風險解除。

## 新卡池凍結條件

在真人 Playtest、發布基線與 PR Browser gate 完成前，不再以新增 BS6+ 作為主線工作。卡牌官方勘誤與阻斷性規則 bug 仍可依既有候選／稽核流程處理。
