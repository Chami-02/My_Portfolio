const mongoose = require('mongoose');

// ── NEW IN PF-60 ──────────────────────────────────────────────
// Shared validator for social profile URLs.
// Empty is always allowed — not every link is filled in
// (twitter ships empty until an account exists).
const urlValidator = {
  validator: function (value) {
    if (!value) return true;
    return /^https?:\/\/.+\..+/i.test(value);
  },
  message: props => `${props.value} is not a valid URL`,
};
// ──────────────────────────────────────────────────────────────

const aboutSchema = new mongoose.Schema(
  {
    // Basic info
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
      default:  'Parindra Chameekara Gallage',
    },
    title: {
      type:    String,
      trim:    true,
      default: 'Full-Stack Developer',
    },
    location: {
      type:    String,
      trim:    true,
      default: 'Galle,Sri Lanka',
    },
    // ── The single source of truth for contact email, site-wide (PF-60) ──
    // Used by the contact section, the footer's email icon, and anywhere
    // else a mailto: is needed. Validated here as well as in aboutRules so
    // a direct model write can't bypass it.
    email: {
      type:    String,
      trim:    true,
      default: 'parindrachameekara@gmail.com',
      validate: {
        validator: v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message:   props => `${props.value} is not a valid email address`,
      },
    },

    // Bio paragraphs — each element is one paragraph
    bio: {
      type:    [String],
      default: [
        "I'm a Computer Science undergraduate at the University of Westminster, building production-grade software one real project at a time.",
        "This portfolio is not a template — it's a live MERN application tracked in Jira, containerized with Docker, and deployed through a CI/CD pipeline.",
      ],
    },

    // Availability for hire
    availableForWork: {
      type:    Boolean,
      default: true,
    },
    availabilityNote: {
      type:    String,
      default: 'Currently open to junior developer roles',
    },

    // Profile image
    avatarUrl: {
      type:    String,
      default: null,
    },

    // ── REPLACED IN PF-60: cvUrl → resumeUrl → resume {} ─────────
    // Single résumé slot. A new upload REPLACES this entirely and
    // deletes the previous file from Cloudinary — one file, one
    // source of truth, no storage waste.
    //
    // A bare URL string wasn't enough: without publicId there is no
    // way to delete the old file, so every replacement would orphan
    // one in Cloudinary forever. The rest is metadata the admin
    // résumé card renders directly.
    //
    // Field → where it appears in the admin card:
    //   url        → the ↓ PREVIEW link
    //   publicId   → not rendered; required to DELETE the old file
    //   fileName   → the bold filename at the top of the card
    //   ext        → the "PDF" text inside the icon tile
    //   bytes      → rendered as "106 KB"
    //   uploadedAt → rendered as "replaced Aug 1, 2026"
    //
    // No data migration needed: cvUrl/resumeUrl was null/unset in
    // both the seed and production, so nothing is being dropped.
    resume: {
      url: {
        type:    String,
        default: '',
        validate: {
          validator: v => !v || /^https?:\/\//i.test(v),   // no data: URIs
          message:   'Resume URL must be an http(s) URL',
        },
      },
      publicId:   { type: String, default: '' },
      fileName:   { type: String, default: '' },
      ext:        { type: String, default: '' },
      bytes:      { type: Number, default: 0 },
      uploadedAt: { type: Date,   default: null },
    },
    // ──────────────────────────────────────────────────────────────

    // Social links
    social: {
      github:    { type: String, default: 'https://github.com/Chami-02', validate: urlValidator },
      linkedin:  { type: String, default: 'https://www.linkedin.com/in/chamikara-gallege-3b0861295/', validate: urlValidator },
      facebook:  { type: String, default: 'https://web.facebook.com/parindra.chameekara', validate: urlValidator },
      instagram: { type: String, default: 'https://www.instagram.com/__pc_02/', validate: urlValidator },

      // ── NEW IN PF-60 — ticket's own goal is six social links; this was missing ──
      // Intentionally empty: no Twitter account yet. Fill it in from the
      // admin panel if one is created — the public site must treat an
      // empty value as "hide this icon", not render a dead link.
      twitter:   { type: String, default: '', validate: urlValidator },

      // NOTE: no `email` here. There is ONE email for the whole site —
      // the top-level `email` field above. The footer's sixth icon builds
      // its mailto: from that. Do not re-add a social.email: two fields
      // drift apart the moment one of them is edited.
    },

    // Stats shown in the About section cards
    stats: [
      {
        label: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

// ── NEW IN PF-60 ──────────────────────────────────────────────
// Drives the LIVE / MISSING badge on the admin résumé card and the
// visibility of the PREVIEW and REMOVE buttons — and, on the public
// site, whether the Download CV buttons render at all.
//
// Computed here rather than in the frontend so there is one rule:
// a résumé exists if, and only if, it has a url.
aboutSchema.virtual('hasResume').get(function () {
  return Boolean(this.resume && this.resume.url);
});

// Virtuals are excluded from JSON by default — turn them on, or
// hasResume never reaches the client.
// Note: this also adds Mongoose's built-in `id` virtual (a string
// copy of _id) to every About response. Harmless, but that is why
// the payload gains an `id` alongside `_id`.
aboutSchema.set('toJSON',   { virtuals: true });
aboutSchema.set('toObject', { virtuals: true });
// ──────────────────────────────────────────────────────────────

module.exports = mongoose.model('About', aboutSchema);