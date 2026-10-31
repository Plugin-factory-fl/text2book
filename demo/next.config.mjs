/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: isGitHubPages ? '/text2book' : '',
  assetPrefix: isGitHubPages ? '/text2book/' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
