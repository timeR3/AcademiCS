'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, PlusCircle, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Badge } from '@/types';
import { Badge as BadgeUI } from '@/components/ui/badge';
import { BadgeIcon } from '../student/BadgeIcon';
import { BadgeDialog } from './BadgeDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { buttonVariants } from '../ui/button';
import { apiDelete, apiGet } from '@/lib/api-client';

const criteriaText: Record<Badge['criteriaType'], string> = {
    'SCORE': 'Puntuación Mínima',
    'COURSE_COMPLETION': 'Curso Completado',
    'FIRST_PASS': 'Primera Evaluación Aprobada',
    'COURSE_COUNT': 'Nº de Cursos Completados',
    'PERFECT_STREAK': 'Racha de Puntuaciones Perfectas',
    'FIRST_TRY': 'Primer Intento Aprobado',
    'FIRST_COURSE': 'Primer Curso Iniciado',
};

export function BadgesView() {
    const [badges, setBadges] = useState<Badge[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedBadge, setSelectedBadge] = useState<Partial<Badge> | null>(null);
    const [badgeToDelete, setBadgeToDelete] = useState<Badge | null>(null);

    const loadBadges = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedBadges = await apiGet<Badge[]>('/api/badges');
            setBadges(fetchedBadges);
        } catch (error: any) {
            toast({ title: "Error", description: `No se pudieron cargar las insignias: ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadBadges();
    }, [loadBadges]);
    
    const handleOpenDialog = (badge: Partial<Badge> | null = null) => {
        setSelectedBadge(badge);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setSelectedBadge(null);
        setIsDialogOpen(false);
    };

    const handleBadgeSaved = () => {
        loadBadges();
    };

    const handleDelete = async () => {
        if (!badgeToDelete) return;
        
        setIsSaving(true);
        try {
            await apiDelete<{ success: boolean }>(`/api/badges/${encodeURIComponent(badgeToDelete.id)}`);
            toast({
                title: 'Insignia Eliminada',
                description: `La insignia "${badgeToDelete.name}" ha sido eliminada.`,
            });
            setBadges(prev => prev.filter(b => b.id !== badgeToDelete.id));
        } catch (error: any) {
             toast({
                title: 'Error al Eliminar',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
            setBadgeToDelete(null);
        }
    };

    return (
        <>
            <Card className="premium-surface h-full min-w-0 flex flex-col">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Gestión de Insignias</CardTitle>
                        <CardDescription>Crea y edita las insignias que los estudiantes pueden ganar.</CardDescription>
                    </div>
                     <Button onClick={() => handleOpenDialog()}>
                        <PlusCircle className="mr-2" />
                        Crear Insignia
                    </Button>
                </CardHeader>
                <CardContent className="flex-grow">
                    {isLoading ? (
                         <div className="flex justify-center items-center h-40">
                            <Loader2 className="animate-spin h-8 w-8 text-primary" />
                         </div>
                    ) : badges.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {badges.map(badge => (
                                <Card key={badge.id} className="premium-surface flex flex-col">
                                    <CardHeader className="items-center text-center">
                                        <div className="p-4 bg-primary/10 rounded-full mb-2">
                                            <BadgeIcon iconId={badge.iconId} className="h-10 w-10 text-primary" />
                                        </div>
                                        <CardTitle className="font-headline">{badge.name}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex-grow space-y-4 text-center">
                                        <p className="text-muted-foreground text-sm">{badge.description}</p>
                                        <div>
                                            <BadgeUI variant="secondary">
                                                {criteriaText[badge.criteriaType]}
                                                {(badge.criteriaType === 'SCORE' || badge.criteriaType === 'COURSE_COUNT' || badge.criteriaType === 'PERFECT_STREAK') && `: ${badge.criteriaValue}`}
                                            </BadgeUI>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="justify-center border-t pt-4 gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleOpenDialog(badge)}>
                                            <Pencil className="mr-2 h-4 w-4" /> Editar
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={() => setBadgeToDelete(badge)}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-2xl border-2 border-dashed py-12 text-center">
                            <Award className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-medium">No hay insignias creadas</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Crea tu primera insignia para empezar a gamificar la experiencia.</p>
                             <Button className="mt-4" onClick={() => handleOpenDialog()}>
                                <PlusCircle className="mr-2" />
                                Crear Insignia
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <BadgeDialog 
                badge={selectedBadge}
                isOpen={isDialogOpen}
                onClose={handleCloseDialog}
                onBadgeSaved={handleBadgeSaved}
            />

             <AlertDialog open={!!badgeToDelete} onOpenChange={(isOpen) => !isOpen && setBadgeToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro de que quieres eliminar esta insignia?</AlertDialogTitle>
                        <AlertDialogDescription>
                           Esta acción es permanente y eliminará la insignia de todos los usuarios que la hayan ganado. No se puede deshacer.
                           <blockquote className="mt-4 border-l-2 pl-4 italic">
                             {badgeToDelete?.name}
                           </blockquote>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setBadgeToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className={buttonVariants({ variant: "destructive" })}
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Sí, eliminar insignia
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
