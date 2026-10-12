const { programRepository } = require("../../repositories");
const { buildProgramFilters } = require("../../services/discoveryService");
const asyncHandler = require("../../utils/asyncHandler");
const HttpError = require("../../utils/httpError");

/**
 * GET /api/v2/programs — keyset ("cursor") pagination.
 *
 * Why this is a new version rather than a change to v1: the response no longer
 * carries `page`/`total`/`totalPages`, and `page` is no longer a valid request
 * parameter. Any client reading those fields would break, which is exactly the
 * kind of change a version boundary exists for. v1 stays as it is.
 *
 * Why keyset at all:
 * - `skip` makes MongoDB walk and discard every preceding document, so page
 *   500 costs far more than page 1. A cursor seeks straight into the index.
 * - Offset pages are unstable under writes. Insert a cheaper program while a
 *   student is paging through tuition-sorted results and every later page
 *   shifts by one, so they see a duplicate and miss another. A cursor anchors
 *   to a document, so the page boundary cannot drift.
 * - It drops the `countDocuments` round trip; `hasMore` comes from fetching
 *   one extra row.
 */

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/**
 * v2 sorts are restricted to one field plus `_id`.
 *
 * A cursor has to encode the whole sort key to resume correctly. v1's default
 * "relevance" sort has three keys (scholarship, tuition, id), and a two-part
 * cursor cannot express a resume point inside it without silently skipping the
 * documents that tie on the first key. Rather than ship a cursor that is subtly
 * wrong, v2 offers only sorts it can paginate correctly, and the `_id`
 * tiebreaker always follows the primary direction so the order is total.
 */
const SORTS = {
  tuitionAsc: { tuitionFeeUsd: 1, _id: 1 },
  tuitionDesc: { tuitionFeeUsd: -1, _id: -1 },
  name: { title: 1, _id: 1 },
  ielts: { minimumIelts: 1, _id: 1 },
  newest: { _id: -1 },
};

const DEFAULT_SORT = "tuitionAsc";

function resolveSort(sortBy) {
  if (!sortBy) return { key: DEFAULT_SORT, sort: SORTS[DEFAULT_SORT] };

  if (!SORTS[sortBy]) {
    throw new HttpError(
      400,
      `Unsupported sortBy "${sortBy}". Supported in v2: ${Object.keys(
        SORTS
      ).join(", ")}.`
    );
  }

  return { key: sortBy, sort: SORTS[sortBy] };
}

function encodeCursor(document, sortField) {
  const payload = {
    id: String(document._id),
    ...(sortField ? { value: document[sortField] } : {}),
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCursor(cursor) {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    );

    if (!decoded || typeof decoded.id !== "string") {
      throw new Error("Cursor payload missing id.");
    }

    return decoded;
  } catch (error) {
    throw new HttpError(
      400,
      "Invalid cursor. Pass the `nextCursor` value from the previous response verbatim."
    );
  }
}

/**
 * Translates a cursor into a filter that means "everything after this document
 * in the current sort order".
 *
 * With a secondary sort field the comparison has to be a compound one: strictly
 * past the sort value, or equal to it and strictly past the id. Comparing the
 * sort value alone would skip every document that ties with the cursor.
 */
function buildCursorFilter(cursor, sort) {
  const [primaryField, primaryDirection] = Object.entries(sort)[0];
  const operator = primaryDirection === -1 ? "$lt" : "$gt";

  if (primaryField === "_id") {
    return { _id: { [operator]: cursor.id } };
  }

  return {
    $or: [
      { [primaryField]: { [operator]: cursor.value } },
      {
        [primaryField]: cursor.value,
        _id: { [operator]: cursor.id },
      },
    ],
  };
}

const listPrograms = asyncHandler(async (req, res) => {
  const { cursor, limit } = req.query;

  const pageSize = Math.min(
    Math.max(Number(limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );

  const { key: sortKey, sort } = resolveSort(req.query.sortBy);
  const [primarySortField] = Object.keys(sort);

  const filters = buildProgramFilters(req.query);

  if (cursor) {
    const decoded = decodeCursor(cursor);
    const cursorFilter = buildCursorFilter(decoded, sort);

    // Merged under $and so a cursor cannot collide with an $or already built
    // by the free-text search filter.
    Object.assign(filters, {
      $and: [...(filters.$and || []), cursorFilter],
    });
  }

  const { items, hasMore } = await programRepository.findByCursor({
    filters,
    sort,
    limit: pageSize,
  });

  const lastItem = items[items.length - 1];

  res.json({
    success: true,
    data: items,
    meta: {
      apiVersion: "v2",
      pagination: "cursor",
      sortBy: sortKey,
      limit: pageSize,
      count: items.length,
      hasMore,
      nextCursor:
        hasMore && lastItem
          ? encodeCursor(
              lastItem,
              primarySortField === "_id" ? null : primarySortField
            )
          : null,
    },
  });
});

module.exports = {
  listPrograms,
};
