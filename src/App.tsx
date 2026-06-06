import { useState } from 'react'
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
  type GameState,
  type PlayerId,
  type TurnPhase,
} from './game'

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

interface PlayerBoardProps {
  game: GameState
  playerId: PlayerId
  concealed?: boolean
  selectedAttackerId: string | null
  onSelectAttacker?: (instanceId: string) => void
  onAttackTarget?: (instanceId: string) => void
  onPlaceSupport?: (instanceId: string) => void
  onDeployCookie?: (instanceId: string) => void
}

function PlayerBoard({
  game,
  playerId,
  concealed = false,
  selectedAttackerId,
  onSelectAttacker,
  onAttackTarget,
  onPlaceSupport,
  onDeployCookie,
}: PlayerBoardProps) {
  const player = game.players[playerId]
  const isActive = game.activePlayerId === playerId
  const isPlaying = game.status === 'playing'

  return (
    <section
      className={`player-board${isActive ? ' is-active' : ''}`}
      aria-label={`${player.name}遊戲區`}
    >
      <header className="player-header">
        <div>
          <span className="player-label">{concealed ? '對手' : '我方'}</span>
          <h2>{player.name}</h2>
        </div>
        <div className="player-stats">
          <span>牌庫 {player.deck.length}</span>
          <span>手牌 {player.hand.length}</span>
          <strong>休息區 LV {getBreakAreaLevel(game, playerId)} / 10</strong>
        </div>
      </header>

      <div className="board-zones">
        <div className="board-zone battle-zone">
          <span className="zone-title">戰鬥區</span>
          <div className="card-row">
            {player.battleArea.map((cookie) => (
              <article
                className={`game-card cookie-card${
                  selectedAttackerId === cookie.card.instanceId
                    ? ' is-selected'
                    : ''
                }`}
                key={cookie.card.instanceId}
              >
                <div className="card-level">LV {cookie.card.level}</div>
                <strong>{cookie.card.name}</strong>
                <span>HP {cookie.hpCards.length} / {cookie.card.hp}</span>
                <span>攻擊 {cookie.card.attack}</span>
                <span>費用 {cookie.card.attackCost}</span>
                <small>{cookie.rested ? '休息' : '活躍'}</small>
                {!concealed &&
                  isPlaying &&
                  game.phase === 'main' &&
                  canAttack(game) &&
                  player.supportArea.filter((support) => !support.rested)
                    .length >= cookie.card.attackCost &&
                  !cookie.rested && (
                    <button
                      className="card-action"
                      type="button"
                      onClick={() =>
                        onSelectAttacker?.(cookie.card.instanceId)
                      }
                    >
                      {selectedAttackerId === cookie.card.instanceId
                        ? '已選擇'
                        : '選擇攻擊'}
                    </button>
                  )}
                {concealed && selectedAttackerId && isPlaying && (
                  <button
                    className="card-action danger-action"
                    type="button"
                    onClick={() => onAttackTarget?.(cookie.card.instanceId)}
                  >
                    攻擊此餅乾
                  </button>
                )}
              </article>
            ))}
            {player.battleArea.length === 0 && (
              <span className="empty-zone">沒有餅乾</span>
            )}
          </div>
        </div>

        <div className="board-zone support-zone">
          <span className="zone-title">支援區</span>
          <strong>{player.supportArea.length} 張</strong>
          <div className="support-list">
            {player.supportArea.map((support) => (
              <span
                className={support.rested ? 'is-rested' : ''}
                key={support.card.instanceId}
              >
                {support.card.name} · {support.rested ? '休息' : '活躍'}
              </span>
            ))}
          </div>
        </div>

        <div className="board-zone break-zone">
          <span className="zone-title">休息區</span>
          <strong>{player.breakArea.length} 張餅乾</strong>
        </div>
      </div>

      <div className={`hand${concealed ? ' concealed' : ''}`}>
        <span className="zone-title">手牌</span>
        <div className="hand-cards">
          {player.hand.map((card) => (
            <div className="hand-card" key={card.instanceId}>
              {concealed ? (
                <span>BRAVERSE</span>
              ) : (
                <>
                  <strong>{card.name}</strong>
                  <small>
                    {card.type === 'cookie'
                      ? `餅乾 LV ${card.level} · HP ${card.hp}`
                      : '道具'}
                  </small>
                  {isPlaying &&
                    game.phase === 'support' &&
                    !game.supportPlacedThisTurn && (
                      <button
                        className="hand-action"
                        type="button"
                        onClick={() => onPlaceSupport?.(card.instanceId)}
                      >
                        放入支援
                      </button>
                    )}
                  {isPlaying &&
                    game.phase === 'main' &&
                    card.type === 'cookie' &&
                    player.battleArea.length < 2 && (
                      <button
                        className="hand-action"
                        type="button"
                        onClick={() => onDeployCookie?.(card.instanceId)}
                      >
                        登場
                      </button>
                    )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function App() {
  const [game, setGame] = useState(createDemoGame)
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(
    null,
  )
  const [message, setMessage] = useState('請推進階段開始對戰。')
  const activePlayer = game.players[game.activePlayerId]
  const opponentId = opponentOf(game.activePlayerId)
  const pendingReplacementPlayer = game.pendingReplacementPlayerId
    ? game.players[game.pendingReplacementPlayerId]
    : null
  const refreshPlayerIds =
    game.status === 'playing' && game.pendingRefresh
      ? [game.pendingRefresh.playerId]
      : []

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

  const handleRestart = () => {
    setGame(createDemoGame())
    setSelectedAttackerId(null)
    setMessage('已建立新的範例對局。')
  }

  const handlePlaceSupport = (instanceId: string) => {
    runAction(
      (current) => placeSupportCard(current, instanceId),
      '已放置一張支援卡。',
    )
  }

  const handleDeployCookie = (instanceId: string) => {
    runAction(
      (current) => deployCookie(current, instanceId),
      '餅乾已登場並配置 HP。',
    )
  }

  const handleAttackTarget = (targetInstanceId: string) => {
    if (!selectedAttackerId) {
      setMessage('請先選擇攻擊餅乾。')
      return
    }

    const attackerName =
      activePlayer.battleArea.find(
        (cookie) => cookie.card.instanceId === selectedAttackerId,
      )?.card.name ?? '餅乾'
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
      `${attackerName}完成攻擊。`,
    )
    setSelectedAttackerId(null)
  }

  const handleReplacement = (instanceId: string) => {
    runAction(
      (current) => replaceDefeatedCookie(current, instanceId),
      '已補充新的戰鬥區餅乾。',
    )
  }

  const handleRefresh = (playerId: PlayerId, instanceId: string) => {
    runAction(
      (current) => refreshDeck(current, playerId, instanceId),
      '牌庫 Refresh 已完成。',
    )
  }

  return (
    <main className="game-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Cookie Battle Prototype</p>
          <h1>Braverse</h1>
        </div>
        <div className="turn-status" aria-label="目前回合">
          <span>第 {game.turnNumber} 回合 · {activePlayer.name}</span>
          <strong>{phaseLabels[game.phase]}</strong>
        </div>
      </header>

      <section className="battlefield" aria-label="對戰區">
        {game.result && (
          <section className="result-banner" role="alert">
            <span>對局結束</span>
            <strong>{game.players[game.result.winnerId].name}獲勝</strong>
            <small>
              {game.result.reason === 'break-level-limit'
                ? '對手休息區等級達到 10。'
                : game.result.reason === 'refresh-unavailable'
                  ? '對手無法完成牌庫 Refresh。'
                  : '對手沒有可登場的餅乾。'}
            </small>
          </section>
        )}

        {refreshPlayerIds.map((playerId) => {
          const player = game.players[playerId]

          return (
            <section className="forced-action-panel" key={playerId} role="alert">
              <div>
                <span>牌庫耗盡</span>
                <strong>{player.name}必須完成 Refresh</strong>
                <small>選擇一張 LV1 以上餅乾放入休息區。</small>
              </div>
              <div className="forced-action-options">
                {getRefreshCandidates(game, playerId).map((cookie) => (
                  <button
                    type="button"
                    key={cookie.instanceId}
                    onClick={() => handleRefresh(playerId, cookie.instanceId)}
                  >
                    {cookie.name} · LV {cookie.level}
                  </button>
                ))}
              </div>
            </section>
          )
        })}

        {pendingReplacementPlayer && (
          <section className="forced-action-panel" role="alert">
            <div>
              <span>強制補充</span>
              <strong>{pendingReplacementPlayer.name}必須登場餅乾</strong>
              <small>完成補充前不能進行其他動作。</small>
            </div>
            <div className="forced-action-options">
              {pendingReplacementPlayer.hand
                .filter((card) => card.type === 'cookie')
                .map((cookie) => (
                  <button
                    type="button"
                    key={cookie.instanceId}
                    disabled={pendingReplacementPlayer.deck.length < cookie.hp}
                    onClick={() => handleReplacement(cookie.instanceId)}
                  >
                    {cookie.name} · HP {cookie.hp}
                  </button>
                ))}
            </div>
          </section>
        )}

        <PlayerBoard
          game={game}
          playerId={opponentId}
          concealed
          selectedAttackerId={selectedAttackerId}
          onAttackTarget={handleAttackTarget}
        />

        <div className="turn-divider" role="status">
          <span>{activePlayer.name}的回合</span>
          <strong>{phaseLabels[game.phase]}</strong>
          {game.phase === 'main' && (
            <small>{canAttack(game) ? '可以宣告攻擊' : '先攻首回合不能攻擊'}</small>
          )}
        </div>

        <PlayerBoard
          game={game}
          playerId={game.activePlayerId}
          selectedAttackerId={selectedAttackerId}
          onSelectAttacker={(instanceId) => {
            setSelectedAttackerId(instanceId)
            setMessage('已選擇攻擊餅乾，請選擇對手目標。')
          }}
          onPlaceSupport={handlePlaceSupport}
          onDeployCookie={handleDeployCookie}
        />
      </section>

      <footer className="actionbar">
        <div>
          <span className="phase-label">目前操作</span>
          <strong>{activePlayer.name} · {phaseLabels[game.phase]}</strong>
          <small className="action-message">{message}</small>
        </div>
        <div className="action-buttons">
          <button className="secondary-button" type="button" onClick={handleRestart}>
            重新開始
          </button>
          <button
            type="button"
            onClick={handleAdvancePhase}
            disabled={
              game.status === 'finished' ||
              Boolean(game.pendingReplacementPlayerId) ||
              Boolean(game.pendingRefresh)
            }
          >
            {nextPhaseLabels[game.phase]}
          </button>
        </div>
      </footer>
    </main>
  )
}

export default App
