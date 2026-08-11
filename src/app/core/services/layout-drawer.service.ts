import { Injectable, signal, computed, Type } from '@angular/core';

export interface LayoutDrawerAction {
    label: string;
    icon: string;
    callback: () => void;
    llmAction?: string;
}

export interface LayoutDrawerState {
    isOpen: boolean;
    component: Type<any> | null;
    title: string;
    icon?: string;
    actions?: LayoutDrawerAction[];
    /** Texto corto en el header, ej. "Paso 2 de 6". */
    badge?: string | null;
}

/**
 * LayoutDrawerService — orquesta el drawer arquitectónico del AppShell.
 *
 * El panel convive con el `<main>` y desplaza el layout en desktop. Permite
 * renderizar componentes dinámicos y evita el parpadeo al cerrar: no limpia el
 * componente al instante, espera a que `LayoutDrawerComponent` termine la
 * animación de salida y recién ahí llama a `clear()`.
 *
 * Navegación interna: `open()` apila el estado anterior, así un drawer puede
 * abrir otro y `back()` vuelve al de antes sin cerrar el panel. Sin esto, entrar
 * a un detalle desde una lista obliga a cerrar y volver a abrir.
 */
@Injectable({
    providedIn: 'root'
})
export class LayoutDrawerService {
    private _state = signal<LayoutDrawerState>({
        isOpen: false,
        component: null,
        title: '',
        icon: undefined,
        actions: [],
        badge: null
    });

    /** Pila de estados anteriores dentro de la misma sesión de drawer. */
    private _history = signal<LayoutDrawerState[]>([]);

    // ── Selectores ───────────────────────────────────────────────────────────
    readonly state = this._state.asReadonly();
    readonly isOpen = computed(() => this._state().isOpen);
    readonly component = computed(() => this._state().component);
    readonly title = computed(() => this._state().title);
    readonly icon = computed(() => this._state().icon);
    readonly actions = computed(() => this._state().actions ?? []);
    readonly badge = computed(() => this._state().badge ?? null);
    readonly canGoBack = computed(() => this._history().length > 0);

    /**
     * Abre el drawer con un componente dinámico.
     *
     * Si ya estaba abierto, apila el estado actual: se está navegando hacia
     * adentro y `back()` tiene que poder volver. Si estaba cerrado, la pila
     * arranca vacía — abrir de cero no hereda el historial de la sesión previa.
     */
    open(component: Type<any>, title: string, icon?: string, actions?: LayoutDrawerAction[]): void {
        if (this._state().isOpen && this._state().component) {
            this._history.update((h) => [...h, { ...this._state() }]);
            this._state.update((s) => ({ ...s, component, title, icon, actions: actions ?? [], badge: null }));
            return;
        }
        this._history.set([]);
        this._state.set({ isOpen: true, component, title, icon, actions: actions ?? [], badge: null });
    }

    /** Vuelve al estado anterior de la pila. Sin historial no hace nada. */
    back(): void {
        const historia = this._history();
        const anterior = historia[historia.length - 1];
        if (!anterior) return;
        this._history.update((h) => h.slice(0, -1));
        this._state.set({ ...anterior, isOpen: true });
    }

    /** Actualiza las acciones del header con el drawer ya abierto. */
    setActions(actions: LayoutDrawerAction[]): void {
        this._state.update(s => ({ ...s, actions }));
    }

    /** Actualiza el badge del header, ej. el paso de un asistente. */
    setBadge(badge: string | null): void {
        this._state.update(s => ({ ...s, badge }));
    }

    /**
     * Arranca el cierre. NO limpia el componente: eso lo hace `clear()` cuando
     * la animación de salida terminó, para que no desaparezca de golpe.
     */
    close(): void {
        this._state.update(s => ({ ...s, isOpen: false }));
    }

    /** Destruye la vista renderizada. Se llama DESPUÉS de la salida de GSAP. */
    clear(): void {
        this._history.set([]);
        this._state.update(s => ({
            ...s,
            component: null,
            title: '',
            icon: undefined,
            actions: [],
            badge: null
        }));
    }
}
