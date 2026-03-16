FROM node:22-alpine

WORKDIR /app

RUN apk add curl

COPY package*.json ./

RUN npm install --force

COPY . .

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "run", "dev"]