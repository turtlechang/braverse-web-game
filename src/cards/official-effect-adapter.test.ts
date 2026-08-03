import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import officialBS4Dataset from '../../data/cards/official-age-of-heroes-and-kingdoms-bs4.en.json'
import officialSample from '../../data/cards/official-sample.en.json'
import officialYellowSample from '../../data/cards/official-starter-deck-yellow.en.json'
import officialGreenSample from '../../data/cards/official-starter-deck-green.en.json'
import officialBlueSample from '../../data/cards/official-starter-deck-blue.en.json'
import officialPurpleSample from '../../data/cards/official-starter-deck-purple.en.json'
import officialBraveBeginning from '../../data/cards/official-brave-beginning-bs1.en.json'
import officialBraveBeginningBS2 from '../../data/cards/official-brave-beginning-bs2.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCardEffectSet,
  convertOfficialAttackEffects,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
  type OfficialCardRecord,
} from '.'

const cards = officialSample.cards as OfficialCardRecord[]
const yellowCards = officialYellowSample.cards as OfficialCardRecord[]
const greenCards = officialGreenSample.cards as OfficialCardRecord[]
const blueCards = officialBlueSample.cards as OfficialCardRecord[]
const purpleCards = officialPurpleSample.cards as OfficialCardRecord[]
const braveBeginningCards = officialBraveBeginning.cards as OfficialCardRecord[]
const braveBeginningBS2Cards = officialBraveBeginningBS2.cards as OfficialCardRecord[]
const bs3Cards = officialBS3Inventory.cards as OfficialCardRecord[]
const bs4DatasetCards = officialBS4Dataset.cards as OfficialCardRecord[]
// 保留少量內嵌官方資料作為明確 fixture，避免測試依賴完整卡池內容；找不到
// fixture 的 BS4 卡牌才回退到已 promote 的正式資料集。
const bs4Cards: OfficialCardRecord[] = [
  {
    sourceId: 44531,
    locale: 'en',
    cardNumber: 'BS4-070',
    baseCardNumber: 'BS4-070',
    variant: null,
    name: 'Lord Oyster',
    type: 'cookie',
    officialType: 'COOKIE',
    rarity: 'C',
    grade: 'COMMON',
    level: 1,
    hp: 2,
    energyType: 'BLUE',
    color: 'BLUE',
    skill: {
      name: '{sk} Broken Promise',
      text: 'When this Cookie faints, <discard 2 cards.> Draw up to 3 cards from your deck.',
    },
    attackText: '<{B}> For Family {da} 1',
    flipText: null,
    keywords: [],
    product: {
      id: 209,
      title: 'BOOSTER PACK [Age of Heroes and Kingdoms]',
      category: null,
    },
    restrictions: { banned: false, limited: false },
    flags: { enabled: true, hidden: false, extra: false },
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/D8VPjo1A6DEdAGWjqB3-aQ.webp',
    officialUpdatedAt: '2026-03-13T08:54:17.000Z',
    sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
  },
  {
    sourceId: 44551,
    locale: 'en',
    cardNumber: 'BS4-082',
    baseCardNumber: 'BS4-082',
    variant: null,
    name: 'Frilled Jellyfish Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    rarity: 'U',
    grade: 'UNCOMMON',
    level: 1,
    hp: 2,
    energyType: 'BLUE',
    color: 'BLUE',
    skill: {
      name: '{sk} Clean and Pristine',
      text: '{ap} <{B}> Draw up to 3 cards from your deck and discard 2 cards.',
    },
    attackText: '<{B}> Frilled Snare {da} 1',
    flipText: null,
    keywords: [],
    product: {
      id: 209,
      title: 'BOOSTER PACK [Age of Heroes and Kingdoms]',
      category: null,
    },
    restrictions: { banned: false, limited: false },
    flags: { enabled: true, hidden: false, extra: false },
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/TdNlMUiJ62loDdNwSYN2vQ.webp',
    officialUpdatedAt: '2026-03-13T08:54:17.000Z',
    sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
  },
  {
    sourceId: 44554,
    locale: 'en',
    cardNumber: 'BS4-085',
    baseCardNumber: 'BS4-085',
    variant: null,
    name: 'Tide Shards',
    type: 'item',
    officialType: 'ITEM',
    rarity: 'SR',
    grade: 'SUPER RARE',
    level: null,
    hp: null,
    energyType: 'BLUE',
    color: 'BLUE',
    skill: { name: null, text: null },
    attackText:
      "<{B}{B}> <Discard 4 cards.> Select up to 2 of your opponent's Cookies. Those Cookies receive 1 damage each. Then, draw up to 4 cards from your deck.",
    flipText: null,
    keywords: [],
    product: {
      id: 209,
      title: 'BOOSTER PACK [Age of Heroes and Kingdoms]',
      category: null,
    },
    restrictions: { banned: false, limited: false },
    flags: { enabled: true, hidden: false, extra: false },
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/MefIZiNv4L_KNRVPneTXLg.webp',
    officialUpdatedAt: '2026-03-13T08:54:17.000Z',
    sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
  },
  {
    sourceId: 44545,
    locale: 'en',
    cardNumber: 'BS4-076',
    baseCardNumber: 'BS4-076',
    variant: null,
    name: 'Star Coral Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    rarity: 'C',
    grade: 'COMMON',
    level: 1,
    hp: 3,
    energyType: 'BLUE',
    color: 'BLUE',
    skill: { name: null, text: null },
    attackText:
      '<{B}{B}> Lighthouse Inspection! {da} 1\r\nThen, if your hand contains 5 cards or less, draw up to 1 card from your deck.',
    flipText: null,
    keywords: [],
    product: {
      id: 209,
      title: 'BOOSTER PACK [Age of Heroes and Kingdoms]',
      category: null,
    },
    restrictions: { banned: false, limited: false },
    flags: { enabled: true, hidden: false, extra: false },
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/example-bs4-076.webp',
    officialUpdatedAt: '2026-03-13T08:54:17.000Z',
    sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
  },
  {
    sourceId: 44552,
    locale: 'en',
    cardNumber: 'BS4-083',
    baseCardNumber: 'BS4-083',
    variant: null,
    name: 'Pirate Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    rarity: 'R',
    grade: 'RARE',
    level: 3,
    hp: 4,
    energyType: 'BLUE',
    color: 'BLUE',
    skill: { name: null, text: null },
    attackText:
      '<{B}{B}{N}> Ghost Cannons {da} 3\r\nThen, if your hand contains 5 cards or more, deals 1 damage.',
    flipText: null,
    keywords: [],
    product: {
      id: 209,
      title: 'BOOSTER PACK [Age of Heroes and Kingdoms]',
      category: null,
    },
    restrictions: { banned: false, limited: false },
    flags: { enabled: true, hidden: false, extra: false },
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/example-bs4-083.webp',
    officialUpdatedAt: '2026-03-13T08:54:17.000Z',
    sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
  },
  {
    sourceId: 44550,
    locale: 'en',
    cardNumber: 'BS4-081',
    baseCardNumber: 'BS4-081',
    variant: null,
    name: 'Crimson Coral Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    rarity: 'R',
    grade: 'RARE',
    level: 2,
    hp: 4,
    energyType: 'BLUE',
    color: 'BLUE',
    skill: {
      name: '{sk} Somber Affection',
      text:
        "{ap} <Discard 1 card.> Select 1 of the following.\r\n・Select up to 1 LV.1 Cookie in your opponent's battle area. Place that Cookie on the bottom of your opponent's deck.\r\n・Draw up to 2 cards from your deck.",
    },
    attackText: '<{B}{B}{B}> Legion of Tearcrown {da} 3',
    flipText: null,
    keywords: [],
    product: {
      id: 209,
      title: 'BOOSTER PACK [Age of Heroes and Kingdoms]',
      category: null,
    },
    restrictions: { banned: false, limited: false },
    flags: { enabled: true, hidden: false, extra: false },
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/example-bs4-081.webp',
    officialUpdatedAt: '2026-03-13T08:54:17.000Z',
    sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
  },
  {
    sourceId: 44533,
    locale: 'en',
    cardNumber: 'BS4-072',
    baseCardNumber: 'BS4-072',
    variant: null,
    name: 'Mystic Opal Cookie',
    type: 'flip',
    officialType: 'FLIP',
    rarity: 'C',
    grade: 'COMMON',
    level: 1,
    hp: 1,
    energyType: 'BLUE',
    color: 'BLUE',
    skill: { name: null, text: null },
    attackText: '<{B}> Waves of Destiny {da} 1',
    flipText:
      'View 3 cards from the top of your deck; return them to the top of your deck in any order.',
    keywords: [],
    product: {
      id: 209,
      title: 'BOOSTER PACK [Age of Heroes and Kingdoms]',
      category: null,
    },
    restrictions: { banned: false, limited: false },
    flags: { enabled: true, hidden: false, extra: false },
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/AsCTEh26-mqvNLw3zwsO-A.webp',
    officialUpdatedAt: '2026-03-13T08:54:17.000Z',
    sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
  },
  {"sourceId":44439,"locale":"en","cardNumber":"BS4-004","baseCardNumber":"BS4-004","variant":null,"name":"Mala Sauce Cookie","type":"cookie","officialType":"COOKIE","rarity":"U","grade":"UNCOMMON","level":1,"hp":2,"energyType":"RED","color":"RED","skill":{"name":"{sk} Flaming Mala","text":"{ap} <Place 1 card from the top of this Cookie's HP into the trash.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage."},"attackText":"<{R}> Too Spicy For Ya?! {da} 1","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/D9QSBxc4VYc5DY1W7K_U0g.webp","officialUpdatedAt":"2026-03-13T08:54:15.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44441,"locale":"en","cardNumber":"BS4-005","baseCardNumber":"BS4-005","variant":null,"name":"Fire Spirit Cookie","type":"cookie","officialType":"COOKIE","rarity":"UR","grade":"ULTRA RARE","level":3,"hp":5,"energyType":"RED","color":"RED","skill":{"name":"{sk} Living Embodiment of Flame","text":"{mob} {t1} <Place 1 card from the top of this Cookie's HP into the trash.> Deals 1 damage to all of your opponent's Cookies."},"attackText":"<{R}{R}{R}> Flame Dash {da} 3","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/065crj91eTC6fiHKp56xgA.webp","officialUpdatedAt":"2026-03-13T08:54:15.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44444,"locale":"en","cardNumber":"BS4-007","baseCardNumber":"BS4-007","variant":null,"name":"Black Raisin Cookie","type":"cookie","officialType":"COOKIE","rarity":"C","grade":"COMMON","level":1,"hp":3,"energyType":"RED MIX","color":"RED","skill":{"name":"{sk} Burning Shadow","text":"{mob} {t1} <{R}> <Place 1 card from the top of this Cookie's HP into the trash.> Select up to 1 of your other {R} Cookies. During this turn, that Cookie gains +1 attack damage."},"attackText":"<{R}{N}> Fiery Watcher {da} 1","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/m7jkbtoviZldGY_9p8NKcg.webp","officialUpdatedAt":"2026-03-13T08:54:15.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44448,"locale":"en","cardNumber":"BS4-011","baseCardNumber":"BS4-011","variant":null,"name":"Chili Pepper Cookie","type":"cookie","officialType":"COOKIE","rarity":"C","grade":"COMMON","level":2,"hp":3,"energyType":"RED","color":"RED","skill":{"name":"{sk} Cheap Shot","text":"If your opponent's Cookie faints from this Cookie's attack, draw 1 card from your deck and discard 1 card."},"attackText":"<{R}{R}> Who Ordered Spicy?! {da} 2","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/UI_AuGn_tsnUjIirshLAwg.webp","officialUpdatedAt":"2026-03-13T08:54:15.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44437,"locale":"en","cardNumber":"BS4-003","baseCardNumber":"BS4-003","variant":null,"name":"Madeleine Cookie","type":"cookie","officialType":"COOKIE","rarity":"R","grade":"RARE","level":2,"hp":4,"energyType":"RED MIX","color":"RED","skill":{"name":null,"text":null},"attackText":"<{R}{R}{N}> Crimson Knight {da} 2\r\nThen, if there is another {R} Cookie in your battle area, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/fEfGiRf38HP82eITNHCxnw.webp","officialUpdatedAt":"2026-03-13T08:54:15.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44446,"locale":"en","cardNumber":"BS4-009","baseCardNumber":"BS4-009","variant":null,"name":"Espresso Cookie","type":"cookie","officialType":"COOKIE","rarity":"C","grade":"COMMON","level":3,"hp":4,"energyType":"RED MIX","color":"RED","skill":{"name":null,"text":null},"attackText":"<{R}{R}{N}> Roasted to the Char {da} 3\r\nThen, if the attacked Cookie is LV.2 or lower, that Cookie receives 1 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/PdavavAAjJHvp_lynRuANg.webp","officialUpdatedAt":"2026-03-13T08:54:15.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44451,"locale":"en","cardNumber":"BS4-013","baseCardNumber":"BS4-013","variant":null,"name":"Crushed Pepper Cookie","type":"cookie","officialType":"COOKIE","rarity":"UR","grade":"ULTRA RARE","level":2,"hp":2,"energyType":"RED","color":"RED","skill":{"name":"{sk} Burning Passion","text":"{mob} {t1} <{R}> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage."},"attackText":"<{R}{R}> Numbing Knuckles {da} 2\r\nThen, <can be used as {R}.> Deals 1 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/DDMCA8oARJ17bO4Kt7NZHg.webp","officialUpdatedAt":"2026-03-13T08:54:15.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44457,"locale":"en","cardNumber":"BS4-016","baseCardNumber":"BS4-016","variant":null,"name":"Rye Cookie","type":"cookie","officialType":"COOKIE","rarity":"U","grade":"UNCOMMON","level":2,"hp":1,"energyType":"RED","color":"RED","skill":{"name":null,"text":null},"attackText":"<{R}{R}> Dual Barrage {da} 2\r\nThen, select up to 1 of your opponent's Cookies whose remaining HP is 1. That Cookie receives 1 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/CV0q5Txhf9q8x22pXxnKtg.webp","officialUpdatedAt":"2026-03-13T08:54:15.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44485,"locale":"en","cardNumber":"BS4-038","baseCardNumber":"BS4-038","variant":null,"name":"Millennial Tree Cookie","type":"cookie","officialType":"COOKIE","rarity":"UR","grade":"ULTRA RARE","level":3,"hp":5,"energyType":"YELLOW","color":"YELLOW","skill":{"name":"{sk} Magic of Earth and Time","text":"{ap} <{Y}> Select up to 1 {Y} LV.2 or lower Cookie from your break area and play them."},"attackText":"<{Y}{Y}{Y}> Sacred Roots {da} 3\r\nThen, if there is another {Y} Cookie in your battle area, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/AbYQ3TKjbdBWfSCcI3N4Og.webp","officialUpdatedAt":"2026-03-13T08:54:16.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44469,"locale":"en","cardNumber":"BS4-026","baseCardNumber":"BS4-026","variant":null,"name":"Stormbringer Cookie","type":"cookie","officialType":"COOKIE","rarity":"UR","grade":"ULTRA RARE","level":3,"hp":5,"energyType":"YELLOW","color":"YELLOW","skill":{"name":"{sk} Lightning Blitzstorm","text":"{ap} <{Y}{Y}> If your opponent's break area is LV.5 or lower, select up to 1 of your opponent's LV.2 or lower Cookies. Place that Cookie in your opponent's break area."},"attackText":"<{Y}{Y}{Y}> Divine Retribution {da} 2\r\nThen, <can be used as {Y}.> If your break area is LV.3 or higher, select up to 1 of your opponent's Cookies. That Cookie receives 2 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/YKfWcC58KuGsiigVwLvDtw.webp","officialUpdatedAt":"2026-03-13T08:54:16.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44473,"locale":"en","cardNumber":"BS4-028","baseCardNumber":"BS4-028","variant":null,"name":"Vagabond Cookie","type":"cookie","officialType":"COOKIE","rarity":"C","grade":"COMMON","level":1,"hp":2,"energyType":"YELLOW","color":"YELLOW","skill":{"name":"{sk} Alright! Woo-Hoo!","text":"{ap} If your break area is LV.5 or higher, draw up to 1 card from your deck. Then, discard 1 card."},"attackText":"<{Y}{Y}> Dance to the Beat! {da} 2","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/fCbFc7tjd8gnMys1XJTXIA.webp","officialUpdatedAt":"2026-03-13T08:54:16.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44487,"locale":"en","cardNumber":"BS4-039","baseCardNumber":"BS4-039","variant":null,"name":"Churro Cookie","type":"cookie","officialType":"COOKIE","rarity":"SR","grade":"SUPER RARE","level":2,"hp":5,"energyType":"YELLOW","color":"YELLOW","skill":{"name":null,"text":null},"attackText":"<{Y}{Y}{Y}> Churro Pillar {da} 2\r\nThen, if this Cookie's remaining HP is 2 or more, select up to 1 of your opponent's LV.1 Cookies. That Cookie receives 2 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/rC35tUtnc2tR7jWmPFqaCQ.webp","officialUpdatedAt":"2026-03-13T08:54:16.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44505,"locale":"en","cardNumber":"BS4-051","baseCardNumber":"BS4-051","variant":null,"name":"Beet Cookie","type":"cookie","officialType":"COOKIE","rarity":"C","grade":"COMMON","level":2,"hp":3,"energyType":"GREEN MIX","color":"GREEN","skill":{"name":"{sk} Hunter's Bolt","text":"{mob} {t1} <Place 1 card from your support area into the trash.> Set this Cookie as active."},"attackText":"<{G}{G}{N}> Deadly Aim {da} 2","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/o85miBENYKGW5S1dLFzofA.webp","officialUpdatedAt":"2026-03-13T08:54:16.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44517,"locale":"en","cardNumber":"BS4-059","baseCardNumber":"BS4-059","variant":null,"name":"Cookiemals","type":"cookie","officialType":"COOKIE","rarity":"SR","grade":"SUPER RARE","level":1,"hp":1,"energyType":"GREEN","color":"GREEN","skill":{"name":"{sk} Rumble, Tumble, Soar!","text":"{mob} {t1} <{G}> If your support area contains 3 cards or less, draw up to 2 cards from your deck."},"attackText":"<{G}{G}> *Rawr!* Were You Scared? {da} 1","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/WyYe31ZByG_J6A1PYesYLQ.webp","officialUpdatedAt":"2026-03-13T08:54:16.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44501,"locale":"en","cardNumber":"BS4-048","baseCardNumber":"BS4-048","variant":null,"name":"Mint Choco Cookie","type":"cookie","officialType":"COOKIE","rarity":"C","grade":"COMMON","level":1,"hp":3,"energyType":"GREEN MIX","color":"GREEN","skill":{"name":"{sk} Battlefield Symphony","text":"When your turn ends, if your support area contains 7 {G} cards or more, set up to 1 card in your support area as active."},"attackText":"<{G}{N}> Pièce de Résistance {da} 1","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/o0N05DOWFaZZkUDQ5knvBg.webp","officialUpdatedAt":"2026-03-13T08:54:16.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44507,"locale":"en","cardNumber":"BS4-053","baseCardNumber":"BS4-053","variant":null,"name":"Sugar Swan Cookie","type":"cookie","officialType":"COOKIE","rarity":"UR","grade":"ULTRA RARE","level":3,"hp":5,"energyType":"GREEN","color":"GREEN","skill":{"name":"{sk} Breath of Life","text":"{ap} <{G}{G}> Select up to 1 of your {G} LV.2 or lower Cookies in your battle area. Place that Cookie in your support area as active."},"attackText":"<{G}{G}{G}> Shining Wings {da} 3\r\nThen, <can be used as {G}.> If your support area contains 7 cards or more, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/Nt6iVxKyqKQX2JTu40nZLQ.webp","officialUpdatedAt":"2026-03-13T08:54:16.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44502,"locale":"en","cardNumber":"BS4-049","baseCardNumber":"BS4-049","variant":null,"name":"Wind Archer Cookie","type":"cookie","officialType":"COOKIE","rarity":"UR","grade":"ULTRA RARE","level":3,"hp":5,"energyType":"GREEN","color":"GREEN","skill":{"name":"{sk} Razor Gale","text":"{ap} Select up to 1 of your opponent's Cookies from their battle area. Place that Cookie in your opponent's support area as rested."},"attackText":"<{G}{G}{G}> Cleansing Arrow {da} 3\r\nThen, <can be used as {G}.> If your opponent's support area contains 7 cards or more, select up to 1 of your opponent's Cookies. That Cookie receives 2 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/I6CL4EaxOq6FvsAc7wUhtw.webp","officialUpdatedAt":"2026-03-13T08:54:16.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44509,"locale":"en","cardNumber":"BS4-054","baseCardNumber":"BS4-054","variant":null,"name":"Avocado Cookie","type":"cookie","officialType":"COOKIE","rarity":"C","grade":"COMMON","level":3,"hp":5,"energyType":"GREEN","color":"GREEN","skill":{"name":null,"text":null},"attackText":"<{G}{G}{G}{G}> Blacksmith Incoming! {da} 3\r\nThen, if your support area contains 5 cards or more, deals 1 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/f4Cd5hlPAGEj2Pxhpv1Zxg.webp","officialUpdatedAt":"2026-03-13T08:54:16.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44520,"locale":"en","cardNumber":"BS4-061","baseCardNumber":"BS4-061","variant":null,"name":"Herb Cookie","type":"cookie","officialType":"COOKIE","rarity":"SR","grade":"SUPER RARE","level":2,"hp":4,"energyType":"GREEN","color":"GREEN","skill":{"name":null,"text":null},"attackText":"<{G}{G}{G}> Nature's Beauty {da} 3\r\nThen, if your support area contains 7 cards or more, set up to 1 card in your support area as active.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/slT6LU8WmAEuGLM8kH5XYQ.webp","officialUpdatedAt":"2026-03-13T08:54:16.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44571,"locale":"en","cardNumber":"BS4-095","baseCardNumber":"BS4-095","variant":null,"name":"Shining Glitter Cookie","type":"cookie","officialType":"COOKIE","rarity":"C","grade":"COMMON","level":2,"hp":4,"energyType":"PURPLE","color":"PURPLE","skill":{"name":"{sk} All Eyes on the Stage!","text":"{ap} <{P}> Place up to 1 of your opponent's stage cards in the trash."},"attackText":"<{P}{P}{P}> Shining Syndrome {da} 3","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/Kv6l9GvfliPppBP6HUOoug.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44572,"locale":"en","cardNumber":"BS4-096","baseCardNumber":"BS4-096","variant":null,"name":"Sugar Glass Cookie","type":"cookie","officialType":"COOKIE","rarity":"SR","grade":"SUPER RARE","level":1,"hp":3,"energyType":"PURPLE","color":"PURPLE","skill":{"name":"{sk} Stained Glass","text":"{mob} {t1} <{P}> <Place 1 card from the top of this Cookie's HP card into the trash.> Draw up to 1 card from your deck."},"attackText":"<{P}{P}> Memory Fragments {da} 1","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/Y4gsiJOw7LDhz6GUMzRxhA.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44586,"locale":"en","cardNumber":"BS4-106","baseCardNumber":"BS4-106","variant":null,"name":"Butterfly Brooch","type":"item","officialType":"ITEM","rarity":"U","grade":"UNCOMMON","level":null,"hp":null,"energyType":"PURPLE","color":"PURPLE","skill":{"name":null,"text":null},"attackText":"<{P}{P}> If your opponent's trash contains 10 cards or more, select up to 1 of your opponent's LV.2 or lower Cookies. Place up to 1 card from the top of that Cookie's HP into the trash.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/Kx2u5DbvxgCPcTfMoLUH-w.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44587,"locale":"en","cardNumber":"BS4-107","baseCardNumber":"BS4-107","variant":null,"name":"Moonlight Shards","type":"item","officialType":"ITEM","rarity":"SR","grade":"SUPER RARE","level":null,"hp":null,"energyType":"PURPLE","color":"PURPLE","skill":{"name":null,"text":null},"attackText":"<{P}{P}> If your opponent's trash contains 15 cards or more, select up to 1 of your opponent's Cookies. That Cookie receives 2 damage. Then, place up to 3 cards from the top of your deck into the trash.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/6HBYOAUe2ajq9SJ9Om41UA.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44589,"locale":"en","cardNumber":"BS4-108","baseCardNumber":"BS4-108","variant":null,"name":"Plasma Crystal Ball","type":"item","officialType":"ITEM","rarity":"U","grade":"UNCOMMON","level":null,"hp":null,"energyType":"PURPLE","color":"PURPLE","skill":{"name":null,"text":null},"attackText":"<{P}{P}{P}> <Discard 1 card.> Return up to 1 {P} card from your trash to your hand. Then, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/96kh-F57TrF1KAbsutaurg.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44591,"locale":"en","cardNumber":"BS4-110","baseCardNumber":"BS4-110","variant":null,"name":"City of Wizards","type":"stage","officialType":"STAGE","rarity":"U","grade":"UNCOMMON","level":null,"hp":null,"energyType":"PURPLE","color":"PURPLE","skill":{"name":null,"text":"<{P}> Place in your stage area."},"attackText":"{mob} <{P}> <Rest this card.> <Discard 2 cards.> If your trash contains 15 cards or less, draw up to 2 cards from your deck.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/ANblEPQRaoYtIFhPAN24tQ.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44583,"locale":"en","cardNumber":"BS4-103","baseCardNumber":"BS4-103","variant":null,"name":"Cream Unicorn Cookie","type":"cookie","officialType":"COOKIE","rarity":"C","grade":"COMMON","level":1,"hp":3,"energyType":"PURPLE","color":"PURPLE","skill":{"name":null,"text":null},"attackText":"<{P}{P}> Dreamy Parade {da} 1\r\nThen, place up to 3 cards from the top of your deck into the trash.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/pLkScX2cY3D8GQTJy1eSoA.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44576,"locale":"en","cardNumber":"BS4-098","baseCardNumber":"BS4-098","variant":null,"name":"Stardust Cookie","type":"cookie","officialType":"COOKIE","rarity":"UR","grade":"ULTRA RARE","level":3,"hp":5,"energyType":"PURPLE","color":"PURPLE","skill":{"name":"{sk} Sign of the Stars","text":"{mob} {t1} <{P}> <Discard 1 card.> Select up to 1 of your opponent's Cookies. During this turn, that Cookie's HP-attached FLIP effects cannot be activated. Then, that Cookie receives 1 damage."},"attackText":"<{P}{P}{P}> Wrath of the Stars {da} 2\r\nThen, <can be used as {P}.> If your trash contains 15 {P} cards or more, deals 2 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/Vab5NFhI4WNedppi7e7YcA.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44559,"locale":"en","cardNumber":"BS4-089","baseCardNumber":"BS4-089","variant":null,"name":"Moonlight Cookie","type":"cookie","officialType":"COOKIE","rarity":"UR","grade":"ULTRA RARE","level":3,"hp":6,"energyType":"PURPLE","color":"PURPLE","skill":{"name":"{sk} Dreaming Moonlight","text":"{ap} Place 5 cards from the top of your opponent's deck in the trash. Then, if your opponent has 2 Cookies in their battle area, select up to 1 of your opponent's Cookies. Place that Cookie in the trash."},"attackText":"<{P}{P}{P}> Dreams of Victory {da} 3\r\nThen, if your opponent's trash contains 15 cards or more, draw up to 2 cards from your deck and discard 1 card.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/JPIA7ZV3FClRqX25jtt85A.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44534,"locale":"en","cardNumber":"BS4-073","baseCardNumber":"BS4-073","variant":null,"name":"Sea Fairy Cookie","type":"cookie","officialType":"COOKIE","rarity":"UR","grade":"ULTRA RARE","level":3,"hp":5,"energyType":"BLUE","color":"BLUE","skill":{"name":"{sk} Soaring Compassion","text":"{ap} <{B}> <Place 1 LV.2 or lower Cookie from your battle area on the bottom of your deck.> Deals 1 damage to all of your opponent's Cookies."},"attackText":"<{B}{B}{B}> Tidal Wave {da} 2\r\nThen, <can be used as {B}.> If your hand contains 5 cards or more, deals 2 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/swbKxU4iHoIKNoZCMLWGgA.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44542,"locale":"en","cardNumber":"BS4-077","baseCardNumber":"BS4-077","variant":null,"name":"Sorbet Shark Cookie","type":"cookie","officialType":"COOKIE","rarity":"SR","grade":"SUPER RARE","level":1,"hp":1,"energyType":"BLUE","color":"BLUE","skill":{"name":"{sk} Shark Splash","text":"{mob} <{B}> <Place this Cookie on the bottom of your deck.> If your hand contains 5 cards or less and there is a {B} Cookie in your battle area, draw up to 2 cards from your deck."},"attackText":"<{B}{B}> 0ooOoo! OooOoO! {da} 1","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/yAPC4xcajfGooV6IAkhClA.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44538,"locale":"en","cardNumber":"BS4-075","baseCardNumber":"BS4-075","variant":null,"name":"Black Pearl Cookie","type":"cookie","officialType":"COOKIE","rarity":"UR","grade":"ULTRA RARE","level":3,"hp":5,"energyType":"BLUE","color":"BLUE","skill":{"name":"{sk} Maelstrom of the Duskgloom Sea","text":"{mob} {t1} <{B}> <Select 1 LV.1 Cookie from your opponent's battle area or 1 stage from either player's stage area and place it on the bottom of the owner's deck.> During this turn, this Cookie gains +1 attack damage."},"attackText":"<{B}{B}{B}> Terror of the Abyss {da} 2\r\nThen, <discard 2 cards.> Select up to 1 of your opponent's Cookies.  That Cookie receives 2 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/9FEhD_AKXzbFR9mSEcM6Pg.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44569,"locale":"en","cardNumber":"BS4-094","baseCardNumber":"BS4-094","variant":null,"name":"Blueberry Pie Cookie","type":"cookie","officialType":"COOKIE","rarity":"R","grade":"RARE","level":2,"hp":4,"energyType":"PURPLE","color":"PURPLE","skill":{"name":"{sk} Cursed Tome","text":"{mob} {t1} If there is a {P} LV.3 Cookie in your battle area, both players place the top 3 cards from their decks into the trash."},"attackText":"<{P}{P}{P}> Power Unleashed {da} 3","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/n8iNdgDBDgsmFvl7-6uDBQ.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44578,"locale":"en","cardNumber":"BS4-099","baseCardNumber":"BS4-099","variant":null,"name":"Amber Sugar Cookie","type":"cookie","officialType":"COOKIE","rarity":"U","grade":"UNCOMMON","level":1,"hp":2,"energyType":"PURPLE","color":"PURPLE","skill":{"name":"{sk} Honeydipper Staff","text":"{ap} <{P}> Place up to 3 cards from the top of either player's deck into the trash."},"attackText":"<{P}> *Buzz, Buzz* {da} 1","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/iBORbFVuS94ekUpKGB8STA.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44582,"locale":"en","cardNumber":"BS4-102","baseCardNumber":"BS4-102","variant":null,"name":"Wildberry Cookie","type":"flip","officialType":"FLIP","rarity":"C","grade":"COMMON","level":1,"hp":1,"energyType":"PURPLE","color":"PURPLE","skill":{"name":null,"text":null},"attackText":"<{P}> Taste THIS! {da} 1","flipText":"Place up to 3 cards from the top of either player's deck into the trash.","keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/Tsl_v8k4uU2lybzMCQXHgg.webp","officialUpdatedAt":"2026-03-13T08:54:17.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44460,"locale":"en","cardNumber":"BS4-019","baseCardNumber":"BS4-019","variant":null,"name":"Ring of Eternal Flame","type":"item","officialType":"ITEM","rarity":"U","grade":"UNCOMMON","level":null,"hp":null,"energyType":"RED","color":"RED","skill":{"name":null,"text":null},"attackText":"<{R}{R}> Select 1 of your {R} Cookies from your battle area. Place 1 card from the top of this Cookie's HP into the trash. Then, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/jCPgBxaWqRSeisyHNwMEGQ.webp","officialUpdatedAt":"2026-03-13T08:54:15.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
  {"sourceId":44515,"locale":"en","cardNumber":"BS4-058","baseCardNumber":"BS4-058","variant":null,"name":"Lilybell Cookie","type":"cookie","officialType":"COOKIE","rarity":"R","grade":"RARE","level":2,"hp":3,"energyType":"GREEN","color":"GREEN","skill":{"name":"{sk} Blossoming Lyre","text":"{mob} {t1} <{G}{G}> Select up to 1 of your {G} Cookies from your support area and play them."},"attackText":"<{G}{G}> Victory Serenade {da} 2","flipText":null,"keywords":[],"product":{"id":209,"title":"BOOSTER PACK [Age of Heroes and Kingdoms]","category":null},"restrictions":{"banned":false,"limited":false},"flags":{"enabled":true,"hidden":false,"extra":false},"imageUrl":"https://cookierunbraverse.com/data/en_storage/x1OWHom-NMAGHgSSd2UPHg.webp","officialUpdatedAt":"2026-03-13T08:54:16.000Z","sourceUrl":"https://cookierunbraverse.com/data/json/cardList_en.json"} as OfficialCardRecord,
]

const findCard = (cardNumber: string) => {
  const card = cards.find((candidate) => candidate.cardNumber === cardNumber)

  if (!card) {
    throw new Error(`Missing official sample card ${cardNumber}`)
  }

  return card
}

const findYellowCard = (cardNumber: string) => {
  const card = yellowCards.find(
    (candidate) => candidate.cardNumber === cardNumber,
  )

  if (!card) {
    throw new Error(`Missing yellow sample card ${cardNumber}`)
  }

  return card
}

const findGreenCard = (cardNumber: string) => {
  const card = greenCards.find(
    (candidate) => candidate.cardNumber === cardNumber,
  )

  if (!card) {
    throw new Error(`Missing green sample card ${cardNumber}`)
  }

  return card
}

const findBlueCard = (cardNumber: string) => {
  const card = blueCards.find(
    (candidate) => candidate.cardNumber === cardNumber,
  )

  if (!card) {
    throw new Error(`Missing blue sample card ${cardNumber}`)
  }

  return card
}

const findPurpleCard = (cardNumber: string) => {
  const card = purpleCards.find(
    (candidate) => candidate.cardNumber === cardNumber,
  )

  if (!card) {
    throw new Error(`Missing purple sample card ${cardNumber}`)
  }

  return card
}

const findBraveBeginningCard = (baseCardNumber: string) => {
  const card = braveBeginningCards.find(
    (candidate) => candidate.baseCardNumber === baseCardNumber,
  )

  if (!card) {
    throw new Error(`Missing Brave Beginning sample card ${baseCardNumber}`)
  }

  return card
}

const findBraveBeginningBS2Card = (baseCardNumber: string) => {
  const card = braveBeginningBS2Cards.find(
    (candidate) => candidate.baseCardNumber === baseCardNumber,
  )

  if (!card) {
    throw new Error(`Missing Brave Beginning BS2 sample card ${baseCardNumber}`)
  }

  return card
}

const findBs3Card = (cardNumber: string) => {
  const card = bs3Cards.find((candidate) => candidate.cardNumber === cardNumber)

  if (!card) {
    throw new Error(`Missing BS3 inventory card ${cardNumber}`)
  }

  return card
}

const findBs4Card = (cardNumber: string) => {
  const card =
    bs4Cards.find((candidate) => candidate.cardNumber === cardNumber) ??
    bs4DatasetCards.find((candidate) => candidate.cardNumber === cardNumber)

  if (!card) {
    throw new Error(`Missing BS4 card ${cardNumber}`)
  }

  return card
}

describe('Starter Deck RED official effect adapter', () => {
  it('imports all 22 distinct starter deck cards', () => {
    expect(cards).toHaveLength(22)
    expect(new Set(cards.map((card) => card.cardNumber)).size).toBe(22)
    expect(
      cards.every(
        (card) => card.product.title === 'Starter Deck RED',
      ),
    ).toBe(true)
  })

  it('parses direct damage and multi-target selection', () => {
    expect(convertOfficialCardEffects(findCard('ST1-016'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: {
            side: 'opponent',
            min: 0,
            max: 1,
          },
        },
      ],
    })

    expect(convertOfficialCardEffects(findCard('ST1-003'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          kind: 'damage',
          amount: 2,
          target: {
            side: 'opponent',
            min: 0,
            max: 2,
          },
        },
      ],
    })
  })

  it('parses cookie skill timing, usage limits, and energy costs', () => {
    expect(convertOfficialCookieSkill(findCard('ST1-002'))).toMatchObject({
      trigger: 'on-play',
      oncePerTurn: false,
      yourTurn: false,
      cost: { energy: { red: 1 }, discardHand: 0 },
    })
    expect(convertOfficialCookieSkill(findCard('ST1-003'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { red: 2, neutral: 2 }, discardHand: 0 },
    })
    expect(convertOfficialCookieSkill(findCard('ST1-008'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      restSource: true,
      cost: { energy: { red: 2 }, discardHand: 0 },
    })
    expect(convertOfficialCookieSkill(findCard('ST1-009'))).toMatchObject({
      trigger: 'passive',
      yourTurn: true,
      cost: { energy: {}, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          target: { sourceOnly: true },
        },
      ],
    })
  })

  it('parses positive and negative attack modifiers', () => {
    expect(convertOfficialCardEffects(findCard('ST1-019'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          kind: 'modify-attack',
          amount: 1,
          duration: 'this-turn',
          target: { side: 'self' },
        },
      ],
    })

    expect(convertOfficialCardEffects(findCard('ST1-020'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent' },
        },
      ],
    })

    expect(convertOfficialCardEffects(findCard('ST1-018'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          kind: 'modify-damage-received',
          amount: -2,
          duration: 'opponent-next-turn',
          target: { side: 'self' },
        },
      ],
    })
  })

  it('preserves target filters and activation conditions', () => {
    expect(convertOfficialCardEffects(findCard('ST1-021'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          target: {
            remainingHp: 1,
          },
        },
      ],
    })

    expect(convertOfficialCardEffects(findCard('ST1-002'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: {
            side: 'opponent',
            min: 1,
            max: 1,
          },
          condition: {
            kind: 'break-level-at-least',
            level: 6,
          },
        },
      ],
    })
  })

  it('marks unsupported starter deck effects explicitly', () => {
    const conversions = convertOfficialCardEffectSet(cards)
    const supported = conversions.filter(
      (conversion) => conversion.status === 'supported',
    )
    const princess = conversions.find(
      (conversion) => conversion.cardNumber === 'ST1-001',
    )

    expect(supported).toHaveLength(12)
    expect(supported.map((conversion) => conversion.cardNumber)).toEqual(
      expect.arrayContaining([
        'ST1-002',
        'ST1-003',
        'ST1-007',
        'ST1-008',
        'ST1-009',
        'ST1-010',
        'ST1-016',
        'ST1-018',
        'ST1-019',
        'ST1-020',
        'ST1-021',
      ]),
    )
    expect(princess).toMatchObject({
      status: 'unsupported',
      reason: 'unsupported-effect-text',
    })
  })

  describe('Starter Deck YELLOW effect regression', () => {
    it('imports all 20 distinct YELLOW cards', () => {
      expect(yellowCards).toHaveLength(20)
      expect(new Set(yellowCards.map((c) => c.cardNumber)).size).toBe(20)
      expect(
        yellowCards.every((c) => c.product.title === 'Starter Deck YELLOW'),
      ).toBe(true)
    })

    it('supports YELLOW cookie, item, and trap effects', () => {
      const conversions = convertOfficialCardEffectSet(yellowCards)
      const supported = conversions.filter(
        (c) => c.status === 'supported',
      )

      expect(supported).toHaveLength(9)
      expect(supported.map((c) => c.cardNumber).sort()).toEqual(
        [
          'ST2-001',
          'ST2-004',
          'ST2-008',
          'ST2-010',
          'ST2-011',
          'ST2-016',
          'ST2-018',
          'ST2-019',
          'ST2-020',
        ].sort(),
      )
    })

    it('ST2-004 Macaron Cookie gain-hp on other cookie is supported', () => {
      expect(
        convertOfficialCardEffects(findYellowCard('ST2-004')),
      ).toMatchObject({
        status: 'supported',
        cardNumber: 'ST2-004',
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 0, max: 1, excludeSource: true },
          },
        ],
      })
    })

    it('ST2-011 Cherry Cookie faint damage is supported', () => {
      expect(
        convertOfficialCardEffects(findYellowCard('ST2-011')),
      ).toMatchObject({
        status: 'supported',
        cardNumber: 'ST2-011',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })

    it('ST2-001 Roguefort Cookie opponent-discard-hand is supported', () => {
      const conversion = convertOfficialCardEffects(findYellowCard('ST2-001'))
      expect(conversion).toMatchObject({
        status: 'supported',
        cardNumber: 'ST2-001',
        effects: [{ kind: 'opponent-discard-hand', count: 1 }],
      })

      const skill = convertOfficialCookieSkill(findYellowCard('ST2-001'))
      expect(skill).toMatchObject({
        trigger: 'on-play',
        oncePerTurn: false,
        cost: { energy: { yellow: 1 }, discardHand: 0 },
        effects: [{ kind: 'opponent-discard-hand', count: 1 }],
      })
    })

    it('ST2-016 Flimsy Screwdriver item has disable-flip effect', () => {
      expect(
        convertOfficialCardEffects(findYellowCard('ST2-016')),
      ).toMatchObject({
        status: 'supported',
        cardNumber: 'ST2-016',
        effects: [
          {
            kind: 'disable-flip',
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })

    it('ST2-021 Pretzel Snare trap ability parses cost, condition, and damage', () => {
      const conversion = convertOfficialTrapAbility(findYellowCard('ST2-021'))
      expect(conversion).toMatchObject({
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        condition: { kind: 'attacker-attack-more-than', amount: 4 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })

    it('ST2-020 Winding Key Shield does not leak the break-area LV.5 condition into the target selector', () => {
      const conversion = convertOfficialTrapAbility(findYellowCard('ST2-020'))
      expect(conversion).toMatchObject({
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        condition: { kind: 'break-level-at-least', level: 5 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -3,
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
      const effect = conversion?.effects[0]
      expect(effect?.kind === 'modify-attack' ? effect.target.minLevel : undefined).toBeUndefined()
    })

    it('ST2-011 faint damage targets opponent with min 0 max 1', () => {
      const conversion =
        convertOfficialCardEffects(findYellowCard('ST2-011'))

      expect(conversion.status).toBe('supported')
      expect(conversion).toMatchObject({
        effects: [
          {
            kind: 'damage',
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })

    it('ST2-008 Eclair Cookie break-to-trash OnPlay effect is supported', () => {
      const conversion =
        convertOfficialCardEffects(findYellowCard('ST2-008'))

      expect(conversion).toMatchObject({
        status: 'supported',
        cardNumber: 'ST2-008',
        effects: [
          {
            kind: 'break-to-trash',
            max: 1,
            exactLevel: 1,
          },
        ],
      })
      if (conversion.status === 'supported') {
        expect(conversion.effects[0]).not.toHaveProperty('condition')
      }
    })

    it('ST2-010 Purple Yam Cookie break-to-trash with condition is supported', () => {
      const conversion =
        convertOfficialCardEffects(findYellowCard('ST2-010'))

      expect(conversion).toMatchObject({
        status: 'supported',
        cardNumber: 'ST2-010',
        effects: [
          {
            kind: 'break-to-trash',
            max: 1,
            exactLevel: 1,
            condition: {
              kind: 'break-level-at-least',
              level: 6,
            },
          },
        ],
      })
    })

    it('ST2-008 Eclair Cookie skill parsing returns correct trigger and cost', () => {
      const skill = convertOfficialCookieSkill(findYellowCard('ST2-008'))

      expect(skill).toMatchObject({
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        effects: [{ kind: 'break-to-trash', max: 1, exactLevel: 1 }],
      })
    })

    it('ST2-010 Purple Yam Cookie skill parsing returns correct trigger and cost', () => {
      const skill = convertOfficialCookieSkill(findYellowCard('ST2-010'))

      expect(skill).toMatchObject({
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { yellow: 1 }, discardHand: 0 },
        effects: [
          {
            kind: 'break-to-trash',
            max: 1,
            exactLevel: 1,
            condition: { kind: 'break-level-at-least', level: 6 },
          },
        ],
      })
    })

    it('rejects break-to-trash text with Then (compound effect)', () => {
      const card = {
        ...findYellowCard('ST2-008'),
        skill: {
          name: null,
          text: '{ap} Select up to 1 LV.1 card from your break area and place it in the trash. Then, draw 1 card.',
        },
      }

      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('ST2-015 has no skill text (no-effect-text)', () => {
      expect(
        convertOfficialCardEffects(findYellowCard('ST2-015')),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'no-effect-text',
      })
    })
  })

  describe('Starter Deck GREEN effect regression', () => {
    it('imports all 22 distinct GREEN cards', () => {
      expect(greenCards).toHaveLength(22)
      expect(new Set(greenCards.map((c) => c.cardNumber)).size).toBe(22)
      expect(
        greenCards.every((c) => c.product.title === 'Starter Deck GREEN'),
      ).toBe(true)
    })

    it('supports GREEN cookie and item effects', () => {
      const conversions = convertOfficialCardEffectSet(greenCards)
      const supported = conversions.filter(
        (c) => c.status === 'supported',
      )

      expect(supported).toHaveLength(10)
      expect(supported.map((c) => c.cardNumber)).toEqual([
        'ST3-001',
        'ST3-002',
        'ST3-004',
        'ST3-005',
        'ST3-009',
        'ST3-010',
        'ST3-015',
        'ST3-016',
        'ST3-017',
        'ST3-018',
      ])
    })

    it('ST3-001 Muscle Cookie gain-hp is supported', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-001')),
      ).toMatchObject({
        status: 'supported',
        cardNumber: 'ST3-001',
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
    })

    it('ST3-002 Strawberry Crepe Cookie is supported', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-002')),
      ).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })

    it.each([
      ['ST3-002', 'damage'],
      ['ST3-005', 'damage'],
      ['ST3-015', 'modify-attack'],
    ] as const)(
      '%s parses the support-to-trash skill cost',
      (cardNumber, effectKind) => {
        expect(
          convertOfficialCookieSkill(findGreenCard(cardNumber)),
        ).toMatchObject({
          trigger: 'activate',
          oncePerTurn: true,
          cost: {
            energy: {},
            discardHand: 0,
            supportToTrash: 1,
          },
          effects: [{ kind: effectKind }],
        })
      },
    )

    it('supports ST3-004 Vampire Cookie OnPlay damage and gain-hp', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-004')),
      ).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
    })

    it('ST3-004 Vampire Cookie skill parses as OnPlay with GGGN cost', () => {
      const skill = convertOfficialCookieSkill(findGreenCard('ST3-004'))

      expect(skill).toMatchObject({
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { green: 3, neutral: 1 }, discardHand: 0 },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
    })

    it('ST3-005 Blackberry Cookie is supported', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-005')),
      ).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })

    it('ST3-015 Chili Pepper Cookie is supported', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-015')),
      ).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
    })

    it('supports ST3-017 compound damage and support discard', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-017')),
      ).toMatchObject({
        status: 'supported',
        effects: [
          { kind: 'damage', amount: 1 },
          { kind: 'support-to-trash', amount: 1 },
        ],
      })
    })

    it('rejects ST3-019 (compound effect with Then)', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-019')),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('ST3-010 Aloe Cookie deck-to-support is supported', () => {
      const conversion = convertOfficialCardEffects(findGreenCard('ST3-010'))

      expect(conversion).toMatchObject({
        status: 'supported',
        cardNumber: 'ST3-010',
        effects: [{ kind: 'deck-to-support', amount: 1 }],
      })
    })

    it('ST3-010 Aloe Cookie skill parsing', () => {
      const skill = convertOfficialCookieSkill(findGreenCard('ST3-010'))

      expect(skill).toMatchObject({
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { green: 2 }, discardHand: 0 },
        text: '{ap} 《{G}{G}》 Take 1 card from the top your deck and place it in your support area as active.',
        effects: [{ kind: 'deck-to-support', amount: 1 }],
      })
    })

    it('ST3-016 Ancient Healer\'s Gaze item has battle-to-support effect', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-016')),
      ).toMatchObject({
        status: 'supported',
        cardNumber: 'ST3-016',
        effects: [
          {
            kind: 'battle-to-support',
            target: { side: 'self', min: 1, max: 1, maxLevel: 2 },
          },
        ],
      })
    })

    it('ST3-018 Parsley Tea of Invigoration item has trash-to-battle effect', () => {
      expect(
        convertOfficialCardEffects(findGreenCard('ST3-018')),
      ).toMatchObject({
        status: 'supported',
        cardNumber: 'ST3-018',
        effects: [{ kind: 'trash-to-battle', amount: 1 }],
      })
    })
  })

  describe('stage ability adapter', () => {
    it('ST3-022 Guardian Tree\'s Blessing stage ability has support-to-hand and draw', () => {
      const ability = convertOfficialStageAbility(findGreenCard('ST3-022'))

      expect(ability).toMatchObject({
        placementCost: { green: 1 },
        effects: [
          { kind: 'support-to-hand', amount: 1 },
          { kind: 'draw-up-to', max: 1 },
        ],
        restSource: true,
      })
    })
  })

  describe('draw effect adapter', () => {
    const makeCard = (
      overrides: Partial<OfficialCardRecord>,
    ): OfficialCardRecord =>
      ({
        sourceId: 0,
        locale: 'en',
        cardNumber: 'TEST-001',
        baseCardNumber: 'TEST-001',
        variant: null,
        name: 'Test Card',
        type: 'item',
        officialType: 'Item',
        rarity: null,
        grade: null,
        level: null,
        hp: null,
        energyType: null,
        color: null,
        skill: { name: null, text: null },
        attackText: null,
        flipText: null,
        keywords: [],
        product: { id: null, title: null, category: null },
        restrictions: { banned: false, limited: false },
        flags: { enabled: true, hidden: false, extra: false },
        imageUrl: '',
        officialUpdatedAt: null,
        sourceUrl: '',
        ...overrides,
      }) as OfficialCardRecord

    it('parses Draw 1 card from item attack text', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'item',
            attackText: '{Y} Draw 1 card from your deck.',
          }),
        ),
      ).toMatchObject({
        status: 'supported',
        effects: [{ kind: 'draw', amount: 1 }],
      })
    })

    it('parses Draw up to 1 card from stage attack text', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'stage',
            attackText:
              'Draw up to 1 card from your deck.',
          }),
        ),
      ).toMatchObject({
        status: 'supported',
        effects: [{ kind: 'draw-up-to', max: 1 }],
      })
    })

    it('parses draw from cookie skill text (OnPlay/Activate)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'cookie',
            skill: {
              name: null,
              text: '{mob}{t1} {R} Draw 1 card from your deck.',
            },
            attackText: '{R} Deals 1 damage.',
          }),
        ),
      ).toMatchObject({
        status: 'supported',
        effects: [{ kind: 'draw', amount: 1 }],
      })
    })

    it('exposes cookie discard-hand costs so payment can be handled by game logic', () => {
      const card = makeCard({
        type: 'cookie',
        skill: {
          name: null,
          text: '{mob} 《Discard 1 card.》 Draw 1 card from your deck.',
        },
        attackText: '{R} Deals 1 damage.',
      })

      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
      })
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'activate',
        cost: { discardHand: 1 },
        effects: [{ kind: 'draw', amount: 1 }],
      })
    })

    it('keeps supported discard-hand costs on item abilities', () => {
      const card = makeCard({
        type: 'item',
        attackText:
          '《Discard 1 card.》 Draw 1 card from your deck.',
      })

      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
      })
      expect(convertOfficialItemAbility(card)).toMatchObject({
        cost: { energy: {}, discardHand: 1 },
        effects: [{ kind: 'draw', amount: 1 }],
      })
    })

    it('rejects draw text from flip card type', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'flip',
            attackText: '{R} Deals 1 damage.',
            flipText:
              'Draw up to 1 card from your deck.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('draw amount parses correctly for multiple cards', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'item',
            attackText: 'Draw 3 cards from your deck.',
          }),
        ),
      ).toMatchObject({
        status: 'supported',
        effects: [{ kind: 'draw', amount: 3 }],
      })
    })

    it('supports ST2-018 draw followed by optional HP viewing', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'item',
            cardNumber: 'ST2-018',
            attackText:
              '《{Y}》 Draw 1 card from your deck. Then, select up to 1 of your Cookies and view all its HP cards. (You cannot switch the order of HP cards.)',
          }),
        ),
      ).toMatchObject({
        status: 'supported',
        effects: [
          { kind: 'draw', amount: 1 },
          { kind: 'view-hp', optional: true },
        ],
      })
    })

    it('rejects ST3-022 conditional draw with If you did and support area (unsupported)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'stage',
            cardNumber: 'ST3-022',
            attackText:
              '《{G}》 Place in your stage area.\r\n\r\n{mob} 《Rest this card.》 Take 1 card from your support area to your hand. If you did, you can draw 1 card from your deck.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('rejects draw + Then compound effect (unsupported)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'item',
            attackText: 'Draw 1 card from your deck. Then, deal 1 damage.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('rejects draw + If you did compound effect (unsupported)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'item',
            attackText: 'Draw 1 card from your deck. If you did, deal 1 damage.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })
  })

  describe('deck-to-support effect adapter', () => {
    const makeCard = (
      overrides: Partial<OfficialCardRecord>,
    ): OfficialCardRecord =>
      ({
        sourceId: 0,
        locale: 'en',
        cardNumber: 'TEST-001',
        baseCardNumber: 'TEST-001',
        variant: null,
        name: 'Test Card',
        type: 'cookie',
        officialType: 'COOKIE',
        rarity: null,
        grade: null,
        level: 1,
        hp: 1,
        energyType: null,
        color: null,
        skill: { name: null, text: null },
        attackText: null,
        flipText: null,
        keywords: [],
        product: { id: null, title: null, category: null },
        restrictions: { banned: false, limited: false },
        flags: { enabled: true, hidden: false, extra: false },
        imageUrl: '',
        officialUpdatedAt: null,
        sourceUrl: '',
        ...overrides,
      }) as OfficialCardRecord

    it('parses Take 1 card from top deck to support area', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            cardNumber: 'ST3-010',
            skill: {
              name: null,
              text: '{ap} 《{G}{G}》 Take 1 card from the top your deck and place it in your support area as active.',
            },
            attackText: '《{G}》 Deals 1 damage.',
          }),
        ),
      ).toMatchObject({
        status: 'supported',
        cardNumber: 'ST3-010',
        effects: [{ kind: 'deck-to-support', amount: 1 }],
      })
    })

    it('rejects deck-to-support with Then compound (unsupported)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'cookie',
            skill: {
              name: null,
              text: '{ap} Take 1 card from the top your deck and place it in your support area as active. Then, draw 1 card.',
            },
            attackText: 'Deals 1 damage.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('rejects deck-to-support with If you did compound (unsupported)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'cookie',
            skill: {
              name: null,
              text: '{ap} Take 1 card from the top your deck and place it in your support area as active. If you did, gain +1 HP.',
            },
            attackText: 'Deals 1 damage.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('rejects deck-to-support from flip card type (unsupported)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'flip',
            attackText: 'Deals 1 damage.',
            flipText: 'Take 1 card from the top your deck and place it in your support area as active.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })

    it('rejects draw text that partially resembles deck-to-support (unsupported)', () => {
      expect(
        convertOfficialCardEffects(
          makeCard({
            type: 'item',
            attackText: 'Take 1 card from the top your deck.',
          }),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reason: 'unsupported-effect-text',
      })
    })
  })

  describe('Starter Deck BLUE trap costs', () => {
    it('parses ST4-020 energy and discard-hand costs', () => {
      expect(convertOfficialTrapAbility(findBlueCard('ST4-020'))).toMatchObject({
        cost: { energy: { blue: 1 }, discardHand: 2 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -3,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })

    it('ST4-007 Sour Belt Cookie conditional draw includes hand-count-at-most condition', () => {
      const skill = convertOfficialCookieSkill(findBlueCard('ST4-007'))
      expect(skill).toBeDefined()
      expect(skill!.effects).toEqual([
        {
          kind: 'draw-up-to',
          max: 1,
          condition: { kind: 'hand-count-at-most', count: 6 },
        },
      ])
    })
  })

  describe('Starter Deck PURPLE official effect adapter', () => {
    it('imports all 22 distinct starter deck cards', () => {
      expect(purpleCards).toHaveLength(22)
      expect(new Set(purpleCards.map((card) => card.cardNumber)).size).toBe(22)
      expect(
        purpleCards.every(
          (card) => card.product.title === 'Starter Deck PURPLE',
        ),
      ).toBe(true)
    })

    it('ST5-001 Madeleine Cookie converts to field-to-trash with allowStage', () => {
      expect(convertOfficialCookieSkill(findPurpleCard('ST5-001'))).toMatchObject({
        trigger: 'on-play',
        effects: [
          {
            kind: 'field-to-trash',
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
            allowStage: true,
          },
        ],
      })
    })

    it('ST5-003 Fig Cookie converts to flip draw up to 1', () => {
      expect(convertOfficialFlipAbility(findPurpleCard('ST5-003'))).toMatchObject({
        effects: [{ kind: 'draw-up-to', max: 1 }],
      })
    })

    it('ST5-004 Skater Cookie converts to faint opponent-discard-hand', () => {
      expect(convertOfficialCookieSkill(findPurpleCard('ST5-004'))).toMatchObject({
        faint: true,
        effects: [{ kind: 'opponent-discard-hand', count: 1 }],
      })
    })

    it('ST5-006 String Gummy Cookie converts to field-to-trash with allowStage', () => {
      expect(convertOfficialCookieSkill(findPurpleCard('ST5-006'))).toMatchObject({
        trigger: 'on-play',
        effects: [
          {
            kind: 'field-to-trash',
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 2 },
            allowStage: true,
          },
        ],
      })
    })

    it('ST5-007 Yoga Cookie converts to activate field-to-trash', () => {
      const result = convertOfficialCookieSkill(findPurpleCard('ST5-007'))
      expect(result).toMatchObject({
        trigger: 'activate',
        effects: [
          {
            kind: 'field-to-trash',
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
            allowStage: true,
          },
        ],
      })
      expect(result?.cost.discardHand).toBe(1)
    })

    it('ST5-008 Fairy Cookie converts to flip gain-hp', () => {
      expect(convertOfficialFlipAbility(findPurpleCard('ST5-008'))).toMatchObject({
        effects: [{ kind: 'gain-hp', amount: 1 }],
      })
    })

    it('ST5-010 Carol Cookie converts to field-to-trash with remainingHp', () => {
      expect(convertOfficialCookieSkill(findPurpleCard('ST5-010'))).toMatchObject({
        trigger: 'on-play',
        effects: [
          {
            kind: 'field-to-trash',
            target: { side: 'opponent', min: 1, max: 1, remainingHp: 2 },
          },
        ],
      })
    })

    it('ST5-013 Pilot Cookie converts to modify-attack with trashBattleCookie cost', () => {
      const result = convertOfficialCookieSkill(findPurpleCard('ST5-013'))
      expect(result).toMatchObject({
        trigger: 'activate',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
      expect(result?.cost.trashBattleCookie).toEqual({
        count: 1,
        level: 1,
        energyColor: 'purple',
      })
    })

    it('ST5-015 Rye Cookie converts to field-to-trash without conditions', () => {
      expect(convertOfficialCookieSkill(findPurpleCard('ST5-015'))).toMatchObject({
        trigger: 'on-play',
        effects: [
          {
            kind: 'field-to-trash',
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
      })
    })

    it('ST5-016 BONUS Coin converts to conditional draw-up-to', () => {
      expect(convertOfficialItemAbility(findPurpleCard('ST5-016'))).toMatchObject({
        effects: [
          {
            kind: 'draw-up-to',
            max: 2,
            condition: { kind: 'opponent-trash-count-at-least', count: 30 },
          },
        ],
      })
    })

    it('ST5-017 Violet Dragonspout converts to opponent-random-discard', () => {
      expect(convertOfficialItemAbility(findPurpleCard('ST5-017'))).toMatchObject({
        effects: [{ kind: 'opponent-random-discard', count: 1 }],
      })
    })

    it('ST5-018 Dragonfly Candy Brooch converts to field-to-trash with remainingHp', () => {
      expect(convertOfficialItemAbility(findPurpleCard('ST5-018'))).toMatchObject({
        effects: [
          {
            kind: 'field-to-trash',
            target: { side: 'opponent', min: 1, max: 1, remainingHp: 4 },
          },
        ],
      })
    })

    it('ST5-019 Pastry Boomerang converts to damage + draw', () => {
      expect(convertOfficialItemAbility(findPurpleCard('ST5-019'))).toMatchObject({
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'opponent-trash-count-at-least', count: 20 },
          },
          {
            kind: 'draw-up-to',
            max: 1,
            condition: { kind: 'opponent-trash-count-at-least', count: 20 },
          },
        ],
      })
    })

    it('ST5-020 Forbidden Grimoire converts to trap with modify-attack', () => {
      const result = convertOfficialTrapAbility(findPurpleCard('ST5-020'))
      expect(result).toBeDefined()
      expect(result?.effects).toContainEqual(
        expect.objectContaining({
          kind: 'modify-attack',
          amount: -3,
        }),
      )
      expect(result?.cost.trashBattleCookie).toEqual({
        count: 1,
        level: 1,
        energyColor: 'purple',
      })
    })

    it('ST5-021 Hidden Warpgate converts to trap with field-to-trash', () => {
      const result = convertOfficialTrapAbility(findPurpleCard('ST5-021'))
      expect(result).toBeDefined()
      expect(result?.effects).toContainEqual(
        expect.objectContaining({
          kind: 'field-to-trash',
          target: expect.objectContaining({
            side: 'opponent',
            min: 1,
            max: 1,
            remainingHp: 2,
          }),
        }),
      )
    })

    it('ST5-022 Windswept Valley converts to stage with draw', () => {
      expect(convertOfficialStageAbility(findPurpleCard('ST5-022'))).toMatchObject({
        effects: [{ kind: 'draw-up-to', max: 1 }],
        restSource: true,
        triggered: true,
      })
    })
  })

  describe('Brave Beginning BS1 adapter Phase 1 and 2 coverage', () => {
    it('imports the BS1 sample with expected record and base-card counts', () => {
      const uniqueBaseCards = new Set(
        braveBeginningCards.map((card) => card.baseCardNumber),
      )
      const typeCounts = braveBeginningCards.reduce<Record<string, number>>(
        (counts, card) => ({
          ...counts,
          [card.type]: (counts[card.type] ?? 0) + 1,
        }),
        {},
      )

      expect(braveBeginningCards).toHaveLength(99)
      expect(uniqueBaseCards.size).toBe(78)
      expect(typeCounts).toMatchObject({
        cookie: 72,
        flip: 12,
        item: 6,
        trap: 6,
        stage: 3,
      })
    })

    it('BS1-001 converts OnPlay discard cost into opponent damage', () => {
      const skill = convertOfficialCookieSkill(findBraveBeginningCard('BS1-001'))

      expect(skill).toMatchObject({
        trigger: 'on-play',
        cost: { energy: {}, discardHand: 1 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })

    it('BS1-002 converts FLIP discard cost damage for base and variants', () => {
      const baseFlip = convertOfficialFlipAbility(
        findBraveBeginningCard('BS1-002'),
      )
      const variant = braveBeginningCards.find(
        (card) => card.cardNumber === 'BS1-002@1',
      )

      expect(baseFlip).toMatchObject({
        cost: { energy: {}, discardHand: 1 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
      expect(variant).toBeDefined()
      expect(convertOfficialFlipAbility(variant as OfficialCardRecord))
        .toMatchObject(baseFlip ?? {})
    })

    it('BS1 Draw up to FLIP cards convert to optional draw decisions', () => {
      for (const cardNumber of ['BS1-015', 'BS1-030', 'BS1-055', 'BS1-069']) {
        expect(convertOfficialFlipAbility(findBraveBeginningCard(cardNumber)))
          .toMatchObject({
            effects: [{ kind: 'draw-up-to', max: 1 }],
          })
      }
    })

    it('BS1 blocker Cookies convert to block redirect skills', () => {
      for (const cardNumber of ['BS1-009', 'BS1-031', 'BS1-062']) {
        expect(convertOfficialCookieSkill(findBraveBeginningCard(cardNumber)))
          .toMatchObject({
            trigger: 'block',
            effects: [
              {
                kind: 'redirect-attack',
                target: { side: 'self', min: 1, max: 1, sourceOnly: true },
              },
            ],
          })
      }
    })

    it('BS1-004 converts activate return-this-cookie-to-hand', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningCard('BS1-004')))
        .toMatchObject({
          trigger: 'activate',
          cost: { energy: { red: 2 }, discardHand: 0 },
          effects: [
            {
              kind: 'return-to-hand',
              target: { side: 'self', min: 1, max: 1, sourceOnly: true },
            },
          ],
        })
    })

    it('BS1-035 converts faint break-to-trash wording', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningCard('BS1-035')))
        .toMatchObject({
          trigger: 'passive',
          faint: true,
          effects: [{ kind: 'break-to-trash', max: 1, exactLevel: 1 }],
        })
    })

    it('BS1-063 converts support-to-trash cost into deck-to-support active', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningCard('BS1-063')))
        .toMatchObject({
          trigger: 'on-play',
          cost: { supportToTrash: 1 },
          effects: [{ kind: 'deck-to-support', amount: 1 }],
        })
    })

    it('BS1-066 converts end-of-turn support activation', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningCard('BS1-066')))
        .toMatchObject({
          trigger: 'passive',
          endPhase: true,
          effects: [{ kind: 'set-active', supportCount: 1 }],
        })
    })

    it('BS1-073 converts support-to-trash cost into set-active', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningCard('BS1-073')))
        .toMatchObject({
          trigger: 'on-play',
          cost: { supportToTrash: 1 },
          effects: [{ kind: 'set-active', supportCount: 1 }],
        })
    })
  })

  describe('Brave Beginning BS1 adapter Phase 3 coverage', () => {
    it('converts BS1 attack follow-up damage and hand discard effects', () => {
      expect(convertOfficialAttackEffects(findBraveBeginningCard('BS1-005')))
        .toEqual([
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ])

      expect(convertOfficialAttackEffects(findBraveBeginningCard('BS1-013')))
        .toEqual([{ kind: 'discard-hand', count: 1 }])
    })

    it('converts BS1 conditional and variable attack follow-up effects', () => {
      expect(convertOfficialAttackEffects(findBraveBeginningCard('BS1-028')))
        .toEqual([
          {
            kind: 'damage-all',
            amount: 1,
            side: 'opponent',
            condition: { kind: 'break-level-at-least', level: 5 },
          },
        ])

      expect(convertOfficialAttackEffects(findBraveBeginningCard('BS1-033')))
        .toEqual([
          {
            kind: 'damage-by-break-count',
            perCount: 1,
            minBreakLevel: 2,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ])
    })

    it('converts BS1 multi-target attack debuff and support follow-up effects', () => {
      expect(convertOfficialAttackEffects(findBraveBeginningCard('BS1-039')))
        .toEqual([
          {
            kind: 'modify-attack',
            amount: -1,
            duration: 'opponent-next-turn',
            target: { side: 'opponent', min: 0, max: 2 },
          },
        ])

      expect(convertOfficialAttackEffects(findBraveBeginningCard('BS1-064')))
        .toEqual([
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 1, max: 1, excludeSource: true },
            condition: { kind: 'support-count-at-least', count: 7 },
          },
        ])

      expect(convertOfficialAttackEffects(findBraveBeginningCard('BS1-070')))
        .toEqual([{ kind: 'support-to-hand', amount: 1, maxLevel: 1 }])
    })

    it('converts BS1 conditional skill text into reusable effects', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningCard('BS1-029')))
        .toMatchObject({
          trigger: 'on-play',
          effects: [
            {
              kind: 'draw',
              amount: 1,
              condition: { kind: 'break-level-at-least', level: 3 },
            },
            {
              kind: 'discard-hand',
              count: 1,
              condition: { kind: 'break-level-at-least', level: 3 },
            },
          ],
        })

      expect(convertOfficialCookieSkill(findBraveBeginningCard('BS1-053')))
        .toMatchObject({
          trigger: 'activate',
          effects: [
            {
              kind: 'support-to-hand',
              amount: 1,
              condition: { kind: 'hand-count-at-most', count: 6 },
            },
            {
              kind: 'deck-to-support',
              amount: 1,
              rested: true,
              condition: { kind: 'hand-count-at-most', count: 6 },
            },
          ],
        })
    })
  })

  describe('Brave Beginning BS1 non-cookie adapter coverage', () => {
    it('converts BS1 item abilities with non-energy costs and variable effects', () => {
      expect(convertOfficialItemAbility(findBraveBeginningCard('BS1-022')))
        .toMatchObject({
          cost: { energy: { red: 3 }, discardHand: 1 },
          effects: [
            {
              kind: 'damage',
              amount: 3,
              target: { side: 'opponent', min: 0, max: 1 },
            },
          ],
        })
      expect(convertOfficialItemAbility(findBraveBeginningCard('BS1-023')))
        .toMatchObject({
          cost: { energy: { red: 1 }, hpToTrash: { untilRemainingHp: 1 } },
          effects: [{ kind: 'modify-attack', amount: 2 }],
        })
      expect(convertOfficialItemAbility(findBraveBeginningCard('BS1-048')))
        .toMatchObject({
          effects: [
            {
              kind: 'modify-attack-by-break-count',
              perCount: 1,
              groupSize: 2,
              exactBreakLevel: 1,
              breakEnergyColor: 'yellow',
            },
          ],
        })
      expect(convertOfficialItemAbility(findBraveBeginningCard('BS1-049')))
        .toMatchObject({
          effects: [
            {
              kind: 'damage-by-break-count',
              minBreakLevel: 2,
              breakEnergyColor: 'yellow',
            },
          ],
        })
      expect(convertOfficialItemAbility(findBraveBeginningCard('BS1-074')))
        .toMatchObject({
          cost: { energy: { green: 1 }, supportToHand: 1 },
          effects: [{ kind: 'draw-up-to', max: 1 }],
        })
      expect(convertOfficialItemAbility(findBraveBeginningCard('BS1-075')))
        .toMatchObject({
          effects: [{ kind: 'place-source-to-support', rested: true }],
        })
    })

    it('converts BS1 trap conditions and follow-up effects', () => {
      expect(convertOfficialTrapAbility(findBraveBeginningCard('BS1-024')))
        .toMatchObject({
          condition: { kind: 'self-cookie-hp-equals', amount: 1 },
          effects: [{ kind: 'modify-attack', amount: -4 }],
        })
      expect(convertOfficialTrapAbility(findBraveBeginningCard('BS1-025')))
        .toMatchObject({
          condition: { kind: 'self-cookie-hp-equals', amount: 1 },
          effects: [{ kind: 'damage', amount: 1 }],
        })
      expect(convertOfficialTrapAbility(findBraveBeginningCard('BS1-050')))
        .toMatchObject({
          effects: [{ kind: 'redirect-attack' }],
        })
      expect(convertOfficialTrapAbility(findBraveBeginningCard('BS1-051')))
        .toMatchObject({
          effects: [{ kind: 'gain-hp', amount: 1 }],
        })
      expect(convertOfficialTrapAbility(findBraveBeginningCard('BS1-076')))
        .toMatchObject({
          effects: [
            { kind: 'damage', amount: 1 },
            { kind: 'support-to-trash', amount: 1 },
          ],
        })
      expect(convertOfficialTrapAbility(findBraveBeginningCard('BS1-077')))
        .toMatchObject({
          effects: [
            { kind: 'modify-attack', amount: -3 },
            { kind: 'set-active', supportCount: 1 },
          ],
        })
    })

    it('converts BS1 stage activation costs and conditions', () => {
      expect(convertOfficialStageAbility(findBraveBeginningCard('BS1-026')))
        .toMatchObject({
          cost: { hpToTrash: { amount: 1 } },
          effects: [{ kind: 'modify-attack', amount: 1 }],
        })
      expect(convertOfficialStageAbility(findBraveBeginningCard('BS1-052')))
        .toMatchObject({
          cost: { energy: { yellow: 2 } },
          effects: [{ kind: 'gain-hp', amount: 1 }],
        })
      expect(convertOfficialStageAbility(findBraveBeginningCard('BS1-078')))
        .toMatchObject({
          effects: [
            {
              kind: 'set-active',
              condition: { kind: 'support-area-decreased-this-turn' },
            },
          ],
        })
    })

    it('converts BS2-051 restSource despite "Card Rests." wording (not "Rest this card.")', () => {
      expect(convertOfficialStageAbility(findBraveBeginningBS2Card('BS2-051')))
        .toMatchObject({
          cost: { discardHand: 1 },
          effects: [{ kind: 'modify-attack', amount: 1 }],
          restSource: true,
        })
    })
  })

  describe('Brave Beginning BS2 red cookie adapter coverage', () => {
    it('BS2-002 Macaron Cookie converts to stageOnly field-to-trash', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-002')))
        .toMatchObject({
          trigger: 'on-play',
          cost: { energy: { red: 1 } },
          effects: [
            {
              kind: 'field-to-trash',
              target: { side: 'opponent', min: 0, max: 1 },
              stageOnly: true,
            },
          ],
        })
    })

    it('BS2-003 Rebel Cookie converts to optional damage', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-003')))
        .toMatchObject({
          trigger: 'on-play',
          cost: { energy: { red: 2 } },
          effects: [
            {
              kind: 'damage',
              amount: 2,
              target: { side: 'opponent', min: 0, max: 1 },
            },
          ],
        })
    })

    it('BS2-004 Cherry Cookie converts to optional-cost attack with conditional damage', () => {
      expect(convertOfficialAttackEffects(findBraveBeginningBS2Card('BS2-004')))
        .toEqual([
          {
            kind: 'optional-cost-attack',
            cost: { energy: { red: 1 } },
            effects: [
              {
                kind: 'damage',
                amount: 3,
                target: { side: 'opponent', min: 1, max: 1, maxLevel: 1, attackTargetOnly: true },
                condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
              },
            ],
            effectText: 'You can use this Cookie as {R} to deal 3 damage to 1 of your opponent\'s LV.1 Cookies.',
          },
        ])
    })

    it('BS2-006 Prickly Cacti Gloves converts to damage + hp-to-trash', () => {
      expect(convertOfficialItemAbility(findBraveBeginningBS2Card('BS2-006')))
        .toMatchObject({
          cost: { energy: { red: 2 }, discardHand: 0 },
          effects: [
            {
              kind: 'damage',
              amount: 2,
              target: { side: 'opponent', min: 0, max: 1 },
            },
            {
              kind: 'hp-to-trash',
              amount: 2,
              target: { side: 'self', min: 1, max: 1 },
            },
          ],
        })
    })

    it('BS2-007 Prickly Cactus Bat converts to trap with red discard cost', () => {
      const result = convertOfficialTrapAbility(findBraveBeginningBS2Card('BS2-007'))
      expect(result).toMatchObject({
        cost: { energy: { red: 1 }, discardHand: 1, discardHandColor: 'red' },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
          },
        ],
      })
    })

    it('BS2 blocker and anti-block Cookies convert to block effects', () => {
      for (const cardNumber of ['BS2-026', 'BS2-067']) {
        expect(convertOfficialCookieSkill(findBraveBeginningBS2Card(cardNumber)))
          .toMatchObject({
            trigger: 'block',
            effects: [{ kind: 'redirect-attack' }],
          })
      }

      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-028')))
        .toMatchObject({
          trigger: 'activate',
          cost: { discardHand: 1 },
          effects: [
            {
              kind: 'disable-block',
              duration: 'this-turn',
              side: 'opponent',
            },
          ],
        })
    })

    it('BS2 Draw up to FLIP cards convert to optional draw decisions', () => {
      for (const cardNumber of ['BS2-001', 'BS2-009', 'BS2-037', 'BS2-072']) {
        expect(convertOfficialFlipAbility(findBraveBeginningBS2Card(cardNumber)))
          .toMatchObject({
            effects: [{ kind: 'draw-up-to', max: 1 }],
          })
      }

      expect(convertOfficialFlipAbility(findBraveBeginningBS2Card('BS2-034')))
        .toMatchObject({
          effects: [
            {
              kind: 'draw-up-to',
              max: 2,
              condition: { kind: 'break-level-at-least', level: 4 },
            },
          ],
        })
    })

    it('BS2-036 Sherbet Cookie converts optional "You can draw" to draw-up-to, not mandatory draw', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-036')))
        .toMatchObject({
          effects: [
            { kind: 'return-to-deck-bottom', target: { side: 'self', maxLevel: 1 } },
            { kind: 'draw-up-to', max: 1 },
          ],
        })
    })

    it('BS2-045 Parfait Cookie attack-then draw is optional ("you can draw"), not mandatory', () => {
      expect(convertOfficialAttackEffects(findBraveBeginningBS2Card('BS2-045')))
        .toEqual([
          {
            kind: 'draw-up-to',
            max: 1,
            condition: { kind: 'hand-count-at-most', count: 6 },
          },
        ])
    })

    it('BS2-049 Salt Crystal Trident converts to conditional draw trap with blue-faint condition', () => {
      expect(convertOfficialTrapAbility(findBraveBeginningBS2Card('BS2-049')))
        .toMatchObject({
          condition: {
            kind: 'friendly-color-fainted-this-battle',
            color: 'blue',
          },
          effects: [
            { kind: 'draw-up-to', max: 3 },
            { kind: 'discard-hand', count: 1 },
          ],
        })
    })
  })

  describe('previously-unsupported cards now convert successfully', () => {
    it('converts the first BS3 attack-then slice with existing runtime effects', () => {
      expect(convertOfficialAttackEffects(findBs3Card('BS3-009'))).toEqual([
        {
          kind: 'damage',
          amount: 1,
          target: {
            side: 'opponent',
            min: 1,
            max: 1,
            attackTargetOnly: true,
          },
          condition: {
            kind: 'support-keyword-at-least',
            keyword: 'soul-jam',
            count: 1,
          },
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-002'))).toEqual([
        {
          kind: 'optional-cost-attack',
          cost: { energy: { red: 1 } },
          effects: [
            {
              kind: 'damage',
              amount: 1,
              target: {
                side: 'opponent',
                min: 1,
                max: 1,
                attackTargetOnly: true,
              },
            },
          ],
          effectText:
            'Use this Cookie as {R} to deal 1 damage to the attacked Cookie.',
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-010'))).toEqual([
        {
          kind: 'optional-cost-attack',
          cost: { energy: { red: 1 } },
          effects: [
            {
              kind: 'damage',
              amount: 1,
              target: { side: 'opponent', min: 1, max: 1 },
            },
          ],
          effectText:
            'Use this Cookie as {R} to deal 1 damage to 1 opponent Cookie.',
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-011'))).toEqual([
        {
          kind: 'optional-cost-attack',
          cost: { energy: { red: 2 } },
          effects: [
            {
              kind: 'damage',
              amount: 1,
              target: { side: 'opponent', min: 1, max: 1 },
            },
          ],
          effectText:
            'Use this Cookie as {R}{R} to deal 1 damage to 1 opponent Cookie.',
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-013'))).toEqual([
        {
          kind: 'modify-damage-received',
          amount: 0,
          duration: 'opponent-next-turn',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          minimumDamage: 2,
          setDamageTo: 1,
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-017'))).toEqual([
        {
          kind: 'modify-attack',
          amount: 1,
          duration: 'this-turn',
          target: { side: 'self', min: 0, max: 1, excludeSource: true },
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-028'))).toEqual([
        {
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'source-hp-less-than', amount: 6 },
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-033'))).toEqual([
        {
          kind: 'optional-cost-attack',
          cost: { energy: { yellow: 1 } },
          effects: [
            {
              kind: 'opponent-battle-to-trash',
              min: 0,
              remainingHp: 1,
              destination: 'break',
            },
          ],
          effectText:
            'Use this Cookie as {Y} to place up to 1 opponent Cookie with 1 remaining HP in its break area.',
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-041'))).toEqual([
        {
          kind: 'battle-to-break',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-086'))).toEqual([
        {
          kind: 'optional-cost-attack',
          cost: { energy: {}, discardHand: 1 },
          effects: [
            {
              kind: 'damage',
              amount: 1,
              target: {
                side: 'opponent',
                min: 1,
                max: 1,
                attackTargetOnly: true,
              },
              condition: {
                kind: 'battle-area-has-cookie-with-level',
                side: 'self',
                level: 3,
              },
            },
          ],
          effectText:
            'If you have a LV.3 Cookie in your battle area, discard 1 card to deal 1 damage to the attacked Cookie.',
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-100'))).toEqual([
        {
          kind: 'hp-to-trash',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-101'))).toEqual([
        {
          kind: 'optional-cost-attack',
          cost: { energy: { purple: 1 } },
          effects: [
            {
              kind: 'opponent-battle-to-trash',
              min: 0,
              remainingHp: 2,
            },
          ],
          effectText:
            'Use this Cookie as {P} to place up to 1 opponent Cookie with 2 or less remaining HP in the trash.',
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-102'))).toEqual([
        { kind: 'deck-to-trash', amount: 2, side: 'self' },
        { kind: 'deck-to-trash', amount: 2, side: 'opponent' },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-105'))).toEqual([
        { kind: 'deck-to-trash', amount: 1, side: 'opponent' },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-113'))).toEqual([
        { kind: 'deck-to-trash', amount: 1, side: 'self' },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-087'))).toEqual([
        {
          kind: 'damage',
          amount: 1,
          target: {
            side: 'opponent',
            min: 1,
            max: 1,
            maxLevel: 1,
            attackTargetOnly: true,
          },
          condition: {
            kind: 'support-keyword-at-least',
            keyword: 'soul-jam',
            count: 1,
          },
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-088'))).toEqual([
        {
          kind: 'optional-cost-attack',
          cost: { energy: {}, discardHand: 1 },
          effects: [
            {
              kind: 'gain-hp',
              amount: 1,
              target: { side: 'self', min: 0, max: 1 },
            },
          ],
          effectText:
            'Discard 1 card to give up to 1 Cookie in your battle area +1 HP.',
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-099'))).toEqual([
        {
          kind: 'hp-to-trash',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
          condition: { kind: 'trash-count-at-least', count: 15 },
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-109'))).toEqual([
        {
          kind: 'hp-to-trash',
          amount: 1,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
      ])
      expect(convertOfficialAttackEffects(findBs3Card('BS3-111'))).toEqual([
        {
          kind: 'damage',
          amount: 2,
          target: { side: 'opponent', min: 0, max: 1 },
          condition: {
            kind: 'support-keyword-at-least',
            keyword: 'soul-jam',
            count: 1,
          },
        },
      ])
    })

    it('ST2-015 Hero Cookie attack-then damage plus disable-attack', () => {
      expect(convertOfficialAttackEffects(findYellowCard('ST2-015')))
        .toMatchObject([
          { kind: 'damage', amount: 3, target: { side: 'opponent', max: 1 } },
          {
            kind: 'disable-attack',
            duration: 'opponent-next-turn',
            target: { side: 'opponent', maxLevel: 1 },
          },
        ])
    })

    it('ST4-010 Squid Ink Cookie faints into an optional draw', () => {
      expect(convertOfficialCookieSkill(findBlueCard('ST4-010'))).toMatchObject({
        faint: true,
        effects: [{ kind: 'draw-up-to', max: 1 }],
      })
    })

    it('ST4-015 Pirate Cookie attack-then draw is optional ("you can draw"), not mandatory', () => {
      expect(convertOfficialAttackEffects(findBlueCard('ST4-015'))).toEqual([
        { kind: 'draw-up-to', max: 1 },
      ])
    })

    it('BS1-056 Moon Rabbit Cookie battle-to-support as active', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningCard('BS1-056')))
        .toMatchObject({
          effects: [
            {
              kind: 'battle-to-support',
              target: { side: 'self', maxLevel: 2, excludeSource: true },
            },
          ],
        })
    })

    it('BS1-058 Poison Mushroom Cookie faints into a support sacrifice plus both-side damage', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningCard('BS1-058')))
        .toMatchObject({
          faint: true,
          effects: [
            { kind: 'support-to-trash', amount: 1 },
            { kind: 'damage-all', amount: 1, side: 'self' },
            { kind: 'damage-all', amount: 1, side: 'opponent' },
          ],
        })
    })

    it('BS2-015 Lemon Thyme Cookie sacrifices itself via sourceOnly trashBattleCookie cost', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-015')))
        .toMatchObject({
          trigger: 'activate',
          cost: { trashBattleCookie: { count: 1, sourceOnly: true } },
          effects: [
            { kind: 'damage', amount: 2 },
            { kind: 'deck-to-support', amount: 1, rested: true },
          ],
        })
    })

    it('BS2-018 / BS2-012 place an opponent stage card into the trash', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-018')))
        .toMatchObject({
          effects: [
            {
              kind: 'field-to-trash',
              stageOnly: true,
              target: { side: 'opponent' },
            },
          ],
        })
      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-012')))
        .toMatchObject({
          effects: [
            {
              kind: 'field-to-trash',
              stageOnly: true,
              target: { side: 'opponent' },
            },
          ],
        })
    })

    it('BS2-055 Poison Mushroom Cookie trashes low-level cookies from both battle areas', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-055')))
        .toMatchObject({
          effects: [{ kind: 'field-to-trash-all', maxLevel: 2 }],
        })
    })

    it('BS2-058 Wind Archer Cookie attack bonus checks its own trash, not the opponent\'s ("if there are 15 cards or more in your trash")', () => {
      expect(convertOfficialAttackEffects(findBraveBeginningBS2Card('BS2-058')))
        .toEqual([
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'trash-count-at-least', count: 15 },
          },
        ])
    })

    it('BS2-079 Yew Village Scroll applies attack decrease and shuffles trash back into the deck', () => {
      expect(
        convertOfficialTrapAbility(findBraveBeginningBS2Card('BS2-079')),
      ).toMatchObject({
        effects: [
          {
            kind: 'modify-attack',
            amount: -1,
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 1 },
          },
          { kind: 'trash-to-deck', max: 5, excludeFlip: true },
        ],
      })
    })

    it('BS2-060 Beet Cookie faints into a conditional draw', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-060')))
        .toMatchObject({
          faint: true,
          effects: [
            {
              kind: 'draw-up-to',
              max: 1,
              condition: { kind: 'opponent-trash-count-at-least', count: 20 },
            },
          ],
        })
    })

    it('BS2-061 Hydrangea Cookie returns non-FLIP trash cards to the deck', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-061')))
        .toMatchObject({
          effects: [{ kind: 'trash-to-deck', max: 3, excludeFlip: true }],
        })
    })

    it('BS2-062 Starfruit Cookie chains a self sacrifice into an opponent battle-to-trash', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-062')))
        .toMatchObject({
          effects: [
            {
              kind: 'field-to-trash',
              target: { side: 'self', energyColor: 'purple', maxLevel: 2 },
            },
            { kind: 'opponent-battle-to-trash', maxLevel: 2 },
          ],
        })
    })

    it('BS2-068 Cream Unicorn Cookie returns a purple trash card to hand', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-068')))
        .toMatchObject({
          cost: { discardHand: 1 },
          effects: [
            { kind: 'trash-to-hand', max: 1, energyColor: 'purple' },
          ],
        })
    })

    it('BS2-071 Twizzly Gummy Cookie sacrifices itself for a small damage effect', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-071')))
        .toMatchObject({
          trigger: 'activate',
          cost: { trashBattleCookie: { count: 1, sourceOnly: true } },
          effects: [{ kind: 'damage', amount: 1 }],
        })
    })

    it('BS2-073 Peperoncino Cookie gains persistent attack from its own trash count', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-073')))
        .toMatchObject({
          effects: [
            {
              kind: 'modify-attack',
              amount: 2,
              duration: 'persistent',
              condition: { kind: 'trash-count-at-least', count: 15 },
            },
          ],
        })
    })

    it('BS1-036 Snake Fruit Cookie plays a LV.1 yellow cookie from the break area', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningCard('BS1-036')))
        .toMatchObject({
          effects: [
            {
              kind: 'break-to-battle',
              amount: 1,
              exactLevel: 1,
              energyColor: 'yellow',
            },
          ],
        })
    })

    it('BS1-037 Timekeeper Cookie trashes a LV.2-or-lower cookie from the break area', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningCard('BS1-037')))
        .toMatchObject({
          cost: { discardHand: 1 },
          effects: [{ kind: 'break-to-trash', max: 1, maxLevel: 2 }],
        })
    })

    it('BS1-038 Cinnamon Cookie sacrifices itself to the break area for a damage effect', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningCard('BS1-038')))
        .toMatchObject({
          trigger: 'activate',
          cost: { selfToBreakArea: true },
          effects: [{ kind: 'damage', amount: 1 }],
        })
    })

    it('BS2-011 Blackberry Cookie sums break-area levels back to hand and sacrifices itself to break', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningBS2Card('BS2-011')))
        .toMatchObject({
          cost: { selfToBreakArea: true },
          effects: [
            {
              kind: 'break-to-hand-by-level-sum',
              targetSum: 3,
              energyColor: 'yellow',
            },
          ],
        })
    })

    it('BS2-020 Carrot Jelly Stew moves an attached HP card to the support area', () => {
      expect(convertOfficialItemAbility(findBraveBeginningBS2Card('BS2-020')))
        .toMatchObject({
          effects: [
            {
              kind: 'hp-to-support',
              amount: 1,
              target: { side: 'self', energyColor: 'green' },
            },
          ],
        })
    })

    it('BS2-077 Forbidden Incantation pays a trashBattleCookie cost for damage', () => {
      expect(convertOfficialItemAbility(findBraveBeginningBS2Card('BS2-077')))
        .toMatchObject({
          cost: {
            trashBattleCookie: { count: 1, level: 1, energyColor: 'purple' },
          },
          effects: [{ kind: 'damage', amount: 2 }],
        })
    })

    it('BS2-078 Dragon\'s Breath trashes one of your own LV.2-or-lower cookies', () => {
      expect(convertOfficialItemAbility(findBraveBeginningBS2Card('BS2-078')))
        .toMatchObject({
          effects: [
            {
              kind: 'field-to-trash',
              target: { side: 'self', maxLevel: 2 },
            },
          ],
        })
    })

    it('BS2-013 Wind-Up Pocket Watch benches a cookie to break then plays a LV.1 from break', () => {
      expect(convertOfficialItemAbility(findBraveBeginningBS2Card('BS2-013')))
        .toMatchObject({
          effects: [
            { kind: 'battle-to-break', target: { side: 'self' } },
            { kind: 'break-to-battle', amount: 1, exactLevel: 1 },
          ],
        })
    })

    it('BS1-067 Churro Cookie flips into the support area when conditions are met', () => {
      expect(convertOfficialFlipAbility(findBraveBeginningCard('BS1-067')))
        .toMatchObject({
          cost: { discardHand: 1 },
          effects: [
            {
              kind: 'flip-to-support',
              rested: true,
              condition: { kind: 'support-count-at-least', count: 4 },
            },
          ],
        })
    })

    it('BS2-063 Space Doughnut auto-selects an opponent cookie or stage card to trash', () => {
      expect(convertOfficialFlipAbility(findBraveBeginningBS2Card('BS2-063')))
        .toMatchObject({
          effects: [
            {
              kind: 'field-to-trash',
              allowStage: true,
              autoSelect: true,
              condition: { kind: 'break-level-at-least', level: 3 },
            },
          ],
        })
    })

    it('BS1-040 Earl Grey Cookie gains HP conditionally on FLIP', () => {
      expect(convertOfficialFlipAbility(findBraveBeginningCard('BS1-040')))
        .toMatchObject({
          effects: [
            {
              kind: 'gain-hp',
              amount: 2,
              condition: { kind: 'break-level-at-least', level: 6 },
            },
          ],
        })
    })
  })

  describe('BS1-044 Bell Pepper Cookie bug fixes', () => {
    it('gain-hp skill only applies while this Cookie has 3 HP or less', () => {
      expect(convertOfficialCookieSkill(findBraveBeginningCard('BS1-044')))
        .toMatchObject({
          effects: [
            {
              kind: 'gain-hp',
              amount: 1,
              target: { side: 'self', sourceOnly: true },
              condition: { kind: 'source-hp-less-than', amount: 4 },
            },
          ],
        })
    })

    it('attack bonus damage is an optional energy-cost effect restricted to the original attack target', () => {
      expect(convertOfficialAttackEffects(findBraveBeginningCard('BS1-044')))
        .toMatchObject([
          {
            kind: 'optional-cost-attack',
            cost: { energy: { yellow: 2 } },
            effects: [
              {
                kind: 'damage',
                amount: 3,
                target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
              },
            ],
          },
        ])
    })
  })

  describe('BS4 blue cards', () => {
    it('BS4-070 Lord Oyster draws on faint, with the discard cost parsed automatically', () => {
      const card = findBs4Card('BS4-070')
      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
        effects: [{ kind: 'draw-up-to', max: 3 }],
      })
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'passive',
        faint: true,
        cost: { discardHand: 2 },
        effects: [{ kind: 'draw-up-to', max: 3 }],
      })
    })

    it('BS4-082 Frilled Jellyfish Cookie draws 3 then discards 2 on play', () => {
      const card = findBs4Card('BS4-082')
      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
        effects: [
          { kind: 'draw-up-to-then-discard', max: 3, discardCount: 2 },
        ],
      })
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'on-play',
        cost: { energy: { blue: 1 } },
        effects: [
          { kind: 'draw-up-to-then-discard', max: 3, discardCount: 2 },
        ],
      })
    })

    it('BS4-085 Tide Shards damages up to 2 opponent Cookies then draws 4, with the discard cost parsed automatically', () => {
      const card = findBs4Card('BS4-085')
      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 2 },
          },
          { kind: 'draw-up-to', max: 4 },
        ],
      })
      expect(convertOfficialItemAbility(card)).toMatchObject({
        cost: { energy: { blue: 2 }, discardHand: 4 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 2 },
          },
          { kind: 'draw-up-to', max: 4 },
        ],
      })
    })

    it('BS4-076 Star Coral Cookie draws up to 1 as a conditional attack Then when hand is small', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-076'))).toEqual([
        {
          kind: 'draw-up-to',
          max: 1,
          condition: { kind: 'hand-count-at-most', count: 5 },
        },
      ])
    })

    it('BS4-083 Pirate Cookie deals bonus attack Then damage when hand is large', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-083'))).toEqual([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          condition: { kind: 'hand-count-at-least', count: 5 },
        },
      ])
    })

    it('BS4-081 Crimson Coral Cookie offers a choose-one between opponent bounce and drawing', () => {
      const card = findBs4Card('BS4-081')
      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'choose-one',
            modes: [
              {
                effects: [
                  {
                    kind: 'return-to-deck-bottom',
                    target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
                  },
                ],
              },
              {
                effects: [{ kind: 'draw-up-to', max: 2 }],
              },
            ],
          },
        ],
      })
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'on-play',
        cost: { discardHand: 1 },
      })
    })

  it('BS4-072 Mystic Opal Cookie reorders the top 3 cards on flip, same mechanic as BS3-083', () => {
      const card = findBs4Card('BS4-072')
      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
        effects: [
          { kind: 'inspect-deck', lookCount: 3, pickCount: 0, restDestination: 'top' },
        ],
      })
      expect(convertOfficialFlipAbility(card)).toMatchObject({
        effects: [
          { kind: 'inspect-deck', lookCount: 3, pickCount: 0, restDestination: 'top' },
        ],
      })
    })
  })

  describe('BS4 red cards', () => {
    it('BS4-001 Lilac Cookie includes its self-faint activation cost', () => {
      const card = findBs4Card('BS4-001')
      const skill = convertOfficialCookieSkill(card)
      expect(skill).toMatchObject({
        trigger: 'activate',
        cost: { energy: { red: 2 }, selfToBreakArea: true },
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', excludeSource: true },
          },
        ],
      })
      expect(skill?.effects[0]).toMatchObject({
        target: { side: 'self', excludeSource: true },
      })
      expect(skill?.effects[0]).not.toHaveProperty('target.sourceOnly')
    })

    it('BS4-004 Mala Sauce Cookie pings 1 damage on play, with the HP-to-trash cost parsed automatically', () => {
      const card = findBs4Card('BS4-004')
      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
        ],
      })
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'on-play',
        cost: { hpToTrash: { amount: 1 } },
        effects: [
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
        ],
      })
    })

    it('BS4-005 Fire Spirit Cookie deals 1 damage to all opponent Cookies, once per turn', () => {
      const card = findBs4Card('BS4-005')
      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
        effects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
      })
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: { hpToTrash: { amount: 1 } },
        effects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
      })
    })

    it('BS4-007 Black Raisin Cookie buffs another red Cookie, with an energy + HP-to-trash compound cost', () => {
      const card = findBs4Card('BS4-007')
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: { energy: { red: 1 }, hpToTrash: { amount: 1 } },
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: {
              side: 'self',
              min: 0,
              max: 1,
              excludeSource: true,
              energyColor: 'red',
            },
          },
        ],
      })
    })

    it('BS4-011 Chili Pepper Cookie loots on a kill from its own attack', () => {
      const card = findBs4Card('BS4-011')
      const killCondition = { kind: 'opponent-cookie-fainted-in-current-battle' }
      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
        effects: [
          { kind: 'draw', amount: 1, condition: killCondition },
          { kind: 'discard-hand', count: 1, condition: killCondition },
        ],
      })
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'passive',
      })
    })

    it('BS4-003 Madeleine Cookie pings a bonus 1 damage as an attack Then when another red Cookie is present', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-003'))).toEqual([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
          condition: {
            kind: 'battle-area-has-color',
            side: 'self',
            color: 'red',
            excludeSource: true,
          },
        },
      ])
    })

    it('BS4-009 Espresso Cookie pings the attack target for bonus damage when it is LV.2 or lower', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-009'))).toEqual([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          condition: { kind: 'attack-target-level-at-most', level: 2 },
        },
      ])
    })

    it('BS4-013 Crushed Pepper Cookie offers an optional-energy attack Then bonus, matching the existing "can be used as" pattern', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-013'))).toEqual([
        {
          kind: 'optional-cost-attack',
          cost: { energy: { red: 1 } },
          effects: [
            {
              kind: 'damage',
              amount: 1,
              target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
            },
          ],
          effectText:
            'Use this Cookie as {R} to deal 1 damage to the attacked Cookie.',
        },
      ])
    })

    it('BS4-016 Rye Cookie finishes off a 1-HP opponent Cookie as an attack Then', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-016'))).toEqual([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1, remainingHp: 1 },
        },
      ])
    })
  })

  describe('BS4 yellow cards', () => {
    it('BS4-038 Millennial Tree Cookie plays a Cookie from the break area on play, and pings when another yellow Cookie is present', () => {
      const card = findBs4Card('BS4-038')
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'on-play',
        cost: { energy: { yellow: 1 } },
        effects: [
          { kind: 'break-to-battle', amount: 1, maxLevel: 2, energyColor: 'yellow' },
        ],
      })
      expect(convertOfficialAttackEffects(card)).toEqual([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
          condition: {
            kind: 'battle-area-has-color',
            side: 'self',
            color: 'yellow',
            excludeSource: true,
          },
        },
      ])
    })

    it('BS4-026 Stormbringer Cookie breaks an opponent Cookie when their break area is low, and offers a conditional optional-cost attack Then', () => {
      const card = findBs4Card('BS4-026')
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'on-play',
        cost: { energy: { yellow: 2 } },
        effects: [
          {
            kind: 'battle-to-break',
            target: { side: 'opponent', min: 0, max: 1, maxLevel: 2 },
            condition: { kind: 'opponent-break-level-at-most', level: 5 },
          },
        ],
      })
      expect(convertOfficialAttackEffects(card)).toEqual([
        {
          kind: 'optional-cost-attack',
          cost: { energy: { yellow: 1 } },
          effects: [
            {
              kind: 'damage',
              amount: 2,
              target: { side: 'opponent', min: 0, max: 1 },
              condition: { kind: 'break-level-at-least', level: 3 },
            },
          ],
          effectText:
            "If your break area is LV.3 or higher, use this Cookie as {Y} to deal 2 damage to 1 of your opponent's Cookies.",
        },
      ])
    })

    it('BS4-028 Vagabond Cookie loots when its own break area is LV.5 or higher', () => {
      const card = findBs4Card('BS4-028')
      const breakCondition = { kind: 'break-level-at-least', level: 5 }
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'on-play',
        effects: [
          { kind: 'draw-up-to', max: 1, condition: breakCondition },
          { kind: 'discard-hand', count: 1, condition: breakCondition },
        ],
      })
    })

    it('BS4-039 Churro Cookie finishes off a LV.1 opponent Cookie for bonus damage while healthy', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-039'))).toEqual([
        {
          kind: 'damage',
          amount: 2,
          target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
          condition: { kind: 'source-hp-at-least', amount: 2 },
        },
      ])
    })
  })

  describe('BS4 green cards', () => {
    it('BS4-051 Beet Cookie sets itself active, with the support-to-trash cost parsed automatically', () => {
      const card = findBs4Card('BS4-051')
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: { supportToTrash: 1 },
        effects: [
          {
            kind: 'set-cookie-active',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
    })

    it('BS4-059 Cookiemals draws 2 when its support area is small', () => {
      const card = findBs4Card('BS4-059')
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: { energy: { green: 1 } },
        effects: [
          {
            kind: 'draw-up-to',
            max: 2,
            condition: { kind: 'support-count-at-most', count: 3 },
          },
        ],
      })
    })

    it('BS4-048 Mint Choco Cookie activates a support card at end of turn when green support count is high', () => {
      const card = findBs4Card('BS4-048')
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'passive',
        endPhase: true,
        effects: [
          {
            kind: 'set-active',
            supportCount: 1,
            condition: {
              kind: 'support-color-count-at-least',
              color: 'green',
              count: 7,
            },
          },
        ],
      })
    })

    it('BS4-053 Sugar Swan Cookie moves a green battle Cookie to support as active, and offers a conditional optional-cost attack Then', () => {
      const card = findBs4Card('BS4-053')
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'on-play',
        cost: { energy: { green: 2 } },
        effects: [
          {
            kind: 'battle-to-support',
            target: { side: 'self', min: 0, max: 1, maxLevel: 2, energyColor: 'green' },
          },
        ],
      })
      expect(convertOfficialAttackEffects(card)).toEqual([
        {
          kind: 'optional-cost-attack',
          cost: { energy: { green: 1 } },
          effects: [
            {
              kind: 'damage',
              amount: 1,
              target: { side: 'opponent', min: 0, max: 1 },
              condition: { kind: 'support-count-at-least', count: 7 },
            },
          ],
          effectText:
            "If your support area contains 7 cards or more, use this Cookie as {G} to deal 1 damage to 1 of your opponent's Cookies.",
        },
      ])
    })

    it('BS4-049 Wind Archer Cookie rests an opponent battle Cookie into their support area, and offers a conditional optional-cost attack Then', () => {
      const card = findBs4Card('BS4-049')
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'on-play',
        effects: [
          {
            kind: 'battle-to-support',
            target: { side: 'opponent', min: 0, max: 1 },
            rested: true,
          },
        ],
      })
      expect(convertOfficialAttackEffects(card)).toEqual([
        {
          kind: 'optional-cost-attack',
          cost: { energy: { green: 1 } },
          effects: [
            {
              kind: 'damage',
              amount: 2,
              target: { side: 'opponent', min: 0, max: 1 },
              condition: { kind: 'opponent-support-count-at-least', count: 7 },
            },
          ],
          effectText:
            "If your opponent's support area contains 7 cards or more, use this Cookie as {G} to deal 2 damage to 1 of your opponent's Cookies.",
        },
      ])
    })

    it('BS4-054 Avocado Cookie pings bonus attack Then damage when its support area is large', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-054'))).toEqual([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          condition: { kind: 'support-count-at-least', count: 5 },
        },
      ])
    })

    it('BS4-061 Herb Cookie activates a support card as an attack Then when its support area is large', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-061'))).toEqual([
        {
          kind: 'set-active',
          supportCount: 1,
          condition: { kind: 'support-count-at-least', count: 7 },
        },
      ])
    })
  })

  describe('BS4 purple cards', () => {
    it('BS4-095 Shining Glitter Cookie trashes an opponent stage card on play', () => {
      const card = findBs4Card('BS4-095')
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'on-play',
        cost: { energy: { purple: 1 } },
        effects: [
          {
            kind: 'field-to-trash',
            target: { side: 'opponent', min: 0, max: 1 },
            stageOnly: true,
          },
        ],
      })
    })

    it('BS4-096 Sugar Glass Cookie draws 1, with the HP-card-to-trash cost parsed from the widened "HP card" phrasing', () => {
      const card = findBs4Card('BS4-096')
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: { energy: { purple: 1 }, hpToTrash: { amount: 1 } },
        effects: [{ kind: 'draw-up-to', max: 1 }],
      })
    })

    it('BS4-106 Butterfly Brooch mills an opponent HP card when their trash is large', () => {
      const card = findBs4Card('BS4-106')
      expect(convertOfficialItemAbility(card)).toMatchObject({
        effects: [
          {
            kind: 'hp-to-trash',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1, maxLevel: 2 },
            condition: { kind: 'opponent-trash-count-at-least', count: 10 },
          },
        ],
      })
    })

    it('BS4-107 Moonlight Shards deals damage then mills 3 of the controller\'s own deck when the opponent trash is large', () => {
      const card = findBs4Card('BS4-107')
      const gate = { kind: 'opponent-trash-count-at-least', count: 15 }
      expect(convertOfficialItemAbility(card)).toMatchObject({
        effects: [
          { kind: 'damage', amount: 2, target: { side: 'opponent', min: 0, max: 1 }, condition: gate },
          { kind: 'deck-to-trash', amount: 3, side: 'self', condition: gate },
        ],
      })
    })

    it('BS4-108 Plasma Crystal Ball returns a purple trash card to hand then deals 1 damage', () => {
      const card = findBs4Card('BS4-108')
      expect(convertOfficialItemAbility(card)).toMatchObject({
        cost: { energy: { purple: 3 }, discardHand: 1 },
        effects: [
          { kind: 'trash-to-hand', max: 1, energyColor: 'purple' },
          { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
        ],
      })
    })

    it('BS4-110 City of Wizards draws 2 when its own trash is small enough', () => {
      const card = findBs4Card('BS4-110')
      expect(convertOfficialStageAbility(card)).toMatchObject({
        cost: { energy: { purple: 1 }, discardHand: 2 },
        effects: [
          {
            kind: 'draw-up-to',
            max: 2,
            condition: { kind: 'trash-count-at-most', count: 15 },
          },
        ],
      })
    })

    it('BS4-103 Cream Unicorn Cookie mills its own deck as an unconditional attack Then', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-103'))).toEqual([
        { kind: 'deck-to-trash', amount: 3, side: 'self' },
      ])
    })

    it('BS4-098 Stardust Cookie offers a conditional optional-cost attack Then gated by its own purple trash count', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-098'))).toEqual([
        {
          kind: 'optional-cost-attack',
          cost: { energy: { purple: 1 } },
          effects: [
            {
              kind: 'damage',
              amount: 2,
              target: { side: 'opponent', min: 0, max: 1 },
              condition: {
                kind: 'trash-color-count-at-least',
                color: 'purple',
                count: 15,
              },
            },
          ],
          effectText:
            "If your trash contains 15 {P} cards or more, use this Cookie as {P} to deal 2 damage to 1 of your opponent's Cookies.",
        },
      ])
    })

    it('BS4-089 Moonlight Cookie loots as an attack Then when the opponent trash is large', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-089'))).toEqual([
        {
          kind: 'draw-up-to-then-discard',
          max: 2,
          discardCount: 1,
          condition: { kind: 'opponent-trash-count-at-least', count: 15 },
        },
      ])
    })

    it("BS4-089 Moonlight Cookie mills opponent's deck then trashes an opponent Cookie only when they have EXACTLY 2 (per the Chinese card's own 或更多 contrast)", () => {
      const card = findBs4Card('BS4-089')
      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
        effects: [
          { kind: 'deck-to-trash', amount: 5, side: 'opponent' },
          {
            kind: 'opponent-battle-to-trash',
            min: 0,
            condition: { kind: 'opponent-battle-area-cookie-count', count: 2 },
          },
        ],
      })
    })
  })

  describe('BS4 cards clarified via official Chinese card images', () => {
    it('BS4-075 Black Pearl Cookie pays a mandatory discard-2 cost (no "you may") for a bonus attack Then', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-075'))).toEqual([
        { kind: 'discard-hand', count: 2 },
        {
          kind: 'damage',
          amount: 2,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ])
    })

    it('BS4-094 Blueberry Pie Cookie mills both decks only when a single Cookie is both purple AND LV.3', () => {
      const card = findBs4Card('BS4-094')
      const gate = {
        kind: 'battle-area-has-color',
        side: 'self',
        color: 'purple',
        level: 3,
      }
      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
        effects: [
          { kind: 'deck-to-trash', amount: 3, side: 'self', condition: gate },
          { kind: 'deck-to-trash', amount: 3, side: 'opponent', condition: gate },
        ],
      })
    })

    it('BS4-099 Amber Sugar Cookie lets the controller choose which deck to mill', () => {
      const card = findBs4Card('BS4-099')
      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
        effects: [
          {
            kind: 'choose-one',
            modes: [
              { effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }] },
              { effects: [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }] },
            ],
          },
        ],
      })
    })

    it('BS4-102 Wildberry Cookie lets the controller choose which deck to mill on flip, same as BS4-099', () => {
      const card = findBs4Card('BS4-102')
      expect(convertOfficialFlipAbility(card)).toMatchObject({
        effects: [
          {
            kind: 'choose-one',
            modes: [
              { effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }] },
              { effects: [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }] },
            ],
          },
        ],
      })
    })
  })

  describe('BS4 blue cards revisited (previously deferred, now expressible)', () => {
    it('BS4-073 Sea Fairy Cookie offers a conditional optional-cost bonus attack Then when hand is large', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-073'))).toEqual([
        {
          kind: 'optional-cost-attack',
          cost: { energy: { blue: 1 } },
          effects: [
            {
              kind: 'damage',
              amount: 2,
              target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
              condition: { kind: 'hand-count-at-least', count: 5 },
            },
          ],
          effectText:
            'If your hand contains 5 cards or more, use this Cookie as {B} to deal 2 additional damage to the attacked Cookie.',
        },
      ])
    })

    it('BS4-077 Sorbet Shark Cookie draws 2 when it sends itself to the deck bottom, with a compound hand-count-and-battle-color condition', () => {
      const card = findBs4Card('BS4-077')
      const compoundCondition = {
        kind: 'all-of',
        conditions: [
          { kind: 'hand-count-at-most', count: 5 },
          { kind: 'battle-area-has-color', side: 'self', color: 'blue' },
        ],
      }
      expect(convertOfficialCardEffects(card)).toMatchObject({
        status: 'supported',
        effects: [{ kind: 'draw-up-to', max: 2, condition: compoundCondition }],
      })
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'activate',
        oncePerTurn: false,
        cost: { energy: { blue: 1 }, selfToDeckBottom: true },
        effects: [{ kind: 'draw-up-to', max: 2, condition: compoundCondition }],
      })
    })
  })

  describe('BS4 red cards revisited (previously deferred, now expressible)', () => {
    it('BS4-019 Ring of Eternal Flame mills its own red Cookie HP then independently damages an opponent Cookie, mirroring the BS3-115 two-independent-target pattern', () => {
      const card = findBs4Card('BS4-019')
      expect(convertOfficialItemAbility(card)).toMatchObject({
        effects: [
          {
            kind: 'hp-to-trash',
            amount: 1,
            target: { side: 'self', min: 1, max: 1, energyColor: 'red' },
          },
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
    })
  })

  describe('BS4 green cards revisited (previously deferred, now expressible)', () => {
    it('BS4-058 Lilybell Cookie plays a green Cookie from its own support area into battle', () => {
      const card = findBs4Card('BS4-058')
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: { energy: { green: 2 } },
        effects: [{ kind: 'support-to-battle', amount: 1, energyColor: 'green' }],
      })
    })
  })

  it('BS4-008 parses remaining HP is N or more as a minimum HP target', () => {
    const card = findBs4Card('BS4-008')
    expect(convertOfficialFlipAbility(card)).toMatchObject({
      effects: [{
        kind: 'damage',
        target: {
          side: 'opponent',
          min: 0,
          max: 1,
          minRemainingHp: 2,
        },
      }],
    })
    expect(convertOfficialFlipAbility(card)?.effects[0]).not.toHaveProperty(
      'target.remainingHp',
    )
  })

  describe('BS4 effect audit follow-up', () => {
    it('converts the red item and stage HP/attack effects with their color and level gates', () => {
      expect(convertOfficialItemAbility(findBs4Card('BS4-020'))).toMatchObject({
        effects: [
          {
            kind: 'modify-attack',
            amount: 3,
            target: {
              side: 'self',
              min: 0,
              max: 1,
              minLevel: 3,
              maxLevel: 3,
              energyColor: 'red',
            },
            condition: { kind: 'break-level-at-least', level: 6 },
          },
        ],
      })
      expect(convertOfficialStageAbility(findBs4Card('BS4-022'))).toMatchObject({
        cost: { energy: { red: 2 } },
        restSource: true,
        effects: [
          {
            kind: 'hp-to-trash',
            amount: 1,
            target: {
              side: 'self',
              min: 0,
              max: 1,
              minLevel: 2,
              energyColor: 'red',
            },
          },
          { kind: 'damage', amount: 1 },
        ],
      })
    })

    it('converts BS4 ability effects for support, battle-area, and faint timing', () => {
      expect(convertOfficialCookieSkill(findBs4Card('BS4-035'))).toMatchObject({
        trigger: 'passive',
        faint: true,
        effects: [
          {
            kind: 'break-to-battle',
            amount: 1,
            exactLevel: 1,
            energyColor: 'yellow',
          },
        ],
      })
      expect(convertOfficialCookieSkill(findBs4Card('BS4-055'))).toMatchObject({
        trigger: 'passive',
        faint: true,
        effects: [{ kind: 'deck-to-support', amount: 1, rested: true }],
      })
      expect(convertOfficialItemAbility(findBs4Card('BS4-040'))).toMatchObject({
        cost: {
          energy: { yellow: 2 },
        },
        effects: [
          { kind: 'battle-to-break', target: { min: 1, minLevel: 2, energyColor: 'yellow' } },
          { kind: 'break-to-battle', amount: 1, exactLevel: 3, energyColor: 'yellow' },
        ],
      })
      expect(convertOfficialCookieSkill(findBs4Card('BS4-093'))).toMatchObject({
        trigger: 'passive',
        faint: true,
        effects: [{ kind: 'opponent-battle-to-trash', min: 0, maxLevel: 2 }],
      })
      expect(convertOfficialStageAbility(findBs4Card('BS4-088'))).toMatchObject({
        cost: { energy: { blue: 1 }, discardHand: 1 },
        restSource: true,
        effects: [
          {
            kind: 'return-to-hand',
            target: {
              side: 'self',
              min: 0,
              max: 1,
              maxLevel: 2,
              minRemainingHp: 4,
              energyColor: 'blue',
            },
          },
        ],
      })
    })

    it('converts BS4 flip and on-play abilities with their runtime conditions', () => {
      expect(convertOfficialFlipAbility(findBs4Card('BS4-057'))).toMatchObject({
        effects: [
          {
            kind: 'flip-to-support',
            rested: true,
            condition: { kind: 'break-level-at-least', level: 6 },
          },
        ],
      })
      expect(convertOfficialCookieSkill(findBs4Card('BS4-092'))).toMatchObject({
        trigger: 'on-play',
        cost: {
          energy: { purple: 1 },
          discardHand: 0,
          trashBattleCookie: {
            count: 1,
            maxLevel: 2,
            energyColor: 'purple',
            excludeSource: true,
          },
        },
        effects: [
          { kind: 'damage', amount: 2, target: { maxLevel: 1 } },
        ],
      })
      expect(convertOfficialCookieSkill(findBs4Card('BS4-098'))).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: { energy: { purple: 1 }, discardHand: 1 },
        effects: [
          { kind: 'disable-flip', duration: 'this-turn' },
          { kind: 'damage', amount: 1 },
        ],
      })
    })

    it('converts all five previously pending BS4 attack Then clauses', () => {
      expect(convertOfficialAttackEffects(findBs4Card('BS4-023'))).toEqual([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
          condition: {
            kind: 'break-area-has-card',
            side: 'self',
            color: 'yellow',
            minLevel: 3,
            maxLevel: 3,
          },
        },
      ])
      expect(convertOfficialAttackEffects(findBs4Card('BS4-029'))).toMatchObject([
        {
          kind: 'optional-cost-attack',
          cost: { energy: { yellow: 1 } },
          effects: [
            { kind: 'battle-to-break', target: { sourceOnly: true, min: 1, max: 1 } },
            { kind: 'break-to-battle', amount: 1, exactLevel: 3, energyColor: 'yellow' },
          ],
        },
      ])
      expect(convertOfficialAttackEffects(findBs4Card('BS4-069'))).toEqual([
        { kind: 'opponent-discard-hand', count: 1, destination: 'deck-bottom' },
      ])
      expect(convertOfficialAttackEffects(findBs4Card('BS4-090'))).toEqual([
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          condition: { kind: 'trash-flip-count-at-least', count: 3 },
        },
      ])
      expect(convertOfficialAttackEffects(findBs4Card('BS4-091'))).toEqual([
        {
          kind: 'trash-to-deck',
          max: 3,
          excludeFlip: true,
          destination: 'bottom',
        },
      ])
    })

    it('converts the remaining pending BS4 yellow and green effects with their selection boundaries', () => {
      expect(convertOfficialCookieSkill(findBs4Card('BS4-024'))).toMatchObject({
        trigger: 'passive',
        effects: [
          {
            kind: 'redirect-attack',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
            condition: {
              kind: 'battle-area-has-color',
              side: 'self',
              color: 'yellow',
              level: 3,
            },
          },
        ],
      })
      expect(convertOfficialCookieSkill(findBs4Card('BS4-025'))).toMatchObject({
        trigger: 'on-play',
        effects: [
          { kind: 'hand-to-break', amount: 1, energyColor: 'yellow', minLevel: 2 },
          { kind: 'break-to-battle', amount: 1, exactLevel: 2, energyColor: 'yellow' },
        ],
      })
      expect(convertOfficialCookieSkill(findBs4Card('BS4-030'))).toMatchObject({
        trigger: 'on-play',
        effects: [
          {
            kind: 'cycle-hp',
            target: {
              side: 'self',
              min: 0,
              max: 1,
              excludeSource: true,
              energyColor: 'yellow',
            },
          },
        ],
      })
      expect(convertOfficialTrapAbility(findBs4Card('BS4-043'))).toMatchObject({
        effects: [
          {
            kind: 'damage-by-break-level-difference',
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'break-level-higher-than-opponent' },
          },
        ],
        cost: { energy: { yellow: 3 }, discardHand: 1 },
      })
      expect(convertOfficialTrapAbility(findBs4Card('BS4-065'))).toMatchObject({
        effects: [
          {
            kind: 'modify-attack',
            amount: -1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          { kind: 'deck-to-support', amount: 1, rested: true },
        ],
        cost: { energy: { green: 3 }, discardHand: 0 },
      })
      expect(convertOfficialTrapAbility(findBs4Card('BS4-109'))).toMatchObject({
        effects: [
          {
            kind: 'modify-attack',
            amount: -1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          {
            kind: 'inspect-deck',
            lookCount: 3,
            pickCount: 1,
            filterColor: 'purple',
            optionalPick: true,
            restDestination: 'trash',
          },
        ],
        cost: { energy: { purple: 2 }, discardHand: 0 },
      })
      expect(convertOfficialStageAbility(findBs4Card('BS4-044'))).toMatchObject({
        cost: { energy: { yellow: 2 }, discardHand: 1 },
        restSource: true,
        effects: [
          {
            kind: 'hand-to-hp',
            target: { side: 'self', min: 0, max: 1 },
            selectTarget: true,
            optional: true,
          },
        ],
      })
      expect(convertOfficialItemAbility(findBs4Card('BS4-062'))).toMatchObject({
        cost: { green: 2 },
        effects: [
          {
            kind: 'rest-support-and-damage',
            supportSide: 'self',
            supportAmount: 4,
            supportEnergyColor: 'green',
            activeOnly: true,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      })
      expect(convertOfficialItemAbility(findBs4Card('BS4-063'))).toMatchObject({
        cost: { green: 3 },
        effects: [
          { kind: 'deck-to-support', amount: 2, rested: true },
          { kind: 'support-to-trash', amount: 1 },
        ],
      })
    })

    it('converts the remaining pending BS4 blue and PURE effects', () => {
      expect(convertOfficialStageAbility(findBs4Card('BS4-066'))).toMatchObject({
        cost: { energy: { green: 3 }, discardHand: 0 },
        restSource: true,
        effects: [
          {
            kind: 'support-to-hp',
            target: { side: 'self', min: 0, max: 1 },
            energyColor: 'green',
            selectTarget: true,
            optional: true,
          },
        ],
      })
      expect(convertOfficialCookieSkill(findBs4Card('BS4-073'))).toMatchObject({
        trigger: 'on-play',
        effects: [
          {
            kind: 'return-to-deck-bottom',
            target: { side: 'self', min: 1, max: 1, maxLevel: 2 },
          },
          { kind: 'damage-all', amount: 1, side: 'opponent' },
        ],
      })
      expect(convertOfficialCookieSkill(findBs4Card('BS4-074'))).toMatchObject({
        trigger: 'on-play',
        effects: [
          { kind: 'discard-hand-all' },
          { kind: 'draw-up-to', max: 4 },
        ],
      })
      expect(convertOfficialCookieSkill(findBs4Card('BS4-075'))).toMatchObject({
        trigger: 'activate',
        effects: [
          {
            kind: 'field-to-deck-bottom',
            target: { side: 'either', min: 1, max: 1, maxLevel: 1 },
            allowStage: true,
            battleSide: 'opponent',
          },
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      })
      expect(convertOfficialItemAbility(findBs4Card('BS4-084'))).toMatchObject({
        cost: { blue: 3 },
        effects: [{ kind: 'draw-until-hand-equals-opponent' }],
      })
      expect(convertOfficialStageAbility(findBs4Card('BS4-111'))).toMatchObject({
        cost: { neutral: 5 },
        restSource: true,
        effects: [
          { kind: 'field-to-deck-bottom-all', maxLevel: 2 },
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 0, max: 1, minLevel: 3, maxLevel: 3 },
          },
        ],
      })
    })
  })
})
