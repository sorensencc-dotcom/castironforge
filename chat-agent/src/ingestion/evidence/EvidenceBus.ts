import { EventEmitter } from 'events';

export interface DocumentEvidence {
  kind: 'document';
  text: string;
  metadata: Record<string, string | string[]>;
  source: {
    path: string;
    repo?: string;
    ingestedAt: string;
  };
}

export type Evidence = DocumentEvidence;

class EvidenceBusImpl extends EventEmitter {
  emit(evidence: Evidence): boolean {
    return super.emit('evidence', evidence);
  }

  onEvidence(handler: (evidence: Evidence) => void | Promise<void>): void {
    this.on('evidence', handler);
  }
}

export const evidenceBus = new EvidenceBusImpl();
