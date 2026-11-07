// PF-144 — the picture-on-top project card, shared by the home section and
// /projects. Behaviour through the DOM; the stylesheet rules that would fail
// silently are parsed with postcss (never raw text — the comments name the
// very values asserted).
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { ProjectCard } from '../ProjectCard';

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../ProjectCard.module.css'), 'utf8');
const decls = (selector) => {
  const out = {};
  postcss.parse(css).walkRules((rule) => {
    if (rule.selector === selector) rule.walkDecls((d) => { out[d.prop] = d.value; });
  });
  return out;
};

const PROJECT = Object.freeze({
  _id: 'p1', slug: 'cleardrivelk', title: 'ClearDrive.lk', description: 'Vehicle import platform.',
  featured: true, categories: Object.freeze(['Web App']), role: 'Team lead', client: 'ClearDrive.lk',
  startedOn: '2024-02', endedOn: '', ongoing: true,
  backgroundImage: Object.freeze({ src: 'https://res.cloudinary.com/demo/image/upload/v1/portfolio/projects/a.webp' }),
});

const renderCard = (props = {}) => render(
  <MemoryRouter><ProjectCard project={PROJECT} {...props} /></MemoryRouter>,
);

describe('ProjectCard — what it shows', () => {
  it('the picture on top, sized for a card, decorative', () => {
    const { container } = renderCard();
    const img = container.querySelector('img');
    expect(img.getAttribute('src')).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_limit,w_800,f_auto,q_auto/v1/portfolio/projects/a.webp');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  // PF-154 (Lighthouse heading-order): h3 under the home section's h2, h2 on
  // /projects, where the cards sit straight under the page's h1.
  it('the title is an h3 unless the page asks for an h2', () => {
    const { unmount } = renderCard();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(PROJECT.title);
    unmount();
    renderCard({ titleAs: 'h2' });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(PROJECT.title);
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });

  it('the big card asks for a bigger picture', () => {
    const { container } = renderCard({ big: true });
    expect(container.querySelector('img').getAttribute('src')).toContain('w_1200');
  });

  it('category and ★ FEATURED on the picture; date, title, summary, role · client below', () => {
    renderCard();
    expect(screen.getByText('Web App')).toBeInTheDocument();
    expect(screen.getByText('★ FEATURED')).toBeInTheDocument();
    expect(screen.getByText('FEB 2024 – PRESENT')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'ClearDrive.lk' })).toBeInTheDocument();
    expect(screen.getByText('Vehicle import platform.')).toBeInTheDocument();
    expect(screen.getByText('Team lead · ClearDrive.lk')).toBeInTheDocument();
  });

  it('leaves out what a project does not have — never an empty label', () => {
    renderCard({ project: { ...PROJECT, featured: false, categories: [], role: '', client: '',
      startedOn: '', ongoing: false, backgroundImage: { src: '' } } });
    expect(screen.queryByText('★ FEATURED')).toBeNull();
    expect(screen.queryByText(/PRESENT|·/)).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    // No picture: the initials panel, hidden from a screen reader.
    expect(screen.getByText('C')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ProjectCard — one link', () => {
  it('is ONE link, named by the title, to /projects/<slug>; VIEW PROJECT is a visual cue', () => {
    renderCard();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('ClearDrive.lk');
    expect(links[0]).toHaveAttribute('href', '/projects/cleardrivelk');
    expect(screen.getByText('VIEW PROJECT →')).toHaveAttribute('aria-hidden', 'true');
  });

  it('carries the router state it is given (/projects → BACK TO RESULTS)', async () => {
    let seen;
    const Spy = () => { seen = useLocation().state; return null; };
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<ProjectCard project={PROJECT} state={{ from: 'q=car' }} />} />
          <Route path="/projects/:slug" element={<Spy />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.setup().click(screen.getByRole('link'));
    expect(seen).toEqual({ from: 'q=car' });
  });

  it('the stretched link covers the whole card', () => {
    expect(decls('.link::after')).toMatchObject({ content: "''", position: 'absolute', inset: '0' });
    expect(decls('.card').position).toBe('relative');
  });
});

describe('ProjectCard — stylesheet guards', () => {
  // Locked: a Reveal-wrapped element never declares `transition`.
  it('the card declares no transition (the home section Reveal-wraps it)', () => {
    expect(decls('.card').transition).toBeUndefined();
    expect(decls('.card:hover').transform).toBe('translateY(-8px)');
  });

  it('the summary is clamped to TWO lines', () => {
    expect(decls('.summary')).toMatchObject({ '-webkit-line-clamp': '2', 'line-clamp': '2', overflow: 'hidden' });
  });

  // Over a photo a see-through pill measured 2.35:1 (owner, 2026-10-03).
  it('both labels on the picture have a SOLID fill, in both themes', () => {
    expect(decls('.category,\n.featured').background).toBe('rgb(var(--srf))');
  });
});
