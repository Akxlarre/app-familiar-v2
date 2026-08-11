import { Injectable } from "@angular/core";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.anonKey,
    );
  }

  /**
   * Acceso al cliente Supabase para queries de base de datos.
   * SOLO para uso en Repositories (core/repositories/).
   * Los Facades nunca llaman .db directamente — inyectan un Repository.
   */
  get db(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Suscribe a los cambios de estado de autenticación.
   * Solo para uso en AuthFacade — las Facades de dominio no necesitan este método.
   */
  onAuthStateChange(
    callback: Parameters<SupabaseClient["auth"]["onAuthStateChange"]>[0],
  ) {
    return this.supabase.auth.onAuthStateChange(callback);
  }

  // ── Auth convenience methods ────────────────────────────────────────────

  async signUp(
    email: string,
    password: string,
    options?: { data?: Record<string, unknown> },
  ) {
    return await this.supabase.auth.signUp({ email, password, options });
  }

  async signIn(email: string, password: string) {
    return await this.supabase.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    return await this.supabase.auth.signOut();
  }

  async getUser() {
    return await this.supabase.auth.getUser();
  }

  /** Sesión actual (para interceptor HTTP). Refresca si está expirada. */
  async getSession() {
    return await this.supabase.auth.getSession();
  }

  /** Refresca la sesión con el refresh token (para interceptor en 401). */
  async refreshSession() {
    return await this.supabase.auth.refreshSession();
  }

  async resetPasswordForEmail(email: string) {
    return await this.supabase.auth.resetPasswordForEmail(email);
  }
}
