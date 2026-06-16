import { Router, Request, Response } from 'express';
import { loadVersions } from '../store/versions.js';
import { buildStubQueryResponse } from '../lib/query.js';
import type { MemoryQueryRequest } from '../types.js';

export const queryRouter = Router();

queryRouter.post('/', (req: Request, res: Response) => {
  const body = req.body as MemoryQueryRequest;

  if (!body.query_text) {
    res.status(400).json({ error: 'invalid_request', message: 'query_text is required', status: 400 });
    return;
  }

  const { active: memory_version } = loadVersions();
  res.json(buildStubQueryResponse(body, memory_version));
});
