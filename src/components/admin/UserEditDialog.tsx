

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
import type { User, Role, UserRole } from '@/types';
import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { apiPatch } from '@/lib/api-client';

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

export function UserEditDialog({ user, allRoles, isOpen, onClose, onUserUpdated }: UserEditDialogProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

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
