-- Football Tour Simulator - initial Supabase schema
-- Run this file on a fresh Supabase/PostgreSQL database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE CHECK (username ~ '^[A-Za-z0-9_]{3,24}$'),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  avatar text
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON public.users (lower(email));

CREATE TABLE IF NOT EXISTS public.stats (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  total_earnings bigint NOT NULL DEFAULT 0 CHECK (total_earnings >= 0),
  total_properties integer NOT NULL DEFAULT 0 CHECK (total_properties >= 0),
  games_played integer NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  highest_money bigint NOT NULL DEFAULT 0 CHECK (highest_money >= 0),
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  total_turns integer NOT NULL DEFAULT 0 CHECK (total_turns >= 0),
  xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL CHECK (achievement_id ~ '^[A-Z0-9_]{1,64}$'),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  result_data jsonb NOT NULL CHECK (jsonb_typeof(result_data) = 'object'),
  played_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  price bigint NOT NULL CHECK (price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.store_items(id) ON DELETE RESTRICT,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS public.friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id <> friend_id),
  UNIQUE (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished', 'cancelled')),
  mode text NOT NULL DEFAULT 'private' CHECK (mode IN ('private', 'matchmaking')),
  state_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(state_data) = 'object'),
  result_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result_data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.game_session_players (
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'guest' CHECK (role IN ('host', 'guest')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_host_per_session_idx
  ON public.game_session_players (session_id) WHERE role = 'host';

CREATE TABLE IF NOT EXISTS public.game_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lobby_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'searching' CHECK (status IN ('searching', 'waiting_private', 'matched', 'cancelled')),
  matched_with uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id uuid REFERENCES public.game_sessions(id) ON DELETE SET NULL,
  CHECK (matched_with IS NULL OR matched_with <> user_id)
);

CREATE TABLE IF NOT EXISTS public.game_saves (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  save_data jsonb NOT NULL CHECK (jsonb_typeof(save_data) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_session_events_session_created_idx
  ON public.game_session_events (session_id, created_at);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON public.password_reset_tokens (user_id, expires_at);

INSERT INTO public.store_items (name, type, price)
SELECT * FROM (VALUES
  ('Altın Piyon Kutusu', 'Kutu', 1500::bigint),
  ('Efsanevi Stadyum Teması', 'Tema', 5000::bigint),
  ('Elmas Zar Görünümü', 'Zar', 3000::bigint),
  ('VIP Oyuncu Rozeti', 'Rozet', 10000::bigint)
) AS seed(name, type, price)
WHERE NOT EXISTS (SELECT 1 FROM public.store_items);

CREATE OR REPLACE FUNCTION public.purchase_store_item(p_user_id uuid, p_item_id uuid)
RETURNS TABLE (out_purchase_id uuid, out_item_id uuid, out_balance bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price bigint;
  v_purchase_id uuid;
  v_balance bigint;
BEGIN
  IF p_user_id IS NULL OR p_item_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT';
  END IF;

  SELECT price INTO v_price
  FROM public.store_items
  WHERE id = p_item_id
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;

  SELECT total_earnings INTO v_balance
  FROM public.stats
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STATS_NOT_FOUND'; END IF;
  IF v_balance < v_price THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;

  INSERT INTO public.purchases (user_id, item_id)
  VALUES (p_user_id, p_item_id)
  ON CONFLICT (user_id, item_id) DO NOTHING
  RETURNING id INTO v_purchase_id;
  IF v_purchase_id IS NULL THEN RAISE EXCEPTION 'ITEM_ALREADY_PURCHASED'; END IF;

  UPDATE public.stats
  SET total_earnings = v_balance - v_price, updated_at = now()
  WHERE user_id = p_user_id
  RETURNING total_earnings INTO v_balance;

  RETURN QUERY SELECT v_purchase_id, p_item_id, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_store_item(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_store_item(uuid, uuid) TO service_role;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobby_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_select ON public.users;
CREATE POLICY users_self_select ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS stats_self_select ON public.stats;
CREATE POLICY stats_self_select ON public.stats FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS achievements_self_access ON public.achievements;
CREATE POLICY achievements_self_access ON public.achievements FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS games_self_access ON public.games;
CREATE POLICY games_self_access ON public.games FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS purchases_self_access ON public.purchases;
CREATE POLICY purchases_self_access ON public.purchases FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS friends_self_access ON public.friends;
CREATE POLICY friends_self_access ON public.friends FOR SELECT TO authenticated USING (user_id = auth.uid() OR friend_id = auth.uid());
DROP POLICY IF EXISTS store_items_public_read ON public.store_items;
CREATE POLICY store_items_public_read ON public.store_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS sessions_participant_read ON public.game_sessions;
CREATE POLICY sessions_participant_read ON public.game_sessions FOR SELECT TO authenticated
  USING (host_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.game_session_players p WHERE p.session_id = id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS session_players_participant_read ON public.game_session_players;
CREATE POLICY session_players_participant_read ON public.game_session_players FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS session_events_participant_read ON public.game_session_events;
CREATE POLICY session_events_participant_read ON public.game_session_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS saves_self_access ON public.game_saves;
CREATE POLICY saves_self_access ON public.game_saves FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- The backend uses service_role and performs authorization in Express.
-- No anon/authenticated write policy is intentionally granted for economy data.
