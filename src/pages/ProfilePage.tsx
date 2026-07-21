import { useState, useEffect, useRef } from 'react';
import {
    User, Mail, Lock, Camera, Save, CheckCircle, AlertCircle,
    Shield, Building2, BadgeCheck, Loader2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ApiClient } from '../services/apiClient';
import { cn } from '../utils/cn';
import { useTranslation } from 'react-i18next';
import { SIATC_THEME } from '../utils/siatc-theme';

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
    const { t } = useTranslation();
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
            setMessage(t('profile.errors.imageError'));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (formData.password && formData.password !== formData.confirmPassword) {
            setStatus('error');
            setMessage(t('profile.errors.passwordMismatch'));
            return;
        }

        if (formData.password && formData.password.length < 4) {
            setStatus('error');
            setMessage(t('profile.errors.passwordMin'));
            return;
        }

        setIsSaving(true);
        try {
            const savedProfile = await ApiClient.request<{ avatar_url: string; full_name: string; requires_password_change: boolean }>('/profile', {
                method: 'PUT',
                body: JSON.stringify({
                    avatar_url: formData.avatar_url,
                    password_hash: formData.password || undefined
                })
            });

            const mergedUser = {
                ...user,
                avatar_url: savedProfile.avatar_url,
                full_name: savedProfile.full_name,
                requires_password_change: savedProfile.requires_password_change
            };
            login(mergedUser);

            setStatus('success');
            setMessage(t('profile.success.updated'));
            setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
            setTimeout(() => setStatus('idle'), 4000);
        } catch (error) {
            console.error('Profile update error:', error);
            setStatus('error');
            setMessage(t('profile.errors.updateFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return null;

    const initials = (user.full_name || user.username || '??')
        .split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    return (
        <div className={SIATC_THEME.PROFILE_LAYOUT.PAGE_WRAPPER}>
            <div className={SIATC_THEME.PROFILE_LAYOUT.INNER_CONTAINER}>
                {/* Header — oculto en móvil (mismo criterio que Tickets/Pagos): el tab
                    inferior ya dice "Perfil", es chrome redundante en esa pantalla */}
                <div className="hidden sm:block">
                    <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('profile.title')}</h1>
                    <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>{t('profile.subtitle')}</p>
                </div>

                <div className={SIATC_THEME.PROFILE_LAYOUT.GRID}>

                    {/* Left Column: Profile Card */}
                    <div className={SIATC_THEME.PROFILE_LAYOUT.LEFT_COLUMN}>
                        <div className={cn(SIATC_THEME.COMPONENTS.CARD_CONTAINER, 'overflow-hidden transition-all hover:shadow-md')}>
                            <div className={SIATC_THEME.PROFILE_LAYOUT.BANNER}>
                                <div className={SIATC_THEME.PROFILE_LAYOUT.BANNER_OVERLAY} />
                            </div>

                            <div className={SIATC_THEME.PROFILE_LAYOUT.AVATAR_CONTAINER}>
                                <div className="relative group">
                                    <div className={SIATC_THEME.PROFILE_LAYOUT.AVATAR_RING}>
                                        {formData.avatar_url ? (
                                            <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-3xl font-bold text-cb-neutral select-none">{initials}</span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className={SIATC_THEME.PROFILE_LAYOUT.CAMERA_BUTTON}
                                        title={t('profile.changePhoto')}
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

                                <h2 className="mt-4 text-xl font-bold tracking-tight text-cb-text-primary">{user.full_name || user.username}</h2>
                                <p className="text-sm text-primary font-medium">@{user.username}</p>

                                <div className={SIATC_THEME.PROFILE_LAYOUT.ROLE_BADGE}>
                                    <Shield className="w-3.5 h-3.5" />
                                    {user.role_name || t('profile.noRole')}
                                </div>
                            </div>
                        </div>

                        {/* Quick Info Card */}
                        <div className={cn(SIATC_THEME.COMPONENTS.CARD_CONTAINER, SIATC_THEME.PROFILE_LAYOUT.QUICK_INFO_CARD, 'transition-all hover:shadow-md')}>
                            <h3 className="text-xs font-bold text-cb-neutral uppercase tracking-wider">{t('profile.info')}</h3>

                            <div className={SIATC_THEME.PROFILE_LAYOUT.INFO_LIST}>
                                <div className={SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM}>
                                    <div className={cn(SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM_ICON_BASE, SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM_ICON_PRIMARY, 'group-hover:bg-primary group-hover:text-primary-foreground')}>
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div className={SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM_DETAILS}>
                                        <p className={SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM_LABEL}>{t('profile.labels.email')}</p>
                                        <p className={SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM_VALUE}>{user.email}</p>
                                    </div>
                                </div>

                                <div className={SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM}>
                                    <div className={cn(SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM_ICON_BASE, SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM_ICON_PURPLE)}>
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div className={SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM_DETAILS}>
                                        <p className={SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM_LABEL}>{t('profile.labels.management')}</p>
                                        <p className={SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM_VALUE}>{user.management_name || user.management_id}</p>
                                    </div>
                                </div>

                                <div className={SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM}>
                                    <div className={cn(SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM_ICON_BASE, SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM_ICON_EMERALD)}>
                                        <BadgeCheck className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className={SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM_LABEL}>{t('profile.labels.status')}</p>
                                        <p className={SIATC_THEME.PROFILE_LAYOUT.INFO_ITEM_VALUE_SUCCESS}>{t('profile.statusActive')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Edit Form */}
                    <div className={SIATC_THEME.PROFILE_LAYOUT.RIGHT_COLUMN}>

                        {/* Account Settings Card */}
                        <div className={cn(SIATC_THEME.COMPONENTS.CARD_CONTAINER, 'transition-all hover:shadow-md')}>
                            <div className={SIATC_THEME.PROFILE_LAYOUT.FORM_SECTION_HEADER}>
                                <h3 className={SIATC_THEME.PROFILE_LAYOUT.FORM_SECTION_TITLE}>
                                    <User className="w-4 h-4 text-primary" />
                                    {t('profile.account.title')}
                                </h3>
                                <p className={SIATC_THEME.PROFILE_LAYOUT.FORM_SECTION_SUBTITLE}>{t('profile.account.desc')}</p>
                            </div>

                            <div className="p-6 space-y-5">
                                <div className={SIATC_THEME.PROFILE_LAYOUT.FORM_GRID}>
                                    <div>
                                        <label className={SIATC_THEME.PROFILE_LAYOUT.FIELD_LABEL}>
                                            {t('profile.labels.username')}
                                        </label>
                                        <div className={SIATC_THEME.PROFILE_LAYOUT.FIELD_WRAPPER}>
                                            <div className={SIATC_THEME.PROFILE_LAYOUT.FIELD_ICON}>
                                                <User className="w-4 h-4" />
                                            </div>
                                            <input
                                                type="text"
                                                value={formData.username}
                                                disabled
                                                className={SIATC_THEME.PROFILE_LAYOUT.INPUT_DISABLED}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={SIATC_THEME.PROFILE_LAYOUT.FIELD_LABEL}>
                                            {t('profile.labels.email')}
                                        </label>
                                        <div className={SIATC_THEME.PROFILE_LAYOUT.FIELD_WRAPPER}>
                                            <div className={SIATC_THEME.PROFILE_LAYOUT.FIELD_ICON}>
                                                <Mail className="w-4 h-4" />
                                            </div>
                                            <input
                                                type="email"
                                                value={formData.email}
                                                disabled
                                                className={SIATC_THEME.PROFILE_LAYOUT.INPUT_DISABLED}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className={SIATC_THEME.PROFILE_LAYOUT.READONLY_ALERT}>
                                    <p className={SIATC_THEME.PROFILE_LAYOUT.READONLY_ALERT_TEXT}>
                                        <AlertCircle className="w-3.5 h-3.5 inline" />
                                        {t('profile.account.readonlyNote')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Security Card */}
                        <form onSubmit={handleSubmit}>
                            <div className={cn(SIATC_THEME.COMPONENTS.CARD_CONTAINER, 'transition-all hover:shadow-md')}>
                                <div className={SIATC_THEME.PROFILE_LAYOUT.FORM_SECTION_HEADER}>
                                    <h3 className={SIATC_THEME.PROFILE_LAYOUT.FORM_SECTION_TITLE}>
                                        <Lock className="w-4 h-4 text-primary" />
                                        {t('profile.security.title')}
                                    </h3>
                                    <p className={SIATC_THEME.PROFILE_LAYOUT.FORM_SECTION_SUBTITLE}>{t('profile.security.desc')}</p>
                                </div>

                                <div className="p-6 space-y-5">
                                    <div className={SIATC_THEME.PROFILE_LAYOUT.FORM_GRID}>
                                        <div>
                                            <label className={SIATC_THEME.PROFILE_LAYOUT.FIELD_LABEL}>
                                                {t('profile.labels.newPassword')}
                                            </label>
                                            <div className={SIATC_THEME.PROFILE_LAYOUT.FIELD_WRAPPER}>
                                                <div className={SIATC_THEME.PROFILE_LAYOUT.FIELD_ICON}>
                                                    <Lock className="w-4 h-4" />
                                                </div>
                                                <input
                                                    type="password"
                                                    name="password"
                                                    value={formData.password}
                                                    onChange={handleChange}
                                                    placeholder="••••••••"
                                                    className={SIATC_THEME.PROFILE_LAYOUT.INPUT_ACTIVE}
                                                    minLength={4}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={SIATC_THEME.PROFILE_LAYOUT.FIELD_LABEL}>
                                                {t('profile.labels.confirmPassword')}
                                            </label>
                                            <div className={SIATC_THEME.PROFILE_LAYOUT.FIELD_WRAPPER}>
                                                <div className={SIATC_THEME.PROFILE_LAYOUT.FIELD_ICON}>
                                                    <Shield className="w-4 h-4" />
                                                </div>
                                                <input
                                                    type="password"
                                                    name="confirmPassword"
                                                    value={formData.confirmPassword}
                                                    onChange={handleChange}
                                                    placeholder="••••••••"
                                                    className={cn(
                                                        SIATC_THEME.PROFILE_LAYOUT.INPUT_ACTIVE,
                                                        formData.confirmPassword && formData.password !== formData.confirmPassword && SIATC_THEME.PROFILE_LAYOUT.INPUT_ERROR
                                                    )}
                                                    minLength={4}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <p className={SIATC_THEME.PROFILE_LAYOUT.FORM_NOTE}>
                                        {t('profile.security.hint')}
                                    </p>
                                </div>
                            </div>

                            {/* Status Message */}
                            {status !== 'idle' && (
                                <div className={cn(
                                    SIATC_THEME.PROFILE_LAYOUT.STATUS_ALERT_BASE,
                                    'mt-5',
                                    status === 'success'
                                        ? SIATC_THEME.PROFILE_LAYOUT.STATUS_ALERT_SUCCESS
                                        : SIATC_THEME.PROFILE_LAYOUT.STATUS_ALERT_ERROR
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
                                        SIATC_THEME.COMPONENTS.BUTTON_PRIMARY,
                                        'w-full sm:w-auto px-8 h-auto py-3.5',
                                        isSaving
                                            ? 'opacity-60 cursor-not-allowed'
                                            : 'hover:-translate-y-0.5 active:translate-y-0'
                                    )}
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {isSaving ? t('profile.saving') : t('profile.saveChanges')}
                                </button>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    );
}
