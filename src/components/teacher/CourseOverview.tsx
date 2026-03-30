

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCourse } from '@/context/CourseContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Pencil, Users, BookOpen, FileQuestion, CheckCircle, ArrowLeft, BarChart2, Star, Copy, PauseCircle, Trash2, Download, FileText, Clock, Library, Link as LinkIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import type { User, Course, CourseLevel, Question, CompletedStudent, StudentProgress, CourseSourceFile } from '@/types';
import { Progress } from '../ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';
import { Badge } from '../ui/badge';
import ReactMarkdown from 'react-markdown';
import { CourseBibliography } from './CourseBibliography';
import { apiGet, getFriendlyErrorMessage } from '@/lib/api-client';

interface CourseOverviewProps {
    onBack: () => void;
    onEdit: () => void;
    onManageStudents: () => void;
    onViewAnalytics: () => void;
    onDuplicate: () => void;
    onSuspend: () => void;
    onArchive: () => void;
}


export function CourseOverview({ onBack, onEdit, onManageStudents, onViewAnalytics, onDuplicate, onSuspend, onArchive }: CourseOverviewProps) {
    const { activeCourse } = useCourse();
    const { toast } = useToast();

    const studentProgressList = useMemo(() => {
        if (!activeCourse || !activeCourse.studentProgress) return [];
        return activeCourse.studentProgress.sort((a, b) => {
            // Sort completed students to the top, then by name
            const aCompleted = a.completedModulesCount === a.totalModulesCount && a.totalModulesCount > 0;
            const bCompleted = b.completedModulesCount === b.totalModulesCount && b.totalModulesCount > 0;
            if (aCompleted && !bCompleted) return -1;
            if (!aCompleted && bCompleted) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [activeCourse]);
    
    if (!activeCourse) {
        return (
            <div className="text-center py-12">
                <p>No se ha seleccionado ningún curso.</p>
                <Button onClick={onBack} className="mt-4">Volver al Panel</Button>
            </div>
        );
    }
    
    const { title, levels, sourceFiles } = activeCourse;
    
    const downloadFile = (fileName: string, dataUrl: string) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    const handleDownload = async (file: CourseSourceFile) => {
        toast({ title: 'Preparando descarga...', description: `Tu descarga para "${file.fileName}" comenzará en breve.`});
        try {
            const { dataUrl, fileName } = await apiGet<{ dataUrl: string | null; fileName: string | null }>(`/api/source-files/${file.id}`);
            if (dataUrl && fileName) {
                downloadFile(fileName, dataUrl);
            } else {
                 throw new Error("El archivo no tiene contenido o el nombre no está disponible.");
            }
        } catch (error) {
            toast({
                title: 'No pudimos preparar la descarga',
                description: getFriendlyErrorMessage(error, 'Inténtalo nuevamente en unos segundos.'),
                variant: 'destructive'
            });
        }
    };
    
    const getDeadlineBadge = (student: StudentProgress) => {
        if (!student.dueDate) return null;
        
        const isCompleted = student.totalModulesCount > 0 && student.completedModulesCount === student.totalModulesCount;
        if (isCompleted) return null;

        const dueDate = parseISO(student.dueDate);
        if (!isValid(dueDate)) return null;

        const daysRemaining = differenceInCalendarDays(dueDate, new Date());
        if (daysRemaining < 0) {
            return <Badge variant="destructive" className="flex items-center gap-1 text-xs"><Clock className="h-3 w-3" /> Vencido</Badge>;
        }
        if (daysRemaining <= 7) {
            return <Badge variant="destructive" className="flex items-center gap-1 text-xs"><Clock className="h-3 w-3" /> {daysRemaining}d</Badge>;
        }
        return <Badge variant="secondary" className="flex items-center gap-1 text-xs"><Clock className="h-3 w-3" /> {daysRemaining}d</Badge>;
    };


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
                        <CardDescription>Resumen de la ruta de aprendizaje y estudiantes inscritos.</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                         <Button variant="outline" onClick={onViewAnalytics}>
                            <BarChart2 className="mr-2 h-4 w-4" />
                            Análisis
                        </Button>
                        <Button variant="outline" onClick={onDuplicate}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicar
                        </Button>
                        <Button variant="outline" onClick={onEdit}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                        </Button>
                         <Button onClick={onManageStudents}>
                            <Users className="mr-2 h-4 w-4" />
                            Estudiantes
                        </Button>
                        <Button variant="secondary" onClick={onSuspend}>
                            <PauseCircle className="mr-2 h-4 w-4" />
                            Suspender
                        </Button>
                        <Button variant="destructive" onClick={onArchive}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Archivar
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <div className="space-y-6 sm:space-y-8 min-w-0">
                <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 min-w-0">
                    {/* ARCHIVOS DE ORIGEN Y BIBLIOGRAFIA */}
                    <div className="space-y-6 sm:space-y-8 min-w-0">
                        <Card className="premium-surface">
                             <CardHeader>
                                <CardTitle className="font-headline text-2xl flex items-center gap-2">
                                    <FileText />
                                    Archivos Fuente del Contenido
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {sourceFiles && sourceFiles.length > 0 ? (
                                    <ul className="space-y-3">
                                        {sourceFiles.map(file => (
                                            <li key={file.id} className="flex flex-col gap-3 rounded-xl border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className='flex items-center gap-3 overflow-hidden min-w-0'>
                                                    <FileText className='h-6 w-6 text-primary shrink-0' />
                                                    <span className='font-medium text-sm truncate' title={file.fileName}>{file.fileName}</span>
                                                </div>
                                                <Button onClick={() => handleDownload(file)} size="sm" variant="ghost" className="w-full sm:w-auto">
                                                    <Download className="h-4 w-4"/>
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-muted-foreground text-sm">Este curso no tiene archivos de origen.</p>
                                )}
                            </CardContent>
                        </Card>
                        <CourseBibliography />
                    </div>

                    {/* PROGRESO DE ESTUDIANTES */}
                    <Card className="premium-surface">
                        <CardHeader>
                             <CardTitle className="font-headline text-2xl flex items-center gap-2">
                                <Users />
                                Progreso de Estudiantes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40%]">Estudiante</TableHead>
                                        <TableHead className="text-center">Fecha Límite</TableHead>
                                        <TableHead className="text-right">Progreso</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {studentProgressList.length > 0 ? studentProgressList.map(student => {
                                        const isCompleted = student.totalModulesCount > 0 && student.completedModulesCount === student.totalModulesCount;
                                        const progressPercentage = student.totalModulesCount > 0 ? (student.completedModulesCount / student.totalModulesCount) * 100 : 0;
                                        return (
                                        <TableRow key={student.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={`https://placehold.co/40x40.png?text=${student.name.substring(0,2)}`} alt={student.name} data-ai-hint="person" />
                                                            <AvatarFallback>{student.name.substring(0,2)}</AvatarFallback>
                                                        </Avatar>
                                                    <span className="truncate" title={student.name}>{student.name}</span>
                                                </div>
                                            </TableCell>
                                             <TableCell className="text-center">
                                                {getDeadlineBadge(student) || <span className="text-xs text-muted-foreground">-</span>}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {isCompleted && student.averageScore ? (
                                                    <div className="flex items-center justify-end gap-1 text-secondary">
                                                    <Star className="h-4 w-4" />
                                                    <span>{student.averageScore.toFixed(1)}%</span>
                                                    </div>
                                                ) : (
                                                    <span>{Math.round(progressPercentage)}%</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )}) : (
                                            <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center">
                                                No hay estudiantes inscritos.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
                
                {/* RUTA DE APRENDIZAJE */}
                <Card className="premium-surface">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl flex items-center gap-2">
                            <BookOpen />
                            Ruta de Aprendizaje
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                            {levels.map((level) => (
                                <AccordionItem value={level.id} key={level.id} className="border-b">
                                    <AccordionTrigger className="font-semibold text-left hover:no-underline text-lg">
                                        {level.title}
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-4 space-y-6">
                                        <div>
                                            <h4 className="font-semibold text-md mb-2 flex items-center gap-2"><BookOpen className="h-4 w-4"/>Temario del Módulo</h4>
                                            <Accordion type="single" collapsible className="w-full">
                                                {level.syllabus.map((section, index) => (
                                                    <AccordionItem value={`syllabus-${index}`} key={index}>
                                                        <AccordionTrigger className="font-medium text-left hover:no-underline text-sm">{section.title}</AccordionTrigger>
                                                        <AccordionContent className="prose dark:prose-invert max-w-none pl-2 border-l-2 border-primary/30 ml-2">
                                                            <ReactMarkdown>{section.content}</ReactMarkdown>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                ))}
                                            </Accordion>
                                        </div>
                                        
                                        {level.questionnaire.length > 0 && (
                                            <div>
                                                <h4 className="font-semibold text-md mb-2 flex items-center gap-2"><FileQuestion className="h-4 w-4"/>Cuestionario del Módulo</h4>
                                                <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                                                    {level.questionnaire.map((q, i) => (
                                                        <div key={i} className="text-sm">
                                                            <p className="font-semibold">{i + 1}. {q.text}</p>
                                                            <ul className="mt-2 list-disc pl-5 space-y-1">
                                                                {q.options.map((opt: string, j: number) => (
                                                                    <li key={j} className={cn('flex items-center gap-2', { 'font-bold text-secondary': j === q.correctOptionIndex })}>
                                                                        {opt}
                                                                        {j === q.correctOptionIndex && <CheckCircle className="h-4 w-4" />}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

    
