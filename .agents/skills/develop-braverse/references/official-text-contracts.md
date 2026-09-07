# 官方卡文轉接與 strict contract 防漏規範

這份規範處理「卡面看起來已支援，但某個必要條件／代價／目標沒有進入
runtime」的錯誤。`test-state` 可以快速建立場面，不能取代正式卡牌轉接、
規則層與 Browser 驗收。

## 為什麼會漏解析

1. `convertOfficialCardEffects` 是有限的 pattern parser；官方同一語意可能有
   不同語序、單複數、標點或 `@` 異圖變體。
2. 複合效果、`Then`、可選代價與特殊時機通常走 card-specific exact map；新增
   卡時若只補傷害／目標，容易忘記同步條件、支付或順序。
3. 舊版 generic fallback 在看見 `damage`／`draw` 時可能回傳 supported，卻把
   未辨識的條件靜默丟掉，於是 UI 會把本來不可用的技能顯示成可發動。
4. 正向 fixture 常預先放入「條件已成立」的狀態；若沒有獨立負向 fixture，
   這種遺漏不會在測試中暴露。
5. 負向 fixture 若同時缺少支付資源，測到的可能只是「付不起」，而不是
   「條件不成立」，因此 A/B 失去判別力。

## 必走的資料管線

```text
官方來源文字
  -> normalize／分段（skill、attack、flip）
  -> parser 或明確 exact map
  -> CardEffect／CardSkill／AbilityCost（條件、支付、目標、順序都保留）
  -> 規則層 A/B（條件 0／1、支付可用／不可用）
  -> 正式 UI Browser A/B（card-skill／card-skill-negative）
  -> strict contract + promote gate
```

每一個官方條件句都必須對應到 runtime 的 `EffectCondition`、能力費用的
動態欄位，或一個明確且有測試的 exact mapping。`<can be used as {R}>` 是
**支援區的可選紅色能量支付**，不是把來源 Cookie 自動算成能量；Browser
負向路徑仍須保留可支付的支援卡，才能專門驗證條件封鎖。

## Parser 與 exact map 的分工

- 可重複、語意單一的句型放進 generic parser（例如
  `if your Cookie fainted this turn` →
  `cookies-fainted-this-turn-at-least`）。同時覆蓋 `your opponent's`、
  單複數及常見語序變體。
- `Then`、多分支、跨區目標、動態費用或官方裁決有唯一解的文字，使用
  card/base-card key 的 exact map；`@1` 等異圖必須回退到 base card key。
- 不可用「先回傳部分效果，再把未知條件忽略」的方式製造 supported。
  新句型若沒有安全 AST，應回傳 `unsupported`，或由 contract 標成
  `needs-review`。

## Contract 與測試要求

- `src/cards/contracts/ledger.ts` 必須檢查來源條件是否在 runtime 有對應證據；
  證據缺少時不能維持 `verified`。
- 每張有條件的卡至少要有：
  - adapter regression：完整檢查 `kind`、`condition`、`target`、代價與順序。
  - 規則層正向／負向：條件成立與不成立各一條；支付條件要另測可支付與
    不可支付。
  - Browser 正向／blocked：確認按鈕、可選目標、能量選擇及 command trace。
- 正向 fixture 不得只以預設 counter 掩蓋條件；負向 fixture 只移除該條件，
  其餘必要場面（例如支援區支付）保持合法。
- Browser 結果需記錄真實卡名、卡號、來源區、條件 counter、支付選擇與
  最終效果；只載入 `?test-state=card:` 不算正式驗收。

## 建議檢查命令

```powershell
npm.cmd test -- --maxWorkers=1 src/cards/official-effect-adapter.test.ts src/cards/bs8-strict-contracts.test.ts
npm.cmd run cards:audit:contracts -- --card=BS8-010 --strict
npm.cmd run test:bs8:abilities:browser -- --card=BS8-010
npm.cmd run lint
npm.cmd run build
```

若全域 lint 被既有 `.tmp-*` 或診斷腳本阻擋，必須在回報中分開列出，不能
把 scoped lint 或單元測試結果描述成全域全綠。
