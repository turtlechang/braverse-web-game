import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { convertOfficialItemAbility } from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { beginAttack, resolveAttackEffect, resolveNextDamage, skipTrap } from './battle'
import { applyGameCommand } from './commands'
import {
  executeCardEffect,
  getEffectTargetCandidates,
} from './effects'
import type { CookieCard, EffectContext, GameCard, GameState } from './types'
import { createBattleState, cookie, item } from './test-helpers/battle-helpers'

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
 * 也不能被送入棄牌區」。
 *
 * 官方裁定補充：
 * - 普通攻擊可打；攻擊附加若保持同一對象（attackTargetOnly）仍可造成附加傷害
 * - 不選擇目標的全場效果（如 damage-all）仍屬效果，不能影響它
 * - 只有對手效果被擋；自己的效果不受影響
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

  const opponentContext = (): EffectContext => ({
    sourcePlayerId: 'player-two',
    sourceInstanceId: 'attacker',
    sourceCardName: 'attacker',
  })

  it('excludes the equipped Cookie from an opponent-sourced target selector', () => {
    const state = createProtectedState()
    const candidates = getEffectTargetCandidates(state, opponentContext(), {
      side: 'opponent',
      min: 0,
      max: 1,
    })

    expect(
      candidates.some((c) => c.card.instanceId === 'defender'),
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
      candidates.some((c) => c.card.instanceId === 'defender'),
    ).toBe(true)
  })

  it('still allows attackTargetOnly bonus damage against the current attack target', () => {
    const state = createProtectedState()
    state.pendingBattle = {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: 'attacker',
      targetInstanceId: 'defender',
      declaredDamage: 1,
      remainingDamage: 0,
      stage: 'attack-effect',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [],
      attackEffectIndex: 0,
    }

    const candidates = getEffectTargetCandidates(state, opponentContext(), {
      side: 'opponent',
      min: 1,
      max: 1,
      attackTargetOnly: true,
    })
    expect(candidates.map((c) => c.card.instanceId)).toEqual(['defender'])

    const beforeHp = state.players['player-one'].battleArea[0].hpCards.length
    const damaged = executeCardEffect(
      state,
      opponentContext(),
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
      },
      ['defender'],
    )
    expect(damaged.players['player-one'].battleArea[0].hpCards.length).toBe(
      beforeHp - 1,
    )
  })

  it('blocks damage-all from an opponent-sourced effect', () => {
    const state = createProtectedState()
    // 場上再放一隻未保護餅乾，確認全場效果只略過受保護者
    state.players['player-one'].battleArea.push({
      card: cookie('unprotected', 1, 2),
      hpCards: [item('unprotected-hp-a'), item('unprotected-hp-b')],
      rested: false,
      battleEntryId: 'unprotected:battle:1',
    })

    const beforeProtected =
      state.players['player-one'].battleArea[0].hpCards.length
    const beforeOther = state.players['player-one'].battleArea[1].hpCards.length

    const next = executeCardEffect(
      state,
      opponentContext(),
      { kind: 'damage-all', amount: 1, side: 'opponent' },
      [],
    )

    const protectedCookie = next.players['player-one'].battleArea.find(
      (c) => c.card.instanceId === 'defender',
    )
    const otherCookie = next.players['player-one'].battleArea.find(
      (c) => c.card.instanceId === 'unprotected',
    )
    expect(protectedCookie?.hpCards.length).toBe(beforeProtected)
    expect(otherCookie?.hpCards.length).toBe(beforeOther - 1)
  })

  it('blocks field-to-trash-all from trashing the protected Cookie', () => {
    const state = createProtectedState()
    state.players['player-one'].battleArea.push({
      card: cookie('unprotected-lv1', 1, 1),
      hpCards: [item('unprotected-lv1-hp')],
      rested: false,
      battleEntryId: 'unprotected-lv1:battle:1',
    })

    const next = executeCardEffect(
      state,
      opponentContext(),
      { kind: 'field-to-trash-all', maxLevel: 2 },
      [],
    )

    expect(
      next.players['player-one'].battleArea.some(
        (c) => c.card.instanceId === 'defender',
      ),
    ).toBe(true)
    expect(
      next.players['player-one'].battleArea.some(
        (c) => c.card.instanceId === 'unprotected-lv1',
      ),
    ).toBe(false)
  })

  it('rejects opponent field-to-trash targeting the protected Cookie', () => {
    const state = createProtectedState()
    expect(() =>
      executeCardEffect(
        state,
        opponentContext(),
        {
          kind: 'field-to-trash',
          target: { side: 'opponent', min: 1, max: 1 },
        },
        ['defender'],
      ),
    ).toThrow()
  })
})

/**
 * 官方 Q&A：對手場上只有已裝載 BS3-115 的黑可可時，仍可使用 BS3-019
 * （付費、進棄牌區），但傷害與後續裝載整段皆不執行。
 */
describe('official ruling: BS3-019 with no legal target aborts Then equip', () => {
  it('pays cost and discards the item, but neither damages nor equips', () => {
    const hollyberry = asCookie('BS3-017')
    hollyberry.instanceId = 'hollyberry'
    const darkCacao = asCookie('BS3-100')
    darkCacao.instanceId = 'dark-cacao'
    const soulJam019 = convertOfficialCardToGameCard(findBs3Card('BS3-019'))
    if (soulJam019.status !== 'converted' || soulJam019.gameCard.type !== 'item') {
      throw new Error('BS3-019 should convert to an item')
    }
    const itemCard = {
      ...soulJam019.gameCard,
      instanceId: 'bs3-019-hand',
    } satisfies GameCard

    let state = createBattleState()
    state = {
      ...state,
      activePlayerId: 'player-two',
      phase: 'main',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            {
              card: darkCacao,
              hpCards: [
                item('dc-hp-a'),
                item('dc-hp-b'),
                item('dc-hp-c'),
              ],
              rested: false,
              battleEntryId: 'dark-cacao:battle:1',
              equippedCards: [
                { ...item('equipped-bs3-115'), id: 'BS3-115' } satisfies GameCard,
              ],
            },
          ],
        },
        'player-two': {
          ...state.players['player-two'],
          hand: [itemCard],
          battleArea: [
            {
              card: hollyberry,
              hpCards: [item('hb-hp-a'), item('hb-hp-b')],
              rested: false,
              battleEntryId: 'hollyberry:battle:2',
            },
          ],
          supportArea: [
            { card: item('pay-r1', 'red'), rested: false },
            { card: item('pay-r2', 'red'), rested: false },
            { card: item('pay-r3', 'red'), rested: false },
          ],
        },
      },
    }

    const beforeHp =
      state.players['player-one'].battleArea[0].hpCards.length

    state = applyGameCommand(state, {
      kind: 'play-item',
      playerId: 'player-two',
      instanceId: 'bs3-019-hand',
      paymentIds: ['pay-r1', 'pay-r2', 'pay-r3'],
      effectTargets: [[], []],
    })

    expect(
      state.players['player-two'].discardPile.some(
        (card) => card.instanceId === 'bs3-019-hand',
      ),
    ).toBe(true)
    expect(state.players['player-one'].battleArea[0].hpCards.length).toBe(
      beforeHp,
    )
    expect(
      state.players['player-two'].battleArea[0].equippedCards ?? [],
    ).toHaveLength(0)
    expect(state.pendingAbilityEffect).toBeUndefined()
  })

  it('still allows Then equip when the player voluntarily selects 0 of available targets', () => {
    const hollyberry = asCookie('BS3-017')
    hollyberry.instanceId = 'hollyberry'
    const legalTarget = asCookie('BS3-002')
    legalTarget.instanceId = 'legal-target'
    const soulJam019 = convertOfficialCardToGameCard(findBs3Card('BS3-019'))
    if (soulJam019.status !== 'converted' || soulJam019.gameCard.type !== 'item') {
      throw new Error('BS3-019 should convert to an item')
    }
    const itemCard = {
      ...soulJam019.gameCard,
      instanceId: 'bs3-019-hand',
    } satisfies GameCard

    let state = createBattleState()
    state = {
      ...state,
      activePlayerId: 'player-two',
      phase: 'main',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            {
              card: legalTarget,
              hpCards: [item('lt-hp-a'), item('lt-hp-b')],
              rested: false,
              battleEntryId: 'legal-target:battle:1',
            },
          ],
        },
        'player-two': {
          ...state.players['player-two'],
          hand: [itemCard],
          battleArea: [
            {
              card: hollyberry,
              hpCards: [item('hb-hp-a'), item('hb-hp-b')],
              rested: false,
              battleEntryId: 'hollyberry:battle:2',
            },
          ],
          supportArea: [
            { card: item('pay-r1', 'red'), rested: false },
            { card: item('pay-r2', 'red'), rested: false },
            { card: item('pay-r3', 'red'), rested: false },
          ],
        },
      },
    }

    state = applyGameCommand(state, {
      kind: 'play-item',
      playerId: 'player-two',
      instanceId: 'bs3-019-hand',
      paymentIds: ['pay-r1', 'pay-r2', 'pay-r3'],
      // 有合法目標但選擇 0 → 傷害略過，Then 裝載仍可執行
      effectTargets: [[], ['hollyberry']],
    })

    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    expect(
      state.players['player-two'].battleArea[0].equippedCards?.some(
        (card) => card.id === 'BS3-019',
      ),
    ).toBe(true)
  })
})
