import { Injectable, signal, computed, inject } from "@angular/core";
import { Router } from "@angular/router";
import type { User } from "@core/models/user.model";
import { getInitialsFromDisplayName } from "@core/models/user.model";
import { SupabaseService } from "./supabase.service";
import { ProfilesRepository } from "@core/repositories/profiles.repository";

/**
 * AuthFacade - Facade de autenticación con Supabase.
 *
 * Actúa como capa intermedia entre la UI y SupabaseService.
 * Mantiene el estado de sesión como Signals y expone métodos de autenticación.
 * La UI inyecta AuthFacade; nunca inyecta SupabaseService directamente.
 */
@Injectable({
  providedIn: "root",
})
export class AuthFacade {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private profilesRepo = inject(ProfilesRepository);

  private _currentUser = signal<User | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  /** Resuelve cuando la comprobación inicial de sesión ha terminado (para guards). */
  readonly whenReady: Promise<void>;

  constructor() {
    let resolveReady!: () => void;
    this.whenReady = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    // El callback debe ser async: supabase-js tipa onAuthStateChange como
    // `(event, session) => Promise<void>`, y un callback sincrónico no asigna.
    this.supabase.onAuthStateChange(async (event, session) => {
      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        session?.user
      ) {
        await this.loadUserFromSession(session.user);
      } else if (event === "SIGNED_OUT") {
        this._currentUser.set(null);
      }
    });

    this.supabase
      .getUser()
      .then(async ({ data: { user } }: any) => {
        if (user) await this.loadUserFromSession(user);
      })
      .finally(() => resolveReady());
  }

  private async loadUserFromSession(authUser: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }): Promise<void> {
    const profile = await this.profilesRepo.findById(authUser.id);

    const name =
      profile?.display_name ??
      (authUser.user_metadata?.["display_name"] as string | undefined) ??
      (authUser.email ? authUser.email.split("@")[0] : "Usuario");

    const user: User = {
      id: authUser.id,
      name,
      email: authUser.email ?? "",
      role: profile?.role === "admin" ? "admin" : "member",
      initials: getInitialsFromDisplayName(name),
      avatarUrl: profile?.avatar_url ?? undefined,
    };
    this._currentUser.set(user);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.signIn(email, password);
    return { error: error ?? null };
  }

  async signUp(
    email: string,
    password: string,
    options?: { data?: Record<string, unknown> },
  ): Promise<{
    data: { user?: { id: string } | null; session?: unknown } | null;
    error: Error | null;
  }> {
    const result = await this.supabase.signUp(email, password, options);
    return {
      data: result.data
        ? {
            user: result.data.user ?? undefined,
            session: result.data.session ?? undefined,
          }
        : null,
      error: (result.error as Error) ?? null,
    };
  }

  async resetPasswordForEmail(email: string): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.resetPasswordForEmail(email);
    return { error: (error as Error) ?? null };
  }

  /**
   * Cierra la sesión en Supabase y limpia el estado local.
   * SEC: await garantiza que el token sea revocado antes de redirigir.
   * Si signOut() falla (red caída), el estado local se limpia igualmente
   * y se redirige — el token expirará naturalmente en el servidor.
   */
  async logout(): Promise<void> {
    try {
      await this.supabase.signOut();
    } finally {
      this._currentUser.set(null);
      this.router.navigate(["/"]);
    }
  }

  /**
   * @internal Solo para tests unitarios y casos de edge documentados.
   * No usar en componentes de producción — el estado se actualiza
   * automáticamente vía onAuthStateChange().
   */
  setUser(user: User | null): void {
    this._currentUser.set(user);
  }
}
