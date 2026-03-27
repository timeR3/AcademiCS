

'use client';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { EvaluationView } from './EvaluationView';
import { ResultsModal } from './ResultsModal';
import type { CourseLevel, Course, Badge, IncorrectAnswer } from '@/types/index';
import { useCourse } from '@/context/CourseContext';
import { CourseCard } from '@/components/shared/CourseCard';
import { CourseContentView } from './CourseContentView';
import { ArrowLeft, Award, BookOpen, CheckCircle, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { ContinueLearningCard } from './ContinueLearningCard';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { BadgeIcon } from './BadgeIcon';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiGet } from '@/lib/api-client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

type Result = { score: number; passed: boolean; incorrectAnswers: IncorrectAnswer[], finalScore?: number } | null;

export default function StudentDashboard() {
  const { studentView, setStudentView, courses, updateLevel, activeCourse, setActiveCourseId, refreshCourses, updateCourse } = useCourse();
  const [currentLevel, setCurrentLevel] = useState<CourseLevel | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [newlyEarnedBadges, setNewlyEarnedBadges] = useState<Badge[]>([]);
  const [isBadgeCelebrationOpen, setIsBadgeCelebrationOpen] = useState(false);
  const [celebrationBadgeIndex, setCelebrationBadgeIndex] = useState(0);
  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null);
  const prefetchedCourseIdsRef = useRef<Set<string>>(new Set());
  const previousBadgeIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedBadgesRef = useRef(false);
  const { user } = useAuth();

  useEffect(() => {
    async function loadBadges() {
        if (user) {
            try {
                const userId = encodeURIComponent(user.id);
                const userBadges = await apiGet<Badge[]>(`/api/users/${userId}/badges`);
                setBadges(userBadges);
                const currentBadgeIds = new Set(userBadges.map((badge) => badge.id));
                if (hasLoadedBadgesRef.current) {
                  const previousBadgeIds = previousBadgeIdsRef.current;
                  const earnedNow = userBadges.filter((badge) => !previousBadgeIds.has(badge.id));
                  if (earnedNow.length > 0) {
                    setNewlyEarnedBadges(earnedNow);
                    setCelebrationBadgeIndex(0);
                    setIsBadgeCelebrationOpen(true);
                  }
                } else {
                  hasLoadedBadgesRef.current = true;
                }
                previousBadgeIdsRef.current = currentBadgeIds;
            } catch (error) {
                console.error("Failed to load user badges", error);
                setBadges([]);
            }
        }
    }
    if (studentView === 'dashboard') {
        loadBadges();
    }
  }, [user, studentView, courses]); // Refresh badges when courses change (after an evaluation)

  useEffect(() => {
    if (!isBadgeCelebrationOpen || newlyEarnedBadges.length <= 1) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setCelebrationBadgeIndex((previousIndex) => {
        if (previousIndex + 1 >= newlyEarnedBadges.length) {
          return previousIndex;
        }
        return previousIndex + 1;
      });
    }, 1500);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [celebrationBadgeIndex, isBadgeCelebrationOpen, newlyEarnedBadges]);

  useEffect(() => {
    if (!isBadgeCelebrationOpen || newlyEarnedBadges.length === 0) {
      return;
    }
    if (celebrationBadgeIndex < newlyEarnedBadges.length - 1) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setIsBadgeCelebrationOpen(false);
      setNewlyEarnedBadges([]);
      setCelebrationBadgeIndex(0);
    }, 1800);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [celebrationBadgeIndex, isBadgeCelebrationOpen, newlyEarnedBadges]);

  const loadDetailedCourse = useCallback(async (courseId: string): Promise<Course | null> => {
    if (!user?.id) {
      return null;
    }
    const studentId = encodeURIComponent(user.id);
    const encodedCourseId = encodeURIComponent(courseId);
    const detailedCourses = await apiGet<Course[]>(`/api/courses?role=student&userId=${studentId}&courseId=${encodedCourseId}&includeDetails=true`);
    const detailedCourse = detailedCourses[0];
    if (!detailedCourse) {
      return null;
    }
    updateCourse(detailedCourse);
    return detailedCourse;
  }, [user, updateCourse]);

  const handleSelectCourse = useCallback(async (course: Course) => {
    prefetchedCourseIdsRef.current.add(course.id);
    setLoadingCourseId(course.id);
    setActiveCourseId(course.id);
    setStudentView('content');
    try {
      const detailedCourse = await loadDetailedCourse(course.id);
      if (detailedCourse?.id && detailedCourse.id !== course.id) {
        setActiveCourseId(detailedCourse.id);
      }
    } finally {
      setLoadingCourseId(null);
    }
  }, [loadDetailedCourse, setActiveCourseId, setStudentView]);

  const prefetchDetailedCourse = useCallback(async (course: Course) => {
    if (prefetchedCourseIdsRef.current.has(course.id)) {
      return;
    }
    prefetchedCourseIdsRef.current.add(course.id);
    try {
      await loadDetailedCourse(course.id);
    } catch {
      prefetchedCourseIdsRef.current.delete(course.id);
    }
  }, [loadDetailedCourse]);
  
  const handleBackToDashboard = useCallback(() => {
    refreshCourses();
    setActiveCourseId(null);
    setStudentView('dashboard');
  }, [refreshCourses, setActiveCourseId, setStudentView]);

  const startEvaluation = useCallback((level: CourseLevel) => {
    setCurrentLevel(level);
    setStudentView('evaluation');
  }, [setStudentView]);
  
  const handleShowResult = (evaluationResult: { score: number; passed: boolean; incorrectAnswers: IncorrectAnswer[], finalScore?: number }) => {
      setResult({
        score: evaluationResult.score,
        passed: evaluationResult.passed,
        incorrectAnswers: evaluationResult.incorrectAnswers,
        finalScore: evaluationResult.finalScore,
      });

      if (currentLevel && activeCourse) {
         if (evaluationResult?.passed) {
            // Optimistically update UI
            updateLevel(activeCourse.id, currentLevel.id, { status: 'completed' });
            
            const completedLevelIndex = activeCourse.levels.findIndex(l => l.id === currentLevel.id);
            if (completedLevelIndex !== -1 && completedLevelIndex + 1 < activeCourse.levels.length) {
                const nextLevel = activeCourse.levels[completedLevelIndex + 1];
                if (nextLevel.status === 'locked') {
                    updateLevel(activeCourse.id, nextLevel.id, { status: 'in-progress' });
                }
            }
        }
      }
  }

  const isLastModuleOfCourse = useMemo(() => {
    if (!activeCourse || !currentLevel) return false;
    const lastLevelId = activeCourse.levels[activeCourse.levels.length - 1]?.id;
    return currentLevel.id === lastLevelId;
  }, [activeCourse, currentLevel]);
  
  const isCourseCompletedAfterThisModule = result?.passed && isLastModuleOfCourse;

  const closeResultsModal = useCallback(async () => {
    setResult(null);
    await refreshCourses();

    if (isCourseCompletedAfterThisModule) {
      handleBackToDashboard();
      return;
    }

    if (activeCourse?.id) {
      const detailedCourse = await loadDetailedCourse(activeCourse.id);
      if (detailedCourse?.status === 'completed') {
        handleBackToDashboard();
        return;
      }
    }

    setStudentView('content');
  }, [setStudentView, refreshCourses, activeCourse, isCourseCompletedAfterThisModule, handleBackToDashboard, loadDetailedCourse]);

  const { inProgressCourses, completedCourses } = useMemo(() => {
    const viewableCourses = courses.filter(course => course.globalStatus !== 'suspended');

    const inProgress = viewableCourses.filter(c => c.status === 'in-progress');
    const completed = viewableCourses.filter(c => c.status === 'completed');

    return { inProgressCourses: inProgress, completedCourses: completed };
  }, [courses]);
  
  const nextModuleCourse = useMemo(() => {
    for (const course of inProgressCourses) {
      const nextLevel = course.levels.find(l => l.status === 'in-progress');
      if (nextLevel) {
        return { course, level: nextLevel };
      }
    }
    return null;
  }, [inProgressCourses]);

  useEffect(() => {
    if (studentView !== 'dashboard') {
      return;
    }
    const candidates = [
      nextModuleCourse?.course,
      inProgressCourses[0],
      completedCourses[0],
    ].filter((course): course is Course => !!course);
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
        void prefetchDetailedCourse(course);
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
  }, [studentView, nextModuleCourse, inProgressCourses, completedCourses, prefetchDetailedCourse]);
  
  const renderContent = () => {
    switch(studentView) {
        case 'content':
             if (activeCourse) {
                const courseState = courses.find(c => c.id === activeCourse.id);
                if (courseState) {
                    return <div className="h-full flex flex-col">
                                <Button variant="ghost" onClick={handleBackToDashboard} className="mb-4 self-start">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Volver a Mis Cursos
                                </Button>
                                <CourseContentView 
                                    course={courseState} 
                                    onStartEvaluation={startEvaluation}
                                    onBackToDashboard={handleBackToDashboard}
                                />
                           </div>;
                }
             }
             return null;
        case 'evaluation':
            if (currentLevel && activeCourse) {
                return <EvaluationView 
                            level={currentLevel}
                            courseId={activeCourse.id}
                            onFinish={handleShowResult}
                            onBack={() => setStudentView('content')}
                        />;
            }
            return null;
        case 'dashboard':
        default:
            return (
                 <div className="space-y-6 sm:space-y-8 animate-fade-in min-w-0">
                    <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 justify-between">
                        <div className="flex-1">
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-headline">Hola de nuevo, {user?.name?.split(' ')[0]}!</h1>
                            <p className="text-muted-foreground text-base sm:text-lg">Listos para continuar tu viaje de aprendizaje?</p>
                        </div>
                        <Card className="premium-surface w-full lg:w-auto lg:min-w-[300px]">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Award />Mis Insignias</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {badges.length > 0 ? (
                                    <TooltipProvider>
                                        <div className="flex flex-wrap gap-3">
                                            {badges.map(badge => (
                                                <Tooltip key={badge.id}>
                                                    <TooltipTrigger>
                                                        <div className="p-2 bg-secondary rounded-full hover:bg-primary/10 transition-colors">
                                                            <BadgeIcon iconId={badge.iconId} className="h-8 w-8 text-primary" />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="font-bold">{badge.name}</p>
                                                        <p>{badge.description}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            ))}
                                        </div>
                                    </TooltipProvider>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Aún no has ganado ninguna insignia. ¡Sigue aprendiendo!</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {nextModuleCourse && (
                        <ContinueLearningCard 
                            course={nextModuleCourse.course} 
                            level={nextModuleCourse.level}
                            isLoading={loadingCourseId === nextModuleCourse.course.id}
                            onPrefetch={() => { void prefetchDetailedCourse(nextModuleCourse.course); }}
                            onContinue={() => {
                                handleSelectCourse(nextModuleCourse.course);
                            }}
                        />
                    )}

                    {courses.length > 0 && <Separator className="my-8"/>}
                    
                    <div className="space-y-4">
                       <Tabs defaultValue="in-progress" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 h-auto">
                                <TabsTrigger value="in-progress" className="text-xs sm:text-sm px-2 py-2">
                                    <BookOpen className="mr-0 sm:mr-2 h-4 w-4 shrink-0" />
                                    <span className="hidden sm:inline">En Progreso ({inProgressCourses.length})</span>
                                    <span className="sm:hidden">{inProgressCourses.length}</span>
                                </TabsTrigger>
                                <TabsTrigger value="completed" className="text-xs sm:text-sm px-2 py-2">
                                    <CheckCircle className="mr-0 sm:mr-2 h-4 w-4 shrink-0" />
                                    <span className="hidden sm:inline">Completados ({completedCourses.length})</span>
                                    <span className="sm:hidden">{completedCourses.length}</span>
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="in-progress" className="mt-6">
                                {inProgressCourses.length > 0 ? (
                                    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                                        {inProgressCourses.map(course => (
                                            <CourseCard 
                                                key={course.id} 
                                                course={course}
                                                onViewDetails={() => handleSelectCourse(course)}
                                                isStudentView={true}
                                                isLoading={loadingCourseId === course.id}
                                                onPrefetch={() => { void prefetchDetailedCourse(course); }}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border-2 border-dashed py-12 text-center">
                                        <h3 className="mt-4 text-lg font-medium">¡Todo al día!</h3>
                                        <p className="mt-1 text-sm text-muted-foreground">No tienes cursos pendientes. ¡Felicidades!</p>
                                    </div>
                                )}
                            </TabsContent>
                            <TabsContent value="completed" className="mt-6">
                                 {completedCourses.length > 0 ? (
                                    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                                        {completedCourses.map(course => (
                                            <CourseCard 
                                                key={course.id} 
                                                course={course}
                                                onViewDetails={() => handleSelectCourse(course)}
                                                isStudentView={true}
                                                isLoading={loadingCourseId === course.id}
                                                onPrefetch={() => { void prefetchDetailedCourse(course); }}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border-2 border-dashed py-12 text-center">
                                        <h3 className="mt-4 text-lg font-medium">Aún no has completado ningún curso</h3>
                                        <p className="mt-1 text-sm text-muted-foreground">¡Sigue estudiando para ver tus cursos terminados aquí!</p>
                                    </div>
                                )}
                            </TabsContent>
                       </Tabs>
                    </div>
                </div>
            )
    }
  }

  const activeCelebrationBadge = newlyEarnedBadges[celebrationBadgeIndex] || null;

  return (
    <div className="w-full h-full min-w-0 flex flex-col">
      <Dialog open={isBadgeCelebrationOpen && !!activeCelebrationBadge} onOpenChange={setIsBadgeCelebrationOpen}>
        <DialogContent className="sm:max-w-md">
          {activeCelebrationBadge ? (
            <div className="space-y-6 text-center">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-center gap-2 text-xl">
                  <Sparkles className="h-5 w-5 text-primary" />
                  ¡Nueva insignia!
                </DialogTitle>
                <DialogDescription>Has desbloqueado un nuevo logro en tu ruta de aprendizaje.</DialogDescription>
              </DialogHeader>
              <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-primary/10 transition-transform duration-700 scale-125 animate-pulse">
                <BadgeIcon key={activeCelebrationBadge.id} iconId={activeCelebrationBadge.iconId} className="h-16 w-16 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold">{activeCelebrationBadge.name}</p>
                <p className="text-sm text-muted-foreground">{activeCelebrationBadge.description}</p>
              </div>
              {newlyEarnedBadges.length > 1 ? (
                <p className="text-xs text-muted-foreground">
                  Insignia {celebrationBadgeIndex + 1} de {newlyEarnedBadges.length}
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {renderContent()}
      {result && <ResultsModal result={result} onNext={closeResultsModal} isCourseCompleted={isCourseCompletedAfterThisModule || false} />}
    </div>
  );
}
