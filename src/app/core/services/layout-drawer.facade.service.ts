import { Injectable, inject, Type } from '@angular/core';
import { LayoutDrawerService, type LayoutDrawerAction } from './layout-drawer.service';

/**
 * LayoutDrawerFacadeService — Interfaz pública para componentes UI.
 * Expone señales de solo lectura y métodos de acción hacia LayoutDrawerService.
 * Requisito de arquitectura: Componentes usan Facades, nunca Services directamente.
 */
@Injectable({
    providedIn: 'root'
})
export class LayoutDrawerFacadeService {
    private readonly layoutDrawer = inject(LayoutDrawerService);

    readonly isOpen = this.layoutDrawer.isOpen;
    readonly component = this.layoutDrawer.component;
    readonly title = this.layoutDrawer.title;
    readonly icon = this.layoutDrawer.icon;
    readonly actions = this.layoutDrawer.actions;

    /**
     * @param inputs Valores para los `input()` del componente, por nombre. Es lo
     *               que permite abrir el detalle de un registro concreto.
     */
    open(
        component: Type<unknown>,
        title: string,
        icon?: string,
        actions?: LayoutDrawerAction[],
        inputs?: Record<string, unknown>
    ): void {
        this.layoutDrawer.open(component, title, icon, actions, inputs);
    }

    setActions(actions: LayoutDrawerAction[]): void {
        this.layoutDrawer.setActions(actions);
    }

    close(): void {
        this.layoutDrawer.close();
    }
}
