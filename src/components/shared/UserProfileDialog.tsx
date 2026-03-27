
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { apiGet, apiPatch } from '@/lib/api-client';
import type { NotificationPreferences, NotificationPreferenceType, User } from '@/types';
import { Loader2, Save } from 'lucide-react';
import { Switch } from '../ui/switch';

interface UserProfileDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (updatedData: Partial<User> & { passwordChanged?: boolean }) => void;
}

const formSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  password: z.string().optional(),
}).refine(data => data.name || data.password, {
  message: 'Debes proporcionar un nombre o una nueva contraseña.',
  path: ['name'],
});

type FormData = z.infer<typeof formSchema>;

const notificationPreferenceDefinitions: Array<{ key: NotificationPreferenceType; label: string; description: string }> = [
  { key: 'course_enrollment', label: 'Inscripción a curso', description: 'Recibe aviso cuando te inscriben a un curso.' },
  { key: 'course_due_soon', label: 'Vencimiento próximo', description: 'Recibe recordatorio cuando un curso está por vencer.' },
  { key: 'course_due_expired', label: 'Curso vencido', description: 'Recibe aviso cuando un curso ya venció.' },
  { key: 'inactivity_reminder', label: 'Inactividad', description: 'Recibe recordatorio por falta de actividad.' },
  { key: 'course_updated', label: 'Actualización de curso', description: 'Recibe aviso por cambios del curso.' },
  { key: 'course_status_change', label: 'Cambio de estado', description: 'Recibe aviso si el curso se suspende, reactiva o archiva.' },
  { key: 'course_due_date_changed', label: 'Cambio de fecha límite', description: 'Recibe aviso cuando cambia la fecha límite de tu curso.' },
  { key: 'evaluation_result', label: 'Resultado de evaluación', description: 'Recibe aviso al calificar una evaluación.' },
  { key: 'module_unlocked', label: 'Módulo desbloqueado', description: 'Recibe aviso cuando desbloqueas el siguiente módulo.' },
  { key: 'course_completed', label: 'Curso completado', description: 'Recibe aviso al completar un curso.' },
];

const defaultNotificationPreferences = (): NotificationPreferences => (
  notificationPreferenceDefinitions.reduce((acc, item) => {
    acc[item.key] = true;
    return acc;
  }, {} as NotificationPreferences)
);

export function UserProfileDialog({ user, isOpen, onClose, onUserUpdated }: UserProfileDialogProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (user && isOpen) {
      reset({
        name: user.name,
        password: '',
      });
      apiGet<NotificationPreferences>(`/api/users/${user.id}/notification-preferences`)
        .then((response) => setPreferences(response))
        .catch(() => {
          setPreferences(null);
        });
    }
  }, [user, isOpen, reset]);

  const handlePreferenceToggle = async (key: NotificationPreferenceType, enabled: boolean) => {
    if (!user) return;
    setIsSavingPreferences(true);
    try {
      await apiPatch<{ success: boolean }>(`/api/users/${user.id}/notification-preferences`, { [key]: enabled });
      setPreferences((current) => {
        if (!current) return current;
        return {
          ...current,
          [key]: enabled,
        };
      });
      toast({
        title: 'Preferencia actualizada',
        description: 'La configuración de notificaciones fue guardada.',
      });
    } catch (error: any) {
      toast({
        title: 'Error al actualizar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleResetPreferences = async () => {
    if (!user) return;
    setIsSavingPreferences(true);
    try {
      const defaults = defaultNotificationPreferences();
      await apiPatch<{ success: boolean }>(`/api/users/${user.id}/notification-preferences`, defaults);
      setPreferences(defaults);
      toast({
        title: 'Preferencias restablecidas',
        description: 'Se restauraron las notificaciones a su valor predeterminado.',
      });
    } catch (error: any) {
      toast({
        title: 'Error al restablecer',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    const passwordChanged = !!data.password;
    setIsSaving(true);
    try {
      await apiPatch<{ success: boolean }>(`/api/users/${user.id}/profile`, {
        name: data.name,
        password: data.password || undefined,
      });

      if (passwordChanged) {
        // Notify the parent that the password changed, so it can handle the logout flow.
        onUserUpdated({ passwordChanged: true });
      } else {
        toast({
          title: 'Perfil Actualizado',
          description: 'Tu nombre se ha guardado correctamente.',
        });
        onUserUpdated({ name: data.name });
        onClose();
      }
    } catch (error: any) {
      toast({
        title: 'Error al actualizar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (!isOpen || !user) return null;

  return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Mi Perfil</DialogTitle>
            <DialogDescription>
              Actualiza tu nombre o cambia tu contraseña.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email-profile">Correo Electrónico</Label>
              <Input id="email-profile" type="email" value={user.email} disabled />
              <p className="text-xs text-muted-foreground">El correo electrónico no se puede cambiar.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name-profile">Nombre Completo</Label>
              <Input id="name-profile" {...register('name')} />
              {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password-profile">Nueva Contraseña (Opcional)</Label>
              <Input id="password-profile" type="password" {...register('password')} placeholder="Dejar en blanco para no cambiar" />
              {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
            </div>
            <div className="space-y-3 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Notificaciones personales</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleResetPreferences} disabled={isSavingPreferences}>
                  Restablecer
                </Button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {notificationPreferenceDefinitions.map((item) => (
                  <div key={item.key} className="flex items-start justify-between gap-3 rounded-2xl border p-3">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch
                      checked={preferences?.[item.key] ?? true}
                      disabled={isSavingPreferences}
                      onCheckedChange={(enabled) => handlePreferenceToggle(item.key, enabled)}
                    />
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSaving || !isDirty}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
  );
}
