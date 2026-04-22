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
import { CourseAnalytics } from '../teacher/CourseAnalytics';
import { StudentManagement } from '../teacher/StudentManagement';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';




export default function AdminDashboard() {
  const { adminView, setAdminView, activeCourse, setActiveCourseId, refreshCourses, updateCourse, courses, archivedCourses } = useCourse();
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
  
  const renderContent = () => {
    switch (adminView) {
      case 'analytics':
        return <AnalyticsView />;
      case 'course-analytics':
        return <CourseAnalytics onBack={handleBackToTabs} />;
      case 'edit-course':
        if (!activeCourse) {
          setTimeout(() => setAdminView('courses'), 0);
          return <AnalyticsView />;
        }
        return <CourseCreationView onCourseSaved={handleBackToTabs} isEditing={true} isAdminView={true} />;
      case 'students':
        return (
            <div>
                 <Button variant="ghost" onClick={() => setAdminView('courses')} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver a Cursos
                </Button>
                <StudentManagement />
            </div>
        );
      case 'courses':
        return <CoursesView onPrefetchCourse={prefetchCourseDetails} />;
      case 'users':
        return <UsersView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <AnalyticsView />;
    }
  };


  return (
    <div className="w-full h-full min-w-0 space-y-6 sm:space-y-8">
        <div className="w-full h-full min-w-0">
            {renderContent()}
        </div>
    </div>
  );
}
