import { useState, useEffect } from 'react';
import {
    Users as UsersIcon,
    Search,
    Plus,
    Edit2,
    Trash2,
    Check,
    ChevronUp,
    ChevronDown,
    ChevronRight,
    Activity,
    ShieldCheck,
    Database,
    XCircle,
    Save,
    Sliders
} from 'lucide-react';
import { ManagementsService } from '../../services/managementsService';
import { UsersService } from '../../services/usersService';
import { RolesService } from '../../services/rolesService';
import type { User, Management, Role } from '../../types';
import { Modal } from '../../components/common/Modal';
import { cn } from '../../utils/cn';
import { toTitleCase } from '../../utils/formatters';
import { useTableResizer } from '../../hooks/useTableResizer';
import { ResizableHeader } from '../../components/common/ResizableHeader';
import { useAuth } from '../../hooks/useAuth';
import { useDialog } from '../../context/DialogContext';
import { ApiClient } from '../../services/apiClient';
import { useTranslation } from 'react-i18next';

// [FIX FE-H6] SortIcon hoisted outside UsersPage to prevent remount on every render
const SortIcon = ({ column, sortBy, sortOrder }: { column: string; sortBy: string; sortOrder: 'ASC' | 'DESC' }) => {
    if (sortBy !== column) return <ChevronUp className="w-3.5 h-3.5 opacity-20" />;
    return sortOrder === 'ASC'
        ? <ChevronUp className="w-3.5 h-3.5 text-primary" />
        : <ChevronDown className="w-3.5 h-3.5 text-primary" />;
};

export default function UsersPage() {
    const { t } = useTranslation();
    const [users, setUsers] = useState<User[]>([]);
    const [managements, setManagements] = useState<Management[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { hasPermission } = useAuth();
    const { confirm, alert } = useDialog();

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<string>('username');
    const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

    const { widths, onResizeStart } = useTableResizer('tec_users_column_widths', {
        usuario: 250,
        email: 220,
        rol: 160,
        apps: 220
    });

    const [formData, setFormData] = useState<Partial<User>>({
        full_name: '',
        username: '',
        email: '',
        role_id: '',
        management_id: '',
        is_active: true,
        password_hash: '',
        apps: 'TEC'
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [usersData, mgmtData, rolesData] = await Promise.all([
                UsersService.getUsers(),
                ManagementsService.getManagements(),
                RolesService.getRoles()
            ]);
            setUsers(usersData);
            setManagements(mgmtData);
            setRoles(rolesData);
        } catch (error) {
            console.error('Failed to load users data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleApp = (appCode: string) => {
        const currentApps = (formData.apps || '').split(',').map((a: string) => a.trim()).filter(Boolean);
        const updatedApps = currentApps.includes(appCode)
            ? currentApps.filter((a: string) => a !== appCode)
            : [...currentApps, appCode];
        setFormData({ ...formData, apps: updatedApps.join(', ') });
    };

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setSortBy(column);
            setSortOrder('ASC');
        }
    };

    const filteredUsers = users
        .filter(user =>
            (user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .sort((a, b) => {
            const factor = sortOrder === 'ASC' ? 1 : -1;
            if (sortBy === 'username') return (a.username || '').localeCompare(b.username || '') * factor;
            if (sortBy === 'email') return (a.email || '').localeCompare(b.email || '') * factor;
            if (sortBy === 'rol') return (a.role_name || '').localeCompare(b.role_name || '') * factor;
            return 0;
        });

    const handleCreate = () => {
        setEditingUser(null);
        setError(null);
        setFormData({
            full_name: '',
            username: '',
            email: '',
            role_id: roles.length > 0 ? roles[0].id : '',
            management_id: managements.length > 0 ? managements[0].id : '',
            is_active: true,
            password_hash: '',
            apps: 'TEC'
        });
        setIsModalOpen(true);
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setError(null);
        setFormData({ ...user, password_hash: '' });
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        confirm({
            title: t('users.delete.title'),
            message: t('users.delete.message'),
            type: 'danger',
            confirmText: t('users.delete.confirmText'),
            onConfirm: async () => {
                try {
                    await UsersService.deleteUser(id);
                    await loadData();
                } catch (error: any) {
                    alert({ title: 'Error', message: error.message, type: 'error' });
                }
            }
        });
    };

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        try {
            if (editingUser) {
                await UsersService.saveUser({ ...editingUser, ...formData } as User);
            } else {
                await UsersService.saveUser(formData as User);
            }
            setIsModalOpen(false);
            await loadData();
        } catch (error: any) {
            setError(error.message);
        }
    };

    return (
        <div className="flex flex-col h-full space-y-4 min-h-0 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 px-1">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                        <UsersIcon className="w-4 h-4" />
                        <span>{t('users.breadcrumb.config')}</span>
                        <ChevronRight className="w-3 h-3 opacity-50" />
                        <span className="text-foreground">{t('users.breadcrumb.page')}</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('users.title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('users.subtitle')}</p>
                </div>
                {hasPermission('tec.config.users') && (
                    <button
                        onClick={handleCreate}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all active:scale-95 font-semibold text-sm shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        {t('users.newUser')}
                    </button>
                )}
            </div>

            {hasPermission('tec.config.users') && (
                <SystemConfigPanel />
            )}

            {/* Content Container */}
            <div className="flex-1 min-h-0 flex flex-col bg-card rounded-[2rem] border border-border/50 shadow-xl shadow-slate-200/20 dark:shadow-none overflow-hidden backdrop-blur-sm">
                {/* Search / Filters Toolbar */}
                <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('users.searchPlaceholder')}
                            className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-medium"
                        />
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-auto relative custom-scrollbar">
                    {isLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/50 backdrop-blur-sm z-50">
                            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm font-medium text-muted-foreground mt-4 tracking-[0.2em]">{t('users.loading')}</span>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-60">
                            <Activity className="w-12 h-12 text-muted-foreground/20" />
                            <p className="text-sm font-medium text-muted-foreground italic mt-3">{t('users.empty')}</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile: card list */}
                            <div className="md:hidden divide-y divide-border">
                                {filteredUsers.map((user) => (
                                    <div key={user.id} className="p-4 flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-extrabold text-xs border border-primary/20 shadow-inner shrink-0">
                                            {user.username?.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-bold text-foreground text-sm truncate">{toTitleCase(user.full_name || user.username)}</span>
                                                {!user.is_active && (
                                                    <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest shrink-0">{t('users.suspended')}</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground font-mono opacity-60">ID: {user.username}</div>
                                            <div className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</div>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border bg-secondary/50 text-secondary-foreground border-border">
                                                    <ShieldCheck className="w-3 h-3 text-primary/60" />
                                                    {user.role_name || 'Invitado'}
                                                </span>
                                                {(user.apps || 'TEC').split(',').map(app => (
                                                    <span key={app} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/5 text-primary border border-primary/10 uppercase">
                                                        {app.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {hasPermission('tec.config.users') && (
                                            <div className="flex flex-col gap-1 shrink-0">
                                                <button onClick={() => handleEdit(user)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(user.id)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Desktop: table */}
                            <table className="hidden md:table w-full text-sm text-left border-collapse table-fixed min-w-[1000px]">
                                <thead className="sticky top-0 z-20 bg-muted/90 backdrop-blur-md">
                                    <tr className="border-b border-border">
                                        <ResizableHeader columnId="usuario" width={widths.usuario} onResizeStart={onResizeStart} className="px-6 py-4">
                                            <div className="flex items-center justify-between gap-2 group/header cursor-pointer" onClick={() => handleSort('username')}>
                                                <span className="font-bold text-sm text-foreground tracking-tight">{t('users.table.user')}</span>
                                                <SortIcon column="username" sortBy={sortBy} sortOrder={sortOrder} />
                                            </div>
                                        </ResizableHeader>
                                        <ResizableHeader columnId="email" width={widths.email} onResizeStart={onResizeStart} className="px-6 py-4">
                                            <div className="flex items-center justify-between gap-2 group/header cursor-pointer" onClick={() => handleSort('email')}>
                                                <span className="font-bold text-sm text-foreground tracking-tight">{t('users.table.email')}</span>
                                                <SortIcon column="email" sortBy={sortBy} sortOrder={sortOrder} />
                                            </div>
                                        </ResizableHeader>
                                        <ResizableHeader columnId="rol" width={widths.rol} onResizeStart={onResizeStart} className="px-6 py-4">
                                            <div className="flex items-center justify-between gap-2 group/header cursor-pointer" onClick={() => handleSort('rol')}>
                                                <span className="font-bold text-sm text-foreground tracking-tight">{t('users.table.role')}</span>
                                                <SortIcon column="rol" sortBy={sortBy} sortOrder={sortOrder} />
                                            </div>
                                        </ResizableHeader>
                                        <ResizableHeader columnId="apps" width={widths.apps} onResizeStart={onResizeStart} className="px-6 py-4 text-center">
                                            <span className="font-bold text-sm text-foreground tracking-tight">{t('users.table.scope')}</span>
                                        </ResizableHeader>
                                        <th className="px-6 py-4 w-28 bg-muted/30 text-right italic font-medium text-[10px] text-muted-foreground uppercase tracking-widest">{t('users.table.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id} className="group hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-extrabold text-xs border border-primary/20 shadow-inner shrink-0 group-hover:scale-110 transition-transform">
                                                        {user.username?.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-foreground text-sm truncate tracking-tight">
                                                            {toTitleCase(user.full_name || user.username)}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground font-mono truncate flex items-center gap-1.5 opacity-60 mt-0.5">
                                                            <Activity className="w-2.5 h-2.5" /> ID: {user.username}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-muted-foreground font-medium truncate">{user.email}</span>
                                                    {!user.is_active && (
                                                        <span className="text-[9px] font-bold text-red-500 dark:text-red-400 tracking-widest mt-0.5 uppercase">{t('users.suspendedAccount')}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black shadow-sm border bg-secondary/50 text-secondary-foreground border-border">
                                                     <ShieldCheck className="w-3 h-3 text-primary/60" />
                                                    {user.role_name || 'Invitado'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1 justify-center">
                                                    {(user.apps || 'TEC').split(',').map(app => (
                                                        <span key={app} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/5 text-primary border border-primary/10 tracking-tighter uppercase transition-colors group-hover:bg-primary/10 group-hover:border-primary/30">
                                                            {app.trim()}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {hasPermission('tec.config.users') && (
                                                        <>
                                                            <button
                                                                onClick={() => handleEdit(user)}
                                                                className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all active:scale-90"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(user.id)}
                                                                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all active:scale-90"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>

                {/* Footer Stats */}
                <div className="px-6 py-3 border-t border-border/50 bg-muted/30 flex items-center justify-between shrink-0">
                    <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase opacity-60">
                        {t('users.footer.total')}: <span className="text-foreground ml-1">{filteredUsers.length}</span>
                    </p>
                    <div className="flex items-center gap-1.5 font-bold text-[10px] text-primary uppercase tracking-widest opacity-60">
                        <Database className="w-3.5 h-3.5" />
                        {t('users.footer.engine')}
                    </div>
                </div>
            </div>

            {/* Modal de Usuario */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t(editingUser ? 'users.modal.titleEdit' : 'users.modal.titleNew')} size="lg">
                <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-6">
                    {error && (
                        <div className="p-4 bg-rose-500/10 dark:bg-rose-500/5 text-rose-700 dark:text-rose-400 rounded-xl border border-rose-500/20 dark:border-rose-500/10 text-[10px] font-bold tracking-widest flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                            <XCircle className="w-5 h-5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground tracking-widest pl-1">{t('users.modal.labels.fullName')}</label>
                            <input
                                type="text"
                                required
                                value={formData.full_name || ''}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                className="w-full h-11 px-4 bg-background border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/30"
                                placeholder={t('users.modal.placeholders.fullName')}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground tracking-widest pl-1">{t('users.modal.labels.username')}</label>
                            <div className="relative">
                                <Activity className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                                <input
                                    type="text"
                                    required
                                    value={formData.username || ''}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full h-11 pl-10 pr-4 bg-background border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/30 font-mono"
                                    placeholder={t('users.modal.placeholders.username')}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground tracking-widest pl-1">{t('users.modal.labels.email')}</label>
                            <input
                                type="email"
                                required
                                value={formData.email || ''}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full h-11 px-4 bg-background border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/30"
                                placeholder={t('users.modal.placeholders.email')}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground tracking-widest pl-1">
                                {editingUser ? t('users.modal.labels.passwordUpdate') : t('users.modal.labels.password')}
                            </label>
                            <input
                                type="password"
                                required={!editingUser}
                                minLength={8}
                                value={formData.password_hash || ''}
                                onChange={(e) => setFormData({ ...formData, password_hash: e.target.value })}
                                className="w-full h-11 px-4 bg-background border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/30 font-mono"
                                placeholder={editingUser ? t('users.modal.placeholders.passwordUpdate') : t('users.modal.placeholders.password')}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground tracking-widest pl-1">{t('users.modal.labels.role')}</label>
                            <div className="relative">
                                <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                                <select
                                    required
                                    value={formData.role_id || ''}
                                    onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                                    className="w-full h-11 pl-10 pr-4 bg-background border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                                >
                                    <option value="" disabled>{t('users.modal.placeholders.role')}</option>
                                    {roles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground tracking-widest pl-1">{t('users.modal.labels.unit')}</label>
                            <div className="relative">
                                <Database className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                                <select
                                    required
                                    value={formData.management_id || ''}
                                    onChange={(e) => setFormData({ ...formData, management_id: e.target.value })}
                                    className="w-full h-11 pl-10 pr-4 bg-background border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                                >
                                    <option value="" disabled>{t('users.modal.placeholders.unit')}</option>
                                    {managements.map(mgmt => (
                                        <option key={mgmt.id} value={mgmt.id}>{mgmt.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="col-span-full">
                            <label className="text-xs font-bold text-muted-foreground tracking-widest pl-1 mb-3 block uppercase">{t('users.modal.labels.scope')}</label>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                {[
                                    { id: 'FSM', label: 'Gestor FSM' },
                                    { id: 'TCtrl', label: 'Tablero' },
                                    { id: 'TEC', label: 'Gestión Técnica' }
                                ].map(app => {
                                    const isSelected = (formData.apps || '').split(',').map(a => a.trim()).includes(app.id);
                                    return (
                                        <button
                                            key={app.id}
                                            type="button"
                                            onClick={() => toggleApp(app.id)}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-bold tracking-tight transition-all border shadow-sm",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
                                                isSelected ? "bg-white text-primary border-white" : "bg-card border-border shadow-inner"
                                            )}>
                                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[4]" />}
                                            </div>
                                            {app.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="col-span-full pt-2">
                            {/* [FIX UX-M7] Added role="switch" and aria-checked for screen reader accessibility */}
                            <button
                                type="button"
                                role="switch"
                                aria-checked={formData.is_active}
                                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                className={cn(
                                    "w-full flex items-center justify-between px-5 py-3 rounded-xl text-[11px] font-bold transition-all border shadow-sm",
                                    formData.is_active
                                        ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/20"
                                        : "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200/50 dark:border-rose-900/20"
                                )}
                            >
                                <span className="tracking-widest uppercase">{t('users.modal.status.label')}</span>
                                <div className="flex items-center gap-3">
                                    {formData.is_active ? t('users.modal.status.enabled') : t('users.modal.status.suspended')}
                                    <div className={cn(
                                        "w-8 h-4 rounded-full relative transition-colors",
                                        formData.is_active ? "bg-emerald-500" : "bg-rose-500"
                                    )}>
                                        <div className={cn(
                                            "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                                            formData.is_active ? "left-4.5" : "left-0.5"
                                        )} />
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t border-border mt-2">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-all tracking-widest active:scale-95"
                        >
                            {t('users.modal.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/25 active:scale-95 transition-all tracking-widest flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {editingUser ? t('users.modal.save') : t('users.modal.create')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

// [FIX FE-C2] SystemConfigPanel usa ApiClient con el token correcto
function SystemConfigPanel() {
    const { t } = useTranslation();
    const [limitTime, setLimitTime] = useState('09:30');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        const fetchLimit = async () => {
            try {
                const data = await ApiClient.request<{ limit: string }>('/config/rango-horario-limit');
                if (data.limit) {
                    setLimitTime(data.limit);
                }
            } catch (err) {
                console.error('Error loading limit config:', err);
                setError(t('users.sysconfig.errorLoad'));
            }
        };
        fetchLimit();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccess(null);
        try {
            await ApiClient.request('/config/rango-horario-limit', {
                method: 'POST',
                body: JSON.stringify({ limit: limitTime })
            });
            setSuccess(t('users.sysconfig.saved'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('users.sysconfig.errorLoad'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-card border border-border/50 rounded-[2rem] p-6 shadow-xl backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                    <Sliders className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-foreground tracking-tight">{t('users.sysconfig.title')}</h2>
                    <p className="text-xs text-muted-foreground">{t('users.sysconfig.desc')}</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-end gap-4">
                <div className="space-y-1.5 flex-1 max-w-xs">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">{t('users.sysconfig.limitLabel')}</label>
                    <input
                        type="time"
                        value={limitTime}
                        onChange={(e) => setLimitTime(e.target.value)}
                        className="w-full h-11 px-4 bg-background border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-11 px-6 bg-primary text-primary-foreground rounded-xl hover:bg-primary/95 transition-all active:scale-95 font-semibold text-xs shadow-sm flex items-center gap-2"
                >
                    {isSaving ? (
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            {t('users.sysconfig.saveLimit')}
                        </>
                    )}
                </button>
            </div>

            {error && (
                <p className="text-[10px] font-bold text-destructive mt-2 pl-1 uppercase tracking-widest">{error}</p>
            )}
            {success && (
                <p className="text-[10px] font-bold text-emerald-500 mt-2 pl-1 uppercase tracking-widest">{success}</p>
            )}
        </div>
    );
}
