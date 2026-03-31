import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CourseCard } from '../CourseCard';
import React from 'react';
import type { Course } from '@/types';

const mockCourse: Course = {
  id: '1',
  title: 'Test Course',
  teacherId: 'teacher-1',
  status: 'active',
  levels: [
    { id: 'l1', title: 'Module 1', status: 'in-progress', introduction: '', syllabus: [], questionnaire: [], questionsToDisplay: 5 }
  ],
  students: [],
  completedStudentIds: [],
  sourceFiles: [],
  bibliography: [],
  categoryName: 'Tech',
  difficulty: 'intermediate',
  includeFundamentals: true
};

describe('CourseCard', () => {
  it('renders course title and category', () => {
    render(<CourseCard course={mockCourse} onViewDetails={() => {}} />);
    expect(screen.getByText('Test Course')).toBeDefined();
    expect(screen.getByText('Tech')).toBeDefined();
  });

  it('calls onViewDetails when "Ver Detalles" is clicked', () => {
    const onViewDetails = vi.fn();
    render(<CourseCard course={mockCourse} onViewDetails={onViewDetails} />);
    fireEvent.click(screen.getByText(/Ver Detalles/i));
    expect(onViewDetails).toHaveBeenCalled();
  });

  it('shows student-specific progress in student view', () => {
    const studentCourse = { ...mockCourse, status: 'in-progress' as const };
    render(<CourseCard course={studentCourse} onViewDetails={() => {}} isStudentView={true} />);
    expect(screen.getByText(/Progreso/i)).toBeDefined();
    expect(screen.getByText(/Empezar Curso/i)).toBeDefined();
  });
});
