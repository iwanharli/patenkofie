export function getPaginatedItems<T>(items: readonly T[], page: number, pageSize = 10) {
  const start = (page - 1) * pageSize

  return items.slice(start, start + pageSize)
}
