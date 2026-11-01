/**
 * Prefixes a path with the basePath for GitHub Pages deployment.
 * In development, basePath is empty. In production on GitHub Pages, it's '/text2book'.
 */
export function getAssetPath(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (path.startsWith('/')) {
    return `${basePath}${path}`;
  }
  return `${basePath}/${path}`;
}
