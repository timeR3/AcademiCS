import type { ElementType } from 'react';
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
import { GraduationCap, BookOpenCheck, ShieldCheck } from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { MainSidebar } from '@/components/shared/MainSidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SeasonalBanner } from '@/components/shared/SeasonalBanner';

const roleConfig: Record<UserRole, { name: string; icon: ElementType }> = {
  teacher: { name: 'Profesor', icon: BookOpenCheck },
  student: { name: 'Estudiante', icon: GraduationCap },
  admin: { name: 'Administrador', icon: ShieldCheck },
};

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const { activeRole, setActiveRole, sortedRoles } = useRole();

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
          <main className="premium-page flex-1 min-w-0 flex flex-col h-full">
            <div className="w-full h-full min-w-0 flex flex-col gap-6">
              {sortedRoles.length > 1 && (
                <Tabs value={activeRole} onValueChange={(value) => setActiveRole(value as UserRole)} className="w-full mb-4 sm:mb-6">
                  <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl bg-muted/70 p-1.5 sm:grid-cols-2 md:grid-cols-3">
                    <TooltipProvider>
                      {sortedRoles.map((role) => {
                        const config = roleConfig[role];
                        return (
                          <Tooltip key={role}>
                            <TooltipTrigger asChild>
                              <TabsTrigger value={role} className="w-full rounded-xl border border-transparent px-3 py-2.5 text-sm font-semibold text-foreground/80 data-[state=active]:border-primary/20 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
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
