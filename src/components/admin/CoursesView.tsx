
'use client';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import type { Course, User, StudentProgress } from '@/types';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Search, Tag, Users, Star, Loader2 } from 'lucide-react';
import { useCourse } from '@/context/CourseContext';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface CoursesViewProps {
    onPrefetchCourse: (course: Course) => Promise<void>;
}

export function CoursesView({ onPrefetchCourse }: CoursesViewProps) {
    const { courses, archivedCourses, allUsers } = useCourse();
    const [allCourses, setAllCourses] = useState<Course[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    useEffect(() => {
        const combined = [...courses, ...archivedCourses];
        setAllCourses(combined);
        setLoading(combined.length === 0 && allUsers.length === 0);
    }, [courses, archivedCourses, allUsers]);

    const filteredCourses = allCourses.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const getTeacherForCourse = (teacherId: string | undefined): User | undefined => {
        if (!teacherId) return undefined;
        return allUsers.find(u => u.id === teacherId);
    };

    const handleCloseDialog = () => {
        setSelectedCourseId(null);
        setIsLoadingDetails(false);
    }

    const selectedCourse = useMemo(() => {
        if (!selectedCourseId) {
            return null;
        }
        return allCourses.find(course => course.id === selectedCourseId) ?? null;
    }, [allCourses, selectedCourseId]);
    const teacherForSelectedCourse = selectedCourse ? getTeacherForCourse(selectedCourse.teacherId) : null;

    const studentRows = useMemo<StudentProgress[]>(() => {
        if (!selectedCourse) {
            return [];
        }
        if ((selectedCourse.studentProgress?.length ?? 0) > 0) {
            return selectedCourse.studentProgress ?? [];
        }
        return (selectedCourse.students ?? []).map(student => {
            const user = allUsers.find(item => item.id === student.studentId);
            return {
                id: student.studentId,
                name: user?.name || `Estudiante ${student.studentId}`,
                email: user?.email || '',
                status: user?.status || 'active',
                roles: user?.roles || ['student'],
                enrollmentStatus: 'in-progress',
                completedModulesCount: 0,
                totalModulesCount: selectedCourse.levels.length,
                finalScore: undefined,
                averageScore: 0,
                dueDate: student.dueDate ? String(student.dueDate) : undefined,
            };
        });
    }, [selectedCourse, allUsers]);

    const handleOpenCourse = async (course: Course) => {
        setSelectedCourseId(course.id);
        setIsLoadingDetails(true);
        try {
            await onPrefetchCourse(course);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const formatDueDate = (dateValue?: string | null) => {
        if (!dateValue) {
            return null;
        }
        const parsed = parseISO(dateValue);
        if (!isValid(parsed)) {
            return null;
        }
        return format(parsed, 'dd MMM, yyyy', { locale: es });
    };

    const formatTokens = (value: number | undefined) => new Intl.NumberFormat('es-ES').format(value ?? 0);
    const formatUsd = (value: number | undefined) =>
        new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(value ?? 0);

    return (
        <>
            <Card className="premium-surface h-full flex flex-col">
                <CardHeader>
                    <CardTitle>Gestión de Cursos</CardTitle>
                    <CardDescription>Visualiza, busca y selecciona un curso para ver sus métricas y progreso.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por título de curso..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <div className="flex-grow overflow-hidden rounded-xl border">
                        <ScrollArea className="h-full">
                            <div className="overflow-x-auto">
                            <Table className="min-w-[560px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Título del Curso</TableHead>
                                        <TableHead className="hidden md:table-cell">Profesor</TableHead>
                                        <TableHead className="hidden lg:table-cell">Categoría</TableHead>
                                        <TableHead className="hidden xl:table-cell">Uso IA</TableHead>
                                        <TableHead className="text-center">Inscritos</TableHead>
                                        <TableHead className="text-center">Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={6} className="text-center h-24">Cargando cursos...</TableCell></TableRow>
                                    ) : filteredCourses.length > 0 ? (
                                        filteredCourses.map(course => {
                                            const teacher = getTeacherForCourse(course.teacherId);
                                            return (
                                                <TableRow key={course.id} onMouseEnter={() => { void onPrefetchCourse(course); }} onClick={() => { void handleOpenCourse(course); }} className="cursor-pointer">
                                                    <TableCell className="font-medium">
                                                        <div className="flex flex-col">
                                                           <span>{course.title}</span>
                                                           <span className="text-xs text-muted-foreground md:hidden">{teacher?.name || 'No asignado'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">{teacher?.name || 'No asignado'}</TableCell>
                                                    <TableCell className="hidden lg:table-cell">
                                                        {course.categoryName ? (
                                                            <Badge variant="outline" className="flex items-center gap-1 w-fit"><Tag className="h-3 w-3" />{course.categoryName}</Badge>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">Sin categoría</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="hidden xl:table-cell">
                                                        <div className="space-y-1 text-xs">
                                                            <div className="font-medium">{formatUsd(course.aiMetrics?.estimatedCostUsd)}</div>
                                                            <div className="text-muted-foreground">{formatTokens(course.aiMetrics?.totalTokens)} tokens</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">{course.students.length}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant={course.status === 'active' ? 'secondary' : 'outline'} className="capitalize">
                                                            {course.status === 'active' ? 'Activo' : course.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow><TableCell colSpan={6} className="text-center h-24">No se encontraron cursos.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            </div>
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>
            <Dialog open={!!selectedCourseId} onOpenChange={(isOpen) => !isOpen && handleCloseDialog()}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="font-headline text-2xl">{selectedCourse?.title}</DialogTitle>
                        <DialogDescription>
                            ID del Curso: {selectedCourse?.id}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                        <div><strong>Profesor:</strong> {teacherForSelectedCourse?.name || 'No asignado'}</div>
                        <div><strong>Email del Profesor:</strong> {teacherForSelectedCourse?.email || 'N/A'}</div>
                        <div><strong>Categoría:</strong> {selectedCourse?.categoryName || 'Sin categoría'}</div>
                        <div className="flex items-center gap-2"><strong>Estado:</strong> <Badge variant={selectedCourse?.status === 'active' ? 'secondary' : 'outline'} className="capitalize">{selectedCourse?.status}</Badge></div>
                    </div>
                     <Separator />
                     <div className="space-y-3">
                        <h3 className="font-semibold">Uso de IA</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="rounded-2xl border bg-card p-3">
                                <p className="text-xs text-muted-foreground">Costo estimado</p>
                                <p className="text-lg font-semibold">{formatUsd(selectedCourse?.aiMetrics?.estimatedCostUsd)}</p>
                            </div>
                            <div className="rounded-2xl border bg-card p-3">
                                <p className="text-xs text-muted-foreground">Tokens totales</p>
                                <p className="text-lg font-semibold">{formatTokens(selectedCourse?.aiMetrics?.totalTokens)}</p>
                            </div>
                            <div className="rounded-2xl border bg-card p-3">
                                <p className="text-xs text-muted-foreground">Intentos de generación</p>
                                <p className="text-lg font-semibold">{selectedCourse?.aiMetrics?.generationAttempts ?? 0}</p>
                                <p className="text-xs text-muted-foreground">
                                    Índice {selectedCourse?.aiMetrics?.syllabusIndexAttempts ?? 0} · Módulos {selectedCourse?.aiMetrics?.syllabusModuleAttempts ?? 0} · Cuestionarios {selectedCourse?.aiMetrics?.questionnaireAttempts ?? 0}
                                </p>
                            </div>
                            <div className="rounded-2xl border bg-card p-3">
                                <p className="text-xs text-muted-foreground">Archivos</p>
                                <p className="text-lg font-semibold">{selectedCourse?.aiMetrics?.fileUploadSuccesses ?? 0} / {selectedCourse?.aiMetrics?.fileUploadAttempts ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Subidos / intentos</p>
                            </div>
                        </div>
                     </div>
                     <Separator />
                     <div className="space-y-3">
                        <h3 className="font-semibold flex items-center gap-2"><Users /> Progreso de Estudiantes ({selectedCourse?.students?.length || 0} inscritos)</h3>
                        <ScrollArea className="h-60 rounded-xl border">
                             <div className="overflow-x-auto">
                             <Table className="min-w-[560px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Estudiante</TableHead>
                                        <TableHead>Progreso</TableHead>
                                        <TableHead>Fecha de Vencimiento</TableHead>
                                        <TableHead className="text-right">Calificación Final</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingDetails && studentRows.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center h-24">
                                                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Cargando progreso de estudiantes...
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ) : studentRows.length > 0 ? (
                                        studentRows.map((student: StudentProgress) => {
                                            const progress = student.totalModulesCount > 0 ? (student.completedModulesCount / student.totalModulesCount) * 100 : 0;
                                            const formattedDueDate = formatDueDate(student.dueDate ?? null);
                                            return (
                                                <TableRow key={student.id}>
                                                    <TableCell className="font-medium">{student.name}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={progress} className="w-24 h-2"/>
                                                            <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {formattedDueDate ? formattedDueDate : <span className="text-xs text-muted-foreground">-</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {typeof student.finalScore === 'number' ? (
                                                            <span className="flex items-center justify-end gap-1 text-secondary"><Star className="h-4 w-4"/> {student.finalScore.toFixed(1)}%</span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">En curso</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center h-24">No hay estudiantes inscritos en este curso.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            </div>
                        </ScrollArea>
                     </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseDialog}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
