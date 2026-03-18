'use client';
import { useState, useEffect } from 'react';
import { AnalyticsView } from './AnalyticsView';
import { UsersView } from './UsersView';
import { CoursesView } from './CoursesView';
import { SettingsView } from './SettingsView';
import { CourseCreationView } from '../teacher/CourseCreationView';
import type { Course, UserRole } from '@/types';
import { useCourse } from '@/context/CourseContext';

export default function AdminDashboard() {
  const { adminView, setAdminView, activeCourse, setActiveCourseId, refreshCourses } = useCourse();

  const handleEditCourse = (course: Course) => {
    setActiveCourseId(course.id);
    setAdminView('edit-course');
  };
  
  const handleBackToTabs = () => {
    refreshCourses();
    setActiveCourseId(null);
    setAdminView('courses');
  }
  
  if (adminView === 'edit-course' && activeCourse) {
    return <CourseCreationView onCourseSaved={handleBackToTabs} isEditing={true} isAdminView={true} />;
  }

  const renderContent = () => {
    switch (adminView) {
      case 'analytics':
        return <AnalyticsView />;
      case 'courses':
        return <CoursesView onEditCourse={handleEditCourse} />;
      case 'users':
        return <UsersView />;
       case 'settings':
        return <SettingsView />;
      default:
        return <AnalyticsView />;
    }
  }

  return (
    <div className="space-y-8 h-full">
        <div className="h-full">
            {renderContent()}
        </div>
    </div>
  );
}
