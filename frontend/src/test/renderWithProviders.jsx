import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import authReducer from '../redux/slices/authSlice';
import uiReducer from '../redux/slices/uiSlice';

/**
 * Wrap a component with Redux store + React Router for tests.
 * @param {React.ReactNode} ui          - Component to render
 * @param {object}          options
 * @param {object}          options.preloadedState - Initial Redux state to override defaults
 * @param {string[]}        options.initialEntries - Router initial path(s)
 */
export function renderWithProviders(ui, { preloadedState = {}, initialEntries = ['/'] } = {}) {
  const store = configureStore({
    reducer: { auth: authReducer, ui: uiReducer },
    preloadedState,
  });
  return {
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </Provider>
    ),
    store,
  };
}

