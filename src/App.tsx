import { useState } from 'react'
import './App.css'
import {
  advancePhase,
  canAttack,
  createDemoGame,
  getBreakAreaLevel,
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
}

function PlayerBoard({ game, playerId, concealed = false }: PlayerBoardProps) {
  const player = game.players[playerId]
  const isActive = game.activePlayerId === playerId

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
              <article className="game-card cookie-card" key={cookie.card.instanceId}>
                <div className="card-level">LV {cookie.card.level}</div>
                <strong>{cookie.card.name}</strong>
                <span>HP {cookie.hpCards.length} / {cookie.card.hp}</span>
                <small>{cookie.rested ? '休息' : '活躍'}</small>
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
                  <small>{card.type === 'cookie' ? `餅乾 LV ${card.level}` : '道具'}</small>
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
  const activePlayer = game.players[game.activePlayerId]
  const opponentId = opponentOf(game.activePlayerId)

  const handleAdvancePhase = () => {
    setGame((current) => advancePhase(current))
  }

  const handleRestart = () => {
    setGame(createDemoGame())
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
        <PlayerBoard game={game} playerId={opponentId} concealed />

        <div className="turn-divider" role="status">
          <span>{activePlayer.name}的回合</span>
          <strong>{phaseLabels[game.phase]}</strong>
          {game.phase === 'main' && (
            <small>{canAttack(game) ? '可以宣告攻擊' : '先攻首回合不能攻擊'}</small>
          )}
        </div>

        <PlayerBoard game={game} playerId={game.activePlayerId} />
      </section>

      <footer className="actionbar">
        <div>
          <span className="phase-label">目前操作</span>
          <strong>{activePlayer.name} · {phaseLabels[game.phase]}</strong>
        </div>
        <div className="action-buttons">
          <button className="secondary-button" type="button" onClick={handleRestart}>
            重新開始
          </button>
          <button type="button" onClick={handleAdvancePhase}>
            {nextPhaseLabels[game.phase]}
          </button>
        </div>
      </footer>
    </main>
  )
}

export default App
