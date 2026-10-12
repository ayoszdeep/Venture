const { programRepository } = require("../../repositories");
const { buildProgramFilters } = require("../../services/discoveryService");
const asyncHandler = require("../../utils/asyncHandler");
const HttpError = require("../../utils/httpError");

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

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
