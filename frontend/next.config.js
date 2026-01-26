/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // API routes in src/app/api/ handle proxying to the backend
  // This ensures cookies are properly forwarded for authentication
};

module.exports = nextConfig;
