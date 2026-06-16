import { Router, Request, Response } from 'express';
import { getDoc } from '../store/corpus.js';
import type { MemoryProvenanceResponse } from '../types.js';

export const provenanceRouter = Router();

provenanceRouter.get('/:doc_id', (req: Request, res: Response) => {
  const { doc_id } = req.params;
  const doc = getDoc(doc_id);

  if (!doc) {
    res.status(404).json({ error: 'doc_not_found', message: `Document ${doc_id} does not exist.`, status: 404 });
    return;
  }

  const response: MemoryProvenanceResponse = {
    doc_id: doc.doc_id,
    history: doc.provenance_history,
  };
  res.json(response);
});
