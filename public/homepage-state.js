export function normalizeQuery(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function searchCatalog(index, query, limit = 24) {
  const normalized = normalizeQuery(query);
  if (!normalized) return index.filter(item => item.type === 'Collection' && /^\/[^/]+\/$/.test(item.href));
  const words = normalized.split(' ');
  return index.map((item, order) => {
    const name = normalizeQuery(item.name);
    const searchable = name + ' ' + normalizeQuery(item.keywords);
    const matches = words.every(word => searchable.includes(word));
    return { item, order, matches, score:name === normalized ? 0 : name.startsWith(normalized) ? 1 : name.includes(normalized) ? 2 : 3 };
  }).filter(item => item.matches).sort((a, b) => a.score - b.score || a.order - b.order).slice(0, limit).map(item => item.item);
}

export function readSaved(raw, validIds) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = new Set(validIds);
    return [...new Set(parsed.filter(id => typeof id === 'string' && valid.has(id)))];
  } catch {
    return [];
  }
}

export function toggleSaved(saved, id, validIds) {
  if (!validIds.includes(id)) return [...saved];
  return saved.includes(id) ? saved.filter(item => item !== id) : [id, ...saved];
}
