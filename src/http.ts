/**
 * Lightweight HTTP server — webhook + health + cron sync only.
 * No MCP transport. All tool calls go through the `sp` CLI.
 *
 * Usage:
 *   SP_CONTEXT_REPO=/path/to/repo SP_API_KEY=secret bun run src/http.ts
 */
import { createHmac } from "crypto";
import { execSync } from "child_process";
import express from "express";
import { writeIndex } from "./index-builder.js";

const PORT = parseInt(process.env.PORT ?? "3100");
const HOST = process.env.HOST ?? "0.0.0.0";
const API_KEY = process.env.SP_API_KEY;
const WEBHOOK_SECRET = process.env.SP_WEBHOOK_SECRET;
const REPO_PATH = process.env.SP_CONTEXT_REPO ?? `${process.env.HOME}/sp-context`;

const app = express();
// NOTE: no global express.json() — webhook needs raw body for HMAC verification

// ── Auto-sync: pull repo + rebuild index ─────────────────────
let lastSyncAt = 0;
const SYNC_COOLDOWN_MS = 5_000;

async function syncRepo(): Promise<string> {
  const now = Date.now();
  if (now - lastSyncAt < SYNC_COOLDOWN_MS) {
    return "skipped (cooldown)";
  }
  lastSyncAt = now;

  try {
    // Reset INDEX.json (auto-generated, may block pull)
    execSync("git checkout -- INDEX.json 2>/dev/null || true", { cwd: REPO_PATH, timeout: 5_000 });
    execSync("git pull --rebase --quiet", { cwd: REPO_PATH, timeout: 10_000 });
    writeIndex(REPO_PATH);
    return "synced";
  } catch (err) {
    console.error("[sync] failed:", err instanceof Error ? err.message : err);
    return "failed";
  }
}

// ── Health check ──────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  res.json({
    status: "ok",
    service: "sp-context",
    version: "1.2.0",
    lastSyncAt: lastSyncAt ? new Date(lastSyncAt).toISOString() : null,
  });
});

// ── GitHub Webhook: auto-sync on push ─────────────────────────
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const rawBody = req.body as Buffer;

  if (WEBHOOK_SECRET) {
    const sig = req.headers["x-hub-signature-256"] as string;
    if (!sig) {
      res.status(401).json({ error: "Missing signature" });
      return;
    }
    const expected = "sha256=" + createHmac("sha256", WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    if (sig !== expected) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  const body = JSON.parse(rawBody.toString("utf-8"));
  const event = req.headers["x-github-event"];
  if (event !== "push") {
    res.json({ status: "ignored", event });
    return;
  }

  console.log(`[webhook] push event from ${body?.pusher?.name ?? "unknown"}`);
  const result = await syncRepo();
  res.json({ status: result });
});

// ── API Key auth (for /sync endpoint) ────────────────────────
app.post("/sync", express.json(), async (req, res) => {
  if (API_KEY) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${API_KEY}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const result = await syncRepo();
  res.json({ status: result });
});

// ── Periodic sync (cron fallback, every 5 min) ───────────────
setInterval(() => {
  syncRepo().then((r) => {
    if (r === "synced") console.log("[cron] repo synced");
  });
}, 5 * 60 * 1000);

// Initial sync on startup
syncRepo().then((r) => console.log(`[startup] initial sync: ${r}`));

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`sp-context sync server listening on http://${HOST}:${PORT}`);
  console.log(`  Auth: ${API_KEY ? "API key required" : "OPEN (dev mode)"}`);
  console.log(`  Repo: ${REPO_PATH}`);
});
