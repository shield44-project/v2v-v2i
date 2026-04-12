const overview = [
  { label: "Core Routes", value: "10", meta: "Main operational modules" },
  { label: "Emergency Flow", value: "Live", meta: "Priority preemption ready" },
  { label: "Data Link", value: "Realtime", meta: "Firebase synchronized" },
  { label: "Default Ranges", value: "25m / 50m", meta: "V2V and V2I" }
];

const quickNav = [
  { href: "/control", label: "Control" },
  { href: "/admin", label: "Admin" },
  { href: "/user-portal", label: "Roles" },
  { href: "/emergency", label: "Emergency" },
  { href: "/signal", label: "Signal" },
  { href: "/archive", label: "Archive" }
];

const sections = [
  {
    title: "Operations Dashboard",
    note: "Command surfaces for coordinators and administrators.",
    links: [
      { href: "/control", label: "Control Center", note: "Live map, event stream, ranges, and broadcast controls" },
      { href: "/admin", label: "Admin Operations", note: "User moderation, ban controls, and access management" },
      { href: "/user-portal", label: "Role Hub", note: "Fast routing into role-specific operating interfaces" }
    ]
  },
  {
    title: "Field Nodes",
    note: "Emergency, signal, and vehicle-side interaction points.",
    links: [
      { href: "/emergency", label: "Emergency Unit", note: "GPS uplink and preemption request broadcaster" },
      { href: "/signal", label: "Signal Node", note: "Intersection receiver and phase synchronization" },
      { href: "/vehicle1", label: "Vehicle 1", note: "Civilian node with guidance and alert feedback" },
      { href: "/vehicle2", label: "Vehicle 2", note: "Second civilian simulation and mirrored behavior" }
    ]
  },
  {
    title: "Access and Intelligence",
    note: "Authentication, public status, and historical references.",
    links: [
      { href: "/login", label: "Login Gateway", note: "Google authentication and privileged entry" },
      { href: "/admin-preview", label: "Public Preview", note: "Read-only telemetry and visibility endpoint" },
      { href: "/archive", label: "Archive Library", note: "Historical snapshots and migration documentation" }
    ]
  }
];

export default function Home() {
  return (
    <main className="page home-page">
      <div className="card home-main-card">
        <header className="home-nav">
          <div>
            <p className="home-kicker">Emergency Clearance Platform</p>
            <h1>V2X Command Dashboard</h1>
          </div>
          <nav className="home-nav-links" aria-label="Quick navigation">
            {quickNav.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </nav>
        </header>

        <section className="home-hero-panel">
          <p>
            The main page now acts as your index and operations board: launch core modules,
            monitor key system posture, and jump directly into emergency or admin workflows.
          </p>
          <div className="home-hero-actions">
            <a href="/control">Open Control Center</a>
            <a href="/user-portal">Open Role Hub</a>
          </div>
        </section>

        <section className="home-overview" aria-label="System overview">
          {overview.map((item) => (
            <article className="home-overview-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.meta}</small>
            </article>
          ))}
        </section>

        <div className="home-sections">
          {sections.map((section) => (
            <section className="home-section" key={section.title}>
              <div className="home-section-head">
                <h2>{section.title}</h2>
                <p>{section.note}</p>
              </div>

              <ul className="routes home-routes">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>
                      <div>{link.label}</div>
                      <small>{link.note}</small>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
