/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/legacy/admin", destination: "/admin.html" },
      { source: "/legacy/admin-preview", destination: "/admin-preview.html" },
      { source: "/legacy/control", destination: "/control.html" },
      { source: "/legacy/emergency", destination: "/emergency.html" },
      { source: "/legacy/login", destination: "/login.html" },
      { source: "/legacy/signal", destination: "/signal.html" },
      { source: "/legacy/user-portal", destination: "/user-portal.html" },
      { source: "/legacy/vehicle1", destination: "/vehicle1.html" },
      { source: "/legacy/vehicle2", destination: "/vehicle2.html" }
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" }
        ]
      },
      {
        source: "/:path*.html",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "X-Content-Type-Options", value: "nosniff" }
        ]
      },
      {
        source: "/:path*.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" }
        ]
      }
    ];
  }
};

export default nextConfig;
