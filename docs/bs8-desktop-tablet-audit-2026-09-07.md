# BS8 桌機／平板逐卡稽查

日期：2026-09-07。範圍：BS8 全部 125 張基礎卡、171 筆含異圖資料；手機暫緩。不 commit 或 push。

## 任務與完成條件

核對官方卡文、轉接、規則、UI 說明、支付／代價／目標／Then，修復可重現問題。桌機以1907×863（051–058初查另有1440×960）、平板以1164×777驗證。逐卡記錄正向與阻擋操作；同文字異圖另核對載入與路由。局部 test-state 不代表完整正式對局或線上驗收。

## 計畫與進度

1. 已完成全部125張基礎卡文字／runtime複核，保留含異圖171筆來源。
2. 已修復桌機／平板手牌隱藏與支援間距，完成實際操作驗證。
3. 已完成001–125本輪局部Browser重測；主牌156筆雙尺寸正向／負向均有證據，EXTRA分開列出條件、登場、攻擊與異圖載入覆蓋。
4. 已補數量、支援差、棄牌張數、手牌不足、略過與目標種類等專卡邊界。
5. 已完成全套測試、build、scoped lint、AI及好友房回歸；正式EXTRA已依使用者確認開放，最新整合驗證見下節。

## 已修復與直接證據

- **手牌消失根因**：`BattleRow.css` 的全寬度 `bottom-field:has(.support-card.is-targetable)` 規則把手牌設為 `visibility:hidden`，手牌資料未被刪除。已限制於手機寬度；桌機／平板在正式60張牌組開局及卡牌情境的攻擊付款時均觀察到手牌保持可見。
- **支援間距**：依使用者截圖恢復重疊堆疊，再擴大為桌機52px／平板36px，一般與攻擊付款使用相同間隔。兩尺寸所有7張支援卡中心 hit-test均落在自身；技能／其他代價仍保留既有完整展開。
- **059／067／072／111最多數量**：[38條精確狀態驗證](../test-results/bs8-desktop-tablet-2026-09-07/optional-count-browser-1788774009804.json)通過。059兩隻各0／1／2張的九分配、067選0／1、072選0／1／2及新支援狀態、111選0～4與原有棄手代價。067另修`resolve-choose-one`只展開能力、未展開權威攻擊佇列的卡住問題，線上hook正式命令回歸通過。
- **076選擇Then**：移除誤設`mandatory:true`；[12條Browser](../test-results/bs8-076-attack-choice/report.json)驗證兩異圖、桌機／平板支付或略過，及Active Phase棄0／2。略過保留來源、不抽牌、不建立活躍限制；兩路都保留攻擊費用與傷害。牌庫底位置由引擎測試精確驗證，Browser不讀隱藏牌序。
- **005／009／021傷害順序**：[8條反向排序Browser](../test-results/bs8-desktop-tablet-2026-09-07/damage-order-browser-1788774700941.json)通過。005含登場兩目標及攻擊Then三目標；009／021包含跨雙方順序、排除來源／Burning Spice、順位標號、公開trace目標順序與HP精確差值。
- **028／029／083異圖邊界**：028／029正常基礎卡號也套用原本只處理@1的欄位正規化，保留原文guard；083@2已檢視[官方實圖](https://cookierunbraverse.com/data/en_storage/44dhMdHAN02m9atK1tBXHA.webp)，移除原圖不存在的每回合一次標記。全部原始171筆與125基礎卡號可轉換。
- **009中文說明**：Then提示改為「接著，你可以支付1點紅色支援能量；若支付，自己的休息區總等級每達到3級，此餅乾在本回合的攻擊傷害就增加1點。」正式原始卡文維持來源內容。
- **051／052候選與數量**：051 支援區加入真實 BS8-058，提示改為自己的支援區餅乾，登場／選0／無合法餅乾兩尺寸共6例通過；052提供3張真實綠色與1張紅色手牌，選0／1／2共6例通過，能選第3張且拒絕超選。IAB另外確認052真實卡圖與選中黃框。詳見 `051-faint-browser-1788775819344.json`、`bs8-052-hand-choice-1788776123016.json`。
- **052／115／118／120門檻**：[16例條件邊界 Browser](../test-results/bs8-condition-boundary/report.json)通過。分別比較支援差2／1、棄牌5／6、棄牌15／14、手牌1／0；115／118負向扣除正常登場HP後確認不額外加HP，不能只憑skip命令認定條件正確。
- **069綠色卡牌回收**：修復只允許Cookie的錯誤，現在允許符合綠色條件的Item等卡牌；其他未指定的trash-to-support維持Cookie限制。補上選0可確認及略過OnPlay清除權威pending，避免視窗重開。069／090／104兩尺寸[登場24例](../test-results/bs8-extra-effects/report.json)、[攻擊與Then12例](../test-results/bs8-extra-effects/attack-report.json)通過。
- **010／083／084雙效果**：除技能外，另完成攻擊Then正向與付款不足負向共24例。010桌機負向以`010-attack-desktop-negative-fixed.json`為準；負向攻擊封鎖不代表技能條件負向。
- **主牌組EXTRA隔離**：驗證、匯入、直接建立主牌組都拒絕EXTRA，避免EXTRA在一般卡片factory被誤轉成Item；base／異圖、Standard／Open及候選side EXTRA回歸通過。
- **EXTRA異圖補驗**：[20例精確異圖A/B](../test-results/bs8-extra-variant-effects/report.json)通過，涵蓋005@1、069@1、090@1、104@1／@2兩尺寸；正向核對登場後OnPlay區域／HP與trace，負向確認不能登場且區域不變。合併既有基本卡及027異圖，15筆EXTRA均有局部A/B來源；未泛化為每筆異圖的全部攻擊Then或完整對局。

## 驗證分層與進度

- [125張文字／runtime逐卡對照](bs8-text-runtime-review-2026-09-07.md)已完成靜態複核，不等於逐張完整Browser驗收。
- `p-browser-card-audit`已補齊EXTRA異圖入口；取得官方圖片網路存取後重測，[桌機](../test-results/bs8-desktop-tablet-2026-09-07/load-images-desktop.json)／[平板](../test-results/bs8-desktop-tablet-2026-09-07/load-images-tablet.json)各171／171實圖、精確路由與詳情通過，0失敗、0阻塞。先前網路受限報告保留為歷史紀錄。
- 001–125雙尺寸局部重測已完成，逐筆來源見[Browser證據索引](bs8-browser-evidence-index-2026-09-07.md)。065使用明確met/unmet路徑；072透過情境設定UI建立己方2、對手3支援補足正向路徑。
- 最新build通過，保留chunk-size警告。卡池registry一致；以精確BS8來源檔執行strict shadow audit為171 verified／0 needs-review／0 blocked。
- AI Browser以`BRAVERSE_DESKTOP_TABLET_ONLY=1`排除≤680px手機，其他既有回歸及seed1–20全部結束、0卡死；雙瀏覽器好友房核心開局／同步／預覽／拒絕／斷線通過。這不是逐張BS8完整線上對局。
- 開放EXTRA前的 `npm.cmd test -- --maxWorkers=1`：291檔、4453項全部通過（383.35秒）。candidate promotion測試已將正式輸出與registry移到暫存目錄，並以雜湊確認正式資料未異動；涵蓋成對路徑參數與複製失敗rollback。
- 本次修改全部通過scoped lint。全域lint仍有兩個既有未追蹤診斷檔3項unused錯誤：`.tmp-probe-deploy.ts`與`scripts/diagnose-lv5-conservatism.ts`，保留未修改。
- [正式主牌組Browser](../test-results/bs8-formal-main/report.json)：桌機／平板2／2通過，以首頁JSON匯入並儲存合法60張BS8 Red牌組，正常隨機開局、調度、起始餅乾、跨回合支援與攻擊；付款不足禁止選目標，付款後實際橫置支援並造成傷害。沒有test-state或注入遊戲狀態。此證據代表正式主牌組流程，並非125張逐卡完整線上對局。

## 正式納入範圍

使用者已確認開放正式EXTRA。171筆資料原已在正式registry；本輪讓其中15筆EXTRA可在Standard／Open編輯器加入獨立額外牌組，並接上本機及標準好友房。正式JSON使用選填extraDeckEntries，舊JSON無此欄位仍可匯入；主牌維持60張，EXTRA最多6張、同號4張，Standard另套用現有禁限表（069限1）。candidate格式及房間仍獨立，混用兩個EXTRA欄位會被拒絕。詳見[正式EXTRA開放方案](bs8-formal-extra-plan-2026-09-07.md)。

- [正式單機Browser](../test-results/bs8-formal-extra/report.json)：1907×863／1164×777兩尺寸通過首頁匯入、六槽／第七張阻擋、069本體加異圖限1、保存重開、匯出及正常隨機開局。自己的6張EXTRA真圖全部載入；069由初始0對0支援不可登場，正常推進到0對2支援後可登場，EXTRA6→5／戰鬥區1→2，略過OnPlay後可繼續操作。沒有test-state、固定seed或注入狀態。
- [正式好友房Browser](../test-results/bs8-formal-extra-online/report.json)：兩尺寸均由雙方首頁匯入／儲存牌組後建立Standard房，完成正常開局；各持6張EXTRA，instanceId唯一，對手6張內容在伺服器傳輸與UI均遮罩，自己6張卡圖全部實際載入。
- 原有牌組編輯器Browser也以1366×768／1164×777通過正式EXTRA加入／主牌張數不變及candidate隔離；新單元測試涵蓋舊JSON、15筆異圖、張數／型別／禁限卡、storage往返、factory、協定與server。
- 開放後最終全套292檔／4498項通過，build、scoped lint通過；AI seed1–20正常結束、0卡死。全域lint仍保留上述既有診斷檔錯誤。

這些證據完成正式入口與共用狀態接線，不代表所有EXTRA技能或125張卡都已逐張打完正式線上對局。

## 風險與限制

既有工作區有大量未追蹤報告，全部保留。逐卡完整對局／線上證據仍不足；尚未驗證的項目保持未完成。發現需要新狀態機或公開協定的問題時，先完成具體設計再確認範圍。
