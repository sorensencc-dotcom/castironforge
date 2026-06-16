export type RuntimeStatus = 'ok' | 'degraded' | 'error';

export interface ModelInfo {
  id: string;
  name: string;
  runtime: string;
  size?: string;
}

export interface CompleteParams {
  sessionId: string;
  model: string;
  message: string;
}

export interface StreamParams extends CompleteParams {
  onToken: (token: string) => void;
  onDone: () => void;
}

export interface RuntimeAdapter {
  health(): Promise<RuntimeStatus>;
  models(): Promise<ModelInfo[]>;
  complete(params: CompleteParams): Promise<string>;
  stream(params: StreamParams): Promise<void>;
  embed(text: string): Promise<number[]>;
}
