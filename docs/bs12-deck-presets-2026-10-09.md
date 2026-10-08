# BS12 五色牌組與九張補充卡

依使用者提供的清單建立五副牌組；每副主牌60張。藍／綠／黃／紫 Extra Deck 各6張，紅色4張。配方保存在 `data/decks/bs12-*-arena.json`，不調整卡號或張數。

AI 選單只顯示這五副 BS12 牌組，預設藍色。「我的牌組」、線上牌組選單、起始牌組配方及開局選牌先顯示 BS12。預設牌組只安裝一次；玩家後續編輯、刪除、原有牌組及無法解析的儲存資料均保留。

## 九張補充卡的獨立卡圖預期

來源為官方英文卡池 `https://cookierunbraverse.com/data/json/cardList_en.json`，取資料的 `cardList` 欄位，僅匯入以下九張。逐張核對原圖，原始資料不改寫；P-175／P-176 攻擊文字附帶的 `Card Name :` 中文轉錄尾段僅在 normalization 排除，英文印刷卡面作為效果預期。

| 卡號 | 主要核對內容 |
|---|---|
| ST8-018 | G陷阱，選0～1對手本回合攻擊-1；己方支援至少5張，同一目標再-1，未達門檻仍可付費發動基本效果。 |
| ST9-016 | BB道具，另棄恰好3張任意手牌，對0～1對手造成3傷害。 |
| ST10-002 | On Play 登場0～1己方棄牌區紫色LV2以下餅乾；PPP普通3後可棄己方紫色LV2以下戰鬥區餅乾及HP，再抽0～2、棄1。 |
| ST10-007 | 真實傷害揭示FLIP後，棄1任意手牌，原HP持有者補1HP。 |
| ST10-008 | On Play 己方棄牌至少15張時全部對手各1；PPP普通3後可棄己方紫色LV1戰鬥區餅乾及HP，原受攻擊者再1。 |
| ST10-013 | P道具，另棄己方紫色LV1戰鬥區餅乾及HP，把0～1對手LV2以下餅乾放入棄牌區。 |
| ST10-019 | P陷阱，選0～1對手本回合攻擊-1；己方棄牌至少20張，同一目標再-1。陷阱自身進棄牌後判斷追加門檻。 |
| P-175 | 本回合真正由效果活躍後可免費Activate Once抽1，再對0～1對手造成1；RRR普通3後，另一張己方Arena餅乾疲勞時原目標再1。 |
| P-176 | On Play 己方休息區至少4張Arena餅乾，把0～1己方LV1餅乾移棄牌，目標不要求Arena；YYY普通3後己方休息區LV至少4，來源補1HP。 |

## 實作與驗收範圍

精確轉接使用既有 CardEffect、GameCommand、選牌UI與公開指令紀錄。攻擊Then新增共用的戰鬥區棄置代價處理，規則、AI、DecisionDescriptor及付款UI使用相同的實體候選；支付時完整棄置HP／裝備，不觸發昏厥。P-175 的「另一張疲勞Arena餅乾」條件同時補入規則與AI公開條件判斷。

本機驗收局面只使用原始實體卡號、印刷屬性與卡圖、唯一instance ID及每張最多四份；On Play、效果活躍、陷阱攻擊宣告與FLIP揭示均經實際指令準備。準備式局面與本機Browser證據不等同逐卡線上同步或完整正式對局至勝負。

## 驗證結果

- 九張候選逐卡核對後 promote，正式 strict 契約為9 verified／0 needs-review／0 blocked。原始資料 SHA256 為 `FD6215DBD8E455EBD13F7B1418241F7F3ED9562426286E1DFECE19C687C6DD34`，搬移前後內容相同。
- `validate:cards`、`check:card-pool`、build、最終全域lint與`git diff --check`皆exit0；正式 registry 有21份資料集、2,086筆卡號，其中2,030筆可轉接。AI audit 基本卡號1,547、無轉接失敗；既有23張保守策略卡號維持相同清單。
- 新增卡規則68項、線上選零付款UI1項、五色配方／儲存6項、主選單16項及我的牌組2項回歸通過；AI audit固定卡池數量更新後2項通過。
- 實體卡 Browser 在1366×768與1164×777執行60個正反／門檻／攻擊Then情境及14個選零情境，共74案通過。包含真正付款、棄牌代價、傷害／FLIP父流程、抽牌後棄牌與公開指令紀錄。
- 五色AI開局各在兩種尺寸開啟，AI僅五個BS12選項、線上BS12排前五、所有配方／Extra Deck及重新載入後儲存內容核對通過，無pageerror。
- 另依使用者原始五色清單獨立逐項比對全部卡號與張數，五副主牌與Extra Deck皆完全相符；證據為`user-recipe-verification.json`。
- 完整AI Browser與ST1雙瀏覽器好友房核心同步通過。好友房驗證明確選擇其ST1參照牌組，適應BS12優先排序；不當作九張逐卡online或完整對局驗收。
- 全卡池strict為2,085 verified／1 needs-review／0 blocked，exit1來自既有BS3-026「HP重排」未有runtime效果，未擴大本次範圍處理。

完整Vitest最終803檔／17,127項全部通過，exit0，耗時1,102.14秒（Windows PowerShell，`npm.cmd test -- --maxWorkers=1`，TEMP／TMP位於本輪workspace產物目錄）。第一次全套因AI audit使用新增卡前的固定數量失敗而停止，日誌保留；修正後上述完整重跑通過，最終日誌為`full-vitest-final.log`。其後只修改驗證文件，程式碼與測試來源未變。

產物位於 `output/bs12-blue-check/`。驗證於提交前完成；push 不在本次授權範圍。
