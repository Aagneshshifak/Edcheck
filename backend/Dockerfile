FROM node:18-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

# Cloud Run injects $PORT at runtime — your index.js already reads process.env.PORT
EXPOSE 8080

CMD ["node", "index.js"]
