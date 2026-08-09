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

  it('rejects a section with neither body nor bullets', async () => {
    const post = new Blog({
      ...BASE,
      sections: [{ heading: 'Empty', body: [], bullets: [] }],
    });
    await expect(post.validate()).rejects.toThrow(/at least one paragraph or bullet/);
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
