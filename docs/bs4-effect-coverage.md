# BS4 效果轉接覆蓋盤點

> 以 `npm run cards:analyze:bs4-candidate` 重新生成。
>
> 此文件只追蹤 runtime adapter 的轉接狀態；BS4 目前仍是 `inventory` 候選,尚未 promote 至 `data/cards/`,本報表是規劃逐卡轉接工作的依據,不取代 `validate:candidate` 的候選驗證。

## 摘要

| 項目 | 數量 |
| --- | ---: |
| BS4 基礎卡 | 111 |
| 主要效果文字已轉接 | 47 |
| 主要效果文字待轉接 | 40 |
| 沒有效果文字 | 24 |
| 額外能力來源已轉接 | 62 |
| 額外能力來源待轉接 | 25 |
| 攻擊 `Then` 已轉接 | 18／23 |

## 攻擊 `Then` 待轉接

BS4-023, BS4-029, BS4-069, BS4-090, BS4-091

## 額外能力來源待轉接

| 卡號 | 類型 | 卡名 | 顏色 |
| --- | --- | --- | --- |
| BS4-020 | item | Essence of Conflagration | RED |
| BS4-022 | stage | Scovillia Training Grounds | RED |
| BS4-024 | cookie | Kumiho Cookie | YELLOW |
| BS4-025 | cookie | Gim Cookie | YELLOW |
| BS4-030 | cookie | Peach Blossom Cookie | YELLOW |
| BS4-031 | flip | Rain Deity Cookie | YELLOW |
| BS4-035 | cookie | Okchun Cookie | YELLOW |
| BS4-040 | item | Essence of Rejuvenation | YELLOW |
| BS4-043 | trap | Heaven-Splitting Lightning | YELLOW |
| BS4-044 | stage | Millennial Temple | YELLOW |
| BS4-055 | cookie | Alchemist Cookie | GREEN |
| BS4-057 | flip | Jelly Froggy | GREEN |
| BS4-058 | cookie | Lilybell Cookie | GREEN |
| BS4-062 | item | Wind Gems | GREEN |
| BS4-063 | item | Swan Feather Dreamcatcher | GREEN |
| BS4-066 | stage | Dessert Paradise | GREEN |
| BS4-073 | cookie | Sea Fairy Cookie | BLUE |
| BS4-074 | cookie | Peppermint Cookie | BLUE |
| BS4-075 | cookie | Black Pearl Cookie | BLUE |
| BS4-084 | item | Heart of the Deep Sea | BLUE |
| BS4-088 | stage | Tower of Frozen Waves | BLUE |
| BS4-092 | cookie | Milky Way Cookie | PURPLE |
| BS4-093 | cookie | Black Lemonade Cookie | PURPLE |
| BS4-098 | cookie | Stardust Cookie | PURPLE |
| BS4-111 | stage | Cookies of Legend | PURE |

## 使用方式

1. 先依此盤點選擇可由既有 runtime 表達的一小批卡牌。
2. 涉及附著、未知標記或新狀態區的卡牌保持候選，先確認官方規則後另開引擎切片。
3. BS4 完成首次 promote 前，候選資料須維持 `inventory`，完成 runtime 轉接與嚴格驗證後才可 promote。
