

'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { Course, CourseLevel, Question, UserRole, User, StudentProgress, CourseCategory, StudentEnrollment } from '@/types/index';
import { fetchCoursesForTeacher, fetchArchivedCoursesForTeacher, fetchSuspendedCoursesForTeacher, fetchCoursesForStudent, fetchAllTeachersWithCourses, fetchAllUsers, fetchAllCategories } from '@/app/actions';
import { useAuth } from './AuthContext';
import { useRole } from './RoleContext';

type AdminView = 'analytics' | 'courses' | 'users' | 'settings' | 'edit-course';
type TeacherView = 'dashboard' | 'create' | 'edit' | 'students' | 'overview' | 'analytics' | 'archived-overview' | 'suspended-overview';
type StudentView = 'dashboard' | 'content' | 'evaluation';

interface CourseContextType {
  courses: Course[];
  archivedCourses: Course[];
  suspendedCourses: Course[];
  allUsers: User[];
  allCategories: CourseCategory[];
  activeCourse: Course | null;
  setActiveCourseId: (id: string | null) => void;
  refreshCourses: () => Promise<void>;
  updateCourse: (updatedCourse: Partial<Course> & { id: string }) => void;
  updateLevel: (courseId: string, levelId: string, updatedLevel: Partial<CourseLevel>) => void;
  updateQuestionnaireForLevel: (courseId: string, levelId: string, questionnaire: Question[], questionsToDisplay: number) => void;
  // View management
  adminView: AdminView;
  setAdminView: (view: AdminView) => void;
  teacherView: TeacherView;
  setTeacherView: (view: TeacherView) => void;
  studentView: StudentView;
  setStudentView: (view: StudentView) => void;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export function CourseProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [archivedCourses, setArchivedCourses] = useState<Course[]>([]);
  const [suspendedCourses, setSuspendedCourses] = useState<Course[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allCategories, setAllCategories] = useState<CourseCategory[]>([]);
  const [activeCourseId, setActiveCourseIdState] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();
  const { activeRole } = useRole();

  // State for views
  const [adminView, setAdminView] = useState<AdminView>('analytics');
  const [teacherView, setTeacherView] = useState<TeacherView>('dashboard');
  const [studentView, setStudentView] = useState<StudentView>('dashboard');


  const refreshCourses = useCallback(async () => {
    if (!user?.id || !isAuthenticated || !activeRole) {
      return;
    };
    
    console.log(`Refreshing courses for user ${user.id} with role ${activeRole}`);
    
    try {
        const [users, categories] = await Promise.all([
          fetchAllUsers(),
          fetchAllCategories({ onlyActive: activeRole === 'teacher' })
        ]);
        setAllUsers(users);
        setAllCategories(categories);

        if (activeRole === 'teacher') {
            const [active, archived, suspended] = await Promise.all([
                fetchCoursesForTeacher(user.id),
                fetchArchivedCoursesForTeacher(user.id),
                fetchSuspendedCoursesForTeacher(user.id)
            ]);
            setCourses(active);
            setArchivedCourses(archived);
            setSuspendedCourses(suspended);
        } else if (activeRole === 'student'){
            const studentCourses = await fetchCoursesForStudent(user.id);
            setCourses(studentCourses);
            setArchivedCourses([]); // Students don't see archived courses
            setSuspendedCourses([]);
        } else if (activeRole === 'admin') {
            const teachersWithCourses = await fetchAllTeachersWithCourses();
            const allCourses = teachersWithCourses.flatMap(teacher => teacher.courses);
            setCourses(allCourses.filter(c => c.status === 'active'));
            setArchivedCourses(allCourses.filter(c => c.status === 'archived'));
            setSuspendedCourses(allCourses.filter(c => c.status === 'suspended'));
        }
    } catch (error) {
        console.error("Error refreshing courses:", error);
    }
  }, [user, isAuthenticated, activeRole]);

  useEffect(() => {
    if (isAuthenticated && user && activeRole) {
      // Clear old data before fetching new data for the new role
      setCourses([]);
      setArchivedCourses([]);
      setSuspendedCourses([]);
      setAllUsers([]);
      setAllCategories([]);
      refreshCourses();
    }
  }, [isAuthenticated, user, activeRole, refreshCourses]);
  
  // Reset views when role changes
  useEffect(() => {
      setAdminView('analytics');
      setTeacherView('dashboard');
      setStudentView('dashboard');
      setActiveCourseIdState(null); // Deselect active course on role change
  }, [activeRole]);


  const updateCourse = useCallback((updatedCourse: Partial<Course> & { id: string }) => {
    const update = (courseList: Course[]) => courseList.map(c => c.id === updatedCourse.id ? { ...c, ...updatedCourse } : c);
    setCourses(prev => update(prev));
    setArchivedCourses(prev => update(prev));
  }, []);

  const updateLevel = useCallback((courseId: string, levelId: string, updatedLevel: Partial<CourseLevel>) => {
    setCourses(prevCourses => prevCourses.map(course => {
        if (course.id === courseId) {
            return {
                ...course,
                levels: course.levels.map(level => 
                    level.id === levelId ? { ...level, ...updatedLevel } : level
                )
            };
        }
        return course;
    }));
  }, []);

  const updateQuestionnaireForLevel = useCallback((courseId: string, levelId: string, questionnaire: Question[], questionsToDisplay: number) => {
    const update = (courseList: Course[]) => courseList.map(course => {
      if (course.id === courseId) {
        return {
          ...course,
          levels: course.levels.map(level => 
            level.id === levelId 
              ? { ...level, questionnaire, questionsToDisplay } 
              : level
          )
        };
      }
      return course;
    });

    setCourses(prev => update(prev));
    setArchivedCourses(prev => update(prev));
  }, []);

  const activeCourse = useMemo(() => {
    const allCourses = [...courses, ...archivedCourses, ...suspendedCourses];
    return allCourses.find(c => c.id === activeCourseId) || null;
  }, [courses, archivedCourses, suspendedCourses, activeCourseId]);

  const setActiveCourseId = useCallback((id: string | null) => {
      setActiveCourseIdState(id);
  }, []);


  const value = {
      courses,
      archivedCourses,
      suspendedCourses,
      allUsers,
      allCategories,
      activeCourse,
      setActiveCourseId,
      refreshCourses,
      updateCourse,
      updateLevel,
      updateQuestionnaireForLevel,
      adminView, setAdminView,
      teacherView, setTeacherView,
      studentView, setStudentView,
  };

  return (
    <CourseContext.Provider value={value}>
      {children}
    </CourseContext.Provider>
  );
}

export function useCourse() {
  const context = useContext(CourseContext);
  if (context === undefined) {
    throw new Error('useCourse debe ser usado dentro de un CourseProvider');
  }
  return context;
}
