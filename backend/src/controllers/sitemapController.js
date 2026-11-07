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
const Certificate = require('../models/Certificate');

const FIXED_PAGES = ['/', '/blog', '/projects', '/certificates', '/privacy'];

const getSitemap = async (_req, res, next) => {
  try {
    const site = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    // A sitemap of relative addresses is invalid, and would be cached.
    if (!site) throw new AppError("This page list isn't available right now. Please try again later.", 503);

    const [posts, projects, certificates] = await Promise.all([
      Blog.find({ published: true }).select('slug updatedAt -_id').sort('slug').lean(),
      Project.find({ published: { $ne: false }, slug: { $gt: '' } }).select('slug updatedAt -_id').sort('slug').lean(),
      Certificate.find({ published: true, slug: { $gt: '' } }).select('slug updatedAt -_id').sort('slug').lean(),
    ]);

    // PF-153: `lastmod` only where the date is true. A read never moves
    // `updatedAt`, so this changes when the page really does. Fixed pages show
    // data from many places, and a wrong date is worse than none (Google).
    const entry = (prefix) => ({ slug, updatedAt }) => ({
      path: `${prefix}/${encodeURIComponent(slug)}`,
      lastmod: updatedAt?.toISOString().slice(0, 10),
    });
    const pages = [
      ...FIXED_PAGES.map((path) => ({ path })),
      ...posts.map(entry('/blog')),
      ...projects.map(entry('/projects')),
      ...certificates.map(entry('/certificates')),
    ];

    res.type('application/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + pages.map(({ path, lastmod }) => (
        `  <url><loc>${site}${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
      )).join('\n')
      + '\n</urlset>\n'
    );
  } catch (err) {
    next(err);
  }
};

module.exports = { getSitemap };
