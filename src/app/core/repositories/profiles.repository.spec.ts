import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ProfilesRepository } from './profiles.repository';
import { SupabaseService } from '@core/services/supabase.service';

// ── Builder del mock de la cadena Supabase ────────────────────────────────────

function buildClientMock(maybeSingleResult: { data: unknown }) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue(maybeSingleResult),
        }),
      }),
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProfilesRepository', () => {
  let repo: ProfilesRepository;
  let clientMock: ReturnType<typeof buildClientMock>;

  /**
   * Configura el TestBed con un mock de cliente y devuelve el repo.
   *
   * `TestBed.overrideProvider()` NO sirve una vez que el módulo fue instanciado
   * (y `TestBed.inject()` lo instancia), así que los tests que necesitan otro
   * mock resetean el módulo y lo reconfiguran desde cero con este helper.
   */
  function configureWith(db: unknown): ProfilesRepository {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { db } }],
    });
    return TestBed.inject(ProfilesRepository);
  }

  beforeEach(() => {
    clientMock = buildClientMock({ data: null });
    repo = configureWith(clientMock);
  });

  it('should be created', () => {
    expect(repo).toBeTruthy();
  });

  describe('findById()', () => {
    it('should query the profiles table with the given userId', async () => {
      await repo.findById('user-123');
      expect(clientMock.from).toHaveBeenCalledWith('profiles');
    });

    it('no pide columnas que la tabla no tiene', async () => {
      // Pedía `role`, que `profiles` no tiene: este hogar no tiene jerarquía
      // (REQ-001) y el ROADMAP archivó el rol de administrador. PostgREST
      // devolvía 400 en cada carga de perfil, y este test lo daba por bueno.
      await repo.findById('user-123');
      const selectMock = clientMock.from('profiles').select;
      expect(selectMock).toHaveBeenCalledWith('display_name, avatar_url');
    });

    it('should filter by the given userId', async () => {
      await repo.findById('user-123');
      const eqMock = clientMock.from('profiles').select('').eq;
      expect(eqMock).toHaveBeenCalledWith('id', 'user-123');
    });

    it('should return the profile data when found', async () => {
      const mockProfile = { display_name: 'Ada Lovelace', avatar_url: null, role: 'member' };
      clientMock = buildClientMock({ data: mockProfile });
      repo = configureWith(clientMock);

      const result = await repo.findById('user-123');
      expect(result).toEqual(mockProfile);
    });

    it('should return null when no profile is found', async () => {
      const result = await repo.findById('unknown-user');
      expect(result).toBeNull();
    });

    it('should return null when the query throws', async () => {
      const brokenClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockRejectedValue(new Error('DB error')),
            }),
          }),
        }),
      };
      repo = configureWith(brokenClient);

      const result = await repo.findById('user-123');
      expect(result).toBeNull();
    });
  });
});
