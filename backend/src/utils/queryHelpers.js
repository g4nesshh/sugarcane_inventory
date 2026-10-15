/**
 * Shared list-query parsing so every module paginates/sorts/searches the same way.
 */

function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

/**
 * Builds a Prisma orderBy object, restricted to an allow-list of sortable fields
 * so a caller can't sort by an arbitrary/relation field.
 */
function parseSort(query, allowedFields, fallback) {
  const sortBy = allowedFields.includes(query.sortBy) ? query.sortBy : fallback;
  const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
  return { [sortBy]: sortOrder };
}

function buildMeta({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = { parsePagination, parseSort, buildMeta };
