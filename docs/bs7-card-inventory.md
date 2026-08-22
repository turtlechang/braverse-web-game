# BS7 Arena of Glory 卡牌資料盤點（資料準備期）

> 本文件由 `npm run cards:import:bs7-candidate` 產生。BS7 僅隔離在候選資料區，尚未進入 runtime 或正式卡池。

## 來源與候選狀態

- 官方卡表：[CookieRun: Braverse Card List](https://cookierunbraverse.com/en/cardList)
- 官方 JSON：`https://cookierunbraverse.com/data/json/cardList_en.json`
- 抓取時間：`2026-08-21T08:05:09.792Z`
- 篩選規則：完整卡號以 `BS7-` 開頭，保留異圖／促銷變體。
- 候選狀態：`inventory`
- 圖片下載：否

## 數量摘要

| 項目 | 數量 |
| --- | ---: |
| 官方資料總數 | 2093 |
| BS7 匹配記錄 | 143 |
| 匯入候選記錄 | 143 |
| 不同基礎卡號 | 108 |
| 基礎記錄（無 `@` 變體尾碼） | 108 |
| 變體記錄（含 `@` 變體尾碼） | 35 |
| 僅有變體的基礎卡號 | 0（無） |

## 卡片類型

| 類型 | 數量 |
| --- | ---: |
| cookie | 116 |
| flip | 10 |
| item | 5 |
| stage | 5 |
| trap | 7 |

## 顏色

| 顏色 | 數量 |
| --- | ---: |
| BLUE | 25 |
| GREEN | 28 |
| PURE | 2 |
| PURPLE | 25 |
| RED | 29 |
| YELLOW | 27 |
| 未標示 | 7 |

## 產品批次

| 官方產品 | 數量 |
| --- | ---: |
| 2026 NA Brave League | 1 |
| BOOSTER PACK [Arena of Glory] | 136 |
| BS11 Release Event | 1 |
| promotion card | 1 |
| PROMOTION CARD | 1 |
| promotion-card | 3 |

## 後續稽核錨點

| 錨點 | 記錄數 | 基礎卡號 |
| --- | ---: | --- |
| `Arena` 關鍵字或文字 | 143 | BS7-001, BS7-002, BS7-003, BS7-004, BS7-005, BS7-006, BS7-007, BS7-008, BS7-009, BS7-010, BS7-011, BS7-012, BS7-013, BS7-014, BS7-015, BS7-016, BS7-017, BS7-018, BS7-019, BS7-020, BS7-021, BS7-022, BS7-023, BS7-024, BS7-025, BS7-026, BS7-027, BS7-028, BS7-029, BS7-030, BS7-031, BS7-032, BS7-033, BS7-034, BS7-035, BS7-036, BS7-037, BS7-038, BS7-039, BS7-040, BS7-041, BS7-042, BS7-043, BS7-044, BS7-045, BS7-046, BS7-047, BS7-048, BS7-049, BS7-050, BS7-051, BS7-052, BS7-053, BS7-054, BS7-055, BS7-056, BS7-057, BS7-058, BS7-059, BS7-060, BS7-061, BS7-062, BS7-063, BS7-064, BS7-065, BS7-066, BS7-067, BS7-068, BS7-069, BS7-070, BS7-071, BS7-072, BS7-073, BS7-074, BS7-075, BS7-076, BS7-077, BS7-078, BS7-079, BS7-080, BS7-081, BS7-082, BS7-083, BS7-084, BS7-085, BS7-086, BS7-087, BS7-088, BS7-089, BS7-090, BS7-091, BS7-092, BS7-093, BS7-094, BS7-095, BS7-096, BS7-097, BS7-098, BS7-099, BS7-100, BS7-101, BS7-102, BS7-103, BS7-104, BS7-105, BS7-106, BS7-107, BS7-108 |
| `PURE` 顏色 | 2 | BS7-108 |
| `Ancient` 關鍵字 | 0 | 無 |
| `Soul Jam` 名稱 | 0 | 無 |
| `Equip` 文字 | 0 | 無 |

## BS7 門檻

1. 執行 `npm run validate:candidate`，確認 schema、卡號唯一性與官方欄位結構。
2. 執行 `npm run cards:analyze:bs7-candidate`，依顏色列出主效果、能力及攻擊 `Then` 的轉接缺口。
3. 逐批完成 runtime adapter、規則引擎、UI、回歸測試與 Chrome 合法／不合法路徑驗證。
4. 所有未支援與待裁決項目清零前，保持 `inventory`，不執行 `npm run promote:candidate`。
