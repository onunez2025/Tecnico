import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { Permission } from '../../types';

interface PermissionGuardProps {
    permission: Permission;
    children: React.ReactNode;
    asRoute?: boolean;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ 
    permission, 
    children, 
    asRoute = false 
}) => {
    const { hasPermission, isLoading } = useAuth();

    if (isLoading) {
        return null; // Or a loading spinner
    }

    if (!hasPermission(permission)) {
        if (asRoute) {
            return <Navigate to="/" replace />;
        }
        return null;
    }

    return <>{children}</>;
};
