import { useState, useEffect, useCallback, useRef } from 'react';

interface UseInactivityTimerOptions {
    timeoutMinutes: number;
    warningMinutes: number;
    onTimeout: () => void;
    enabled: boolean;
}

export function useInactivityTimer({ timeoutMinutes, warningMinutes, onTimeout, enabled }: UseInactivityTimerOptions) {
    const [showWarning, setShowWarning] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState(warningMinutes * 60);

    const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const warningTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const countdownRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const showWarningRef = useRef(false);
    const onTimeoutRef = useRef(onTimeout);
    const startTimersRef = useRef<() => void>(() => {});

    useEffect(() => { onTimeoutRef.current = onTimeout; });

    const clearAllTimers = useCallback(() => {
        clearTimeout(logoutTimerRef.current);
        clearTimeout(warningTimerRef.current);
        clearInterval(countdownRef.current);
    }, []);

    const stopTimers = useCallback(() => {
        clearAllTimers();
        setShowWarning(false);
        showWarningRef.current = false;
    }, [clearAllTimers]);

    const startTimers = useCallback(() => {
        stopTimers();

        const warningMs = Math.max(0, (timeoutMinutes - warningMinutes) * 60 * 1000);
        const logoutMs = timeoutMinutes * 60 * 1000;

        if (warningMs > 0) {
            warningTimerRef.current = setTimeout(() => {
                setShowWarning(true);
                showWarningRef.current = true;
                setRemainingSeconds(warningMinutes * 60);
                countdownRef.current = setInterval(() => {
                    setRemainingSeconds(prev => Math.max(0, prev - 1));
                }, 1000);
            }, warningMs);
        }

        logoutTimerRef.current = setTimeout(() => {
            clearAllTimers();
            onTimeoutRef.current();
        }, logoutMs);
    }, [timeoutMinutes, warningMinutes, clearAllTimers, stopTimers]);

    useEffect(() => { startTimersRef.current = startTimers; }, [startTimers]);

    const resetTimer = useCallback(() => {
        startTimersRef.current();
    }, []);

    useEffect(() => {
        if (!enabled) {
            stopTimers();
            return;
        }

        const activityEvents = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'] as const;
        const handleActivity = () => { if (!showWarningRef.current) startTimersRef.current(); };

        activityEvents.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
        startTimers();

        return () => {
            clearAllTimers();
            activityEvents.forEach(e => window.removeEventListener(e, handleActivity));
        };
    }, [enabled, startTimers, stopTimers, clearAllTimers]);

    return { showWarning, remainingSeconds, resetTimer };
}
