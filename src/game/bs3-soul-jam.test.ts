import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/candidates/official-age-of-heroes-and-kingdoms-bs3.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { convertOfficialItemAbility } from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { beginAttack, resolveAttackEffect, resolveNextDamage, skipTrap } from './battle'
import { executeCardEffect, getEffectTargetCandidates } from './effects'
import type { CookieCard, EffectContext, GameCard, GameState } from './types'
import { createBattleState, item } from './test-helpers/battle-helpers'

const findBs3Card = (cardNumber: string) => {
  const card = (officialBS3Inventory.cards as OfficialCardRecord[]).find(
    (candidate) => candidate.cardNumber === cardNumber,
  )
  if (!card) throw new Error(`Missing BS3 inventory card ${cardNumber}`)
  return card
}

const asCookie = (cardNumber: string): CookieCard => {
  const conversion = convertOfficialCardToGameCard(findBs3Card(cardNumber))
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') {
    throw new Error(`${cardNumber} should convert to a CookieCard.`)
  }
  return conversion.gameCard
}

const equipSourceEffect = (cardNumber: string) => {
  const item = convertOfficialItemAbility(findBs3Card(cardNumber))
  const effect = item?.effects.find((candidate) => candidate.kind === 'equip-source')
  if (!effect || effect.kind !== 'equip-source') {
    throw new Error(`${cardNumber} should convert an equip-source effect.`)
  }
  return effect
}

/**
 * 官方 Q&A：本系列的靈魂果醬裝載完成後都有各自的持續效果或自動效果，
 * BS3-043《靈魂果醬:富饒之光》(HP+2) 是例外——裝載當下的一次性效果，
 * 之後即使道具持續掛在餅乾上，也不會再有任何效果。
 */
describe('BS3-043 Soul Jam: Light of Abundance is a one-shot HP gain', () => {
  it('converts without an attackBonus — equip-source only carries gainHp', () => {
    const effect = equipSourceEffect('BS3-043')
    expect(effect).toEqual({
      kind: 'equip-source',
      target: { side: 'self', min: 0, max: 1 },
      requiredCookieId: 'BS3-025',
      gainHp: 2,
    })
    expect(effect.attackBonus).toBeUndefined()
  })

  it('grants +2 HP once at equip time and creates no persistent modifier', () => {
    const goldenCheese = asCookie('BS3-025')
    const soulJam = convertOfficialCardToGameCard(findBs3Card('BS3-043'))
    if (soulJam.status !== 'converted') throw new Error('Soul Jam must convert.')

    const state = createBattleState()
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: goldenCheese,
    }
    state.players['player-two'].discardPile = [soulJam.gameCard]
    state.players['player-two'].deck = [item('deck-hp-1'), item('deck-hp-2'), item('deck-hp-3')]
    const hpBefore = state.players['player-two'].battleArea[0].hpCards.length

    const result = executeCardEffect(
      state,
      {
        sourcePlayerId: 'player-two',
        sourceInstanceId: soulJam.gameCard.instanceId,
      },
      equipSourceEffect('BS3-043'),
      [goldenCheese.instanceId],
    )

    const equipped = result.players['player-two'].battleArea[0]
    expect(equipped.hpCards).toHaveLength(hpBefore + 2)
    expect(equipped.equippedCards).toContainEqual(soulJam.gameCard)
    // 沒有 attackBonus，equip-source 執行器不會建立任何 attackModifiers 條目。
    expect(result.attackModifiers).toEqual([])
  })

  it('does not append any effect to a later attack — the equipped item stays inert', () => {
    const state = createBattleState()
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      equippedCards: [
        { ...item('equipped-bs3-043'), id: 'BS3-043' } satisfies GameCard,
      ],
    }

    const attacked = beginAttack(state, 'attacker', 'defender', ['p2-support'])

    expect(attacked.pendingBattle?.attackEffects).toEqual([])
  })
})

/**
 * BS3-066《靈魂果醬:自由之光》裝載後的持續效果是「當那隻餅乾攻擊時，
 * 將最多 1 張支援區卡設為活躍」——由 battle.ts 的 getEquipAttackEffects
 * 依裝備卡的 id 查表，附加進 beginAttack 建立的 attackEffects。
 */
describe('BS3-066 Soul Jam: Light of Freedom triggers set-active on attack', () => {
  const createEquippedAttackState = (): GameState => {
    const state = createBattleState()
    state.players['player-two'] = {
      ...state.players['player-two'],
      battleArea: [
        {
          ...state.players['player-two'].battleArea[0],
          equippedCards: [
            { ...item('equipped-bs3-066'), id: 'BS3-066' } satisfies GameCard,
          ],
        },
      ],
      supportArea: [
        { card: item('p2-support'), rested: false },
        { card: item('p2-support-rested'), rested: true },
      ],
    }
    return state
  }

  it('appends a selectable set-active effect to attackEffects when declaring the attack', () => {
    const state = createEquippedAttackState()
    const attacked = beginAttack(state, 'attacker', 'defender', ['p2-support'])

    expect(attacked.pendingBattle?.attackEffects).toEqual([
      { kind: 'set-active', supportCount: 1, selectable: true },
    ])
  })

  it('un-rests the chosen support card once the attack effect resolves', () => {
    let state = beginAttack(createEquippedAttackState(), 'attacker', 'defender', ['p2-support'])
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }
    expect(state.pendingBattle?.stage).toBe('attack-effect')

    const resolved = resolveAttackEffect(state, 'player-two', ['p2-support-rested'])

    expect(
      resolved.players['player-two'].supportArea.find(
        (support) => support.card.instanceId === 'p2-support-rested',
      )?.rested,
    ).toBe(false)
  })
})

/**
 * BS3-091《靈魂果醬:真實之光》裝載後的持續效果是「當那隻餅乾攻擊時，
 * 從牌庫抽 1 張牌」。
 */
describe('BS3-091 Soul Jam: Light of Truth triggers a draw on attack', () => {
  const createEquippedAttackState = (): GameState => {
    const state = createBattleState()
    state.players['player-two'] = {
      ...state.players['player-two'],
      battleArea: [
        {
          ...state.players['player-two'].battleArea[0],
          equippedCards: [
            { ...item('equipped-bs3-091'), id: 'BS3-091' } satisfies GameCard,
          ],
        },
      ],
      deck: [item('deck-draw-1'), item('deck-draw-2')],
    }
    return state
  }

  it('appends a draw effect to attackEffects when declaring the attack', () => {
    const state = createEquippedAttackState()
    const attacked = beginAttack(state, 'attacker', 'defender', ['p2-support'])

    expect(attacked.pendingBattle?.attackEffects).toEqual([
      { kind: 'draw', amount: 1 },
    ])
  })

  it('draws a card from the deck once the attack effect resolves', () => {
    let state = beginAttack(createEquippedAttackState(), 'attacker', 'defender', ['p2-support'])
    state = skipTrap(state, 'player-one')
    while (state.pendingBattle?.stage === 'damage') {
      state = resolveNextDamage(state)
    }

    const handBefore = state.players['player-two'].hand.length
    const deckBefore = state.players['player-two'].deck.length

    const resolved = resolveAttackEffect(state, 'player-two', [])

    expect(resolved.players['player-two'].hand.length).toBe(handBefore + 1)
    expect(resolved.players['player-two'].deck.length).toBe(deckBefore - 1)
  })
})

/**
 * BS3-115《靈魂果醬:抉擇之光》裝載後：「那隻餅乾不能被對手的效果選為目標，
 * 也不能被送入棄牌區」——由 targeting.ts 的 matchesSelector 依裝備卡 id
 * 在來源不是擁有者本人時排除候選。
 */
describe('BS3-115 Soul Jam: Light of Resolution blocks opponent targeting', () => {
  const createProtectedState = (): GameState => {
    const state = createBattleState()
    state.players['player-one'].battleArea[0] = {
      ...state.players['player-one'].battleArea[0],
      equippedCards: [
        { ...item('equipped-bs3-115'), id: 'BS3-115' } satisfies GameCard,
      ],
    }
    return state
  }

  it('excludes the equipped Cookie from an opponent-sourced target selector', () => {
    const state = createProtectedState()
    const opponentContext: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'attacker',
    }
    const candidates = getEffectTargetCandidates(state, opponentContext, {
      side: 'opponent',
      min: 0,
      max: 1,
    })

    expect(
      candidates.some((cookie) => cookie.card.instanceId === 'defender'),
    ).toBe(false)
  })

  it('still lets its own controller target it with a self-sourced effect', () => {
    const state = createProtectedState()
    const ownerContext: EffectContext = {
      sourcePlayerId: 'player-one',
      sourceInstanceId: 'defender',
      sourceCardName: 'defender',
    }
    const candidates = getEffectTargetCandidates(state, ownerContext, {
      side: 'self',
      min: 0,
      max: 1,
    })

    expect(
      candidates.some((cookie) => cookie.card.instanceId === 'defender'),
    ).toBe(true)
  })
})
