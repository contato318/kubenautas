FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# SPA: toda rota desconhecida cai no index.html
RUN printf 'server {\n  listen 8080;\n  root /usr/share/nginx/html;\n  location / { try_files $uri /index.html; }\n  location = /healthz { return 200 "ok"; }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 8080
