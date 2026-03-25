'use client';
import { useRole } from '@/context/RoleContext';
import { useCourse } from '@/context/CourseContext';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar, SidebarPin } from '../ui/sidebar';
import { School, LayoutDashboard, BookOpen, Users, Bot, GraduationCap, PlusCircle, Menu, Award, FolderKanban, Settings } from 'lucide-react';
import { Button } from '../ui/button';


export function MainSidebar() {
    const { activeRole } = useRole();
    const { toggleSidebar } = useSidebar();
    
    const renderSidebarContent = () => {
        switch(activeRole) {
            case 'admin':
                return <AdminSidebar />;
            case 'teacher':
                return <TeacherSidebar />;
            case 'student':
                return <StudentSidebar />;
            default:
                return null;
        }
    }
    
    return (
        <Sidebar>
            <SidebarHeader>
                <div className="flex items-center justify-between w-full">
                    <SidebarMenuButton
                        onClick={toggleSidebar}
                        className="hidden md:flex"
                    >
                        <Menu />
                        <span className="sr-only">Menú</span>
                    </SidebarMenuButton>
                    <div className="group-data-[collapsible=icon]:hidden">
                      <SidebarPin />
                    </div>
                 </div>
            </SidebarHeader>
            <SidebarContent>
                {renderSidebarContent()}
            </SidebarContent>
        </Sidebar>
    );
}

function AdminSidebar() {
    const { adminView, setAdminView } = useCourse();
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setAdminView('analytics')} isActive={adminView === 'analytics'}>
                    <LayoutDashboard />
                    <span>Estadísticas</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setAdminView('courses')} isActive={adminView === 'courses' || adminView === 'edit-course'}>
                    <BookOpen />
                    <span>Cursos</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setAdminView('users')} isActive={adminView === 'users'}>
                    <Users />
                    <span>Usuarios</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setAdminView('settings')} isActive={adminView === 'settings'}>
                    <Settings />
                    <span>Configuraciones</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

function TeacherSidebar() {
    const { teacherView, setTeacherView, setActiveCourseId } = useCourse();

    const handleNavigate = (view: typeof teacherView) => {
        setActiveCourseId(null);
        setTeacherView(view);
    }
    return (
         <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => handleNavigate('dashboard')} isActive={teacherView === 'dashboard' || teacherView === 'overview' || teacherView === 'students'}>
                    <LayoutDashboard />
                    <span>Mis Cursos</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => handleNavigate('create')} isActive={teacherView === 'create'}>
                    <PlusCircle />
                    <span>Crear Curso</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

function StudentSidebar() {
    const { studentView, setStudentView, setActiveCourseId } = useCourse();
    return (
         <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => { setStudentView('dashboard'); setActiveCourseId(null); }} isActive={studentView === 'dashboard'}>
                    <GraduationCap />
                    <span>Mis Cursos</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
