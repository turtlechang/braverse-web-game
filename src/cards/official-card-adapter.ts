import type { CardColor, CardKeyword, GameCard } from '../game'
import {
  convertOfficialCardEffects,
  convertOfficialAttackEffects,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
} from './official-effect-adapter'
import { parseOfficialCardTexts } from './official-text-parser'
import { normalizeKnownOfficialCardRecord } from './official-card-normalization'
import type {
  OfficialCardConversion,
  OfficialCardRecord,
} from './types'

const NON_COOKIE_TYPE_MAP = {
  item: 'item',
  trap: 'trap',
  stage: 'stage',
} as const

const createInstanceId = (
  card: OfficialCardRecord,
  instanceSuffix: string,
) => `${card.cardNumber}:${instanceSuffix}`

const getCardColor = (card: OfficialCardRecord): CardColor | undefined => {
  const color = card.color?.toLowerCase()
  if (
    color === 'red' ||
    color === 'yellow' ||
    color === 'green' ||
    color === 'blue' ||
    color === 'purple' ||
    color === 'black' ||
    color === 'pure'
  ) {
    return color
  }

  return undefined
}

const getEnergyColor = (
  card: OfficialCardRecord,
  cardColor: CardColor | undefined,
): GameCard['energyColor'] => {
  if (cardColor) {
    return cardColor
  }

  if (card.energyType === 'MIX') {
    return 'wild'
  }

  return undefined
}

export const getRuntimeKeywords = (card: OfficialCardRecord): CardKeyword[] => {
  const keywords = new Set<CardKeyword>()

  if (card.keywords.some((keyword) => keyword.replace(/[{}]/g, '').trim().toLowerCase() === 'ancient')) {
    keywords.add('ancient')
  }

  if (card.keywords.some((keyword) => keyword.replace(/[{}]/g, '').trim().toLowerCase() === 'dragon')) {
    keywords.add('dragon')
  }

  if (
    card.keywords.some((keyword) => keyword.replace(/[{}]/g, '').trim().toLowerCase() === 'arena') ||
    /arena/i.test(`${card.skill.text ?? ''} ${card.attackText ?? ''} ${card.flipText ?? ''}`)
  ) {
    keywords.add('arena')
  }

  if (/^Soul Jam\s*:/i.test(card.name.trim())) {
    keywords.add('soul-jam')
  }

  return [...keywords]
}

export const normalizeOfficialCardRecord = (
  sourceCard: OfficialCardRecord,
): OfficialCardRecord => {
  const knownNormalized = normalizeKnownOfficialCardRecord(sourceCard)
  if (knownNormalized !== sourceCard) return knownNormalized

  // 部分官方 FLIP 記錄把 FLIP 文案誤放在 skill.text；在轉接邊界移回
  // flipText，避免 runtime 卡沒有 FlipAbility 而產生空白、無法結算的 FLIP 視窗。
  if (
    sourceCard.type === 'flip' &&
    !sourceCard.flipText &&
    sourceCard.skill.text
  ) {
    return {
      ...sourceCard,
      skill: { ...sourceCard.skill, text: null },
      flipText: sourceCard.skill.text,
    }
  }

  // 官方 BS4-032@1 異圖 API 記錄與其官方卡圖的 HP、攻擊與 FLIP 欄位不一致；
  // 以卡圖上的正式文字與數值修正轉換邊界，不改動原始匯入資料。
  if (
    sourceCard.cardNumber === 'BS4-032@1' &&
    sourceCard.type === 'flip' &&
    sourceCard.name === 'Cream Ferret Cookie'
  ) {
    return {
      ...sourceCard,
      hp: 2,
      attackText: '<{Y}{Y}> Creamcraft Magic! {da} 2',
      flipText: 'Draw up to 1 card from your deck.',
    }
  }

  // 官方 BS4-080@2 異圖把技能文字、攻擊文字與 FLIP 展示標籤全部併進
  // attackText（技能欄位為空）。同系列異圖（BS4-027@1／047@1／100@1）
  // 的 Blocker 技能都印有「<Rest this card.>」代價，此版本只是欄位併寫
  // 遺失了括號文字；依基礎版本拆分欄位，並保留 @2 卡面獨有的 Then 段。
  if (
    sourceCard.cardNumber === 'BS4-080@2' &&
    sourceCard.type === 'cookie' &&
    /^Icy Glare/i.test(sourceCard.attackText ?? '') &&
    /\{da\}\s*2\s+Then,/i.test(sourceCard.attackText ?? '')
  ) {
    return {
      ...sourceCard,
      skill: {
        name: '{sk} Icy Glare',
        text:
          "{bl} <Rest this card.> (When one of your opponent's Cookies attacks, you can redirect the attack to this Cookie.)\r\n{t1} This Cookie receives -1 attack damage from LV.1 Cookies.",
      },
      attackText:
        '<{B}{B}{N}> Set Sail! {da} 2 Then, if there are 5 cards or less in your hand, draw up to 2 cards from your deck.',
    }
  }

  // 官方 P-100（FLIP）把 FLIP 效果文字誤併進 attackText，flipText 為空；
  // 與 BS3-012 等 FLIP 的正式欄位形狀（攻擊文字＋獨立 flipText）對齊，
  // 讓 FlipAbility 能正確取得「<Discard 1 card.>」代價與附著 HP +1。
  if (
    sourceCard.cardNumber === 'P-100' &&
    sourceCard.type === 'flip' &&
    !sourceCard.flipText &&
    /<Discard 1 card\.>\s*The Cookie with this card attached for HP gains \+1 HP\./i.test(
      sourceCard.attackText ?? '',
    )
  ) {
    return {
      ...sourceCard,
      attackText: '<{B}> Bear Jelly Icicles {da} 1',
      flipText:
        '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
    }
  }

  // 官方 BS4-004@1 異圖資料把 On Play 文字寫進 attackText，並把真正的
  // 攻擊文字寫進 flipText；轉換邊界修正欄位，不改動原始匯入資料。
  if (
    sourceCard.cardNumber === 'BS4-004@1' &&
    sourceCard.type === 'cookie' &&
    /^【On Play】/i.test(sourceCard.attackText ?? '') &&
    /\{da\}/i.test(sourceCard.flipText ?? '')
  ) {
    return {
      ...sourceCard,
      skill: { ...sourceCard.skill, text: sourceCard.attackText },
      attackText: sourceCard.flipText,
      flipText: null,
    }
  }

  // 官方 BS5-089@2 異圖把完整攻擊文字遺漏在 attackText，僅留下攻擊名稱
  // 在 flipText；沿用同卡基礎版本的攻擊數值與 Then，避免異圖在正式牌池
  // 被判定為 missing-attack-definition。
  if (
    sourceCard.cardNumber === 'BS5-089@2' &&
    sourceCard.type === 'cookie' &&
    !sourceCard.attackText &&
    /Kettlebell Throw/i.test(sourceCard.flipText ?? '')
  ) {
    return {
      ...sourceCard,
      attackText:
        '<{P}{P}> Kettlebell Throw {da} 2 Then, place up to 3 cards from the top of your deck into the trash.',
      flipText: null,
    }
  }

  // BS6-091 目前只有 @2／@3 異圖記錄；官方英文 API 將「從棄牌區登場時」
  // 的技能文字與普通攻擊合併在 attackText。拆回各自欄位，讓 runtime 能同時
  // 保留 fromTrashArea OnPlay 與正確的攻擊費用／傷害。
  if (
    sourceCard.baseCardNumber === 'BS6-091' &&
    sourceCard.type === 'cookie' &&
    !sourceCard.skill.text &&
    /\{sk\}\s*Time Researcher/i.test(sourceCard.attackText ?? '') &&
    /\{da\}\s*2/i.test(sourceCard.attackText ?? '')
  ) {
    return {
      ...sourceCard,
      skill: {
        ...sourceCard.skill,
        text:
          'When this Cookie is played from the trash, Select up to 1 {P} LV.1 Cookie other than [Schneeball Cookie] from your break area. Place that Cookie in the trash.',
      },
      attackText: '<{P}{P}> Relic Analysis {da} 2',
    }
  }

  // P-078 的英文官方資料漏了攻擊傷害標記；韓文官方資料同一張卡明確為
  // `{da} 1`。在 adapter 邊界補回標記，讓本體與兩張異圖共用同一套攻擊效果。
  if (
    sourceCard.baseCardNumber === 'P-078' &&
    sourceCard.type === 'cookie' &&
    sourceCard.attackText === '<{B}{B}> Sovereign of the Abyss 1'
  ) {
    return {
      ...sourceCard,
      attackText: '<{B}{B}> Sovereign of the Abyss {da} 1',
    }
  }

  // BS6 官方英文 API 的 6 筆卡牌資料遺漏普通攻擊的 `{da}` 標記，
  // 但卡圖仍保留正確傷害值。限制在明確的卡號／基礎卡號補回，
  // 避免把未知的攻擊文案誤判成可攻擊卡牌。
  const bs6AttackTextFallbacks: Record<string, string> = {
    'BS6-018':
      "<{R}{R}> Victory is a matter of a moment! {da} 1 Then, if this Cookie's remaining HP is 1, select up to 1 of your Cookies. During this turn, that Cookie gains +1 attack damage.",
    'BS6-040': '<{N}{N}> Always follow your heart! {da} 3',
    'BS6-061':
      '<{G}{G}> A Case? Leave it to me! {da} 2 Then, <return 1 Cookie from your support area to your hand.> Select up to 1 of your Cookies with 5 or less HP remaining. That Cookie gains +1 HP.',
    'BS6-083': '<{B}{B}> Continuous Effort {da} 2',
    'BS6-104': '<{P}{P}> A sub would be... Terrific! {da} 2',
  }
  const bs6FallbackKey =
    sourceCard.baseCardNumber === 'BS6-061'
      ? 'BS6-061'
      : sourceCard.cardNumber
  const bs6AttackTextFallback = bs6AttackTextFallbacks[bs6FallbackKey]
  if (
    sourceCard.type === 'cookie' ||
    (sourceCard.type === 'flip' && sourceCard.cardNumber === 'BS6-104')
  ) {
    if (
      bs6AttackTextFallback &&
      !/\{da\}/i.test(sourceCard.attackText ?? '')
    ) {
      return {
        ...sourceCard,
        attackText: bs6AttackTextFallback,
      }
    }
  }

  return sourceCard
}

export const convertOfficialCardToGameCard = (
  sourceCard: OfficialCardRecord,
  instanceSuffix = '1',
): OfficialCardConversion => {
  const card = normalizeOfficialCardRecord(sourceCard)
  const parsedText = parseOfficialCardTexts(card)
  const effectConversion = convertOfficialCardEffects(card)
  const skill = convertOfficialCookieSkill(card)
  const flip = convertOfficialFlipAbility(card)
  const trap = convertOfficialTrapAbility(card)
  const item = convertOfficialItemAbility(card)
  const stageAbility = convertOfficialStageAbility(card)
  const cardColor = getCardColor(card)
  const energyColor = getEnergyColor(card, cardColor)
  const keywords = getRuntimeKeywords(card)
  const hasSupportedEffect = effectConversion.status === 'supported'
  const effectData = hasSupportedEffect
    ? {
        effectText: effectConversion.sourceText,
        effects: effectConversion.effects,
      }
    : trap
      ? { effectText: trap.text, effects: trap.effects }
      : item
        ? { effectText: item.text, effects: item.effects }
        : stageAbility
          ? { effectText: stageAbility.text, effects: stageAbility.effects }
          : flip
            ? { effectText: flip.text, effects: flip.effects }
            : {}

  if (card.type === 'extra' || card.type === 'unknown') {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      reason: 'unsupported-card-type',
    }
  }

  if (card.type === 'cookie' || card.type === 'flip') {
    if (card.level === null || card.hp === null) {
      return {
        status: 'unsupported',
        cardNumber: card.cardNumber,
        reason: 'missing-cookie-stats',
      }
    }

    const hpOnlyFlip =
      card.type === 'flip' &&
      card.baseCardNumber === 'P-024' &&
      Boolean(flip)

    if (!parsedText.attack || parsedText.attack.damage === null) {
      if (!hpOnlyFlip) {
        return {
          status: 'unsupported',
          cardNumber: card.cardNumber,
          reason: 'missing-attack-definition',
        }
      }
    }

    const resolvedAttackEffects = convertOfficialAttackEffects(card)

    const gameCard: GameCard = {
      id: card.baseCardNumber,
      instanceId: createInstanceId(card, instanceSuffix),
      name: card.name,
      imageUrl: card.imageUrl,
      ...(cardColor ? { cardColor } : {}),
      energyColor,
      ...(keywords.length > 0 ? { keywords } : {}),
      officialType: card.type,
      type: 'cookie',
      level: card.level,
      hp: card.hp,
      attack: parsedText.attack?.damage ?? 0,
      attackCost: parsedText.attack?.totalCost ?? 0,
      attackEnergyCost: parsedText.attack?.cost ?? {},
      ...(hpOnlyFlip ? { nonAttackable: true } : {}),
      attackText: card.attackText ?? undefined,
      ...effectData,
      ...(skill ? { skill } : {}),
      ...(flip ? { flip } : {}),
      ...(resolvedAttackEffects ? { attackEffects: resolvedAttackEffects } : {}),
    }

    return {
      status: 'converted',
      gameCard,
      source: {
        cardNumber: card.cardNumber,
        baseCardNumber: card.baseCardNumber,
        variant: card.variant,
        imageUrl: card.imageUrl,
        rarity: card.rarity,
        productTitle: card.product.title,
      },
      parsedText,
    }
  }

  const mappedType = NON_COOKIE_TYPE_MAP[card.type]

  if (!mappedType) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      reason: 'unsupported-card-type',
    }
  }

  return {
    status: 'converted',
    gameCard: {
      id: card.baseCardNumber,
      instanceId: createInstanceId(card, instanceSuffix),
      name: card.name,
      imageUrl: card.imageUrl,
      ...(cardColor ? { cardColor } : {}),
      energyColor,
      ...(keywords.length > 0 ? { keywords } : {}),
      officialType: card.type,
      type: mappedType,
      ...effectData,
      ...(trap ? { trap } : {}),
      ...(item ? { item } : {}),
      ...(stageAbility ? { stageAbility } : {}),
    },
    source: {
      cardNumber: card.cardNumber,
      baseCardNumber: card.baseCardNumber,
      variant: card.variant,
      imageUrl: card.imageUrl,
      rarity: card.rarity,
      productTitle: card.product.title,
    },
    parsedText,
  }
}

export const convertOfficialCards = (
  cards: OfficialCardRecord[],
): OfficialCardConversion[] =>
  cards.map((card, index) =>
    convertOfficialCardToGameCard(card, String(index + 1)),
  )
