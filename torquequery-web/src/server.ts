import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

const HYBRID_API_URL = process.env.HYBRID_API_URL ?? "http://localhost:5051";

app.get("/api/search", async (req, res) => {
  try {
    const q = req.query.q as string;

    if (!q) {
      return res.status(400).json({ error: "Query required" });
    }

    const url = `${HYBRID_API_URL}/hybrid?q=${encodeURIComponent(q)}`;
    const response = await fetch(url);

    if (!response.ok) {
      return res
        .status(500)
        .json({ error: `Upstream error: ${response.statusText}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const port = process.env.PORT ?? 5052;

app.listen(port, () => {
  console.log(`TorqueQuery Web UI running on http://localhost:${port}`);
});
