FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.mjs ./index.mjs

ENV NODE_ENV=production
ENV BAILEYS_AUTH_DIR=/data/auth
ENV PORT=8787

RUN mkdir -p /data/auth && chown -R node:node /app /data
VOLUME ["/data"]
EXPOSE 8787
USER node

CMD ["node", "index.mjs"]