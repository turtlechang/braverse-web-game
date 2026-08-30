# BS8 EXTRA Deck 核心模型分階段方案（提案）

> 狀態：**Phase 0／Phase 1、可直接登場 EXTRA command、Awakened 核心裁決 TDD、攻擊後效果、基礎 AI 與戰場私密檢視已實作；自訂牌組構築、正式 Browser gate 與 promotion 仍未完成。**
>
> 這份文件不改變正式卡池、60 張主牌組或既有對局行為；在規則裁決與使用者確認前，
> BS8 維持 `inventory`／不可 promote。

## 已有依據與仍待裁決事項

官方綜合規則 v1.8 已明定：每位玩家有一副最多 6 張、可為 0 張的 EXTRA Deck；它只包含
【EXTRA】／【Awakened】餅乾、每卡號最多 4 張、始終面朝下，且是持有者可查看與自由重排的
私密區。雙方必須隨時能確認各區張數。主要階段中，回合玩家每回合可從 EXTRA Deck 登場
一次已滿足條件的【EXTRA】或【Awakened】餅乾；其出牌代價屬規則程序，且兩類卡不得從其餘
區域登場。這些條文界定了資料模型與下一階段 command 的不變量，但**不足以自行推定**每張卡
的條件、覆蓋目標、離場連動或效果結算。

- 官方產品說明：[Land of Fire & Ruin, Realm of Apathy](https://cookierunbraverse.com/en/product/detail?id=241)
- 官方規則書更新公告：[Official English Rulebook Updated](https://cookierunbraverse.com/asia/notice/detail?id=1176)
- 官方綜合規則 v1.8（2026-07-27）：[公開 PDF](https://drive.google.com/file/d/1qd_UwmJ64kXefDFA8aJ1_0n9utgEcVB9/view?usp=sharing)，§2-11、§3-1、§3-9、§4-9、§5-1、§6-5-2。
- 官方 FAQ：[EXTRA 查詢結果](https://cookierunbraverse.com/en/faq?q=EXTRA)

主卡池 runtime `CardType` 仍不含 `extra`，一般官方 adapter 會安全地回傳
`unsupported-card-type`，因此 EXTRA 不會誤混入 60 張主牌組。另有專用的
`convertOfficialCardToExtraDeckCard`：已精確轉接 BS8-005／027／069／090／104；BS8-005／069／090
走直接登場核心路徑，BS8-027／104 依規則書與 FAQ 的覆蓋、HP、裝備、暫時效果與昏厥去向裁決走
Awakened 核心路徑。BS8
15 筆 EXTRA 記錄及其餘效果缺口見 [BS8 效果覆蓋盤點](bs8-effect-coverage.md)。

## 需要先確認的規則契約

下列每項都仍必須能指向官方卡面、規則書段落或 FAQ 問答，不能只憑現有程式推測：

1. 覆蓋的合法目標、覆蓋後的實體關係、覆蓋目標移動或昏厥時的連動，以及回收／棄置
   的最終區域。
2. 以主動狀態進戰鬥區時的 HP、登場效果、攻擊／升級／回應與個別例外。
3. 「從 EXTRA Deck 送至棄牌區作為代價」及各卡面條件的結算順序。
4. 禁限表對 EXTRA Deck、異圖的同卡號認定與未來擴充賽制的適用範圍。

## 實作分期與驗收

### Phase 0：裁決快照與測試矩陣（已完成）

- 已將目前可安全採用的資料邊界與保留項目記錄於
  [`docs/bs8-extra-deck-ruling-matrix.md`](bs8-extra-deck-ruling-matrix.md)，並從
  `docs/game-rules.md` 連結。
- 矩陣涵蓋 0–6／超量、EXTRA／Awakened 類別、每卡號四張、主牌組隔離、資訊遮罩與所有未裁決操作的禁止狀態。
- Gate：**尚不接入 BS8 正式卡。**

### Phase 1：純規則與資料模型（不先做 UI；區域模型已完成）

- `PlayerSetup.extraDeck?`／`PlayerState.extraDeck` 與 `ExtraDeckCard` 已建立；舊 setup
  未提供此欄位時一律初始化為空陣列，且 EXTRA 卡不屬於既有 `GameCard` union。
- `validateExtraDeck` 已拒絕第 7 張與第 5 張同卡號，並接受 `extra`／`awakened` 兩類；
  `reorderExtraDeck` 以純函式保存私密區的合法重排。`PlayerView` 僅給持有者完整內容，線上遮罩快照
  對對手只保留張數與佔位卡，避免提前洩漏。
- 區域模型與 `ExtraDeckCard` 保持獨立；一般出牌與各種效果進場入口都拒絕帶有
  `extraDeckOrigin` 的 materialized 餅乾，維持「EXTRA／Awakened 不得由其他區域登場」。

### Phase 2a：直接登場 EXTRA command 與戰場檢視（已完成，範圍受限）

- `play-extra-deck-cookie` 只能由當前玩家在自己的主要階段使用；它檢查每回合一次、兩個
  戰鬥區上限、卡片位於自己的 EXTRA Deck 與逐卡條件。
- BS8-005、BS8-069、BS8-090 已由專用 adapter 轉接；出牌時以帶來源標記的 `CookieCard`
  進入戰鬥區，復用現有 HP、On Play、Refresh、合法 action、command log、replay command 與
  線上協定白名單；BS8-005 的「攻擊後雙方全體（自身除外）各 1 傷害」與 BS8-090 的「攻擊後最多抽 2」
  也由相同 attack-effect pipeline 處理。
- TDD 覆蓋正向出牌、On Play、直接 EXTRA 的攻擊後效果、條件未滿足、同回合第二次、Awakened 直入、
  手牌再登場阻擋，以及線上 command payload 型別。
- 戰場的 EXTRA 區會公開張數、僅讓持有者查看卡面；當規則層判定合法時才顯示「從 EXTRA 登場」。
  本機／線上畫面都接至既有 command，但尚未以雙瀏覽器完成線上流程。
- localhost-only `bs8-extra-deck:met`／`bs8-extra-deck:unmet` Browser A/B 已驗證 BS8-005 的卡面私密性、
  條件成立的登場與 On Play 全體傷害，以及條件不成立時不可點選。它不是候選資料的正式逐卡 gate。
- Gate：Lv.1 可由通用合法指令選取直接 EXTRA；Lv.2 在手牌無適合登場時，會以既有通用 Cookie 評分選擇
  合法的直接 EXTRA，兩者都不以 BS8 卡號特判。尚未建立自訂牌組／匯入格式，也尚未完成固定 seed 的
  Lv.1–Lv.5 整場策略與 telemetry gate。

### Phase 2b：Awakened、AI、replay 與 telemetry

- BS8-027／104 的覆蓋目標、疊放實體、HP、裝備保留、temporary-effect 清理與昏厥時的
  Break／Trash 去向已以 Rules §2-4-2-2、§3-5-5-1、§4-9、§4-12-2、§9-4-2 與官方 FAQ 實作並 TDD。
  規則書未明定的其他非昏厥跨區移動不能自行推定底卡去向，相關卡牌效果仍須逐卡以官方來源裁決。
- 直接 EXTRA 的 replay command、Lv.1／Lv.2 合法性與不洩漏私密 EXTRA 卡的基礎測試已完成；仍須補齊
  固定 seed 的 Lv.1–Lv.5 整場策略／deadlock／turn-cap telemetry，且所有等級只能讀取允許公開的
  `PlayerView`，不能以手寫卡號特判決策。
- Gate：固定 seed AI 對局、非法 action、deadlock、turn cap 均為 0，並通過 replay
  schema／重播驗證。

### Phase 3：UI 與線上對戰

- 牌組編輯器提供獨立六槽 EXTRA Deck；主牌組計數與違規提示不受它污染。
- 戰場的基礎 EXTRA 區已呈現私密卡面與規則層決定的直接登場按鈕；仍須完成牌組編輯器、
  覆蓋關係、詳情、觀戰者 view 與線上重連的一致呈現。
- 本機與雙瀏覽器線上流程都執行合法與阻擋 A/B：建構、選擇、覆蓋／主動登場、回應、
  離場、重連、replay 匯出。
- Gate：build、lint、完整單元測試與 Browser A/B 全部通過；沒有「僅 test-state」
  的完成宣稱。

### Phase 4：逐卡轉接與 promotion

- 先處理五個基礎 EXTRA 卡號（15 筆含異圖），逐卡完成 adapter、嚴格契約、規則、
  AI 回歸與 Browser A/B；再依顏色逐批處理 54 張主效果、54 項能力與 14 個 `Then`。
- 重跑 `validate:candidate`、strict capability／contract、正式卡池一致性與完整對局
  smoke；只在全部 gate 完成且使用者明確授權後才執行 promotion。

## 下一個實作切點

完成自訂牌組、AI／雙瀏覽器線上驗收與逐卡 Browser gate 前，不可將
核心 command 或 localhost test-state 視為完整 EXTRA 對局支援，更不得據此 promotion。
