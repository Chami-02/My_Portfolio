require('dotenv').config();
const mongoose = require('mongoose');

const Project = require('./models/Project');
const Skill   = require('./models/Skill');
const Blog    = require('./models/Blog');
const About   = require('./models/About');
const User    = require('./models/User');

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
  },
  {
    title:       'ClearDrive.lk',
    description: 'A full-stack vehicle import platform connecting Sri Lankan buyers with Japanese auctions, built with FastAPI, PostgreSQL, Next.js, Docker, and Redis. Developed using Agile workflows with Jira, GitHub, CI/CD, secure APIs, and scalable cloud-ready architecture.',
    tech:        ['Python', 'FastAPI','Next.js', 'PostgreSQL', 'Docker', 'Redis', 'GitHub Actions', 'Tailwind CSS', 'SQLAlchemy','Alembic'],
    githubUrl:   'https://github.com/ClearDrive-lk/cleardrive-lk',
    liveUrl:     'https://cleardrive.lk/' ,
    featured:    true,
    order:       2,
  },
  {
    title:       'Smart Campus API',
    description: 'A RESTful API for a "Smart Campus" managing rooms and IoT sensors. Built strictly with Java and JAX-RS using in-memory data structures. Features sub-resource routing, custom exception mapping, and logging filters.',
    tech:        ['Java', 'JAX-RS'],
    githubUrl:   'https://github.com/Chami-02/CSA_CW_W2120595_smart-campus-api',
    liveUrl:     null,
    featured:    false,
    order:       3,
  },
   {
    title:       'Life below warter',
    description: 'The website was developed using HTML, CSS, JavaScript, and XML to create an interactive, visually appealing, and user-friendly platform. It includes multiple pages such as a Splash Screen, Home Page, Volunteer Page, User Profile, Feedback Form, Sitemap, and more, each designed to provide a seamless user experience.',
    tech:        ['HTML', 'CSS', 'JavaScript', 'XML'],
    githubUrl:   'https://github.com/Chami-02/WD-D_GP_Goal-14-Life-below-water',
    liveUrl:     null,
    featured:    false,
    order:       4,
  }
];

const SKILLS = [
  // Languages
  { name: 'JavaScript', category: 'language', level: 'intermediate', order: 1 },
  { name: 'Python', category: 'language', level: 'intermediate', order: 2 },
  { name: 'Java', category: 'language', level: 'intermediate', order: 3 },
  { name: 'HTML5', category: 'language', level: 'intermediate', order: 4 },
  { name: 'CSS3', category: 'language', level: 'intermediate', order: 5 },

  // Frontend
  { name: 'React', category: 'frontend', level: 'intermediate', order: 6 },
  { name: 'Next.js', category: 'frontend', level: 'beginner', order: 7 },
  { name: 'Vite', category: 'frontend', level: 'intermediate', order: 8 },
  { name: 'Tailwind CSS', category: 'frontend', level: 'intermediate', order: 9 },
  { name: 'React Router', category: 'frontend', level: 'intermediate', order: 10 },

  // Backend
  { name: 'FastAPI', category: 'backend', level: 'intermediate', order: 11 },
  { name: 'Node.js', category: 'backend', level: 'beginner', order: 12 },
  { name: 'Express.js', category: 'backend', level: 'beginner', order: 13 },
  { name: 'REST APIs', category: 'backend', level: 'intermediate', order: 14 },
  { name: 'JWT Authentication', category: 'backend', level: 'beginner', order: 15 },

  // Database
  { name: 'PostgreSQL', category: 'database', level: 'beginner', order: 16 },
  { name: 'MongoDB', category: 'database', level: 'beginner', order: 17 },
  { name: 'Redis', category: 'database', level: 'beginner', order: 18 },
  { name: 'SQLAlchemy', category: 'database', level: 'beginner', order: 19 },
  { name: 'Mongoose', category: 'database', level: 'beginner', order: 20 },

  // DevOps
  { name: 'Docker', category: 'devops', level: 'intermediate', order: 21 },
  { name: 'Git', category: 'devops', level: 'intermediate', order: 22 },
  { name: 'GitHub', category: 'devops', level: 'intermediate', order: 23 },
  { name: 'GitHub Actions', category: 'devops', level: 'beginner', order: 24 },
  { name: 'Linux CLI', category: 'devops', level: 'beginner', order: 25 },
  { name: 'Jira', category: 'devops', level: 'intermediate', order: 26 },
];

const BLOG_POSTS = [
  {
    title: 'Building a Production-Style MERN Portfolio',
    excerpt:
      'How I designed and developed my portfolio using professional software engineering practices including Jira, Docker, GitHub Actions, and CI/CD.',
    content: `## Introduction

I wanted my portfolio to demonstrate more than frontend development—it needed to reflect how software is built in professional engineering teams.

## Planning

The project was managed using Jira with sprint planning, task tracking, and GitHub issue management.

## Development

The application was built with React, Express.js, MongoDB, and Docker while following a modular architecture.

## Deployment

GitHub Actions automated testing and deployment to ensure every change was validated before release.

## Lessons Learned

- Plan before writing code.
- Keep commits small and meaningful.
- Automate repetitive tasks whenever possible.`,
    tags: ['React', 'MERN', 'Docker', 'GitHub Actions'],
    published: true,
  },

  {
    title: 'Developing ClearDrive.lk with FastAPI and Docker',
    excerpt:
      'A look into building a scalable vehicle import platform using FastAPI, PostgreSQL, Docker, Redis, and Agile development practices.',
    content: `## Project Overview

ClearDrive.lk is a full-stack platform that connects Sri Lankan buyers with Japanese vehicle auctions.

## Backend

I worked on backend development using FastAPI, PostgreSQL, SQLAlchemy, Redis, and Docker.

## Features

- Vehicle management
- Vehicle search APIs
- Cost estimation
- Order tracking
- Secure authentication

## Team Workflow

The project followed Agile Scrum using Jira, GitHub, pull requests, and GitHub Actions for CI/CD.

## What I Learned

Building software in a team taught me version control, API design, code reviews, and collaborative development.`,
    tags: ['FastAPI', 'Python', 'Docker', 'PostgreSQL', 'Agile'],
    published: true,
  },

  {
    title: 'Getting Started with Docker Compose',
    excerpt:
      'Everything I learned while using Docker Compose to manage multi-container applications for my projects.',
    content: `## Why Docker?

Docker provides consistent development environments and removes "it works on my machine" issues.

## Services

- Frontend
- Backend
- PostgreSQL
- Redis

## Benefits

- Easy onboarding
- Environment consistency
- Simplified deployment

Docker has become one of the most valuable tools in my development workflow.`,
    tags: ['Docker', 'DevOps'],
    published: true,
  },

  {
    title: 'Building REST APIs with Java and JAX-RS',
    excerpt:
      'Key concepts I learned while developing my Smart Campus REST API using Java and JAX-RS.',
    content: `## Overview

This project introduced me to RESTful API design using Java.

## Features

- CRUD operations
- Resource routing
- Exception mapping
- Request logging

## Lessons Learned

Building APIs with Java helped me better understand REST principles before moving to FastAPI.`,
    tags: ['Java', 'REST API', 'JAX-RS'],
    published: true,
  },
];

const ABOUT_DATA = {
  name: 'Parindra Chameekara',
  title: 'Software Engineering Undergraduate | Full-Stack Developer',
  location: 'Galle, Sri Lanka',
  email: 'parindrachameekara@gmail.com',

  bio: [
    "I'm a Software Engineering undergraduate passionate about building scalable web applications and continuously improving my backend and full-stack development skills. I enjoy turning ideas into real-world software using modern technologies and engineering best practices.",

    "I've contributed to projects ranging from full-stack web applications to REST APIs and enterprise-style systems such as ClearDrive.lk. My experience includes Python, FastAPI, JavaScript, React, Next.js, PostgreSQL, Docker, GitHub Actions, and Agile development using Jira."
  ],

  availableForWork: true,
  availabilityNote: 'Currently seeking Software Engineering Internship opportunities',

  social: {
    github: 'https://github.com/Chami-02',
    linkedin: 'https://www.linkedin.com/in/chamikara-gallege-3b0861295/',
    facebook: 'https://web.facebook.com/parindra.chameekara',
    instagram: 'https://www.instagram.com/__pc_02/',
    email: 'parindrachameekara@gmail.com',
  },

  stats: [
    { label: 'Projects Built', value: '5+' },
    { label: 'Technologies', value: '10+' },
    { label: 'GitHub Repos', value: '5+' },
    { label: 'Learning', value: 'Continuous' },
  ],
};

// ── Main seed function ─────────────────────────────────────────────────────

async function seed() {
  try {
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
    await User.create({
      email:    'admin@portfolio.dev',
      password: 'Admin@1234!',
    });
    console.log('🔐 Created admin user: admin@portfolio.dev / Admin@1234!');

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