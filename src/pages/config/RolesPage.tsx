import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, Check, ChevronDown, Activity, Settings, CalendarDays, Users, BarChart3, Mail, Terminal, Lock, ChevronRight, Layout, Database, AppWindow, ShieldAlert, Save } from 'lucide-react';
import { RolesService } from '../../services/rolesService';
import type { Role, Permission } from '../../types';
import { Modal } from '../../components/common/Modal';
import { cn } from '../../utils/cn';
import { toTitleCase } from '../../utils/formatters';
import { useAuth } from '../../hooks/useAuth';
import { useDialog } from '../../context/DialogContext';
import { useTranslation } from 'react-i18next';

export default function RolesPage() {
    const { t } = useTranslation();
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { hasPermission } = useAuth();
    const { confirm, alert } = useDialog();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [availablePermissions] = useState(RolesService.getAllPermissions());

    const [formData, setFormData] = useState<Omit<Role, 'id'>>({
        name: '',
        permissions: [],
        apps: 'TEC'
    });

    const permissionGroups = [...new Set(availablePermissions.map((p: any) => p.group))];
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

    const toggleGroup = (group: string) => {
        setExpandedGroup(prev => prev === group ? null : group);
    };

    const getGroupIcon = (groupName: string) => {
        const lower = groupName.toLowerCase();
        if (lower.includes('control') || lower.includes('operati') || lower.includes('analític') || lower.includes('report')) return <Activity className="w-4 h-4" />;
        if (lower.includes('config') || lower.includes('ajuste') || lower.includes('setting')) return <Settings className="w-4 h-4" />;
        if (lower.includes('reserva') || lower.includes('agenda') || lower.includes('ticket') || lower.includes('calend')) return <CalendarDays className="w-4 h-4" />;
        if (lower.includes('empleado') || lower.includes('personal') || lower.includes('user') || lower.includes('usuario')) return <Users className="w-4 h-4" />;
        if (lower.includes('pago') || lower.includes('pay') || lower.includes('izipay') || lower.includes('tarjeta')) return <BarChart3 className="w-4 h-4" />;
        if (lower.includes('gasto') || lower.includes('wallet') || lower.includes('dinero') || lower.includes('efectivo')) return <BarChart3 className="w-4 h-4" />;
        if (lower.includes('seguimiento') || lower.includes('trace') || lower.includes('track')) return <Activity className="w-4 h-4" />;
        if (lower.includes('presupuesto') || lower.includes('budget') || lower.includes('plan')) return <BarChart3 className="w-4 h-4" />;
        if (lower.includes('solped') || lower.includes('solicitud')) return <Mail className="w-4 h-4" />;
        if (lower.includes('sistema') || lower.includes('dev')) return <Terminal className="w-4 h-4" />;
        return <Shield className="w-4 h-4" />;
    };

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        setIsLoading(true);
        try {
            const data = await RolesService.getRoles();
            setRoles(data);
        } catch (error) {
            console.error("Failed to load roles:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingRole(null);
        setFormData({ name: '', permissions: [], apps: 'TEC' });
        setExpandedGroup(null);
        setIsModalOpen(true);
    };

    const handleEdit = (role: Role) => {
        setEditingRole(role);
        setFormData({ name: role.name, permissions: role.permissions, apps: role.apps || 'TEC' });
        setExpandedGroup(null);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        confirm({
            title: t('roles.delete.title'),
            message: t('roles.delete.message'),
            type: 'danger',
            confirmText: t('roles.delete.confirmText'),
            onConfirm: async () => {
                try {
                    await RolesService.deleteRole(id);
                    await loadRoles();
                } catch (error: any) {
                    alert({ title: 'Error', message: error.message, type: 'error' });
                }
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingRole) {
                await RolesService.saveRole({ ...editingRole, ...formData });
            } else {
                await RolesService.saveRole(formData);
            }
            setIsModalOpen(false);
            await loadRoles();
        } catch (error: any) {
            alert({ title: 'Error', message: error.message, type: 'error' });
        }
    };

    const togglePermission = (permissionId: Permission) => {
        setFormData(prev => {
            const hasPermission = prev.permissions.includes(permissionId);
            return {
                ...prev,
                permissions: hasPermission
                    ? prev.permissions.filter((p: Permission) => p !== permissionId)
                    : [...prev.permissions, permissionId]
            };
        });
    };

    const toggleApp = (appCode: string) => {
        const currentApps = (formData.apps || '').split(',').map((a: string) => a.trim()).filter(Boolean);
        const updatedApps = currentApps.includes(appCode)
            ? currentApps.filter((a: string) => a !== appCode)
            : [...currentApps, appCode];
        setFormData(prev => ({ ...prev, apps: updatedApps.join(', ') }));
    };

    return (
        <div className="flex flex-col h-full space-y-4 min-h-0 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 px-1">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                        <Shield className="w-4 h-4" />
                        <span>{t('roles.breadcrumb.config')}</span>
                        <ChevronRight className="w-3 h-3 opacity-50" />
                        <span className="text-foreground">{t('roles.breadcrumb.page')}</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('roles.title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('roles.subtitle')}</p>
                </div>
                {hasPermission('tec.config.roles') && (
                    <button
                        onClick={handleCreate}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all active:scale-95 font-semibold text-sm shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        {t('roles.newRole')}
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-auto pr-1 pb-4 custom-scrollbar">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4 bg-card rounded-2xl border border-border shadow-sm">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm font-bold text-muted-foreground tracking-widest">{t('roles.loading')}</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {roles
                            .filter(role => (role.apps || 'TEC').split(',').some(a => a.trim().toUpperCase() === 'TEC'))
                            .map((role) => (
                            <div key={role.id} className="group bg-card rounded-2xl border border-border shadow-sm p-5 hover:shadow-md transition-all duration-300 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                                    <Shield className="w-24 h-24 rotate-12" />
                                </div>
                                <div className="flex items-start justify-between mb-4 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all border border-transparent group-hover:border-primary/20 shrink-0">
                                            <Shield className="w-5.5 h-5.5 stroke-[2]" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-foreground text-sm tracking-tight leading-none mb-1.5">
                                                {toTitleCase(role.name)}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-100 dark:border-emerald-900/20">{t('roles.cards.active')}</span>
                                                <span className="text-[10px] text-muted-foreground font-bold tracking-tight">
                                                    {t('roles.cards.permissions', { count: role.permissions?.length || 0 })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {hasPermission('tec.config.roles') && (
                                            <>
                                                <button onClick={() => handleEdit(role)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all active:scale-90">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                {role.id !== 'ADMIN' && (
                                                    <button onClick={() => handleDelete(role.id)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all active:scale-90">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar relative z-10">
                                    {(role.permissions || []).length === 0 ? (
                                        <div className="w-full flex flex-col items-center justify-center gap-2 py-4 px-4 bg-muted/20 rounded-xl border border-dashed border-border/60">
                                            <Lock className="w-5 h-5 text-muted-foreground/30" />
                                            <span className="text-[10px] text-muted-foreground font-bold italic text-center">{t('roles.cards.noPermissions')}</span>
                                        </div>
                                    ) : (
                                        role.permissions
                                            .filter(p => availablePermissions.some(ap => ap.id === p))
                                            .map((perm: string) => {
                                                const label = availablePermissions.find((p: any) => p.id === perm)?.label || perm;
                                                return (
                                                    <span key={perm} className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-muted text-muted-foreground border border-transparent hover:border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors whitespace-nowrap">
                                                        {label}
                                                    </span>
                                                );
                                            })
                                    )}
                                </div>
                                <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between opacity-40 group-hover:opacity-100 transition-opacity">
                                    <div className="flex items-center gap-1.5 font-bold text-[9px] text-muted-foreground tracking-widest uppercase">
                                        <Database className="w-3.5 h-3.5" />
                                        {t('roles.footer.engine')}
                                    </div>
                                    <ShieldAlert className="w-3.5 h-3.5 text-primary/40 group-hover:text-primary transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRole ? t('roles.modal.titleEdit') : t('roles.modal.titleNew')} size="xl">
                <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-6">
                    <div className="space-y-6">
                        <div className="bg-muted/30 p-5 rounded-2xl border border-border/50 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                                <Shield className="w-20 h-20 rotate-12" />
                            </div>
                            <div className="relative z-10 flex flex-col gap-3">
                                <label className="text-xs font-bold text-muted-foreground tracking-widest pl-1">{t('roles.modal.nameLabel')}</label>
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        required
                                        value={formData.name || ''}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full h-11 pl-11 pr-4 bg-background border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                        placeholder={t('roles.modal.namePlaceholder')}
                                    />
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40">
                                        <Lock className="w-4 h-4 stroke-[2.5]" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-muted-foreground tracking-widest px-1 flex items-center gap-2">
                                <AppWindow className="w-4 h-4 text-primary/60" />
                                {t('roles.modal.appsLabel')}
                            </label>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {[
                                    { id: 'Liq', label: 'Liquidaciones' },
                                    { id: 'TEC', label: 'Gestión Técnica' }
                                ].map(app => {
                                    const isSelected = (formData.apps || '').split(',').map(a => a.trim()).includes(app.id);
                                    return (
                                        <button
                                            key={app.id}
                                            type="button"
                                            onClick={() => {
                                                const currentApps = (formData.apps || '').split(',').map((a: string) => a.trim()).filter(Boolean);
                                                const updatedApps = currentApps.includes(app.id)
                                                    ? currentApps.filter((a: string) => a !== app.id)
                                                    : [...currentApps, app.id];
                                                setFormData({ ...formData, apps: updatedApps.join(', ') });
                                            }}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-bold tracking-tight border transition-all duration-200",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]"
                                                    : "bg-background border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                            )}>
                                            <div className={cn(
                                                "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black transition-all",
                                                isSelected ? "bg-white text-primary" : "bg-muted text-muted-foreground/60"
                                            )}>
                                                {app.id.substring(0, 1)}
                                            </div>
                                            <span className="truncate">{app.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <label className="text-xs font-bold text-muted-foreground tracking-widest px-1 shrink-0 flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-primary/60" />
                                    {t('roles.modal.permissionsLabel')}
                                </label>
                                <div className="h-px bg-border flex-1" />
                            </div>

                            <div className="space-y-3">
                                {permissionGroups.map(group => {
                                    const isExpanded = expandedGroup === group;
                                    const groupPermissions = availablePermissions.filter((p: any) => p.group === group);
                                    const selectedCount = groupPermissions.filter((p: any) => formData.permissions.includes(p.id)).length;

                                    return (
                                        <div key={group} className={cn(
                                            "border rounded-xl overflow-hidden bg-background transition-all duration-300",
                                            isExpanded ? "border-primary/40 shadow-sm" : "border-border"
                                        )}>
                                            <button
                                                type="button"
                                                onClick={() => toggleGroup(group)}
                                                className={cn(
                                                    "w-full flex items-center justify-between p-3.5 hover:bg-muted/30 transition-all",
                                                    isExpanded && "bg-muted/20 border-b border-border"
                                                )}
                                            >
                                                <div className="flex items-center gap-3.5">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all border",
                                                        isExpanded ? "bg-primary text-white border-primary" : "bg-muted text-primary border-border"
                                                    )}>
                                                        {getGroupIcon(group)}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-sm font-bold text-foreground leading-none mb-1.5">{group}</p>
                                                        <p className="text-[10px] font-medium text-muted-foreground">
                                                            {t('roles.modal.permissionsOf', { selected: selectedCount, total: groupPermissions.length })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {selectedCount > 0 && !isExpanded && (
                                                        <div className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-100 dark:border-emerald-900/20 flex items-center gap-1">
                                                            <Check className="w-3 h-3 stroke-[3]" />
                                                            {selectedCount}
                                                        </div>
                                                    )}
                                                    <ChevronDown className={cn(
                                                        "w-5 h-5 text-muted-foreground transition-transform duration-300",
                                                        isExpanded ? "rotate-180" : ""
                                                    )} />
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="p-4 bg-muted/5">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                        {groupPermissions.map((perm: any) => {
                                                            const isSelected = formData.permissions.includes(perm.id);
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    key={perm.id}
                                                                    onClick={() => togglePermission(perm.id)}
                                                                    className={cn(
                                                                        "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-bold text-left transition-all border",
                                                                        isSelected
                                                                            ? "bg-white border-primary text-primary shadow-sm"
                                                                            : "bg-background border-transparent text-muted-foreground hover:bg-muted/30"
                                                                    )}
                                                                >
                                                                    <div className={cn(
                                                                        "w-4.5 h-4.5 rounded-lg flex items-center justify-center transition-all shrink-0 border",
                                                                        isSelected
                                                                            ? 'bg-primary text-white border-primary'
                                                                            : 'bg-muted/30 border-border group-hover:border-primary/40'
                                                                    )}>
                                                                        {isSelected && <Check className="w-3 h-3 stroke-[4px]" />}
                                                                    </div>
                                                                    <span className="truncate flex-1 tracking-tight">{perm.label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t border-border mt-2">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-all tracking-widest active:scale-95"
                        >
                            {t('roles.modal.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/25 active:scale-95 transition-all tracking-widest flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {editingRole ? t('roles.modal.save') : t('roles.modal.confirm')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
