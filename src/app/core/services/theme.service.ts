import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GsapAnimationsService } from './gsap-animations.service';
import { ToastService } from './toast.service';

export type ColorMode = 'light' | 'dark' | 'system';

/**
 * ThemeService - Gestión de modo claro/oscuro
 *
 * Modos: 'light' (por defecto) | 'dark' | 'system'
 *
 * El modo oscuro se aplica con [data-mode='dark'] en el documentElement.
 * Solo existe un color de marca (Azul Rey) definido en los tokens.
 *
 * Uso:
 * ```typescript
 * readonly themeService = inject(ThemeService);
 * readonly darkMode = this.themeService.darkMode;
 *
 * this.themeService.cycleColorMode(event);
 * this.themeService.setColorMode('dark');
 * ```
 */
@Injectable({
    providedIn: 'root',
})
export class ThemeService {
    private platformId = inject(PLATFORM_ID);
    private gsap = inject(GsapAnimationsService);
    private toast = inject(ToastService);

    private readonly STORAGE_KEY_MODE = 'app-color-mode';

    /** Si el modo oscuro está activo */
    readonly darkMode = signal<boolean>(false);

    /** true mientras dura la transición de tema — para deshabilitar el botón */
    readonly isThemeTransitioning = signal<boolean>(false);

    /** true cuando el modo sigue la preferencia del sistema */
    readonly syncWithSystem = signal<boolean>(false);

    private systemPreferenceListener: (() => void) | null = null;

    constructor() {
        this.initializeDarkMode();
        this.removeLegacyThemeAttribute();
    }

    /** Elimina data-theme legacy (rojo/azul) si existía en localStorage/DOM */
    private removeLegacyThemeAttribute(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        document.documentElement.removeAttribute('data-theme');
        localStorage.removeItem('app-theme');
    }

    // ─── Modo Oscuro / Claro ─────────────────────────────────────────────────

    private initializeDarkMode(): void {
        if (!isPlatformBrowser(this.platformId)) return;

        const saved = this.loadFromStorage(this.STORAGE_KEY_MODE);
        let isDark: boolean;

        if (saved === 'system') {
            this.syncWithSystem.set(true);
            isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.applyDarkModeToDOM(isDark);
            this.darkMode.set(isDark);
            this.setupSystemPreferenceListener();
        } else if (saved === 'dark') {
            isDark = true;
            this.applyDarkModeToDOM(isDark);
            this.darkMode.set(isDark);
        } else {
            isDark = false;
            this.applyDarkModeToDOM(isDark);
            this.darkMode.set(isDark);
        }
    }

    private setupSystemPreferenceListener(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.removeSystemPreferenceListener();
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            const isDark = mq.matches;
            this.darkMode.set(isDark);
            this.applyDarkModeToDOM(isDark);
        };
        mq.addEventListener('change', handler);
        this.systemPreferenceListener = () => mq.removeEventListener('change', handler);
    }

    private removeSystemPreferenceListener(): void {
        this.systemPreferenceListener?.();
        this.systemPreferenceListener = null;
    }

    /**
     * Cicla entre: light → dark → system → light. Un solo clic, sin menú.
     * @param clickEvent - Opcional: evento del clic para reveal circular desde el botón
     */
    cycleColorMode(clickEvent?: MouseEvent): void {
        if (!isPlatformBrowser(this.platformId)) return;
        if (this.isThemeTransitioning()) return;

        const next = this.getNextColorMode();
        const origin = clickEvent ? { x: clickEvent.clientX, y: clickEvent.clientY } : undefined;
        const newIsDark = next === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches : next === 'dark';

        this.isThemeTransitioning.set(true);
        this.gsap
            .animateThemeChange(
                () => this.applyColorMode(next),
                origin
            )
            .finally(() => {
                this.isThemeTransitioning.set(false);
                this.showThemeToast(newIsDark, next === 'system');
            });
    }

    /** Siguiente modo en el ciclo: light → dark → system → light */
    private getNextColorMode(): ColorMode {
        if (this.syncWithSystem()) return 'light';
        return this.darkMode() ? 'system' : 'dark';
    }

    private applyColorMode(mode: ColorMode): void {
        if (mode === 'system') {
            this.removeSystemPreferenceListener();
            this.syncWithSystem.set(true);
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.darkMode.set(isDark);
            this.applyDarkModeToDOM(isDark);
            this.saveToStorage(this.STORAGE_KEY_MODE, 'system');
            this.setupSystemPreferenceListener();
        } else {
            this.removeSystemPreferenceListener();
            this.syncWithSystem.set(false);
            const isDark = mode === 'dark';
            this.darkMode.set(isDark);
            this.applyDarkModeToDOM(isDark);
            this.saveToStorage(this.STORAGE_KEY_MODE, mode);
        }
    }

    /**
     * Establece el modo explícitamente (para API externa).
     * @param mode - 'light' | 'dark' | 'system'
     */
    setColorMode(mode: ColorMode): void {
        if (!isPlatformBrowser(this.platformId)) return;
        if (this.isThemeTransitioning()) return;
        if (mode === 'system' && this.syncWithSystem()) return;
        if (mode === 'light' && !this.darkMode() && !this.syncWithSystem()) return;
        if (mode === 'dark' && this.darkMode() && !this.syncWithSystem()) return;
        this.isThemeTransitioning.set(true);
        this.gsap
            .animateThemeChange(() => this.applyColorMode(mode))
            .finally(() => {
                this.isThemeTransitioning.set(false);
                this.showThemeToast(this.darkMode(), mode === 'system');
            });
    }

    private showThemeToast(isDark: boolean, isSystem = false): void {
        const msg = isSystem
            ? 'Siguiendo preferencia del sistema'
            : isDark
              ? 'Modo oscuro activado'
              : 'Modo claro activado';
        this.toast.info(msg);
    }

    private applyDarkModeToDOM(isDark: boolean): void {
        if (!isPlatformBrowser(this.platformId)) return;
        if (isDark) {
            document.documentElement.setAttribute('data-mode', 'dark');
        } else {
            document.documentElement.removeAttribute('data-mode');
        }
    }

    // ─── Utilidades ──────────────────────────────────────────────────────────

    private loadFromStorage(key: string): string | null {
        if (!isPlatformBrowser(this.platformId)) return null;
        const value = localStorage.getItem(key);
        // SEC: whitelist — nunca confiar ciegamente en valores de localStorage.
        // Si alguien inyecta un valor arbitrario (vía XSS previo u otro script),
        // el fallback 'null' hace que el tema vuelva a 'light' de forma segura.
        const VALID_MODES: ReadonlySet<string> = new Set(['light', 'dark', 'system']);
        return value !== null && VALID_MODES.has(value) ? value : null;
    }

    private saveToStorage(key: string, value: string): void {
        if (!isPlatformBrowser(this.platformId)) return;
        localStorage.setItem(key, value);
    }
}
