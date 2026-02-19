# ── Stage 1: Build the React app ─────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ARG VITE_API_URL=/api
ARG VITE_WS_URL=
ARG VITE_ENV=production
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_ENV=$VITE_ENV

RUN npm run build

# ── Stage 2: Serve with Nginx ────────────────────────────
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
