
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
import { Search, Tag, Users, Star, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Trash2, BarChart2, FileDown, Table as LucideTable, Pencil, RotateCcw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useCourse } from '@/context/CourseContext';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { buttonVariants } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiDelete, getFriendlyErrorMessage } from '@/lib/api-client';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { apiPatch } from '@/lib/api-client';

function isUafeCourse(title: string): boolean {
    const lower = title.toLowerCase();
    return lower.includes('uafe') || lower.includes('lavado de activos') || lower.includes('la/ft') || lower.includes('pla');
}

interface CoursesViewProps {
    onPrefetchCourse: (course: Course) => Promise<void>;
}

type StudentSortKey = 'name' | 'progress' | 'dueDate' | 'finalScore';
type SortDirection = 'asc' | 'desc';

export function CoursesView({ onPrefetchCourse }: CoursesViewProps) {
    const { courses, archivedCourses, allUsers, refreshCourses, setAdminView, setActiveCourseId } = useCourse();

    const { toast } = useToast();
    const [allCourses, setAllCourses] = useState<Course[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isDeletingCourse, setIsDeletingCourse] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
    const [studentSortKey, setStudentSortKey] = useState<StudentSortKey>('name');
    const [studentSortDirection, setStudentSortDirection] = useState<SortDirection>('asc');

    // Estado del modal UAFE
    const [showUafeModal, setShowUafeModal] = useState(false);
    const [uafeFecha, setUafeFecha] = useState('');
    const [uafeDuracion, setUafeDuracion] = useState('');
    const [uafeBaseLegal, setUafeBaseLegal] = useState('Resoluciones UAFE-DG-2024-0621 (Reg. Ofc.675 -30/10/24) / SCVS-RNAE-1904.');
    const [uafeTipo, setUafeTipo] = useState('');
    const [uafeCourseId, setUafeCourseId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
    const [isRestoring, setIsRestoring] = useState(false);

    const handlePdfClick = (course: Course) => {
        if (isUafeCourse(course.title)) {
            setUafeCourseId(course.id);
            setShowUafeModal(true);
        } else {
            window.open(`/api/reports/export/pdf-view?courseId=${course.id}`, '_blank');
        }
    };

    const handleUafeGenerate = () => {
        if (!uafeCourseId) return;
        const params = new URLSearchParams({
            courseId: uafeCourseId,
            fecha: uafeFecha,
            duracion: uafeDuracion,
            baseLegal: uafeBaseLegal,
            tipo: uafeTipo
        });
        window.open(`/api/reports/export/pdf-view?${params.toString()}`, '_blank');
        setShowUafeModal(false);
    };

    useEffect(() => {
        const combined = [...courses, ...archivedCourses];
        setAllCourses(combined);
        setLoading(combined.length === 0 && allUsers.length === 0);
    }, [courses, archivedCourses, allUsers]);

    const filteredCourses = allCourses.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (activeTab === 'active' ? course.status === 'active' : course.status === 'archived')
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

    const sortedStudentRows = useMemo<StudentProgress[]>(() => {
        const rows = [...studentRows];
        rows.sort((a, b) => {
            if (studentSortKey === 'name') {
                const result = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
                return studentSortDirection === 'asc' ? result : -result;
            }
            if (studentSortKey === 'progress') {
                const progressA = a.totalModulesCount > 0 ? (a.completedModulesCount / a.totalModulesCount) * 100 : 0;
                const progressB = b.totalModulesCount > 0 ? (b.completedModulesCount / b.totalModulesCount) * 100 : 0;
                return studentSortDirection === 'asc' ? progressA - progressB : progressB - progressA;
            }
            if (studentSortKey === 'dueDate') {
                const dueA = a.dueDate ? parseISO(a.dueDate).getTime() : null;
                const dueB = b.dueDate ? parseISO(b.dueDate).getTime() : null;
                if (dueA === null && dueB === null) return 0;
                if (dueA === null) return 1;
                if (dueB === null) return -1;
                return studentSortDirection === 'asc' ? dueA - dueB : dueB - dueA;
            }
            const scoreA = typeof a.finalScore === 'number' ? a.finalScore : null;
            const scoreB = typeof b.finalScore === 'number' ? b.finalScore : null;
            if (scoreA === null && scoreB === null) return 0;
            if (scoreA === null) return 1;
            if (scoreB === null) return -1;
            return studentSortDirection === 'asc' ? scoreA - scoreB : scoreB - scoreA;
        });
        return rows;
    }, [studentRows, studentSortDirection, studentSortKey]);

    const toggleStudentSort = (key: StudentSortKey) => {
        if (studentSortKey === key) {
            setStudentSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setStudentSortKey(key);
        setStudentSortDirection('desc');
    };

    const SortIcon = ({ keyName }: { keyName: StudentSortKey }) => {
        if (studentSortKey !== keyName) {
            return <ArrowUpDown className="h-3.5 w-3.5" />;
        }
        return studentSortDirection === 'asc'
            ? <ArrowUp className="h-3.5 w-3.5" />
            : <ArrowDown className="h-3.5 w-3.5" />;
    };

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

    const handleRestoreCourse = async (course: Course) => {
        setIsRestoring(true);
        try {
            await apiPatch<{ success: boolean }>(`/api/courses/${course.id}/status`, { action: 'restore' });
            toast({
                title: 'Curso restaurado',
                description: `El curso "${course.title}" ha sido reactivado correctamente.`,
            });
            await refreshCourses();
        } catch (error) {
            toast({
                title: 'Error al restaurar',
                description: getFriendlyErrorMessage(error),
                variant: 'destructive',
            });
        } finally {
            setIsRestoring(false);
        }
    };

    const handleDeleteCourse = async () => {
        if (!courseToDelete) {
            return;
        }
        setIsDeletingCourse(true);
        try {
            await apiDelete<{ success: boolean }>(`/api/courses/${encodeURIComponent(courseToDelete.id)}`);
            toast({
                title: 'Curso archivado',
                description: `El curso "${courseToDelete.title}" fue movido a la biblioteca de archivados.`,
            });
            if (selectedCourseId === courseToDelete.id) {
                handleCloseDialog();
            }
            setCourseToDelete(null);
            await refreshCourses();
        } catch (error) {
            toast({
                title: 'No pudimos procesar la solicitud',
                description: getFriendlyErrorMessage(error, 'Inténtalo nuevamente en unos segundos.'),
                variant: 'destructive',
            });
        } finally {
            setIsDeletingCourse(false);
        }
    };

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

                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'archived')} className="mb-4">
                        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                            <TabsTrigger value="active">Cursos Activos</TabsTrigger>
                            <TabsTrigger value="archived">Papelera / Archivados</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex-grow overflow-hidden rounded-xl border">
                        <ScrollArea className="h-full">
                            <div className="overflow-x-auto">
                            <Table className="min-w-[640px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Título del Curso</TableHead>
                                        <TableHead className="hidden md:table-cell">Profesor</TableHead>
                                        <TableHead className="hidden lg:table-cell">Categoría</TableHead>
                                        <TableHead className="hidden xl:table-cell">Uso IA</TableHead>
                                        <TableHead className="text-center">Inscritos</TableHead>
                                        <TableHead className="text-center">Estado</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={7} className="text-center h-24">Cargando cursos...</TableCell></TableRow>
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
                                                    <TableCell className="text-right">
                                                        {activeTab === 'active' ? (
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="sm"
                                                                className="h-8"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    setCourseToDelete(course);
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                Eliminar
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 border-green-600 text-green-600 hover:bg-green-50"
                                                                disabled={isRestoring}
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    handleRestoreCourse(course);
                                                                }}
                                                            >
                                                                <RotateCcw className="h-4 w-4" />
                                                                Restaurar
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow><TableCell colSpan={7} className="text-center h-24">No se encontraron cursos.</TableCell></TableRow>
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
                     <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="uso-ia" className="border rounded-2xl px-4">
                            <AccordionTrigger className="text-base font-semibold hover:no-underline">Uso de IA</AccordionTrigger>
                            <AccordionContent>
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
                            </AccordionContent>
                        </AccordionItem>
                     </Accordion>
                     <Separator />
                     <div className="space-y-3">
                        <h3 className="font-semibold flex items-center gap-2"><Users /> Progreso de Estudiantes ({selectedCourse?.students?.length || 0} inscritos)</h3>
                        <ScrollArea className="h-60 rounded-xl border">
                             <div className="overflow-x-auto">
                             <Table className="min-w-[560px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>
                                            <Button type="button" variant="ghost" size="sm" className="h-auto p-0 font-semibold hover:bg-transparent" onClick={() => toggleStudentSort('name')}>
                                                Estudiante
                                                <SortIcon keyName="name" />
                                            </Button>
                                        </TableHead>
                                        <TableHead>
                                            <Button type="button" variant="ghost" size="sm" className="h-auto p-0 font-semibold hover:bg-transparent" onClick={() => toggleStudentSort('progress')}>
                                                Progreso
                                                <SortIcon keyName="progress" />
                                            </Button>
                                        </TableHead>
                                        <TableHead>
                                            <Button type="button" variant="ghost" size="sm" className="h-auto p-0 font-semibold hover:bg-transparent" onClick={() => toggleStudentSort('dueDate')}>
                                                Fecha de Vencimiento
                                                <SortIcon keyName="dueDate" />
                                            </Button>
                                        </TableHead>
                                        <TableHead className="text-right">
                                            <Button type="button" variant="ghost" size="sm" className="ml-auto h-auto p-0 font-semibold hover:bg-transparent" onClick={() => toggleStudentSort('finalScore')}>
                                                Calificación Final
                                                <SortIcon keyName="finalScore" />
                                            </Button>
                                        </TableHead>
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
                                    ) : sortedStudentRows.length > 0 ? (
                                        sortedStudentRows.map((student: StudentProgress) => {
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
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <div className="flex flex-wrap gap-2 mr-auto">
                            <Button 
                                variant="outline" 
                                size="sm"
                                className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                onClick={() => selectedCourse && window.open(`/api/reports/export/csv?courseId=${selectedCourse.id}`, '_blank')}
                            >
                                <LucideTable className="h-4 w-4 mr-1" />
                                Excel
                            </Button>
                            <Button 
                                variant="outline" 
                                size="sm"
                                className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                                onClick={() => selectedCourse && handlePdfClick(selectedCourse)}
                            >
                                <FileDown className="h-4 w-4 mr-1" />
                                PDF
                            </Button>
                        </div>
                        <Button variant="secondary" onClick={() => {
                            if (selectedCourse) {
                                setActiveCourseId(selectedCourse.id);
                                setAdminView('course-analytics');
                            }
                        }}>
                            <BarChart2 className="h-4 w-4 mr-2" />
                            Ver Analíticas
                        </Button>
                        <Button variant="outline" className="border-primary text-primary hover:bg-primary/5" onClick={() => {
                            if (selectedCourse) {
                                setActiveCourseId(selectedCourse.id);
                                setAdminView('students');
                            }
                        }}>
                            <Users className="h-4 w-4 mr-2" />
                            Gestionar Estudiantes
                        </Button>
                        <Button variant="default" className="bg-amber-600 hover:bg-amber-700" onClick={() => {
                            if (selectedCourse) {
                                setActiveCourseId(selectedCourse.id);
                                setAdminView('edit-course');
                            }
                        }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar Curso
                        </Button>
                        <Button variant="outline" onClick={handleCloseDialog}>Cerrar</Button>


                    </DialogFooter>


                </DialogContent>
            </Dialog>
            <AlertDialog open={!!courseToDelete} onOpenChange={(isOpen) => !isOpen && setCourseToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Deseas eliminar este curso?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El curso se moverá a la papelera. Podrás restaurarlo más tarde si lo necesitas, y sus materiales de estudio permanecerán seguros.
                            <blockquote className="mt-4 border-l-2 pl-4 italic">
                                {courseToDelete?.title}
                            </blockquote>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingCourse}>Cancelar</AlertDialogCancel>
                        <Button
                            variant="destructive"
                            onClick={async (e) => {
                                e.preventDefault();
                                await handleDeleteCourse();
                            }}
                            disabled={isDeletingCourse}
                        >
                            {isDeletingCourse ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Sí, eliminar curso
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modal UAFE para datos adicionales del reporte */}
            <Dialog open={showUafeModal} onOpenChange={setShowUafeModal}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Datos del Reporte UAFE</DialogTitle>
                        <DialogDescription>
                            Este curso requiere información adicional para generar el reporte oficial de la UAFE.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="admin-uafe-fecha">Fecha de la capacitación</Label>
                            <Input id="admin-uafe-fecha" type="date" value={uafeFecha} onChange={(e) => setUafeFecha(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="admin-uafe-duracion">Duración</Label>
                            <Input id="admin-uafe-duracion" value={uafeDuracion} onChange={(e) => setUafeDuracion(e.target.value)} placeholder="Ej: 3 horas" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="admin-uafe-base-legal">Base Legal</Label>
                            <Input id="admin-uafe-base-legal" value={uafeBaseLegal} onChange={(e) => setUafeBaseLegal(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="admin-uafe-tipo">Tipo de capacitación</Label>
                            <Select value={uafeTipo} onValueChange={setUafeTipo}>
                                <SelectTrigger id="admin-uafe-tipo">
                                    <SelectValue placeholder="Seleccione el tipo..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="induccion">Inducción (Nuevo Personal)</SelectItem>
                                    <SelectItem value="refuerzo">Refuerzo Anual</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowUafeModal(false)}>Cancelar</Button>
                        <Button onClick={handleUafeGenerate} className="bg-blue-600 hover:bg-blue-700">
                            <FileDown className="h-4 w-4 mr-2" />
                            Generar Reporte
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
