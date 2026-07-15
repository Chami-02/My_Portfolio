import { describe, it, expect } from 'vitest';
import { render, screen }       from '@testing-library/react';
import { MemoryRouter }         from 'react-router-dom';
import { NotFoundPage }         from '../NotFoundPage';

describe('NotFoundPage', () => {
  const renderPage = () =>
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

  it('renders the 404 heading', () => {
    renderPage();
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders a "Back to Home" link that points to /', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /back to home/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });

  it('renders an error message explaining the page is missing', () => {
    renderPage();
    expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument();
  });
});