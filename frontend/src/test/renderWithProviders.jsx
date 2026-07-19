import React from 'react';
import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import authReducer from '../redux/slices/authSlice';
import uiReducer from '../redux/slices/uiSlice';
import schoolReducer from '../redux/slices/schoolSlice';
import subscriptionReducer from '../redux/slices/subscriptionSlice';

/**
 * Wrap a component with Redux store + React Router for tests.
 * Registers the SAME reducers as the real store (redux/store.js) so
 * components that read school/subscription state render in tests.
 * @param {React.ReactNode} ui          - Component to render
 * @param {object}          options
 * @param {object}          options.preloadedState - Initial Redux state to override defaults
 * @param {string[]}        options.initialEntries - Router initial path(s)
 */
export function renderWithProviders(ui, { preloadedState = {}, initialEntries = ['/'] } = {}) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      ui: uiReducer,
      school: schoolReducer,
      subscription: subscriptionReducer,
    },
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

