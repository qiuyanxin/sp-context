import type { SpConfig } from "../utils/config.js";
import type { IndexEntry } from "../index-builder.js";
import { loadIndex } from "./search.js";

const VALID_CATEGORIES = ["context", "decisions", "experience", "meetings", "plans", "playbook", "clients", "people"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

export function list(
  config: SpConfig,
  category: string,
  project?: string,
): IndexEntry[] {
  if (!VALID_CATEGORIES.includes(category as Category)) {
    return [];
  }

  const index = loadIndex(config);

  let results = index.entries.filter((e) =>
    e.path.startsWith(category + "/"),
  );

  if (project) {
    results = results.filter(
      (e) => e.project === project || e.path.includes(`/${project}/`),
    );
  }

  // Sort by date descending
  results.sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0;
    const tb = b.date ? new Date(b.date).getTime() : 0;
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });

  return results;
}
