# Lv.5 AI 256 副牌組 Swiss 實戰報告

> 產生時間：2026-08-23T15:02:30.693Z；本報告是專案 runtime benchmark，不等同官方賽事結果。

## 結論

- Lv.5 Swiss：PASS，1024/1024 場完成，Top cut：PASS。
- 冠軍：Lv.5 Swiss 256 YELLOW #057；亞軍：Lv.5 Swiss 256 YELLOW #002。
- Lv.5 對同一批固定 pairing 的 Lv.4 控制組：1024/1024 場完成；同一勝者比例 83.11%。
- Lv.5 相對 Lv.4 的不一致場：Lv.5 較佳 90、Lv.4 較佳 83、平手 851；Wilson 95% CI 44.62%–59.34%。
- 本輪「高手感」只以安全完成率、終局預判 telemetry、Combo 完成率、同 pairing 對照與淘汰賽收斂作為可重現 proxy，不把勝率直接等同真人強度。

## 賽事設定

| 項目 | 值 |
|---|---|
| 牌組數 | 256（red 52／yellow 51／green 51／blue 51／purple 51） |
| Swiss 輪數 | 8 |
| Lv.5 maxActions | 2500 |
| seed | 20260823 |
| 賽制 | standard；ASIA 2026-02-13 |
| 禁限卡來源 | [BraverseFan 禁限卡表](https://braversefan.com/cookierun/banlist/)；[官方公告](https://cookierunbraverse.com/asia/notice/detail?id=1380) |

## 顏色統計（Lv.5 Swiss）

| 顏色 | 副數 | 平均積分 | 平均勝率 |
|---|---:|---:|---:|
| red | 52 | 13.33 | 55.93% |
| yellow | 51 | 12.76 | 53.85% |
| green | 51 | 10.29 | 43.21% |
| blue | 51 | 12.00 | 50.62% |
| purple | 51 | 11.59 | 48.28% |

## Top 8／Top 4／冠軍

Top 4：1. Lv.5 Swiss 256 YELLOW #057、2. Lv.5 Swiss 256 YELLOW #002、3. Lv.5 Swiss 256 YELLOW #032、4. Lv.5 Swiss 256 YELLOW #157

冠軍：**Lv.5 Swiss 256 YELLOW #057**；亞軍：**Lv.5 Swiss 256 YELLOW #002**。

### 1. Lv.5 Swiss 256 YELLOW #057（yellow，21 分）

  - 4x BS1-037 Timekeeper Cookie
  - 1x BS1-038 Cinnamon Cookie
  - 4x BS1-041 Orange Cookie
  - 1x BS1-046 Apple Cookie
  - 4x BS1-051 Super-Vita Jelly Bar
  - 2x BS3-025 Golden Cheese Cookie
  - 3x BS3-028 Mozzarella Cookie
  - 1x BS3-030 Black Raisin Cookie
  - 1x BS3-038 Cocoa Cookie
  - 4x BS4-024 Kumiho Cookie
  - 1x BS4-026 Stormbringer Cookie
  - 4x BS4-027 Moon Rabbit Cookie
  - 4x BS4-038 Millennial Tree Cookie
  - 4x BS4-042 Millennial Jade Deer
  - 2x BS5-024 Dr. Wasabi Cookie
  - 1x BS5-040 Ananas Dragon Cookie
  - 1x BS6-027 S'more Cookie
  - 3x BS6-031 Timekeeper Cookie
  - 1x BS6-043 Timecraft Garage
  - 1x P-109 Dino-Sour Cookie
  - 1x P-110 Sour Belt Cookie
  - 2x P-112 Adventurer Cookie
  - 4x ST2-005 Mustard Cookie
  - 4x ST2-007 Chestnut Cookie
  - 2x ST2-020 Winding Key Shield

### 2. Lv.5 Swiss 256 YELLOW #002（yellow，24 分）

  - 1x BS1-032 Banana Cookie
  - 4x BS1-037 Timekeeper Cookie
  - 4x BS1-041 Orange Cookie
  - 1x BS1-050 Broken Signpost
  - 1x BS2-011 Blackberry Cookie
  - 3x BS2-013 Wind-Up Pocket Watch
  - 3x BS3-028 Mozzarella Cookie
  - 2x BS3-030 Black Raisin Cookie
  - 1x BS3-031 Pancake Cookie
  - 2x BS3-032 Smoked Cheese Cookie
  - 4x BS4-024 Kumiho Cookie
  - 1x BS4-025 Gim Cookie
  - 1x BS4-026 Stormbringer Cookie
  - 2x BS4-036 GingerBrave
  - 4x BS4-038 Millennial Tree Cookie
  - 3x BS4-039 Churro Cookie
  - 4x BS4-042 Millennial Jade Deer
  - 4x BS5-023 Dino-Sour Cookie
  - 1x BS6-038 Coffee Candy Cookie
  - 1x BS7-033 Candy Drop Cookie
  - 1x BS7-036 Crème Knights Preceptor
  - 2x P-094 Lemon Cookie
  - 1x P-097 Cream Ferret Cookie
  - 1x P-129 Wedding Cake Cookie
  - 3x ST2-005 Mustard Cookie
  - 3x ST2-015 Hero Cookie
  - 2x ST2-020 Winding Key Shield

### 3. Lv.5 Swiss 256 YELLOW #032（yellow，21 分）

  - 1x BS1-032 Banana Cookie
  - 1x BS1-038 Cinnamon Cookie
  - 1x BS4-034 Street Urchin Cookie
  - 4x BS5-023 Dino-Sour Cookie
  - 4x BS5-025 Leek Cookie
  - 4x BS5-026 DJ Cookie
  - 4x BS5-028 Mango Cookie
  - 4x BS5-034 Sparkling Cookie
  - 4x BS5-036 Milk Cookie
  - 4x BS5-038 Cherry Cookie
  - 4x BS5-039 Cheesecake Cookie
  - 4x BS5-040 Ananas Dragon Cookie
  - 4x BS5-042 Sniffly Cocoa Palm
  - 4x BS5-043 Seasick Canoeing
  - 4x BS5-044 Ananas Dragon Cookie's Nest
  - 1x BS6-022 Ninja Cookie
  - 2x BS7-035 Kouign-Amann Cookie
  - 2x P-094 Lemon Cookie
  - 1x P-112 Adventurer Cookie
  - 1x P-152 Black Sapphire Cookie
  - 2x ST2-012 Cheerleader Cookie

### 4. Lv.5 Swiss 256 YELLOW #157（yellow，21 分）

  - 1x BS1-032 Banana Cookie
  - 1x BS1-040 Earl Grey Cookie
  - 1x BS1-052 Star Candy Road
  - 1x BS2-012 Onion Cookie
  - 2x BS3-039 Crème Brûlée Cookie
  - 2x BS4-030 Peach Blossom Cookie
  - 3x BS4-031 Rain Deity Cookie
  - 4x BS4-038 Millennial Tree Cookie
  - 4x BS4-042 Millennial Jade Deer
  - 3x BS5-023 Dino-Sour Cookie
  - 1x BS6-030 TBD Mender Cookie
  - 4x BS6-031 Timekeeper Cookie
  - 3x BS6-038 Coffee Candy Cookie
  - 3x BS6-040 Pilot Cookie
  - 3x BS7-025 Golden Osmanthus Cookie
  - 4x BS7-026 Twisted Donut Cookie
  - 3x BS7-028 Lemon Zest Cookie
  - 3x BS7-030 Rainbow Sherbet Cookie
  - 4x BS7-032 Onyx Cream Cookie
  - 3x BS7-040 Whipped Cream Cookie
  - 2x BS7-041 The Key to Unbreakable Faith
  - 1x P-048 Sparkling Cookie
  - 4x P-097 Cream Ferret Cookie

### 5. Lv.5 Swiss 256 RED #201（red，21 分）

  - 1x BS1-001 Goblin Cookie
  - 1x BS1-019 Walnut Cookie
  - 1x BS1-026 Desert Oasis
  - 1x BS3-015 Capsaicin Cookie
  - 1x BS3-019 Soul Jam: Light of Passion
  - 1x BS3-021 Oath on the Shield
  - 1x BS4-010 Scovillia Student Fan
  - 2x BS4-012 Capsaicin Cookie
  - 1x BS5-010 Starch Noodle Cookie
  - 4x BS6-001 Blue Lily Cookie
  - 4x BS6-002 Dark Choco Cookie
  - 4x BS6-003 Strawberry Stick Cookie
  - 4x BS6-005 Buttercream Choco Cookie
  - 4x BS6-007 Blue Slushy Cookie
  - 4x BS6-008 Sugar Swan Cookie
  - 4x BS6-009 Cotton Candy Cookie
  - 4x BS6-012 Lilybell Cookie
  - 4x BS6-013 Chess Choco Cookie
  - 4x BS6-020 Tonic Spray
  - 4x BS6-021 TBD Hallway
  - 1x BS7-001 Nutmeg Tiger Cookie
  - 1x BS7-022 Scovillia Quarters
  - 2x P-065 Pizza Cookie
  - 1x P-080 Tiny Cake Hound
  - 1x P-108 Pastel Meringue Cookie

### 6. Lv.5 Swiss 256 BLUE #224（blue，21 分）

  - 1x BS2-026 Mocha Ray Cookie
  - 1x BS2-042 Milk Cookie
  - 2x BS3-074 Grand Madeleine Cookie
  - 1x BS4-077 Sorbet Shark Cookie
  - 3x BS4-085 Tide Shards
  - 1x BS6-075 Onion Cookie
  - 4x BS6-080 Adventurer Cookie
  - 2x BS6-081 Truffle Cookie
  - 4x BS7-066 Princess Cookie
  - 4x BS7-067 Dark Choco Cookie
  - 4x BS7-069 Leek Cookie
  - 1x BS7-070 Raspberry Mousse Cookie
  - 2x BS7-072 Ice Mint Cookie
  - 4x BS7-074 Laurel Cookie
  - 4x BS7-075 Rose Cookie
  - 1x BS7-078 Frostrock Cookie
  - 3x BS7-081 Habanero Cookie
  - 4x BS7-082 Red Pepper Cookie
  - 4x BS7-083 White Choco Cookie
  - 3x BS7-084 The Sunblade
  - 3x BS7-086 Temple of the Sun Central Arena
  - 2x P-100 Icicle Yeti Cookie
  - 1x P-154 Black Sapphire Cookie
  - 1x ST4-012 Werewolf Cookie

### 7. Lv.5 Swiss 256 PURPLE #135（purple，21 分）

  - 4x BS2-061 Hydrangea Cookie
  - 4x BS2-062 Starfruit Cookie
  - 4x BS2-069 Clotted Cream Cookie
  - 4x BS2-071 Twizzly Gummy Cookie
  - 4x BS2-077 Forbidden Incantation
  - 1x BS2-078 Dragon's Breath
  - 2x BS2-080 Abandoned Cloud Nest
  - 3x BS2-081 Blue Dragon's Eye
  - 4x BS3-099 Dark Choco Cookie
  - 4x BS3-100 Dark Cacao Cookie
  - 1x BS3-101 Moon Rabbit Cookie
  - 4x BS3-105 Affogato Cookie
  - 1x BS3-113 Caramel Arrow Cookie
  - 4x BS3-117 Chocolate Altar of the Fallen
  - 2x BS4-092 Milky Way Cookie
  - 1x P-040 Milky Way Cookie
  - 2x P-135 Black Forest Cookie
  - 4x ST5-003 Fig Cookie
  - 2x ST5-009 GingerBrave
  - 1x ST5-011 Tiger Lily Cookie
  - 2x ST5-013 Pilot Cookie
  - 2x ST5-021 Hidden Warpgate

### 8. Lv.5 Swiss 256 RED #051（red，21 分）

  - 4x BS1-003 Dark Choco Cookie
  - 1x BS1-015 Rose Cookie
  - 1x BS1-017 Croissant Cookie
  - 2x BS1-026 Desert Oasis
  - 4x BS3-006 Snapdragon Cookie
  - 4x BS3-010 Pitaya Dragon Cookie
  - 1x BS3-013 Tiger Lily Cookie
  - 4x BS3-019 Soul Jam: Light of Passion
  - 2x BS3-022 Banquet of Victory
  - 1x BS3-023 Passionate Hollyberry Kingdom
  - 2x BS4-005 Fire Spirit Cookie
  - 3x BS4-007 Black Raisin Cookie
  - 2x BS4-014 Peperoncino Cookie
  - 2x BS4-017 Hot Scovillia Student
  - 2x BS4-018 Magma Pendulum
  - 3x BS4-019 Ring of Eternal Flame
  - 1x BS5-012 Eggnog Cookie
  - 1x BS5-015 Carol Cookie
  - 1x BS6-002 Dark Choco Cookie
  - 1x BS6-018 White Choco Cookie
  - 1x BS7-001 Nutmeg Tiger Cookie
  - 2x BS7-014 Capsaicin Cookie
  - 1x BS7-016 Cream Unicorn Cookie
  - 2x BS7-019 Rye Cookie
  - 2x P-036 GingerBrave
  - 2x ST1-007 Mint Choco Cookie
  - 4x ST1-013 Adventurer Cookie
  - 4x ST1-020 Overhydrated Dough Swamp

## Lv.5 vs Lv.4 對照

| 指標 | Lv.5 Swiss／Top cut | Lv.4 固定 pairing |
|---|---:|---:|
| 完成率 | 100.00% | 100.00% |
| stuck / invalid / deadlock / turn cap | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Combo started / completed / abandoned | 20 / 18 / 2 | 0 / 0 / 0 |
| Refresh／空場 forecast | 0 / 28 | 0 / 0 |
| 平均行動／回合 | 168.38 / 12.97 | 168.63 / 12.97 |

### 門檻判讀

本輪未達到預先設定的完整升格門檻；請依下方 telemetry 針對 Combo、Refresh／空場預判或 matchup 弱點迭代，不能只用排名宣稱 Lv.5 已顯著超越 Lv.4。

## 限制

1. Swiss pairing 依實際勝負動態變化；Lv.4 控制組固定重播 Lv.5 pairing，故是 paired control，不是另一場獨立 Swiss。
2. 「高手感」是可量測 proxy，不是人工盲測；後續仍應加入真人玩家盲評、更多 seed 與 Browser 實戰抽樣。
3. banlist 是 2026-02-13 的 ASIA 版本化快照；官方公告更新後必須重新產生 roster 與報告。
