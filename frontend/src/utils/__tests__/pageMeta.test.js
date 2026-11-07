// PF-153 — what search engines read for each page.
import { beforeEach, describe, expect, it } from 'vitest';
import { applyPageMeta, pageTitle } from '../pageMeta';

const description = () => document.head.querySelector('meta[name="description"]').getAttribute('content');
const canonical = () => document.head.querySelector('link[rel="canonical"]');
const robots = () => document.head.querySelector('meta[name="robots"]');
const structured = () => document.getElementById('page-structured-data');

beforeEach(() => {
  document.head.innerHTML = '<title>The site</title><meta name="description" content="The site says">';
});

describe('applyPageMeta', () => {
  it('edits index.html\'s own title, so there is only ever one', () => {
    applyPageMeta({ title: 'Blog' });
    expect(document.title).toBe('Blog — Parindra Gallage');
    expect(document.head.querySelectorAll('title')).toHaveLength(1);
  });

  it('edits the existing description, so there is only ever one', () => {
    applyPageMeta({ description: 'A page says' });
    expect(description()).toBe('A page says');
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  });

  it('leaves the site\'s words alone when a page has none', () => {
    applyPageMeta({ path: '/' });
    expect(document.title).toBe('The site');
    expect(description()).toBe('The site says');
  });

  it('gives the full address as canonical', () => {
    applyPageMeta({ path: '/blog/a-post' });
    expect(canonical().getAttribute('href')).toBe('https://parindragallage.com/blog/a-post');
  });

  it('adds no canonical or noindex unless asked', () => {
    applyPageMeta({ title: 'Blog' });
    expect(canonical()).toBeNull();
    expect(robots()).toBeNull();
  });

  it('marks a page that results should not list', () => {
    applyPageMeta({ title: 'Page not found', noindex: true });
    expect(robots().getAttribute('content')).toBe('noindex');
  });

  it('writes structured data as data, never as a script that runs', () => {
    applyPageMeta({ structured: { '@type': 'Person', name: 'A' } });
    expect(structured().type).toBe('application/ld+json');
    expect(JSON.parse(structured().textContent)).toEqual({ '@context': 'https://schema.org', '@type': 'Person', name: 'A' });
  });

  it('puts everything back on leaving, so the next page never inherits it', () => {
    const undo = applyPageMeta({
      title: 'A post', description: 'Its words', path: '/blog/a', noindex: true, structured: { '@type': 'X' },
    });
    undo();
    expect(document.title).toBe('The site');
    expect(description()).toBe('The site says');
    expect(canonical()).toBeNull();
    expect(robots()).toBeNull();
    expect(structured()).toBeNull();
  });

  it('a second page replaces the first, leaving one of each', () => {
    applyPageMeta({ path: '/a', structured: { '@type': 'X' } });
    applyPageMeta({ path: '/b', structured: { '@type': 'Y' } });
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(canonical().getAttribute('href')).toBe('https://parindragallage.com/b');
    expect(document.head.querySelectorAll('script')).toHaveLength(1);
  });
});

describe('pageTitle', () => {
  it('adds the site name, or nothing at all', () => {
    expect(pageTitle('Blog')).toBe('Blog — Parindra Gallage');
    expect(pageTitle(undefined)).toBeNull();
  });
});
