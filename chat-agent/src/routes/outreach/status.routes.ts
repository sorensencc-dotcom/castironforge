import { Router, Request, Response, NextFunction } from 'express'
import { Pool } from 'pg'
import { OutreachService } from '../../services/outreach.service.js'

export function createStatusRoutes(db: Pool) {
  const router = Router()
  const outreachService = new OutreachService(db)

  // GET /api/v1/outreach/:messageId/status
  router.get('/:messageId/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { messageId } = req.params

      if (!messageId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'messageId is required',
          },
          meta: {
            request_id: req.id,
            timestamp: new Date().toISOString(),
          },
        })
      }

      const data = await outreachService.getMessageStatus(messageId)

      res.status(200).json({
        success: true,
        data,
        meta: {
          request_id: req.id,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (err) {
      const error = err as Error
      if (error.message.includes('Message not found')) {
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
