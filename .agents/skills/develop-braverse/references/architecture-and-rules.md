# 架構與規則速查

## 模組責任

| 路徑 | 責任 |
|---|---|
| `src/game/types.ts` | 執行期核心型別與 `CardEffect` 單一真實來源 |
| `src/game/actions.ts` | 攻擊、登場、支援等動作 |
| `src/game/effects.ts` | 效果執行與目標選擇 |
| `src/game/energy.ts` | 費用合法性、付款選擇與驗證 |
| `src/game/skills.ts` | Activate、OnPlay、Passive 等觸發 |
| `src/game/ai.ts` | deterministic AI 決策與模擬 |
| `src/game/setup.ts` | 建立對局、調度與起始流程 |
| `src/game/turn.ts` | 階段與回合推進 |
| `src/game/refresh.ts` | 牌庫 Refresh |
| `src/game/victory.ts` | 勝負判定 |
| `src/cards/` | 官方資料型別、文字解析與 `GameCard` 轉接 |
| `src/App.tsx` | React 畫面與規則層協調入口 |

## 不可破壞的邊界

- `src/game/` 不依賴 React。
- 狀態轉換不得修改輸入 `GameState`。
- UI 不自行判斷付款、攻擊、技能或陷阱是否合法。
- AI 與 UI 使用相同的規則層公開函式。
- 亂數與時間透過參數或工廠函式注入。
- 一般洗牌與種子洗牌共用 Fisher-Yates；不得修改原牌組。
- AI 單場最多 500 步，UI 自動操作最多 200 步。

## 技能與費用

- `{mob}`：Activate，只能在來源玩家自己的主要階段主動使用。
- `{ap}`：OnPlay，從手牌登場時建立一次可選窗口，可發生在對手回合。
- `{t1}`：同一場上卡牌實體每回合一次；重新登場取得新身分。
- `{mt}`：只在來源玩家自己的回合有效。
- 指定顏色費用由同色或萬用能量支付；`{N}` 可由任何活躍支援支付。
- 標記解析集中於 `official-text-parser.ts` 與 `official-effect-adapter.ts`。

## 規則文件判讀

- 修改規則前必讀 `docs/game-rules.md`。
- `[已確認]` 可據以實作。
- `[暫定]` 可維持原型既有行為，但新解讀需記錄依據。
- `[待確認]` 不得猜測實作。
- 舊文件若落後於程式與測試，先查 Git 歷史及官方更新。
