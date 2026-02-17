import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type EventType = "page_visit" | "qr_generated" | "qr_downloaded";

interface AnalyticsRow {
  created_at: string;
  event_type: EventType;
  session_id: string;
  payload: Record<string, unknown> | null;
  user_agent: string | null;
  referrer: string | null;
}

interface AdminPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function readDomain(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function formatDay(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function countByType(eventType: EventType, fromIso: string): Promise<number> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return 0;
  }

  const { count } = await supabase
    .from("analytics_events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", eventType)
    .gte("created_at", fromIso);

  return count ?? 0;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const expectedKey = process.env.ADMIN_DASHBOARD_KEY;
  const providedKey = Array.isArray(params.key) ? params.key[0] : params.key;
  const isAuthorized = !expectedKey || providedKey === expectedKey;

  if (!isAuthorized) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.title}>Admin Access Required</h1>
          <p style={styles.muted}>
            Add `?key=YOUR_ADMIN_DASHBOARD_KEY` to open this page.
          </p>
          <Link href="/" style={styles.backLink}>
            Back to app
          </Link>
        </section>
      </main>
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.title}>Admin Dashboard</h1>
          <p style={styles.muted}>
            Supabase environment values are missing. Set them in `.env.local`.
          </p>
          <Link href="/" style={styles.backLink}>
            Back to app
          </Link>
        </section>
      </main>
    );
  }

  const now = new Date();
  const last14Days = new Date(now);
  last14Days.setDate(now.getDate() - 13);
  const fromIso = last14Days.toISOString();

  const { data: recentEvents, error: recentEventsError } = await supabase
    .from("analytics_events")
    .select("created_at,event_type,session_id,payload,user_agent,referrer")
    .order("created_at", { ascending: false })
    .limit(120);

  if (recentEventsError) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.title}>Admin Dashboard</h1>
          <p style={styles.error}>Could not load analytics data.</p>
          <p style={styles.muted}>Error: {recentEventsError.message}</p>
        </section>
      </main>
    );
  }

  const rows = (recentEvents ?? []) as AnalyticsRow[];
  const totalEvents = rows.length;
  const uniqueSessions = new Set(rows.map((event) => event.session_id)).size;
  const [pageVisits14d, generated14d, downloaded14d] = await Promise.all([
    countByType("page_visit", fromIso),
    countByType("qr_generated", fromIso),
    countByType("qr_downloaded", fromIso),
  ]);

  const domainCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.event_type !== "qr_generated") {
      continue;
    }

    const domain = readDomain(row.payload?.destinationUrl);
    if (!domain) {
      continue;
    }

    const current = domainCounts.get(domain) ?? 0;
    domainCounts.set(domain, current + 1);
  }

  const topDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const dateBuckets = new Map<string, number>();
  for (let index = 0; index < 14; index += 1) {
    const day = new Date(last14Days);
    day.setDate(last14Days.getDate() + index);
    const iso = day.toISOString().slice(0, 10);
    dateBuckets.set(iso, 0);
  }

  for (const row of rows) {
    const day = row.created_at.slice(0, 10);
    if (!dateBuckets.has(day)) {
      continue;
    }

    const current = dateBuckets.get(day) ?? 0;
    dateBuckets.set(day, current + 1);
  }

  const trend = Array.from(dateBuckets.entries()).map(([day, count]) => ({
    day,
    count,
  }));
  const maxTrendCount = Math.max(...trend.map((item) => item.count), 1);

  return (
    <main style={styles.page}>
      <section style={styles.headerCard}>
        <div>
          <p style={styles.badge}>QuickQR Admin</p>
          <h1 style={styles.title}>Usage Dashboard</h1>
          <p style={styles.muted}>Last refresh: {formatDateTime(new Date().toISOString())}</p>
        </div>
        <Link href="/" style={styles.backLink}>
          Back to app
        </Link>
      </section>

      <section style={styles.kpiGrid}>
        <article style={styles.kpiCard}>
          <p style={styles.kpiLabel}>Events Loaded</p>
          <p style={styles.kpiValue}>{totalEvents}</p>
        </article>
        <article style={styles.kpiCard}>
          <p style={styles.kpiLabel}>Unique Sessions</p>
          <p style={styles.kpiValue}>{uniqueSessions}</p>
        </article>
        <article style={styles.kpiCard}>
          <p style={styles.kpiLabel}>QR Generated (14d)</p>
          <p style={styles.kpiValue}>{generated14d}</p>
        </article>
        <article style={styles.kpiCard}>
          <p style={styles.kpiLabel}>QR Downloaded (14d)</p>
          <p style={styles.kpiValue}>{downloaded14d}</p>
        </article>
        <article style={styles.kpiCard}>
          <p style={styles.kpiLabel}>Page Visits (14d)</p>
          <p style={styles.kpiValue}>{pageVisits14d}</p>
        </article>
      </section>

      <section style={styles.twoCol}>
        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Daily Events (14 days)</h2>
          <div style={styles.trendBars}>
            {trend.map((item) => (
              <div key={item.day} style={styles.trendItem}>
                <div
                  style={{
                    ...styles.trendBar,
                    height: `${Math.max((item.count / maxTrendCount) * 180, 6)}px`,
                  }}
                  title={`${item.count} events`}
                />
                <p style={styles.trendLabel}>{formatDay(item.day)}</p>
              </div>
            ))}
          </div>
        </article>

        <article style={styles.card}>
          <h2 style={styles.cardTitle}>Top Destination Domains</h2>
          {topDomains.length === 0 ? (
            <p style={styles.muted}>No generated-link domains yet.</p>
          ) : (
            <ul style={styles.domainList}>
              {topDomains.map(([domain, count]) => (
                <li key={domain} style={styles.domainItem}>
                  <span>{domain}</span>
                  <strong>{count}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Recent Activity</h2>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>When</th>
                <th style={styles.th}>Event</th>
                <th style={styles.th}>Session</th>
                <th style={styles.th}>Domain</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((row, idx) => (
                <tr key={`${row.created_at}-${idx}`}>
                  <td style={styles.td}>{formatDateTime(row.created_at)}</td>
                  <td style={styles.td}>{row.event_type}</td>
                  <td style={styles.tdMono}>{row.session_id.slice(0, 8)}...</td>
                  <td style={styles.td}>
                    {readDomain(row.payload?.destinationUrl) ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    width: "100%",
    minHeight: "100vh",
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "2rem 1rem 2.5rem",
    display: "grid",
    gap: "1rem",
  },
  headerCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    flexWrap: "wrap",
    background: "rgba(255,255,255,0.78)",
    border: "1px solid rgba(255,255,255,0.75)",
    borderRadius: "20px",
    padding: "1rem 1.2rem",
  },
  badge: {
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--brand-strong)",
    fontSize: "0.75rem",
    marginBottom: "0.4rem",
  },
  title: {
    fontSize: "clamp(1.4rem, 3vw, 2rem)",
    lineHeight: 1.1,
  },
  muted: {
    color: "var(--ink-soft)",
    marginTop: "0.35rem",
  },
  error: {
    color: "var(--danger)",
    fontWeight: 700,
    marginTop: "0.35rem",
  },
  backLink: {
    fontWeight: 700,
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "0.5rem 0.8rem",
    background: "white",
  },
  kpiGrid: {
    display: "grid",
    gap: "0.8rem",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  },
  kpiCard: {
    background: "rgba(255,255,255,0.84)",
    border: "1px solid rgba(255,255,255,0.75)",
    borderRadius: "16px",
    padding: "0.8rem",
  },
  kpiLabel: {
    color: "var(--ink-soft)",
    fontSize: "0.82rem",
  },
  kpiValue: {
    fontSize: "1.35rem",
    fontWeight: 800,
    marginTop: "0.2rem",
  },
  twoCol: {
    display: "grid",
    gap: "0.9rem",
    gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
  },
  card: {
    background: "rgba(255,255,255,0.85)",
    border: "1px solid rgba(255,255,255,0.75)",
    borderRadius: "16px",
    padding: "0.9rem",
  },
  cardTitle: {
    fontSize: "1rem",
    marginBottom: "0.7rem",
  },
  trendBars: {
    minHeight: "230px",
    display: "flex",
    alignItems: "flex-end",
    gap: "0.55rem",
    overflowX: "auto",
    paddingBottom: "0.25rem",
  },
  trendItem: {
    width: "36px",
    display: "grid",
    justifyItems: "center",
    gap: "0.28rem",
  },
  trendBar: {
    width: "100%",
    minHeight: "6px",
    borderRadius: "10px",
    background: "linear-gradient(180deg, var(--brand) 0%, var(--brand-strong) 100%)",
  },
  trendLabel: {
    fontSize: "0.68rem",
    color: "#334155",
    writingMode: "vertical-rl",
    transform: "rotate(180deg)",
    height: "58px",
    textAlign: "center",
  },
  domainList: {
    listStyle: "none",
    display: "grid",
    gap: "0.5rem",
  },
  domainItem: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px dashed #cbd5e1",
    paddingBottom: "0.3rem",
    fontFamily: "var(--font-jetbrains-mono), monospace",
    fontSize: "0.85rem",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "700px",
  },
  th: {
    textAlign: "left",
    fontSize: "0.8rem",
    color: "#475569",
    padding: "0.45rem",
    borderBottom: "1px solid #dbe3ec",
  },
  td: {
    fontSize: "0.87rem",
    padding: "0.45rem",
    borderBottom: "1px solid #eef2f7",
  },
  tdMono: {
    fontSize: "0.82rem",
    padding: "0.45rem",
    borderBottom: "1px solid #eef2f7",
    fontFamily: "var(--font-jetbrains-mono), monospace",
  },
};
