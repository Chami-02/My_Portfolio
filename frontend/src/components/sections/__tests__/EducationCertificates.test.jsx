// PF-143 — the Education + Certificates row under About (text only).
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MotionProvider } from '../../../providers/MotionProvider';

const data = vi.hoisted(() => ({ about: undefined, education: [], certificates: [] }));
vi.mock('../../../hooks/useAbout', () => ({ useAbout: () => ({ data: data.about }) }));
vi.mock('../../../hooks/useEntries', () => ({
  useEducation:    () => ({ data: data.education }),
  useCertificates: () => ({ data: data.certificates }),
}));

const { EducationCertificates, HOME_CERTIFICATES } = await import('../EducationCertificates');

const cert = (n, over = {}) => ({
  _id: `c${n}`, slug: `cert-${n}`, title: `Cert ${n}`, issuer: 'Oracle', issued: '2025-06',
  verifyUrl: `https://verify.example/${n}`, ...over,
});
const EDU = { _id: 'e1', school: 'University of Westminster', degree: 'BSc (Hons)', fieldOfStudy: 'Computer Science',
  start: '2022-09', end: '2022-09', grade: 'First Class',
  // Fields an entry no longer has (owner, 2026-10-31) — an old record must not show them.
  skills: ['Java', 'React'], proofUrl: 'https://proof.example/p' };

const renderRow = () => render(
  <MemoryRouter><MotionProvider><EducationCertificates /></MotionProvider></MemoryRouter>,
);

beforeEach(() => {
  data.about = undefined;
  data.education = [];
  data.certificates = [];
});

describe('EducationCertificates', () => {
  // The zero case: nothing published → nothing at all, not two empty headings.
  it('renders nothing when both lists are empty', () => {
    const { container } = renderRow();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an education entry as text: degree + field, school, dates · grade — no skills, no proof', () => {
    data.education = [EDU];
    renderRow();
    expect(screen.getByRole('heading', { name: 'Education' })).toBeInTheDocument();
    const step = screen.getByRole('listitem');
    expect(within(step).getByText('BSc (Hons), Computer Science')).toBeInTheDocument();
    expect(within(step).getByText('University of Westminster')).toBeInTheDocument();
    expect(within(step).getByText(/SEP 2022 – SEP 2022 · First Class/)).toBeInTheDocument();
    expect(within(step).queryByText(/Java/)).not.toBeInTheDocument();
    expect(within(step).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Certificates' })).not.toBeInTheDocument();
  });

  it(`lists at most ${HOME_CERTIFICATES} certificates, text only, each linking to its own page`, () => {
    data.certificates = Array.from({ length: 8 }, (_, i) => cert(i + 1));
    renderRow();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(HOME_CERTIFICATES);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(within(rows[0]).getByRole('link', { name: 'Cert 1' })).toHaveAttribute('href', '/certificates/cert-1');
    expect(within(rows[0]).getByText('Oracle · 2025')).toBeInTheDocument();
  });

  it('VERIFY opens the issuer in a new tab; a certificate without a link has no button', () => {
    data.certificates = [cert(1), cert(2, { verifyUrl: '' })];
    renderRow();
    const [withLink, without] = screen.getAllByRole('listitem');
    const verify = within(withLink).getByRole('link', { name: 'VERIFY Cert 1 (opens in a new tab)' });
    expect(verify).toHaveAttribute('href', 'https://verify.example/1');
    expect(verify).toHaveAttribute('target', '_blank');
    expect(verify).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(without).queryByRole('link', { name: /VERIFY/ })).not.toBeInTheDocument();
  });

  // Owner: VIEW ALL is always shown, not only past six.
  it('VIEW ALL shows even with ONE certificate', () => {
    data.certificates = [cert(1)];
    renderRow();
    expect(screen.getByRole('link', { name: 'VIEW ALL CERTIFICATES →' })).toHaveAttribute('href', '/certificates');
  });

  it('without a degree, the school is the title line (owner, 2026-10-31)', () => {
    data.education = [{ ...EDU, degree: '', fieldOfStudy: '' }];
    renderRow();
    const step = screen.getByRole('listitem');
    expect(within(step).getAllByText('University of Westminster')).toHaveLength(1);
    expect(within(step).getByText('University of Westminster').className).toMatch(/degree/);
  });

  it('shows a school\'s logo in its disc beside the name — decorative, and only when there is one', () => {
    data.education = [{ ...EDU, logo: { url: 'https://res.cloudinary.com/demo/l.png' } }, { ...EDU, _id: 'e2', school: 'No Logo School' }];
    const { container } = renderRow();
    const logos = container.querySelectorAll('img');
    expect(logos).toHaveLength(1);
    expect(logos[0]).toHaveAttribute('src', 'https://res.cloudinary.com/demo/l.png');
    expect(logos[0]).toHaveAttribute('alt', '');
  });

  it('with a website, the school name AND its logo open the school\'s site in a new tab', () => {
    data.education = [{ ...EDU, website: 'https://www.westminster.ac.uk', logo: { url: 'https://res.cloudinary.com/demo/l.png' } }];
    const { container } = renderRow();
    const name = screen.getByRole('link', { name: 'University of Westminster (opens in a new tab)' });
    expect(name).toHaveAttribute('href', 'https://www.westminster.ac.uk');
    expect(name).toHaveAttribute('target', '_blank');
    expect(name).toHaveAttribute('rel', 'noopener noreferrer');
    const logo = container.querySelector('img').closest('a');
    expect(logo).toHaveAttribute('href', 'https://www.westminster.ac.uk');
    expect(logo).toHaveAttribute('tabindex', '-1');   // one link per school for keyboard users
  });

  it('without a website, the school name is plain text', () => {
    data.education = [EDU];
    renderRow();
    expect(screen.queryByRole('link', { name: /University of Westminster/ })).not.toBeInTheDocument();
  });

  it('every word is the owner\'s when set', () => {
    data.about = { certificatesHeading: 'Credentials', certificatesViewAll: 'SEE THEM ALL', certificatesVerify: 'CHECK' };
    data.education = [EDU];
    data.certificates = [cert(1)];
    renderRow();
    // Education's heading is FIXED (owner, 2026-10-31).
    expect(screen.getByRole('heading', { name: 'Education' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Credentials' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'SEE THEM ALL →' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'CHECK Cert 1 (opens in a new tab)' })).toBeInTheDocument();
  });
});
