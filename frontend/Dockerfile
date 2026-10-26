FROM node:22-alpine AS source

WORKDIR /app

# Bound the JavaScript heap during the build on an 8 GB computer.
ENV NODE_OPTIONS=--max-old-space-size=1024

COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY index.html ./
COPY vite.config.js ./
COPY src ./src
COPY public ./public

FROM source AS demo-build

# Local developer .env files cannot change either target's API mode.
ENV VITE_API_MODE=mock \
    VITE_API_BASE_URL=/api/v1
RUN npm run build

FROM source AS integration-build

ENV VITE_API_MODE=http \
    VITE_API_BASE_URL=/api/v1
RUN npm run build

FROM nginx:stable-alpine AS runtime

COPY nginx.conf /etc/nginx/nginx.conf

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/index.html || exit 1

# Our configuration needs no entrypoint scripts or writes to /etc/nginx.
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]

FROM runtime AS demo

COPY nginx.mock.conf /etc/nginx/api.conf
COPY --from=demo-build /app/dist /usr/share/nginx/html

# A plain docker build produces the complete application frontend.
FROM runtime AS integration

COPY nginx.http.conf /etc/nginx/api.conf
COPY --from=integration-build /app/dist /usr/share/nginx/html
