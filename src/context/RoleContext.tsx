'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { UserRole } from '@/types/index';
import { useAuth } from './AuthContext';

interface RoleContextType {
  activeRole: UserRole | null;
  setActiveRole: (role: UserRole) => void;
  sortedRoles: UserRole[];
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [activeRole, setActiveRoleState] = useState<UserRole | null>(null);

  const sortedRoles = useMemo(() => {
    if (!user?.roles) return [];
    return [...user.roles].sort((a, b) => {
      const order: UserRole[] = ['admin', 'teacher', 'student'];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [user?.roles]);

  useEffect(() => {
    // When user data is available or changes, set the default active role.
    if (isAuthenticated && sortedRoles.length > 0) {
      // If the current active role is no longer valid for the user, reset it.
      // Or if no role has been set yet, set the default one.
      if (!activeRole || !sortedRoles.includes(activeRole)) {
        setActiveRoleState(sortedRoles[0]);
      }
    } else if (!isAuthenticated) {
      // Clear role when logging out
      setActiveRoleState(null);
    }
  }, [isAuthenticated, sortedRoles, activeRole]);
  
  const setActiveRole = (role: UserRole) => {
      console.log('Setting active role to:', role);
      setActiveRoleState(role);
  };

  const value = {
      activeRole,
      setActiveRole,
      sortedRoles
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole debe ser usado dentro de un RoleProvider');
  }
  return context;
}
