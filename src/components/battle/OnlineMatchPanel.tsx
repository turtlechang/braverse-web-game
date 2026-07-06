import { useState } from 'react'
import type { CustomDeck, GameCommand } from '../../game'
import { validateCustomDeck } from '../../game'
import { useOnlineMatch } from '../../hooks/useOnlineMatch'

/**
 * Phase 5 線上對戰入口。目前對局進行中的畫面仍是最小可用版本
 * （直接呈現 PlayerView JSON + 手動送出指令），完整戰場 UI
 * （沿用 BattleRow 等既有元件）留待後續里程碑,因為既有戰場元件
 * 是建構在完整 GameState 上,改吃 PlayerView 需要另外設計。
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
  const [rawCommand, setRawCommand] = useState('')
  const [rawCommandError, setRawCommandError] = useState<string | null>(null)

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

  const submitRawCommand = () => {
    try {
      const command = JSON.parse(rawCommand) as GameCommand
      online.sendCommand(command)
      setRawCommandError(null)
    } catch {
      setRawCommandError('指令必須是合法的 JSON。')
    }
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

        {online.status === 'in-progress' && online.playerView && (
          <>
            <p>
              我的身分：{online.viewerPlayerId}｜房號：{online.roomCode}
            </p>
            <div>
              <textarea
                rows={4}
                style={{ width: '100%' }}
                value={rawCommand}
                onChange={(event) => setRawCommand(event.target.value)}
                placeholder='例如 {"kind":"keep-opening-hand","playerId":"player-one"}'
              />
              <button type="button" onClick={submitRawCommand}>
                送出指令
              </button>
              {rawCommandError && <p style={{ color: '#e05252' }}>{rawCommandError}</p>}
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
              {JSON.stringify(online.playerView, null, 2)}
            </pre>
          </>
        )}

        {online.status === 'ended' && (
          <p>對局結束：{online.matchEndedReason}</p>
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
