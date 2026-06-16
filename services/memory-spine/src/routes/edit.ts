import { Router, Request, Response } from 'express';
import { loadVersions, activateVersion } from '../store/versions.js';
import { upsertDoc, deleteDoc } from '../store/corpus.js';
import type { MemoryEditRequest, MemoryEditResponse } from '../types.js';

export const editRouter = Router();

editRouter.post('/', (req: Request, res: Response) => {
  const body = req.body as MemoryEditRequest;

  if (!body.operation || !body.doc_id) {
    res.status(400).json({ error: 'invalid_request', message: 'operation and doc_id are required', status: 400 });
    return;
  }

  const { active: currentVersion } = loadVersions();
  const versionParts = currentVersion.match(/memory-v(\d+)/);
  const nextN = versionParts ? parseInt(versionParts[1], 10) + 1 : 2;
  const nextVersion = `memory-v${nextN}`;

  if (body.operation === 'delete') {
    const deleted = deleteDoc(body.doc_id);
    if (!deleted) {
      res.status(404).json({ error: 'doc_not_found', message: `Document ${body.doc_id} does not exist.`, status: 404 });
      return;
    }
  } else {
    upsertDoc(body.doc_id, body.payload ?? {}, nextVersion);
  }

  // Auto-bump version on every edit so provenance is traceable.
  activateVersion(nextVersion);

  const response: MemoryEditResponse = { status: 'ok', version: nextVersion };
  res.json(response);
});
