import 'dotenv/config'
import express, { Express, Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase, closeDatabase } from './config/database.js'
import { authMiddleware } from './middleware/auth.middleware.js'
import { errorHandlerMiddleware } from './middleware/errorHandler.middleware.js'
import { createSendRoutes } from './routes/outreach/send.routes.js'
import { createStatusRoutes } from './routes/outreach/status.routes.js'

const app: Express = express()
const PORT = process.env.PORT || 3001

// Middleware: Add request ID
app.use((req: Request, res: Response, next: NextFunction) => {
  ;(req as any).id = uuidv4()
  next()
})

// Middleware: Logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// Middleware: Parsing
app.use(express.json({ limit: '10mb' }))

// Middleware: CORS
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// Health check (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: { status: 'ok', timestamp: new Date().toISOString() },
    meta: {
      request_id: (req as any).id,
      timestamp: new Date().toISOString(),
    },
  })
})

// Middleware: Authentication (applied to all /api routes)
app.use('/api', authMiddleware())

// Routes
const db = getDatabase()

app.use('/api/v1/outreach', createSendRoutes(db))
app.use('/api/v1/outreach', createStatusRoutes(db))

// Middleware: Error handler (must be last)
app.use(errorHandlerMiddleware())

// Start server
app.listen(PORT, () => {
  console.log(`✓ Outreach API listening on port ${PORT}`)
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')
  await closeDatabase()
  process.exit(0)
})

export default app
