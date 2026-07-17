# Changelog

本專案的重要變更記錄。格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。自 `0.9.0`（2026-07-16）起以 git tag 標記發布版本並在此對應版本區塊；更早的項目沿用日期為單位的記錄（未回溯套用語意化版號）。歷史記錄自 README 遷移而來（2026-07-10）。

## [Unreleased]

- 🧹 對戰可視化 P1／P2 收尾補強（2026-07-17）：`actionProgress` 的能量支付步驟標籤由「費用」改為「能量」，與導引式 `EffectPanel` 用詞一致；線上活動紀錄面板新增「複製紀錄」按鈕，重用既有 `ReplayIssueBundleV1` provider 產生可貼給開發者重現的問題包；移除從未被觸發、伺服器也無對應能力的 `reconnecting` 連線狀態死碼（型別、`RemoteActionBanner` 文案與樣式），斷線統一走既有「請重新加入房間」流程。`docs/known-risks.md` R7 補充說明伺服器無 session token／房間狀態保留機制，重連恢復與 45 秒決策逾時強制執行仍為此風險解除時才一併設計。新增活動紀錄複製功能回歸測試；測試基線升至 119 檔／1694 項，主 bundle 509.75 KiB raw／133.27 KiB gzip。
- 🐛 線上互動缺口修正（2026-07-17）：`useOnlinePendingEffect` 補上 `gain-hp` 帶目標選擇器時（如 BS1-052）的候選卡推導，避免目標階段永遠空白而無法確認發動；`useOnlineMatchController` 補齊陷阱 `support-to-hand`／`hand-to-support` 候選清單與 toggle（此前為佔位存根，BS2-021 等連鎖效果在線上會被靜默跳過）；共用 `BattleRow` 的懸停/聚焦放大預覽從只涵蓋戰鬥區餅乾，擴大到支援區、休息區、手牌、場景卡與棄牌堆頂卡。同步修正 `ai-browser-validation.mjs` 對 `RemoteActionBanner`（現為 `<aside>` 根節點）的中央指引選擇器誤判。新增對應回歸測試；測試基線升至 119 檔／1692 項，主 bundle 522.08 KiB raw／137.54 KiB gzip。
- 👁️ 對戰可視化 P0–P2 收尾（2026-07-17）：中央提示統一補齊玩家／階段／來源卡、等待原因、五步驟進度、攻擊箭頭與事件句型；加入對手公開卡牌預覽、陷阱／FLIP／攻擊效果一致回應狀態；活動紀錄支援回合／階段／玩家／卡牌篩選，線上同步顯示已收到對手操作、拒絕／斷線狀態與伺服器提供的 45 秒決策期限。所有公開提示沿用伺服器過濾後的卡牌 instance ID，不揭露對手手牌或牌庫；測試基線升至 119 檔／1684 項，主 bundle 507.67 KiB raw／132.89 KiB gzip。
- 🪙 攻擊能量支付互動修正（2026-07-17）：線上戰場下方 `BattleRow` 補上攻擊支付候選清單，BS1-007 等中性攻擊費用可直接點選支援卡；本機與線上共用規則層的中性費用候選判定，並新增線上互動與無顏色支援卡回歸測試。測試基線升至 119 檔／1687 項，主 bundle 507.58 KiB raw／132.88 KiB gzip。
- 🧭 BS1-037 攻擊後效果提示修正（2026-07-17）：本機與線上共用合法目標判定，只有存在對手 LV.1 餅乾時才建立攻擊後效果提示；無合法目標或條件不成立時由規則層自動略過，已有提示可使用「略過」，來源卡與效果文字整合在同一個 `EffectPanel`。新增 BS1-037 高等級目標與空戰鬥區回歸測試；測試基線升至 119 檔／1689 項，主 bundle 509.25 KiB raw／133.22 KiB gzip。
- 🧭 效果提示流程修正（2026-07-17）：ST3-019 在既有陷阱回應框內讓玩家選擇支援區棄牌；BS2-021 目標卡改為可換行並支援垂直捲動；只有「確認發動」的效果面板按鈕改為右側緊湊寬度；BS2-044 攻擊可選效果整合至本機與線上共用的單一提示框，完成代價與目標後才送出指令。
- 🎨 主選單品牌標題（2026-07-17）：主畫面標題改用 CookieRun BRAVERSE 金色／棕色品牌文字排版，保留響應式尺寸、可存取標題與既有選單操作。
- ⚡ 能量顏色支付修正（2026-07-17）：`MIX` 能量卡若有明確 `color`，支付時依該顏色判定；修正 BS1-032、BS1-007 等卡牌在 BS2-015／BS2-018 費用中被誤列為萬用能量，並同步阻擋玩家與 AI 選取不合法的攻擊支付卡。測試基線升至 116 檔／1674 項。
- 👁️ 對戰動作可視化第一版（2026-07-16）：本機與線上共用 `ActionStatus`／`RemoteActionBanner`，線上由伺服器維護具序號與 `stateVersion` 的 `PublicIntent`，只投影公開區域牌面；攻擊、技能／OnPlay 導引、陷阱／FLIP 回應與效果結算會同步目前步驟、對手選取目標高光及非阻塞等待提示，成功 `GameCommand` 後自動清除意圖並保留既有 commandLog／活動紀錄。

## [0.9.0] - 2026-07-16

- 🛡️ R5 卡牌語意防線（2026-07-16）：`validate:cards` 從「可轉換／有任一 payload」提升為 ability 非空、技能標記、可選抽牌與來源橫置檢查，並以 8 張高風險卡契約鎖定 Then／If you did／特殊代價／條件／觸發。整合 2026-03-30 官方 Rule Update，新增同時補位逐一處理 OnPlay 與傷害步驟開始後不回溯傷害的完整流程回歸；R5 保留為官方規則持續更新風險，測試基線升至 115 檔／1663 項。
- 🃏 ST5-022 觸發修正（2026-07-16）：改以被效果送入棄牌區的餅乾所屬玩家判定對手戰鬥場事件；己方 ST5-007 丟棄對手 LV.1 餅乾後，現在會正確提示是否橫置己方 ST5-022 並抽 1 張牌，且不會因己方餅乾被丟棄而誤觸發。新增完整技能支付與目標選擇回歸，測試基線升至 113 檔／1657 項。
- 🌐 好友房開局整合（2026-07-16）：加入對手後直接進入戰場背景，由伺服器權威狀態機依序處理私密猜拳、同時揭曉、勝者選先後攻、先攻再後攻調度、無餅乾公開與補償、雙方私密選擇並同步揭示起始餅乾；一般對局指令在完成前會被拒絕。開局浮層顯示雙方提交進度與目前行動者，正式戰場持續顯示先攻／後攻，中央狀態列明示自己或對手目前階段。雙瀏覽器 Playwright 已驗證內容保密、完整開局、順位／階段同步及既有斷線負向路徑；測試基線升至 113 檔／1656 項，主 bundle 749.50 KiB raw／156.56 KiB gzip，維持 850／180 KiB budget 內。
- 🛡️ R15 收尾（2026-07-16）：線上 `useOnlineMatchController` 補齊陷阱能量付款與 BS2-079 `trash-to-deck` 候選推導，玩家可在「目標」步驟分別選擇攻擊者降攻及最多 5 張自己的非 FLIP 棄牌，並透過既有 `play-trap.trashToDeckIds` 送交權威伺服器；非法顏色、橫置支援、FLIP 棄牌與第 6 張選擇均不會進入命令。協定回歸另確認非字串 `trashToDeckIds` 會被拒絕。全卡池只有 BS2-079 需要此專屬欄位，R15 正式解除；測試基線升至 112 檔／1643 項。
- 🧩 卡牌效果修正（2026-07-16，fix/card-effects-gaps）：split-damage 列舉所有合法配置 [A]/[B]/[A,B]/[B,A]，index 0 套 primaryAmount、index 1 套 secondaryAmount，依昏厥數→殘留 HP 排序；補強 draw-up-to-then-discard 在 afterEffectsRequireDraw 條件下的 pendingDrawUpTo 早返行為、draw 0/1 回歸測試（3 項）。isEffectTargeted 補齊 split-damage、prevent-effect-damage；AI 效果目標選擇新增 split-damage（5 項，含 HP1+HP2 2+1 回歸）與 hp-to-trash/support/disable-flip/disable-attack/battle-to-support/prevent-effect-damage（8 項）回歸測試。測試基線升至 112 檔／1641 項；AI 瀏覽器 20/20 種子 stuck=0 全綠。
- 🎨 本機與線上效果操作統一為導引式流程：餅乾、物品、場景與陷阱共用「能量 → 代價 → 目標」phase-step，缺少的步驟會自動略過；每次只顯示目前步驟，提供「下一步／上一步」，並只在最後以「確認發動」提交。技能文字移到來源卡圖右側，手機版同步調整卡片摘要與陷阱操作列。線上 `begin-activate-skill`／`begin-play-item`／`begin-activate-stage` 可在最後一次命令一併帶入第一段效果目標，避免導引途中先改動權威狀態；測試基線升至 110 檔／1625 項。
- 修正餅乾 OnPlay 登場提示：本機與線上對戰在效果尚未發動前皆提供取消按鍵；線上 BS2-061 現可顯示棄牌區非 FLIP 候選卡、選擇最多 3 張並正常確認洗回牌庫。
- 🌐 線上對戰互動與身份補強（2026-07-15）：建房／加入房間新增 1–20 字元玩家名稱並由伺服器保存至雙方 `GameState`；補齊線上戰場點擊手牌外部或按 `Escape` 取消選取；新增經伺服器場面 ID 過濾的非權威攻擊選取預覽，讓對手即時看到攻擊餅乾高光與付款支援卡橫置，正式攻擊仍由既有 `declare-attack` 裁決；修正付款完成後無法點選攻擊目標、BS2-069 類「手動代價＋必選目標」費用階段無法確認、ST4-017 移至棄牌區後來源卡圖片降級成 `unknown` 與重複送出結算；線上戰場補齊牌庫、場景區、休息區提示及棄牌區清單。擴充協定、RoomStore、hook、元件與雙瀏覽器回歸，測試基線升至 109 檔／1622 項。
- 🛡️ Phase 2 問題包（ReplayIssueBundleV1，2026-07-12）：新增 `src/game/replay-issue-bundle.ts`——版本化問題回報格式，含 bundleVersion、種子、牌組識別、完整 commandLog、回合/階段、錯誤摘要、失敗指令（失敗指令不落 commandLog，獨立欄位才能重現錯誤）、對局起點快照（`initialState`，離線限定）與擷取當下狀態（`capturedState`）。線上模式一律經 `maskGameStateForViewer` 遮罩再輸出、`initialState` 強制 null，序列化結果不含對手手牌/牌庫/隱藏 HP 卡的任何 instanceId（字串層級測試保證）。UI 入口：暫停選單與 `GameErrorBoundary` 崩潰畫面各加「複製問題包」按鈕（崩潰路徑靠 `issueBundleSource` provider registry 保留最後對局狀態，避開 React 卸載順序問題）；`useMatchController` 的 dispatch 失敗時記錄失敗指令供問題包附帶。回歸測試四組：離線 initialState+commandLog 重播出相同終局（黃金重播）、線上遮罩保證、serialize→parse round-trip、以及「重現真實錯誤案例」——漏付 trashBattleCookie 代價的 play-trap（BS2-077/ST5-020 類真人試玩 bug）經問題包 parse 後重放可得一模一樣的錯誤訊息，對應 Phase 2 退出條件「問題包能重現至少一個真實錯誤案例」。已知限制：未帶種子的洗牌指令重播時牌序會分岔（精確重現以 capturedState 為準）；線上端牌組識別為 unknown、失敗指令待 R14（command-rejected 回流 UI）後補。瀏覽器實測暫停選單複製成功回饋與 console 無錯誤；測試基線升至 101 檔／1591 項。
- 🎨 Phase 1 設計 token 與主題變體系統（2026-07-12，接手 Codex 本地未提交工作並驗證交付）：新增 `src/styles/`（`tokens.css` 集中色彩/字型/間距/圓角/陰影/動畫/z-index 設計原子、`base.css` 基礎樣式、`themeStorage.ts` localStorage 持久化、`themeQuery.ts` 網址參數覆寫、`ThemeSwitcher.tsx` 切換元件，含單元測試）。5 個視覺變體：`tactical`（原版電競科幻，對照組）、`tactical-clean`（**預設**，使用者反映原版太花俏後的資訊優先版）、`tactical-mono`（純灰階對照組）、`low-glare`（夜間/OLED）、`broadcast`（錄影/直播放大字級）。`main.tsx` 開機依 `?theme=` 參數或 localStorage 套用 `data-theme`；`/?mockup=themes` 提供 5 變體並列預覽。新增 `docs/phase1-theme-variants.md`／`docs/phase1-state-matrix.md`（5 畫面狀態矩陣）／`docs/phase1-component-states.md`（9 類元件狀態規範）。已於瀏覽器驗證 mockup 頁 5 變體渲染、主程式預設 `tactical-clean` token 生效、`?theme=broadcast` 覆寫生效、console 無錯誤。`ThemeSwitcher` 元件已就緒但尚未掛載進主選單（待使用者確認視覺方向後接入）；測試基線升至 100 檔／1582 項。
- 🃏 牌組編輯器補齊物品卡／陷阱卡／場景卡數量提示：原本 stats 區塊只顯示 `FLIP` 與 `餅乾卡` 兩項（`src/components/modals/DeckEditorModal.tsx` 與 `src/components/MainMenu.tsx`），現在於牌組編輯器 modal 與主選單「目前玩家牌組」／「已儲存牌組」三處皆新增 `物品卡`／`陷阱卡`／`場景卡` 提示。純資訊顯示、不加任何驗證錯誤規則；新增 `DeckEditorModal.interaction.test.tsx` 1 項 stats bar 顯示回歸，測試基線升至 98 檔／1569 項。
- 🃏 牌組編輯器將 `@1` 卡面變體視為同名卡：`BS2-031@1` 與 `BS2-031` 共用 4 張上限；卡池列表只顯示 base 條目，匯入既有牌組自動正規化為 base；`src/game/card-pool.ts` 新增 `normalizeCardNumber` 與 `getCardPoolVariants` 公開 API，`useDeckEditor` 與 `custom-deck` 同步改寫。受影響 base 卡牌：BS1-002/003/008/009/012/014/017/028/031/033/036/037/040/044/053/054/056/062/066/067/071（21 張）、BS2-003/011/015/022/026/027/028/029/031/034/036/040/045/055/058/061/062/063/067/068/069/071/073（23 張）；同步把 `AI_PRESET_BS2_PURPLE_DECK` 中硬編碼的 `BS2-068@1` 改為 `BS2-068`；新增 `card-pool.test.ts` 5 項與 `custom-deck.test.ts` 4 項回歸，測試基線升至 98 檔／1569 項。
- 🐛 紫色卡牌全面稽核（2026-07-12，資料轉換／hook／UI／規則引擎四層檢查）：發現並修復 FLIP 卡的頂層 `effectText`/`effects` 未填入問題——`official-card-adapter.ts`／`starter-deck.ts` 的 fallback 鏈（`trap → item → stageAbility`）漏了 `flip` 分支，導致通用轉換器無法解析的 FLIP 文字（如 BS2-056「棄 1 張手牌 → 該餅乾 HP +1」）只有 `card.flip` 有值，`CardDetailModal` 的 FLIP 段落因此不會渲染（純顯示層，規則引擎只讀 `card.flip` 不受影響）。已於兩處 adapter 補上 `flip` 分支，新增 adapter 層與元件層回歸測試，並實際在瀏覽器測試對局模式載入 BS2-056、點擊卡牌確認 FLIP 段落正確顯示。另盤點 `'opponent-trash-count-at-least'` 條件命名：`TrapCondition`（`battle.ts` 判定，檢查陷阱擁有者自身棄牌區）與 `EffectCondition`（`targeting.ts` 判定，檢查真正對手棄牌區）語意相反卻同名，目前 BS2-080 因呼叫方式巧合而運作正確，非活躍 bug，但屬維護地雷；已加鎖定回歸測試與程式碼註解說明，不貿然重新命名。記錄為 known-risks R16（已解決）；測試基線升至 97 檔／1554 項。
- 🛡️ R15 第一階段緩解：BS2-079 陷阱「trash-to-deck」效果新增獨立 `trashToDeckIds` 目標欄位（2026-07-12，PR #47）。陷阱系統只有單一共用 `targetIds`，第二段可選目標效果先前因誤用第一段目標 ID 導致例外；本輪已貫穿 `battle.ts`／`commands.ts`／AI／本機 UI，線上 UI 留待 2026-07-16 的 R15 收尾項目完成。
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
