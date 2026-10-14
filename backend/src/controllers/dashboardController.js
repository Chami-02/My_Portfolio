const Project = require('../models/Project');
const Skill   = require('../models/Skill');
const Blog    = require('../models/Blog');
const Contact = require('../models/Contact');

// ── GET /api/dashboard/stats ─────────────────────────────────────────────────
// Protected — the admin Overview panel, the shell's sidebar badges and the
// footer's session column all read this ONE response (PF-110).
//
// Before this existed, the shell fetched four full collections to derive
// seven integers, and the Overview panel fetched three more (one of them the
// PUBLIC blog list, which is already filtered to published — so its draft
// count was unobtainable). Six count queries in one round trip replace all of
// that.
//
// ⚠️ `drafts` is total − published and `unread` is `read: { $ne: true }`,
// NOT `published: false` / `read: false`. A document that never had the
// field (older rows, or one inserted around the schema default) is a draft
// and unread respectively — which is exactly what the client-side
// `!p.published` / `!m.read` filters this replaces were counting.
const getStats = async (_req, res, next) => {
  try {
    const [projects, skills, posts, published, messages, unread] = await Promise.all([
      Project.countDocuments(),
      Skill.countDocuments(),
      Blog.countDocuments(),
      Blog.countDocuments({ published: true }),
      Contact.countDocuments(),
      Contact.countDocuments({ read: { $ne: true } }),
    ]);

    res.json({
      status: 'success',
      data: {
        projects,
        skills,
        posts,
        published,
        drafts: posts - published,
        messages,
        unread,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getStats };
