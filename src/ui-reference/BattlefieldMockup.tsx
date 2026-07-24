/**
 * 實機版面同步的戰場 mockup。
 *
 * 不另行複製戰鬥區的 grid、卡槽或 HP／技能提示定位；直接渲染正式
 * BattleTable、BattleRow 與 PhaseRail，使 /?mockup=battlefield 能作為
 * 版面評估而非另一套會漂移的示意畫面。
 */
import { useMemo, useState } from 'react'
import {
  createBlueOptionalCostAttackDemoState,
  type CookieCard,
  type GameCard,
  type GameState,
  type PlayerState,
} from '../game'
import { BattleTable } from '../components/battle/BattleTable'
import type { BattleRowProps } from '../components/battle/BattleRow'
import { PhaseRail } from '../components/layout/PhaseRail'
import './BattlefieldMockup.css'

const emptyIds = new Set<string>()

const isCookie = (card: GameCard): card is CookieCard => card.type === 'cookie'

function enrichMockupPlayer(
  player: PlayerState,
  battleEntryId: string,
): PlayerState {
  const extraCookie = player.deck.find(isCookie)
  const supportCards = player.deck
    .filter((card) => !isCookie(card))
    .slice(0, 3)
  const usedIds = new Set([
    ...supportCards.map((card) => card.instanceId),
    ...(extraCookie ? [extraCookie.instanceId] : []),
  ])

  return {
    ...player,
    deck: player.deck.filter((card) => !usedIds.has(card.instanceId)),
    battleArea: extraCookie
      ? [
          ...player.battleArea,
          {
            card: extraCookie,
            hpCards: [],
            rested: false,
            battleEntryId,
          },
        ]
      : player.battleArea,
    supportArea: supportCards.map((card, index) => ({
      card,
      rested: player.id === 'player-two' && index === supportCards.length - 1,
    })),
  }
}

function createBattlefieldMockupGame(): GameState {
  const base = createBlueOptionalCostAttackDemoState(true)

  return {
    ...base,
    players: {
      'player-one': enrichMockupPlayer(
        base.players['player-one'],
        'mock-player-one:2',
      ),
      'player-two': enrichMockupPlayer(
        base.players['player-two'],
        'mock-player-two:2',
      ),
    },
    nextBattleEntrySequence: 5,
  }
}

/** dev server 開 /?mockup=battlefield。 */
export function BattlefieldMockup() {
  const game = useMemo(() => createBattlefieldMockupGame(), [])
  const [previewCard, setPreviewCard] = useState<GameCard | null>(null)
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(
    null,
  )

  const rowProps = (
    playerId: 'player-one' | 'player-two',
    position: 'top' | 'bottom',
  ): BattleRowProps => ({
    game,
    playerId,
    position,
    selectedAttackerId,
    attackTargetingActive: Boolean(selectedAttackerId),
    effectTargetIds: emptyIds,
    breakEffectTargetIds: emptyIds,
    selectedEffectTargetIds: emptyIds,
    selectedSkillPaymentIds: emptyIds,
    selectedAttackPaymentIds: emptyIds,
    attackPaymentValid: true,
    interactionLocked: false,
    onSelectAttacker:
      position === 'bottom' ? setSelectedAttackerId : undefined,
    onAttackTarget: () => setSelectedAttackerId(null),
    onActivateSkill: (instanceId) => {
      const card = game.players[playerId].battleArea.find(
        (cookie) => cookie.card.instanceId === instanceId,
      )?.card
      setPreviewCard(card ?? null)
    },
    onInspectCard: setPreviewCard,
    onInspectDiscard: () => undefined,
    onHoverCard: setPreviewCard,
    onFocusCard: setPreviewCard,
    onToggleResource: () => undefined,
  })

  return (
    <main
      className="game-shell mock-bf-root"
      data-attention-state="player-turn"
    >
      <div className="board-texture" />
      <BattleTable
        ariaLabel="Braverse 戰場 mockup（實機版面同步）"
        topBattleRow={rowProps('player-two', 'top')}
        bottomBattleRow={rowProps('player-one', 'bottom')}
        attackPreviewArrow={{
          sourceInstanceId: selectedAttackerId,
          targetInstanceIds: selectedAttackerId
            ? game.players['player-two'].battleArea.map(
                (cookie) => cookie.card.instanceId,
              )
            : [],
          label: '攻擊目標',
        }}
        previewCard={previewCard}
        previewContextLabel={previewCard ? '卡牌預覽' : undefined}
        onDismissPreview={() => setPreviewCard(null)}
        attackPaymentPanel={null}
      />
      <PhaseRail
        phase={game.phase}
        turnNumber={game.turnNumber}
        isPlayerTurn
        disabled
        onAdvance={() => undefined}
      />
      <p className="mock-bf-caption">
        實機版面同步檢視：點選我方可攻擊餅乾可查看攻擊目標配置。
      </p>
    </main>
  )
}
