
'use client';

import { useMemo } from 'react';
import { useCourse } from '@/context/CourseContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { BookOpen, Users, ArrowLeft, Play, Copy, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

interface SuspendedCourseOverviewProps {
    onBack: () => void;
    onReactivate: () => void;
    onDuplicate: () => void;
    onArchive: () => void;
}

export function SuspendedCourseOverview({ onBack, onReactivate, onDuplicate, onArchive }: SuspendedCourseOverviewProps) {
    const { activeCourse, allUsers } = useCourse();
    
    const enrolledStudents = useMemo(() => {
        if (!activeCourse || !allUsers) return [];
        return allUsers.filter(s => s.roles.includes('student') && activeCourse.students.some(e => e.studentId === s.id));
    }, [activeCourse, allUsers]);

    
    if (!activeCourse) {
        return (
            <div className="text-center py-12">
                <p>No se ha seleccionado ningún curso suspendido.</p>
                <Button onClick={onBack} className="mt-4">Volver al Panel</Button>
            </div>
        );
    }
    
    const { title, levels } = activeCourse;

    return (
        <div className="space-y-6 sm:space-y-8 min-w-0 animate-fade-in">
             <Button variant="ghost" onClick={onBack} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al Panel de Cursos
            </Button>
            <Card className="premium-surface">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                        <CardTitle className="font-headline text-2xl break-words sm:text-3xl">{title}</CardTitle>
                        <CardDescription>Resumen de un curso suspendido (solo lectura).</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                         <Button variant="outline" onClick={onDuplicate}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicar Curso
                        </Button>
                        <Button variant="destructive" onClick={onArchive}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Archivar
                        </Button>
                        <Button onClick={onReactivate}>
                            <Play className="mr-2 h-4 w-4" />
                            Reactivar Curso
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-6 sm:gap-8 lg:grid-cols-5 min-w-0">
                <div className="space-y-6 sm:space-y-8 lg:col-span-3 min-w-0">
                    <Card className="premium-surface">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline text-2xl">
                                <BookOpen />
                                Ruta de Aprendizaje
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="mt-2 h-full max-h-[60vh] sm:max-h-[600px]">
                                <Accordion type="single" collapsible className="w-full pr-4">
                                    {levels.map((level) => (
                                        <AccordionItem value={level.id} key={level.id}>
                                            <AccordionTrigger className="font-semibold text-left hover:no-underline text-lg">{level.title}</AccordionTrigger>
                                            <AccordionContent className="pl-4 border-l-2 border-primary/50 ml-2 space-y-6">
                                                <div>
                                                    <h4 className="font-semibold text-md mb-2">Temario del Módulo</h4>
                                                    <Accordion type="single" collapsible className="w-full">
                                                      {level.syllabus.map((section, index) => (
                                                          <AccordionItem value={`section-${index}`} key={index}>
                                                                <AccordionTrigger className="font-medium text-left hover:no-underline text-sm">{section.title}</AccordionTrigger>
                                                                <AccordionContent className="whitespace-pre-wrap font-mono text-xs pl-2 border-l-2 border-primary/30 ml-2">
                                                                    {section.content}
                                                                </AccordionContent>
                                                            </AccordionItem>
                                                      ))}
                                                    </Accordion>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="space-y-6 sm:space-y-8 lg:col-span-2 min-w-0">
                    <Card className="premium-surface">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline text-2xl">
                                <Users />
                                Estudiantes Inscritos
                            </CardTitle>
                            <CardDescription>({enrolledStudents.length} en total)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-full max-h-[55vh] sm:max-h-[500px]">
                               {enrolledStudents.length > 0 ? (
                                    <ul className="space-y-4 pr-6">
                                        {enrolledStudents.map(student => (
                                            <li key={student.id} className="flex min-w-0 items-center gap-4">
                                                <Avatar>
                                                    <AvatarImage src={`https://placehold.co/40x40.png?text=${student.name.substring(0,2)}`} alt={student.name} data-ai-hint="person" />
                                                    <AvatarFallback>{student.name.substring(0,2)}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <span className="block truncate font-medium">{student.name}</span>
                                                    <p className="truncate text-sm text-muted-foreground">{student.email}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                               ) : (
                                 <p className="text-muted-foreground text-sm text-center">No hay estudiantes inscritos en este curso.</p>
                               )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
