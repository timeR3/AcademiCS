'use client';
import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export function AuthView() {
  const [view, setView] = useState<'login' | 'register'>('login');

  const toggleView = () => {
    setView(v => v === 'login' ? 'register' : 'login');
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
        {view === 'login' ? <LoginForm onToggleView={toggleView} /> : <RegisterForm onToggleView={toggleView} />}
    </div>
  );
}
