-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  avatar text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.stats (
  user_id uuid NOT NULL,
  total_earnings bigint DEFAULT 0,
  total_properties integer DEFAULT 0,
  games_played integer DEFAULT 0,
  highest_money bigint DEFAULT 0,
  wins integer DEFAULT 0,
  total_turns integer DEFAULT 0,
  xp integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stats_pkey PRIMARY KEY (user_id),
  CONSTRAINT stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  achievement_id text NOT NULL,
  unlocked_at timestamp with time zone DEFAULT now(),
  CONSTRAINT achievements_pkey PRIMARY KEY (id),
  CONSTRAINT achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.games (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  result_data jsonb NOT NULL,
  played_at timestamp with time zone DEFAULT now(),
  CONSTRAINT games_pkey PRIMARY KEY (id),
  CONSTRAINT games_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.store_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  price bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT store_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  item_id uuid,
  purchased_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchases_pkey PRIMARY KEY (id),
  CONSTRAINT purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT purchases_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.store_items(id),
  CONSTRAINT purchases_user_id_item_id_key UNIQUE(user_id, item_id)
);
CREATE TABLE public.friends (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  friend_id uuid,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT friends_pkey PRIMARY KEY (id),
  CONSTRAINT friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT friends_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.users(id)
);
CREATE TABLE public.lobby_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  status text DEFAULT 'searching'::text,
  matched_with uuid,
  created_at timestamp with time zone DEFAULT now(),
  session_id uuid,
  CONSTRAINT lobby_queue_pkey PRIMARY KEY (id),
  CONSTRAINT lobby_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT lobby_queue_matched_with_fkey FOREIGN KEY (matched_with) REFERENCES public.users(id),
  CONSTRAINT lobby_queue_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.game_sessions(id)
);
CREATE TABLE public.game_saves (
  user_id uuid NOT NULL,
  save_data jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_saves_pkey PRIMARY KEY (user_id),
  CONSTRAINT game_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.game_sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  host_user_id uuid,
  status text DEFAULT 'waiting'::text,
  mode text DEFAULT 'private'::text,
  state_data jsonb DEFAULT '{}'::jsonb,
  result_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT game_sessions_host_user_id_fkey FOREIGN KEY (host_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.game_session_players (
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'guest'::text,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_session_players_pkey PRIMARY KEY (session_id, user_id),
  CONSTRAINT game_session_players_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.game_sessions(id),
  CONSTRAINT game_session_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.game_session_events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid,
  user_id uuid,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT game_session_events_pkey PRIMARY KEY (id),
  CONSTRAINT game_session_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.game_sessions(id),
  CONSTRAINT game_session_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

-- ==========================================
-- GÜNCEL VERİTABANI FONKSİYONLARI (RPC)
-- Supabase SQL Editor üzerinde çalıştırılacak kodlar
-- ==========================================

-- 1. MAĞAZA SATIN ALMA FONKSİYONU (Sütun çakışması düzeltilmiş)
DROP FUNCTION IF EXISTS public.purchase_store_item(uuid, uuid);
CREATE OR REPLACE FUNCTION public.purchase_store_item(p_user_id UUID, p_item_id UUID)
RETURNS TABLE (out_purchase_id UUID, out_item_id UUID, out_balance BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_price BIGINT;
    v_purchase_id UUID;
    v_balance BIGINT;
BEGIN
    SELECT price INTO v_price
    FROM public.store_items
    WHERE id = p_item_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ITEM_NOT_FOUND';
    END IF;

    INSERT INTO public.purchases (user_id, item_id)
    VALUES (p_user_id, p_item_id)
    ON CONFLICT (user_id, item_id) DO NOTHING
    RETURNING id INTO v_purchase_id;

    IF v_purchase_id IS NULL THEN
        RAISE EXCEPTION 'ITEM_ALREADY_PURCHASED';
    END IF;

    UPDATE public.stats
    SET total_earnings = total_earnings - v_price,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND total_earnings >= v_price
    RETURNING total_earnings INTO v_balance;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    RETURN QUERY SELECT v_purchase_id, p_item_id, v_balance;
END;
$$;