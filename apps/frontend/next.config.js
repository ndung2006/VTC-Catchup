/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone cho Docker runner gọn nhẹ (Phase 6).
  output: 'standalone',
  // Proxy /api/* về backend để cookie HttpOnly đi cùng origin (không CORS).
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.VTC_API_ORIGIN ?? 'http://127.0.0.1:8080'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
