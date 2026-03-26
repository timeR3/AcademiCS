'use client';
import { useCallback, useEffect, useRef } from 'react';
import { AnalyticsView } from './AnalyticsView';
import { UsersView } from './UsersView';
import { CoursesView } from './CoursesView';
import { SettingsView } from './SettingsView';
import { CourseCreationView } from '../teacher/CourseCreationView';
import type { Course } from '@/types';
import { useCourse } from '@/context/CourseContext';
import { apiGet } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const { adminView, setAdminView, activeCourse, setActiveCourseId, refreshCourses, updateCourse, courses, archivedCourses } = useCourse();
  const { toast } = useToast();
  const prefetchedCourseIdsRef = useRef<Set<string>>(new Set());

  const prefetchCourseDetails = useCallback(async (course: Course) => {
    if (prefetchedCourseIdsRef.current.has(course.id)) {
      return;
    }
    prefetchedCourseIdsRef.current.add(course.id);
    try {
      const courseStatus = encodeURIComponent(course.status);
      const courseId = encodeURIComponent(course.id);
      const detailedCourses = await apiGet<Course[]>(`/api/courses?role=admin&status=${courseStatus}&courseId=${courseId}&includeDetails=true`);
      const detailedCourse = detailedCourses[0] ?? course;
      updateCourse(detailedCourse);
    } catch {
      prefetchedCourseIdsRef.current.delete(course.id);
    }
  }, [updateCourse]);

  const handleEditCourse = async (course: Course) => {
    prefetchedCourseIdsRef.current.add(course.id);
    try {
      await prefetchCourseDetails(course);
      setAdminView('edit-course');
      setActiveCourseId(course.id);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setAdminView('courses');
      setActiveCourseId(null);
      throw error;
    }
  };
  
  const handleBackToTabs = () => {
    refreshCourses();
    setActiveCourseId(null);
    setAdminView('courses');
  }

  useEffect(() => {
    if (adminView !== 'courses') {
      return;
    }
    const candidates = [courses[0], archivedCourses[0]].filter((course): course is Course => !!course);
    if (candidates.length === 0) {
      return;
    }

    let timeoutId: number | null = null;
    let idleId: number | null = null;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const prefetch = () => {
      candidates.forEach(course => {
        void prefetchCourseDetails(course);
      });
    };

    if (idleWindow.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(prefetch, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(prefetch, 250);
    }

    return () => {
      if (idleId !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [adminView, courses, archivedCourses, prefetchCourseDetails]);
  
  if (adminView === 'edit-course' && activeCourse) {
    return <CourseCreationView onCourseSaved={handleBackToTabs} isEditing={true} isAdminView={true} />;
  }

  const renderContent = () => {
    switch (adminView) {
      case 'analytics':
        return <AnalyticsView />;
      case 'courses':
        return <CoursesView onEditCourse={handleEditCourse} onPrefetchCourse={(course) => { void prefetchCourseDetails(course); }} />;
      case 'users':
        return <UsersView />;
       case 'settings':
        return <SettingsView />;
      default:
        return <AnalyticsView />;
    }
  }

  return (
    <div className="w-full h-full min-w-0 space-y-6 sm:space-y-8">
        <div className="w-full h-full min-w-0">
            {renderContent()}
        </div>
    </div>
  );
}
