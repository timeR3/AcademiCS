'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, UserCheck, BookOpen, BarChart } from 'lucide-react';
import { useCourse } from '@/context/CourseContext';

export function AnalyticsView() {
    const { allUsers, courses, archivedCourses, setAdminView } = useCourse();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
       setLoading(allUsers.length === 0 && courses.length === 0 && archivedCourses.length === 0);
    }, [allUsers, courses, archivedCourses]);

    const totalStudents = allUsers.filter(u => u.roles.includes('student')).length;
    const totalTeachers = allUsers.filter(u => u.roles.includes('teacher')).length;
    const totalCourses = courses.length + archivedCourses.length;

    const statCards = [
        { title: "Total de Estudiantes", value: totalStudents, icon: Users, color: "text-primary", onClick: () => setAdminView('users') },
        { title: "Total de Profesores", value: totalTeachers, icon: UserCheck, color: "text-secondary", onClick: () => setAdminView('users') },
        { title: "Total de Cursos", value: totalCourses, icon: BookOpen, color: "text-accent-foreground", onClick: () => setAdminView('courses') },
        { title: "Calificación Promedio", value: "85%", icon: BarChart, color: "text-muted-foreground", onClick: () => {} }
    ];
    
    if (loading) {
        return <p>Cargando estadísticas...</p>;
    }

    return (
        <div className="space-y-6 min-w-0">
            <h2 className="text-2xl font-bold font-headline">Estadísticas Generales</h2>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 min-w-0">
                {statCards.map((card, index) => (
                    <Card key={index} onClick={card.onClick} className="premium-surface transition-all hover:shadow-md hover:-translate-y-1 cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                            <card.icon className={`h-6 w-6 ${card.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{card.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            {/* Future chart components can go here */}
        </div>
    );
}
