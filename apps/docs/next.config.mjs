import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  // Static export — the site is served as plain files by the existing Caddy
  // instance. No Node.js server is added to docker-compose.prod.yml.
  output: 'export',
  reactStrictMode: true,
  // `next/image` optimisation requires a server; static export must opt out.
  images: {
    unoptimized: true,
  },
};

export default withMDX(config);
