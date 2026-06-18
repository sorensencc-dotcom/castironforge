const getEnv = (key: string, fallback: string): string => {
  const value = process.env[key];
  return value && value.length > 0 ? value : fallback;
};

export const OLLAMA_URL = getEnv('OLLAMA_URL', 'http://localhost:11434');
export const LLAMACPP_URL = getEnv('LLAMACPP_URL', 'http://localhost:8080');
export const TORQUE_URL = getEnv('TORQUE_URL', 'http://localhost:9000');
