import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../../test/renderWithProviders';
import ProtectedRoute from './ProtectedRoute';

const ProtectedContent = () => <div>Protected Content</div>;

/**
 * Render the guard inside a route tree, the way App.jsx does.
 *
 * Rendered bare, a redirect never resolves: <Navigate> re-runs its effect
 * whenever `state` changes identity, ProtectedRoute hands it a fresh
 * `{ from: location }` on every render, and with no matching route the guard
 * stays mounted to do it again — an infinite navigation loop that exhausts the
 * worker's heap. Giving the redirect somewhere to land ends the cycle and lets
 * each test assert where the user actually ended up.
 */
function renderGuard(element, preloadedState) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={element} />
      <Route path="/login" element={<div>Login Page</div>} />
      <Route
        path="/schools/:slug/teacher/dashboard"
        element={<div>Teacher Dashboard</div>}
      />
    </Routes>,
    { preloadedState }
  );
}

describe('ProtectedRoute', () => {
  it('redirects to /login when unauthenticated', () => {
    renderGuard(
      <ProtectedRoute><ProtectedContent /></ProtectedRoute>,
      {
        auth: { user: null, role: null, isAuthenticated: false, schoolSlug: null },
        ui: { loading: false, toast: { message: '', type: '' } },
      }
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders children when authenticated with correct role', () => {
    renderGuard(
      <ProtectedRoute allowedRole="school-admin"><ProtectedContent /></ProtectedRoute>,
      {
        auth: {
          user: { name: 'Admin User' },
          role: 'school-admin',
          isAuthenticated: true,
          schoolSlug: 'demo-school',
        },
        ui: { loading: false, toast: { message: '', type: '' } },
      }
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to its own dashboard when authenticated with the wrong role', () => {
    renderGuard(
      <ProtectedRoute allowedRole="school-admin"><ProtectedContent /></ProtectedRoute>,
      {
        auth: {
          user: { name: 'Teacher User' },
          role: 'teacher',
          isAuthenticated: true,
          schoolSlug: 'demo-school',
        },
        ui: { loading: false, toast: { message: '', type: '' } },
      }
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Teacher Dashboard')).toBeInTheDocument();
  });
});
