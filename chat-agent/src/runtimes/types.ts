export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface CompleteParams {
  sessionId: string;
  model: string;
  message: string;
}

export interface StreamParams extends CompleteParams {
  onToken: (token: string) => void;
  onDone: () => void;
}

export interface RuntimeModel {
  id: string;
  name: string;
  runtime: 'ollama' | 'llamacpp' | 'torque';
  size?: string;
}

export interface RuntimeAdapter {
  health(): Promise<HealthStatus>;
  models(): Promise<RuntimeModel[]>;
  complete(params: CompleteParams): Promise<string>;
  stream(params: StreamParams): Promise<void>;
  embed(text: string): Promise<number[]>;
}
