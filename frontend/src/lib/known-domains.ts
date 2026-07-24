/**
 * Offline fallback list for scan-bar autocomplete.
 * Prefer the live MCDA registry (`GET /api/v1/registry/suggestions`) when available.
 */

export interface KnownDomain {
  /** Official display name */
  name: string;
  /** Canonical scan URL (must include https:// and end in .go.ke / .gov.ke) */
  url: string;
  /** Common search aliases / nicknames (lowercase preferred) */
  aliases: string[];
}

export const KNOWN_DOMAINS: readonly KnownDomain[] = [
  {
    name: "ICT Authority",
    url: "https://www.ict.go.ke",
    aliases: ["ict", "icta", "ict authority", "information"],
  },
  {
    name: "eCitizen (accounts)",
    url: "https://accounts.ecitizen.go.ke/",
    aliases: ["ecitizen", "e-citizen", "e citizen", "accounts"],
  },
  {
    name: "eCitizen",
    url: "https://www.ecitizen.go.ke",
    aliases: ["ecitizen portal", "ecitizen home"],
  },
  {
    name: "Kenya Revenue Authority",
    url: "https://www.kra.go.ke",
    aliases: ["kra", "tax", "revenue", "iTax", "itax"],
  },
  {
    name: "Ministry of Health",
    url: "https://www.health.go.ke",
    aliases: ["health", "moh", "ministry of health"],
  },
  {
    name: "Ministry of Education",
    url: "https://www.education.go.ke",
    aliases: ["education", "moe", "ministry of education"],
  },
  {
    name: "The National Treasury",
    url: "https://www.treasury.go.ke",
    aliases: ["treasury", "finance", "national treasury"],
  },
  {
    name: "Directorate of Immigration Services",
    url: "https://immigration.go.ke",
    aliases: ["immigration", "passport", "visa"],
  },
  {
    name: "Communications Authority of Kenya",
    url: "https://www.ca.go.ke",
    aliases: ["ca", "communications", "cak"],
  },
  {
    name: "National Police Service",
    url: "https://www.nationalpolice.go.ke",
    aliases: ["police", "nps", "national police"],
  },
  {
    name: "Parliament of Kenya",
    url: "https://www.parliament.go.ke",
    aliases: ["parliament", "national assembly", "senate"],
  },
  {
    name: "Judiciary of Kenya",
    url: "https://www.judiciary.go.ke",
    aliases: ["judiciary", "courts", "chief justice"],
  },
  {
    name: "State House Kenya",
    url: "https://www.president.go.ke",
    aliases: ["president", "state house", "presidency"],
  },
  {
    name: "Ministry of Interior",
    url: "https://www.interior.go.ke",
    aliases: ["interior", "ministry of interior", "home affairs"],
  },
  {
    name: "Ministry of Lands",
    url: "https://www.lands.go.ke",
    aliases: ["lands", "ministry of lands", "ardhi"],
  },
  {
    name: "Ministry of Agriculture",
    url: "https://www.kilimo.go.ke",
    aliases: ["kilimo", "agriculture", "farming"],
  },
  {
    name: "Ministry of Transport",
    url: "https://www.transport.go.ke",
    aliases: ["transport", "mot", "ministry of transport"],
  },
  {
    name: "Ministry of Defence",
    url: "https://www.mod.go.ke",
    aliases: ["defence", "defense", "mod", "military"],
  },
  {
    name: "Ministry of Foreign Affairs",
    url: "https://www.mfa.go.ke",
    aliases: ["mfa", "foreign affairs", "diplomacy"],
  },
  {
    name: "Huduma Kenya",
    url: "https://www.hudumakenya.go.ke",
    aliases: ["huduma", "huduma kenya", "huduma centre"],
  },
  {
    name: "Teachers Service Commission",
    url: "https://www.tsc.go.ke",
    aliases: ["tsc", "teachers", "teachers service"],
  },
  {
    name: "Public Service Commission",
    url: "https://www.publicservice.go.ke",
    aliases: ["psc", "public service", "publicservice"],
  },
  {
    name: "myGov Kenya",
    url: "https://www.mygov.go.ke",
    aliases: ["mygov", "my gov", "government portal"],
  },
  {
    name: "Ministry of Energy",
    url: "https://www.energy.go.ke",
    aliases: ["energy", "power", "ministry of energy"],
  },
  {
    name: "Ministry of Water",
    url: "https://www.water.go.ke",
    aliases: ["water", "sanitation", "ministry of water"],
  },
  {
    name: "Ministry of Tourism",
    url: "https://www.tourism.go.ke",
    aliases: ["tourism", "ministry of tourism"],
  },
  {
    name: "Ministry of Labour",
    url: "https://www.labour.go.ke",
    aliases: ["labour", "labor", "ministry of labour", "employment"],
  },
  {
    name: "National Land Commission",
    url: "https://www.nlc.go.ke",
    aliases: ["nlc", "national land", "land commission"],
  },
  {
    name: "Kenya National Bureau of Statistics",
    url: "https://www.knbs.go.ke",
    aliases: ["knbs", "statistics", "census"],
  },
  {
    name: "Office of the Attorney General",
    url: "https://www.statelaw.go.ke",
    aliases: ["attorney general", "statelaw", "state law", "ag"],
  },
] as const;

const MIN_QUERY_LEN = 2;

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/[^a-z0-9.]+/g, "");
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function scoreMatch(entry: KnownDomain, queryRaw: string): number {
  const q = normalizeKey(queryRaw);
  if (q.length < MIN_QUERY_LEN) return 0;

  const host = hostFromUrl(entry.url);
  const nameKey = normalizeKey(entry.name);
  let best = 0;

  for (const alias of entry.aliases) {
    const a = normalizeKey(alias);
    if (!a) continue;
    if (a === q) best = Math.max(best, 100);
    else if (a.startsWith(q)) best = Math.max(best, 90);
    else if (a.includes(q)) best = Math.max(best, 70);
  }

  if (host === q || host.startsWith(q)) best = Math.max(best, 85);
  else if (host.includes(q)) best = Math.max(best, 65);

  if (nameKey.startsWith(q)) best = Math.max(best, 75);
  else if (nameKey.includes(q)) best = Math.max(best, 55);

  return best;
}

/** Best matching known domain for the typed query, or null if none. */
export function matchKnownDomain(query: string): KnownDomain | null {
  const matches = matchKnownDomains(query, 1);
  return matches[0] ?? null;
}

/** Ranked substring / alias matches (highest score first). */
export function matchKnownDomains(
  query: string,
  limit = 5,
): KnownDomain[] {
  const trimmed = query.trim();
  if (normalizeKey(trimmed).length < MIN_QUERY_LEN) return [];

  // If the field already holds an exact known URL, don't nag with suggestions.
  const exactUrl = KNOWN_DOMAINS.find(
    (d) => normalizeKey(d.url) === normalizeKey(trimmed),
  );
  if (exactUrl) return [];

  return KNOWN_DOMAINS.map((entry) => ({
    entry,
    score: scoreMatch(entry, trimmed),
  }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map((r) => r.entry);
}
