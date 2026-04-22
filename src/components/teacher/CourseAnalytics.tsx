'use client';

import { useState, useEffect } from 'react';
import { useCourse } from '@/context/CourseContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { ArrowLeft, BarChart2, CheckCircle, Percent, Star, Users, FileDown, Table as TableIcon } from 'lucide-react';

import type { CourseAnalyticsData } from '@/types';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '../ui/progress';
import { apiGet } from '@/lib/api-client';

interface CourseAnalyticsProps {
    onBack: () => void;
}

export function CourseAnalytics({ onBack }: CourseAnalyticsProps) {
    const { activeCourse } = useCourse();
    const [analytics, setAnalytics] = useState<CourseAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (activeCourse) {
            setLoading(true);
            apiGet<CourseAnalyticsData>(`/api/courses/${activeCourse.id}/analytics`)
                .then(data => {
                    setAnalytics(data);
                })
                .catch(err => {
                    console.error("Failed to load course analytics", err);
                    // Handle error state in UI if needed
                })
                .finally(() => setLoading(false));
        }
    }, [activeCourse]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
                <p className="ml-4">Cargando análisis del curso...</p>
            </div>
        );
    }
    
    if (!activeCourse || !analytics) {
        return (
            <div className="text-center py-12">
                <p>No se pudieron cargar los datos de análisis.</p>
                <Button onClick={onBack} className="mt-4">Volver</Button>
            </div>
        );
    }

    const statCards = [
        { title: "Tasa de Finalización", value: `${analytics.completionRate.toFixed(1)}%`, icon: CheckCircle, color: "text-secondary" },
        { title: "Estudiantes Activos", value: analytics.activeStudents, icon: Users, color: "text-primary" },
        { title: "Puntuación Promedio", value: `${analytics.averageScore.toFixed(1)}%`, icon: Star, color: "text-accent-foreground" },
        { title: "Módulos Completados", value: analytics.totalModulesCompleted, icon: Percent, color: "text-muted-foreground" }
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <Button variant="ghost" onClick={onBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al Resumen del Curso
                </Button>
                <div className="min-w-0 text-center sm:text-right">
                    <h1 className="text-2xl font-bold font-headline break-words sm:text-3xl">{activeCourse.title}</h1>
                    <p className="text-muted-foreground">Análisis de Rendimiento</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
                <Button 
                    variant="outline" 
                    className="flex-1 sm:flex-none gap-2 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                    onClick={() => window.open(`/api/reports/export/csv?courseId=${activeCourse.id}`, '_blank')}
                >
                    <TableIcon className="h-4 w-4" />
                    Exportar a Excel (.csv)
                </Button>
                <Button 
                    variant="outline" 
                    className="flex-1 sm:flex-none gap-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                    onClick={() => window.open(`/api/reports/export/pdf-view?courseId=${activeCourse.id}`, '_blank')}
                >
                    <FileDown className="h-4 w-4" />
                    Generar Reporte PDF
                </Button>
            </div>

            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((card, index) => (
                    <Card key={index} className="premium-surface">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                            <card.icon className={`h-5 w-5 ${card.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{card.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="premium-surface">
                 <CardHeader>
                    <CardTitle className="font-headline text-2xl flex items-center gap-2"><BarChart2 />Progreso por Módulo</CardTitle>
                    <CardDescription>Un desglose detallado del rendimiento de los estudiantes en cada módulo del curso.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">Título del Módulo</TableHead>
                                <TableHead>Tasa de Finalización</TableHead>
                                <TableHead className="text-right">Puntuación Promedio</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {analytics.modules.map(module => (
                                <TableRow key={module.moduleId}>
                                    <TableCell className="font-medium">{module.title}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-4">
                                            <Progress value={module.completionRate} className="w-full h-2" />
                                            <span className="text-sm font-semibold w-12 text-right">{module.completionRate.toFixed(0)}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">{module.averageScore.toFixed(1)}%</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

        </div>
    )
}
