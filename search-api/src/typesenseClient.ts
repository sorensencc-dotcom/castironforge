import Typesense from "typesense";
import { CONFIG } from "./config.js";

export const client = new Typesense.Client({
  nodes: [
    {
      host: CONFIG.typesense.host,
      port: CONFIG.typesense.port,
      protocol: CONFIG.typesense.protocol
    }
  ],
  apiKey: CONFIG.typesense.apiKey,
  connectionTimeoutSeconds: 5
});
