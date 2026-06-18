FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY src ./src
COPY tsconfig.json ./

EXPOSE 8000

CMD ["npm", "run", "dev"]
