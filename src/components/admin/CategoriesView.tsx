'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { CourseCategory } from '@/types';
import { Loader2, PlusCircle, CheckCircle, XCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '../ui/badge';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '../ui/label';

export function CategoriesView() {
    const [categories, setCategories] = useState<CourseCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    // State for creating a new category
    const [newCategoryName, setNewCategoryName] = useState('');
    
    // State for editing a category
    const [editingCategory, setEditingCategory] = useState<CourseCategory | null>(null);
    const [editingName, setEditingName] = useState('');

    const loadCategories = async () => {
        setIsLoading(true);
        try {
            const fetchedCategories = await apiGet<CourseCategory[]>('/api/categories');
            setCategories(fetchedCategories);
        } catch (error: any) {
            toast({ title: 'Error', description: `No se pudieron cargar las categorías: ${error.message}`, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadCategories();
    }, []);

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) {
            toast({ title: 'Error', description: 'El nombre de la categoría no puede estar vacío.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            await apiPost<{ success: boolean; categoryId?: number }>('/api/categories', { name: newCategoryName });
            toast({ title: 'Categoría Creada', description: `La categoría "${newCategoryName}" ha sido creada.` });
            setNewCategoryName('');
            await loadCategories();
        } catch (error: any) {
            toast({ title: 'Error al Crear', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleStatusChange = async (category: CourseCategory, newStatus: boolean) => {
        const status = newStatus ? 'active' : 'inactive';
        if (category.courseCount && category.courseCount > 0 && status === 'inactive') {
            toast({
                title: 'Acción no permitida',
                description: 'No se puede desactivar una categoría que tiene cursos asignados.',
                variant: 'destructive',
            });
            return;
        }
        
        setIsSaving(true);
        try {
            await apiPatch<{ success: boolean }>('/api/categories', { id: category.id, status });
            toast({ title: 'Estado Actualizado', description: `La categoría "${category.name}" ahora está ${status === 'active' ? 'activa' : 'inactiva'}.` });
            await loadCategories();
        } catch (error: any) {
            toast({ title: 'Error al Actualizar', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleEditCategory = (category: CourseCategory) => {
        setEditingCategory(category);
        setEditingName(category.name);
    }
    
    const handleUpdateName = async () => {
        if (!editingCategory || !editingName.trim()) return;
        
        setIsSaving(true);
        try {
            await apiPatch<{ success: boolean }>('/api/categories', { id: editingCategory.id, name: editingName });
            toast({ title: 'Nombre Actualizado', description: `La categoría ha sido renombrada a "${editingName}".` });
            setEditingCategory(null);
            setEditingName('');
            await loadCategories();
        } catch (error: any) {
            toast({ title: 'Error al Renombrar', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <>
            <Card className="premium-surface h-full min-w-0 flex flex-col">
                <CardHeader>
                    <CardTitle>Gestión de Categorías</CardTitle>
                    <CardDescription>Crea nuevas categorías de cursos y gestiona su estado.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col">
                    <div className="mb-6 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:p-5">
                        <Input
                            placeholder="Nombre de la nueva categoría..."
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            className="flex-grow"
                            disabled={isSaving}
                        />
                        <Button onClick={handleCreateCategory} disabled={isSaving || !newCategoryName.trim()}>
                            {isSaving && newCategoryName ? <Loader2 className="mr-2 animate-spin" /> : <PlusCircle className="mr-2" />}
                            Crear Categoría
                        </Button>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border">
                        <Table className="min-w-[560px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre de la Categoría</TableHead>
                                    <TableHead className="text-center">Cursos Usando</TableHead>
                                    <TableHead className="text-center">Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center">Cargando categorías...</TableCell></TableRow>
                                ) : categories.length > 0 ? (
                                    categories.map(category => (
                                        <TableRow key={category.id}>
                                            <TableCell className="font-medium">{category.name}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary">{category.courseCount || 0}</Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={category.status === 'active' ? 'default' : 'destructive'} className="capitalize">
                                                    {category.status === 'active' ? <CheckCircle className="mr-2" /> : <XCircle className="mr-2" />}
                                                    {category.status === 'active' ? 'Activa' : 'Inactiva'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                 <Switch
                                                    checked={category.status === 'active'}
                                                    onCheckedChange={(checked) => handleStatusChange(category, checked)}
                                                    disabled={isSaving || ((category.courseCount ?? 0) > 0 && category.status === 'active')}
                                                    aria-label={`Activar o desactivar la categoría ${category.name}`}
                                                />
                                                <Button variant="outline" size="sm" onClick={() => handleEditCategory(category)} disabled={isSaving}>
                                                    Editar Nombre
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center">No se encontraron categorías.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            
            <Dialog open={!!editingCategory} onOpenChange={(isOpen) => !isOpen && setEditingCategory(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Nombre de Categoría</DialogTitle>
                        <DialogDescription>
                            Estás a punto de cambiar el nombre de la categoría "{editingCategory?.name}".
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label htmlFor="category-name">Nuevo Nombre</Label>
                        <Input
                            id="category-name"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            disabled={isSaving}
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                        <Button onClick={handleUpdateName} disabled={isSaving || !editingName.trim()}>
                            {isSaving && <Loader2 className="mr-2 animate-spin" />}
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
