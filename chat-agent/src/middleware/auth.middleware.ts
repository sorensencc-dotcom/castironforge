import { Request, Response, NextFunction } from 'express'

export function authMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Missing or invalid Authorization header',
        },
        meta: {
          request_id: req.id,
          timestamp: new Date().toISOString(),
        },
      })
    }

    // For MVP, accept any Bearer token
    // In production, validate JWT or API key here
    next()
  }
}
