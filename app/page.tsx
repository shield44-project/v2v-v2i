const routes = [
  { href: "/login", label: "Login Gateway" },
  { href: "/user-portal", label: "Role Hub" },
  { href: "/control", label: "Control Center" },
  { href: "/admin", label: "Admin Operations" },
  { href: "/admin-preview", label: "Live Public Preview" },
  { href: "/emergency", label: "Emergency Unit" },
  { href: "/signal", label: "Signal Node" },
  { href: "/vehicle1", label: "Vehicle 1" },
  { href: "/vehicle2", label: "Vehicle 2" }
];

export default function Home() {
  return (
    <main className="page">
      <div className="card">
        <h1>V2X Connect Mission Console</h1>
        <p>
          Native Next.js routes now power every role module, with upgraded GPS filtering,
          cleaner control surfaces, and faster route transitions for live simulation ops.
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
