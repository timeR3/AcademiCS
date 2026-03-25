'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { AiModel } from '@/types';
import { Loader2, PlusCircle, Trash2, Pencil, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { AIModelDialog } from './AIModelDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '../ui/button';
import { apiDelete, apiGet } from '@/lib/api-client';


export function AIModelsView() {
    const [models, setModels] = useState<AiModel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    // Dialog states
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedModel, setSelectedModel] = useState<Partial<AiModel> | null>(null);
    const [modelToDelete, setModelToDelete] = useState<AiModel | null>(null);

    const loadModels = async () => {
        setIsLoading(true);
        try {
            const fetchedModels = await apiGet<AiModel[]>('/api/ai-models');
            setModels(fetchedModels);
        } catch (error: any) {
            toast({ title: 'Error', description: `No se pudieron cargar los modelos: ${error.message}`, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadModels();
    }, []);

    const handleOpenDialog = (model: Partial<AiModel> | null = null) => {
        setSelectedModel(model);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setSelectedModel(null);
        setIsDialogOpen(false);
    };

    const handleModelSaved = () => {
        loadModels();
    };

    const handleDelete = async () => {
        if (!modelToDelete) return;
        
        setIsSaving(true);
        try {
            await apiDelete<{ success: boolean }>(`/api/ai-models/${encodeURIComponent(modelToDelete.id)}`);
            toast({
                title: 'Modelo Eliminado',
                description: `El modelo "${modelToDelete.name}" ha sido eliminado.`,
            });
            setModels(prev => prev.filter(m => m.id !== modelToDelete.id));
        } catch (error: any) {
             toast({
                title: 'Error al Eliminar',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
            setModelToDelete(null);
        }
    };

    return (
        <>
            <Card className="premium-surface h-full flex flex-col">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Gestión de Modelos de IA</CardTitle>
                        <CardDescription>Añade, edita y gestiona los modelos de IA disponibles en la plataforma.</CardDescription>
                    </div>
                     <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
                        <PlusCircle className="mr-2" />
                        Crear Modelo
                    </Button>
                </CardHeader>
                <CardContent className="flex-grow">
                     <div className="overflow-x-auto rounded-xl border">
                        <Table className="min-w-[600px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre del Modelo</TableHead>
                                    <TableHead className="hidden lg:table-cell">Identificador (API)</TableHead>
                                    <TableHead className="hidden md:table-cell">Precio (Input / Output)</TableHead>
                                    <TableHead className="text-center">Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">Cargando modelos...</TableCell></TableRow>
                                ) : models.length > 0 ? (
                                    models.map(model => (
                                        <TableRow key={model.id}>
                                            <TableCell className="font-medium">{model.name}</TableCell>
                                            <TableCell className="hidden lg:table-cell font-mono text-xs">{model.id}</TableCell>
                                            <TableCell className="hidden md:table-cell text-xs">
                                                <div>{model.pricingInput}</div>
                                                <div>{model.pricingOutput}</div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={model.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                                                    {model.status === 'active' ? <CheckCircle className="mr-2" /> : <XCircle className="mr-2" />}
                                                    {model.status === 'active' ? 'Activo' : 'Inactivo'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right whitespace-nowrap space-x-2">
                                                <Button variant="outline" size="sm" onClick={() => handleOpenDialog(model)} disabled={isSaving} className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3">
                                                    <Pencil className="h-4 w-4 sm:mr-2" />
                                                    <span className="hidden sm:inline">Editar</span>
                                                </Button>
                                                <Button variant="destructive" size="sm" onClick={() => setModelToDelete(model)} disabled={isSaving} className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3">
                                                    <Trash2 className="h-4 w-4 sm:mr-2" />
                                                    <span className="hidden sm:inline">Eliminar</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center">No se encontraron modelos de IA.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AIModelDialog 
                model={selectedModel}
                isOpen={isDialogOpen}
                onClose={handleCloseDialog}
                onModelSaved={handleModelSaved}
            />

             <AlertDialog open={!!modelToDelete} onOpenChange={(isOpen) => !isOpen && setModelToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro de que quieres eliminar este modelo?</AlertDialogTitle>
                        <AlertDialogDescription>
                           Esta acción es permanente. Si el modelo está siendo usado como predeterminado, asegúrate de seleccionar otro.
                           <blockquote className="mt-4 border-l-2 pl-4 italic">
                             {modelToDelete?.name} ({modelToDelete?.id})
                           </blockquote>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setModelToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className={buttonVariants({ variant: "destructive" })}
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Sí, eliminar modelo
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
