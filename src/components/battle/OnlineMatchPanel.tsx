import { useState } from 'react'
import type { CustomDeck } from '../../game'
import { validateCustomDeck } from '../../game'
import { useOnlineMatch } from '../../hooks/useOnlineMatch'
import { OnlineBattleView } from './OnlineBattleView'

/**
 * Phase 5 線上對戰入口。對局進行中改用 OnlineBattleView 呈現真正的戰場
 * （重用 BattleRow/EffectPanel 等本地既有元件）,取代先前的 JSON dump 版本。
 */
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

  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId) ?? null
  const selectedDeckValidation = selectedDeck
    ? validateCustomDeck(selectedDeck.entries)
    : null

  const handleClose = () => {
    if (online.status !== 'idle') {
      online.leave()
    }
    onClose()
  }

  if (
    (online.status === 'in-progress' ||
      (online.status === 'ended' && online.matchEndedReason !== 'opponent-disconnected')) &&
    online.maskedGame &&
    online.viewerPlayerId
  ) {
    return (
      <OnlineBattleView
        game={online.maskedGame}
        viewerPlayerId={online.viewerPlayerId}
        roomCode={online.roomCode}
        sendCommand={online.sendCommand}
        onLeave={handleClose}
      />
    )
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div className="modal-header">
          <h2>線上對戰</h2>
          <button type="button" onClick={handleClose} aria-label="關閉">
            關閉
          </button>
        </div>

        <p>狀態：{online.status}</p>
        {online.errorMessage && <p style={{ color: '#e05252' }}>{online.errorMessage}</p>}

        {online.status === 'idle' && (
          <>
            <label>
              選擇牌組
              <select
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
            {selectedDeckValidation && !selectedDeckValidation.isValid && (
              <p style={{ color: '#e05252' }}>目前牌組不合法，無法用於線上對戰。</p>
            )}

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={!selectedDeck || !selectedDeckValidation?.isValid}
                onClick={() => selectedDeck && online.createRoom(selectedDeck)}
              >
                建立房間
              </button>
              <div>
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder="輸入房號"
                />
                <button
                  type="button"
                  disabled={!selectedDeck || !selectedDeckValidation?.isValid || !joinCode.trim()}
                  onClick={() =>
                    selectedDeck && online.joinRoom(joinCode.trim(), selectedDeck)
                  }
                >
                  加入房間
                </button>
              </div>
            </div>
          </>
        )}

        {online.status === 'connecting' && <p>連線中…</p>}

        {online.status === 'waiting-for-opponent' && online.roomCode && (
          <p>
            房號：<strong>{online.roomCode}</strong>，請把房號分享給對手，等待對方加入…
          </p>
        )}

        {online.status === 'ended' && (
          <p>
            {online.matchEndedReason === 'opponent-disconnected'
              ? '對手已離線，對局結束。'
              : `對局結束：${online.matchEndedReason}`}
          </p>
        )}

        {online.status === 'error' && (
          <button type="button" onClick={onClose}>
            返回
          </button>
        )}
      </div>
    </div>
  )
}
