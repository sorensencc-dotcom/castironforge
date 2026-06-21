export const CONFIG = {
  typesense: {
    host: process.env.TYPESENSE_HOST ?? "localhost",
    port: parseInt(process.env.TYPESENSE_PORT ?? "8108", 10),
    protocol: process.env.TYPESENSE_PROTOCOL ?? "http",
    apiKey: process.env.TYPESENSE_API_KEY ?? "dev-key"
  },
  server: {
    host: process.env.SERVER_HOST ?? "localhost",
    port: parseInt(process.env.SERVER_PORT ?? "5050", 10)
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? ["http://localhost:*", "http://127.0.0.1:*"]
  }
};
