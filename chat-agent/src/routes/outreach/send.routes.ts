import { Router, Request, Response, NextFunction } from 'express'
import { Pool } from 'pg'
import { OutreachService, SendMessageRequest } from '../../services/outreach.service.js'

export function createSendRoutes(db: Pool) {
  const router = Router()
  const outreachService = new OutreachService(db)

  // POST /api/v1/outreach/send
  router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request: SendMessageRequest = req.body

      // Basic validation
      if (!request.lead?.email || !request.lead?.name || !request.template_id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: lead.email, lead.name, template_id',
          },
          meta: {
            request_id: req.id,
            timestamp: new Date().toISOString(),
          },
        })
      }

      const response = await outreachService.sendMessage(request)

      res.status(201).json({
        success: true,
        data: response,
        meta: {
          request_id: req.id,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (err) {
      const error = err as Error
      if (error.message.includes('Template not found')) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
          meta: {
            request_id: req.id,
            timestamp: new Date().toISOString(),
          },
        })
      } else {
        next(err)
      }
    }
  })

  return router
}
