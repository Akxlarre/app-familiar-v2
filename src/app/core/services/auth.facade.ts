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
    this.perfilCargadoDe = null;
      }
    });

    this.supabase
      .getUser()
      .then(async ({ data: { user } }: any) => {
        if (user) await this.loadUserFromSession(user);
      })
      .finally(() => resolveReady());
  }

  /**
   * De qué usuario ya se cargó el perfil.
   *
   * `onAuthStateChange` dispara varias veces por sesión —INITIAL_SESSION,
   * SIGNED_IN, TOKEN_REFRESHED— y `getUser()` suma la suya, así que el perfil
   * se pedía tres veces por carga. Lo destapó el test de volumen de la spec
   * 0005, contando las consultas que la app hace de verdad.
   */
  private perfilCargadoDe: string | null = null;

  /**
   * La carga en curso, para que dos disparadores simultáneos compartan una sola
   * consulta.
   *
   * `getUser()` y `onAuthStateChange` arrancan a la vez, así que ambos veían el
   * caché vacío y pedían el perfil por su cuenta: un caché por sí solo baja de
   * tres consultas a dos, no a una.
   */
  private cargaEnVuelo: Promise<void> | null = null;

  private loadUserFromSession(authUser: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }): Promise<void> {
    // El perfil sólo cambia cuando el usuario lo edita, y eso pasa por
    // `refreshProfile()`. Un TOKEN_REFRESHED no trae datos nuevos.
    if (this.perfilCargadoDe === authUser.id && this._currentUser()) return Promise.resolve();
    if (this.cargaEnVuelo) return this.cargaEnVuelo;

    this.cargaEnVuelo = this.cargarPerfil(authUser).finally(() => {
      this.cargaEnVuelo = null;
    });
    return this.cargaEnVuelo;
  }

  private async cargarPerfil(authUser: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }): Promise<void> {
    const profile = await this.profilesRepo.findById(authUser.id);
    this.perfilCargadoDe = authUser.id;

    const name =
      profile?.display_name ??
      (authUser.user_metadata?.["display_name"] as string | undefined) ??
      (authUser.email ? authUser.email.split("@")[0] : "Usuario");

    const user: User = {
      id: authUser.id,
      name,
      email: authUser.email ?? "",
      // Siempre "member": este hogar no tiene jerarquía. REQ-001 dice dos
      // personas con los mismos permisos, y el ROADMAP archivó el rol de
      // administrador a propósito. `profiles` no tiene columna `role` — pedirla
      // devolvía 400 en cada carga de perfil.
      role: "member",
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
