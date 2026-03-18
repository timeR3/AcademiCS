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
import { saveBadge } from '@/app/actions';
import type { Badge } from '@/types';
import { useState, useEffect } from 'react';
import { Loader2, Save, Award, CheckCircle2, ShieldCheck, Star, Sparkles, BrainCircuit, TrendingUp, Rocket, Compass } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { BadgeIcon } from '../student/BadgeIcon';

interface BadgeDialogProps {
  badge: Partial<Badge> | null;
  isOpen: boolean;
  onClose: () => void;
  onBadgeSaved: () => void;
}

const formSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres.'),
  iconId: z.string().min(1, 'El ID del icono es requerido.'),
  criteriaType: z.enum(['SCORE', 'COURSE_COMPLETION', 'FIRST_PASS', 'COURSE_COUNT', 'PERFECT_STREAK', 'FIRST_TRY', 'FIRST_COURSE']),
  criteriaValue: z.string().optional(),
}).refine(data => {
    if (data.criteriaType === 'SCORE' || data.criteriaType === 'COURSE_COUNT' || data.criteriaType === 'PERFECT_STREAK') {
        return !!data.criteriaValue && !isNaN(Number(data.criteriaValue));
    }
    return true;
}, {
    message: "Se requiere un valor numérico para este tipo de criterio.",
    path: ["criteriaValue"],
});

type FormData = z.infer<typeof formSchema>;

const iconOptions = [
    { id: 'first_pass', label: 'Primeros Pasos', icon: Award },
    { id: 'perfect_score', label: 'Puntuación Perfecta', icon: Star },
    { id: 'course_completion', label: 'Curso Completado', icon: ShieldCheck },
    { id: 'perfect_streak', label: 'Racha de Genio', icon: Sparkles },
    { id: 'course_count', label: 'Aprendiz Constante', icon: BrainCircuit },
    { id: 'course_count_pro', label: 'Sabio de la Tribu', icon: TrendingUp },
    { id: 'first_try', label: 'Velocista', icon: Rocket },
    { id: 'first_course', label: 'Explorador', icon: Compass },
    { id: 'default', label: 'Logro General', icon: CheckCircle2 },
];

export function BadgeDialog({ badge, isOpen, onClose, onBadgeSaved }: BadgeDialogProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      iconId: 'default',
      criteriaType: 'FIRST_PASS',
      criteriaValue: '',
    }
  });

  const criteriaType = watch('criteriaType');
  
  useEffect(() => {
    if (badge && isOpen) {
        reset({
            name: badge.name || '',
            description: badge.description || '',
            iconId: badge.iconId || 'default',
            criteriaType: badge.criteriaType || 'FIRST_PASS',
            criteriaValue: badge.criteriaValue?.toString() || '',
        });
    } else {
        reset({
            name: '',
            description: '',
            iconId: 'default',
            criteriaType: 'FIRST_PASS',
            criteriaValue: '',
        });
    }
  }, [badge, isOpen, reset]);


  const onSubmit = async (data: FormData) => {
    setIsSaving(true);
    try {
      const criteriaValueIsNumeric = data.criteriaType === 'SCORE' || data.criteriaType === 'COURSE_COUNT' || data.criteriaType === 'PERFECT_STREAK';
      await saveBadge({
        id: badge?.id,
        ...data,
        criteriaValue: criteriaValueIsNumeric ? Number(data.criteriaValue) : null,
      });
      toast({
        title: badge?.id ? 'Insignia Actualizada' : 'Insignia Creada',
        description: `La insignia "${data.name}" se ha guardado correctamente.`,
      });
      onBadgeSaved();
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
  
  const getCriteriaValueLabel = () => {
      switch (criteriaType) {
          case 'SCORE': return 'Valor (Puntuación Mínima)';
          case 'COURSE_COUNT': return 'Valor (Nº de Cursos)';
          case 'PERFECT_STREAK': return 'Valor (Nº de Puntuaciones Perfectas)';
          default: return '';
      }
  }


  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{badge?.id ? 'Editar Insignia' : 'Crear Nueva Insignia'}</DialogTitle>
          <DialogDescription>
            Define los detalles de la insignia que los estudiantes pueden ganar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Nombre de la Insignia</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
            </div>
             <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea id="description" {...register('description')} placeholder="Explica cómo se gana esta insignia."/>
                {errors.description && <p className="text-destructive text-sm">{errors.description.message}</p>}
            </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Icono</Label>
                    <Controller
                    name="iconId"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                                <SelectValue asChild>
                                    <span className="flex items-center gap-2">
                                        <BadgeIcon iconId={field.value} className="h-4 w-4" />
                                        {iconOptions.find(i => i.id === field.value)?.label}
                                    </span>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {iconOptions.map(opt => (
                                     <SelectItem value={opt.id} key={opt.id}>
                                        <span className="flex items-center gap-2">
                                            <opt.icon className="h-4 w-4" />
                                            {opt.label}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    />
                    {errors.iconId && <p className="text-destructive text-sm">{errors.iconId.message}</p>}
                </div>
                 <div className="space-y-2">
                    <Label>Tipo de Criterio</Label>
                    <Controller
                    name="criteriaType"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="FIRST_PASS">Primera Evaluación Aprobada</SelectItem>
                                <SelectItem value="COURSE_COMPLETION">Curso Completado</SelectItem>
                                <SelectItem value="SCORE">Puntuación Mínima</SelectItem>
                                <SelectItem value="COURSE_COUNT">Nº de Cursos Completados</SelectItem>
                                <SelectItem value="PERFECT_STREAK">Racha de Puntuaciones Perfectas</SelectItem>
                                <SelectItem value="FIRST_TRY">Primer Intento Aprobado</SelectItem>
                                <SelectItem value="FIRST_COURSE">Primer Curso Iniciado</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                    />
                    {errors.criteriaType && <p className="text-destructive text-sm">{errors.criteriaType.message}</p>}
                </div>
             </div>
             {(criteriaType === 'SCORE' || criteriaType === 'COURSE_COUNT' || criteriaType === 'PERFECT_STREAK') && (
                  <div className="space-y-2">
                    <Label htmlFor="criteriaValue">{getCriteriaValueLabel()}</Label>
                    <Input id="criteriaValue" type="number" {...register('criteriaValue')} placeholder="Ej: 100" />
                    {errors.criteriaValue && <p className="text-destructive text-sm">{errors.criteriaValue.message}</p>}
                </div>
             )}


          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline">
                Cancelar
                </Button>
            </DialogClose>
            <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                Guardar Insignia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
