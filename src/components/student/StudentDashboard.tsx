

'use client';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { EvaluationView } from './EvaluationView';
import { ResultsModal } from './ResultsModal';
import type { CourseLevel, Course, Badge, IncorrectAnswer } from '@/types/index';
import { useCourse } from '@/context/CourseContext';
import { CourseCard } from '@/components/shared/CourseCard';
import { CourseContentView } from './CourseContentView';
import { ArrowLeft, Award, BookOpen, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { ContinueLearningCard } from './ContinueLearningCard';
import { useAuth } from '@/context/AuthContext';
import { fetchUserBadges } from '@/app/actions';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { BadgeIcon } from './BadgeIcon';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Result = { score: number; passed: boolean; incorrectAnswers: IncorrectAnswer[], finalScore?: number } | null;

export default function StudentDashboard() {
  const { studentView, setStudentView, courses, updateLevel, activeCourse, setActiveCourseId, refreshCourses } = useCourse();
  const [currentLevel, setCurrentLevel] = useState<CourseLevel | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    async function loadBadges() {
        if (user) {
            try {
                const userBadges = await fetchUserBadges(user.id);
                setBadges(userBadges);
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

  const handleSelectCourse = (course: Course) => {
    setActiveCourseId(course.id);
    setStudentView('content');
  };
  
  const handleBackToDashboard = () => {
    refreshCourses();
    setActiveCourseId(null);
    setStudentView('dashboard');
  }

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

    // After closing modal, always refresh from server to get latest course state
    await refreshCourses();
    
    // Check the latest course state from the context after refresh
    const updatedCourse = courses.find(c => c.id === activeCourse?.id);

    // If the course is now marked as completed in the context, go to dashboard. Otherwise, go back to content.
    if (updatedCourse?.status === 'completed' || isCourseCompletedAfterThisModule) {
      handleBackToDashboard();
    } else {
      setStudentView('content');
    }

  }, [setStudentView, refreshCourses, courses, activeCourse, isCourseCompletedAfterThisModule, handleBackToDashboard]);

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
                 <div className="space-y-8 animate-fade-in">
                    <div className="flex flex-col lg:flex-row gap-8 justify-between">
                        <div className="flex-1">
                            <h1 className="text-4xl font-bold font-headline">Hola de nuevo, {user?.name?.split(' ')[0]}!</h1>
                            <p className="text-muted-foreground text-lg">Listos para continuar tu viaje de aprendizaje?</p>
                        </div>
                        <Card className="w-full lg:w-auto lg:min-w-[300px]">
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
                            onContinue={() => {
                                handleSelectCourse(nextModuleCourse.course);
                            }}
                        />
                    )}

                    {courses.length > 0 && <Separator className="my-8"/>}
                    
                    <div className="space-y-4">
                       <Tabs defaultValue="in-progress" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="in-progress">
                                    <BookOpen className="mr-2" /> En Progreso ({inProgressCourses.length})
                                </TabsTrigger>
                                <TabsTrigger value="completed">
                                    <CheckCircle className="mr-2" /> Completados ({completedCourses.length})
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
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
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
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
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

  return (
    <div className="w-full h-full flex flex-col">
      {renderContent()}
      {result && <ResultsModal result={result} onNext={closeResultsModal} isCourseCompleted={isCourseCompletedAfterThisModule || false} />}
    </div>
  );
}
