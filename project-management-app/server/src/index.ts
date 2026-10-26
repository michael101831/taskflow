import 'dotenv/config'
import { createServer } from 'node:http'
import { attachCallSignaling } from './callSignaling.js'
import { prisma } from './lib/prisma.js'
import { createApp } from './app.js'

const app = createApp()
const port = Number(process.env.PORT) || 3001
const server = createServer(app)
const calls = attachCallSignaling(server)

server.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`)
})

async function shutdown() {
  calls.close()
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
