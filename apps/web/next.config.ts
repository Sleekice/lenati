import type { NextConfig } from 'next';

const config: NextConfig = {
  // the graph package ships TypeScript source
  transpilePackages: ['@lenati/graph'],
  serverExternalPackages: ['@prisma/client'],
  async redirects() {
    // the Sprint 1 atlas is the existing three.js prototype, served as a static page;
    // it loads its meshes from "models/" relative to itself
    return [{ source: '/atlas', destination: '/atlas/index.html', permanent: false }];
  },
};
export default config;
