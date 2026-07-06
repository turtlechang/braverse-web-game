import { WebSocketServer, type WebSocket } from 'ws'
import { ConnectionManager } from './connection'
import { createRoomStore } from './rooms'

const PORT = Number(process.env.WS_PORT ?? 8787)

const store = createRoomStore()
const manager = new ConnectionManager(store)

const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (socket: WebSocket) => {
  socket.on('message', (data) => {
    manager.handleMessage(socket, data.toString())
  })
  socket.on('close', () => {
    manager.handleDisconnect(socket)
  })
})

console.log(`Braverse 線上對戰 server 已啟動,監聽 ws://localhost:${PORT}`)
