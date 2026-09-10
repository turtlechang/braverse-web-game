# BS9 轉接缺口盤點

由 cards:analyze:bs9-candidate 產生。這是靜態盤點，所有卡的 Browser 驗收仍未完成；strict verified 不是卡圖語意驗收。

基礎卡 118；主效果待轉接 50；額外能力待轉接 50；攻擊 Then 0/16 已轉接。

BS9-001／`@1`／`@2` 的 strict adapter 已轉為 `modify-damage-received`（effect channel、this-turn、己方 0～1 目標），並以 5 項規則回歸及 `test:bs9-001:browser` 的 4／4 候選 Browser 路徑驗證。Browser 證據只涵蓋 localhost `test-state` 正向選 1 目標／發動與負向略過 FLIP；基本版與 `@2` 卡圖仍待目視，候選不代表可 promote。

| strict 狀態 | 筆數 |
| --- | ---: |
| verified | 67 |
| needs-review | 118 |

| 卡號 | strict 狀態 | 缺口 |
| --- | --- | --- |
| BS9-001 | verified | adapter／規則／Browser 局部已驗證；基本版卡圖與正式牌組／線上仍待 |
| BS9-001@1 | verified | adapter／規則／Browser 局部已驗證；異圖卡面與正式牌組／線上仍待 |
| BS9-001@2 | verified | adapter／規則已驗證；異圖卡面與 Browser／正式牌組／線上仍待 |
| BS9-002 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-002@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-003 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-003@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-004 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-004@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-005 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-005@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-006 | needs-review | condition evidence missing: friendly-cookie-fainted-this-turn; timing marker has no runtime ability; timing evidence missing |
| BS9-006@1 | needs-review | condition evidence missing: friendly-cookie-fainted-this-turn; timing marker has no runtime ability; timing evidence missing |
| BS9-007 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-007@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-008 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-009 | needs-review | condition evidence missing: opponent-cookie-fainted-this-turn; timing marker has no runtime ability; timing evidence missing |
| BS9-010 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; payment evidence missing; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-010@1 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; payment evidence missing; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-011 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-012 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-012@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-013 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-014 | needs-review | source contains unclassified clause; timing marker has no runtime ability; cost evidence missing; target evidence unresolved; timing evidence missing |
| BS9-014@1 | needs-review | source contains unclassified clause; timing marker has no runtime ability; cost evidence missing; target evidence unresolved; timing evidence missing |
| BS9-014@2 | needs-review | source contains unclassified clause; timing marker has no runtime ability; cost evidence missing; target evidence unresolved; timing evidence missing |
| BS9-015 | needs-review | Then clause has no runtime thenEffects evidence; target evidence unresolved; resolution order evidence missing |
| BS9-015@1 | needs-review | Then clause has no runtime thenEffects evidence; target evidence unresolved; resolution order evidence missing |
| BS9-016 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-017 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-017@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-018 | needs-review | your-turn marker missing runtime flag; timing evidence missing |
| BS9-019 | needs-review | payment clause has no runtime energy evidence; Then clause has no runtime thenEffects evidence; payment evidence missing; target evidence unresolved; resolution order evidence missing |
| BS9-020 | needs-review | payment clause has no runtime energy evidence; payment evidence missing |
| BS9-021 | needs-review | source contains unclassified clause; payment clause has no runtime energy evidence; payment evidence missing; target evidence unresolved |
| BS9-022 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-023 | needs-review | payment clause has no runtime energy evidence; timing marker has no runtime ability; payment evidence missing; cost evidence missing; target evidence unresolved; timing evidence missing |
| BS9-024 | needs-review | source contains unclassified clause; cost evidence missing |
| BS9-024@1 | needs-review | source contains unclassified clause; cost evidence missing |
| BS9-025 | needs-review | FLIP text has no runtime flip ability; cost evidence missing; target evidence unresolved |
| BS9-025@1 | needs-review | FLIP text has no runtime flip ability; cost evidence missing; target evidence unresolved |
| BS9-026 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-026@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-026@2 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-027 | needs-review | source contains unclassified clause; Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; resolution order evidence missing; timing evidence missing |
| BS9-027@1 | needs-review | source contains unclassified clause; Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; resolution order evidence missing; timing evidence missing |
| BS9-028 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-029 | needs-review | FLIP text has no runtime flip ability |
| BS9-029@1 | needs-review | FLIP text has no runtime flip ability |
| BS9-030 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; cost evidence missing; resolution order evidence missing; timing evidence missing |
| BS9-030@1 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; cost evidence missing; resolution order evidence missing; timing evidence missing |
| BS9-031 | needs-review | FLIP text has no runtime flip ability; Then clause has no runtime thenEffects evidence; cost evidence missing; resolution order evidence missing |
| BS9-031@1 | needs-review | FLIP text has no runtime flip ability; Then clause has no runtime thenEffects evidence; cost evidence missing; resolution order evidence missing |
| BS9-031@2 | needs-review | FLIP text has no runtime flip ability; Then clause has no runtime thenEffects evidence; cost evidence missing; resolution order evidence missing |
| BS9-032 | needs-review | FLIP text has no runtime flip ability; Then clause has no runtime thenEffects evidence; resolution order evidence missing |
| BS9-033 | needs-review | timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; timing evidence missing |
| BS9-033@1 | needs-review | timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; timing evidence missing |
| BS9-034 | needs-review | timing marker has no runtime ability; target evidence unresolved; timing evidence missing |
| BS9-035 | needs-review | source contains unclassified clause; Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-035@1 | needs-review | source contains unclassified clause; Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-036 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-037 | needs-review | target evidence unresolved |
| BS9-037@1 | needs-review | target evidence unresolved |
| BS9-038 | needs-review | timing marker has no runtime ability; timing evidence missing |
| BS9-039 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-040 | needs-review | timing marker has no runtime ability; once-per-turn marker missing runtime flag; timing evidence missing |
| BS9-041 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-041@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-041@2 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-042 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-043 | needs-review | payment clause has no runtime energy evidence; payment evidence missing; target evidence unresolved |
| BS9-044 | needs-review | payment clause has no runtime energy evidence; payment evidence missing; cost evidence missing; target evidence unresolved |
| BS9-045 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-046 | needs-review | target evidence unresolved |
| BS9-047 | needs-review | payment clause has no runtime energy evidence; timing marker has no runtime ability; payment evidence missing; cost evidence missing; target evidence unresolved; timing evidence missing |
| BS9-048 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-048@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-049 | needs-review | target evidence unresolved |
| BS9-049@1 | needs-review | target evidence unresolved |
| BS9-050 | needs-review | target evidence unresolved |
| BS9-050@1 | needs-review | target evidence unresolved |
| BS9-051 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-051@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-052 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-053 | needs-review | FLIP text has no runtime flip ability; Then clause has no runtime thenEffects evidence; target evidence unresolved; resolution order evidence missing |
| BS9-053@1 | needs-review | FLIP text has no runtime flip ability; Then clause has no runtime thenEffects evidence; target evidence unresolved; resolution order evidence missing |
| BS9-054 | needs-review | timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; target evidence unresolved; timing evidence missing |
| BS9-055 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-055@1 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-056 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-057 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-058 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-059 | needs-review | source contains unclassified clause; Then clause has no runtime thenEffects evidence; cost evidence missing; resolution order evidence missing |
| BS9-060 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-060@1 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-060@2 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-061 | needs-review | timing marker has no runtime ability; once-per-turn marker missing runtime flag; timing evidence missing |
| BS9-062 | needs-review | Then clause has no runtime thenEffects evidence; target evidence unresolved; resolution order evidence missing |
| BS9-063 | needs-review | timing marker has no runtime ability; cost evidence missing; timing evidence missing |
| BS9-063@1 | needs-review | timing marker has no runtime ability; cost evidence missing; timing evidence missing |
| BS9-064 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-064@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-065 | needs-review | target evidence unresolved |
| BS9-065@1 | needs-review | target evidence unresolved |
| BS9-066 | needs-review | payment clause has no runtime energy evidence; payment evidence missing; cost evidence missing; target evidence unresolved |
| BS9-067 | needs-review | payment clause has no runtime energy evidence; payment evidence missing; cost evidence missing; target evidence unresolved |
| BS9-068 | needs-review | payment clause has no runtime energy evidence; payment evidence missing |
| BS9-069 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-070 | needs-review | payment clause has no runtime energy evidence; timing marker has no runtime ability; payment evidence missing; cost evidence missing; timing evidence missing |
| BS9-071 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-071@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-072 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-073 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-074 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-075 | needs-review | Then clause has no runtime thenEffects evidence; resolution order evidence missing |
| BS9-076 | needs-review | Then clause has no runtime thenEffects evidence; resolution order evidence missing |
| BS9-077 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-077@1 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-077@2 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-078 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-078@1 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-079 | needs-review | Then clause has no runtime thenEffects evidence; resolution order evidence missing |
| BS9-079@1 | needs-review | Then clause has no runtime thenEffects evidence; resolution order evidence missing |
| BS9-079@2 | needs-review | Then clause has no runtime thenEffects evidence; resolution order evidence missing |
| BS9-079@3 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-080 | needs-review | timing marker has no runtime ability; cost evidence missing; timing evidence missing |
| BS9-081 | needs-review | timing marker has no runtime ability; timing evidence missing |
| BS9-082 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-083 | needs-review | timing marker has no runtime ability; once-per-turn marker missing runtime flag; timing evidence missing |
| BS9-084 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-084@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-084@2 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-085 | needs-review | FLIP text has no runtime flip ability; target evidence unresolved |
| BS9-085@1 | needs-review | FLIP text has no runtime flip ability; target evidence unresolved |
| BS9-086 | needs-review | timing marker has no runtime ability; once-per-turn marker missing runtime flag; target evidence unresolved; timing evidence missing |
| BS9-086@1 | needs-review | timing marker has no runtime ability; once-per-turn marker missing runtime flag; target evidence unresolved; timing evidence missing |
| BS9-087 | needs-review | timing marker has no runtime ability; cost evidence missing; target evidence unresolved; timing evidence missing |
| BS9-088 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-088@1 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-088@2 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-089 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; resolution order evidence missing; timing evidence missing |
| BS9-089@1 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; resolution order evidence missing; timing evidence missing |
| BS9-090 | needs-review | payment clause has no runtime energy evidence; payment evidence missing |
| BS9-091 | needs-review | source contains unclassified clause; payment clause has no runtime energy evidence; payment evidence missing; cost evidence missing; target evidence unresolved |
| BS9-092 | needs-review | payment clause has no runtime energy evidence; Then clause has no runtime thenEffects evidence; payment evidence missing; cost evidence missing; target evidence unresolved; resolution order evidence missing |
| BS9-092@1 | needs-review | payment clause has no runtime energy evidence; Then clause has no runtime thenEffects evidence; payment evidence missing; cost evidence missing; target evidence unresolved; resolution order evidence missing |
| BS9-093 | needs-review | target evidence unresolved |
| BS9-094 | needs-review | payment clause has no runtime energy evidence; payment evidence missing |
| BS9-095 | needs-review | payment clause has no runtime energy evidence; payment evidence missing |
| BS9-096 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-097 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-097@1 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; target evidence unresolved; resolution order evidence missing; timing evidence missing |
| BS9-098 | needs-review | timing marker has no runtime ability; cost evidence missing; timing evidence missing |
| BS9-098@1 | needs-review | timing marker has no runtime ability; cost evidence missing; timing evidence missing |
| BS9-098@2 | needs-review | timing marker has no runtime ability; cost evidence missing; timing evidence missing |
| BS9-099 | needs-review | timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; timing evidence missing |
| BS9-099@1 | needs-review | timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; timing evidence missing |
| BS9-100 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; cost evidence missing; resolution order evidence missing; timing evidence missing |
| BS9-100@1 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; cost evidence missing; resolution order evidence missing; timing evidence missing |
| BS9-100@2 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; cost evidence missing; resolution order evidence missing; timing evidence missing |
| BS9-101 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; cost evidence missing; resolution order evidence missing; timing evidence missing |
| BS9-101@1 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; cost evidence missing; resolution order evidence missing; timing evidence missing |
| BS9-102 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; resolution order evidence missing; timing evidence missing |
| BS9-102@1 | needs-review | Then clause has no runtime thenEffects evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; cost evidence missing; resolution order evidence missing; timing evidence missing |
| BS9-103 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-104 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-104@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-105 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-106 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-107 | needs-review | target evidence unresolved |
| BS9-108 | needs-review | target evidence unresolved |
| BS9-109 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-110 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-110@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-111 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-112 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-112@1 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-113 | needs-review | FLIP text has no runtime flip ability; cost evidence missing; target evidence unresolved |
| BS9-113@1 | needs-review | FLIP text has no runtime flip ability; cost evidence missing; target evidence unresolved |
| BS9-113@2 | needs-review | FLIP text has no runtime flip ability; cost evidence missing; target evidence unresolved |
| BS9-114 | needs-review | payment clause has no runtime energy evidence; payment evidence missing |
| BS9-115 | needs-review | payment clause has no runtime energy evidence; Then clause has no runtime thenEffects evidence; payment evidence missing; resolution order evidence missing |
| BS9-116 | needs-review | payment clause has no runtime energy evidence; payment evidence missing |
| BS9-117 | verified | 靜態未報錯；待獨立卡圖與 Browser 驗收 |
| BS9-118 | needs-review | source contains unclassified clause; payment clause has no runtime energy evidence; timing marker has no runtime ability; once-per-turn marker missing runtime flag; payment evidence missing; cost evidence missing; target evidence unresolved; timing evidence missing |

## 基礎卡 parser 盤點

| 卡號 | 主效果 | 額外能力 | 攻擊 Then |
| --- | --- | --- | --- |
| BS9-001 | supported | converted | not-applicable |
| BS9-002 | supported | converted | not-applicable |
| BS9-003 | supported | converted | not-applicable |
| BS9-004 | no-effect-text | not-applicable | not-applicable |
| BS9-005 | supported | converted | not-applicable |
| BS9-006 | unsupported-effect-text | pending | not-applicable |
| BS9-007 | supported | converted | not-applicable |
| BS9-008 | no-effect-text | not-applicable | not-applicable |
| BS9-009 | unsupported-effect-text | pending | not-applicable |
| BS9-010 | unsupported-effect-text | pending | not-applicable |
| BS9-011 | supported | converted | not-applicable |
| BS9-012 | supported | converted | not-applicable |
| BS9-013 | no-effect-text | not-applicable | not-applicable |
| BS9-014 | unsupported-effect-text | pending | not-applicable |
| BS9-015 | unsupported-effect-text | pending | not-applicable |
| BS9-016 | supported | converted | not-applicable |
| BS9-017 | supported | converted | pending |
| BS9-018 | unsupported-effect-text | pending | not-applicable |
| BS9-019 | no-effect-text | not-applicable | not-applicable |
| BS9-020 | no-effect-text | not-applicable | not-applicable |
| BS9-021 | no-effect-text | not-applicable | not-applicable |
| BS9-022 | no-effect-text | not-applicable | not-applicable |
| BS9-023 | no-effect-text | not-applicable | not-applicable |
| BS9-024 | supported | converted | pending |
| BS9-025 | unsupported-effect-text | pending | not-applicable |
| BS9-026 | supported | converted | not-applicable |
| BS9-027 | unsupported-effect-text | pending | not-applicable |
| BS9-028 | no-effect-text | not-applicable | not-applicable |
| BS9-029 | unsupported-effect-text | pending | not-applicable |
| BS9-030 | unsupported-effect-text | pending | not-applicable |
| BS9-031 | unsupported-effect-text | pending | not-applicable |
| BS9-032 | unsupported-effect-text | pending | not-applicable |
| BS9-033 | unsupported-effect-text | pending | not-applicable |
| BS9-034 | unsupported-effect-text | pending | not-applicable |
| BS9-035 | unsupported-effect-text | pending | pending |
| BS9-036 | unsupported-effect-text | pending | not-applicable |
| BS9-037 | unsupported-effect-text | pending | not-applicable |
| BS9-038 | unsupported-effect-text | pending | not-applicable |
| BS9-039 | no-effect-text | not-applicable | not-applicable |
| BS9-040 | unsupported-effect-text | pending | not-applicable |
| BS9-041 | supported | converted | not-applicable |
| BS9-042 | supported | converted | not-applicable |
| BS9-043 | no-effect-text | not-applicable | not-applicable |
| BS9-044 | no-effect-text | not-applicable | not-applicable |
| BS9-045 | no-effect-text | not-applicable | not-applicable |
| BS9-046 | no-effect-text | not-applicable | not-applicable |
| BS9-047 | no-effect-text | not-applicable | not-applicable |
| BS9-048 | supported | converted | not-applicable |
| BS9-049 | unsupported-effect-text | pending | not-applicable |
| BS9-050 | supported | converted | pending |
| BS9-051 | supported | converted | not-applicable |
| BS9-052 | supported | converted | not-applicable |
| BS9-053 | unsupported-effect-text | pending | not-applicable |
| BS9-054 | unsupported-effect-text | pending | not-applicable |
| BS9-055 | unsupported-effect-text | pending | not-applicable |
| BS9-056 | no-effect-text | not-applicable | not-applicable |
| BS9-057 | no-effect-text | not-applicable | not-applicable |
| BS9-058 | no-effect-text | not-applicable | not-applicable |
| BS9-059 | no-effect-text | not-applicable | pending |
| BS9-060 | unsupported-effect-text | pending | pending |
| BS9-061 | unsupported-effect-text | pending | not-applicable |
| BS9-062 | no-effect-text | not-applicable | pending |
| BS9-063 | unsupported-effect-text | pending | not-applicable |
| BS9-064 | unsupported-effect-text | pending | not-applicable |
| BS9-065 | supported | converted | pending |
| BS9-066 | no-effect-text | not-applicable | not-applicable |
| BS9-067 | no-effect-text | not-applicable | not-applicable |
| BS9-068 | no-effect-text | not-applicable | not-applicable |
| BS9-069 | no-effect-text | not-applicable | not-applicable |
| BS9-070 | no-effect-text | not-applicable | not-applicable |
| BS9-071 | supported | converted | not-applicable |
| BS9-072 | no-effect-text | not-applicable | not-applicable |
| BS9-073 | no-effect-text | not-applicable | not-applicable |
| BS9-074 | no-effect-text | not-applicable | not-applicable |
| BS9-075 | no-effect-text | not-applicable | pending |
| BS9-076 | no-effect-text | not-applicable | pending |
| BS9-077 | unsupported-effect-text | pending | pending |
| BS9-078 | unsupported-effect-text | pending | pending |
| BS9-079 | no-effect-text | not-applicable | pending |
| BS9-080 | unsupported-effect-text | pending | not-applicable |
| BS9-081 | unsupported-effect-text | pending | not-applicable |
| BS9-082 | unsupported-effect-text | pending | not-applicable |
| BS9-083 | unsupported-effect-text | pending | not-applicable |
| BS9-084 | supported | converted | not-applicable |
| BS9-085 | unsupported-effect-text | pending | not-applicable |
| BS9-086 | unsupported-effect-text | pending | not-applicable |
| BS9-087 | unsupported-effect-text | pending | not-applicable |
| BS9-088 | unsupported-effect-text | pending | not-applicable |
| BS9-089 | unsupported-effect-text | pending | pending |
| BS9-090 | no-effect-text | not-applicable | not-applicable |
| BS9-091 | no-effect-text | not-applicable | not-applicable |
| BS9-092 | no-effect-text | not-applicable | not-applicable |
| BS9-093 | no-effect-text | not-applicable | not-applicable |
| BS9-094 | no-effect-text | not-applicable | not-applicable |
| BS9-095 | no-effect-text | not-applicable | not-applicable |
| BS9-096 | unsupported-effect-text | pending | not-applicable |
| BS9-097 | unsupported-effect-text | pending | pending |
| BS9-098 | unsupported-effect-text | pending | not-applicable |
| BS9-099 | unsupported-effect-text | pending | not-applicable |
| BS9-100 | unsupported-effect-text | pending | pending |
| BS9-101 | unsupported-effect-text | pending | not-applicable |
| BS9-102 | unsupported-effect-text | pending | not-applicable |
| BS9-103 | no-effect-text | not-applicable | not-applicable |
| BS9-104 | supported | converted | not-applicable |
| BS9-105 | no-effect-text | not-applicable | not-applicable |
| BS9-106 | unsupported-effect-text | pending | not-applicable |
| BS9-107 | supported | converted | not-applicable |
| BS9-108 | unsupported-effect-text | pending | not-applicable |
| BS9-109 | no-effect-text | not-applicable | not-applicable |
| BS9-110 | supported | converted | not-applicable |
| BS9-111 | unsupported-effect-text | pending | not-applicable |
| BS9-112 | supported | converted | not-applicable |
| BS9-113 | unsupported-effect-text | pending | not-applicable |
| BS9-114 | unsupported-effect-text | pending | not-applicable |
| BS9-115 | no-effect-text | not-applicable | not-applicable |
| BS9-116 | no-effect-text | not-applicable | not-applicable |
| BS9-117 | no-effect-text | not-applicable | not-applicable |
| BS9-118 | no-effect-text | not-applicable | not-applicable |
