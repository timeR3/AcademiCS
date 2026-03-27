'use client';
import { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import type { User, UserRole, Role } from '@/types';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Search } from 'lucide-react';
import { useCourse } from '@/context/CourseContext';
import { UserEditDialog } from './UserEditDialog';
import { apiGet } from '@/lib/api-client';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const roleVariant: Record<UserRole, 'default' | 'secondary' | 'destructive'> = {
    admin: 'destructive',
    teacher: 'default',
    student: 'secondary'
};

const roleNames: Record<UserRole, string> = {
    admin: 'Admin',
    teacher: 'Profesor',
    student: 'Estudiante'
};

export function UsersView() {
    const { allUsers, refreshCourses } = useCourse();
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [allRoles, setAllRoles] = useState<Role[]>([]);
    const rolesLoadedRef = useRef(false);

    useEffect(() => {
        setLoading(allUsers.length === 0);
        async function loadRoles() {
            if (rolesLoadedRef.current) {
                return;
            }
            try {
                const roles = await apiGet<Role[]>('/api/roles');
                setAllRoles(roles);
                rolesLoadedRef.current = true;
            } catch (error) {
                console.error("Failed to fetch roles", error);
            }
        }
        loadRoles();
    }, [allUsers]);

    const filteredUsers = allUsers.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              user.email.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const handleOpenEditModal = (user: User) => {
        setSelectedUser(user);
        setIsEditModalOpen(true);
    };
    
    const handleCloseEditModal = () => {
        setSelectedUser(null);
        setIsEditModalOpen(false);
    }
    
    const handleUserUpdated = () => {
        refreshCourses(); // This refreshes all data, including users
    }

    const formatUserDate = (value?: string | null) => {
        if (!value) {
            return '—';
        }
        const parsed = parseISO(value);
        if (!isValid(parsed)) {
            return '—';
        }
        return format(parsed, 'dd/MM/yyyy HH:mm', { locale: es });
    };

    return (
        <>
            <Card className="premium-surface h-full flex flex-col">
                <CardHeader>
                    <CardTitle>Gestión de Usuarios</CardTitle>
                    <CardDescription>Visualiza, busca y selecciona un usuario para editar sus detalles y roles.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col">
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                         <div className="relative flex-grow">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre o correo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                    <div className="flex-grow overflow-hidden rounded-xl border">
                        <ScrollArea className="h-full">
                            <div className="overflow-x-auto">
                            <Table className="min-w-[980px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead className="hidden md:table-cell">Email</TableHead>
                                        <TableHead className="hidden sm:table-cell">Roles</TableHead>
                                        <TableHead className="hidden lg:table-cell">Fecha de registro</TableHead>
                                        <TableHead className="hidden xl:table-cell">Último ingreso/actividad</TableHead>
                                        <TableHead className="text-center">Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={6} className="text-center h-24">Cargando usuarios...</TableCell></TableRow>
                                    ) : filteredUsers.length > 0 ? (
                                        filteredUsers.map(user => (
                                            <TableRow key={user.id} onClick={() => handleOpenEditModal(user)} className="cursor-pointer">
                                                <TableCell className="font-medium flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={`https://placehold.co/40x40.png?text=${user.name.substring(0,2)}`} alt={user.name} data-ai-hint="person" />
                                                        <AvatarFallback>{user.name.substring(0,2)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="truncate" title={user.name}>{user.name}</span>
                                                        <span className="text-xs text-muted-foreground md:hidden">{user.email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                                                <TableCell className="hidden sm:table-cell">
                                                    <div className="flex gap-1 flex-wrap">
                                                        {user.roles.map(role => (
                                                            <Badge key={role} variant={roleVariant[role]} className="capitalize">
                                                                {roleNames[role]}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatUserDate(user.createdAt)}</TableCell>
                                                <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">{formatUserDate(user.lastLoginAt ?? user.lastActivityAt)}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={user.status === 'active' ? 'secondary' : 'outline'} className={cn(user.status === 'active' ? "bg-secondary/20 text-secondary-foreground border-secondary/40" : "bg-muted text-muted-foreground border-border", "capitalize")}>
                                                        {user.status === 'active' ? 'Activo' : 'Inactivo'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={6} className="text-center h-24">No se encontraron usuarios.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            </div>
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>

           <UserEditDialog
             user={selectedUser}
             allRoles={allRoles}
             isOpen={isEditModalOpen}
             onClose={handleCloseEditModal}
             onUserUpdated={handleUserUpdated}
           />
        </>
    );
}
