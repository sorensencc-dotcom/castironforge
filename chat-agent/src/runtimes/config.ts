const getEnv = (key: string, fallback: string): string => {
  const value = process.env[key];
  return value && value.length > 0 ? value : fallback;
};

export const OLLAMA_URL = getEnv('OLLAMA_URL', 'http://localhost:11434');
export const LLAMACPP_URL = getEnv('LLAMACPP_URL', 'http://localhost:8080');
export const TORQUE_URL = getEnv('TORQUE_URL', 'http://localhost:9000');

// OpenSharing configuration
export const OPENSHARING_URL = getEnv('OPENSHARING_URL', 'http://localhost:8090');
export const OPENSHARING_PRINCIPAL_ID = getEnv('OPENSHARING_PRINCIPAL_ID', 'cic-agent');
export const OPENSHARING_NAMESPACE = getEnv('OPENSHARING_NAMESPACE', 'default');

// Databricks configuration
export const DATABRICKS_WORKSPACE_URL = getEnv('DATABRICKS_WORKSPACE_URL', 'https://e2-demo.cloud.databricks.com');
export const DATABRICKS_TOKEN = getEnv('DATABRICKS_TOKEN', '');
export const DATABRICKS_ENDPOINT_NAME = getEnv('DATABRICKS_ENDPOINT_NAME', 'dbrx-instruct');
