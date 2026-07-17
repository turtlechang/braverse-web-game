import { X } from 'lucide-react'
import { useState } from 'react'
import type { CustomDeck } from '../../game'
import { validateCustomDeck } from '../../game'
import { useOnlineMatch } from '../../hooks/useOnlineMatch'
import { ONLINE_PLAYER_NAME_MAX_LENGTH } from '../../net/onlineProtocol'
import { onlineMatchStatusLabels, matchEndedReasonLabels } from '../gameUiLabels'
import { OnlineBattleView } from './OnlineBattleView'
import { OnlineOpeningView } from './OnlineOpeningView'

export interface OnlineMatchPanelProps {
  decks: CustomDeck[]
  onClose: () => void
}

export function OnlineMatchPanel({ decks, onClose }: OnlineMatchPanelProps) {
  const online = useOnlineMatch()
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(
    decks[0]?.id ?? null,
  )
  const [joinCode, setJoinCode] = useState('')
  const [playerName, setPlayerName] = useState('')

  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId) ?? null
  const selectedDeckValidation = selectedDeck
    ? validateCustomDeck(selectedDeck.entries)
    : null

  const handleClose = () => {
    if (
      online.status === 'connecting' ||
      online.status === 'waiting-for-opponent' ||
      online.status === 'opening' ||
      online.status === 'in-progress'
    ) {
      online.leave()
    }
    onClose()
  }

  if (
    online.status === 'opening' &&
    online.openingSnapshot &&
    online.viewerPlayerId &&
    !online.maskedGame
  ) {
    return (
      <OnlineOpeningView
        opening={online.openingSnapshot}
        viewerPlayerId={online.viewerPlayerId}
        roomCode={online.roomCode}
        commandRejectedReason={online.errorMessage}
        sendOpeningAction={online.sendOpeningAction}
        onLeave={handleClose}
      />
    )
  }

  if (
    (online.status === 'opening' ||
      online.status === 'in-progress' ||
      (online.status === 'ended' &&
        online.matchEndedReason !== 'opponent-disconnected')) &&
    online.maskedGame &&
    online.viewerPlayerId
  ) {
    return (
      <OnlineBattleView
        game={online.maskedGame}
        viewerPlayerId={online.viewerPlayerId}
        roomCode={online.roomCode}
        sendCommand={online.sendCommand}
        sendAttackSelection={online.sendAttackSelection}
        opponentAttackSelection={online.opponentAttackSelection}
        publicIntent={
          online.publicIntents?.[
            online.viewerPlayerId === 'player-one' ? 'player-two' : 'player-one'
          ] ?? null
        }
        openingSnapshot={online.openingSnapshot}
        commandRejectedReason={online.errorMessage}
        sendOpeningAction={online.sendOpeningAction}
        sendPublicIntent={online.sendPublicIntent}
        clearPublicIntent={online.clearPublicIntent}
        connectionNotice={online.connectionNotice}
        connectionMode={online.connectionMode}
        onLeave={handleClose}
      />
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="online-match-panel" role="dialog" aria-modal="true" aria-labelledby="online-match-title">
        <div className="online-match-header">
          <h2 id="online-match-title">線上對戰</h2>
          <button
            type="button"
            className="online-match-close"
            onClick={handleClose}
            aria-label="關閉線上對戰"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="online-match-body">
          <div className="online-match-status">
            <span className="online-match-status-label">狀態</span>
            <span className={`online-match-status-value is-${online.status}`}>
              {onlineMatchStatusLabels[online.status]}
            </span>
          </div>

          {online.errorMessage && (
            <div className="online-match-error" role="alert">
              {online.errorMessage}
            </div>
          )}

          {online.connectionNotice && (
            <p className="online-match-connection-status" role="status">
              {online.connectionNotice}
            </p>
          )}

          {online.status === 'idle' && (
            <div className="online-match-idle">
              <label className="online-match-field" htmlFor="deck-select">
                <span>選擇牌組</span>
                <select
                  id="deck-select"
                  value={selectedDeckId ?? ''}
                  onChange={(event) => setSelectedDeckId(event.target.value)}
                >
                  <option value="" disabled>
                    請選擇牌組
                  </option>
                  {decks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="online-match-field" htmlFor="online-player-name">
                <span>玩家名稱</span>
                <input
                  id="online-player-name"
                  className="online-match-input"
                  value={playerName}
                  maxLength={ONLINE_PLAYER_NAME_MAX_LENGTH}
                  onChange={(event) => setPlayerName(event.target.value)}
                  placeholder="輸入名稱"
                  autoComplete="nickname"
                />
              </label>

              {selectedDeckValidation && !selectedDeckValidation.isValid && (
                <div className="online-match-error" role="alert">
                  目前牌組不合法，無法用於線上對戰。
                </div>
              )}

              <div className="online-match-actions">
                <button
                  type="button"
                  className="online-match-btn-primary"
                  disabled={
                    !selectedDeck ||
                    !selectedDeckValidation?.isValid ||
                    !playerName.trim()
                  }
                  onClick={() =>
                    selectedDeck &&
                    online.createRoom(selectedDeck, playerName.trim())
                  }
                >
                  建立房間
                </button>

                <div className="online-match-join-row">
                  <input
                    className="online-match-input"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value)}
                    placeholder="輸入房號"
                    aria-label="房號"
                  />
                  <button
                    type="button"
                    className="online-match-btn-secondary"
                    disabled={
                      !selectedDeck ||
                      !selectedDeckValidation?.isValid ||
                      !playerName.trim() ||
                      !joinCode.trim()
                    }
                    onClick={() =>
                      selectedDeck &&
                      online.joinRoom(
                        joinCode.trim(),
                        selectedDeck,
                        playerName.trim(),
                      )
                    }
                  >
                    加入房間
                  </button>
                </div>
              </div>
            </div>
          )}

          {online.status === 'connecting' && (
            <div className="online-match-notice">
              正在連線至伺服器…
            </div>
          )}

          {online.status === 'waiting-for-opponent' && online.roomCode && (
            <div className="online-match-notice">
              <p>房號：<strong>{online.roomCode}</strong></p>
              <p>請把房號分享給對手，等待對方加入…</p>
            </div>
          )}

          {online.status === 'ended' && (
            <div className="online-match-notice">
              {online.matchEndedReason
                ? `對局結束：${matchEndedReasonLabels[online.matchEndedReason] ?? online.matchEndedReason}`
                : '對局已結束。'}
            </div>
          )}

          {online.status === 'error' && (
            <div className="online-match-actions">
              <button
                type="button"
                className="online-match-btn-primary"
                onClick={handleClose}
              >
                返回
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
