'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { UserPlus, Search, Save, Loader2, Calendar as CalendarIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCourse } from '@/context/CourseContext';
import type { User, StudentEnrollment } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { apiGet, apiPatch, getFriendlyErrorMessage } from '@/lib/api-client';

export function StudentManagement() {
    const { activeCourse, updateCourse, allUsers } = useCourse();
    const [allPlatformStudents, setAllPlatformStudents] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [enrolledStudents, setEnrolledStudents] = useState<Record<string, { dueDate?: Date | null }>>({});
    const [notifyByEmail, setNotifyByEmail] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        async function loadStudents() {
            setIsLoading(true);
            try {
                if (allUsers.length > 0) {
                    setAllPlatformStudents(allUsers.filter(u => u.roles.includes('student')));
                    return;
                }
                const users = await apiGet<User[]>('/api/users');
                setAllPlatformStudents(users.filter(u => u.roles.includes('student')));
            } catch (error) {
                toast({
                    title: 'No pudimos cargar la lista de estudiantes',
                    description: getFriendlyErrorMessage(error, 'Inténtalo nuevamente en unos segundos.'),
                    variant: 'destructive'
                });
            } finally {
                setIsLoading(false);
            }
        }
        loadStudents();
    }, [toast, allUsers]);

    useEffect(() => {
        if (activeCourse && activeCourse.students) {
            const initialEnrollments = activeCourse.students.reduce((acc, enrollment) => {
                acc[enrollment.studentId] = { dueDate: enrollment.dueDate ? new Date(enrollment.dueDate) : null };
                return acc;
            }, {} as Record<string, { dueDate?: Date | null }>);
            setEnrolledStudents(initialEnrollments);
        }
    }, [activeCourse]);


    const filteredStudents = allPlatformStudents.filter(student => 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const handleSelectStudent = (studentId: string, isSelected: boolean) => {
        const newEnrollments = { ...enrolledStudents };
        if (isSelected) {
            newEnrollments[studentId] = { dueDate: null };
        } else {
            delete newEnrollments[studentId];
        }
        setEnrolledStudents(newEnrollments);
    };

    const handleDateChange = (studentId: string, date: Date | undefined) => {
        if (date) {
            setEnrolledStudents(prev => ({
                ...prev,
                [studentId]: { ...prev[studentId], dueDate: date }
            }));
        }
    };
    
    const handleClearDate = (studentId: string) => {
        setEnrolledStudents(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], dueDate: null }
        }));
    };

    const handleSaveChanges = async () => {
        if (activeCourse) {
            setIsSaving(true);
            try {
                const enrollmentsToSave: StudentEnrollment[] = Object.entries(enrolledStudents).map(([studentId, { dueDate }]) => ({
                    studentId,
                    dueDate,
                }));
                const result = await apiPatch<{ success: boolean; message: string; emailsSent: number }>(`/api/courses/${activeCourse.id}/students`, { 
                    studentEnrollments: enrollmentsToSave,
                    notify: notifyByEmail,
                });
                
                updateCourse({ id: activeCourse.id, students: enrollmentsToSave });
                
                toast({
                    title: 'Éxito',
                    description: result.message,
                    variant: result.message.includes('Error') || result.message.includes('Falta') ? 'destructive' : 'default',
                });

            } catch (error) {
                 toast({
                    title: 'No pudimos guardar los cambios de estudiantes',
                    description: getFriendlyErrorMessage(error, 'Revisa los datos e inténtalo nuevamente.'),
                    variant: 'destructive'
                 });
            } finally {
                setIsSaving(false);
            }
        }
    }

    if (!activeCourse) {
        return (
            <Card className="premium-surface w-full animate-fade-in-up">
                <CardContent className="p-6 text-center">
                    <p>Por favor, selecciona un curso para gestionar a los estudiantes.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="premium-surface w-full min-w-0 animate-fade-in-up">
            <CardHeader>
                <CardTitle className="font-headline text-2xl flex min-w-0 flex-col gap-2 break-words sm:flex-row sm:items-center"><UserPlus className="shrink-0" />Gestionar Estudiantes de "{activeCourse.title}"</CardTitle>
                <CardDescription>Busca y asigna estudiantes de la plataforma a este curso, y establece fechas límite opcionales.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por nombre o correo..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={isSaving || isLoading}
                    />
                </div>
                {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="animate-spin h-8 w-8 text-primary" />
                    </div>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-auto pr-1 sm:pr-2">
                    {(filteredStudents.length > 0 ? filteredStudents : allPlatformStudents).map(student => {
                        const isSelected = !!enrolledStudents[student.id];
                        const dueDate = enrolledStudents[student.id]?.dueDate;

                        return (
                        <div key={student.id} className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-xl border p-3 sm:p-4 gap-3 sm:gap-0", isSelected && "bg-primary/5")}>
                            <div className="flex min-w-0 items-center gap-4 flex-1">
                                 <Checkbox 
                                    checked={isSelected}
                                    onCheckedChange={(checked) => handleSelectStudent(student.id, !!checked)}
                                    aria-label={`Seleccionar a ${student.name}`}
                                    disabled={isSaving}
                                    id={`cb-${student.id}`}
                                />
                                <Avatar>
                                    <AvatarImage src={`https://placehold.co/40x40.png?text=${student.name.substring(0,2)}`} alt={student.name} data-ai-hint="person" />
                                    <AvatarFallback>{student.name.substring(0,2)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <p className="truncate font-medium">{student.name}</p>
                                    <p className="truncate text-sm text-muted-foreground">{student.email}</p>
                                </div>
                            </div>
                           
                            {isSelected && (
                                <div className="flex w-full sm:w-auto items-center gap-2 self-stretch sm:self-center">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full min-w-0 sm:w-[240px] justify-start text-left font-normal",
                                                    !dueDate && "text-muted-foreground",
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {dueDate && isValid(dueDate) ? <span className="truncate">{format(dueDate, "PPP", { locale: es })}</span> : <span className="truncate">Fecha límite (opcional)</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={dueDate || undefined}
                                                onSelect={(date) => handleDateChange(student.id, date)}
                                                initialFocus
                                                locale={es}
                                                disabled={(date) => date < new Date()}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    {dueDate && (
                                         <Button variant="ghost" size="icon" onClick={() => handleClearDate(student.id)} className="text-muted-foreground hover:text-foreground">
                                            <X className="h-4 w-4" />
                                         </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    )})}
                  </div>
                )}
            </CardContent>
            <CardFooter className="flex-col sm:flex-row items-center justify-between border-t pt-6 gap-4">
                 <div className="flex w-full items-start gap-2 sm:w-auto sm:items-center">
                    <Switch 
                        id="notify-students" 
                        checked={notifyByEmail} 
                        onCheckedChange={setNotifyByEmail}
                        disabled={isSaving || isLoading}
                    />
                    <Label htmlFor="notify-students" className="font-normal text-sm leading-snug">Notificar a los estudiantes recién inscritos</Label>
                </div>
                 <Button onClick={handleSaveChanges} disabled={isSaving || isLoading} className="w-full sm:w-auto">
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
            </CardFooter>
        </Card>
    )
}
