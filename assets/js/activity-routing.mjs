/** Match the same activity on file-based hosts and Vercel clean URLs. */
export function matchesActivityPath(pathname, activityPath) {
  if (typeof pathname !== 'string' || typeof activityPath !== 'string') return false;
  const canonical = value => value.replace(/\.html$/, '');
  return canonical(pathname) === canonical(activityPath);
}
