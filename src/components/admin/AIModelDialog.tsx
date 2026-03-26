'use client';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { AiModel } from '@/types';
import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { apiPost } from '@/lib/api-client';

interface AIModelDialogProps {
  model: Partial<AiModel> | null;
  isOpen: boolean;
  onClose: () => void;
  onModelSaved: () => void;
}

const formSchema = z.object({
  id: z.string().min(1, 'El identificador es requerido.'),
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  pricingInput: z.string().min(1, 'El precio de entrada es requerido.'),
  pricingOutput: z.string().min(1, 'El precio de salida es requerido.'),
  status: z.enum(['active', 'inactive']),
});

type FormData = z.infer<typeof formSchema>;

export function AIModelDialog({ model, isOpen, onClose, onModelSaved }: AIModelDialogProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!model?.id;

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: '',
      name: '',
      pricingInput: '',
      pricingOutput: '',
      status: 'active',
    }
  });
  
  useEffect(() => {
    if (model && isOpen) {
        reset({
            id: model.id || '',
            name: model.name || '',
            pricingInput: model.pricingInput || '',
            pricingOutput: model.pricingOutput || '',
            status: model.status || 'active',
        });
    } else {
        reset({
            id: '',
            name: '',
            pricingInput: '$0.00 / 1M tokens',
            pricingOutput: '$0.00 / 1M tokens',
            status: 'active',
        });
    }
  }, [model, isOpen, reset]);


  const onSubmit = async (data: FormData) => {
    setIsSaving(true);
    try {
      await apiPost<{ success: boolean }>('/api/ai-models', data);
      toast({
        title: isEditing ? 'Modelo Actualizado' : 'Modelo Creado',
        description: `El modelo "${data.name}" se ha guardado correctamente.`,
      });
      onModelSaved();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error al guardar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Modelo de IA' : 'Crear Nuevo Modelo de IA'}</DialogTitle>
          <DialogDescription>
            Define los detalles del modelo que se podrá usar en la plataforma.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Nombre para Mostrar</Label>
                <Input id="name" {...register('name')} placeholder="Ej: OpenAI GPT-4o Mini" />
                {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
            </div>
             <div className="space-y-2">
                <Label htmlFor="id">Identificador del Modelo (ID de API)</Label>
                <Input id="id" {...register('id')} placeholder="ej: gpt-4o-mini" disabled={isEditing} />
                {errors.id && <p className="text-destructive text-sm">{errors.id.message}</p>}
                 <p className="text-xs text-muted-foreground">Este debe ser el ID exacto que usa la API de OpenAI. No se puede cambiar después de crear.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="pricingInput">Precio de Entrada</Label>
                    <Input id="pricingInput" {...register('pricingInput')} placeholder="$X.XX / 1M tokens" />
                    {errors.pricingInput && <p className="text-destructive text-sm">{errors.pricingInput.message}</p>}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="pricingOutput">Precio de Salida</Label>
                    <Input id="pricingOutput" {...register('pricingOutput')} placeholder="$Y.YY / 1M tokens" />
                    {errors.pricingOutput && <p className="text-destructive text-sm">{errors.pricingOutput.message}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <Label>Estado</Label>
                 <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="inactive">Inactivo</SelectItem>
                        </SelectContent>
                    </Select>
                  )}
                />
            </div>
          
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <DialogClose asChild>
                <Button type="button" variant="outline">
                Cancelar
                </Button>
            </DialogClose>
            <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                Guardar Modelo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
