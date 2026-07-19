import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  createItemUsageDemoState,
  createStageUsageDemoState,
} from '../../game/demo'
import type { GameState, PendingBattle } from '../../game'
import { BattleRow, type BattleRowProps } from './BattleRow'
import { computeOpponentFan, CARD_W, CARD_H } from './opponentFan'

const createProps = (
  overrides: Record<string, unknown> = {},
): BattleRowProps => {
  const game = createItemUsageDemoState(true)

  return {
    game,
    playerId: 'player-one',
    position: 'bottom',
    selectedAttackerId: null,
    effectTargetIds: new Set(),
    breakEffectTargetIds: new Set(),
    selectedEffectTargetIds: new Set(),
    selectedSkillPaymentIds: new Set(),
    skillPaymentTargetIds: new Set(),
    selectedAttackPaymentIds: new Set(),
    attackPaymentValid: false,
    interactionLocked: false,
    onPlaceSupport: () => undefined,
    onDeployCookie: () => undefined,
    onPlayItem: () => undefined,
    onPlayStage: () => undefined,
    onInspectCard: () => undefined,
    onInspectDiscard: () => undefined,
    ...overrides,
  } as BattleRowProps
}

describe('opponent hand fan pure functions', () => {
  it('count=1: angle=0, safetyInset=2, safetyRatio=0, fanZIndex=0, arcSpan=0', () => {
    const r = computeOpponentFan(1, 0)
    expect(r.opponentAngle).toBe(0)
    expect(r.safetyInset).toBe(2)
    expect(r.safetyRatio).toBe(0)
    expect(r.fanZIndex).toBe(0)
    expect(r.arcSpan).toBe(0)
  })

  it('symmetric angles ±25° for count=3', () => {
    const r0 = computeOpponentFan(3, 0)
    const r1 = computeOpponentFan(3, 1)
    const r2 = computeOpponentFan(3, 2)
    expect(r0.opponentAngle).toBeCloseTo(-25, 0)
    expect(r2.opponentAngle).toBeCloseTo(25, 0)
    expect(r1.opponentAngle).toBe(0)
  })

  it('count=2: arcSpan=50, maxAngle=25, opponentAngle=-25', () => {
    const r0 = computeOpponentFan(2, 0)
    expect(r0.arcSpan).toBe(50)
    expect(r0.maxAngle).toBe(25)
    expect(r0.opponentAngle).toBeCloseTo(-25, 0)
  })

  it('count=5: maxAngle=25, leftOverhang≈61', () => {
    const r = computeOpponentFan(5, 0)
    expect(r.maxAngle).toBe(25)
    expect(r.leftOverhang).toBeCloseTo(61, 0)
    expect(r.safetyInset).toBeCloseTo(63, 0)
  })

  it('fanZIndex monotonically decreases with index (index 0 highest, last index 0)', () => {
    for (const count of [2, 3, 4, 5, 6, 7, 10]) {
      const values = Array.from({ length: count }, (_, i) =>
        computeOpponentFan(count, i).fanZIndex,
      )
      expect(values[0]).toBe(count - 1)
      for (let i = 1; i < count; i++) {
        expect(values[i]).toBeLessThan(values[i - 1])
      }
      expect(values[count - 1]).toBe(0)
    }
  })

  it('fanZIndex=0 for count=1', () => {
    expect(computeOpponentFan(1, 0).fanZIndex).toBe(0)
  })

  it('interface no longer exposes handOffsetFraction, fanTrackRatio, arcYRatio', () => {
    const r = computeOpponentFan(3, 1)
    expect((r as unknown as Record<string, unknown>).handOffsetFraction).toBeUndefined()
    expect((r as unknown as Record<string, unknown>).fanTrackRatio).toBeUndefined()
    expect((r as unknown as Record<string, unknown>).arcYRatio).toBeUndefined()
  })

  it('CARD_W=112, CARD_H=156', () => {
    expect(CARD_W).toBe(112)
    expect(CARD_H).toBe(156)
  })
})

describe('BattleRow desktop interactions', () => {
  it('highlights an opponent attack preview and rests its selected support', () => {
    const game = createItemUsageDemoState(true)
    const player = game.players['player-one']
    const attackerId = player.battleArea[0].card.instanceId
    const supportId = player.supportArea[0].card.instanceId
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game,
          playerId: 'player-one',
          position: 'top',
          selectedAttackerId: attackerId,
          selectedAttackPaymentIds: new Set([supportId]),
          interactionLocked: true,
        })}
      />,
    )

    expect(markup).toContain('card-face support-card is-rested is-selected')
    expect(markup).toContain('card-face  is-selected')
  })

  it('keeps legal hand actions hidden until the card is selected', () => {
    const markup = renderToStaticMarkup(
      <BattleRow {...createProps()} />,
    )

    expect(markup).not.toContain('hand-card-actions')
    expect(markup).not.toContain('>使用<')
  })

  it('shows one contextual hand action for the selected card', () => {
    const game = createItemUsageDemoState(true)
    const selectedCardId = game.players['player-one'].hand[0].instanceId
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game,
          selectedHandCardId: selectedCardId,
          onSelectHandCard: () => undefined,
        })}
      />,
    )

    expect(markup).toContain('hand-card-wrap is-selected')
    expect(markup).toContain('hand-card-actions')
    expect(markup).toContain('>使用<')
    expect(markup).toContain('>詳情<')
  })

  it('renders compact resource summaries and an anchored resource popover', () => {
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          openResourceKind: 'deck',
          onToggleResource: () => undefined,
        })}
      />,
    )

    expect(markup).toContain('resource-summary')
    expect(markup).toContain('resource-popover')
    expect(markup).toContain('牌庫剩餘')
  })

  it('renders scan-friendly active status and resource stats', () => {
    const baseGame = createItemUsageDemoState(true)
    const sampleCard = baseGame.players['player-one'].hand[0]
    const game = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          deck: [sampleCard, sampleCard],
          discardPile: [sampleCard],
        },
      },
    }
    const markup = renderToStaticMarkup(<BattleRow {...createProps({ game })} />)

    expect(markup).toContain('row-status" data-active="true"')
    expect(markup).toContain('row-stat-status is-active')
    expect(markup).toContain('aria-label="手牌 1"')
    expect(markup).toContain('aria-label="玩家牌庫 2 張"')
    expect(markup).toContain('title="棄牌區 1 張"')
  })

  it('renders waiting status and stats for an inactive row', () => {
    const baseGame = createItemUsageDemoState(true)
    const sampleCard = baseGame.players['player-one'].hand[0]
    const game = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-two': {
          ...baseGame.players['player-two'],
          hand: [sampleCard, sampleCard],
          deck: [sampleCard],
          discardPile: [sampleCard, sampleCard, sampleCard],
        },
      },
    }
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game,
          playerId: 'player-two',
          position: 'top',
        })}
      />,
    )

    expect(markup).toContain('row-status" data-active="false"')
    expect(markup).toContain('row-stat-status is-waiting')
    expect(markup).toContain('aria-label="手牌 2"')
    expect(markup).toContain('aria-label="AI 對手牌庫 1 張"')
    expect(markup).toContain('title="棄牌區 3 張"')
  })

  it('does not offer an item action when the payment is unavailable', () => {
    const game = {
      ...createItemUsageDemoState(false),
      phase: 'main' as const,
    }
    const selectedCardId = game.players['player-one'].hand[0].instanceId
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game,
          selectedHandCardId: selectedCardId,
          onSelectHandCard: () => undefined,
        })}
      />,
    )

    expect(markup).not.toContain('hand-card-actions')
    expect(markup).not.toContain('>使用<')
  })

  it('does not offer a stage action when the placement payment is unavailable', () => {
    const payableState = createStageUsageDemoState(true)
    const game = {
      ...payableState,
      players: {
        ...payableState.players,
        'player-one': {
          ...payableState.players['player-one'],
          supportArea: [],
        },
      },
    }
    const selectedCardId = game.players['player-one'].hand[0].instanceId
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game,
          selectedHandCardId: selectedCardId,
          onSelectHandCard: () => undefined,
        })}
      />,
    )

    expect(markup).not.toContain('hand-card-actions')
    expect(markup).not.toContain('>放置<')
  })

  it('marks support cards as selectable for a support-to-trash skill cost', () => {
    const game = createItemUsageDemoState(true)
    const supportId =
      game.players['player-one'].supportArea[0].card.instanceId
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game,
          skillCostSupportTargetIds: new Set([supportId]),
          selectedSkillCostSupportIds: new Set([supportId]),
          onSkillCostSupport: () => undefined,
        })}
      />,
    )

    expect(markup).toContain('support-card is-selected is-targetable')
    expect(markup).toContain('aria-label="選擇')
  })

  it('distinguishes energy payment from support-to-trash targets', () => {
    const baseGame = createItemUsageDemoState(true)
    const firstSupport =
      baseGame.players['player-one'].supportArea[0]
    const secondSupport = {
      ...firstSupport,
      card: {
        ...firstSupport.card,
        instanceId: `${firstSupport.card.instanceId}-cost`,
        name: '技能代價支援卡',
      },
    }
    const game = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          supportArea: [firstSupport, secondSupport],
        },
      },
    }
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game,
          interactionLocked: true,
          skillPaymentTargetIds: new Set([
            firstSupport.card.instanceId,
          ]),
          skillCostSupportTargetIds: new Set([
            secondSupport.card.instanceId,
          ]),
          onSkillPayment: () => undefined,
          onSkillCostSupport: () => undefined,
        })}
      />,
    )

    expect(markup).toContain('支付技能能量')
    expect(markup).toContain('作為技能代價')
  })

  it('renders opponent hand cards in field-stack with opponent-hand-card class, concealed, no is-selected', () => {
    const game = createItemUsageDemoState(true)
    const opponentHand = Array.from({ length: 3 }, (_, i) => ({
      id: `opp-${i}`,
      instanceId: `opp-${i}`,
      name: `對手牌${i}`,
      type: 'cookie' as const,
      hp: 3,
      attack: 2,
      speed: 1,
      energyCost: { red: 1 },
      skill: undefined,
    }))
    const gameWithOppHand = {
      ...game,
      players: {
        ...game.players,
        'player-two': {
          ...game.players['player-two'],
          hand: opponentHand,
        },
      },
    }
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game: gameWithOppHand,
          playerId: 'player-two',
          position: 'top',
        })}
      />,
    )
    expect(markup).toContain('opponent-hand-card')
    expect(markup).toContain('card-back.png')
    const topHandArea = markup.match(/hand-fan top-hand[\s\S]*?(?=<\/section>)/)
    expect(topHandArea).not.toBeNull()
    expect(topHandArea![0]).not.toContain('is-selected')
    expect(topHandArea![0]).not.toContain('hand-card-actions')
  })

  it('opponent hand section never emits is-selected class', () => {
    const game = createItemUsageDemoState(true)
    const opponentHand = Array.from({ length: 2 }, (_, i) => ({
      id: `opp-${i}`,
      instanceId: `opp-${i}`,
      name: `對手牌${i}`,
      type: 'cookie' as const,
      hp: 3,
      attack: 2,
      speed: 1,
      energyCost: { red: 1 },
      skill: undefined,
    }))
    const gameWithOppHand = {
      ...game,
      players: {
        ...game.players,
        'player-two': {
          ...game.players['player-two'],
          hand: opponentHand,
        },
      },
    }
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game: gameWithOppHand,
          playerId: 'player-two',
          position: 'top',
          selectedHandCardId: opponentHand[0].instanceId,
        })}
      />,
    )
    const topHandArea = markup.match(/hand-fan top-hand[\s\S]*?(?=<\/section>)/)
    expect(topHandArea).not.toBeNull()
    expect(topHandArea![0]).not.toContain('is-selected')
  })

  it('sets --safety-ratio on .hand-fan.top-hand container (fanTrackRatio removed)', () => {
    const game = createItemUsageDemoState(true)
    const opponentHand = Array.from({ length: 3 }, (_, i) => ({
      id: `opp-${i}`,
      instanceId: `opp-${i}`,
      name: `對手牌${i}`,
      type: 'cookie' as const,
      hp: 3,
      attack: 2,
      speed: 1,
      energyCost: { red: 1 },
      skill: undefined,
    }))
    const gameWithOppHand = {
      ...game,
      players: {
        ...game.players,
        'player-two': {
          ...game.players['player-two'],
          hand: opponentHand,
        },
      },
    }
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game: gameWithOppHand,
          playerId: 'player-two',
          position: 'top',
        })}
      />,
    )
    expect(markup).toContain('--safety-ratio')
    expect(markup).not.toContain('--fan-track-ratio')
    expect(markup).not.toContain('--hand-offset-fraction')
    expect(markup).not.toContain('--arc-y-ratio')
  })

  it('renders .single-card class when opponent has exactly 1 hand card', () => {
    const game = createItemUsageDemoState(true)
    const singleCard = [{
      id: 'opp-single',
      instanceId: 'opp-single',
      name: '單張',
      type: 'cookie' as const,
      hp: 3,
      attack: 2,
      speed: 1,
      energyCost: { red: 1 },
      skill: undefined,
    }]
    const gameWithOppHand = {
      ...game,
      players: {
        ...game.players,
        'player-two': {
          ...game.players['player-two'],
          hand: singleCard,
        },
      },
    }
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game: gameWithOppHand,
          playerId: 'player-two',
          position: 'top',
        })}
      />,
    )
    expect(markup).toContain('single-card')
  })

  it('renders no top-hand div when opponent has 0 hand cards', () => {
    const game = createItemUsageDemoState(true)
    const gameWithEmptyHand = {
      ...game,
      players: {
        ...game.players,
        'player-two': {
          ...game.players['player-two'],
          hand: [],
        },
      },
    }
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game: gameWithEmptyHand,
          playerId: 'player-two',
          position: 'top',
        })}
      />,
    )
    expect(markup).not.toContain('class="hand-fan top-hand"')
  })

  it('top-hand is rendered inside .field-stack as child element', () => {
    const game = createItemUsageDemoState(true)
    const opponentHand = Array.from({ length: 2 }, (_, i) => ({
      id: `opp-${i}`,
      instanceId: `opp-${i}`,
      name: `對手牌${i}`,
      type: 'cookie' as const,
      hp: 3,
      attack: 2,
      speed: 1,
      energyCost: { red: 1 },
      skill: undefined,
    }))
    const gameWithOppHand = {
      ...game,
      players: {
        ...game.players,
        'player-two': {
          ...game.players['player-two'],
          hand: opponentHand,
        },
      },
    }
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game: gameWithOppHand,
          playerId: 'player-two',
          position: 'top',
        })}
      />,
    )
    const fieldStackOpen = markup.indexOf('<div class="field-stack"')
    const utilityZonesOpen = markup.indexOf('<div class="utility-zones"')
    expect(fieldStackOpen).toBeGreaterThan(-1)
    expect(utilityZonesOpen).toBeGreaterThan(-1)
    const fieldStackContent = markup.slice(fieldStackOpen, utilityZonesOpen)
    expect(fieldStackContent).toContain('top-hand')
  })

  it('renders opponent hand CardFace with opponent-oriented-card class for 180deg rotation', () => {
    const game = createItemUsageDemoState(true)
    const opponentHand = Array.from({ length: 3 }, (_, i) => ({
      id: `opp-${i}`,
      instanceId: `opp-${i}`,
      name: `對手牌${i}`,
      type: 'cookie' as const,
      hp: 3,
      attack: 2,
      speed: 1,
      energyCost: { red: 1 },
      skill: undefined,
    }))
    const gameWithOppHand = {
      ...game,
      players: {
        ...game.players,
        'player-two': {
          ...game.players['player-two'],
          hand: opponentHand,
        },
      },
    }
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game: gameWithOppHand,
          playerId: 'player-two',
          position: 'top',
        })}
      />,
    )
    expect(markup).toContain('opponent-oriented-card')
  })

  it('opponent hand cards set --opponent-angle and --fan-z-index custom properties, no obsolete vars', () => {
    const game = createItemUsageDemoState(true)
    const opponentHand = Array.from({ length: 3 }, (_, i) => ({
      id: `opp-${i}`,
      instanceId: `opp-${i}`,
      name: `對手牌${i}`,
      type: 'cookie' as const,
      hp: 3,
      attack: 2,
      speed: 1,
      energyCost: { red: 1 },
      skill: undefined,
    }))
    const gameWithOppHand = {
      ...game,
      players: {
        ...game.players,
        'player-two': {
          ...game.players['player-two'],
          hand: opponentHand,
        },
      },
    }
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game: gameWithOppHand,
          playerId: 'player-two',
          position: 'top',
        })}
      />,
    )
    expect(markup).toContain('--opponent-angle')
    expect(markup).toContain('--fan-z-index')
    expect(markup).not.toContain('--hand-offset-fraction')
    expect(markup).not.toContain('--arc-y-ratio')
  })

  it('opponent hand fanZIndex renders decreasing values in markup (index 0 highest)', () => {
    const game = createItemUsageDemoState(true)
    const opponentHand = Array.from({ length: 6 }, (_, i) => ({
      id: `opp-${i}`,
      instanceId: `opp-${i}`,
      name: `對手牌${i}`,
      type: 'cookie' as const,
      hp: 3,
      attack: 2,
      speed: 1,
      energyCost: { red: 1 },
      skill: undefined,
    }))
    const gameWithOppHand = {
      ...game,
      players: {
        ...game.players,
        'player-two': {
          ...game.players['player-two'],
          hand: opponentHand,
        },
      },
    }
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game: gameWithOppHand,
          playerId: 'player-two',
          position: 'top',
        })}
      />,
    )
    // fanZIndex values: index 0 → 5, index 1 → 4, ..., index 5 → 0
    const zIndexMatches = markup.match(/--fan-z-index:\s*(\d+)/g)
    expect(zIndexMatches).not.toBeNull()
    const values = zIndexMatches!.map((m) => parseInt((m.match(/\d+/) ?? ['0'])[0], 10))
    expect(values).toHaveLength(6)
    expect(values[0]).toBe(5)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThan(values[i - 1])
    }
    expect(values[values.length - 1]).toBe(0)
  })

  it('opponent hand wrappers do NOT set conflicting inline left/top/transform-origin (CSS contract)', () => {
    const game = createItemUsageDemoState(true)
    const opponentHand = Array.from({ length: 3 }, (_, i) => ({
      id: `opp-${i}`,
      instanceId: `opp-${i}`,
      name: `對手牌${i}`,
      type: 'cookie' as const,
      hp: 3,
      attack: 2,
      speed: 1,
      energyCost: { red: 1 },
      skill: undefined,
    }))
    const gameWithOppHand = {
      ...game,
      players: {
        ...game.players,
        'player-two': {
          ...game.players['player-two'],
          hand: opponentHand,
        },
      },
    }
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game: gameWithOppHand,
          playerId: 'player-two',
          position: 'top',
        })}
      />,
    )
    // Each opponent-hand-card wrapper should be a div with hand-card-wrap opponent-hand-card class
    // Extract style blocks of opponent-hand-card wrappers
    const cardDivs = markup.match(/<div class="hand-card-wrap opponent-hand-card[^"]*" style="[^"]*--opponent-angle[^"]*"/g)
    expect(cardDivs).not.toBeNull()
    for (const div of cardDivs!) {
      // Should NOT contain inline left:, top:, bottom:, or transform-origin:
      expect(div).not.toMatch(/\bleft\s*:/)
      expect(div).not.toMatch(/\btop\s*:/)
      expect(div).not.toMatch(/\bbottom\s*:/)
      expect(div).not.toMatch(/\btransform-origin\s*:/)
    }
  })
})

describe('HP flip chain reveal indicator', () => {
  const revealedCard = {
    id: 'revealed-hp',
    instanceId: 'revealed-hp',
    name: 'Revealed HP Card',
    type: 'item' as const,
  }

  const flipRevealedCard = {
    ...revealedCard,
    id: 'revealed-hp-flip',
    instanceId: 'revealed-hp-flip',
    flip: { text: 'FLIP effect', cost: {}, effects: [] },
  }

  const withPendingBattle = (
    game: GameState,
    overrides: Partial<PendingBattle>,
  ): GameState =>
    ({
      ...game,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: 'p2-cookie',
        targetInstanceId: 'p1-cookie',
        declaredDamage: 1,
        remainingDamage: 0,
        stage: 'damage',
        trapUsed: false,
        revealedHpCard: revealedCard,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
        ...overrides,
      },
    }) as GameState

  it('shows the revealed HP card face-up while stage is damage', () => {
    const game = withPendingBattle(createItemUsageDemoState(true), {})
    const markup = renderToStaticMarkup(
      <BattleRow {...createProps({ game, playerId: 'player-one', position: 'bottom' })} />,
    )
    expect(markup).toContain('hp-reveal-indicator')
    expect(markup).not.toContain('hp-reveal-flip-badge')
  })

  it('shows a FLIP badge when the revealed card has a flip ability', () => {
    const game = withPendingBattle(createItemUsageDemoState(true), {
      stage: 'flip',
      revealedHpCard: flipRevealedCard,
    })
    const markup = renderToStaticMarkup(
      <BattleRow {...createProps({ game, playerId: 'player-one', position: 'bottom' })} />,
    )
    expect(markup).toContain('hp-reveal-indicator')
    expect(markup).toContain('hp-reveal-flip-badge')
  })

  it('does not show the indicator for a cookie that is not the damage target', () => {
    const game = withPendingBattle(createItemUsageDemoState(true), {
      targetInstanceId: 'p2-cookie',
      damageTargetInstanceId: 'p2-cookie',
    })
    const markup = renderToStaticMarkup(
      <BattleRow {...createProps({ game, playerId: 'player-one', position: 'bottom' })} />,
    )
    expect(markup).not.toContain('hp-reveal-indicator')
  })

  it('does not show the indicator outside damage/flip stages', () => {
    const game = withPendingBattle(createItemUsageDemoState(true), {
      stage: 'trap',
    })
    const markup = renderToStaticMarkup(
      <BattleRow {...createProps({ game, playerId: 'player-one', position: 'bottom' })} />,
    )
    expect(markup).not.toContain('hp-reveal-indicator')
  })

  it('does not show the indicator when there is no pending battle', () => {
    const game = createItemUsageDemoState(true)
    const markup = renderToStaticMarkup(
      <BattleRow {...createProps({ game, playerId: 'player-one', position: 'bottom' })} />,
    )
    expect(markup).not.toContain('hp-reveal-indicator')
  })
})
