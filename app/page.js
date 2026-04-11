const routes = [
  { href: "/index.html", label: "Legacy Main Dashboard (Direct HTML)" },
  { href: "/login", label: "Login" },
  { href: "/admin", label: "Admin Panel" },
  { href: "/admin-preview", label: "Admin Preview" },
  { href: "/control", label: "Control Center" },
  { href: "/user-portal", label: "User Portal" },
  { href: "/emergency", label: "Emergency Vehicle" },
  { href: "/signal", label: "Signal Node" },
  { href: "/vehicle1", label: "Vehicle 1" },
  { href: "/vehicle2", label: "Vehicle 2" }
];

export default function Home() {
  return (
    <main className="page">
      <div className="card">
        <h1>V2X Connect on Next.js</h1>
        <p>
          Your existing multi-page simulation now runs under Next.js routes.
          Each module route is now hosted by the App Router while preserving
          your legacy logic and assets.
        </p>

        <ul className="routes">
          {routes.map((route) => (
            <li key={route.href}>
              <a href={route.href}>{route.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
