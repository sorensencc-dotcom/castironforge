import { Request, Response, NextFunction } from 'express'

export function errorHandlerMiddleware() {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err.message || err)

    const statusCode = err.statusCode || 500
    const code = err.code || 'INTERNAL_SERVER_ERROR'

    res.status(statusCode).json({
      success: false,
      error: {
        code,
        message: err.message || 'Internal server error',
      },
      meta: {
        request_id: req.id,
        timestamp: new Date().toISOString(),
      },
    })
  }
}
