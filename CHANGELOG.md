# Changelog

本專案的重要變更記錄。格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)；由於尚未對外發版，目前以日期為單位記錄，未採語意化版號。歷史記錄自 README 遷移而來（2026-07-10）。

## [Unreleased]

- 🛡️ R15 解決：陷阱 `trash-to-deck` 效果新增獨立的 `trashToDeckIds` 欄位（2026-07-12）。BS2-079（「選最多 1 張對手餅乾降攻」+「選最多 5 張非 FLIP 棄牌區卡片洗回牌庫」）先前第二段效果誤用第一段共用的 `targetIds`，已避免例外但效果靜默無選擇；盤點全卡池確認唯一受影響的陷阱只有 BS2-079，改比照陷阱系統既有慣例（`supportTrashIds`／`handToSupportIds` 等專屬欄位模式）新增 `trashToDeckIds`，而非套用物品/技能的通用 `effectTargets` 陣列（陷阱效果迴圈的特例邏輯與 `executeAbilityEffects` 不相容，硬套用不成比例）。同時修復 AI `chooseEffectTargets`（`ai.ts`）對 `trash-to-deck` 一律回傳空陣列的缺口，此缺口先前也讓物品的 trash-to-deck 效果對 AI 完全無效。已貫穿引擎（`battle.ts`／`commands.ts`）、AI（`ai/battle-handler.ts`）、人類 UI（`useMatchController.ts`＋`TrapResponseModal`）三層新增回歸測試；線上對戰陷阱 trash-to-deck 選擇 UI 尚未實作（比照既有 support-to-hand/hand-to-support 線上限制，離線對局已完整支援）。
- 🐛 真人試玩回報修復（2026-07-12，[manual-playtest-checklist.md](docs/manual-playtest-checklist.md) 試玩紀錄）：
  - 線上對戰攻擊方在對手決定陷阱/Blocker/FLIP 時無任何等待提示，體感等同卡死；`OnlineBattleView.tsx` 狀態列新增 `opponentDecisionLabel`，涵蓋 trap/flip/attack-effect 三種待決策階段。
  - BS2-077 `trashBattleCookie` 物品代價完全未執行就結算效果：補齊 `PlayItemCommand`／`playItem()`／`payAbilityCost`／AI `chooseAbilityCostIds`／人類互動流程 `begin-play-item` 的欄位與邏輯，新增回歸測試。
  - BS2-079 陷阱「棄牌洗回牌庫」後續效果從未轉出：`official-effect-adapter.ts` 補上 `trash-to-deck` 效果；發現陷阱系統只有單一共用 `targetIds`（無法比照物品/技能逐效果選目標），已避免例外崩潰但效果本身仍是靜默無選擇，記錄為新風險 known-risks R15。
  - BS2-058「攻擊後續效果邏輯錯誤」複現後查出實為 UI 顯示錯誤文字：`EffectPanel.tsx` 誤讀 `sourceCard.effectText`（卡牌固定技能文字）而非 `pendingEffect.skill.text`（依當下情境正確設定），導致攻擊後續效果提示框顯示成 OnPlay 技能文字。條件/目標/傷害邏輯本身正確，已修正顯示欄位並補回歸測試；另新增 `battle-attack-effect.test.ts` 端到端整合測試，實跑「攻擊 → 主傷害 → 條件判定 → 後續傷害」全流程驗證攻擊方棄牌區達 15 張前後兩種結果；並補上 `usePendingEffect.test.tsx` hook 層測試，用真實 attack-effect `pendingBattle` 狀態驗證 hook 給 UI 的 `pendingEffect.skill.text` 確實是攻擊文字，串起轉換／hook／UI／規則四層驗證。
- 🌐 好友房 WebSocket 生命週期硬化：以單一有效連線防止舊 socket 覆寫新連線，CONNECTING 階段可安全離開，加入房間立即保留房號；新增 90 秒 Render 冷啟動與 10 秒首次回應 timeout、非預期 error/close、constructor/send 失敗、錯誤 JSON／GameState envelope 防護及合法私人協定 close code。新增 10 項 hook 回歸，並擴充雙瀏覽器 smoke 驗證伺服器無法連線時的錯誤提示與返回操作；測試基線升至 97 檔／1545 項。
- 🌐 新增本機雙瀏覽器好友房 Playwright smoke：啟動獨立 Vite 與權威 WebSocket server，驗證建房、加入、雙方開局、支援→主階段狀態同步及對手離線提示；納入 main push workflow，Playwright 驗證增至 5 套。
- 🧭 強化多段能力效果決策順序證據：新增 8 類 pending decision 表格回歸，驗證 `resolve-ability-effect` 無法繞過中途決策，並驗證看牌決策完成後可保留並恢復效果鏈；測試基線升至 96 檔／1535 項。
- 🧪 新增牌組編輯器 Playwright smoke：驗證錯誤 JSON 可恢復、合法 60 張牌組匯入／儲存，以及 1366×768／280×720 無水平溢出；並納入 main push 瀏覽器 workflow。
- 🛡️ R3 replay 完整化：AI `refresh-deck` 將可重播的 `shuffleSeed` 寫入 command payload，補上最後一個 AI Refresh 非種子洗牌缺口；新增 AI Refresh commandLog 重播回歸測試。
- 📚 P2 維護流程正式化確認完成（roadmap）：`release-process.md`、`card-update-process.md`、`regression-test-checklist.md`、`manual-playtest-checklist.md` 皆已存在且內容完整，本輪修正 `release-process.md` 寫死的「1449+ 項測試」為動態基線敘述（不得低於 Phase 0 基線，非固定數字）。
- 📚 README 大幅精簡（known-risks R12）：182 行縮減至約 80 行。重新審視 known-risks 時發現先前「CHANGELOG 從 README 抽出」（P2）並不完整——README 自留的「更新日誌」表格與 `CHANGELOG.md` 內容已分岔，9 筆歷史紀錄從未同步；已將分岔紀錄併入本檔（見下方 2026-07-11 補充項）、移除 README 重複表格，「目前進度」／「下一步計畫」改為短摘要 + 連結 `docs/architecture.md`／`docs/roadmap.md`／`docs/known-risks.md`。同時修正 `docs/known-risks.md` R4（`validate:cards` 早已存在並接入 CI，非「缺」）與 R8（缺圖 fallback 早已存在，非「待做」）兩處過時描述；`docs/architecture.md` 同步修正過時的 App.tsx 行數與測試數字。
- 📚 AI Lv.5 前置觀察（roadmap P3）：新增 `docs/ai-lv3-lv4-observation-2026-07-11.md`，以 7 場 Lv.3/Lv.4 對局逐字紀錄＋儀器化驗證（多重攻擊資源判定、陷阱使用頻率對照牌組組成）確認行為結構健康，建議暫緩 Lv.5 開發、待使用者真人對局確認後再決定。
- 📚 UI reference wireframe 文件（roadmap P3）：新增 `docs/ui-reference/06-online-match-wireframe.md`（線上對戰面板）；依實機驗證更新 `02-main-menu-wireframe.md`（空狀態 CTA 邏輯）；回填 `ui-audit-2026-07-11.md` 的 P0（主選單空狀態、線上對戰彈窗）已解決狀態。
- ⚡ 戰鬥資訊 modal 群組（`InformationModals`／`BattleResponseModals`／`DamageEffectModals`／`PendingDecisionModals`／`ResultModal`／`OpeningSetupModal`）改為 `React.lazy` + `Suspense`；主 bundle 由約 806.92 KB 降至 730.68 KB raw（167.17 → 152.26 KB gzip）。
- 🛡️ R3 指令層收尾：AI（`ai.ts`、`ai/battle-handler.ts`、`ai/turn-handler.ts`、`ai/random-turn-handler.ts`）全面改走 `applyGameCommand`，取代手動 `appendCommandLogEntry`；新增共用 `simulateAbilityEffects`（`src/game/ai/ability-effects.ts`）讓 AI 的 `play-item`／`activate-skill`／`activate-stage` 補齊 `effectTargets`，修復先前 AI 對局 commandLog 重播會失真的問題。過程中發現並修復 `commands.ts` 的 `assertNoPendingDecision` 缺口（補位帶出的新餅乾 OnPlay 未被排除在昏厥效果阻擋之外，會造成死結）。新增 `ai-replay-fidelity.test.ts`；測試基線升至 96 檔／1526 項。
- 🎨 P0 UI/UX 改進：線上對戰面板深藍電競科幻 modal 樣式化（`OnlineMatchPanel.tsx` + `GameModals.css`），含專屬 `.online-match-panel` 類別、32×32px 關閉按鈕、內容區捲軸管理、完整 hover/focus-visible/active/disabled 狀態。
- 🎨 P0 主選單空狀態引導：無自訂牌組時「建立第一副牌組」為 primary CTA、「對戰入口」disabled 並顯示原因文字；有牌組時還原以「對戰入口」為 primary CTA（`MainMenu.tsx` + `App.css`）。測試基線升至 92 檔／1488 項。新增 `OnlineMatchPanel.test.tsx`（15 項 mock hook 測試，含 idle/waiting/error/close/dialog/label/connecting 路徑）。
- 🔧 P1 工程管線（PR #24，驗證中）：`npm run validate:cards`（卡池 311 種卡號全數可轉換檢查，接入 CI）、`npm run typecheck`、`vercel.json` SPA rewrite、server 支援 `PORT` 環境變數與線上對戰冷啟動提示；修復 BS2-061@1 異圖版缺 level 的匯入資料缺陷並在匯入腳本加異圖回填。
- 📚 P2 維護流程文件（本 PR）：CHANGELOG 自 README 抽離、release / card-update 流程、回歸與手動測試清單、loop-engineering 說明。
- 🛡️ 攻擊宣告阻擋加固：`assertNoBlockingDecision` 新增 `pendingOnPlay` 與 `pendingAbilityEffect` 檢查，既有待處理效果結算完成前禁止宣告攻擊；新增 `battle-blocking-decision.test.ts` 回歸測試。
- 🛡️ AI 攻擊宣告與 determinism 修正：各級 AI 攻擊統一以 `declare-attack` 記入 commandLog 保留陷阱/FLIP 回應窗口；`commandLog` 長度不再影響 Lv.1 隨機決策；新增 `ai-attack-declaration.test.ts`（309 行），測試基線升至 91 檔／1469 項。
- 🔧 候選卡牌匯入管線強化：`validate:candidate` 新增 schemaVersion／source／欄位型別結構檢查；`promote:candidate` 加入檔名碰撞拒絕與 rollback；promote 後自動重新生成卡池 registry 確保新卡牌納入 runtime card pool。
- ✅ CI 新增 `validate:candidate` 與 `check:card-pool` gate，防止候選資料或 runtime registry 漏同步。
- 🌐 Vercel + Render 公網部署與雙視窗對局驗證完成。
- 🐛 修正線上對戰加入房間後對戰畫面未顯示（`MainMenu` 與 `OnlineBattleView` 兄弟元素重疊問題）。
- 🔧 指令出口統一補位排程：完成 `usePendingEffect` commandLog／replay 一致性與回歸測試。
- 📱 1194×680 平板解析度瀏覽器驗證完成：主選單、牌組編輯器、break-to-trash 對戰桌無 body 溢出，牌組編輯器 modal 在 viewport 內且操作列可見。
- ✅ AI 瀏覽器完整驗證 20/20 種子全綠（stuck=0）；互動／文案修正。
- 🔧 break-to-trash 結果訊息依有無目標分流；補齊 `effectUiUtils` 單元測試；同步 AI 瀏覽器斷言文案。
- 🐛 修正 `StatusToast` 訊息變更後未重新顯示；AI 瀏覽器測試的休息區卡牌點擊改為 DOM click，避免 modal backdrop 攔截。

## 2026-07-10

- 📋 Phase 0 文件與 IP 補強（PR #23）— 新增 audit-report、architecture、product-vision、roadmap、known-risks、ip-and-asset-policy、test-plan、online-server-hosting 文件；README 與主選單 footer 加非官方粉絲研究聲明；新增 MIT + Devsisters 素材除外條款的 LICENSE。

## 2026-07-09

- 🎨 EffectPanel 與陷阱/攻擊提示框改版（PR #20、#21）— dock、雙欄版面、多步驟流程；提示框加寬、背景加深。

## 2026-07-08

- 🐛 陷阱 support-to-hand/hand-to-support 修正 — 修復 Bean 牌組陷阱卡造成卡住的 bug；AI 改進支援放置能量稀缺優先、攻擊選擇一擊擊殺優先；新增 6 組 BS2 對局分析文件。
- 🔧 BS1-006 修正 — after-damage 觸發改為僅限戰鬥傷害，效果傷害不再觸發。
- 🔧 BS1-037 修正 — 移除 sourceAsEnergy 費用減少、目標改選 HP 最多、新增 hand-to-support 效果型別與執行。

## 2026-07-07

- 🃏 AI 預設牌組 — 新增第二彈紅/黃/豆子/藍/紫 AI 牌組選項；補強牌庫檢視縮小／返回、AI 支援階段填能與第二彈 5×5 對局矩陣回歸；記錄第二彈黃對紅 50 場策略訓練。
- 🛡️ AI 攻擊防守修正 — Lv.1/3/4 AI 攻擊改停在 trap 階段等人類防守方回應（先前自動結算導致無法使用陷阱/FLIP）。
- 🔧 BS1-037/054 修正 — MIX 區域顏色解析、BS1-054 OnPlay 廢棄判定、sourceAsEnergy 支付與 AI 決策聯動。

## 2026-07-06

- ✅ Phase 5 CI — 修正線上對戰 lint 失敗，維持 test/lint/build 通過。

## 2026-07-05

- 🧩 補齊卡牌效果（PR #17）— 稽核找出 25 張未支援卡，新增 8 個遊戲機制與 2 個代價/條件；修正 resolveFlip 條件檢查與異圖卡號正規化。

## 2026-07-04

- 🧠 AI 分級 — 新增 Lv.1/Lv.2、`PlayerView` 視角過濾器與 Lv.3 評估式 AI（PR #12、#13）。
- 🔗 指令層整合 — 擴充 `GameCommand`、加入 `commandLog` / replay，並補完牌組管理（PR #11）；對戰紀錄側欄（PR #15）；App.tsx 容器元件拆分（PR #16）。

## 2026-07-03

- 🖱️ Playwright 驗證 — 修正支援卡點擊、藍牌驗證斷言與瀏覽器測試流程。

## 2026-07-02

- 🟥 BS2 紅牌 — 完成 BS2-006/007 非餅乾效果、HP-to-trash 與紅色手牌代價。

## 2026-07-01

- 🧩 BS1/BS2 效果 — 補齊紅色卡牌、非餅乾效果、after-damage 與 attack-effect 控制權。

## 2026-06-30

- 🃏 BS1 匯入 — 建立 Brave Beginning Phase 1/2 轉接與測試基線。
