/**
 * CRYPTO BLUE - DESIGN SYSTEM MOTOR (v1.1)
 * Single Source of Truth for EBM/Flow Platform
 * 
 * Replicación exacta del sistema de diseño de la aplicación base.
 */

const CRYPTO_BLUE_TOKENS = {
    RADIUS: {
        CHIP: "rounded-cb-chip",     // 4px
        BUTTON: "rounded-cb-btn",    // 8px
        INPUT: "rounded-cb-btn",     // 8px
        CARD: "rounded-cb-card",     // 12px
        MODAL: "rounded-cb-modal",   // 16px
        FULL: "rounded-full",
    },
    ELEVATION: {
        LEVEL_0: "border border-cb-border shadow-none",
        LEVEL_1: "shadow-cb-level-1 border border-cb-border",
        LEVEL_2: "shadow-cb-level-2 border border-cb-border",
        LEVEL_3: "shadow-cb-level-3 border border-cb-border",
    },
    TYPOGRAPHY: {
        DISPLAY: "font-sans font-bold tracking-[-0.02em] text-[40px] leading-[1.2] text-cb-text-primary",
        H1: "font-sans font-bold tracking-[-0.02em] text-[18px] leading-[1.2] text-cb-text-primary",
        H2: "font-sans font-bold tracking-[-0.01em] text-[15px] leading-[1.3] text-cb-text-primary",
        H3: "font-sans font-bold text-[13px] leading-[1.4] text-cb-text-primary",
        BODY: "font-sans font-normal text-[16px] leading-[1.5] text-cb-text-primary",
        BODY_SMALL: "font-sans font-normal text-[14px] leading-[1.5] text-cb-text-secondary",
        CAPTION: "font-sans font-medium text-[12px] leading-[1.5] uppercase tracking-[0.06em] text-cb-neutral",
        MONO_DATA: "font-mono font-medium text-[16px] tabular-nums tracking-tight text-cb-text-primary",
        MONO_SMALL: "font-mono font-normal text-[13px] tabular-nums text-cb-text-secondary",
    },
};

export const SIATC_THEME = {
    // 1. TOKENS DE DECISIÓN (Atómicos)
    TOKENS: {
        ...CRYPTO_BLUE_TOKENS,
        MASTER_ROUNDNESS: CRYPTO_BLUE_TOKENS.RADIUS.CARD,
        COMPONENT_ROUNDNESS: CRYPTO_BLUE_TOKENS.RADIUS.BUTTON,
        BUTTON_ROUNDNESS: CRYPTO_BLUE_TOKENS.RADIUS.BUTTON,
        PRIMARY_ACCENT: "bg-primary text-primary-foreground",
        SIDEBAR_BG: "bg-cb-bg",
        MODAL_OVERLAY: "bg-slate-900/60 backdrop-blur-md",
    },

    // Efectos Visuales Premium
    EFFECTS: {
        GLASS_PANEL: "bg-card/80 backdrop-blur-xl border-white/20 shadow-cb-level-2",
        HOVER_LIFT: "hover:-translate-y-1 hover:shadow-cb-level-2 transition-all duration-300",
    },

    // 2. FUNDAMENTOS DE LAYOUT
    LAYOUT: {
        PAGE_WRAPPER: "flex flex-col h-full bg-cb-bg min-h-0 animate-in fade-in duration-500 pt-[calc(1rem*var(--padding-scale))] px-0 lg:px-[calc(1rem*var(--padding-scale))] pb-[calc(0.375rem*var(--padding-scale))] space-y-4 lg:rounded-cb-card border-none lg:border-[var(--layout-border-width)] border-cb-border overflow-hidden lg:shadow-[var(--layout-shadow)]",
        HEADER_WRAPPER: "flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 px-1",
        CONTENT_CONTAINER: "flex-1 min-h-0 flex flex-col bg-card border border-cb-border rounded-cb-card shadow-cb-level-1 overflow-hidden",
        MAX_WIDTH: "mx-auto max-w-7xl w-full",
        SECTION_SPACING: "space-y-4",
        SIDEBAR_CONTAINER: "w-64 shrink-0 flex flex-col bg-card rounded-cb-card border border-cb-border overflow-hidden",
        SIDEBAR_INNER: "flex flex-col h-full bg-transparent text-cb-text-primary transition-all duration-500",
        SIDEBAR_ITEM_ACTIVE: "group/item flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 relative overflow-hidden bg-primary text-primary-foreground shadow-lg shadow-primary/25 translate-x-1",
        SIDEBAR_ITEM_INACTIVE: "group/item flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 relative overflow-hidden text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-1",
        METRIC_RIBBON: "bg-card border border-cb-border rounded-cb-card px-6 py-2 shadow-cb-level-1 flex items-center justify-between shrink-0 h-[55px]",
        SEARCH_BAR_WRAPPER: "p-4 border-b border-cb-border bg-cb-bg/30 flex items-center justify-between shrink-0",
        VIEWPORT: "flex-1 overflow-y-auto px-[calc(2rem*var(--padding-scale))] pb-[calc(0.625rem*var(--padding-scale))] flex flex-col custom-scrollbar relative",
    },

    // 3. TIPOGRAFÍA Y TEXTO
    TYPOGRAPHY: {
        PAGE_TITLE: CRYPTO_BLUE_TOKENS.TYPOGRAPHY.H1,
        PAGE_SUBTITLE: `${CRYPTO_BLUE_TOKENS.TYPOGRAPHY.BODY_SMALL} hidden sm:block`,
        SECTION_TITLE: "text-base font-bold text-cb-text-primary tracking-tight",
        TABLE_HEADER: "font-sans font-semibold text-[11px] leading-[1.5] uppercase tracking-[0.06em] text-cb-slate",
        BADGE_TEXT: "text-[10px] font-bold tracking-widest uppercase",
        FOOTER_STATS: "text-[11px] font-bold text-cb-slate tracking-[0.1em] uppercase opacity-95",
        TINY_MONO: CRYPTO_BLUE_TOKENS.TYPOGRAPHY.MONO_SMALL,
    },

    // 4. TABLAS (Arquitectura de Filas 64px)
    TABLE: {
        TABLE_ELEMENT: "w-full text-sm text-left border-collapse min-w-[1000px]",
        HEADER_ROW: "sticky top-0 z-20 bg-card border-b border-cb-border shadow-sm",
        HEADER_TH: "px-6 py-2.5 font-sans font-semibold text-[11px] uppercase tracking-[0.06em] text-cb-slate text-left",
        BODY_ROW: "h-[64px] group hover:bg-cb-bg transition-colors border-b border-cb-border/60",
        CELL: "px-6 py-4 align-middle font-sans text-cb-text-primary",
        SCROLL_AREA: "flex-1 overflow-auto relative custom-scrollbar",
        FOOTER: "px-6 py-2 border-t border-cb-border bg-cb-bg/30 flex items-center justify-between shrink-0",
    },

    // 5. COMPONENTES DE INTERACCIÓN
    COMPONENTS: {
        BUTTON_PRIMARY: "h-[36px] px-4 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-cb-btn hover:bg-primary/90 transition-all active:scale-95 font-bold text-sm shadow-sm",
        BUTTON_SECONDARY: "h-[36px] px-4 inline-flex items-center justify-center gap-2 bg-card text-cb-text-primary border border-cb-border rounded-cb-btn hover:bg-cb-bg/50 transition-all active:scale-95 font-bold text-sm",
        BUTTON_SUCCESS: "h-[36px] px-4 inline-flex items-center justify-center gap-2 bg-[#05B169] text-white rounded-cb-btn hover:bg-[#05B169]/90 transition-all active:scale-95 font-bold text-sm shadow-sm",
        BUTTON_DANGER: "h-[36px] px-4 inline-flex items-center justify-center gap-2 bg-[#DF2935] text-white rounded-cb-btn hover:bg-[#DF2935]/90 transition-all active:scale-95 font-bold text-sm shadow-sm",
        BUTTON_INFO: "h-[36px] px-4 inline-flex items-center justify-center gap-2 bg-cb-blue text-white rounded-cb-btn hover:bg-cb-blue/90 transition-all active:scale-95 font-bold text-sm shadow-sm",
        BUTTON_GHOST: "h-[36px] px-4 inline-flex items-center justify-center gap-2 bg-transparent text-cb-text-secondary rounded-cb-btn hover:bg-cb-bg transition-all active:scale-95 font-bold text-sm",
        INPUT: "h-[36px] w-full px-4 bg-card text-cb-text-primary border border-cb-border rounded-cb-btn focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all text-sm font-medium placeholder:text-cb-neutral/40",
        MODAL_CONTENT: "bg-card text-cb-text-primary rounded-cb-modal border border-cb-border shadow-cb-level-3 p-6 overflow-hidden",
        CARD_CONTAINER: "bg-card border border-cb-border rounded-cb-card shadow-cb-level-1",
        KPI_CARD_CONTAINER: "bg-card border border-cb-border rounded-cb-card h-[121px] py-2.5 px-6 shadow-cb-level-1 flex flex-col justify-between",
        KPI_CARD_VALUE: "text-2xl font-bold tracking-tighter text-cb-text-primary",
        KPI_CARD_LABEL: "text-[11px] font-bold text-cb-neutral uppercase tracking-wider",
        KPI_CARD_SUB: "text-[11px] font-bold text-cb-text-secondary opacity-80",
    },

    // 6. ESTADOS Y BADGES
    STATES: {
        BADGE_BASE: "h-[26px] inline-flex items-center gap-1.5 px-2.5 rounded-cb-chip border font-bold text-[11px] uppercase tracking-wider transition-all",
        SUCCESS: "bg-[#E6F6EF] text-[#05B169] border-[#E6F6EF]",
        WARNING: "bg-[#FFF4E5] text-[#F0AD4E] border-[#FFF4E5]",
        ERROR: "bg-[#FDECEE] text-[#DF2935] border-[#FDECEE]",
        INFO: "bg-cb-bg text-cb-blue border-cb-border",
        PRIMARY: "bg-primary/10 text-primary border-primary/20",
        SECONDARY: "bg-cb-neutral/10 text-cb-neutral border-cb-neutral/20",
    },

    // 7. ESTRUCTURA DE INICIO DE SESIÓN (LOGIN_LAYOUT)
    LOGIN_LAYOUT: {
        CONTAINER: "min-h-screen flex flex-col md:flex-row bg-[#F9FAFB] dark:bg-[#050F1A] text-cb-text-primary transition-colors duration-300",
        CENTERED_CONTAINER: "min-h-screen bg-[#F9FAFB] dark:bg-[#050F1A] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300 text-cb-text-primary",
        CENTERED_HEADER: "sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center text-center",
        LEFT_PANEL: "hidden md:flex flex-col justify-between w-1/2 bg-slate-900 text-white p-12 relative overflow-hidden",
        RIGHT_PANEL: "flex-1 flex flex-col justify-center items-center p-8 bg-[#F9FAFB] dark:bg-[#050F1A] relative",
        CARD: "w-full max-w-md bg-card border border-cb-border rounded-cb-modal shadow-cb-level-3 p-8 relative z-10 mx-auto",
        TITLE: "text-3xl font-bold tracking-tight text-cb-text-primary",
        SUBTITLE: "mt-2 text-cb-text-secondary text-sm",
        ALERT_EXPIRED: "p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2",
        INPUT_WRAPPER: "relative rounded-cb-btn shadow-sm",
        INPUT: "block w-full pl-10 pr-3 py-2.5 bg-card text-cb-text-primary border border-cb-border rounded-cb-btn focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-sm font-medium",
    },

    // 8. ECOSISTEMA DE APLICACIONES (App Switcher)
    APP_SWITCHER: {
        TRIGGER: "w-11 h-11 flex items-center justify-center rounded-full transition-all duration-300 active:scale-95 text-slate-400 hover:text-primary hover:bg-primary/10",
        TRIGGER_ACTIVE: "bg-primary text-white shadow-lg shadow-primary/20 scale-110",
        CONTAINER: "absolute right-0 mt-6 w-[540px] bg-card/95 backdrop-blur-2xl border border-cb-border rounded-[2.5rem] shadow-[0_32px_128px_rgba(0,0,0,0.18)] dark:shadow-none z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-300 origin-top-right",
        HEADER: "px-10 pt-8 pb-4 flex items-center justify-between",
        HEADER_TITLE: "text-sm font-black text-foreground tracking-[0.2em] uppercase",
        HEADER_SUBTITLE: "text-[10px] font-black text-primary tracking-[0.3em] uppercase opacity-60",
        SYNC_BADGE: "flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-full border border-primary/20",
        SYNC_DOT: "w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50",
        SYNC_TEXT: "text-[9px] font-black text-primary uppercase tracking-widest",
        GRID: "p-6 grid grid-cols-4 gap-3",
        ITEM_CARD: "group relative flex flex-col items-center justify-center p-4 rounded-[1.5rem] bg-cb-bg/50 hover:bg-card transition-all duration-500 border border-transparent hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 active:scale-95 text-center",
        ITEM_LOGO_WRAPPER: "w-12 h-12 bg-card rounded-2xl flex items-center justify-center p-2.5 shadow-lg shadow-slate-200/50 dark:shadow-none group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500 border border-cb-border/50 shrink-0",
        ITEM_NAME: "text-[10px] font-black text-foreground group-hover:text-primary transition-colors tracking-tight uppercase truncate w-full mt-2",
        FOOTER: "px-10 py-5 bg-muted/30 border-t border-border/50 flex items-center gap-3",
        FOOTER_TEXT: "text-[10px] font-black text-muted-foreground tracking-[0.15em] uppercase opacity-60",
    },

    // 9. PERFIL DE USUARIO (PROFILE_LAYOUT)
    PROFILE_LAYOUT: {
        PAGE_WRAPPER: "h-full overflow-y-auto custom-scrollbar p-4",
        INNER_CONTAINER: "max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500",
        GRID: "grid grid-cols-1 lg:grid-cols-3 gap-4",
        LEFT_COLUMN: "lg:col-span-1 space-y-4",
        RIGHT_COLUMN: "lg:col-span-2 space-y-4",
        BANNER: "h-24 bg-gradient-to-br from-primary/80 to-primary relative overflow-hidden",
        BANNER_OVERLAY: "absolute inset-0 bg-white/10 opacity-30 backdrop-blur-3xl",
        AVATAR_CONTAINER: "flex flex-col items-center -mt-14 px-6 pb-6",
        AVATAR_RING: "w-28 h-28 rounded-full border-4 border-card bg-card flex items-center justify-center overflow-hidden shadow-xl ring-2 ring-primary/20",
        CAMERA_BUTTON: "absolute bottom-1 right-1 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 hover:scale-110 transition-all duration-200 ring-2 ring-card",
        ROLE_BADGE: "mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20",
        QUICK_INFO_CARD: "p-6 space-y-5",
        INFO_LIST: "space-y-4",
        INFO_ITEM: "flex items-center gap-4 group",
        INFO_ITEM_ICON_BASE: "w-10 h-10 rounded-cb-btn flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-all",
        INFO_ITEM_ICON_PRIMARY: "bg-primary/10 text-primary",
        INFO_ITEM_ICON_PURPLE: "bg-purple-500/10 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400",
        INFO_ITEM_ICON_EMERALD: "bg-emerald-500/10 dark:bg-emerald-950/20 text-[#05B169] dark:text-emerald-400",
        INFO_ITEM_DETAILS: "overflow-hidden",
        INFO_ITEM_LABEL: "text-[10px] text-cb-neutral uppercase tracking-wider font-bold",
        INFO_ITEM_VALUE: "text-sm font-bold truncate text-cb-text-primary",
        INFO_ITEM_VALUE_SUCCESS: "text-sm font-bold text-[#05B169] dark:text-emerald-400",
        FORM_SECTION_HEADER: "px-6 py-5 border-b border-cb-border bg-cb-bg/30",
        FORM_SECTION_TITLE: "text-sm font-bold flex items-center gap-2 text-cb-text-primary",
        FORM_SECTION_SUBTITLE: "text-xs text-cb-text-secondary mt-1",
        FORM_GRID: "grid grid-cols-1 sm:grid-cols-2 gap-5",
        FIELD_LABEL: "text-[11px] font-bold text-cb-neutral uppercase tracking-wider mb-2 block",
        FIELD_WRAPPER: "relative",
        FIELD_ICON: "absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cb-neutral/60",
        INPUT_DISABLED: "block w-full pl-10 pr-3 py-2.5 bg-cb-bg/60 border border-transparent rounded-cb-btn text-cb-text-secondary text-sm font-medium cursor-not-allowed",
        INPUT_ACTIVE: "block w-full pl-10 pr-3 py-2.5 bg-card border border-cb-border rounded-cb-btn focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all text-sm font-bold text-cb-text-primary",
        INPUT_ERROR: "border-[#DF2935] focus:border-[#DF2935] focus:ring-[#DF2935]/10 bg-[#FDECEE]/20",
        READONLY_ALERT: "p-3 bg-primary/5 dark:bg-primary/20 rounded-cb-btn border border-primary/20",
        READONLY_ALERT_TEXT: "text-[11px] text-primary dark:text-primary font-medium flex items-center gap-2",
        FORM_NOTE: "text-[11px] text-cb-text-secondary font-medium",
        STATUS_ALERT_BASE: "p-4 rounded-cb-btn flex items-center gap-3 text-sm font-bold shadow-sm animate-in fade-in duration-300",
        STATUS_ALERT_SUCCESS: "bg-[#E6F6EF] text-[#05B169] dark:bg-emerald-950/20 dark:text-emerald-400 border border-[#E6F6EF] dark:border-emerald-800",
        STATUS_ALERT_ERROR: "bg-[#FDECEE] text-[#DF2935] dark:bg-red-950/20 dark:text-red-400 border border-[#FDECEE] dark:border-red-800",
    }
};

export const CRYPTO_BLUE_THEME = SIATC_THEME;
