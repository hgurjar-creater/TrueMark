/** @type {import('next').NextConfig} */
const nextConfig = {
  // These packages use native/runtime resources and are loaded by server routes.
  experimental: {
    serverComponentsExternalPackages: ['mammoth', 'pdf-parse', 'sharp'],
  },
};

export default nextConfig;
