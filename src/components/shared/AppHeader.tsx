
'use client';

import { useAuth } from '@/context/AuthContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { LogOut, ShieldCheck, Bell, Menu, School, UserCircle, CheckCircle2 } from 'lucide-react';
import type { UserRole, Notification, User } from '@/types';
import { SidebarTrigger, useSidebar } from '../ui/sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '@/lib/api-client';
import { Badge } from '../ui/badge';
import { ThemeToggle } from './ThemeToggle';
import { UserProfileDialog } from './UserProfileDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


function NotificationBell() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const loadNotifications = async () => {
        if (!user) return;
        try {
            const fetchedNotifications = await apiGet<Notification[]>(`/api/users/${user.id}/notifications`);
            setNotifications(fetchedNotifications);
            setUnreadCount(fetchedNotifications.filter(n => !n.isRead).length);
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        }
    };

    useEffect(() => {
        loadNotifications();
        // Optional: poll for new notifications every minute
        const interval = setInterval(loadNotifications, 60000);
        return () => clearInterval(interval);
    }, [user]);

    const handleOpenChange = async (isOpen: boolean) => {
        if (!isOpen && unreadCount > 0 && user) {
            const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
            try {
                await apiPatch<{ success: boolean }>(`/api/users/${user.id}/notifications/read`, { notificationIds: unreadIds });
                setUnreadCount(0);
                 // We can also update the local state to reflect the change instantly
                setNotifications(current => current.map(n => ({ ...n, isRead: true })));
            } catch (error) {
                console.error("Failed to mark notifications as read", error);
            }
        }
    };

    return (
        <DropdownMenu onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hover:text-primary">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 rounded-full">
                            {unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-80">
                <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length > 0 ? (
                    notifications.map(n => (
                        <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 whitespace-normal">
                           <p className="font-bold">{n.title}</p>
                           <p className="text-xs text-muted-foreground">{n.description}</p>
                        </DropdownMenuItem>
                    ))
                ) : (
                    <p className="p-2 text-sm text-muted-foreground">No tienes notificaciones.</p>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}


export function AppHeader() {
  const { user, logout, updateUser: updateUserInContext } = useAuth();
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [showPasswordChangedAlert, setShowPasswordChangedAlert] = useState(false);

  const handleUserUpdate = (updatedData: Partial<User> & { passwordChanged?: boolean }) => {
    if (updatedData.passwordChanged) {
        setIsProfileDialogOpen(false);
        setShowPasswordChangedAlert(true);
    } else {
        updateUserInContext(updatedData);
    }
  };

  const handleLogoutAndCloseAlert = () => {
    logout();
  }
  
  return (
    <>
    <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-card px-3 py-2 sm:px-4 sm:py-3 md:px-5 md:py-4 shadow-sm bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2 md:gap-3">
        <SidebarTrigger className="md:hidden" />
        <div className="flex items-center gap-2">
            <School className="h-8 w-8 text-primary" />
            <h1 className="text-lg md:text-xl font-bold font-headline text-primary hidden sm:block">AcademiCS</h1>
        </div>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
         {user?.roles.includes('admin') && (
            <div className="hidden sm:flex items-center gap-2 text-sm font-semibold text-primary">
                <ShieldCheck className="h-5 w-5" />
                <span>Modo Administrador</span>
            </div>
        )}
        <span className="hidden text-sm text-muted-foreground sm:inline">Bienvenido, {user?.name?.split(' ')[0]}</span>
        <ThemeToggle />
        <NotificationBell />

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                 <Button variant="ghost" size="icon" className="hover:text-primary">
                    <UserCircle className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsProfileDialogOpen(true)}>
                    Mi Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    <UserProfileDialog
        isOpen={isProfileDialogOpen}
        onClose={() => setIsProfileDialogOpen(false)}
        user={user}
        onUserUpdated={handleUserUpdate}
    />
     <AlertDialog open={showPasswordChangedAlert} onOpenChange={(isOpen) => { if (!isOpen) setShowPasswordChangedAlert(false); }}>
          <AlertDialogContent>
              <AlertDialogHeader className="items-center text-center">
                   <CheckCircle2 className="h-16 w-16 text-secondary mb-4" />
                  <AlertDialogTitle className="text-2xl font-headline">¡Contraseña Actualizada!</AlertDialogTitle>
                  <AlertDialogDescription>
                      Por tu seguridad, hemos cerrado tu sesión. Por favor, vuelve a iniciar sesión con tu nueva contraseña.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogAction
                      onClick={handleLogoutAndCloseAlert}
                      className={buttonVariants({ className: 'w-full' })}
                  >
                      Entendido
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
