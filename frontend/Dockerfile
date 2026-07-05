# Multi-stage: build the Vite app, then serve the static bundle with nginx which
# also reverse-proxies /api to the backend (same-origin, no CORS).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# Backend upstream for the /api reverse proxy. The default matches the local
# docker-compose service name; Railway overrides it with a service variable
# (e.g. http://koshurlock-holmes.railway.internal:8000). No trailing slash.
ENV BACKEND_ORIGIN=http://backend:8000
# The stock entrypoint envsubst-renders this to /etc/nginx/conf.d/default.conf
# at container start, so one image serves both environments.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
