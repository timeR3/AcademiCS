'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { fetchAllRoles } from '@/app/actions';
import type { User, UserRole, Role } from '@/types';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { Search } from 'lucide-react';
import { useCourse } from '@/context/CourseContext';
import { UserEditDialog } from './UserEditDialog';

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

    useEffect(() => {
        setLoading(allUsers.length === 0);
        async function loadRoles() {
            try {
                const roles = await fetchAllRoles();
                setAllRoles(roles);
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

    return (
        <>
            <Card className="shadow-lg h-full flex flex-col">
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
                    <div className="border rounded-md flex-grow">
                        <ScrollArea className="h-full">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead className="hidden md:table-cell">Email</TableHead>
                                        <TableHead className="hidden sm:table-cell">Roles</TableHead>
                                        <TableHead className="text-center">Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={4} className="text-center h-24">Cargando usuarios...</TableCell></TableRow>
                                    ) : filteredUsers.length > 0 ? (
                                        filteredUsers.map(user => (
                                            <TableRow key={user.id} onClick={() => handleOpenEditModal(user)} className="cursor-pointer">
                                                <TableCell className="font-medium flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={`https://placehold.co/40x40.png?text=${user.name.substring(0,2)}`} alt={user.name} data-ai-hint="person" />
                                                        <AvatarFallback>{user.name.substring(0,2)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span>{user.name}</span>
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
                                                <TableCell className="text-center">
                                                    <Badge variant={user.status === 'active' ? 'secondary' : 'outline'} className={cn(user.status === 'active' ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800", "capitalize")}>
                                                        {user.status === 'active' ? 'Activo' : 'Inactivo'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={4} className="text-center h-24">No se encontraron usuarios.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
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
