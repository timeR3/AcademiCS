'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus, BookOpenCheck, GraduationCap, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { registerUser } from '@/app/actions';
import type { UserRole } from '@/types';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

interface RegisterFormProps {
    onToggleView: () => void;
}

export function RegisterForm({ onToggleView }: RegisterFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
        toast({ title: "Campos incompletos", description: "Por favor, rellena todos los campos.", variant: "destructive" });
        return;
    }
    setIsLoading(true);
    try {
        await registerUser({ name, email, password, role });
        toast({ title: "¡Registro Exitoso!", description: "Tu cuenta ha sido creada. Ahora puedes iniciar sesión." });
        onToggleView(); // Switch back to login view
    } catch(error: any) {
        toast({ title: "Error en el registro", description: error.message || "No se pudo crear tu cuenta. Inténtalo de nuevo.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-2xl animate-fade-in-up">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-headline">Crear una Cuenta</CardTitle>
        <CardDescription>Regístrate para empezar a aprender o enseñar.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre Completo</Label>
            <Input id="name" placeholder="Tu nombre y apellido" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input id="email" type="email" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
           <div className="space-y-2">
                <Label>¿Cuál es tu rol inicial?</Label>
                <RadioGroup defaultValue="student" value={role} onValueChange={(value: string) => setRole(value as UserRole)} className="grid grid-cols-2 gap-4 pt-2">
                    <Label htmlFor="r-student" className="flex items-center gap-2 font-normal cursor-pointer rounded-md border p-3 has-[:checked]:border-primary">
                        <RadioGroupItem value="student" id="r-student" className="sr-only" />
                        <GraduationCap/>Estudiante
                    </Label>
                    <Label htmlFor="r-teacher" className="flex items-center gap-2 font-normal cursor-pointer rounded-md border p-3 has-[:checked]:border-primary">
                         <RadioGroupItem value="teacher" id="r-teacher" className="sr-only"/>
                         <BookOpenCheck />Profesor
                    </Label>
                    {/* An admin would typically be created via a different process, not public registration */}
                </RadioGroup>
           </div>
          <Button variant="link" className="p-0 h-auto font-normal text-sm" onClick={onToggleView}>
            ¿Ya tienes cuenta? Inicia sesión
          </Button>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin"/> : <UserPlus />}
            {isLoading ? 'Registrando...' : 'Crear Cuenta'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
