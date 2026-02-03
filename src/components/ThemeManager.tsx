import React, { useEffect } from 'react';
import { APP_CONFIG } from '@shared/config';

export const ThemeManager: React.FC = () => {
    useEffect(() => {
        const root = document.documentElement;
        const { theme } = APP_CONFIG;

        // Colors
        root.style.setProperty('--color-bg', theme.background);
        root.style.setProperty('--color-surface', theme.surface);
        root.style.setProperty('--color-text-main', theme.textMain);
        root.style.setProperty('--color-text-muted', theme.textMuted);
        root.style.setProperty('--color-primary', theme.primary);
        root.style.setProperty('--color-secondary', theme.secondary);
        root.style.setProperty('--color-accent', theme.accent);
        root.style.setProperty('--color-border', theme.border);

        // Radius
        root.style.setProperty('--radius-sm', theme.radius.sm);
        root.style.setProperty('--radius-md', theme.radius.md);
        root.style.setProperty('--radius-lg', theme.radius.lg);

    }, []);

    return null;
};
