
'use client';
import { useAuth } from '@/context/AuthContext';
import { AuthView } from '@/components/auth/AuthView';
import TeacherDashboard from '@/components/teacher/TeacherDashboard';
import StudentDashboard from '@/components/student/StudentDashboard';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { AppHeader } from '@/components/shared/AppHeader';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserRole } from '@/types';
import { GraduationCap, BookOpenCheck, ShieldCheck } from 'lucide-react';
import { useRole } from '@/context/RoleContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { MainSidebar } from '@/components/shared/MainSidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SeasonalBanner } from '@/components/shared/SeasonalBanner';

const roleConfig: Record<UserRole, { name: string, icon: React.ElementType }> = {
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
  }
  
  if (!activeRole) {
      return (
        <div className="flex min-h-screen items-center justify-center">
            <p>Cargando rol de usuario...</p>
        </div>
      );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background flex">
        <MainSidebar />
        <div className="flex-1 flex flex-col relative">
          <SeasonalBanner />
          <AppHeader />
          <main className="p-4 sm:p-6 md:p-8 flex-1 flex flex-col h-full">
            <div className="mx-auto w-full h-full max-w-none flex flex-col">
              {sortedRoles.length > 1 && (
                  <Tabs value={activeRole} onValueChange={(value) => setActiveRole(value as UserRole)} className="w-full mb-6">
                    <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                      <TooltipProvider>
                      {sortedRoles.map(role => {
                        const config = roleConfig[role];
                        return (
                          <Tooltip key={role}>
                            <TooltipTrigger asChild>
                              <TabsTrigger value={role} className="w-full">
                                <config.icon className="h-5 w-5 mr-2"/>
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
              {renderDashboardByRole(activeRole)}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function Home() {
  return (
    <AppContent />
  );
}
