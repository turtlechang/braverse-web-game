import { useState } from 'react'
import {
  ChevronRight,
  Eye,
  Layers3,
  Pause,
  RotateCcw,
  Swords,
  X,
} from 'lucide-react'
import './App.css'
import {
  advancePhase,
  attackCookie,
  canAttack,
  createDemoGame,
  deployCookie,
  getBreakAreaLevel,
  getRefreshCandidates,
  placeSupportCard,
  refreshDeck,
  replaceDefeatedCookie,
  type GameCard,
  type GameState,
  type PlayerId,
  type TurnPhase,
} from './game'

const phases: TurnPhase[] = ['active', 'draw', 'support', 'main', 'end']
const phaseLabels: Record<TurnPhase, string> = {
  active: '活躍階段',
  draw: '抽牌階段',
  support: '支援階段',
  main: '主要階段',
  end: '結束階段',
}
const nextPhaseLabels: Record<TurnPhase, string> = {
  active: '完成活躍',
  draw: '前往支援',
  support: '前往主要',
  main: '結束主要',
  end: '結束回合',
}

const opponentOf = (playerId: PlayerId): PlayerId =>
  playerId === 'player-one' ? 'player-two' : 'player-one'

interface CardFaceProps {
  card: GameCard
  className?: string
  concealed?: boolean
  rested?: boolean
  selected?: boolean
  onClick?: () => void
}

function CardFace({
  card,
  className = '',
  concealed = false,
  rested = false,
  selected = false,
  onClick,
}: CardFaceProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const content = concealed ? (
    <div className="card-back">
      <span>COOKIE RUN</span>
      <strong>BRAVERSE</strong>
    </div>
  ) : card.imageUrl && !imageFailed ? (
    <img
      src={card.imageUrl}
      alt={card.name}
      onError={() => setImageFailed(true)}
    />
  ) : (
    <div className="card-fallback">
      <span>{card.type.toUpperCase()}</span>
      <strong>{card.name}</strong>
      {card.type === 'cookie' && (
        <small>LV {card.level} · HP {card.hp}</small>
      )}
    </div>
  )

  if (!onClick) {
    return (
      <div
        className={`card-face ${className}${rested ? ' is-rested' : ''}${
          selected ? ' is-selected' : ''
        }`}
      >
        {content}
      </div>
    )
  }

  return (
    <button
      className={`card-face ${className}${rested ? ' is-rested' : ''}${
        selected ? ' is-selected' : ''
      }`}
      type="button"
      title={card.name}
      onClick={onClick}
    >
      {content}
    </button>
  )
}

interface BattleRowProps {
  game: GameState
  playerId: PlayerId
  position: 'top' | 'bottom'
  selectedAttackerId: string | null
  onSelectAttacker?: (instanceId: string) => void
  onAttackTarget?: (instanceId: string) => void
  onPlaceSupport?: (instanceId: string) => void
  onDeployCookie?: (instanceId: string) => void
  onInspectCard: (card: GameCard) => void
}

function BattleRow({
  game,
  playerId,
  position,
  selectedAttackerId,
  onSelectAttacker,
  onAttackTarget,
  onPlaceSupport,
  onDeployCookie,
  onInspectCard,
}: BattleRowProps) {
  const player = game.players[playerId]
  const isActivePlayer = game.activePlayerId === playerId
  const isOpponent = position === 'top'
  const canOperate = isActivePlayer && !isOpponent
  const supportZone = (
    <div className="support-zone">
      <span className="zone-watermark">支援區</span>
      <div className="support-cards">
        {player.supportArea.map((support) => (
          <CardFace
            card={support.card}
            className="support-card"
            rested={support.rested}
            key={support.card.instanceId}
            onClick={() => onInspectCard(support.card)}
          />
        ))}
        {player.supportArea.length === 0 && (
          <span className="empty-zone">尚未配置支援</span>
        )}
      </div>
    </div>
  )

  return (
    <section
      className={`battle-row ${position}-field`}
      aria-label={`${player.name}場地`}
    >
      <div className="break-zone">
        <div className="zone-heading">
          <span>休息區</span>
          <strong>LV. {getBreakAreaLevel(game, playerId)}</strong>
        </div>
        <div className="break-cards">
          {player.breakArea.map((card) => (
            <CardFace
              card={card}
              className="break-card"
              key={card.instanceId}
              onClick={() => onInspectCard(card)}
            />
          ))}
          {player.breakArea.length === 0 && (
            <small className="empty-zone">0 張</small>
          )}
        </div>
      </div>

      <div className="field-stack">
        {position === 'top' && supportZone}
        <div className="combat-zone">
          <div className="row-meta">
            <span>{isOpponent ? 'OPPONENT' : 'PLAYER'}</span>
            <strong>{player.name}</strong>
            <small>
              {isActivePlayer ? '行動中' : '等待'} · 手牌 {player.hand.length}
            </small>
          </div>
          <span className="zone-watermark">戰鬥區</span>
          <div className="combat-slots">
            {player.battleArea.map((cookie) => {
              const canSelectAttack =
                canOperate &&
                game.phase === 'main' &&
                canAttack(game) &&
                !cookie.rested &&
                player.supportArea.filter((support) => !support.rested)
                  .length >= cookie.card.attackCost
              const canTarget = isOpponent && Boolean(selectedAttackerId)

              return (
                <div className="combat-card-wrap" key={cookie.card.instanceId}>
                  <CardFace
                    card={cookie.card}
                    rested={cookie.rested}
                    selected={selectedAttackerId === cookie.card.instanceId}
                    onClick={
                      canTarget
                        ? () => onAttackTarget?.(cookie.card.instanceId)
                        : canSelectAttack
                          ? () => onSelectAttacker?.(cookie.card.instanceId)
                          : () => onInspectCard(cookie.card)
                    }
                  />
                  <div className="card-badges">
                    <span>HP {cookie.hpCards.length}/{cookie.card.hp}</span>
                    <span>ATK {cookie.card.attack}</span>
                  </div>
                  {canTarget && <span className="target-hint">攻擊目標</span>}
                </div>
              )
            })}
            {player.battleArea.length === 0 && (
              <span className="empty-zone">等待餅乾登場</span>
            )}
          </div>
        </div>
        {position === 'bottom' && supportZone}
      </div>

      <div className="utility-zones">
        <div className="deck-zone" aria-label={`牌庫 ${player.deck.length} 張`}>
          <div className="mini-deck" />
          <strong>{player.deck.length}</strong>
          <span>牌庫</span>
        </div>
        <div className="stage-zone">
          <span>場景區</span>
          {player.stage ? (
            <CardFace
              card={player.stage}
              className="stage-card"
              onClick={() => onInspectCard(player.stage!)}
            />
          ) : (
            <Layers3 aria-hidden="true" />
          )}
        </div>
        <div className="discard-zone">
          <span>棄牌區</span>
          <strong>{player.discardPile.length}</strong>
        </div>
      </div>

      <div
        className={`hand-fan ${position}-hand`}
        aria-label={`${isOpponent ? '對手' : '我方'}手牌`}
      >
        {player.hand.map((card, index) => {
          const canSupport =
            canOperate &&
            game.phase === 'support' &&
            !game.supportPlacedThisTurn
          const canDeploy =
            canOperate &&
            game.phase === 'main' &&
            card.type === 'cookie' &&
            player.battleArea.length < 2
          const offset = index - (player.hand.length - 1) / 2

          return (
            <div
              className="hand-card-wrap"
              key={card.instanceId}
              style={{
                '--fan-index': index,
                '--fan-offset': offset,
              } as React.CSSProperties}
            >
              <CardFace
                card={card}
                className="hand-card"
                concealed={isOpponent}
                onClick={
                  isOpponent ? undefined : () => onInspectCard(card)
                }
              />
              {(canSupport || canDeploy) && (
                <button
                  className="hand-card-action"
                  type="button"
                  onClick={() =>
                    canDeploy
                      ? onDeployCookie?.(card.instanceId)
                      : onPlaceSupport?.(card.instanceId)
                  }
                >
                  {canDeploy ? '登場' : '支援'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function App() {
  const [game, setGame] = useState(createDemoGame)
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(
    null,
  )
  const [message, setMessage] = useState('推進階段，開始這場對戰。')
  const [inspectedCard, setInspectedCard] = useState<GameCard | null>(null)
  const [showPause, setShowPause] = useState(false)
  const activePlayer = game.players[game.activePlayerId]
  const viewerPlayerId: PlayerId = 'player-one'
  const opponentId = opponentOf(viewerPlayerId)

  const runAction = (
    action: (current: GameState) => GameState,
    successMessage: string,
  ) => {
    try {
      setGame(action(game))
      setMessage(successMessage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '動作無法執行。')
    }
  }

  const handleAdvancePhase = () => {
    runAction(advancePhase, '階段已推進。')
    setSelectedAttackerId(null)
  }

  const handleAttackTarget = (targetInstanceId: string) => {
    if (!selectedAttackerId) return

    const attacker = activePlayer.battleArea.find(
      (cookie) => cookie.card.instanceId === selectedAttackerId,
    )
    const supportPaymentIds = activePlayer.supportArea
      .filter((support) => !support.rested)
      .slice(0, attacker?.card.attackCost ?? 0)
      .map((support) => support.card.instanceId)

    runAction(
      (current) =>
        attackCookie(
          current,
          selectedAttackerId,
          targetInstanceId,
          supportPaymentIds,
        ),
      `${attacker?.card.name ?? '餅乾'}完成攻擊。`,
    )
    setSelectedAttackerId(null)
  }

  const pendingPlayerId =
    game.pendingRefresh?.playerId ?? game.pendingReplacementPlayerId
  const pendingPlayer = pendingPlayerId
    ? game.players[pendingPlayerId]
    : null
  const pendingOptions = game.pendingRefresh
    ? getRefreshCandidates(game, game.pendingRefresh.playerId)
    : pendingPlayer?.hand.filter((card) => card.type === 'cookie') ?? []

  return (
    <main className="game-shell">
      <div className="board-texture" />

      <aside className="phase-rail" aria-label="回合階段">
        <div className="brand-mark">
          <span>COOKIE RUN</span>
          <strong>BRAVERSE</strong>
        </div>
        <ol>
          {phases.map((phase, index) => (
            <li
              className={game.phase === phase ? 'is-current' : ''}
              key={phase}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{phaseLabels[phase]}</strong>
            </li>
          ))}
        </ol>
        <button
          className="next-phase-button"
          type="button"
          onClick={handleAdvancePhase}
          disabled={
            game.status === 'finished' ||
            Boolean(game.pendingReplacementPlayerId) ||
            Boolean(game.pendingRefresh)
          }
        >
          <span>{nextPhaseLabels[game.phase]}</span>
          <ChevronRight aria-hidden="true" />
        </button>
        <span className="turn-counter">TURN {game.turnNumber}</span>
      </aside>

      <header className="match-toolbar">
        <div className="match-status">
          <span>{activePlayer.name}的回合</span>
          <strong>{phaseLabels[game.phase]}</strong>
          <small>{message}</small>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            title="重新開始"
            onClick={() => {
              setGame(createDemoGame())
              setSelectedAttackerId(null)
              setMessage('已建立新的 Starter Deck RED 範例對局。')
            }}
          >
            <RotateCcw aria-hidden="true" />
          </button>
          <button
            type="button"
            title="暫停資訊"
            onClick={() => setShowPause(true)}
          >
            <Pause aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="table-area" aria-label="Braverse 對戰桌">
        <BattleRow
          game={game}
          playerId={opponentId}
          position="top"
          selectedAttackerId={selectedAttackerId}
          onAttackTarget={handleAttackTarget}
          onInspectCard={setInspectedCard}
        />

        <div className="table-divider">
          <span />
          <strong>
            {selectedAttackerId ? (
              <>
                <Swords aria-hidden="true" /> 選擇攻擊目標
              </>
            ) : (
              `${activePlayer.name} · ${phaseLabels[game.phase]}`
            )}
          </strong>
          <span />
        </div>

        <BattleRow
          game={game}
          playerId={viewerPlayerId}
          position="bottom"
          selectedAttackerId={selectedAttackerId}
          onSelectAttacker={(instanceId) => {
            setSelectedAttackerId(instanceId)
            setMessage('選擇對手戰鬥區中的攻擊目標。')
          }}
          onPlaceSupport={(instanceId) =>
            runAction(
              (current) => placeSupportCard(current, instanceId),
              '已將卡牌配置到支援區。',
            )
          }
          onDeployCookie={(instanceId) =>
            runAction(
              (current) => deployCookie(current, instanceId),
              '新餅乾已登場並配置 HP。',
            )
          }
          onInspectCard={setInspectedCard}
        />
      </section>

      <button
        className="inspect-hand-button"
        type="button"
        onClick={() =>
          setInspectedCard(game.players[viewerPlayerId].hand[0] ?? null)
        }
      >
        <Eye aria-hidden="true" />
        <span>查看卡牌</span>
      </button>

      {pendingPlayer && (
        <div className="modal-backdrop" role="presentation">
          <section className="decision-modal" role="alertdialog">
            <div className="modal-title">
              {game.pendingRefresh ? '牌庫 Refresh' : '放置餅乾'}
            </div>
            <div className="modal-body">
              <strong>
                {game.pendingRefresh
                  ? `${pendingPlayer.name}必須選擇一張餅乾放入休息區`
                  : `${pendingPlayer.name}必須在戰鬥區放置新餅乾`}
              </strong>
              <div className="modal-card-options">
                {pendingOptions.map((card) => (
                  <button
                    type="button"
                    key={card.instanceId}
                    disabled={
                      !game.pendingRefresh &&
                      card.type === 'cookie' &&
                      pendingPlayer.deck.length < card.hp
                    }
                    onClick={() => {
                      if (game.pendingRefresh) {
                        runAction(
                          (current) =>
                            refreshDeck(
                              current,
                              pendingPlayer.id,
                              card.instanceId,
                            ),
                          '牌庫 Refresh 已完成。',
                        )
                      } else {
                        runAction(
                          (current) =>
                            replaceDefeatedCookie(current, card.instanceId),
                          '已補充新的戰鬥區餅乾。',
                        )
                      }
                    }}
                  >
                    <CardFace card={card} />
                    <span>{card.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {inspectedCard && (
        <div className="modal-backdrop" role="presentation">
          <section className="card-detail-modal" role="dialog">
            <button
              className="close-modal"
              type="button"
              title="關閉"
              onClick={() => setInspectedCard(null)}
            >
              <X aria-hidden="true" />
            </button>
            <CardFace card={inspectedCard} className="detail-card" />
            <div>
              <span>{inspectedCard.id}</span>
              <h2>{inspectedCard.name}</h2>
              <p>
                {inspectedCard.type === 'cookie'
                  ? `LV ${inspectedCard.level} · HP ${inspectedCard.hp} · 攻擊 ${inspectedCard.attack} · 費用 ${inspectedCard.attackCost}`
                  : `卡牌類型：${inspectedCard.type.toUpperCase()}`}
              </p>
            </div>
          </section>
        </div>
      )}

      {showPause && (
        <div className="modal-backdrop" role="presentation">
          <section className="pause-modal" role="dialog">
            <Pause aria-hidden="true" />
            <span>對戰資訊</span>
            <h2>遊戲已暫停</h2>
            <p>目前為第 {game.turnNumber} 回合，{phaseLabels[game.phase]}。</p>
            <button type="button" onClick={() => setShowPause(false)}>
              繼續對戰
            </button>
          </section>
        </div>
      )}

      {game.result && (
        <div className="modal-backdrop result-backdrop" role="presentation">
          <section className="result-modal" role="alertdialog">
            <span>對局結束</span>
            <h2>{game.players[game.result.winnerId].name}勝利</h2>
            <p>
              {game.result.reason === 'break-level-limit'
                ? '對手休息區等級達到 10。'
                : game.result.reason === 'refresh-unavailable'
                  ? '對手無法完成牌庫 Refresh。'
                  : '對手沒有可登場的餅乾。'}
            </p>
            <button
              type="button"
              onClick={() => {
                setGame(createDemoGame())
                setSelectedAttackerId(null)
              }}
            >
              再來一局
            </button>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
