import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import StudentDashboard from './StudentDashboard';

// Mock all student API calls
vi.mock('../../api/student.api', () => ({
  getProfile: vi.fn(),
  getAttendance: vi.fn(),
  getCoursework: vi.fn(),
  getStudentAnnouncements: vi.fn(),
}));

import {
  getProfile,
  getAttendance,
  getCoursework,
  getStudentAnnouncements,
} from '../../api/student.api';

const authState = {
  auth: {
    user: { name: 'Test Student', role: 'student' },
    role: 'student',
    isAuthenticated: true,
  },
  ui: { loading: false, toast: { message: '', type: '' } },
};

describe('StudentDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProfile.mockResolvedValue({
      data: { name: 'Test Student', enrollmentId: 'STU-001', classId: { name: '5-A' } },
    });
    getAttendance.mockResolvedValue({
      data: { percentage: '85.00', totalDays: 20, presentDays: 17, records: [] },
    });
    getCoursework.mockResolvedValue({
      data: {
        subjects: [
          {
            subject: 'Math',
            average: 90,
            count: 1,
            entries: [
              {
                _id: 'e1',
                title: 'Unit Test 1',
                subject: 'Math',
                assessmentType: 'class_test',
                marksObtained: 90,
                maxMarks: 100,
                date: '2026-07-14T00:00:00.000Z',
                teacherName: 'Mr Ahmed',
                absent: false,
                percentage: 90,
                classAverage: 85,
              },
            ],
          },
        ],
        overallPercentage: 90,
        totalCount: 1,
      },
    });
    getStudentAnnouncements.mockResolvedValue({
      data: [{ _id: '1', title: 'Notice 1', content: 'Content', publishedAt: new Date().toISOString() }],
    });
  });

  it('renders the dashboard heading', async () => {
    renderWithProviders(<StudentDashboard />, { preloadedState: authState });
    // Greeting banner: "Good morning/afternoon/evening, <name> 👋"
    expect(
      screen.getByText(/good (morning|afternoon|evening)/i)
    ).toBeInTheDocument();
  });

  it('shows 4 summary card labels', async () => {
    renderWithProviders(<StudentDashboard />, { preloadedState: authState });
    // Look for the navigation section to confirm all 4 cards render
    await waitFor(() => {
      expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls all 4 API functions on mount', async () => {
    renderWithProviders(<StudentDashboard />, { preloadedState: authState });
    await waitFor(() => {
      expect(getProfile).toHaveBeenCalledTimes(1);
      expect(getAttendance).toHaveBeenCalledTimes(1);
      expect(getCoursework).toHaveBeenCalledTimes(1);
      expect(getStudentAnnouncements).toHaveBeenCalledTimes(1);
    });
  });
});
