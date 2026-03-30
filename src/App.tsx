import { useEffect, useRef, useState, type ElementType } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CourseProvider } from '@/context/CourseContext';
import { RoleProvider, useRole } from '@/context/RoleContext';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { AuthView } from '@/components/auth/AuthView';
import TeacherDashboard from '@/components/teacher/TeacherDashboard';
import StudentDashboard from '@/components/student/StudentDashboard';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { AppHeader } from '@/components/shared/AppHeader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserRole } from '@/types';
import { GraduationCap, BookOpenCheck, ShieldCheck, ChevronUp } from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { MainSidebar } from '@/components/shared/MainSidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SeasonalBanner } from '@/components/shared/SeasonalBanner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const roleConfig: Record<UserRole, { name: string; icon: ElementType }> = {
  teacher: { name: 'Profesor', icon: BookOpenCheck },
  student: { name: 'Estudiante', icon: GraduationCap },
  admin: { name: 'Administrador', icon: ShieldCheck },
};

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const { activeRole, setActiveRole, sortedRoles } = useRole();
  const pageMainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const getScrollableCandidates = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          'main, [data-sidebar="content"], [data-radix-scroll-area-viewport], .overflow-auto, .overflow-y-auto, .overflow-scroll, .overflow-y-scroll, [class*="overflow-y-auto"], [class*="overflow-auto"], [class*="overflow-y-scroll"], [class*="overflow-scroll"]'
        )
      );

    const updateVisibility = () => {
      return getScrollableCandidates();
    };
    const handleScroll = () => updateVisibility();
    const container = pageMainRef.current;
    updateVisibility();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    document.addEventListener('scroll', handleScroll, true);
    container?.addEventListener('scroll', handleScroll, { passive: true });
    const intervalId = window.setInterval(updateVisibility, 600);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      document.removeEventListener('scroll', handleScroll, true);
      container?.removeEventListener('scroll', handleScroll);
      window.clearInterval(intervalId);
    };
  }, [activeRole]);

  if (!isAuthenticated || !user) {
    return <AuthView />;
  }

  const renderDashboardByRole = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <AdminDashboard />;
      case 'teacher':
        return <TeacherDashboard />;
      case 'student':
        return <StudentDashboard />;
      default:
        return null;
    }
  };

  if (!activeRole) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Cargando rol de usuario...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
        <MainSidebar />
        <div className="flex-1 min-w-0 flex flex-col relative">
          <SeasonalBanner />
          <AppHeader />
          <main ref={pageMainRef} className="premium-page flex-1 min-w-0 flex flex-col h-full">
            <div className="w-full h-full min-w-0 flex flex-col gap-6">
              {sortedRoles.length > 1 && (
                <Tabs value={activeRole} onValueChange={(value) => setActiveRole(value as UserRole)} className="w-full mb-4 sm:mb-6">
                  <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl bg-muted/70 p-1.5 sm:grid-cols-2 md:grid-cols-3">
                    <TooltipProvider>
                      {sortedRoles.map((role) => {
                        const config = roleConfig[role];
                        const isActiveRole = role === activeRole;
                        return (
                          <Tooltip key={role}>
                            <TooltipTrigger asChild>
                              <TabsTrigger
                                value={role}
                                className={cn(
                                  'w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors duration-200',
                                  isActiveRole
                                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                    : 'border-border bg-background text-foreground hover:border-primary/30 hover:bg-muted/60'
                                )}
                              >
                                <config.icon className="h-5 w-5 mr-2" />
                                {config.name}
                              </TabsTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Cambiar a rol de {config.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                  </TabsList>
                </Tabs>
              )}
              <div className="min-h-[60vh] min-w-0">
                {renderDashboardByRole(activeRole)}
              </div>
            </div>
          </main>
          <Button
            type="button"
            size="icon"
            className="fixed bottom-8 right-6 z-[2147483647] h-12 w-12 rounded-full border border-primary/30 bg-primary text-primary-foreground shadow-lg"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              (document.scrollingElement as HTMLElement | null)?.scrollTo({ top: 0, behavior: 'smooth' });
              pageMainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              const candidates = document.querySelectorAll<HTMLElement>(
                'main, [data-sidebar="content"], [data-radix-scroll-area-viewport], .overflow-auto, .overflow-y-auto, .overflow-scroll, .overflow-y-scroll, [class*="overflow-y-auto"], [class*="overflow-auto"], [class*="overflow-y-scroll"], [class*="overflow-scroll"]'
              );
              candidates.forEach((candidate) => {
                candidate.scrollTo({ top: 0, behavior: 'smooth' });
              });
            }}
            aria-label="Subir al inicio"
            title="Subir"
          >
            <ChevronUp className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <RoleProvider>
          <CourseProvider>
            <AppContent />
          </CourseProvider>
        </RoleProvider>
      </AuthProvider>
      <Toaster />
    </ThemeProvider>
  );
}
