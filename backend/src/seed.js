require('dotenv').config();
require('dns').setServers(['8.8.8.8', '8.8.4.4']); 
const mongoose = require('mongoose');
const { assertExplicitDatabase } = require('./config/db');

const Project = require('./models/Project');
const Skill   = require('./models/Skill');
const Blog    = require('./models/Blog');
const About   = require('./models/About');
const User    = require('./models/User');
const Vocabulary = require('./models/Vocabulary');

// ── Seed data ──────────────────────────────────────────────────────────────

const PROJECTS = [
  {
    title:       'Personal Portfolio',
    description: 'A full-stack MERN portfolio tracked in Jira, containerized with Docker, tested with Vitest and Jest, deployed via GitHub Actions CI/CD. Built the way a professional engineering team would build it.',
    tech:        ['React 19', 'Node.js', 'Express.js', 'MongoDB', 'Docker', 'Tailwind CSS', 'GitHub Actions'],
    githubUrl:   'https://github.com/Chami-02/My_Portfolio',
    liveUrl:     null,
    featured:    true,
    order:       1,

    // Empty on purpose — real background images are uploaded through the
    // admin panel in Sprint 14. Stated explicitly rather than left to the
    // schema defaults so re-seeding visibly clears any previous upload.
    backgroundImage: { src: '', opacity: 0.75 },
  },
  {
    title:       'ClearDrive.lk',
    description: 'A full-stack vehicle import platform connecting Sri Lankan buyers with Japanese auctions, built with FastAPI, PostgreSQL, Next.js, Docker, and Redis. Developed using Agile workflows with Jira, GitHub, CI/CD, secure APIs, and scalable cloud-ready architecture.',
    tech:        ['Python', 'FastAPI','Next.js', 'PostgreSQL', 'Docker', 'Redis', 'GitHub Actions', 'Tailwind CSS', 'SQLAlchemy','Alembic'],
    githubUrl:   'https://github.com/ClearDrive-lk/cleardrive-lk',
    liveUrl:     'https://cleardrive.lk/' ,
    featured:    true,
    order:       2,
    backgroundImage: { src: '', opacity: 0.75 },
  },
  {
    title:       'Smart Campus API',
    description: 'A RESTful API for a "Smart Campus" managing rooms and IoT sensors. Built strictly with Java and JAX-RS using in-memory data structures. Features sub-resource routing, custom exception mapping, and logging filters.',
    tech:        ['Java', 'JAX-RS'],
    githubUrl:   'https://github.com/Chami-02/CSA_CW_W2120595_smart-campus-api',
    liveUrl:     null,
    featured:    false,
    order:       3,
    backgroundImage: { src: '', opacity: 0.75 },
  },
   {
    title:       'Life Below Water',
    description: 'The website was developed using HTML, CSS, JavaScript, and XML to create an interactive, visually appealing, and user-friendly platform. It includes multiple pages such as a Splash Screen, Home Page, Volunteer Page, User Profile, Feedback Form, Sitemap, and more, each designed to provide a seamless user experience.',
    tech:        ['HTML', 'CSS', 'JavaScript', 'XML'],
    githubUrl:   'https://github.com/Chami-02/WD-D_GP_Goal-14-Life-below-water',
    liveUrl:     null,
    featured:    false,
    order:       4,
    backgroundImage: { src: '', opacity: 0.75 },
  }
];

const SKILLS = [
  // ── PF-82 ────────────────────────────────────────────────────────────────
  // `order` is what the public Skills section renders by, so these values
  // are the prototype's pill sequence (Portfolio Revolution.dc.html lines
  // 253-307), not an arbitrary numbering. Three groups were out of step
  // and are corrected below; `backend` and `devops` already matched and
  // are untouched. The 26 NAMES always matched — only the order did not,
  // which is exactly the kind of difference a count-based check misses.

  // Languages — Java moved from 3rd to last (prototype line 258)
  { name: 'JavaScript', category: 'language', level: 'intermediate', order: 1 },
  { name: 'Python', category: 'language', level: 'intermediate', order: 2 },
  { name: 'HTML5', category: 'language', level: 'intermediate', order: 3 },
  { name: 'CSS3', category: 'language', level: 'intermediate', order: 4 },
  { name: 'Java', category: 'language', level: 'intermediate', order: 5 },

  // Frontend — Vite up to 2nd, Next.js down to last (prototype lines 263-267)
  { name: 'React', category: 'frontend', level: 'intermediate', order: 6 },
  { name: 'Vite', category: 'frontend', level: 'intermediate', order: 7 },
  { name: 'Tailwind CSS', category: 'frontend', level: 'intermediate', order: 8 },
  { name: 'React Router', category: 'frontend', level: 'intermediate', order: 9 },
  { name: 'Next.js', category: 'frontend', level: 'beginner', order: 10 },

  // Backend — already matched the prototype (lines 272-276), untouched
  { name: 'FastAPI', category: 'backend', level: 'intermediate', order: 11 },
  { name: 'Node.js', category: 'backend', level: 'beginner', order: 12 },
  { name: 'Express.js', category: 'backend', level: 'beginner', order: 13 },
  { name: 'REST APIs', category: 'backend', level: 'intermediate', order: 14 },
  { name: 'JWT Authentication', category: 'backend', level: 'beginner', order: 15 },

  // Database — Mongoose and SQLAlchemy swapped (prototype lines 285-286)
  { name: 'PostgreSQL', category: 'database', level: 'beginner', order: 16 },
  { name: 'MongoDB', category: 'database', level: 'beginner', order: 17 },
  { name: 'Redis', category: 'database', level: 'beginner', order: 18 },
  { name: 'Mongoose', category: 'database', level: 'beginner', order: 19 },
  { name: 'SQLAlchemy', category: 'database', level: 'beginner', order: 20 },

  // DevOps — already matched the prototype (lines 293-299), untouched
  { name: 'Docker', category: 'devops', level: 'intermediate', order: 21 },
  { name: 'Git', category: 'devops', level: 'intermediate', order: 22 },
  { name: 'GitHub', category: 'devops', level: 'intermediate', order: 23 },
  { name: 'GitHub Actions', category: 'devops', level: 'beginner', order: 24 },
  { name: 'Linux CLI', category: 'devops', level: 'beginner', order: 25 },
  { name: 'Jira', category: 'devops', level: 'intermediate', order: 26 },
];

// ── CHANGED IN PF-65 ───────────────────────────────────────────────────────
// `content` (a single Markdown string) is replaced by `sections`, matching
// the shape the PF-59 migration produced and the reading view in
// Blog.dc.html renders. Copy is taken verbatim from that design file.
//
// Fields deliberately NOT set here:
//   slug               — generated from `title` by the pre-insertMany hook
//   readingTimeMinutes — calculated from `sections` by the same hook
//   views              — schema default of 0
// ───────────────────────────────────────────────────────────────────────────

const BLOG_POSTS = [
  {
    title: 'Building a Production-Style MERN Portfolio',
    excerpt:
      'How I designed and developed my portfolio using professional software engineering practices including Jira, Docker, GitHub Actions, and CI/CD.',
    tags: ['React', 'MERN', 'Docker', 'GitHub Actions'],
    published: true,
    sections: [
      {
        heading: 'Introduction',
        body: [
          'I wanted my portfolio to demonstrate more than frontend development — it needed to reflect how software is built in professional engineering teams.',
          'That meant treating a personal site like a product: a backlog, a branching strategy, tests, containers and a pipeline that says no when something breaks.',
        ],
        bullets: [],
      },
      {
        heading: 'Planning',
        body: [
          'The project was managed using Jira with sprint planning, task tracking and GitHub issue management. Eight sprints, forty-four tickets, each one small enough to finish in a sitting.',
        ],
        bullets: [],
      },
      {
        heading: 'Development',
        body: [
          'The application was built with React, Express.js, MongoDB and Docker while following a modular architecture — sections as components, data behind a REST API, and an admin panel to edit content without a redeploy.',
        ],
        bullets: [],
      },
      {
        heading: 'Deployment',
        body: [
          'GitHub Actions automated testing and deployment so every change was validated before release. Vitest on the frontend, Jest on the backend, Playwright for the flows that actually matter.',
        ],
        bullets: [],
      },
      {
        heading: 'Lessons Learned',
        body: [],
        bullets: [
          'Plan before writing code.',
          'Keep commits small and meaningful.',
          'Automate repetitive tasks whenever possible.',
        ],
      },
    ],
  },

  {
    title: 'Developing ClearDrive.lk with FastAPI and Docker',
    excerpt:
      'A look into building a scalable vehicle import platform using FastAPI, PostgreSQL, Docker, Redis, and Agile development practices.',
    tags: ['FastAPI', 'Python', 'Docker', 'PostgreSQL', 'Agile'],
    published: true,
    sections: [
      {
        heading: 'Project Overview',
        body: [
          'ClearDrive.lk is a full-stack platform that connects Sri Lankan buyers with Japanese vehicle auctions — search, cost estimation and order tracking in one place.',
        ],
        bullets: [],
      },
      {
        heading: 'Backend',
        body: [
          'I worked on backend development using FastAPI, PostgreSQL, SQLAlchemy, Redis and Docker. Alembic handled migrations so the schema could move as fast as the product did.',
        ],
        bullets: [],
      },
      {
        heading: 'Features',
        body: [],
        bullets: [
          'Vehicle management',
          'Vehicle search APIs',
          'Cost estimation',
          'Order tracking',
          'Secure authentication',
        ],
      },
      {
        heading: 'Team Workflow',
        body: [
          'The project followed Agile Scrum using Jira, GitHub, pull requests and GitHub Actions for CI/CD. Code review turned out to be the fastest way to learn.',
        ],
        bullets: [],
      },
      {
        heading: 'What I Learned',
        body: [
          'Building software in a team taught me version control, API design, code reviews and collaborative development — the parts a solo project never forces you to practise.',
        ],
        bullets: [],
      },
    ],
  },

  {
    title: 'Getting Started with Docker Compose',
    excerpt:
      'Everything I learned while using Docker Compose to manage multi-container applications for my projects.',
    tags: ['Docker', 'DevOps'],
    published: true,
    sections: [
      {
        heading: 'Why Docker?',
        body: [
          'Docker provides consistent development environments and removes "it works on my machine" issues. One file describes the whole world your app runs in.',
        ],
        bullets: [],
      },
      {
        heading: 'Services',
        body: [
          'A typical stack of mine runs four services, wired together by name rather than by IP:',
        ],
        bullets: ['Frontend', 'Backend', 'PostgreSQL', 'Redis'],
      },
      {
        heading: 'Benefits',
        body: [],
        bullets: [
          'Easy onboarding — clone and one command',
          'Environment consistency across machines',
          'Simplified deployment',
        ],
      },
      {
        heading: 'Verdict',
        body: [
          'Docker has become one of the most valuable tools in my development workflow — the moment a project has more than one moving part, Compose earns its keep.',
        ],
        bullets: [],
      },
    ],
  },

  {
    title: 'Building REST APIs with Java and JAX-RS',
    excerpt:
      'Key concepts I learned while developing my Smart Campus REST API using Java and JAX-RS.',
    tags: ['Java', 'REST API', 'JAX-RS'],
    published: true,
    sections: [
      {
        heading: 'Overview',
        body: [
          'This project introduced me to RESTful API design using Java — a Smart Campus service managing rooms and IoT sensors with in-memory data structures.',
        ],
        bullets: [],
      },
      {
        heading: 'Features',
        body: [],
        bullets: [
          'CRUD operations',
          'Sub-resource routing',
          'Custom exception mapping',
          'Request logging filters',
        ],
      },
      {
        heading: 'Lessons Learned',
        body: [
          'Building APIs with Java helped me better understand REST principles before moving to FastAPI. Verbose frameworks teach you what the concise ones are doing for you.',
        ],
        bullets: [],
      },
    ],
  },
];

const ABOUT_DATA = {
  name: 'Parindra Chameekara',
  title: 'Computer Science Undergraduate | Full-Stack Developer',
  location: 'Galle, Sri Lanka',
  email: 'parindrachameekara@gmail.com',

  bio: [
    "I'm a Computer Science undergraduate at the University of Westminster, building production-grade software one real project at a time. I enjoy turning ideas into real-world software using modern technologies and engineering best practices.",

    "I've contributed to projects ranging from full-stack web applications to REST APIs and enterprise-style systems such as ClearDrive.lk. My experience includes Python, FastAPI, JavaScript, React, Next.js, PostgreSQL, Docker, GitHub Actions, and Agile development using Jira."
  ],

  availableForWork: true,
  availabilityNote: 'Currently seeking Software Engineering Internship opportunities',

  // Email lives at the top level only — one address for the whole site.
  // twitter is omitted deliberately: no account yet, schema default is ''.
  social: {
    github: 'https://github.com/Chami-02',
    linkedin: 'https://www.linkedin.com/in/chamikara-gallage-3b0861295/',
    facebook: 'https://web.facebook.com/parindra.chameekara',
    instagram: 'https://www.instagram.com/__pc_02/',
  },

  // Empty on purpose — the real CV is uploaded through the admin panel,
  // never committed. Stated explicitly rather than left to the schema
  // defaults so re-seeding visibly clears any previous résumé.
  resume: {
    url: '', publicId: '', fileName: '', ext: '', bytes: 0, uploadedAt: null,
  },

  stats: [
    { label: 'Projects Built', value: '5+' },
    { label: 'Technologies', value: '10+' },
    { label: 'GitHub Repos', value: '5+' },
    { label: 'Learning', value: 'Continuous' },
  ],
};

// ── Admin credentials ──────────────────────────────────────────────────────
// `Admin@1234!` is a well-known LOCAL DEVELOPMENT default, in the same
// spirit as postgres/postgres. It is readable by anyone with the repo, so
// it is only ever acceptable on a database nobody else can reach.
//
// It used to be published in docs/design/DESIGN.md as demo credentials for
// the live site, which made the live admin panel writable by any reader.
// That line is gone; the Playwright suite and Postman collection now take
// the value from the environment with this same fallback.
//
// Set SEED_ADMIN_PASSWORD (and optionally SEED_ADMIN_EMAIL) for any
// database that is not a throwaway. The env-supplied value is never
// echoed to the console — only the fallback is, because you need to be
// told when the shared default is in play.
const DEMO_ADMIN_EMAIL    = 'admin@portfolio.dev';
const DEMO_ADMIN_PASSWORD = 'Admin@1234!';

function resolveAdminCredentials() {
  const email    = process.env.SEED_ADMIN_EMAIL || DEMO_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (password) return { email, password, fromEnv: true };

  // Backstop only. NODE_ENV is 'development' even when seeding a live
  // Atlas cluster from a laptop, so this catches deliberate production
  // runs, not the common case — the warning below is what does the work.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to seed with the public demo password while NODE_ENV=production. ' +
      'Set SEED_ADMIN_PASSWORD first.'
    );
  }

  return { email, password: DEMO_ADMIN_PASSWORD, fromEnv: false };
}

// ── NEW IN PF-65 ───────────────────────────────────────────────────────────
// Build the chip vocabulary from whatever the seed just inserted, so the
// admin pickers are populated on a fresh database. Runs LAST — it reads
// back from Project and Blog rather than duplicating their lists here,
// which keeps the vocabulary from drifting out of sync with the content.
async function seedVocabulary() {
  await Vocabulary.deleteMany({});

  const projects = await Project.find({}, 'tech');
  const posts    = await Blog.find({}, 'tags');

  const tech = new Set();
  const tags = new Set();

  projects.forEach(p => (p.tech || []).forEach(t => tech.add(String(t).trim())));
  posts.forEach(   p => (p.tags || []).forEach(t => tags.add(String(t).trim())));

  const docs = [
    ...[...tech].filter(Boolean).map(value => ({ type: 'tech', value })),
    ...[...tags].filter(Boolean).map(value => ({ type: 'tag',  value })),
  ];

  if (docs.length) await Vocabulary.insertMany(docs);
  console.log(`🏷  Seeded vocabulary: ${tech.size} tech, ${tags.size} tags`);
}
// ───────────────────────────────────────────────────────────────────────────

// ── Main seed function ─────────────────────────────────────────────────────

async function seed() {
  try {
    // PF-66 — this script deletes every document before it writes anything,
    // and it connects directly rather than through connectDB(), so the guard
    // there does not cover it. A pathless URI would resolve to the database
    // named "test", which is production. Refuse before connecting, not after.
    const dbName = assertExplicitDatabase(process.env.MONGO_URI);
    console.log(`→ connecting to database: ${dbName}`);

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data — order matters for references
    await Promise.all([
      Project.deleteMany({}),
      Skill.deleteMany({}),
      Blog.deleteMany({}),
      About.deleteMany({}),
      User.deleteMany({}),
    ]);
    console.log('🗑  Cleared existing data');

    // Insert fresh data
    await Project.insertMany(PROJECTS);
    console.log(`📦 Seeded ${PROJECTS.length} projects`);

    await Skill.insertMany(SKILLS);
    console.log(`💡 Seeded ${SKILLS.length} skills`);

    await Blog.insertMany(BLOG_POSTS);
    console.log(`📝 Seeded ${BLOG_POSTS.length} blog posts`);

    await About.create(ABOUT_DATA);
    console.log('👤 Seeded about/profile data');

    // Create admin user — password is hashed by the pre-save hook in User.js
    const admin = resolveAdminCredentials();
    await User.create({ email: admin.email, password: admin.password });

    if (admin.fromEnv) {
      console.log(`🔐 Created admin user: ${admin.email} (password from SEED_ADMIN_PASSWORD)`);
    } else {
      console.log(`🔐 Created admin user: ${admin.email} / ${DEMO_ADMIN_PASSWORD}`);
      console.log('⚠️  That is the PUBLIC demo password from DESIGN.md — this database');
      console.log('   is now writable by anyone who reads the repo. Set SEED_ADMIN_PASSWORD');
      console.log('   before seeding anything you care about.');
    }

    // Last — reads back from Project and Blog, so they must exist first
    await seedVocabulary();

    console.log('\n✅ Database seeded successfully!\n');
    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();