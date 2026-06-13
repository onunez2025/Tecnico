import { useState, useEffect, useRef } from 'react';
import {
    User, Mail, Lock, Camera, Save, CheckCircle, AlertCircle,
    Shield, Building2, BadgeCheck, Loader2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { UsersService } from '../services/usersService';
import { cn } from '../utils/cn';

/**
 * Compresses and resizes an image file to a base64 DataURL.
 * Max dimension: 256px, JPEG quality: 0.8 → typically 10–30KB.
 */
function compressImage(file: File, maxSize = 256, quality = 0.8): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;

                // Scale down to maxSize while maintaining aspect ratio
                if (w > h) {
                    if (w > maxSize) { h = Math.round((h * maxSize) / w); w = maxSize; }
                } else {
                    if (h > maxSize) { w = Math.round((w * maxSize) / h); h = maxSize; }
                }

                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = reader.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function ProfilePage() {
    const { user, login } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        avatar_url: ''
    });

    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (user) {
            setFormData({
                username: user.username,
                email: user.email,
                password: '',
                confirmPassword: '',
                avatar_url: user.avatar_url || ''
            });
        }
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setStatus('idle');
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const compressed = await compressImage(file);
            setFormData(prev => ({ ...prev, avatar_url: compressed }));
            setStatus('idle');
        } catch {
            setStatus('error');
            setMessage('Error al procesar la imagen');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // Validate passwords match
        if (formData.password && formData.password !== formData.confirmPassword) {
            setStatus('error');
            setMessage('Las contraseñas no coinciden');
            return;
        }

        if (formData.password && formData.password.length < 4) {
            setStatus('error');
            setMessage('La contraseña debe tener al menos 4 caracteres');
            return;
        }

        setIsSaving(true);
        try {
            const updatedUser = {
                ...user,
                avatar_url: formData.avatar_url,
                password_hash: formData.password || undefined
            };

            const savedUser = await UsersService.saveUser(updatedUser);

            // Merge only visual/profile fields — preserve session state
            const mergedUser = {
                ...user,
                avatar_url: savedUser.avatar_url,
                full_name: savedUser.full_name,
                // If user changed their password from this page, clear the flag
                requires_password_change: formData.password ? false : user.requires_password_change
            };
            login(mergedUser);

            setStatus('success');
            setMessage('Perfil actualizado correctamente');
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
            setTimeout(() => setStatus('idle'), 4000);
        } catch (error) {
            console.error('Profile update error:', error);
            setStatus('error');
            setMessage('Error al actualizar el perfil');
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return null;

    const initials = (user.full_name || user.username || '??')
        .split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    return (
        <div className="h-full overflow-y-auto pr-2 pb-8">
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in-95">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Mi Perfil</h1>
                    <p className="text-muted-foreground">Gestiona tu información personal y credenciales.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column: Profile Card */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-card border rounded-lg shadow-sm overflow-hidden transition-all hover:shadow-md">
                            {/* Gradient banner */}
                            <div className="h-24 bg-gradient-to-br from-primary/80 to-primary relative overflow-hidden">
                                <div className="absolute inset-0 bg-white/10 opacity-30 backdrop-blur-3xl" />
                            </div>

                            {/* Avatar */}
                            <div className="flex flex-col items-center -mt-14 px-6 pb-6">
                                <div className="relative group">
                                    <div className="w-28 h-28 rounded-full border-4 border-card bg-muted flex items-center justify-center overflow-hidden shadow-xl ring-2 ring-primary/20">
                                        {formData.avatar_url ? (
                                            <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-3xl font-bold text-muted-foreground select-none">{initials}</span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute bottom-1 right-1 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 hover:scale-110 transition-all duration-200 ring-2 ring-background"
                                        title="Cambiar foto de perfil"
                                    >
                                        <Camera className="w-4 h-4" />
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleAvatarChange}
                                    />
                                </div>

                                <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground">{user.full_name || user.username}</h2>
                                <p className="text-sm text-primary font-medium">@{user.username}</p>

                                {/* Role badge */}
                                <div className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 dark:bg-primary/30 text-primary dark:text-primary text-xs font-bold border border-blue-100 dark:border-blue-800">
                                    <Shield className="w-3.5 h-3.5" />
                                    {user.role_name || 'Sin rol'}
                                </div>
                            </div>
                        </div>

                        {/* Quick Info Card */}
                        <div className="bg-card border rounded-lg shadow-sm p-6 space-y-5 transition-all hover:shadow-md">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Información</h3>

                            <div className="space-y-4">
                                <div className="flex items-center gap-4 group">
                                    <div className="w-10 h-10 rounded-md bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-primary transition-all">
                                        <Mail className="w-5 h-5 text-primary dark:text-primary" />
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Email</p>
                                        <p className="text-sm font-bold truncate text-foreground">{user.email}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 group">
                                    <div className="w-10 h-10 rounded-md bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-purple-100 transition-all">
                                        <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Gerencia</p>
                                        <p className="text-sm font-bold truncate text-foreground">{user.management_name || user.management_id}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 group">
                                    <div className="w-10 h-10 rounded-md bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:bg-green-100 transition-all">
                                        <BadgeCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Estado</p>
                                        <p className="text-sm font-bold text-green-600 dark:text-green-400">Activo</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Edit Form */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Account Settings Card */}
                        <div className="bg-card border rounded-lg shadow-sm transition-all hover:shadow-md">
                            <div className="px-6 py-5 border-b border-border bg-muted/30">
                                <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                                    <User className="w-4 h-4 text-primary" />
                                    Cuenta
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">Tu nombre de usuario y correo electrónico.</p>
                            </div>

                            <div className="p-6 space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                                            Usuario
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <input
                                                type="text"
                                                value={formData.username}
                                                disabled
                                                className="block w-full pl-10 pr-3 py-2.5 bg-muted/60 border-transparent rounded-md text-muted-foreground text-sm font-medium cursor-not-allowed"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                                            Email
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                                                <Mail className="w-4 h-4" />
                                            </div>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                disabled
                                                className="block w-full pl-10 pr-3 py-2.5 bg-muted/60 border-transparent rounded-md text-muted-foreground text-sm font-medium cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 bg-primary/5 dark:bg-primary/20 rounded-lg border border-blue-100 dark:border-blue-900/50">
                                    <p className="text-[11px] text-primary dark:text-primary font-medium flex items-center gap-2">
                                        <AlertCircle className="w-3.5 h-3.5 inline" />
                                        Estos campos son de solo lectura. Si necesitas un cambio, contacta al administrador del sistema.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Security Card */}
                        <form onSubmit={handleSubmit}>
                            <div className="bg-card border rounded-lg shadow-sm transition-all hover:shadow-md">
                                <div className="px-6 py-5 border-b border-border bg-muted/30">
                                    <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                                        <Lock className="w-4 h-4 text-primary" />
                                        Seguridad
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">Cambia tu contraseña de acceso.</p>
                                </div>

                                <div className="p-6 space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                                                Nueva Contraseña
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                                                    <Lock className="w-4 h-4" />
                                                </div>
                                                <input
                                                    type="password"
                                                    name="password"
                                                    value={formData.password}
                                                    onChange={handleChange}
                                                    placeholder="••••••••"
                                                    className="block w-full pl-10 pr-3 py-2.5 bg-background border rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-bold"
                                                    minLength={4}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                                                Confirmar Contraseña
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
                                                    <Shield className="w-4 h-4" />
                                                </div>
                                                <input
                                                    type="password"
                                                    name="confirmPassword"
                                                    value={formData.confirmPassword}
                                                    onChange={handleChange}
                                                    placeholder="••••••••"
                                                    className={cn(
                                                        "block w-full pl-10 pr-3 py-2.5 bg-background border rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium",
                                                        formData.confirmPassword && formData.password !== formData.confirmPassword && "border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50 dark:bg-red-900/10"
                                                    )}
                                                    minLength={4}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-muted-foreground font-medium">
                                        Deja los campos vacíos para mantener tu contraseña actual. Mínimo 4 caracteres.
                                    </p>
                                </div>
                            </div>

                            {/* Status Message */}
                            {status !== 'idle' && (
                                <div className={cn(
                                    "mt-5 p-4 rounded-md flex items-center gap-3 text-sm font-bold shadow-sm animate-in fade-in zoom-in-95 duration-300",
                                    status === 'success'
                                        ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800"
                                        : "bg-red-50 text-destructive dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800"
                                )}>
                                    {status === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                                    {message}
                                </div>
                            )}

                            {/* Save Button */}
                            <div className="flex justify-end mt-6">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className={cn(
                                        "w-full sm:w-auto px-8 py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-md shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2",
                                        isSaving
                                            ? "opacity-60 cursor-not-allowed"
                                            : "hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/40 active:translate-y-0"
                                    )}
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    );
}
