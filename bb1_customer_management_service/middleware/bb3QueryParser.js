/**
 * Turns query string into mongoose filters, sorts, and paging values
 * Accepts:
 *   ?search=abc           (matches orderNum, customer.name …)
 *   ?status=Confirmed
 *   ?archived=true
 *   ?page=1&limit=20
 *   ?sort=createdAt:desc  (multiple comma‑sep keys supported)
 */
export default function queryParser(req, res, next) {
  const {
    search,
    status,
    archived,
    page = 1,
    limit = 20,
    sort = "createdAt:desc",
  } = req.query;

  // --- FILTER ---
  const filter = {};
  if (status && status !== "ALL") filter.status = status;
  if (archived !== undefined) filter.archived = archived === "true";

  // text search across a few string fields
  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [
      { orderNum: regex },
      { "customer.name": regex },
      { "customer.code": regex },
    ];
  }

  req.qp = {
    filter,
    page: Math.max(1, +page),
    limit: Math.min(100, +limit),
    sort: Object.fromEntries(
      sort.split(",").map((pair) => {
        const [k, dir] = pair.split(":");
        return [k.trim(), dir === "asc" ? 1 : -1];
      })
    ),
  };
  next();
}
