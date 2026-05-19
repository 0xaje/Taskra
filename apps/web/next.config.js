/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Rely on monorepo-level global linting script
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Rely on global turborepo typecheck scripts
    ignoreBuildErrors: true,
  }
};

module.exports = nextConfig;
