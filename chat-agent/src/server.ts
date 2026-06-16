import express from 'express';
import { chatAgentRouter } from './router/chatAgentRouter';

const app = express();
const PORT = process.env.PORT ?? 8000;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use('/', chatAgentRouter);

app.listen(PORT, () => {
  console.log(`CIC Chat Agent listening on http://localhost:${PORT}`);
});
