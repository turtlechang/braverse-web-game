# 手動遊玩測試清單（Manual Playtest Checklist）

最後更新：2026-07-12。重大功能合併後、或 Vercel preview 驗收時抽查。全跑約 20–30 分鐘；標 ★ 的為最小驗收集（約 10 分鐘）。

## 開局流程 ★

- [ ] 主選單可選牌組、AI 牌組（含第二彈預設）與 AI 等級（Lv.1–4）
- [ ] 不合法牌組不能進對戰，錯誤原因可讀
- [ ] 猜拳 → 先後攻 → 調度（自由/強制）→ 補償抽牌 → 起始餅乾配置全程可完成
- [ ] 重新開始會回到牌組選擇

## 回合與戰鬥 ★

- [ ] 五階段列（PhaseRail）正確推進，CTA 明確（略過支援／結束主要／結束回合）
- [ ] 出餅乾、放支援、能量支付（含顏色與 Mix）可完成；不合法操作有即時可讀提示
- [ ] 宣告攻擊 → 防守方陷阱/Blocker/FLIP 提示框出現、可回應可略過
- [ ] AI 攻擊時，玩家防守方能看到陷阱/FLIP 回應提示框（回歸熱點）
- [ ] 昏厥 → 補位詢問逐張進行；可補可略過
- [ ] 勝負判定正確（HP 歸零、Refresh 敗北）並顯示結果

## 效果與提示框

- [ ] 技能、物品、場景、FLIP 的多步驟效果精靈可完成、可取消
- [ ] 效果提示框可縮小（dock）再返回，縮小時可檢視牌桌
- [ ] 棄手牌、抽牌上限、效果順序等 pending 決策不會卡死
- [ ] 戰鬥紀錄側欄有正體中文摘要且可收合

## 牌組編輯器 ★

- [ ] 搜尋、顏色/類型篩選可用；單擊加卡、達 4 張禁用樣式
- [ ] 右側即時顯示張數 / FLIP / 餅乾數與不合法原因
- [ ] 匯入錯誤 JSON 不會讓 app crash；匯出可再匯入
- [ ] 儲存、刪除（含確認）、複製牌組正常

## 線上對戰（部署後）

- [ ] 建立房間顯示房號；另一視窗可加入
- [ ] 連線中顯示冷啟動提示；斷線有提示
- [ ] 雙方各自只看得到自己的手牌（遮罩）
- [ ] 不合法操作被 server 端規則擋下

## 畫面與 RWD ★

- [ ] 1366×768 不爆版、無捲軸；600×338 仍可操作
- [ ] 手牌扇形、hover 抬升、可行動高亮正常
- [ ] 主選單 footer 非官方聲明可見
- [ ] 無 console error（開 DevTools 抽查）

## 部署驗收（Vercel preview）

- [ ] Preview URL 開啟即玩，卡圖正常載入（熱連結）
- [ ] 任意頁面狀態下重新整理不出現 404

## 試玩回報模板（完成 1–2 場後貼回報）

```text
版本 / commit：
遊玩網址（Production / Preview）：
日期：
我方牌組 / AI 牌組：
AI 等級：Lv.__   seed（若有）：__

結果：我方勝 / AI 勝 / 中途放棄
最有感的功能：
最困困的互動或規則：
是否卡死：否 / 是（回合、階段、画面文案）
如果可重現，請附操作步驟、截圖或 console error：

UX 評分（1–5）
- 規則理解：__
- 操作流暢：__
- 提示框清楚度：__
- 視覺風格：__
```

## 試玩紀錄

### 2026-07-12（Production，commit `8b56370`）

```text
版本 / commit：8b5637044d7474ea59a96649ae521837975ba91c
遊玩網址（Production）：https://braverse-web-game.vercel.app/
日期：7/12 06:43
我方牌組 / AI 牌組：第二彈紫色牌組/第二彈豆子牌組
AI 等級：Lv.4

結果：我方勝
最有感的功能：AI對戰自動化。
最困困的互動或規則：
BS2-077 沒有執行代價(《Place 1 of your 紫色 LV.1 Cookies from your battle area into the trash.》)，就執行後續效果。
BS2-058 攻擊後，沒有檢查條件就執行後續效果，加上後續效果不是可以選擇的，只能對同一張餅乾造成效果傷害；另外，為何後續效果傷害沒有造成對手餅乾扣血?。
BS2-079 發動後的後續效果(已減完傷)沒有棄牌提示框讓玩家選擇並放回牌庫洗牌。
在線上對戰連上對手後的開局準備感覺很奇怪，應該直接進入遊戲對戰畫面，再開始猜拳(決定先後攻)->洗牌->抽牌(雙方抽取6張起手手牌)->設置初始餅乾(或調度)。
在線上對戰時，若是我方攻擊對手餅乾時，對手視角會出現陷阱(或阻擋者)提示框，但我方沒有出現對手正在決定是否發動陷阱(或阻擋者)提示框，會造成我方覺得遊戲卡住沒有執行下去。
是否卡死：是

UX 評分（1–5）
- 規則理解：3.5
- 操作流暢：3.5
- 提示框清楚度：3
- 視覺風格：3.5
```

清單結果（同一輪）：全數 ★ 項目通過；未通過／不確定：線上對戰「連線中顯示冷啟動提示；斷線有提示」未通過、「不合法操作被 server 端規則擋下」未驗證（對應 known-risks R13，已知缺口）、「1366×768 不爆版、無捲軸」不確定。

**衍生行動項**（依嚴重度，處理狀態見下）：
1. ✅ **已修復（2026-07-12）線上對戰攻擊方無等待提示（回報為「卡死」）**：根因是 `BattleResponseModals.tsx` 只在 `viewerPlayerId` 為防守方/傷害方/攻擊方本人時才渲染對應提示框，攻擊方視角完全沒有 fallback。`OnlineBattleView.tsx` 的狀態列新增 `opponentDecisionLabel`（trap／flip／attack-effect 三種待決策階段皆涵蓋），對手決策中會顯示「對手正在決定是否發動陷阱或出動阻擋者…」等文字，不再顯得卡死。
2. ✅ **已修復（2026-07-12）BS2-077 代價未執行就結算效果**：根因是 `trashBattleCookie` 代價只在轉接層（`official-effect-adapter.ts`）與技能路徑（`skills.ts`）被實作，物品路徑（`PlayItemCommand`／`playItem()`／`payAbilityCost`）完全沒有對應欄位，代價形同虛設。已補齊 command 型別、`payItem()` 簽名、`payAbilityCost` 驗證與支付、AI 端 `chooseAbilityCostIds` 計算、人類互動流程 `begin-play-item` 派發，新增回歸測試 `card-abilities.test.ts`「requires and pays a trashBattleCookie item cost (BS2-077 regression)」。
3. ✅ **已修復（2026-07-12）BS2-058「攻擊後續效果邏輯錯誤」——實為 UI 顯示錯誤文字，規則邏輯本身正確**：使用者提供截圖後複現：「攻擊後續效果」提示框顯示的是 BS2-058 的 **OnPlay 技能文字**（「Place up to 1 of your opponent's LV.3 Cookies...」），而不是攻擊文字（「Deals 4 damage. Then, if there are 15 cards or more in your trash, deals 1 damage.」），讓玩家誤以為條件/目標/傷害邏輯有問題。根因：`EffectPanel.tsx` 顯示卡牌說明時讀的是 `pendingEffect.sourceCard.effectText`（卡牌固定的技能文字欄位），而不是 `pendingEffect.skill.text`（依當下情境正確設定的文字，`usePendingEffect.ts` 對攻擊後續效果流程已正確設成 `sourceCard.attackText`，只是 `EffectPanel.tsx` 沒用到這個欄位）。已修正為讀取 `pendingEffect.skill.text`，新增回歸測試鎖定「顯示的文字要對應當下 pendingEffect，不是卡牌固定的技能文字」。條件檢查、目標選擇、傷害執行三處程式邏輯經核對本來就是正確的（見 `official-effect-adapter.test.ts`「BS2-058 Wind Archer Cookie attack bonus checks its own trash, not the opponent's」）；另補上 `battle-attack-effect.test.ts` 兩則端到端整合測試，實際跑「宣告攻擊 → 主傷害結算 → 攻擊後續效果條件判定 → 額外傷害套用」全流程，分別驗證攻擊方棄牌區達 15 張（條件成立，防守方多扣 1 點 HP）與未達 15 張（條件不成立，防守方 HP 不變）兩種情況，不只是驗證轉換結構或顯示文字。使用者追問後發現原本三層測試（轉換／UI／規則）彼此沒有串起來——`EffectPanel.test.tsx` 只驗證「給定正確 props 會畫對」，沒有驗證 `usePendingEffect.ts` 真的會給出正確 props；已補上 `usePendingEffect.test.tsx` 的 hook 層測試，用真實的 attack-effect `pendingBattle` 狀態跑過 hook，斷言 `pendingEffect.skill.text` 確實等於攻擊文字而非卡牌固定的技能文字，至此轉換／hook／UI／規則四層才真正串起來。
4. 🟡 **部分修復（2026-07-12）BS2-079 後續效果缺棄牌提示框**：轉接層原本完全沒有轉出「棄牌洗回牌庫」這段效果文字，已補上 `{ kind: 'trash-to-deck', max: 5, excludeFlip: true }`（`official-effect-adapter.ts`，新增回歸測試）。但陷阱系統目前只有一組共用 `targetIds`（`playTrap`/`battle.ts`），不像物品/技能有逐效果的 `effectTargets: string[][]`，所以陷阱裡第二個效果沒有獨立的目標選擇管道；已將 `trash-to-deck` 排除在共用 `targetIds` 之外避免誤用對手餅乾 ID 導致丟例外（此前會讓 5×5 AI 對局矩陣直接卡死，已在 `ai-simulation.test.ts` 驗證修復），但目前效果本身仍是靜默無選擇（0 張），**尚未真的彈出棄牌提示框**——這是陷阱系統本身的架構缺口（單一 `targetIds` 無法支援多段效果各自選目標），非本輪範圍，記錄為新的 known-risk。
5. 線上對戰開局準備順序體感怪異（先進戰場再猜拳/抽牌/起始配置）——待與現有 `OpeningSetupModal` 流程比對後判斷是否為認知落差或真的需要調整；本輪未處理。
