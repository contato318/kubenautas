FROM node:22-alpine AS build
WORKDIR /app
RUN npm install --global pnpm@10.33.4
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM build AS api-package
RUN pnpm --filter @jack-academy/api deploy --legacy --prod /out/api

FROM node:22-alpine AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=api-package --chown=node:node /out/api ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM nginx:1.28-alpine AS web
ENV API_UPSTREAM=api:3000
COPY infra/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
