FROM node:20-bullseye-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production

COPY . ./

RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
