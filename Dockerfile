FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY src/ src/
COPY templates/ templates/
RUN bun build src/mcp-http.ts --outdir dist --target bun --entry-naming mcp-http.js

FROM oven/bun:1.3-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist/mcp-http.js ./dist/
COPY package.json ./
RUN bun install --production --frozen-lockfile

ENV PORT=3100
ENV HOST=0.0.0.0
EXPOSE 3100

CMD ["bun", "run", "dist/mcp-http.js"]
