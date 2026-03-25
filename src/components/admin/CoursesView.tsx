
'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import type { Course, Teacher, User, StudentProgress } from '@/types';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Pencil, Trash2, Search, Tag, Users, Star, Loader2 } from 'lucide-react';
import { useCourse } from '@/context/CourseContext';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CoursesViewProps {
    onEditCourse: (course: Course) => Promise<void>;
    onPrefetchCourse: (course: Course) => void;
}

export function CoursesView({ onEditCourse, onPrefetchCourse }: CoursesViewProps) {
    const { courses, archivedCourses, allUsers, refreshCourses } = useCourse();
    const [allCourses, setAllCourses] = useState<Course[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [isOpeningEditor, setIsOpeningEditor] = useState(false);

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
        setSelectedCourse(null);
    }
    
    const teacherForSelectedCourse = selectedCourse ? getTeacherForCourse(selectedCourse.teacherId) : null;
    
    const handleEditClick = async () => {
        if(selectedCourse) {
            setIsOpeningEditor(true);
            try {
                await onEditCourse(selectedCourse);
                handleCloseDialog();
            } finally {
                setIsOpeningEditor(false);
            }
        }
    }


    return (
        <>
            <Card className="premium-surface h-full flex flex-col">
                <CardHeader>
                    <CardTitle>Gestión de Cursos</CardTitle>
                    <CardDescription>Visualiza, busca y selecciona un curso para ver más detalles o editarlo.</CardDescription>
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
                                        <TableHead className="text-center">Inscritos</TableHead>
                                        <TableHead className="text-center">Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={5} className="text-center h-24">Cargando cursos...</TableCell></TableRow>
                                    ) : filteredCourses.length > 0 ? (
                                        filteredCourses.map(course => {
                                            const teacher = getTeacherForCourse(course.teacherId);
                                            return (
                                                <TableRow key={course.id} onMouseEnter={() => onPrefetchCourse(course)} onClick={() => setSelectedCourse(course)} className="cursor-pointer">
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
                                        <TableRow><TableCell colSpan={5} className="text-center h-24">No se encontraron cursos.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            </div>
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>
            <Dialog open={!!selectedCourse} onOpenChange={(isOpen) => !isOpen && handleCloseDialog()}>
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
                                    {selectedCourse?.studentProgress && selectedCourse.studentProgress.length > 0 ? (
                                        selectedCourse.studentProgress.map((student: StudentProgress) => {
                                            const progress = student.totalModulesCount > 0 ? (student.completedModulesCount / student.totalModulesCount) * 100 : 0;
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
                                                        {student.dueDate ? format(new Date(student.dueDate), 'dd MMM, yyyy', { locale: es }) : <span className="text-xs text-muted-foreground">-</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {student.finalScore !== undefined ? (
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
                        <Button variant="outline" onClick={handleCloseDialog} disabled={isOpeningEditor}>Cerrar</Button>
                        <Button variant="destructive"><Trash2 className="mr-2"/> Eliminar Curso</Button>
                        <Button onClick={handleEditClick} disabled={isOpeningEditor}>
                            {isOpeningEditor ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Pencil className="mr-2"/>}
                            {isOpeningEditor ? 'Cargando...' : 'Editar Curso'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
