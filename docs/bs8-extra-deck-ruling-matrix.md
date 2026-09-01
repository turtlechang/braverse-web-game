# BS8 EXTRA Deck 規則裁決矩陣

> 狀態：**Phase 0／Phase 1、三張可直接登場 EXTRA 與兩張 Awakened 的核心規則 TDD 已完成；BS8 來源記錄已完成正式 promotion，但 EXTRA Deck 仍與 Standard 牌組隔離。**
>
> 最後裁決：2026-08-29。此矩陣以官方英文綜合規則 v1.8 為準，將已確認的核心不變量與仍須逐卡轉接的行為分開；不以候選資料或其他卡牌遊戲慣例補造規則。

## 來源與範圍

- [官方英文規則書更新公告](https://cookierunbraverse.com/asia/notice/detail?id=1176)所連結的 [Comprehensive Rules v1.8（2026-07-27）](https://drive.google.com/file/d/1qd_UwmJ64kXefDFA8aJ1_0n9utgEcVB9/view?usp=sharing)：§2-11、§3-1、§3-9、§4-9、§5-1、§6-5-2。
- [官方 FAQ 的 EXTRA 查詢](https://cookierunbraverse.com/en/faq?q=EXTRA)：確認特定卡面可要求從 EXTRA Deck 送牌作為代價，以及某些效果會禁止同回合再次從 EXTRA Deck 登場。
- [BS8 產品頁](https://cookierunbraverse.com/en/product/detail?id=241)：補充 EXTRA 卡可能覆蓋既有餅乾或以主動狀態進入戰鬥區；具體條件仍以各卡與規則書為準。

目前已建立條文直接支持的區域、構築與可見性模型，並以官方卡面可明確判定的三張
EXTRA 與兩張 Awakened 建立 `play-extra-deck-cookie` 核心路徑：BS8-005、BS8-027、BS8-069、
BS8-090、BS8-104。此路徑包含
合法指令列舉、command log、線上指令白名單與既有 replay command 邊界。戰場已提供公開張數、
持有者私密卡面與受規則層控制的直接登場按鈕；牌組編輯器的 EXTRA 卡仍只在候選 staging
模式出現，也沒有為 AI 建立以 BS8 卡號為前提的策略。

## 裁決矩陣

| 議題 | 裁決 | 官方依據 | Phase 1 實作／測試 |
| --- | --- | --- | --- |
| 區域與張數 | 每位玩家有一組獨立 `extraDeck`，可為 0–6 張；第 7 張必須拒絕。 | Rules §3-1、§5-1-1、§5-1-1-6。 | `PlayerState.extraDeck`、`validateExtraDeck`、`createGame` 的 0／6／7 張 TDD。 |
| 卡片類別與同卡號 | EXTRA Deck 只可有 `extra`／`awakened` 餅乾；同卡號最多 4 張。 | Rules §2-11、§5-1-1-4、§5-1-1-5。 | `ExtraDeckCard.type`、`validateExtraDeck` 的類別與第 5 張負向 TDD；`id` 承載 runtime base card number。 |
| 主牌組隔離 | 主牌組固定 60 張，且只由 Cookie／Item／Trap／Stage 構成；EXTRA Deck 不混入主牌組、手牌、調度、Refresh 或起始 HP。 | Rules §5-1-1、§5-2；抽牌與 Refresh 都只指向 `deck`。 | `ExtraDeckCard` 不屬於 `GameCard`；開局測試確認手牌只從主牌組抽 6 張。 |
| 私密性與資訊 | EXTRA Deck 始終面朝下、是私密區。持有者可隨時查看及自由重排；雙方都必須能確認張數。 | Rules §3-1-3、§3-1-4、§3-9。 | `PlayerView.extraDeck` 只給自己；雙方 `extraDeckCount`；線上遮罩使用同張數 `???`；`reorderExtraDeck` 不變地重排。 |
| 開局與洗牌 | 主牌組洗牌；EXTRA Deck 保持持有者所定順序，不抽牌、不參與自願／強制調度。 | Rules §3-9、§5-2-1-2、§5-2-1-5。 | `createGame` 只對 `deck` 呼叫 `shuffle`，並複製 `extraDeck`。 |
| 從 EXTRA Deck 出牌 | 只能由回合玩家在自己的主要階段、每回合一次，從 EXTRA Deck 登場一張已滿足條件的 `extra` 或 `awakened` 餅乾。 | Rules §6-5-2-2。 | `play-extra-deck-cookie` 只接受自己的 EXTRA Deck；`canPlayExtraDeckCookie` 檢查時機、每回合一次、戰鬥區空位與逐卡條件。已轉接 BS8-005／069／090 直接登場及 BS8-027／104 Awaken。 |
| 覆蓋／Awakening | 已滿足條件的 Awakened 卡覆蓋既有 Cookie，覆蓋本身算出牌；不可再覆蓋已 Awakened 的 Cookie。覆蓋後為主動、保留既有裝備、清除先前套用效果；承接底卡剩餘 HP 後，再自牌庫加入卡面 `HP+N`。昏厥時 Awakened 本體進 Break，其餘底卡、HP 與裝備進 Trash。 | Rules §2-4-2-2、§3-5-5-1、§4-9、§4-12-2、§9-4-2；官方 FAQ `q=Awaken`。 | BS8-027／104 使用 adapter 資料宣告覆蓋目標與來源區；`play-extra-deck-cookie` 以新實體取代目標、保留裝備／既有 HP、加入 `HP+2`、清除暫時修正，並把底卡關聯保存至昏厥結算。`extra-deck.test.ts` 覆蓋正向、錯誤來源、HP、裝備、暫時效果與完整昏厥去向。 |
| 主動進場、代價與來源 | 有些 EXTRA 卡可進入主動狀態；EXTRA／Awakened／Special Play 的條件成本是規則程序，且 EXTRA／Awakened 不得自其他區域登場。 | 產品頁；Rules §3-5-5、§6-5-2-2-1、§6-5-2-3。 | 可直接登場的卡會在出牌時 materialize 成帶有 `extraDeckOrigin: 'extra'` 的 `CookieCard`，沿用既有 HP、On Play 與 Refresh 結算；手牌／棄牌／Break／支援／牌庫進場入口一律拒絕此來源卡。 |
| 逐卡例外 | 卡面或 FAQ 可改寫一般時機，例如從 EXTRA Deck 送入 Trash 作為成本、或禁止同回合再次登場。 | Rules §1-3-1；官方 FAQ。 | 仍維持候選資料，不轉接、不 promote。 |

## 合法／不合法測試矩陣

| 情境 | 預期 | 自動化證據 |
| --- | --- | --- |
| 未提供 `extraDeck` 的 BS1–BS7 setup | 自動建立空陣列，舊 fixture／replay 仍可建立對局。 | `extra-deck.test.ts`：legacy setup。 |
| 0 張或 1–6 張 | 合法；保持原順序、獨立於開局手牌與主牌庫。 | `extra-deck.test.ts`：0／6 張與隔離。 |
| 7 張 | `createGame` 在開局前拒絕，訊息包含實際張數。 | `extra-deck.test.ts`：上限負向路徑。 |
| `extra` 與 `awakened` | 兩者皆為合法 EXTRA Deck 類別。 | `extra-deck.test.ts`：混合類別正向路徑。 |
| 同一卡號 5 張 | 在開局前拒絕。 | `extra-deck.test.ts`：四張上限負向路徑。 |
| 重複的 `instanceId` | 在開局前拒絕，避免私密重排與之後的 command 無法一對一識別實體。 | `extra-deck.test.ts`：runtime identity 負向路徑。 |
| 重排私密牌區 | 只接受原有卡片的一對一排列，且不修改輸入陣列。 | `extra-deck.test.ts`：順序與不完整排列負向路徑。 |
| 建立玩家 view 或線上遮罩快照 | 自己可見卡面；雙方可見張數；對手看不到真實 id、名稱或卡面。 | `extra-deck.test.ts`：PlayerView／masked state。 |
| BS8-005 的直接登場與 On Play | 自己本回合已有至少兩張餅乾昏厥時，可從 EXTRA Deck 登場並對對手全體造成 1 點傷害。 | `extra-deck.test.ts`：合法 command、HP、On Play 與 command log 回歸。 |
| BS8-005 的戰場 A/B | 持有者可見卡面並在條件成立時登場；對手只看張數；條件未滿足時不顯示登場操作。 | `card:BS8-005`／`card-negative:BS8-005` 會以正式 BS8-011 技能各造成 1 點效果傷害，透過 `applyGameCommand` 實際讓自家餅乾昏厥 2／1 張，再驗證 EXTRA 高光與負向不高光；`bs8-extra-deck:met`／`unmet` 另涵蓋登場、On Play 全體傷害與阻擋路徑。這不是候選逐卡 promotion 證據。 |
| 五張 BS8 EXTRA 的 generic card-check 區域 | `card:`／`card-negative:` 只建立對應的獨立 `extraDeck`，不可把 EXTRA 卡降級成 `GameCard` 或放入手牌。 | `demo.test.ts` 驗證 BS8-005／027／069／090／104 的正負向狀態；`npm run test:bs8:extra-deck:browser` 另以 Browser 檢查五張卡的 generic route 均沒有手牌 instance。 |
| 條件未滿足、同回合第二次、Awakened 直入戰場 | 必須拒絕，且不可消耗 EXTRA Deck。 | `extra-deck.test.ts`：三條負向路徑。 |
| 從手牌或其他區域再次登場 EXTRA 來源卡 | 必須拒絕。 | `extra-deck.test.ts` 與 target selector 的來源過濾。 |
| BS8-027／104 覆蓋與昏厥 | 只接受本回合由指定區域登場、同名且尚未 Awakened 的目標；覆蓋與昏厥依上列官方裁決處理。 | `extra-deck.test.ts`：正向覆蓋、來源區負向、HP／裝備／暫時效果、戰鬥昏厥的底卡／HP／裝備去向。 |
| 五張 BS8 EXTRA 登場條件 Browser A/B | 正向只在卡面條件成立時顯示高光／「從 EXTRA 登場」；負向保留卡面與張數但不提供登場按鈕。 | `npm run test:bs8:extra-deck:browser`：BS8-005／027／069／090／104 各自正向與負向路徑；005 的 On Play／攻擊後 Then 另由 `npm run test:bs8-005:browser` 覆核。 |

## 下一個 gate

後續 gate 是獨立六槽 EXTRA 自訂牌組、固定 seed Lv.1–Lv.5 整場 AI 與雙瀏覽器線上驗收；
這些 staging gate 不會改變已完成 promotion 的 BS8 正式來源，也不會把 EXTRA 混入 Standard 牌組。
