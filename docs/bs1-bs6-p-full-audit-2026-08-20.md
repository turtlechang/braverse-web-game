# BS1～BS6 與 P 卡全面稽核收尾

更新日期：2026-08-20

## 結論

正式卡池共 14 個資料檔、1,101 筆記錄，全部通過資料轉接、卡池 registry、嚴格行為契約與 Browser 卡牌路由驗證。BS1～BS6 與 P 卡的效果互動、全記錄負向路徑及無效果普通攻擊矩陣均為 0 blocked、0 failed。

`test-state` 只負責快速建立可重現局面；卡牌仍使用正式 `data/cards/`、adapter、`src/game/` 規則與 `GameCommand`。本輪另以 AI、牌組編輯器及本機雙瀏覽器好友房 smoke 驗證正式開局、隱藏資訊、同步、拒絕與斷線整合，因此可將共享規則修正套用到正式對戰，但不把 fixture 視為真實隨機牌序的長局統計。

## Browser 矩陣

| 系列 | 正式卡路由 | 效果互動 | 全記錄負向 | 無效果攻擊 |
| --- | ---: | ---: | ---: | ---: |
| BS1 | [99／99](bs1-browser-card-audit-2026-08-20.json) | [81／81](bs1-effect-audit-2026-08-20.json) | [99／99](bs1-negative-audit-2026-08-20.json) | [18／18](bs1-vanilla-attack-audit-2026-08-20.json) |
| BS2 | [104／104](bs2-browser-card-audit-2026-08-20.json) | [86／86](bs2-effect-audit-2026-08-20.json) | [104／104](bs2-negative-audit-2026-08-20.json) | [18／18](bs2-vanilla-attack-audit-2026-08-20.json) |
| BS3 | [176／176](bs3-browser-card-audit-2026-08-20.json) | [166／166](bs3-effect-audit-2026-08-20.json) | [176／176](bs3-negative-audit-2026-08-20.json) | [10／10](bs3-vanilla-attack-audit-2026-08-20.json) |
| BS4 | [170／170](bs4-browser-card-audit-2026-08-20.json) | [158／158](bs4-effect-audit-2026-08-20.json) | [170／170](bs4-negative-audit-2026-08-20.json) | [12／12](bs4-vanilla-attack-audit-2026-08-20.json) |
| BS5 | [153／153](bs5-browser-card-audit-2026-08-13.json) | [143／143](bs5-effect-audit-2026-08-13.json) | [153／153](bs5-negative-audit-2026-08-20.json) | [10／10](bs5-vanilla-attack-audit-2026-08-20.json) |
| BS6 | [138／138](bs6-browser-card-audit-2026-08-13.json) | [97／97](bs6-effect-audit-2026-08-12.json) | [138／138](bs6-negative-audit-2026-08-20.json) | [10／10](bs6-vanilla-attack-audit-2026-08-20.json) |
| P | [153／153](p0xx-browser-card-audit-2026-08-20.json) | [138／138](p0xx-effect-audit-2026-08-20.json) | [153／153](p0xx-negative-audit-2026-08-20.json) | [15／15](p0xx-vanilla-attack-audit-2026-08-20.json) |

BS6 的 97 筆效果互動矩陣依基礎卡與可互動效果去重，並非用來與 10 張無效果卡相加推算正式記錄總數；138／138 正式路由及 138／138 負向矩陣才是 BS6 全記錄完整性證據。

## 高風險規則與專項驗收

- BS4-038「Millennial Tree Cookie」的 `BS4-038`、`BS4-038@1`、`BS4-038@2` 均完成攻擊後目標選擇與「確認發動」，三筆皆 PASS。
- P-015 攻擊後可選代價的多段效果會在第一段目標完成後續接下一個 pending effect，不再重複套用同一組目標。
- P-016 的 `trash-to-break` 公開棄牌區候選已接入共用 targeting 與 EffectPanel，最終仍由規則層驗證合法性。
- BS4-014／BS4-080 的 Blocker redirect 與 LV.1 攻擊減傷不再因官方欄位／標記差異遺失；BS4-080 異圖的攻擊後抽牌亦保留。
- BS6-036、BS6-042、BS6-043 與 BS5-109 的專用 Browser acceptance 正反路徑全部通過，包含支付、略過、多段目標、場景放置與抽牌紀錄。
- BS5／BS6 卡文與 runtime 語意交叉驗證分別為 153 筆／400 項與 138 筆／325 項，均為 0 issues。

## 最終閘門

- `npm run validate:cards`：14 個檔案、1,101／1,101 成功轉換。
- `npm run check:card-pool`：generated registry 與 `data/cards/*.json` 一致。
- `npm run validate:candidate`：`data/candidates/` 無待驗證 JSON。
- `npm run cards:audit:contracts -- --strict`：1,101 verified、0 needs-review、0 blocked。
- `npm test -- --maxWorkers=1`：211 個 test files、3,401 tests 通過。
- `npm run typecheck`、`npm run lint`、`npm run build`、`npm run check:bundle` 通過；主 bundle gzip 145.63 KiB／180 KiB。
- Browser smoke：AI 20／20、牌組編輯器 4 個 viewport、本機雙瀏覽器好友房完整流程通過。
- `http://127.0.0.1:5173/` 回應 HTTP 200；前端 5173 與本機伺服器 8787 均在監聽。

## 稽核產物邊界

本文件及上表連結的完整 JSON 是本輪 canonical evidence。檔名含 `probe`、`retry`、單一卡號或 range 的 JSON，以及 `output/playwright/` 截圖與 `.tmp-*`，是除錯過程證據，不作為發布基線；目前保留於未追蹤工作區，未擅自刪除、搬移、commit 或 push。

## BS7 判定

可進入 BS7 的 inventory／candidate 資料準備期。BS7 仍須先停在 `data/candidates/`，依序完成 strict contract、逐色正反 Browser、正式 smoke 與人工檢閱後，才可執行 promote；本輪全綠不代表新彈可略過這些 gate。
