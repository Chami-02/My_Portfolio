const VisitTotal = require('../models/VisitTotal');
const Blog       = require('../models/Blog');
const Project    = require('../models/Project');

/**
 * PF-150 — the numbers ANYONE can read, for the home page box. Cached by the CDN
 * (routes/siteNumbersRoutes.js), so the database is read about once an hour.
 *
 * ⚠️ The answer is written out field by field and shares nothing with the
 * private panel (audienceController.js). A new field here is a new public
 * promise: /privacy lists these, and `siteNumbers.test.js` pins the exact shape.
 *
 * ⚠️ Every day counts a person once, so someone back on 5 days is 5 visits, and
 * the counter cannot tell them from 5 people (its code changes daily). So the
 * rule below is 5 VISITS, and /privacy says visits.
 */

const MIN_VISITS_TO_NAME_A_COUNTRY = 5;
const TOP_COUNTRIES = 5;
const TOP_PAGES = 3;

// A real country code: this leaves out '(unknown)', which is not a place.
const COUNTRY_CODE = /^[A-Z]{2}$/;

const totalsByKey = (match) => VisitTotal.aggregate([
  { $match: match },
  { $group: { _id: '$key', count: { $sum: '$count' } } },
]);

const countries = async () => {
  const rows = await totalsByKey({ dim: 'country' });
  const known = rows.filter((row) => COUNTRY_CODE.test(row._id));
  return {
    countriesReached: known.length,
    // Names only: a count beside a small country says too much.
    topCountries: known
      .filter((row) => row.count >= MIN_VISITS_TO_NAME_A_COUNTRY)
      .sort((x, y) => y.count - x.count || x._id.localeCompare(y._id))
      .slice(0, TOP_COUNTRIES)
      .map((row) => row._id),
  };
};

/**
 * Starts from the published projects, never from the counted paths. Paths are
 * text a browser sent, so a draft's address or an invented one has no way in.
 * ⚠️ The filter repeats Project's public rule (see sitemapController).
 */
const topProjects = async () => {
  const projects = await Project
    .find({ published: { $ne: false }, slug: { $gt: '' } })
    .select('slug title')
    .lean();
  const rows = await totalsByKey({
    dim: 'path',
    key: { $in: projects.map((project) => `/projects/${project.slug}`) },
  });
  const views = new Map(rows.map((row) => [row._id, row.count]));
  const viewsOf = (project) => views.get(`/projects/${project.slug}`) ?? 0;
  return projects
    .filter((project) => viewsOf(project) > 0)
    .sort((x, y) => viewsOf(y) - viewsOf(x) || x.slug.localeCompare(y.slug))
    .slice(0, TOP_PAGES)
    .map(({ slug, title }) => ({ slug, title }));
};

const topPosts = async () => {
  const posts = await Blog
    .find({ published: true, views: { $gt: 0 } })
    .sort({ views: -1, slug: 1 })
    .limit(TOP_PAGES)
    .select('slug title')
    .lean();
  return posts.map(({ slug, title }) => ({ slug, title }));
};

const sumOf = async (Model, match, field) => {
  const [row] = await Model.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: `$${field}` } } },
  ]);
  return row?.total ?? 0;
};

/** GET /api/site-numbers */
const getSiteNumbers = async (_req, res, next) => {
  try {
    const [visits, place, projects, posts, blogReads] = await Promise.all([
      sumOf(VisitTotal, { dim: 'visitors', key: 'all' }, 'count'),
      countries(),
      topProjects(),
      topPosts(),
      sumOf(Blog, { published: true }, 'views'),
    ]);

    res.json({
      status: 'success',
      data: {
        visits,
        countriesReached: place.countriesReached,
        topCountries:     place.topCountries,
        topProjects:      projects,
        topPosts:         posts,
        blogReads,
        // When these numbers were added up. The CDN may serve this copy for a
        // while, and the box says how old it is.
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSiteNumbers };
