-- =============================================================================
-- HOGAR — raíz de todo el sistema
--
-- Todo dato del hogar cuelga de `household_id` y se protege con RLS a través de
-- `belongs_to_household()` (RN-01). Este archivo define ese predicado, así que
-- ninguna migración posterior puede correr antes.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── households ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.households (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,
  invite_code  TEXT NOT NULL UNIQUE,
  timezone     TEXT NOT NULL DEFAULT 'America/Santiago',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── profiles ────────────────────────────────────────────────────────────────
-- 1:1 con auth.users. `household_id` es nullable: entre registrarse y crear o
-- unirse a un hogar hay un estado legítimo sin hogar.
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id  UUID REFERENCES public.households(id) ON DELETE SET NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_household ON public.profiles(household_id);

-- ─── Predicados de seguridad ─────────────────────────────────────────────────
-- SECURITY DEFINER + search_path fijo: sin esto, las policies que los invocan
-- entran en recursión al leer profiles (la policy de profiles usaría la función
-- que lee profiles).

CREATE OR REPLACE FUNCTION public.get_my_household_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.belongs_to_household(household_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_uuid IS NOT NULL
     AND household_uuid = public.get_my_household_id();
$$;

-- ─── Alta automática de perfil ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Crear hogar / unirse por código (REQ-001) ───────────────────────────────
-- El código se genera acá y no en el cliente: es la única forma de garantizar
-- unicidad sin exponer la tabla.

CREATE OR REPLACE FUNCTION public.create_household(p_nombre TEXT)
RETURNS public.households
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code       TEXT;
  v_household  public.households;
  v_intentos   INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Se requiere sesión iniciada';
  END IF;

  IF public.get_my_household_id() IS NOT NULL THEN
    RAISE EXCEPTION 'El perfil ya pertenece a un hogar';
  END IF;

  -- Código de 6 caracteres sin vocales ni dígitos ambiguos (0/O, 1/I): se dicta
  -- en voz alta o se copia a mano, así que la legibilidad importa más que la
  -- entropía. 28^6 ≈ 481M combinaciones para un puñado de hogares.
  LOOP
    v_intentos := v_intentos + 1;
    SELECT string_agg(substr('BCDFGHJKLMNPQRSTVWXYZ23456789', (random() * 28)::INT + 1, 1), '')
      INTO v_code
      FROM generate_series(1, 6);
    BEGIN
      INSERT INTO public.households (nombre, invite_code)
      VALUES (p_nombre, v_code)
      RETURNING * INTO v_household;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_intentos >= 10 THEN
        RAISE EXCEPTION 'No se pudo generar un código único';
      END IF;
    END;
  END LOOP;

  UPDATE public.profiles SET household_id = v_household.id, updated_at = now()
   WHERE id = auth.uid();

  RETURN v_household;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_household_by_code(p_code TEXT)
RETURNS public.households
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household public.households;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Se requiere sesión iniciada';
  END IF;

  IF public.get_my_household_id() IS NOT NULL THEN
    RAISE EXCEPTION 'El perfil ya pertenece a un hogar';
  END IF;

  SELECT * INTO v_household
    FROM public.households
   WHERE invite_code = upper(trim(p_code));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código de invitación inválido';
  END IF;

  UPDATE public.profiles SET household_id = v_household.id, updated_at = now()
   WHERE id = auth.uid();

  RETURN v_household;
END;
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;

-- El hogar se ve sólo desde adentro. No hay INSERT directo: se crea vía RPC,
-- que es lo único capaz de generar un código único.
DROP POLICY IF EXISTS households_select ON public.households;
CREATE POLICY households_select ON public.households
  FOR SELECT TO authenticated
  USING (public.belongs_to_household(id));

DROP POLICY IF EXISTS households_update ON public.households;
CREATE POLICY households_update ON public.households
  FOR UPDATE TO authenticated
  USING (public.belongs_to_household(id))
  WITH CHECK (public.belongs_to_household(id));

-- Cada quien ve su perfil y el de sus convivientes.
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.belongs_to_household(household_id));

-- Sólo el propio. `household_id` queda fuera del alcance del usuario: cambiarlo
-- es entrar o salir de un hogar, y eso pasa exclusivamente por los RPC.
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND household_id IS NOT DISTINCT FROM (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );
