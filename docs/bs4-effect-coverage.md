# BS4 效果轉接覆蓋盤點

> 以 `npm run cards:analyze:bs4-candidate` 重新生成。
>
> 此文件只追蹤 runtime adapter 的轉接狀態；BS4 目前仍是 `inventory` 候選,尚未 promote 至 `data/cards/`,本報表是規劃逐卡轉接工作的依據,不取代 `validate:candidate` 的候選驗證。

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS4 基礎卡 | 111 |
| 主要效果文字已轉接 | 22 |
| 主要效果文字待轉接 | 65 |
| 沒有效果文字 | 24 |
| 額外能力來源已轉接 | 36 |
| 額外能力來源待轉接 | 51 |
| 攻擊 `Then` 已轉接 | 0／23 |

## 攻擊 `Then` 待轉接

BS4-003, BS4-009, BS4-013, BS4-016, BS4-023, BS4-026, BS4-029, BS4-038, BS4-039, BS4-049, BS4-053, BS4-054, BS4-061, BS4-069, BS4-073, BS4-075, BS4-076, BS4-083, BS4-089, BS4-090, BS4-091, BS4-098, BS4-103

## 額外能力來源待轉接

| 卡號 | 類型 | 卡名 | 顏色 |
| --- | --- | --- | --- |
| BS4-004 | cookie | Mala Sauce Cookie | RED |
| BS4-005 | cookie | Fire Spirit Cookie | RED |
| BS4-007 | cookie | Black Raisin Cookie | RED |
| BS4-011 | cookie | Chili Pepper Cookie | RED |
| BS4-019 | item | Ring of Eternal Flame | RED |
| BS4-020 | item | Essence of Conflagration | RED |
| BS4-022 | stage | Scovillia Training Grounds | RED |
| BS4-024 | cookie | Kumiho Cookie | YELLOW |
| BS4-025 | cookie | Gim Cookie | YELLOW |
| BS4-026 | cookie | Stormbringer Cookie | YELLOW |
| BS4-028 | cookie | Vagabond Cookie | YELLOW |
| BS4-030 | cookie | Peach Blossom Cookie | YELLOW |
| BS4-031 | flip | Rain Deity Cookie | YELLOW |
| BS4-035 | cookie | Okchun Cookie | YELLOW |
| BS4-038 | cookie | Millennial Tree Cookie | YELLOW |
| BS4-040 | item | Essence of Rejuvenation | YELLOW |
| BS4-043 | trap | Heaven-Splitting Lightning | YELLOW |
| BS4-044 | stage | Millennial Temple | YELLOW |
| BS4-048 | cookie | Mint Choco Cookie | GREEN |
| BS4-049 | cookie | Wind Archer Cookie | GREEN |
| BS4-051 | cookie | Beet Cookie | GREEN |
| BS4-053 | cookie | Sugar Swan Cookie | GREEN |
| BS4-055 | cookie | Alchemist Cookie | GREEN |
| BS4-057 | flip | Jelly Froggy | GREEN |
| BS4-058 | cookie | Lilybell Cookie | GREEN |
| BS4-059 | cookie | Cookiemals | GREEN |
| BS4-062 | item | Wind Gems | GREEN |
| BS4-063 | item | Swan Feather Dreamcatcher | GREEN |
| BS4-066 | stage | Dessert Paradise | GREEN |
| BS4-072 | flip | Mystic Opal Cookie | BLUE |
| BS4-073 | cookie | Sea Fairy Cookie | BLUE |
| BS4-074 | cookie | Peppermint Cookie | BLUE |
| BS4-075 | cookie | Black Pearl Cookie | BLUE |
| BS4-077 | cookie | Sorbet Shark Cookie | BLUE |
| BS4-081 | cookie | Crimson Coral Cookie | BLUE |
| BS4-084 | item | Heart of the Deep Sea | BLUE |
| BS4-088 | stage | Tower of Frozen Waves | BLUE |
| BS4-089 | cookie | Moonlight Cookie | PURPLE |
| BS4-092 | cookie | Milky Way Cookie | PURPLE |
| BS4-093 | cookie | Black Lemonade Cookie | PURPLE |
| BS4-094 | cookie | Blueberry Pie Cookie | PURPLE |
| BS4-095 | cookie | Shining Glitter Cookie | PURPLE |
| BS4-096 | cookie | Sugar Glass Cookie | PURPLE |
| BS4-098 | cookie | Stardust Cookie | PURPLE |
| BS4-099 | cookie | Amber Sugar Cookie | PURPLE |
| BS4-102 | flip | Wildberry Cookie | PURPLE |
| BS4-106 | item | Butterfly Brooch | PURPLE |
| BS4-107 | item | Moonlight Shards | PURPLE |
| BS4-108 | item | Plasma Crystal Ball | PURPLE |
| BS4-110 | stage | City of Wizards | PURPLE |
| BS4-111 | stage | Cookies of Legend | PURE |

## 使用方式

1. 先依此盤點選擇可由既有 runtime 表達的一小批卡牌。
2. 涉及附著、未知標記或新狀態區的卡牌保持候選，先確認官方規則後另開引擎切片。
3. BS4 完成首次 promote 前，候選資料須維持 `inventory`，完成 runtime 轉接與嚴格驗證後才可 promote。
