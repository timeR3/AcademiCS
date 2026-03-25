'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LoginFormProps {
    onToggleView: () => void;
}

export function LoginForm({ onToggleView }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
        toast({ title: "Campos incompletos", description: "Por favor, introduce tu correo y contraseña.", variant: "destructive" });
        return;
    }
    setIsLoading(true);
    try {
        await login({ email, password });
        toast({ title: '¡Bienvenido de nuevo!' });
    } catch(error: any) {
        console.error(error);
        toast({ title: "Error al iniciar sesión", description: error.message || 'No se pudo iniciar sesión. Verifica tus credenciales.', variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-2xl animate-fade-in-up">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-headline">Bienvenido a AcademiCS</CardTitle>
        <CardDescription>Inicia sesión con tu cuenta</CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input id="email" type="email" placeholder="usuario@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="flex justify-between items-center text-sm mt-4 flex-wrap">
              <Button variant="link" className="p-0 h-auto font-normal text-xs sm:text-sm">
                  Recuperar contraseña
              </Button>
              <Button variant="link" className="p-0 h-auto font-normal text-xs sm:text-sm" onClick={onToggleView}>
                  ¿No tienes cuenta? Regístrate
              </Button>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : <LogIn />}
            {isLoading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
