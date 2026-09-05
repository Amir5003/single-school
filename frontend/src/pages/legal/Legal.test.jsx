import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Terms from './Terms';
import Privacy from './Privacy';
import Refunds from './Refunds';

// NFR-001: the legal pages must render for a logged-out visitor with no school
// context and no network dependency. If any of them ever starts calling the
// API, this mock records it and the assertion below fails.
vi.mock('../../api/axiosInstance', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
import axiosInstance from '../../api/axiosInstance';
import { hasUnfilledPlaceholders } from '../../constants/legalConfig';

const renderPage = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Legal documents', () => {
  it.each([
    ['Terms of Service', <Terms key="t" />],
    ['Privacy Notice', <Privacy key="p" />],
    ['Refund & Cancellation Policy', <Refunds key="r" />],
  ])('renders %s without authentication or a school context', (heading, ui) => {
    renderPage(ui);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('makes no API call — these pages must work for a logged-out visitor', () => {
    renderPage(<Privacy />);
    expect(axiosInstance.get).not.toHaveBeenCalled();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it('shows the version and effective date', () => {
    renderPage(<Terms />);
    expect(screen.getByText(/Version 1\.0 · Effective/)).toBeInTheDocument();
  });

  it('states plainly that there is no tracking or advertising', () => {
    // This claim is load-bearing and verifiable in the diff. If an analytics
    // SDK is ever added, this page must change first — see Privacy.jsx.
    renderPage(<Privacy />);
    expect(
      screen.getByText(/no advertising, no analytics, and no third-party tracking/i)
    ).toBeInTheDocument();
  });

  it('puts the school, not the platform, in charge of what is recorded', () => {
    renderPage(<Privacy />);
    expect(
      screen.getByText(/your school decided to use this software and decided what to record about you/i)
    ).toBeInTheDocument();
  });

  it('has no unfilled placeholders, so no warning banner is shown', () => {
    // legalConfig.js is filled in. If someone reintroduces a TODO value the
    // banner reappears and this fails — which is the point: an unfinished
    // document must never render as a finished one.
    expect(hasUnfilledPlaceholders()).toBe(false);
    renderPage(<Terms />);
    expect(screen.queryByText(/Not ready to publish/i)).not.toBeInTheDocument();
  });

  it('names the operating entity and jurisdiction, not a placeholder', () => {
    renderPage(<Terms />);
    // Guards against shipping a contract whose counterparty is "TODO".
    // The entity is named twice — the opening paragraph and the contact block.
    expect(screen.getAllByText(/Amir Suhel/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Madhepura, Bihar/).length).toBeGreaterThan(0);
  });
});
