'use client';
import type { Course } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card";
import { Button } from "../ui/button";
import { BookOpen, Users, Pencil, Eye, PlayCircle, Layers, Trash2, ArchiveRestore, CheckCircle2, Star, Trophy, PauseCircle, Play, Tag, Clock } from "lucide-react";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { differenceInCalendarDays, isValid, parseISO } from 'date-fns';

interface CourseCardProps {
    course: Course;
    onViewDetails: () => void;
    onEdit?: () => void;
    onManageStudents?: () => void;
    onArchive?: () => void;
    onRestore?: () => void;
    onSuspend?: () => void;
    onReactivate?: () => void;
    isStudentView?: boolean;
    isArchivedView?: boolean;
    isSuspendedView?: boolean;
}

export function CourseCard({ 
    course, 
    onViewDetails, 
    onEdit, 
    onManageStudents, 
    onArchive, 
    onRestore,
    onSuspend,
    onReactivate,
    isStudentView = false,
    isArchivedView = false,
    isSuspendedView = false,
}: CourseCardProps) {
    const mainSyllabusTopic = course.levels.length > 0 ? course.levels[0].title : 'Sin módulos aún';
    
    const isCompleted = course.status === 'completed';

    const completedLevels = course.levels.filter(l => l.status === 'completed').length;
    const totalLevels = course.levels.length;
    const progress = isCompleted ? 100 : (totalLevels > 0 ? (completedLevels / totalLevels) * 100 : 0);
    const isStarted = progress > 0;

    const allStudentsCompleted = course.students.length > 0 && course.completedStudentIds.length === course.students.length;
    
    let daysRemaining: number | null = null;
    if (course.dueDate) {
        const dueDate = parseISO(course.dueDate);
        if(isValid(dueDate)) {
            daysRemaining = differenceInCalendarDays(dueDate, new Date());
        }
    }

    const getDeadlineBadge = () => {
        if (daysRemaining === null || isCompleted) return null;

        if (daysRemaining < 0) {
            return <Badge variant="destructive" className="flex items-center gap-2"><Clock /> Plazo Vencido</Badge>;
        }
        if (daysRemaining <= 7) {
            return <Badge variant="destructive" className="flex items-center gap-2"><Clock /> Quedan {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}</Badge>;
        }
        return <Badge variant="secondary" className="flex items-center gap-2"><Clock /> {daysRemaining} días restantes</Badge>;
    };
    
    return (
        <Card className="flex flex-col shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden">
            {isStudentView && isCompleted && course.finalScore !== undefined && (
                <div className="absolute top-2 right-2 z-10">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                        <Star className="text-yellow-400 fill-yellow-400 h-full w-full" />
                        <span className="absolute text-white font-bold text-lg drop-shadow-md pb-1">
                            {course.finalScore.toFixed(1)}
                        </span>
                    </div>
                </div>
            )}
            <CardHeader className={isStudentView && isCompleted ? "pr-24" : ""}>
                <CardTitle className="font-headline text-2xl">{course.title}</CardTitle>
                <CardDescription>
                    {mainSyllabusTopic}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                 <div className="flex flex-wrap gap-2">
                    {course.categoryName && <Badge variant="outline" className="flex items-center gap-2"><Tag /> {course.categoryName}</Badge>}
                    <Badge variant="secondary" className="flex items-center gap-2"><Layers /> {course.levels.length} Módulos</Badge>
                    {!isStudentView && <Badge variant="secondary" className="flex items-center gap-2"><Users /> {course.students.length} Estudiantes</Badge>}
                    {isStudentView && getDeadlineBadge()}
                    {isArchivedView && <Badge variant="destructive" className="flex items-center gap-2">Archivado</Badge>}
                    {isSuspendedView && <Badge variant="outline" className="flex items-center gap-2 border-orange-500 text-orange-500">Suspendido</Badge>}
                    {allStudentsCompleted && !isStudentView && <Badge variant="default" className="flex items-center gap-2 bg-green-600 text-white"><Trophy /> ¡Curso Finalizado!</Badge>}
                 </div>
                 {isStudentView && (
                    <div>
                        <div className="flex justify-between items-center mb-1 text-sm">
                            <span className="text-muted-foreground">Progreso</span>
                            <span className="font-semibold">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} />
                        {isCompleted && (
                             <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> ¡Curso Completado!</p>
                        )}
                    </div>
                 )}
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-start gap-2">
                {isStudentView ? (
                     <Button className="w-full" onClick={onViewDetails}>
                        {isCompleted ? <Eye className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                        {isCompleted ? 'Revisar Curso' : isStarted ? 'Continuar Curso' : 'Empezar Curso'}
                    </Button>
                ) : isArchivedView ? (
                    <Button className="w-full" onClick={onRestore} variant="outline">
                        <ArchiveRestore className="mr-2 h-4 w-4" /> Restaurar Curso
                    </Button>
                ) : isSuspendedView ? (
                     <Button className="w-full" onClick={onReactivate}>
                        <Play className="mr-2 h-4 w-4" /> Reactivar Curso
                    </Button>
                ) : (
                    <>
                        <Button className="flex-1" onClick={onViewDetails}>
                            <Eye className="mr-2 h-4 w-4" /> Ver Detalles
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" size="icon" onClick={onEdit} title="Editar Curso">
                                <Pencil className="h-4 w-4" />
                            </Button>
                             <Button variant="outline" size="icon" onClick={onManageStudents} title="Gestionar Alumnos">
                                <Users className="h-4 w-4" />
                            </Button>
                            <Button variant="secondary" size="icon" onClick={onSuspend} title="Suspender Curso">
                                <PauseCircle className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="icon" onClick={onArchive} title="Archivar Curso">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </>
                )}
            </CardFooter>
        </Card>
    );
}
