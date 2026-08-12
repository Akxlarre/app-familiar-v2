import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { HogaresRepository } from '@core/repositories/hogares.repository';
import { onboardingCompleto } from '@core/models/hogar.model';

/**
 * Guards espejo del onboarding.
 *
 * `hogarGuard` protege la app de usuarios sin configurar; `onboardingGuard`
 * protege el onboarding de usuarios ya configurados. Hacen falta los dos: con
 * el primero solo, alguien puede volver al onboarding por URL y crear un
 * segundo hogar; con el segundo solo, a quien no tiene nada se le muestran
 * pantallas vacías.
 *
 * Ambos **fallan hacia adelante**: si la consulta revienta, dejan pasar. Un
 * guard que bloquea cuando la red falla deja al usuario encerrado sin forma de
 * salir, y lo que hay detrás ya está protegido por RLS.
 */
export const hogarGuard: CanActivateFn = async () => {
  const router = inject(Router);
  try {
    const estado = await inject(HogaresRepository).estadoDeOnboarding();
    return onboardingCompleto(estado) ? true : router.createUrlTree(['/onboarding']);
  } catch {
    return true;
  }
};

/** Con el onboarding terminado, `/onboarding` ya no tiene nada que hacer (AC-E2). */
export const onboardingGuard: CanActivateFn = async () => {
  const router = inject(Router);
  try {
    const estado = await inject(HogaresRepository).estadoDeOnboarding();
    return onboardingCompleto(estado) ? router.createUrlTree(['/app/hoy']) : true;
  } catch {
    return true;
  }
};
