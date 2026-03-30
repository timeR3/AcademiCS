'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, UserCheck, BookOpen, Activity, AlertTriangle, Sparkles, Wallet, GraduationCap, Building2, ShoppingCart, Gauge } from 'lucide-react';
import { useCourse } from '@/context/CourseContext';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type BusinessFocus = 'academia' | 'corporativo' | 'ventas';
type AdminCardAction = 'none' | 'completion' | 'critical' | 'active_users' | 'students' | 'teachers' | 'enrollments' | 'suspended' | 'catalog' | 'cost';

export function AnalyticsView() {
    const { allUsers, courses, archivedCourses, suspendedCourses, setAdminView } = useCourse();
    const [loading, setLoading] = useState(true);
    const [businessFocus, setBusinessFocus] = useState<BusinessFocus>('academia');
    const [activeCardAction, setActiveCardAction] = useState<AdminCardAction>('none');
    const riskSectionRef = useRef<HTMLDivElement | null>(null);
    const economySectionRef = useRef<HTMLDivElement | null>(null);
    const categoriesSectionRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
       setLoading(allUsers.length === 0 && courses.length === 0 && archivedCourses.length === 0 && suspendedCourses.length === 0);
    }, [allUsers, courses, archivedCourses, suspendedCourses]);

    const totalStudents = allUsers.filter(u => u.roles.includes('student')).length;
    const totalTeachers = allUsers.filter(u => u.roles.includes('teacher')).length;
    const totalCourses = courses.length + archivedCourses.length + suspendedCourses.length;
    const activeUsers = allUsers.filter(user => user.status === 'active').length;
    const activeRatio = allUsers.length > 0 ? (activeUsers / allUsers.length) * 100 : 0;

    const allPlatformCourses = useMemo(
      () => [...courses, ...archivedCourses, ...suspendedCourses],
      [courses, archivedCourses, suspendedCourses]
    );
    const totalEnrollments = allPlatformCourses.reduce((sum, course) => sum + course.students.length, 0);
    const totalCompletions = allPlatformCourses.reduce((sum, course) => sum + course.completedStudentIds.length, 0);
    const completionRate = totalEnrollments > 0 ? (totalCompletions / totalEnrollments) * 100 : 0;
    const totalAiCost = allPlatformCourses.reduce((sum, course) => sum + (course.aiMetrics?.estimatedCostUsd ?? 0), 0);
    const avgAiCostPerCourse = totalCourses > 0 ? totalAiCost / totalCourses : 0;
    const topCategories = Array.from(
      allPlatformCourses.reduce((acc, course) => {
        const key = course.categoryName || 'Sin categoría';
        acc.set(key, (acc.get(key) ?? 0) + 1);
        return acc;
      }, new Map<string, number>())
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const riskCourseCandidates = allPlatformCourses
      .map((course) => {
        const enrolled = course.students.length;
        const completed = course.completedStudentIds.length;
        const ratio = enrolled > 0 ? (completed / enrolled) * 100 : 0;
        return { course, enrolled, completed, ratio };
      })
      .filter((item) => item.enrolled >= 3)
      .sort((a, b) => a.ratio - b.ratio);
    const riskCourses = riskCourseCandidates.filter((item) => item.ratio < 40).slice(0, 4);
    const prioritizedCourses = useMemo(() => {
      if (activeCardAction === 'suspended') {
        const suspendedIds = new Set(suspendedCourses.map((course) => course.id));
        return riskCourseCandidates.filter((item) => suspendedIds.has(item.course.id)).slice(0, 6);
      }
      if (activeCardAction === 'completion') {
        return riskCourseCandidates.filter((item) => item.ratio < 70).slice(0, 6);
      }
      if (activeCardAction === 'catalog' || activeCardAction === 'enrollments') {
        return riskCourseCandidates.slice(0, 6);
      }
      return riskCourses;
    }, [activeCardAction, riskCourseCandidates, riskCourses, suspendedCourses]);

    const completionNorm = completionRate / 100;
    const engagementNorm = activeRatio / 100;
    const capacityNorm = Math.min(totalTeachers / 20, 1);
    const catalogNorm = Math.min(totalCourses / 25, 1);
    const demandNorm = Math.min(totalEnrollments / 300, 1);
    const costEfficiencyNorm = totalAiCost > 0 ? Math.min((totalCompletions / totalAiCost) / 500, 1) : totalCompletions > 0 ? 1 : 0.7;
    const riskPressureNorm = riskCourses.length > 0
      ? Math.min(riskCourses.reduce((sum, item) => sum + (40 - item.ratio), 0) / (riskCourses.length * 40), 1)
      : 0;
    const riskControlNorm = 1 - riskPressureNorm;

    const strategicScore = useMemo(() => {
      if (businessFocus === 'academia') {
        return (completionNorm * 0.4 + riskControlNorm * 0.25 + engagementNorm * 0.2 + capacityNorm * 0.15) * 100;
      }
      if (businessFocus === 'corporativo') {
        return (engagementNorm * 0.35 + completionNorm * 0.25 + capacityNorm * 0.2 + riskControlNorm * 0.2) * 100;
      }
      return (demandNorm * 0.35 + catalogNorm * 0.25 + completionNorm * 0.2 + costEfficiencyNorm * 0.2) * 100;
    }, [businessFocus, completionNorm, riskControlNorm, engagementNorm, capacityNorm, demandNorm, catalogNorm, costEfficiencyNorm]);

    const focusMeta = {
      academia: {
        label: 'Academia',
        title: 'Enfoque académico',
        description: 'Prioriza finalización, riesgo de abandono y continuidad pedagógica.',
        icon: GraduationCap,
        priorities: ['Finalización', 'Riesgo académico', 'Participación'],
      },
      corporativo: {
        label: 'Corporativo',
        title: 'Enfoque corporativo',
        description: 'Prioriza adopción activa, capacidad docente y continuidad operativa.',
        icon: Building2,
        priorities: ['Adopción', 'Capacidad docente', 'Estabilidad'],
      },
      ventas: {
        label: 'Ventas',
        title: 'Enfoque comercial',
        description: 'Prioriza demanda, profundidad de catálogo y eficiencia de costos.',
        icon: ShoppingCart,
        priorities: ['Demanda', 'Catálogo', 'Eficiencia IA'],
      },
    } as const;

    const focusCards = useMemo(() => {
      if (businessFocus === 'academia') {
        return [
          { title: "Finalización Global", value: `${completionRate.toFixed(1)}%`, icon: Sparkles, color: "text-primary", action: 'completion' as AdminCardAction },
          { title: "Cursos Críticos", value: riskCourses.length, icon: AlertTriangle, color: "text-secondary", action: 'critical' as AdminCardAction },
          { title: "Usuarios Activos", value: `${activeRatio.toFixed(0)}%`, icon: Activity, color: "text-accent-foreground", action: 'active_users' as AdminCardAction },
          { title: "Total Estudiantes", value: totalStudents, icon: Users, color: "text-muted-foreground", action: 'students' as AdminCardAction },
        ];
      }
      if (businessFocus === 'corporativo') {
        return [
          { title: "Usuarios Activos", value: `${activeRatio.toFixed(0)}%`, icon: Activity, color: "text-primary", action: 'active_users' as AdminCardAction },
          { title: "Docentes Disponibles", value: totalTeachers, icon: UserCheck, color: "text-secondary", action: 'teachers' as AdminCardAction },
          { title: "Inscripciones Totales", value: totalEnrollments, icon: Users, color: "text-accent-foreground", action: 'enrollments' as AdminCardAction },
          { title: "Cursos Suspendidos", value: suspendedCourses.length, icon: AlertTriangle, color: "text-muted-foreground", action: 'suspended' as AdminCardAction },
        ];
      }
      return [
        { title: "Inscripciones Totales", value: totalEnrollments, icon: Users, color: "text-primary", action: 'enrollments' as AdminCardAction },
        { title: "Cursos en Catálogo", value: totalCourses, icon: BookOpen, color: "text-secondary", action: 'catalog' as AdminCardAction },
        { title: "Costo IA / Curso", value: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(avgAiCostPerCourse), icon: Wallet, color: "text-accent-foreground", action: 'cost' as AdminCardAction },
        { title: "Finalización", value: `${completionRate.toFixed(1)}%`, icon: Sparkles, color: "text-muted-foreground", action: 'completion' as AdminCardAction },
      ];
    }, [businessFocus, completionRate, riskCourses.length, activeRatio, totalStudents, totalTeachers, totalEnrollments, suspendedCourses.length, totalCourses, avgAiCostPerCourse]);

    const handleCardAction = (action: AdminCardAction) => {
      setActiveCardAction(action);
      if (action === 'active_users' || action === 'students' || action === 'teachers') {
        setAdminView('users');
        return;
      }
      if (action === 'cost') {
        categoriesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'catalog') {
        economySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (action === 'completion' || action === 'critical' || action === 'enrollments' || action === 'suspended') {
        riskSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    const getCardActionHint = (action: AdminCardAction) => {
      if (action === 'active_users' || action === 'students' || action === 'teachers') return 'Abrir gestión de usuarios';
      if (action === 'cost') return 'Ir a Economía de IA';
      if (action === 'catalog') return 'Ir a Top categorías por volumen';
      if (action === 'suspended') return 'Filtrar cursos suspendidos en priorizados';
      if (action === 'completion') return 'Priorizar cursos con menor finalización';
      if (action === 'critical') return 'Ver cursos críticos';
      if (action === 'enrollments') return 'Ver cursos con mayor tracción';
      return 'Aplicar acción';
    };
    
    if (loading) {
        return <p>Cargando estadísticas...</p>;
    }

    return (
        <div className="space-y-6 min-w-0">
            <h2 className="text-2xl font-bold font-headline">Estadísticas Generales</h2>
            <Tabs value={businessFocus} onValueChange={(value) => setBusinessFocus(value as BusinessFocus)} className="space-y-4">
                <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto gap-1">
                    <TabsTrigger value="academia">Academia</TabsTrigger>
                    <TabsTrigger value="corporativo">Corporativo</TabsTrigger>
                    <TabsTrigger value="ventas">Ventas</TabsTrigger>
                </TabsList>
            </Tabs>
            <Card className="premium-surface">
                <CardHeader className="space-y-2">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        {(() => {
                          const Icon = focusMeta[businessFocus].icon;
                          return <Icon className="h-5 w-5 text-primary" />;
                        })()}
                        {focusMeta[businessFocus].title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{focusMeta[businessFocus].description}</p>
                    <div className="flex flex-wrap gap-2">
                        {focusMeta[businessFocus].priorities.map((priority) => (
                            <Badge key={priority} variant="outline">{priority}</Badge>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="rounded-2xl border bg-card p-4 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground">Índice estratégico ({focusMeta[businessFocus].label})</p>
                            <p className="text-2xl font-bold">{strategicScore.toFixed(1)}%</p>
                        </div>
                        <Gauge className="h-8 w-8 text-primary" />
                    </div>
                </CardContent>
            </Card>
            <TooltipProvider>
              <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 min-w-0">
                  {focusCards.map((card, index) => (
                      <Tooltip key={index}>
                        <TooltipTrigger asChild>
                          <Card
                            onClick={() => handleCardAction(card.action)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                handleCardAction(card.action);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            className={`premium-surface transition-all hover:shadow-md hover:-translate-y-1 cursor-pointer ${activeCardAction === card.action ? 'ring-2 ring-primary' : ''}`}
                          >
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                                  <card.icon className={`h-6 w-6 ${card.color}`} />
                              </CardHeader>
                              <CardContent>
                                  <div className="text-2xl font-bold">{card.value}</div>
                              </CardContent>
                          </Card>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{getCardActionHint(card.action)}</p>
                        </TooltipContent>
                      </Tooltip>
                  ))}
              </div>
            </TooltipProvider>
            {activeCardAction !== 'none' && (
              <div className="rounded-2xl border bg-card px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Interacción activa: {focusCards.find((card) => card.action === activeCardAction)?.title ?? 'Tarjeta seleccionada'}</p>
                <button className="text-sm underline underline-offset-4" onClick={() => setActiveCardAction('none')}>Limpiar</button>
              </div>
            )}
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3 min-w-0">
                <Card className="premium-surface lg:col-span-2" ref={riskSectionRef}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <AlertTriangle className="h-5 w-5 text-primary" />
                            Cursos Priorizados
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {prioritizedCourses.length > 0 ? prioritizedCourses.map(({ course, enrolled, completed, ratio }) => (
                            <div key={course.id} className="rounded-2xl border bg-card p-3 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-medium truncate" title={course.title}>{course.title}</p>
                                    <Badge variant="outline">{Math.round(ratio)}%</Badge>
                                </div>
                                <Progress value={ratio} className="h-2" />
                                <p className="text-xs text-muted-foreground">{enrolled} inscritos · {completed} completaron</p>
                            </div>
                        )) : (
                            <div className="rounded-2xl border-2 border-dashed py-10 text-center">
                                <p className="text-sm text-muted-foreground">No hay resultados para la tarjeta seleccionada.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card className="premium-surface">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Sparkles className="h-5 w-5 text-primary" />
                            Salud de la Plataforma
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-2xl border bg-card p-3">
                            <p className="text-xs text-muted-foreground">Tasa de finalización global</p>
                            <p className="text-2xl font-bold">{completionRate.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground">{totalCompletions} completados de {totalEnrollments} inscripciones</p>
                        </div>
                        <div className="rounded-2xl border bg-card p-3">
                            <p className="text-xs text-muted-foreground">Cursos suspendidos</p>
                            <p className="text-2xl font-bold">{suspendedCourses.length}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 min-w-0">
                <Card className="premium-surface" ref={economySectionRef}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Wallet className="h-5 w-5 text-primary" />
                            Economía de IA
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-2xl border bg-card p-3">
                            <p className="text-xs text-muted-foreground">Costo estimado total</p>
                            <p className="text-2xl font-bold">
                                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(totalAiCost)}
                            </p>
                        </div>
                        <div className="rounded-2xl border bg-card p-3">
                            <p className="text-xs text-muted-foreground">Costo promedio por curso</p>
                            <p className="text-2xl font-bold">
                                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(avgAiCostPerCourse)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="premium-surface" ref={categoriesSectionRef}>
                    <CardHeader>
                        <CardTitle className="text-base sm:text-lg">Top categorías por volumen</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {topCategories.length > 0 ? topCategories.map(([category, count]) => {
                            const percentage = totalCourses > 0 ? (count / totalCourses) * 100 : 0;
                            return (
                                <div key={category} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="truncate" title={category}>{category}</span>
                                        <span className="font-medium">{count}</span>
                                    </div>
                                    <Progress value={percentage} className="h-2" />
                                </div>
                            );
                        }) : (
                            <p className="text-sm text-muted-foreground">Aún no hay categorías para mostrar.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
