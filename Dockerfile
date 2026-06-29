FROM node:20-bullseye-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Install full dependencies for build (including devDependencies like TypeScript)
RUN npm install

COPY . ./

# Build the app
RUN npm run build

# Remove devDependencies to keep image small
RUN npm prune --production

EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
