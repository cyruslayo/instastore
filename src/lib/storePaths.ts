export function storePath(storeSlug: string, path = ''): string {
  const base = `/s/${storeSlug}`;
  const suffix = path.replace(/^\/+/, '');
  return suffix ? `${base}/${suffix}` : base;
}
