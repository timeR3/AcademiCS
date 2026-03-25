
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
import { apiPatch } from '@/lib/api-client';
import type { User } from '@/types';
import { Loader2, Save } from 'lucide-react';

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

export function UserProfileDialog({ user, isOpen, onClose, onUserUpdated }: UserProfileDialogProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

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
    }
  }, [user, isOpen, reset]);

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
