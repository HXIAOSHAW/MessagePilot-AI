/**
 * OrderPilot AI — Owner Dashboard (placeholder)
 *
 * TODO: Build the full dashboard UI here.
 * The backend API is live at http://localhost:3001
 *
 * Suggested components to build:
 * - DashboardSummaryCard: shows total messages, orders, complaints, open tasks
 * - OrderList: table of draft/confirmed orders
 * - ComplaintList: table of complaints with severity badges
 * - OwnerTaskList: open tasks with priority sorting
 * - TestMessageForm: send a test WhatsApp message to the agent (for demos)
 */

export default function DashboardPage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 8 }}>
        🎂 OrderPilot AI
      </h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        Owner Dashboard — Luna Bakery London
      </p>

      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "1.5rem", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#166534" }}>
          ✅ Backend is running
        </h2>
        <p style={{ margin: "0.5rem 0 0", color: "#166534", fontSize: "0.875rem" }}>
          API: <a href="http://localhost:3001/health" target="_blank" rel="noopener noreferrer">http://localhost:3001/health</a>
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <DashboardCard
          title="Quick links"
          items={[
            { label: "Health check", href: "http://localhost:3001/health" },
            { label: "Dashboard summary", href: "http://localhost:3001/dashboard/summary?business_id=demo_luna_bakery" },
          ]}
        />
        <DashboardCard
          title="Test flows"
          items={[
            { label: "Run order demo", href: "#", note: "bash scripts/demo_order_flow.sh" },
            { label: "Run complaint demo", href: "#", note: "bash scripts/demo_complaint_flow.sh" },
          ]}
        />
      </div>

      <p style={{ marginTop: 32, color: "#999", fontSize: "0.875rem" }}>
        TODO: Build the full dashboard UI in <code>apps/web/src/app/</code>.<br />
        See <code>docs/team_workplan.md</code> for the task list.
      </p>
    </main>
  );
}

function DashboardCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string; note?: string }[];
}) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "1.25rem" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "0.875rem", fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {title}
      </h3>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {items.map((item) => (
          <li key={item.label} style={{ marginBottom: 8 }}>
            <a
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              style={{ color: "#2563eb", textDecoration: "none", fontSize: "0.875rem" }}
            >
              {item.label}
            </a>
            {item.note && (
              <code style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginTop: 2 }}>
                {item.note}
              </code>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
