
'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CourseOverview } from './CourseOverview';
import { CourseCreationView } from './CourseCreationView';
import { StudentManagement } from './StudentManagement';
import { useCourse } from '@/context/CourseContext';
import { Button } from '@/components/ui/button';
import { BookCopy, Archive, ArrowLeft, Eye, ArchiveRestore, Copy, PauseCircle, Play, Loader2, AlertTriangle, Activity, Users as UsersIcon, Trophy, Gauge, GraduationCap, ShieldAlert, TrendingUp } from 'lucide-react';
import { CourseCard } from '@/components/shared/CourseCard';
import type { Course } from '@/types';
import { ArchiveCourseDialog } from './ArchiveCourseDialog';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { CourseAnalytics } from './CourseAnalytics';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ArchivedCourseOverview } from './ArchivedCourseOverview';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { buttonVariants } from '../ui/button';
import { SuspendedCourseOverview } from './SuspendedCourseOverview';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { apiGet, apiPatch, apiPost, getFriendlyErrorMessage } from '@/lib/api-client';
import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';

type TeacherFocus = 'operacion' | 'pedagogico' | 'retencion';
type TeacherCardAction = 'all' | 'with_students' | 'with_completions' | 'high_enrollment' | 'at_risk' | 'critical';

export default function TeacherDashboard() {
  const { courses, archivedCourses, suspendedCourses, activeCourse, setActiveCourseId, teacherView, setTeacherView, refreshCourses, updateCourse } = useCourse();
  const { toast } = useToast();
  const [courseToArchive, setCourseToArchive] = useState<Course | null>(null);
  const [courseToSuspend, setCourseToSuspend] = useState<Course | null>(null);
  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null);
  const [teacherFocus, setTeacherFocus] = useState<TeacherFocus>('operacion');
  const [activeCardAction, setActiveCardAction] = useState<TeacherCardAction>('all');
  const prefetchedCourseIdsRef = useRef<Set<string>>(new Set());
  const activeCoursesRef = useRef<HTMLDivElement | null>(null);
  const criticalCoursesRef = useRef<HTMLDivElement | null>(null);

  // Reset to dashboard if no active course is selected for relevant views
  useEffect(() => {
    if (!activeCourse && ['edit', 'students', 'overview', 'analytics', 'archived-overview', 'suspended-overview'].includes(teacherView)) {
      setTeacherView('dashboard');
    }
    // If the view is 'create', ensure there is no active course
    if (teacherView === 'create' && activeCourse) {
        setActiveCourseId(null);
    }
  }, [activeCourse, teacherView, setTeacherView, setActiveCourseId]);
  
  const prefetchCourseDetails = useCallback(async (course: Course) => {
    if (prefetchedCourseIdsRef.current.has(course.id)) {
      return;
    }
    prefetchedCourseIdsRef.current.add(course.id);
    try {
      const teacherId = encodeURIComponent(course.teacherId ?? '');
      if (!teacherId) {
        return;
      }
      const courseId = encodeURIComponent(course.id);
      const status = encodeURIComponent(course.status);
      const detailedCourses = await apiGet<Course[]>(`/api/courses?role=teacher&userId=${teacherId}&status=${status}&courseId=${courseId}&includeDetails=true`);
      const detailedCourse = detailedCourses[0] ?? course;
      updateCourse(detailedCourse);
    } catch {
      prefetchedCourseIdsRef.current.delete(course.id);
    }
  }, [updateCourse]);

  const handleSelectCourse = async (course: Course, targetView: typeof teacherView) => {
    prefetchedCourseIdsRef.current.add(course.id);
    setLoadingCourseId(course.id);
    setActiveCourseId(course.id);
    setTeacherView(targetView);
    try {
      await prefetchCourseDetails(course);
    } catch (error) {
      toast({
        title: 'No pudimos abrir el curso',
        description: getFriendlyErrorMessage(error, 'Inténtalo nuevamente en unos segundos.'),
        variant: 'destructive'
      });
    } finally {
      setLoadingCourseId(null);
    }
  }
  
  const handleBackToDashboard = () => {
      refreshCourses();
      setActiveCourseId(null);
      setTeacherView('dashboard');
  }

  const handleArchiveClick = (course: Course) => {
    setCourseToArchive(course);
  };
  
  const handleSuspendClick = (course: Course) => {
    setCourseToSuspend(course);
  };


  const handleConfirmArchive = async () => {
    if (courseToArchive) {
      try {
        await apiPatch<{ success: boolean }>(`/api/courses/${courseToArchive.id}/status`, { action: 'archive' });
        toast({ title: 'Curso Archivado', description: `El curso "${courseToArchive.title}" ha sido archivado.` });
        await refreshCourses();
        setCourseToArchive(null);
        handleBackToDashboard();
      } catch (error) {
        toast({
          title: 'No pudimos archivar el curso',
          description: getFriendlyErrorMessage(error, 'Inténtalo nuevamente en unos segundos.'),
          variant: 'destructive'
        });
      }
    }
  };
  
  const handleConfirmSuspend = async () => {
    if (courseToSuspend) {
      try {
        await apiPatch<{ success: boolean }>(`/api/courses/${courseToSuspend.id}/status`, { action: 'suspend' });
        toast({ title: 'Curso Suspendido', description: `El curso "${courseToSuspend.title}" ha sido puesto en espera.` });
        await refreshCourses();
        setCourseToSuspend(null);
        setTeacherView('dashboard');
      } catch (error) {
        toast({
          title: 'No pudimos suspender el curso',
          description: getFriendlyErrorMessage(error, 'Inténtalo nuevamente en unos segundos.'),
          variant: 'destructive'
        });
      }
    }
  };

  const handleRestoreClick = async (course: Course) => {
    try {
        await apiPatch<{ success: boolean }>(`/api/courses/${course.id}/status`, { action: 'restore' });
        toast({ title: 'Curso Restaurado', description: `El curso "${course.title}" ha sido restaurado y movido a cursos activos.` });
        await refreshCourses();
        handleBackToDashboard();
    } catch (error) {
        toast({
          title: 'No pudimos restaurar el curso',
          description: getFriendlyErrorMessage(error, 'Inténtalo nuevamente en unos segundos.'),
          variant: 'destructive'
        });
    }
  };
  
  const handleReactivateClick = async (course: Course) => {
     try {
        await apiPatch<{ success: boolean }>(`/api/courses/${course.id}/status`, { action: 'reactivate' });
        toast({ title: 'Curso Reactivado', description: `El curso "${course.title}" vuelve a estar activo.` });
        await refreshCourses();
        handleBackToDashboard();
    } catch (error) {
        toast({
          title: 'No pudimos reactivar el curso',
          description: getFriendlyErrorMessage(error, 'Inténtalo nuevamente en unos segundos.'),
          variant: 'destructive'
        });
    }
  }

  const handleDuplicateClick = async (course: Course) => {
      try {
        await apiPost<{ success: boolean; newCourseId: number }>(`/api/courses/${course.id}/duplicate`, {});
        toast({ title: 'Curso Duplicado', description: `Se ha creado una copia de "${course.title}".` });
        await refreshCourses();
      } catch (error) {
        toast({
          title: 'No pudimos duplicar el curso',
          description: getFriendlyErrorMessage(error, 'Inténtalo nuevamente en unos segundos.'),
          variant: 'destructive'
        });
      }
  }
  
  const filteredCourses = useMemo(() => {
    if (activeCardAction === 'with_students') {
      return courses.filter((course) => course.students.length > 0);
    }
    if (activeCardAction === 'with_completions') {
      return courses.filter((course) => course.completedStudentIds.length > 0);
    }
    if (activeCardAction === 'high_enrollment') {
      return [...courses].sort((a, b) => b.students.length - a.students.length);
    }
    if (activeCardAction === 'at_risk' || activeCardAction === 'critical') {
      const criticalIds = new Set(
        courses
          .map((course) => {
            const enrolled = course.students.length;
            const completed = course.completedStudentIds.length;
            const ratio = enrolled > 0 ? (completed / enrolled) * 100 : 0;
            return { id: course.id, enrolled, ratio };
          })
          .filter((item) => item.enrolled >= 3 && item.ratio < 40)
          .map((item) => item.id)
      );
      return courses.filter((course) => criticalIds.has(course.id));
    }
    return courses;
  }, [courses, activeCardAction]);

  const groupedCourses = filteredCourses.reduce((acc, course) => {
    const category = course.categoryName || 'Sin Categoría';
    if (!acc[category]) {
        acc[category] = [];
    }
    acc[category].push(course);
    return acc;
  }, {} as Record<string, Course[]>);
  const defaultAccordionItems = Object.keys(groupedCourses);

  const dashboardMetrics = useMemo(() => {
    const activeCourses = courses.length;
    const totalStudents = courses.reduce((sum, course) => sum + course.students.length, 0);
    const totalCompletions = courses.reduce((sum, course) => sum + course.completedStudentIds.length, 0);
    const completionRate = totalStudents > 0 ? (totalCompletions / totalStudents) * 100 : 0;
    const avgStudentsPerCourse = activeCourses > 0 ? totalStudents / activeCourses : 0;
    const atRiskStudents = courses.reduce((sum, course) => {
      const progressList = course.studentProgress ?? [];
      const atRiskInCourse = progressList.filter((student) => {
        if (!student.dueDate) return false;
        const dueDate = parseISO(student.dueDate);
        if (!isValid(dueDate)) return false;
        const isCompleted = student.totalModulesCount > 0 && student.completedModulesCount === student.totalModulesCount;
        if (isCompleted) return false;
        return differenceInCalendarDays(dueDate, new Date()) <= 7;
      }).length;
      return sum + atRiskInCourse;
    }, 0);
    const criticalCourses = courses
      .map((course) => {
        const enrolled = course.students.length;
        const completed = course.completedStudentIds.length;
        const ratio = enrolled > 0 ? (completed / enrolled) * 100 : 0;
        return { course, enrolled, completed, ratio };
      })
      .filter((item) => item.enrolled >= 3)
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 4);
    return {
      activeCourses,
      totalStudents,
      totalCompletions,
      completionRate,
      avgStudentsPerCourse,
      atRiskStudents,
      criticalCourses,
    };
  }, [courses]);

  const completionNorm = dashboardMetrics.completionRate / 100;
  const riskNorm = dashboardMetrics.atRiskStudents > 0 ? Math.max(0, 1 - dashboardMetrics.atRiskStudents / Math.max(dashboardMetrics.totalStudents, 1)) : 1;
  const loadNorm = dashboardMetrics.avgStudentsPerCourse > 0 ? Math.max(0, 1 - Math.min(dashboardMetrics.avgStudentsPerCourse / 40, 1)) : 1;
  const throughputNorm = Math.min(dashboardMetrics.totalCompletions / 150, 1);
  const interventionNorm = dashboardMetrics.criticalCourses.length > 0 ? Math.max(0, 1 - dashboardMetrics.criticalCourses.length / 4) : 1;

  const strategicScore = useMemo(() => {
    if (teacherFocus === 'operacion') {
      return (throughputNorm * 0.35 + interventionNorm * 0.3 + loadNorm * 0.2 + completionNorm * 0.15) * 100;
    }
    if (teacherFocus === 'pedagogico') {
      return (completionNorm * 0.4 + riskNorm * 0.3 + throughputNorm * 0.2 + loadNorm * 0.1) * 100;
    }
    return (riskNorm * 0.4 + interventionNorm * 0.3 + completionNorm * 0.2 + loadNorm * 0.1) * 100;
  }, [teacherFocus, throughputNorm, interventionNorm, loadNorm, completionNorm, riskNorm]);

  const focusMeta = {
    operacion: {
      label: 'Operación',
      title: 'Enfoque operativo',
      description: 'Controla capacidad, ejecución del pipeline y carga por curso.',
      icon: TrendingUp,
      priorities: ['Pipeline', 'Carga', 'Flujo'],
    },
    pedagogico: {
      label: 'Pedagógico',
      title: 'Enfoque pedagógico',
      description: 'Prioriza resultados de aprendizaje y finalización de cohortes.',
      icon: GraduationCap,
      priorities: ['Aprendizaje', 'Finalización', 'Calidad'],
    },
    retencion: {
      label: 'Retención',
      title: 'Enfoque de retención',
      description: 'Prioriza alerta temprana y reducción de abandono.',
      icon: ShieldAlert,
      priorities: ['Riesgo', 'Intervención', 'Seguimiento'],
    },
  } as const;

  const focusCards = useMemo(() => {
    if (teacherFocus === 'operacion') {
      return [
        { title: 'Cursos Activos', value: dashboardMetrics.activeCourses, icon: BookCopy, action: 'all' as TeacherCardAction },
        { title: 'Estudiantes Inscritos', value: dashboardMetrics.totalStudents, icon: UsersIcon, action: 'with_students' as TeacherCardAction },
        { title: 'Completados', value: dashboardMetrics.totalCompletions, icon: Trophy, action: 'with_completions' as TeacherCardAction },
        { title: 'Promedio por Curso', value: dashboardMetrics.avgStudentsPerCourse.toFixed(1), icon: Activity, action: 'high_enrollment' as TeacherCardAction },
      ];
    }
    if (teacherFocus === 'pedagogico') {
      return [
        { title: 'Finalización Global', value: `${dashboardMetrics.completionRate.toFixed(1)}%`, icon: Trophy, action: 'with_completions' as TeacherCardAction },
        { title: 'Cursos con Intervención', value: dashboardMetrics.criticalCourses.length, icon: AlertTriangle, action: 'critical' as TeacherCardAction },
        { title: 'Completados', value: dashboardMetrics.totalCompletions, icon: Activity, action: 'with_completions' as TeacherCardAction },
        { title: 'Alumnos en Riesgo', value: dashboardMetrics.atRiskStudents, icon: UsersIcon, action: 'at_risk' as TeacherCardAction },
      ];
    }
    return [
      { title: 'Alumnos en Riesgo', value: dashboardMetrics.atRiskStudents, icon: AlertTriangle, action: 'at_risk' as TeacherCardAction },
      { title: 'Cursos con Intervención', value: dashboardMetrics.criticalCourses.length, icon: ShieldAlert, action: 'critical' as TeacherCardAction },
      { title: 'Finalización Global', value: `${dashboardMetrics.completionRate.toFixed(1)}%`, icon: Trophy, action: 'with_completions' as TeacherCardAction },
      { title: 'Estudiantes Inscritos', value: dashboardMetrics.totalStudents, icon: UsersIcon, action: 'with_students' as TeacherCardAction },
    ];
  }, [teacherFocus, dashboardMetrics]);

  const handleCardAction = (action: TeacherCardAction) => {
    setActiveCardAction(action);
    if (action === 'critical' || action === 'at_risk') {
      criticalCoursesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    activeCoursesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (teacherView !== 'dashboard') {
      return;
    }
    const candidates = [courses[0], suspendedCourses[0], archivedCourses[0]].filter((course): course is Course => !!course);
    const uniqueCandidates = candidates.filter((course, index, self) => self.findIndex(item => item.id === course.id) === index).slice(0, 2);
    if (uniqueCandidates.length === 0) {
      return;
    }

    let timeoutId: number | null = null;
    let idleId: number | null = null;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const prefetch = () => {
      uniqueCandidates.forEach(course => {
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
  }, [teacherView, courses, suspendedCourses, archivedCourses, prefetchCourseDetails]);


  const renderContent = () => {
    switch (teacherView) {
      case 'create':
        return <CourseCreationView key="create-new" onCourseSaved={handleBackToDashboard} />;
      case 'edit':
         return <CourseCreationView key={activeCourse?.id || 'edit'} onCourseSaved={() => setTeacherView('overview')} isEditing={true} />;
      case 'overview':
          return <CourseOverview 
                    onBack={handleBackToDashboard}
                    onEdit={() => setTeacherView('edit')}
                    onManageStudents={() => setTeacherView('students')}
                    onViewAnalytics={() => setTeacherView('analytics')}
                    onDuplicate={() => activeCourse && handleDuplicateClick(activeCourse)}
                    onSuspend={() => activeCourse && handleSuspendClick(activeCourse)}
                    onArchive={() => activeCourse && handleArchiveClick(activeCourse)}
                 />
      case 'archived-overview':
          return <ArchivedCourseOverview
                    onBack={handleBackToDashboard}
                    onRestore={() => activeCourse && handleRestoreClick(activeCourse)}
                    onDuplicate={() => activeCourse && handleDuplicateClick(activeCourse)}
                 />
      case 'suspended-overview':
          return <SuspendedCourseOverview
                    onBack={handleBackToDashboard}
                    onReactivate={() => activeCourse && handleReactivateClick(activeCourse)}
                    onDuplicate={() => activeCourse && handleDuplicateClick(activeCourse)}
                    onArchive={() => activeCourse && handleArchiveClick(activeCourse)}
                  />
      case 'students':
        return (
            <div>
                 <Button variant="ghost" onClick={() => setTeacherView('overview')} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al Resumen del Curso
                </Button>
                <StudentManagement />
            </div>
        )
      case 'analytics':
        return (
            <CourseAnalytics
                onBack={() => setTeacherView('overview')}
            />
        )
      case 'dashboard':
      default:
        return (
          <div className="space-y-6 sm:space-y-8 min-w-0">
            <Tabs value={teacherFocus} onValueChange={(value) => setTeacherFocus(value as TeacherFocus)} className="space-y-4">
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto gap-1">
                <TabsTrigger value="operacion">Operación</TabsTrigger>
                <TabsTrigger value="pedagogico">Pedagógico</TabsTrigger>
                <TabsTrigger value="retencion">Retención</TabsTrigger>
              </TabsList>
            </Tabs>
            <Card className="premium-surface">
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  {(() => {
                    const Icon = focusMeta[teacherFocus].icon;
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                  {focusMeta[teacherFocus].title}
                </CardTitle>
                <CardDescription>{focusMeta[teacherFocus].description}</CardDescription>
                <div className="flex flex-wrap gap-2">
                  {focusMeta[teacherFocus].priorities.map((priority) => (
                    <span key={priority} className="text-xs rounded-full border bg-card px-3 py-1">{priority}</span>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-2xl border bg-card p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Índice estratégico ({focusMeta[teacherFocus].label})</p>
                    <p className="text-2xl font-bold">{strategicScore.toFixed(1)}%</p>
                  </div>
                  <Gauge className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
              {focusCards.map((card) => (
                <Card
                  key={card.title}
                  className={`premium-surface cursor-pointer transition-all hover:shadow-md hover:-translate-y-1 ${activeCardAction === card.action ? 'ring-2 ring-primary' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCardAction(card.action)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleCardAction(card.action);
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                    <card.icon className="h-5 w-5 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{card.value}</p>
                    {card.title === 'Estudiantes Inscritos' && (
                      <p className="text-xs text-muted-foreground">{dashboardMetrics.avgStudentsPerCourse.toFixed(1)} por curso</p>
                    )}
                    {card.title === 'Alumnos en Riesgo' && (
                      <p className="text-xs text-muted-foreground">Vencimiento en 7 días o menos</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <div ref={criticalCoursesRef}>
            <Card className="premium-surface">
              <CardHeader>
                <CardTitle className="text-xl font-bold font-headline flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Cursos que requieren intervención
                </CardTitle>
                <CardDescription>Se priorizan cursos con menor porcentaje de finalización y al menos 3 inscritos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboardMetrics.criticalCourses.length > 0 ? dashboardMetrics.criticalCourses.map(({ course, enrolled, completed, ratio }) => (
                  <div key={course.id} className="rounded-2xl border bg-card p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium truncate" title={course.title}>{course.title}</p>
                      <p className="text-sm font-semibold">{Math.round(ratio)}%</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{completed} completados de {enrolled} inscritos</p>
                  </div>
                )) : (
                  <div className="rounded-2xl border-2 border-dashed py-8 text-center">
                    <p className="text-sm text-muted-foreground">Sin cursos críticos por ahora.</p>
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
            <div className="space-y-4" ref={activeCoursesRef}>
                <h2 className="text-2xl font-bold font-headline">Cursos Activos</h2>
                {activeCardAction !== 'all' && (
                  <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
                    <p className="text-sm text-muted-foreground">Filtro activo: {focusCards.find((card) => card.action === activeCardAction)?.title ?? 'Personalizado'}</p>
                    <Button variant="outline" size="sm" onClick={() => setActiveCardAction('all')}>Quitar filtro</Button>
                  </div>
                )}
                {filteredCourses.length > 0 ? (
                    <Accordion type="multiple" defaultValue={defaultAccordionItems} className="w-full space-y-4">
                       {Object.entries(groupedCourses).map(([category, coursesInCategory]) => (
                               <AccordionItem value={category} key={category} className="premium-surface overflow-hidden">
                               <AccordionTrigger className="bg-muted/50 px-4 sm:px-6 py-4 text-base sm:text-lg font-semibold hover:no-underline">
                                    {category} ({coursesInCategory.length})
                               </AccordionTrigger>
                              <AccordionContent className="p-4 sm:p-6">
                                   <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                                   {coursesInCategory.map(course => (
                                       <CourseCard 
                                               key={course.id} 
                                               course={course}
                                               onViewDetails={() => handleSelectCourse(course, 'overview')}
                                               onEdit={() => handleSelectCourse(course, 'edit')}
                                               onManageStudents={() => handleSelectCourse(course, 'students')}
                                               onArchive={() => handleArchiveClick(course)}
                                               onSuspend={() => handleSuspendClick(course)}
                                               isLoading={loadingCourseId === course.id}
                                               onPrefetch={() => { void prefetchCourseDetails(course); }}
                                           />
                                   ))}
                                   </div>
                               </AccordionContent>
                           </AccordionItem>
                       ))}
                    </Accordion>
                ) : (
                <div className="rounded-2xl border-2 border-dashed py-12 text-center">
                    <BookCopy className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No hay cursos para este filtro</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Prueba otro indicador o quita el filtro para ver todos los cursos.</p>
                </div>
                )}
            </div>

            {suspendedCourses.length > 0 && (
                <>
                    <Separator />
                    <Card className="premium-surface">
                        <CardHeader>
                            <CardTitle className="text-2xl font-bold font-headline flex items-center gap-2"><PauseCircle />Cursos Suspendidos</CardTitle>
                            <CardDescription>Cursos puestos en espera. Los estudiantes no pueden acceder a ellos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                            <Table className="min-w-[560px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Título del Curso</TableHead>
                                        <TableHead className="text-center">Módulos</TableHead>
                                        <TableHead className="text-center">Estudiantes</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {suspendedCourses.map(course => (
                                        <TableRow key={course.id}>
                                            <TableCell className="font-medium">{course.title}</TableCell>
                                            <TableCell className="text-center">{course.levels.length}</TableCell>
                                            <TableCell className="text-center">{course.students.length}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" onMouseEnter={() => { void prefetchCourseDetails(course); }} onClick={() => handleSelectCourse(course, 'suspended-overview')} disabled={loadingCourseId === course.id}>
                                                    {loadingCourseId === course.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                                                    {loadingCourseId === course.id ? 'Cargando...' : 'Ver Detalles'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}


            <Separator />
            
            <Card className="premium-surface">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold font-headline flex items-center gap-2"><Archive />Cursos Archivados</CardTitle>
                    <CardDescription>Cursos que ya no están activos pero cuyo historial se conserva.</CardDescription>
                </CardHeader>
                <CardContent>
                 {archivedCourses.length > 0 ? (
                    <div className="overflow-x-auto">
                    <Table className="min-w-[560px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Título del Curso</TableHead>
                                <TableHead className="text-center">Módulos</TableHead>
                                <TableHead className="text-center">Estudiantes</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {archivedCourses.map(course => (
                                <TableRow key={course.id}>
                                    <TableCell className="font-medium">{course.title}</TableCell>
                                    <TableCell className="text-center">{course.levels.length}</TableCell>
                                    <TableCell className="text-center">{course.students.length}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onMouseEnter={() => { void prefetchCourseDetails(course); }} onClick={() => handleSelectCourse(course, 'archived-overview')} disabled={loadingCourseId === course.id}>
                                            {loadingCourseId === course.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                                            {loadingCourseId === course.id ? 'Cargando...' : 'Ver Detalles'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </div>
                ) : (
                <div className="rounded-2xl border-2 border-dashed py-12 text-center">
                    <h3 className="mt-4 text-lg font-medium">No tienes cursos archivados</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Aquí aparecerán los cursos que archives.</p>
                </div>
                )}
                </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <>
      <div className="w-full h-full min-w-0 flex flex-col">
        {renderContent()}
      </div>
      {courseToArchive && (
        <ArchiveCourseDialog 
          courseName={courseToArchive.title}
          onCancel={() => setCourseToArchive(null)}
          onConfirm={handleConfirmArchive}
        />
      )}
       <AlertDialog open={!!courseToSuspend} onOpenChange={(isOpen) => !isOpen && setCourseToSuspend(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro de que quieres suspender este curso?</AlertDialogTitle>
                    <AlertDialogDescription>
                        El curso <span className="font-bold">"{courseToSuspend?.title}"</span> será puesto en espera. Los estudiantes inscritos no podrán acceder a él hasta que lo reactives.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setCourseToSuspend(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirmSuspend}
                        className={buttonVariants({ variant: "destructive" })}>
                        Sí, Suspender Curso
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
