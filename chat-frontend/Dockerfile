FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY src ./src
COPY index.html vite.config.ts tailwind.config.js postcss.config.js tsconfig.json ./

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
