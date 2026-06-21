/**
 * Backend API Skeleton for Phase-5 Outreach Automation
 * Express.js + TypeScript Service Layer
 * Ready for Week-1 implementation
 */

// ============================================================================
// 1. PROJECT STRUCTURE
// ============================================================================

/*
chat-agent/
├── src/
│   ├── index.ts                          # Express app entry point
│   ├── config/
│   │   ├── database.ts                   # PostgreSQL connection pool
│   │   ├── environment.ts                # Environment variables
│   │   └── constants.ts                  # App constants
│   ├── middleware/
│   │   ├── auth.middleware.ts            # JWT/API key validation
│   │   ├── validation.middleware.ts      # Request schema validation
│   │   ├── errorHandler.middleware.ts    # Global error handling
│   │   ├── rateLimit.middleware.ts       # Rate limiting
│   │   └── requestLogger.middleware.ts   # Request logging
│   ├── routes/
│   │   ├── outreach/
│   │   │   ├── send.routes.ts            # POST /outreach/send
│   │   │   ├── batch.routes.ts           # POST /outreach/batch
│   │   │   ├── campaigns.routes.ts       # GET/POST campaigns
│   │   │   ├── templates.routes.ts       # Template CRUD
│   │   │   └── status.routes.ts          # GET /outreach/{id}/status
│   │   ├── webhooks/
│   │   │   └── delivery.routes.ts        # POST /webhooks/delivery
│   │   ├── analytics/
│   │   │   └── metrics.routes.ts         # GET /outreach/analytics
│   │   └── health.routes.ts              # GET /health
│   ├── services/
│   │   ├── outreach.service.ts           # Core business logic
│   │   ├── template.service.ts           # Template CRUD + variants
│   │   ├── lead.service.ts               # Lead management
│   │   ├── campaign.service.ts           # Campaign orchestration
│   │   ├── delivery.service.ts           # Webhook handling
│   │   ├── analytics.service.ts          # Metrics aggregation
│   │   ├── audit.service.ts              # Audit logging
│   │   └── planning-engine.service.ts    # Planning Engine integration
│   ├── models/
│   │   ├── types.ts                      # TypeScript interfaces (from shared-types)
│   │   ├── database.ts                   # Database model definitions
│   │   └── errors.ts                     # Custom error classes
│   ├── database/
│   │   ├── queries/
│   │   │   ├── leads.queries.ts
│   │   │   ├── templates.queries.ts
│   │   │   ├── messages.queries.ts
│   │   │   ├── campaigns.queries.ts
│   │   │   ├── delivery-events.queries.ts
│   │   │   └── audit.queries.ts
│   │   └── migrations/                   # (in shared-types/database/migrations)
│   ├── utils/
│   │   ├── validation.ts                 # Schema validation helpers
│   │   ├── crypto.ts                     # HMAC, idempotency keys
│   │   ├── formatters.ts                 # Response formatting
│   │   └── logger.ts                     # Structured logging
│   └── jobs/
│       ├── batch-processor.job.ts        # Process batch queue
│       ├── analytics-aggregator.job.ts   # Daily metrics rollup
│       └── cleanup.job.ts                # Hourly maintenance
├── package.json
├── tsconfig.json
├── .env.example
└── jest.config.js

*/

// ============================================================================
// 2. ENTRY POINT: src/index.ts
// ============================================================================

import express, { Express } from 'express'
import dotenv from 'dotenv'
import { Pool } from 'pg'

// Load environment
dotenv.config()

// Middleware
import { authMiddleware } from './middleware/auth.middleware'
import { validationMiddleware } from './middleware/validation.middleware'
import { errorHandlerMiddleware } from './middleware/errorHandler.middleware'
import { rateLimitMiddleware } from './middleware/rateLimit.middleware'
import { requestLoggerMiddleware } from './middleware/requestLogger.middleware'

// Routes
import { sendRoutes } from './routes/outreach/send.routes'
import { batchRoutes } from './routes/outreach/batch.routes'
import { campaignRoutes } from './routes/outreach/campaigns.routes'
import { templateRoutes } from './routes/outreach/templates.routes'
import { statusRoutes } from './routes/outreach/status.routes'
import { deliveryWebhookRoutes } from './routes/webhooks/delivery.routes'
import { metricsRoutes } from './routes/analytics/metrics.routes'
import { healthRoutes } from './routes/health.routes'

// Config
import { getDatabase } from './config/database'
import { getEnvironment } from './config/environment'

const app: Express = express()
const env = getEnvironment()

// ============================================================================
// 3. MIDDLEWARE SETUP
// ============================================================================

// Logging (must be first)
app.use(requestLoggerMiddleware())

// Parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

// CORS (if needed)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// Rate limiting (before auth, so errors count toward limit)
app.use(rateLimitMiddleware())

// Authentication
app.use(authMiddleware())

// Request validation
app.use(validationMiddleware())

// ============================================================================
// 4. ROUTES
// ============================================================================

// Health check (no auth required)
app.use('/health', healthRoutes)

// Outreach API
app.use('/api/v1/outreach', sendRoutes)
app.use('/api/v1/outreach', batchRoutes)
app.use('/api/v1/outreach', campaignRoutes)
app.use('/api/v1/outreach', templateRoutes)
app.use('/api/v1/outreach', statusRoutes)

// Webhooks (signature verification instead of auth)
app.use('/api/v1/webhooks', deliveryWebhookRoutes)

// Analytics
app.use('/api/v1/outreach', metricsRoutes)

// ============================================================================
// 5. ERROR HANDLING (must be last)
// ============================================================================

app.use(errorHandlerMiddleware())

// ============================================================================
// 6. DATABASE CONNECTION
// ============================================================================

const db = getDatabase()

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')
  await db.end()
  process.exit(0)
})

// ============================================================================
// 7. START SERVER
// ============================================================================

const PORT = env.PORT || 3001
app.listen(PORT, () => {
  console.log(`✓ Outreach API listening on port ${PORT}`)
  console.log(`✓ API version: v1`)
  console.log(`✓ Environment: ${env.NODE_ENV}`)
})

export default app
export { db }

// ============================================================================
// 8. KEY FILES TO IMPLEMENT
// ============================================================================

/*

### config/environment.ts
export function getEnvironment() {
  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3001'),
    DATABASE_URL: process.env.DATABASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    SENDGRID_WEBHOOK_SECRET: process.env.SENDGRID_WEBHOOK_SECRET,
    MAILGUN_WEBHOOK_SECRET: process.env.MAILGUN_WEBHOOK_SECRET,
    JWT_SECRET: process.env.JWT_SECRET,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info'
  }
}

### config/database.ts
import { Pool } from 'pg'

let pool: Pool

export function getDatabase(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  }
  return pool
}

### middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express'

export function authMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'AUTHENTICATION_ERROR' })
    }
    // Verify JWT or API key here
    next()
  }
}

### middleware/errorHandler.middleware.ts
import { Request, Response, NextFunction } from 'express'

export function errorHandlerMiddleware() {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err)
    
    const statusCode = err.statusCode || 500
    const code = err.code || 'INTERNAL_SERVER_ERROR'
    
    res.status(statusCode).json({
      success: false,
      error: {
        code,
        message: err.message || 'Internal server error'
      },
      meta: {
        request_id: req.id,
        timestamp: new Date().toISOString()
      }
    })
  }
}

### services/outreach.service.ts
import { Pool } from 'pg'
import { SendMessageRequest, SendMessageResponse } from '@castironforge/shared-types'

export class OutreachService {
  constructor(private db: Pool) {}

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    // 1. Validate lead & template
    // 2. Create outreach_message record
    // 3. Render template with personalization
    // 4. Call delivery service (send via provider)
    // 5. Update message status
    // 6. Create audit log entry
    // 7. Return response
    
    // Implementation in Week-1
  }

  async batchSubmit(campaignName: string, templateId: string, leads: any[]) {
    // 1. Create campaign record
    // 2. Insert leads into queue
    // 3. Schedule batch job if scheduled_at provided
    // 4. Return campaign_id
    
    // Implementation in Week-1
  }
}

### routes/outreach/send.routes.ts
import { Router, Request, Response, NextFunction } from 'express'
import { db } from '../../index'
import { OutreachService } from '../../services/outreach.service'

export const sendRoutes = Router()

const outreachService = new OutreachService(db)

// POST /api/v1/outreach/send
sendRoutes.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await outreachService.sendMessage(req.body)
    res.status(201).json({
      success: true,
      data: response,
      meta: { request_id: req.id, timestamp: new Date().toISOString() }
    })
  } catch (err) {
    next(err)
  }
})

*/

// ============================================================================
// 9. ENVIRONMENT VARIABLES (.env.example)
// ============================================================================

/*

NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/castironforge

# Authentication
JWT_SECRET=your-secret-key-here
API_KEY_PREFIX=sk_

# Email Providers
SENDGRID_WEBHOOK_SECRET=whsec_test...
MAILGUN_WEBHOOK_SECRET=key-...
AWS_SES_REGION=us-east-1

# Anthropic (for template variants)
ANTHROPIC_API_KEY=sk-ant-...

# Planning Engine
PLANNING_ENGINE_URL=https://planning-engine.internal/api
PLANNING_ENGINE_API_KEY=sk-...

# Logging
LOG_LEVEL=info

# Feature Flags
ENABLE_TEMPLATE_VARIANTS=true
ENABLE_WEBHOOKS=true
ENABLE_ANALYTICS=true

*/

// ============================================================================
// 10. PACKAGE.JSON SCRIPTS
// ============================================================================

/*

{
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts",
    "migrate": "node scripts/migrate.js",
    "migrate:rollback": "node scripts/migrate-rollback.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.0",
    "@castironforge/shared-types": "^1.0.0",
    "jsonschema": "^1.4.1",
    "helmet": "^7.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "typescript": "^5.1.0",
    "@types/express": "^4.17.17",
    "@types/node": "^20.3.1",
    "ts-node": "^10.9.1",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "supertest": "^6.3.3"
  }
}

*/

export {}
