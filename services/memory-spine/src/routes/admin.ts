import { Router, Request, Response } from 'express';
import {
  loadVersions,
  activateVersion,
  rollbackVersion,
} from '../store/versions.js';
import { countDocs, getLastEditTime } from '../store/corpus.js';
import type {
  AdminActivateRequest,
  AdminActivateResponse,
  AdminRollbackRequest,
  AdminRollbackResponse,
  AdminStatusResponse,
} from '../types.js';

export const adminRouter = Router();

adminRouter.post('/activate', (req: Request, res: Response) => {
  const body = req.body as AdminActivateRequest;
  if (!body.target_version) {
    res.status(400).json({ error: 'invalid_request', message: 'target_version is required', status: 400 });
    return;
  }
  const result: AdminActivateResponse = activateVersion(body.target_version);
  res.json(result);
});

adminRouter.post('/rollback', (req: Request, res: Response) => {
  const body = req.body as AdminRollbackRequest;
  const result: AdminRollbackResponse = rollbackVersion(body.to_version);
  res.json(result);
});

adminRouter.get('/status', (_req: Request, res: Response) => {
  const manifest = loadVersions();
  const response: AdminStatusResponse = {
    active_version: manifest.active,
    available_versions: manifest.available,
    corpus_doc_count: countDocs(),
    last_edit: getLastEditTime(),
  };
  res.json(response);
});
