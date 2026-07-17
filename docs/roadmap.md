# Roadmap

最後更新：2026-07-17。歷史完成項見 [CHANGELOG.md](../CHANGELOG.md) 與 [audit-report.md](audit-report.md) §4 的 Phase 對照。

> 2026-07-17 驗證補充：線上 modal RWD smoke 通過；最新主 bundle 為 509.25 KiB raw / 133.22 KiB gzip，通過 budget。好友房完整開局驗證本輪在起始餅乾同步檢查失敗，尚未宣稱通過。
> AI、牌組編輯器與好友房 Playwright smoke workflow 已於 main push 自動觸發，並保留手動觸發供調查使用。

## 已完成里程碑（摘要）

- **規則引擎**：純函式引擎、GameCommand 指令層（8 決策 + 24 動作）、commandLog、replay（含 AI 對局重播）、1689 項測試（119 檔，目前基線）；多段能力效果已有 8 類中途決策阻擋與看牌決策恢復回歸。（PR #11 等）
- **牌組編輯器**：搜尋/篩選/合法性檢查/匯入匯出/版本化儲存。（PR #11）
- **AI Lv.1–4**：隨機 / 啟發式 / 評估式 / 兩層前瞻 + matchup 資料驅動評估；20 份 BS2 訓練文件。（PR #12/#13、commit `076e7a5`）
- **卡牌池**：BS1/BS2 + 五色起始牌組匯入；25 張未支援卡效果補齊。（PR #17）
- **UI 多輪重製**：滿版桌墊 HUD、扇形手牌、統一效果 modal、EffectPanel/陷阱/攻擊 modal 改版。（PR #16/#20/#21）
- **線上對戰 MVP**：ws server、房間、遮罩狀態、OnlineBattleView；開局已整合私密猜拳、勝者選順位、依序調度、補償與起始餅乾同步揭示，本機雙瀏覽器已自動驗證完整開局、主階段同步、對手離線與伺服器無法連線的錯誤恢復。（Phase 5 分支已進 main）
- **對戰可視化 P0–P2（2026-07-17）**：P0 中央提示統一顯示玩家／階段／來源卡／等待原因、攻擊箭頭與事件句型；P1 加入宣告 → 費用 → 代價 → 目標 → 結算進度、對手公開卡牌預覽與陷阱／FLIP／攻擊效果回應狀態；P2 加入 commandLog 篩選、同步／拒絕／斷線提示與伺服器提供的 45 秒決策期限顯示；另修正線上攻擊支付候選清單遺漏，BS1-007 中性攻擊費用可正常選取。線上提示只投影公開區域，未加入自動超時決策。
- **BS1-037 攻擊後效果（2026-07-17）**：本機與線上共用 LV.1 目標候選判定，沒有合法目標時不建立等待提示；攻擊後效果提示整合來源卡、效果文字與付款／目標操作，玩家可用「略過」跳過可選效果。
- **CI**：GitHub Actions test/lint/build + main push Playwright smoke；Vercel Dashboard 已匯入。

## 待辦（依優先序）

### P0 — 授權與公開部署安全 ✅（2026-07-10 完成）

| 項目 | 結果 |
|---|---|
| 網站 footer 非官方聲明 | ✅ 主選單 footer 已加（README 同日補上） |
| PUBLIC_MODE 素材策略 | ✅ 決策：維持官方卡圖熱連結、不做 PUBLIC_MODE，收到異議再處理（[ip-and-asset-policy.md](ip-and-asset-policy.md) §4） |
| LICENSE | ✅ MIT + Devsisters 素材除外條款 |

### P1 — 補齊工程管線（2026-07-10 大部分完成）

| 項目 | 狀態 |
|---|---|
| `validate:cards` | ✅ `scripts/validate-cards.ts`（必填欄位、同檔重複卡號、卡池 311 種全數可轉換 GameCard、效果文字未轉出偵測）；已接入 CI 第一步。首跑即抓到 BS2-061@1 缺 level 的資料缺陷（已修＋匯入腳本加異圖回填） |
| `vercel.json` | ✅ SPA rewrite（assets 除外）；已於 Production 網域驗證可正常載入 |
| `npm run typecheck` | ✅ `tsc -b && server:typecheck`（app + server 全量型別檢查） |
| Render 部署準備 | ✅ 已部署（commit a679f03）並完成雙視窗公網對局驗證；本機 `test:online:match:browser` 另自動覆蓋核心好友房生命週期。詳見 [online-server-hosting.md](online-server-hosting.md)。Render Free 閒置會休眠，首次連線需等待喚醒 |
| WebSocket 用戶端生命週期 | ✅ 單一有效連線、90 秒開啟／10 秒首次回應 timeout、舊連線競態與 error/close/錯誤協定防護；hook 與雙瀏覽器負向路徑已有回歸 |
| WebSocket 伺服器入站驗證 | ✅ 已完成（2026-07-14）：共用協定層驗證 ClientMessage 外框、牌組欄位與全部 GameCommand 必填／選填欄位；格式錯誤訊息依連線狀態安全拒絕，不再直接以型別 cast 進入伺服器。線上戰場也會顯示 `command-rejected` 原因，並在下一個合法 state update 後清除。 |

### P2 — 維護流程正式化 ✅（2026-07-11 確認完成）

| 項目 | 狀態 |
|---|---|
| [CHANGELOG.md](../CHANGELOG.md) | ✅ 已從 README 抽出，獨立版本紀錄，每次 PR 於 `[Unreleased]` 段落記錄 |
| [release-process.md](release-process.md) | ✅ 分支/PR 慣例、驗證門檻、部署管線、合併後步驟俱全；本輪修正「1449+」寫死數字為動態基線敘述 |
| [card-update-process.md](card-update-process.md) | ✅ 11 步流程（匯入→validate→effectId→resolver→測試→AI smoke→UI 檢查→changelog→PR→preview→合併）文件化 |
| [regression-test-checklist.md](regression-test-checklist.md) | ✅ 自動化門檻、AI 行為、歷史回歸熱點、瀏覽器級、資料部署五個章節 |
| [manual-playtest-checklist.md](manual-playtest-checklist.md) | ✅ 既有，涵蓋開局/回合戰鬥/效果/牌組編輯器/線上對戰/RWD/部署驗收 |

### V1 退出檢查（目前待完成）

| 項目 | 狀態 |
|---|---|
| 真人試玩證據 | ⏳ 依 [manual-playtest-checklist.md](manual-playtest-checklist.md) 完成至少 1–2 場，記錄規則疑點、AI 體感、牌組編輯器操作阻力與 UI 可讀性 |
| 外部健康稽核 | ⏳ 本輪 main push 後確認 GitHub Actions、Vercel Production 與 Render WebSocket 實際健康；本機綠燈不代替外部狀態 |

### P3 — 產品深化（觀察後再投入）

| 項目 | 內容 | 前置 |
|---|---|---|
| 指令層收尾 | ✅ 已完成（2026-07-12）：玩家 UI、攻擊宣告、多段效果、補位排程與全部 AI battle／turn handler 皆走 `applyGameCommand`；`refresh-deck` 由 AI 將 `shuffleSeed` 寫入 command payload，完整 commandLog 可重播。 | — |
| AI Lv.5 | 牌組理解與策略傾向（設計稿見 [ai-levels.md](ai-levels.md)） | ✅ 已完成觀察（2026-07-11，見 [ai-lv3-lv4-observation-2026-07-11.md](ai-lv3-lv4-observation-2026-07-11.md)）：7 場對局逐字紀錄讀過＋儀器化驗證，結構健康、無急迫缺陷；建議暫緩開發，先由使用者跑 1–2 場真人對局做最終確認 |
| Bundle code-split | ✅ 已完成（2026-07-11）：戰鬥資訊模組（`InformationModals`／`BattleResponseModals`／`DamageEffectModals`／`PendingDecisionModals`／`GameModals.tsx` 內的 `ResultModal`／`OpeningSetupModal`）改為 `React.lazy` + `Suspense`；主 bundle 由約 806.92 KB 降至 730.68 KB raw（167.17 → 152.26 KB gzip），仍有 >500 KB 警告 | 後續可視情況再拆 `EffectPanel`（目前未加 Suspense 邊界，改動較大） |
| UI reference wireframe 文件 | ✅ 已完成（2026-07-11）：[docs/official-ui-reference.md](official-ui-reference.md)（官方截圖對標分析）＋ [docs/ui-reference/](ui-reference/) 六份 wireframe（戰場／主選單／牌組編輯器／卡牌 modal／行動裝置 RWD／線上對戰面板），採「記錄現行 UI ＋ W 系列標注下一步改進」混合形式；本輪依實機驗證更新主選單空狀態與新增線上對戰面板 wireframe，並回填 [ui-audit-2026-07-11.md](ui-audit-2026-07-11.md) 的 P0 已解決狀態 | 與 UI 迭代並行維護 |
| 拖移卡牌 | 拖放只做輸入層，仍走規則 API（AGENTS.md 已有約束） | UI 穩定後 |
