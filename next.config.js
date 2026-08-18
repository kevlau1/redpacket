/** @type {import('next').NextConfig} */
// The Content-Security-Policy lives in src/proxy.ts: it needs a per-request nonce,
// which static headers cannot carry.
const nextConfig = {
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
