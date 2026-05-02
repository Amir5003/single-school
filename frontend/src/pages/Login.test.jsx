import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import Login from './Login';

// Mock loginUser from auth.api
vi.mock('../api/auth.api', () => ({
  loginUser: vi.fn(),
}));

import { loginUser } from '../api/auth.api';

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password inputs', () => {
    renderWithProviders(<Login />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    renderWithProviders(<Login />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows inline error on 401 response', async () => {
    loginUser.mockRejectedValueOnce({
      response: { status: 401, data: {} },
    });

    renderWithProviders(<Login />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'WrongPass1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });

  it('disables submit button during loading', async () => {
    // Simulate a never-resolving request
    loginUser.mockReturnValueOnce(new Promise(() => {}));

    renderWithProviders(<Login />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'Admin1234!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    });
  });
});
