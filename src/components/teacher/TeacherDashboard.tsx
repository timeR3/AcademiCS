
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { CourseOverview } from './CourseOverview';
import { CourseCreationView } from './CourseCreationView';
import { StudentManagement } from './StudentManagement';
import { useCourse } from '@/context/CourseContext';
import { Button } from '@/components/ui/button';
import { BookCopy, Archive, ArrowLeft, Eye, ArchiveRestore, Copy, PauseCircle, Play, Loader2 } from 'lucide-react';
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
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';

export default function TeacherDashboard() {
  const { courses, archivedCourses, suspendedCourses, activeCourse, setActiveCourseId, teacherView, setTeacherView, refreshCourses, updateCourse } = useCourse();
  const { toast } = useToast();
  const [courseToArchive, setCourseToArchive] = useState<Course | null>(null);
  const [courseToSuspend, setCourseToSuspend] = useState<Course | null>(null);
  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null);
  const prefetchedCourseIdsRef = useRef<Set<string>>(new Set());

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
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    }
  };

  const handleRestoreClick = async (course: Course) => {
    try {
        await apiPatch<{ success: boolean }>(`/api/courses/${course.id}/status`, { action: 'restore' });
        toast({ title: 'Curso Restaurado', description: `El curso "${course.title}" ha sido restaurado y movido a cursos activos.` });
        await refreshCourses();
        handleBackToDashboard();
    } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleReactivateClick = async (course: Course) => {
     try {
        await apiPatch<{ success: boolean }>(`/api/courses/${course.id}/status`, { action: 'reactivate' });
        toast({ title: 'Curso Reactivado', description: `El curso "${course.title}" vuelve a estar activo.` });
        await refreshCourses();
        handleBackToDashboard();
    } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  }

  const handleDuplicateClick = async (course: Course) => {
      try {
        await apiPost<{ success: boolean; newCourseId: number }>(`/api/courses/${course.id}/duplicate`, {});
        toast({ title: 'Curso Duplicado', description: `Se ha creado una copia de "${course.title}".` });
        await refreshCourses();
      } catch (error: any) {
        toast({ title: 'Error al duplicar', description: error.message, variant: 'destructive' });
      }
  }
  
  const groupedCourses = courses.reduce((acc, course) => {
    const category = course.categoryName || 'Sin Categoría';
    if (!acc[category]) {
        acc[category] = [];
    }
    acc[category].push(course);
    return acc;
  }, {} as Record<string, Course[]>);
  const defaultAccordionItems = Object.keys(groupedCourses);

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
            <div className="space-y-4">
                <h2 className="text-2xl font-bold font-headline">Cursos Activos</h2>
                {courses.length > 0 ? (
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
                    <h3 className="mt-4 text-lg font-medium">Aún no has creado ningún curso activo</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Empieza por crear tu primer curso para tus estudiantes.</p>
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
