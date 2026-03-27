

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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import type { NotificationPreferenceType, NotificationPreferences, User, Role, UserRole } from '@/types';
import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Switch } from '../ui/switch';
import { apiGet, apiPatch } from '@/lib/api-client';

interface UserEditDialogProps {
  user: User | null;
  allRoles: Role[];
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
}

const formSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido.'),
  email: z.string().email('El correo electrónico no es válido.'),
  password: z.string().optional(),
  roles: z.array(z.string()).min(1, 'El usuario debe tener al menos un rol.'),
  status: z.enum(['active', 'inactive']),
});

type FormData = z.infer<typeof formSchema>;

const notificationPreferenceDefinitions: Array<{ key: NotificationPreferenceType; label: string }> = [
  { key: 'course_enrollment', label: 'Inscripción a curso' },
  { key: 'course_due_soon', label: 'Vencimiento próximo' },
  { key: 'course_due_expired', label: 'Curso vencido' },
  { key: 'inactivity_reminder', label: 'Inactividad' },
  { key: 'course_updated', label: 'Actualización de curso' },
  { key: 'course_status_change', label: 'Cambio de estado del curso' },
  { key: 'course_due_date_changed', label: 'Cambio de fecha límite' },
  { key: 'evaluation_result', label: 'Resultado de evaluación' },
  { key: 'module_unlocked', label: 'Módulo desbloqueado' },
  { key: 'course_completed', label: 'Curso completado' },
];

const defaultNotificationPreferences = (): NotificationPreferences => (
  notificationPreferenceDefinitions.reduce((acc, item) => {
    acc[item.key] = true;
    return acc;
  }, {} as NotificationPreferences)
);

export function UserEditDialog({ user, allRoles, isOpen, onClose, onUserUpdated }: UserEditDialogProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });
  
  useEffect(() => {
    if (user && isOpen) {
        reset({
            name: user.name,
            email: user.email,
            password: '',
            roles: user.roles,
            status: user.status,
        });
        apiGet<NotificationPreferences>(`/api/users/${user.id}/notification-preferences`)
          .then((response) => setPreferences(response))
          .catch(() => setPreferences(null));
    }
  }, [user, isOpen, reset]);


  const onSubmit = async (data: FormData) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await apiPatch<{ success: boolean }>(`/api/users/${encodeURIComponent(user.id)}`, {
        name: data.name,
        email: data.email,
        password: data.password ? data.password : undefined,
        roles: data.roles as UserRole[],
        status: data.status,
      });
      toast({
        title: 'Usuario Actualizado',
        description: `Los datos de ${data.name} se han guardado correctamente.`,
      });
      onUserUpdated();
      onClose();
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

  const handlePreferenceToggle = async (key: NotificationPreferenceType, enabled: boolean) => {
    if (!user) return;
    setIsSavingPreferences(true);
    try {
      await apiPatch<{ success: boolean }>(`/api/users/${user.id}/notification-preferences`, { [key]: enabled });
      setPreferences((current) => {
        if (!current) return current;
        return { ...current, [key]: enabled };
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
        description: 'Las notificaciones del usuario fueron restablecidas.',
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

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Editar Usuario: {user.name}</DialogTitle>
          <DialogDescription>
            Modifica los datos del usuario. El cambio de contraseña es opcional.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label htmlFor="name">Nombre Completo</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input id="email" type="email" {...register('email')} />
                {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
              </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="password">Nueva Contraseña (Opcional)</Label>
                <Input id="password" type="password" {...register('password')} placeholder="Dejar en blanco para no cambiar"/>
                {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
            </div>
             <div className="space-y-2">
                <Label>Estado de la Cuenta</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona un estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="inactive">Inactivo</SelectItem>
                        </SelectContent>
                    </Select>
                  )}
                />
                 {errors.status && <p className="text-destructive text-sm">{errors.status.message}</p>}
            </div>
          </div>
          
          <Separator />

          <div className="space-y-4">
            <Label className="font-semibold">Roles del Usuario</Label>
            <Controller
                name="roles"
                control={control}
                render={({ field }) => (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {allRoles.map(role => (
                        <div key={role.id} className="flex items-center space-x-2">
                        <Checkbox
                            id={`role-${role.id}`}
                            checked={field.value?.includes(role.name)}
                            onCheckedChange={checked => {
                            const newRoles = checked
                                ? [...(field.value || []), role.name]
                                : (field.value || []).filter(value => value !== role.name);
                            field.onChange(newRoles);
                            }}
                        />
                        <label
                            htmlFor={`role-${role.id}`}
                            className="text-sm font-medium leading-none capitalize peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            {role.name}
                        </label>
                        </div>
                    ))}
                    </div>
                )}
            />
            {errors.roles && <p className="text-destructive text-sm">{errors.roles.message}</p>}
          </div>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Label className="font-semibold">Notificaciones del Usuario</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleResetPreferences} disabled={isSavingPreferences}>
                Restablecer
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {notificationPreferenceDefinitions.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-2xl border p-3">
                  <p className="text-sm">{item.label}</p>
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
            <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
