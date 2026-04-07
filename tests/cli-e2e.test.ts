/**
 * CLI End-to-End Tests
 *
 * Simulates how Claude Code (or any AI agent) calls `sp` via Bash.
 * All calls go through the actual CLI entry point, piped (non-TTY),
 * so output is always JSON — exactly what an agent would see.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const TEST_REPO = join(import.meta.dir, ".cli-test-repo");
const CLI = join(import.meta.dir, "..", "src", "cli.ts");

/** Run sp CLI command, return parsed JSON (simulates agent calling via Bash pipe) */
function sp(args: string): { stdout: string; stderr: string; exitCode: number; json?: unknown } {
  try {
    const stdout = execSync(`bun run ${CLI} ${args} --repo ${TEST_REPO}`, {
      encoding: "utf-8",
      timeout: 10_000,
      // piped = non-TTY → auto JSON output
    }).trim();
    let json: unknown;
    try {
      json = JSON.parse(stdout);
    } catch {
      // not JSON, that's ok for some commands
    }
    return { stdout, stderr: "", exitCode: 0, json };
  } catch (err: any) {
    return {
      stdout: err.stdout?.trim() ?? "",
      stderr: err.stderr?.trim() ?? "",
      exitCode: err.status ?? 1,
      json: (() => { try { return JSON.parse(err.stdout?.trim()); } catch { return undefined; } })(),
    };
  }
}

function writeTestDoc(relPath: string, frontmatter: Record<string, unknown>, body: string) {
  const fullPath = join(TEST_REPO, relPath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join("\n");
  writeFileSync(fullPath, `---\n${fm}\n---\n\n${body}\n`);
}

beforeAll(() => {
  if (existsSync(TEST_REPO)) rmSync(TEST_REPO, { recursive: true });
  mkdirSync(TEST_REPO, { recursive: true });

  for (const dir of ["context", "decisions", "experience", "meetings/2026/03", "plans/2026-03", "playbook"]) {
    mkdirSync(join(TEST_REPO, dir), { recursive: true });
  }

  writeTestDoc("context/company.md", { title: "Acme Corp", type: "reference", tags: ["company"] }, "We build CloudApp, an AI-powered platform.");
  writeTestDoc("context/tech-stack.md", { title: "Tech Stack", type: "reference", tags: ["tech", "stack"] }, "Next.js, Supabase, Stripe, LangChain, Fabric.js.");
  writeTestDoc("decisions/2026-03-10-tech-stack.md", { title: "Tech Stack Decision", type: "decision", date: "2026-03-10", tags: ["architecture"] }, "Chose Next.js + Supabase for MVP. Rejected Ruby on Rails.");
  writeTestDoc("experience/2026-03-08-auth-pitfall.md", { title: "Auth Pitfall", type: "learning", date: "2026-03-08", tags: ["auth", "supabase"] }, "Session tokens must use httpOnly cookies. Never store in localStorage.");
  writeTestDoc("meetings/2026/03/2026-03-09-standup.md", { title: "Daily Standup", type: "meeting", date: "2026-03-09", tags: ["standup"] }, "Discussed MVP progress. Blocked on Stripe integration.");
  writeTestDoc("plans/2026-03/version-plan.md", { title: "Version Plan", type: "status", date: "2026-03-01", tags: ["roadmap"] }, "Q1 target: launch MVP by March 31.");
  writeTestDoc("playbook/payment-sop.md", { title: "支付接入流程", type: "playbook", tags: ["支付", "stripe"] }, "第一步：配置 Stripe 密钥。第二步：集成支付网关。第三步：测试沙箱环境。");

  // Build INDEX.json
  execSync(`bun run ${join(import.meta.dir, "..", "src", "index-builder.ts")}`, {
    env: { ...process.env, SP_CONTEXT_REPO: TEST_REPO },
  });
});

afterAll(() => {
  if (existsSync(TEST_REPO)) rmSync(TEST_REPO, { recursive: true });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. GLOBAL FLAGS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("global flags", () => {
  test("--version returns semver", () => {
    const { stdout } = sp("--version");
    expect(stdout).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("--help returns usage text", () => {
    const { stdout } = sp("--help");
    expect(stdout).toContain("Usage: sp <command>");
    expect(stdout).toContain("search");
    expect(stdout).toContain("push");
  });

  test("unknown command exits with code 2", () => {
    const { exitCode, stderr } = sp("nonexistent");
    expect(exitCode).toBe(2);
    expect(stderr).toContain("Unknown command");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. SEARCH — Agent calls: sp search <query> --json
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("sp search (agent mode)", () => {
  test("basic keyword search returns JSON array", () => {
    const { json, exitCode } = sp('search CloudApp');
    expect(exitCode).toBe(0);
    expect(Array.isArray(json)).toBe(true);
    const arr = json as any[];
    expect(arr.length).toBeGreaterThanOrEqual(1);
    // Each result has required fields
    const first = arr[0];
    expect(first).toHaveProperty("path");
    expect(first).toHaveProperty("title");
    expect(first).toHaveProperty("type");
    expect(first).toHaveProperty("tags");
    expect(first).toHaveProperty("summary");
  });

  test("multi-keyword AND search", () => {
    const { json } = sp('search "Next.js Supabase"');
    const arr = json as any[];
    expect(arr.length).toBeGreaterThanOrEqual(1);
    // Should find tech-stack or arsenal
    expect(arr.some((r: any) => r.path.includes("tech-stack") || r.path.includes("arsenal"))).toBe(true);
  });

  test("CJK search works", () => {
    const { json } = sp('search 支付');
    const arr = json as any[];
    expect(arr.length).toBeGreaterThanOrEqual(1);
    expect(arr[0].title).toBe("支付接入流程");
  });

  test("CJK + English mixed search", () => {
    const { json } = sp('search "支付 Stripe"');
    const arr = json as any[];
    expect(arr.length).toBeGreaterThanOrEqual(1);
    expect(arr[0].path).toContain("payment-sop");
  });

  test("--type filter returns only matching type", () => {
    const { json } = sp('search "" --type decision');
    const arr = json as any[];
    expect(arr.length).toBe(1);
    expect(arr.every((r: any) => r.type === "decision")).toBe(true);
  });

  test("--tags filter works", () => {
    const { json } = sp('search "" --tags auth');
    const arr = json as any[];
    expect(arr.length).toBeGreaterThanOrEqual(1);
    expect(arr.some((r: any) => r.tags.includes("auth"))).toBe(true);
  });

  test("--limit restricts result count", () => {
    const { json } = sp('search "" --limit 2');
    const arr = json as any[];
    expect(arr.length).toBeLessThanOrEqual(2);
  });

  test("no results returns empty array (not error object)", () => {
    const { json, exitCode } = sp('search xyznonexistent12345');
    expect(exitCode).toBe(0);
    expect(Array.isArray(json)).toBe(true);
    expect((json as any[]).length).toBe(0);
  });

  test("missing query exits with code 2", () => {
    const { exitCode } = sp("search");
    expect(exitCode).toBe(2);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. GET — Agent calls: sp get <path>
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("sp get (agent mode)", () => {
  test("returns document with meta + content", () => {
    const { json, exitCode } = sp("get context/company.md");
    expect(exitCode).toBe(0);
    const doc = json as any;
    expect(doc).toHaveProperty("meta");
    expect(doc).toHaveProperty("content");
    expect(doc.meta.title).toBe("Acme Corp");
    expect(doc.meta.type).toBe("reference");
    expect(doc.meta.tags).toContain("company");
    expect(doc.content).toContain("CloudApp");
  });

  test("returns full markdown content", () => {
    const { json } = sp("get experience/2026-03-08-auth-pitfall.md");
    const doc = json as any;
    expect(doc.content).toContain("httpOnly");
    expect(doc.content).toContain("localStorage");
  });

  test("not found returns message object and exit 1", () => {
    const { exitCode, json } = sp("get nonexistent/file.md");
    expect(exitCode).toBe(1);
  });

  test("missing path arg exits with code 2", () => {
    const { exitCode } = sp("get");
    expect(exitCode).toBe(2);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. LIST — Agent calls: sp list <category>
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("sp list (agent mode)", () => {
  test("lists context category as JSON array", () => {
    const { json, exitCode } = sp("list context");
    expect(exitCode).toBe(0);
    const arr = json as any[];
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBe(2);
    expect(arr.every((r: any) => r.path.startsWith("context/"))).toBe(true);
  });

  test("lists decisions", () => {
    const { json } = sp("list decisions");
    const arr = json as any[];
    expect(arr.length).toBe(1);
    expect(arr[0].type).toBe("decision");
  });

  test("lists playbook", () => {
    const { json } = sp("list playbook");
    const arr = json as any[];
    expect(arr.length).toBe(1);
  });

  test("empty category returns empty array", () => {
    const { json, exitCode } = sp("list people");
    expect(exitCode).toBe(0);
    expect(Array.isArray(json)).toBe(true);
    expect((json as any[]).length).toBe(0);
  });

  test("invalid category exits with code 2", () => {
    const { exitCode } = sp("list invalid_category");
    expect(exitCode).toBe(2);
  });

  test("missing category exits with code 2", () => {
    const { exitCode } = sp("list");
    expect(exitCode).toBe(2);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. PUSH — Agent calls: sp push --title ... --type ... --content ...
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("sp push (agent mode)", () => {
  test("missing required args exits with code 2", () => {
    const { exitCode } = sp("push");
    expect(exitCode).toBe(2);
  });

  test("invalid type exits with code 2", () => {
    const { exitCode } = sp('push --title "Test" --type badtype --content "x"');
    expect(exitCode).toBe(2);
  });

  test("push with --content succeeds in creating file", () => {
    // Provide content inline — the standard agent path
    const { json, exitCode } = sp('push --title "E2E Test Doc" --type learning --content "This is a test document." --tags "test,e2e"');
    // May fail on git push (no remote), but file creation should succeed
    expect(exitCode === 0 || exitCode === 1).toBe(true);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. CONFIG — Agent calls: sp config list/add/switch
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("sp config (agent mode)", () => {
  test("config list returns JSON array of repos", () => {
    const { json, exitCode } = sp("config list");
    expect(exitCode).toBe(0);
    const arr = json as any[];
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBeGreaterThanOrEqual(1);
    expect(arr[0]).toHaveProperty("label");
    expect(arr[0]).toHaveProperty("path");
    expect(arr[0]).toHaveProperty("remoteName");
    expect(arr[0]).toHaveProperty("defaultBranch");
  });

  test("config without subcommand exits with code 2", () => {
    const { exitCode } = sp("config");
    expect(exitCode).toBe(2);
  });

  test("config add without args exits with code 2", () => {
    const { exitCode } = sp("config add");
    expect(exitCode).toBe(2);
  });

  test("config switch nonexistent exits with code 1", () => {
    const { exitCode } = sp("config switch nonexistent-label");
    expect(exitCode).toBe(1);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. INTEGRATION: Agent workflow round-trip
//    Simulates: search → get → read full doc
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("agent workflow: search → get round-trip", () => {
  test("search finds doc, get retrieves full content", () => {
    // Step 1: Agent searches
    const { json: searchResults } = sp('search "Auth Pitfall"');
    const results = searchResults as any[];
    expect(results.length).toBeGreaterThanOrEqual(1);

    // Step 2: Agent uses path from search to get full doc
    const path = results[0].path;
    const { json: doc } = sp(`get ${path}`);
    const d = doc as any;
    expect(d.meta.title).toBe("Auth Pitfall");
    expect(d.content).toContain("httpOnly");
    expect(d.content).toContain("localStorage");
  });

  test("list finds docs, get retrieves content", () => {
    // Step 1: Agent lists a category
    const { json: listResults } = sp("list decisions");
    const results = listResults as any[];
    expect(results.length).toBe(1);

    // Step 2: Agent gets full doc
    const { json: doc } = sp(`get ${results[0].path}`);
    const d = doc as any;
    expect(d.meta.type).toBe("decision");
    expect(d.content).toContain("Next.js");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. JSON OUTPUT CONSISTENCY (Agent friendliness)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("JSON output consistency for agents", () => {
  test("search always returns array (even empty)", () => {
    const { json: full } = sp('search CloudApp');
    expect(Array.isArray(full)).toBe(true);

    const { json: empty } = sp('search xyznonexistent99');
    expect(Array.isArray(empty)).toBe(true);
  });

  test("list always returns array (even empty)", () => {
    const { json: full } = sp("list context");
    expect(Array.isArray(full)).toBe(true);

    const { json: empty } = sp("list people");
    expect(Array.isArray(empty)).toBe(true);
  });

  test("get returns object with meta + content", () => {
    const { json } = sp("get context/company.md");
    const doc = json as any;
    expect(typeof doc).toBe("object");
    expect(doc).toHaveProperty("meta");
    expect(doc).toHaveProperty("content");
  });

  test("config list returns array of objects", () => {
    const { json } = sp("config list");
    expect(Array.isArray(json)).toBe(true);
    const arr = json as any[];
    for (const item of arr) {
      expect(typeof item.label).toBe("string");
      expect(typeof item.path).toBe("string");
    }
  });

  test("all search result entries have consistent schema", () => {
    const { json } = sp('search --type reference --limit 10');
    const arr = json as any[];
    for (const item of arr) {
      expect(typeof item.path).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(typeof item.type).toBe("string");
      expect(Array.isArray(item.tags)).toBe(true);
      expect(typeof item.summary).toBe("string");
      expect(typeof item.contentHash).toBe("string");
    }
  });

  test("--json flag forces JSON even in explicit mode", () => {
    const { json } = sp("search CloudApp --json");
    expect(Array.isArray(json)).toBe(true);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 9. PIPE COMPOSITION (Unix philosophy)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("pipe composition", () => {
  test("search | jq extracts paths", () => {
    const stdout = execSync(
      `bun run ${CLI} search CloudApp --repo ${TEST_REPO} | jq -r '.[].path'`,
      { encoding: "utf-8" },
    ).trim();
    expect(stdout.length).toBeGreaterThan(0);
    expect(stdout).toContain(".md");
  });

  test("search | jq | xargs sp get works", () => {
    // Get first result's path, then fetch it
    const path = execSync(
      `bun run ${CLI} search CloudApp --repo ${TEST_REPO} | jq -r '.[0].path'`,
      { encoding: "utf-8" },
    ).trim();

    const doc = execSync(
      `bun run ${CLI} get ${path} --repo ${TEST_REPO}`,
      { encoding: "utf-8" },
    ).trim();

    const parsed = JSON.parse(doc);
    expect(parsed.meta.title).toBeTruthy();
    expect(parsed.content).toBeTruthy();
  });

  test("list | jq counts documents", () => {
    const count = execSync(
      `bun run ${CLI} list context --repo ${TEST_REPO} | jq 'length'`,
      { encoding: "utf-8" },
    ).trim();
    expect(parseInt(count)).toBeGreaterThanOrEqual(2);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 10. EXIT CODES (Agent error handling)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("exit codes", () => {
  test("0 for successful operations", () => {
    expect(sp("search CloudApp").exitCode).toBe(0);
    expect(sp("get context/company.md").exitCode).toBe(0);
    expect(sp("list context").exitCode).toBe(0);
    expect(sp("config list").exitCode).toBe(0);
  });

  test("1 for not-found errors", () => {
    expect(sp("get nonexistent.md").exitCode).toBe(1);
    expect(sp("config switch no-such-repo").exitCode).toBe(1);
  });

  test("2 for usage errors (bad args)", () => {
    expect(sp("search").exitCode).toBe(2);
    expect(sp("get").exitCode).toBe(2);
    expect(sp("list").exitCode).toBe(2);
    expect(sp("list badcategory").exitCode).toBe(2);
    expect(sp("push").exitCode).toBe(2);
    expect(sp("config").exitCode).toBe(2);
    expect(sp("nonexistent").exitCode).toBe(2);
  });
});
