/**
 * PF-146 — the list of public pages search engines read. Built from the
 * database so a new post is listed without a rebuild; a signed-in SAVE clears
 * the cached copy like any other public read (middleware/cache.js).
 *
 * Search engines see it at https://<site>/sitemap.xml: frontend/vercel.json
 * passes that address through to this route, because a sitemap may only list
 * pages on its own host.
 *
 * ⚠️ The two filters repeat each model's public rule (see vocabularyController):
 * Project is `$ne: false` because older projects have no `published` field.
 */
const AppError = require('../utils/AppError');
const Blog     = require('../models/Blog');
const Project  = require('../models/Project');

const FIXED_PAGES = ['/', '/blog', '/projects', '/certificates', '/privacy'];

const getSitemap = async (_req, res, next) => {
  try {
    const site = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    // A sitemap of relative addresses is invalid, and would be cached.
    if (!site) throw new AppError("This page list isn't available right now. Please try again later.", 503);

    const [posts, projects] = await Promise.all([
      Blog.find({ published: true }).select('slug -_id').sort('slug').lean(),
      Project.find({ published: { $ne: false }, slug: { $gt: '' } }).select('slug -_id').sort('slug').lean(),
    ]);

    const paths = [
      ...FIXED_PAGES,
      ...posts.map((p) => `/blog/${encodeURIComponent(p.slug)}`),
      ...projects.map((p) => `/projects/${encodeURIComponent(p.slug)}`),
    ];

    res.type('application/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + paths.map((p) => `  <url><loc>${site}${p}</loc></url>`).join('\n')
      + '\n</urlset>\n'
    );
  } catch (err) {
    next(err);
  }
};

module.exports = { getSitemap };
