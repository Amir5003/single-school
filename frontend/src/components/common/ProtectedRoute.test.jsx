import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import ProtectedRoute from './ProtectedRoute';

const ProtectedContent = () => <div>Protected Content</div>;

describe('ProtectedRoute', () => {
  it('redirects to /login when unauthenticated', () => {
    // isAuthenticated = false (default)
    const { container } = renderWithProviders(
      <ProtectedRoute><ProtectedContent /></ProtectedRoute>,
      {
        preloadedState: {
          auth: { user: null, role: null, isAuthenticated: false },
          ui: { loading: false, toast: { message: '', type: '' } },
        },
      }
    );
    // Protected content should NOT be rendered
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated with correct role', () => {
    renderWithProviders(
      <ProtectedRoute allowedRole="admin"><ProtectedContent /></ProtectedRoute>,
      {
        preloadedState: {
          auth: {
            user: { name: 'Admin User' },
            role: 'admin',
            isAuthenticated: true,
          },
          ui: { loading: false, toast: { message: '', type: '' } },
        },
      }
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects when authenticated but wrong role', () => {
    renderWithProviders(
      <ProtectedRoute allowedRole="admin"><ProtectedContent /></ProtectedRoute>,
      {
        preloadedState: {
          auth: {
            user: { name: 'Teacher User' },
            role: 'teacher',
            isAuthenticated: true,
          },
          ui: { loading: false, toast: { message: '', type: '' } },
        },
      }
    );
    // Should redirect away — content not shown
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
