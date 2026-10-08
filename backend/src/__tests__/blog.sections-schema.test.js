const Blog = require('../models/Blog');

describe('Blog — sections schema (PF-59)', () => {

  const BASE = {
    title:   'Test Post',
    excerpt: 'A test post for schema validation.',
  };

  it('accepts a section with only body paragraphs', async () => {
    const post = new Blog({
      ...BASE,
      sections: [{ heading: 'Intro', body: ['Some text.'], bullets: [] }],
    });
    await expect(post.validate()).resolves.toBeUndefined();
  });

  it('accepts a section with only bullets', async () => {
    const post = new Blog({
      ...BASE,
      sections: [{ heading: 'List', body: [], bullets: ['One', 'Two'] }],
    });
    await expect(post.validate()).resolves.toBeUndefined();
  });

  it('rejects a section with neither body nor bullets on a PUBLISHED post', async () => {
    const post = new Blog({
      ...BASE,
      published: true,
      sections: [{ heading: 'Empty', body: [], bullets: [] }],
    });
    await expect(post.validate()).rejects.toThrow(/at least one paragraph or bullet/);
  });

  // PF-115: a draft keeps half-written sections rather than losing them.
  it('accepts an empty section, and a missing heading, on a DRAFT', async () => {
    const post = new Blog({
      title: 'Draft',
      sections: [{ heading: 'Empty', body: [], bullets: [] }, { body: ['Text first.'] }],
    });
    await expect(post.validate()).resolves.toBeUndefined();
  });

  it('requires a section heading on a PUBLISHED post', async () => {
    const post = new Blog({ ...BASE, published: true, sections: [{ body: ['Text.'] }] });
    await expect(post.validate()).rejects.toThrow(/Section heading is required/);
  });

  it('requires an excerpt on a PUBLISHED post but not on a draft', async () => {
    const sections = [{ heading: 'H', body: ['Text.'] }];
    await expect(new Blog({ title: 'T', sections }).validate()).resolves.toBeUndefined();
    await expect(new Blog({ title: 'T', sections, published: true }).validate())
      .rejects.toThrow(/Excerpt is required/);
  });

  it('requires a body on a PUBLISHED post — sections or legacy content', async () => {
    await expect(new Blog({ ...BASE, published: true }).validate())
      .rejects.toThrow(/needs a body/);
    await expect(new Blog({ ...BASE, published: true, content: 'Legacy.' }).validate())
      .resolves.toBeUndefined();
  });

  it('allows a post with content but no sections (not yet migrated)', async () => {
    const post = new Blog({
      ...BASE,
      content: 'Legacy markdown content.',
    });
    await expect(post.validate()).resolves.toBeUndefined();
  });

  it('allows a post with neither content nor sections', async () => {
    const post = new Blog(BASE);
    await expect(post.validate()).resolves.toBeUndefined();
  });

});
