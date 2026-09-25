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
-- Şifre sıfırlanınca artırılır; eski oturum token'ları (farklı sürüm taşıyan) geçersiz olur.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

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

-- Stats are created by the database so a partially failed API request cannot
-- leave a valid user without an economy row.
CREATE OR REPLACE FUNCTION public.create_default_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stats (user_id, total_earnings)
  VALUES (NEW.id, 2000)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'users_create_default_stats'
      AND tgrelid = 'public.users'::regclass
  ) THEN
    CREATE TRIGGER users_create_default_stats
      AFTER INSERT ON public.users
      FOR EACH ROW EXECUTE FUNCTION public.create_default_stats();
  END IF;
END $$;

INSERT INTO public.stats (user_id, total_earnings)
SELECT id, 2000 FROM public.users
ON CONFLICT (user_id) DO NOTHING;

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
  sku text UNIQUE,
  name text NOT NULL,
  type text NOT NULL,
  price bigint NOT NULL CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'COIN' CHECK (currency IN ('COIN', 'USD')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_items_sku_key' AND conrelid = 'public.store_items'::regclass) THEN
    ALTER TABLE public.store_items ADD CONSTRAINT store_items_sku_key UNIQUE (sku);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_items' AND column_name = 'currency') THEN
    ALTER TABLE public.store_items ADD COLUMN currency text NOT NULL DEFAULT 'COIN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_items' AND column_name = 'is_active') THEN
    ALTER TABLE public.store_items ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.store_items(id) ON DELETE RESTRICT,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS public.character_entitlements (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  character_key text NOT NULL CHECK (character_key IN ('architect', 'king', 'viking', 'rocket', 'wizard')),
  source text NOT NULL CHECK (source IN ('starter', 'coin_purchase', 'admin', 'promo')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, character_key)
);

CREATE TABLE IF NOT EXISTS public.starter_character_claims (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  character_key text NOT NULL CHECK (character_key IN ('viking', 'rocket')),
  claimed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount bigint NOT NULL CHECK (amount <> 0),
  entry_type text NOT NULL CHECK (entry_type IN ('purchase', 'character_purchase', 'starter', 'admin', 'refund', 'promo')),
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_type, reference_id)
);

CREATE TABLE IF NOT EXISTS public.coin_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pack_key text NOT NULL,
  coins bigint NOT NULL CHECK (coins > 0),
  amount_usd_cents integer NOT NULL CHECK (amount_usd_cents > 0),
  provider text NOT NULL DEFAULT 'stripe',
  provider_session_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.coin_pack_catalog (
  pack_key text PRIMARY KEY,
  coins bigint NOT NULL CHECK (coins > 0),
  amount_usd_cents integer NOT NULL CHECK (amount_usd_cents > 0),
  is_active boolean NOT NULL DEFAULT true
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchases_user_item_key'
      AND conrelid = 'public.purchases'::regclass
  ) THEN
    ALTER TABLE public.purchases
    ADD CONSTRAINT purchases_user_item_key UNIQUE (user_id, item_id);
  END IF;
END $$;

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

ALTER TABLE public.lobby_queue ADD COLUMN IF NOT EXISTS last_seen timestamptz NOT NULL DEFAULT now();
-- Özel oda kodu: yalnızca kodu bilen (ya da oda sahibinden davet almış) oyuncu katılabilir.
ALTER TABLE public.lobby_queue ADD COLUMN IF NOT EXISTS room_code text;
CREATE INDEX IF NOT EXISTS lobby_queue_searching_idx ON public.lobby_queue (status, created_at);

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

UPDATE public.store_items SET sku = 'legacy_' || id::text WHERE sku IS NULL;

INSERT INTO public.store_items (sku, name, type, price, currency)
VALUES
  ('legacy_gold_pawn_box', 'Altın Piyon Kutusu', 'Kutu', 300, 'COIN'),
  ('legacy_stadium_theme', 'Efsanevi Stadyum Teması', 'Tema', 300, 'COIN'),
  ('legacy_diamond_dice', 'Elmas Zar Görünümü', 'Zar', 300, 'COIN'),
  ('legacy_vip_badge', 'VIP Oyuncu Rozeti', 'Rozet', 300, 'COIN')
ON CONFLICT (sku) DO UPDATE SET price = EXCLUDED.price, type = EXCLUDED.type;

INSERT INTO public.store_items (sku, name, type, price, currency)
VALUES
  ('player_architect', 'The Architect', 'Player', 500, 'COIN'),
  ('player_king', 'The King', 'Player', 500, 'COIN'),
  ('player_viking', 'The Viking', 'Player', 300, 'COIN'),
  ('player_rocket', 'The Rocket', 'Player', 300, 'COIN'),
  ('player_wizard', 'The Wizard', 'Player', 300, 'COIN')
ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, price = EXCLUDED.price, currency = EXCLUDED.currency, is_active = true;

UPDATE public.coin_pack_catalog
SET is_active = false
WHERE pack_key IN ('coins_1100', 'coins_2500');

INSERT INTO public.coin_pack_catalog (pack_key, coins, amount_usd_cents)
VALUES
  ('coins_100', 100, 150),
  ('coins_300', 300, 400),
  ('coins_500', 500, 500),
  ('coins_1000', 1000, 800)
ON CONFLICT (pack_key) DO UPDATE SET coins = EXCLUDED.coins, amount_usd_cents = EXCLUDED.amount_usd_cents, is_active = true;

CREATE OR REPLACE FUNCTION public.purchase_store_item(p_user_id uuid, p_item_id uuid)
RETURNS TABLE (out_purchase_id uuid, out_item_id uuid, out_balance bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price bigint;
  v_type text;
  v_sku text;
  v_purchase_id uuid;
  v_balance bigint;
BEGIN
  IF p_user_id IS NULL OR p_item_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT';
  END IF;

  SELECT price, type, sku INTO v_price, v_type, v_sku
  FROM public.store_items
  WHERE id = p_item_id AND is_active = true AND currency = 'COIN'
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

  IF v_type = 'Player' THEN
    INSERT INTO public.character_entitlements (user_id, character_key, source)
    VALUES (p_user_id, replace(v_sku, 'player_', ''), 'coin_purchase')
    ON CONFLICT (user_id, character_key) DO NOTHING;
    INSERT INTO public.coin_ledger (user_id, amount, entry_type, reference_id)
    VALUES (p_user_id, -v_price, 'character_purchase', v_purchase_id::text)
    ON CONFLICT (entry_type, reference_id) DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_purchase_id, p_item_id, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_store_item(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_store_item(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_starter_character(p_user_id uuid, p_character_key text)
RETURNS TABLE (character_key text, already_claimed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_character_key NOT IN ('viking', 'rocket') THEN
    RAISE EXCEPTION 'INVALID_STARTER_CHARACTER';
  END IF;

  INSERT INTO public.starter_character_claims (user_id, character_key)
  VALUES (p_user_id, p_character_key)
  ON CONFLICT ON CONSTRAINT starter_character_claims_pkey DO NOTHING;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STARTER_ALREADY_CLAIMED';
  END IF;

  INSERT INTO public.character_entitlements (user_id, character_key, source)
  VALUES (p_user_id, p_character_key, 'starter')
  ON CONFLICT ON CONSTRAINT character_entitlements_pkey DO NOTHING;

  RETURN QUERY SELECT p_character_key, false;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_starter_character(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_starter_character(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.credit_coin_purchase(
  p_session_id text,
  p_user_id uuid,
  p_pack_key text,
  p_coins bigint,
  p_amount_usd_cents integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance bigint;
  v_order coin_orders%ROWTYPE;
  v_pack coin_pack_catalog%ROWTYPE;
BEGIN
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_coins IS NULL OR p_coins <= 0 THEN
    RAISE EXCEPTION 'INVALID_COIN_PURCHASE';
  END IF;

  SELECT * INTO v_pack FROM public.coin_pack_catalog
  WHERE pack_key = p_pack_key AND is_active = true FOR SHARE;
  IF NOT FOUND OR v_pack.coins <> p_coins OR v_pack.amount_usd_cents <> p_amount_usd_cents THEN
    RAISE EXCEPTION 'COIN_PACK_MISMATCH';
  END IF;

  SELECT * INTO v_order FROM public.coin_orders
  WHERE provider_session_id = p_session_id FOR UPDATE;

  IF FOUND AND (v_order.user_id <> p_user_id OR v_order.coins <> p_coins OR v_order.amount_usd_cents <> p_amount_usd_cents) THEN
    RAISE EXCEPTION 'COIN_ORDER_MISMATCH';
  END IF;

  INSERT INTO public.coin_ledger (user_id, amount, entry_type, reference_id)
  VALUES (p_user_id, p_coins, 'purchase', p_session_id)
  ON CONFLICT (entry_type, reference_id) DO NOTHING;

  IF FOUND THEN
    UPDATE public.stats
    SET total_earnings = total_earnings + p_coins, updated_at = now()
    WHERE user_id = p_user_id
    RETURNING total_earnings INTO v_balance;
    IF NOT FOUND THEN RAISE EXCEPTION 'STATS_NOT_FOUND'; END IF;
  ELSE
    SELECT total_earnings INTO v_balance FROM public.stats WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.coin_orders (user_id, pack_key, coins, amount_usd_cents, provider_session_id, status, paid_at)
  VALUES (p_user_id, p_pack_key, p_coins, p_amount_usd_cents, p_session_id, 'paid', now())
  ON CONFLICT (provider_session_id) DO UPDATE SET status = 'paid', paid_at = COALESCE(public.coin_orders.paid_at, now());

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_coin_purchase(text, uuid, text, bigint, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_coin_purchase(text, uuid, text, bigint, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Canlı eşleştirme
-- ---------------------------------------------------------------------------
-- RETURNS TABLE sütunları (status, avatar, session_id) PL/pgSQL içinde değişken
-- olarak da görünür. "#variable_conflict use_column" olmadan tablo sütunlarıyla
-- çakışır ve fonksiyon "column reference is ambiguous" hatasıyla hiç çalışmaz.
--
-- Kuyruk kaydı, sahibi lobi durumunu yokladığı sürece (last_seen) canlı sayılır.
-- Tarayıcıyı kapatan oyuncu en geç matchmaking_stale_after() sonra eşleşmez.
-- Tüm eşleştirme fonksiyonları aynı advisory lock'u alır; böylece aynı anda
-- kuyruğa giren iki oyuncu birbirini kaçırmaz ve bir rakip iki oturuma atanamaz.

CREATE OR REPLACE FUNCTION public.matchmaking_stale_after()
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$ SELECT interval '20 seconds' $$;

CREATE OR REPLACE FUNCTION public.try_match_player(p_user_id uuid)
RETURNS TABLE (status text, matched_username text, avatar text, session_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_opponent_id uuid;
  v_session_id uuid;
  v_username text;
  v_avatar text;
BEGIN
  SELECT q.user_id INTO v_opponent_id
  FROM public.lobby_queue q
  WHERE q.status = 'searching'
    AND q.user_id <> p_user_id
    AND q.last_seen > now() - public.matchmaking_stale_after()
  ORDER BY q.created_at
  LIMIT 1
  FOR UPDATE;

  IF v_opponent_id IS NULL THEN
    RETURN QUERY SELECT 'searching'::text, NULL::text, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  -- Kuyrukta daha uzun bekleyen oyuncu host olur ve oyunu başlatır.
  INSERT INTO public.game_sessions (host_user_id, status, mode)
  VALUES (v_opponent_id, 'active', 'matchmaking')
  RETURNING id INTO v_session_id;

  INSERT INTO public.game_session_players (session_id, user_id, role)
  VALUES (v_session_id, v_opponent_id, 'host'), (v_session_id, p_user_id, 'guest');

  UPDATE public.lobby_queue q
  SET status = 'matched', matched_with = p_user_id, session_id = v_session_id
  WHERE q.user_id = v_opponent_id;
  UPDATE public.lobby_queue q
  SET status = 'matched', matched_with = v_opponent_id, session_id = v_session_id
  WHERE q.user_id = p_user_id;

  SELECT u.username, u.avatar INTO v_username, v_avatar FROM public.users u WHERE u.id = v_opponent_id;
  RETURN QUERY SELECT 'matched'::text, v_username, v_avatar, v_session_id;
END;
$$;

-- Hızlı eşleşme kuyruğuna gir (önceki durum sıfırlanır) ve hemen rakip ara.
CREATE OR REPLACE FUNCTION public.matchmake_player(p_user_id uuid)
RETURNS TABLE (status text, matched_username text, avatar text, session_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'INVALID_ARGUMENT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ft26_matchmaking'));

  INSERT INTO public.lobby_queue (user_id, status, matched_with, session_id, created_at, last_seen)
  VALUES (p_user_id, 'searching', NULL, NULL, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET status = 'searching', matched_with = NULL, session_id = NULL, created_at = now(), last_seen = now();

  RETURN QUERY SELECT * FROM public.try_match_player(p_user_id);
END;
$$;

-- Lobi durumunu yokla: kaydı canlı tutar, hâlâ arıyorsa yeniden eşleştirmeyi dener.
-- Eşleşilen oturum rakip tarafından iptal edildiyse 'cancelled' döner.
CREATE OR REPLACE FUNCTION public.poll_matchmaking(p_user_id uuid)
RETURNS TABLE (status text, matched_username text, avatar text, session_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_row public.lobby_queue%ROWTYPE;
  v_session_status text;
  v_username text;
  v_avatar text;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'INVALID_ARGUMENT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ft26_matchmaking'));

  UPDATE public.lobby_queue q SET last_seen = now()
  WHERE q.user_id = p_user_id
  RETURNING q.* INTO v_row;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'idle'::text, NULL::text, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  IF v_row.status = 'searching' THEN
    RETURN QUERY SELECT * FROM public.try_match_player(p_user_id);
    RETURN;
  END IF;

  IF v_row.status = 'matched' THEN
    SELECT s.status INTO v_session_status FROM public.game_sessions s WHERE s.id = v_row.session_id;
    IF v_session_status IS NULL OR v_session_status = 'cancelled' THEN
      RETURN QUERY SELECT 'cancelled'::text, NULL::text, NULL::text, v_row.session_id;
      RETURN;
    END IF;
    SELECT u.username, u.avatar INTO v_username, v_avatar FROM public.users u WHERE u.id = v_row.matched_with;
    RETURN QUERY SELECT 'matched'::text, v_username, v_avatar, v_row.session_id;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_row.status, NULL::text, NULL::text, NULL::uuid;
END;
$$;

-- Kuyruktan/özel odadan ayrıl. Henüz hamle yapılmamış eşleşmiş oturum iptal edilir
-- ve iptal edilen oturum id'si döner (rakibe canlı bildirim gönderilir).
CREATE OR REPLACE FUNCTION public.leave_matchmaking(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.lobby_queue%ROWTYPE;
  v_cancelled uuid;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'INVALID_ARGUMENT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ft26_matchmaking'));

  DELETE FROM public.lobby_queue q WHERE q.user_id = p_user_id RETURNING q.* INTO v_row;
  IF NOT FOUND OR v_row.status <> 'matched' OR v_row.session_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.game_sessions s
  SET status = 'cancelled', updated_at = now()
  WHERE s.id = v_row.session_id
    AND s.status IN ('waiting', 'active')
    AND s.state_data = '{}'::jsonb
  RETURNING s.id INTO v_cancelled;

  RETURN v_cancelled;
END;
$$;

-- Eski imza (yalnızca kullanıcı adıyla katılım) kaldırılır.
DROP FUNCTION IF EXISTS public.join_private_session(uuid, text);

-- Özel odaya katılım: oda kodu doğru olmalı ya da katılan oyuncu, oda kurulduktan sonra
-- oda sahibinden bir oyun daveti almış olmalıdır. Kullanıcı adını bilmek tek başına yetmez.
CREATE OR REPLACE FUNCTION public.join_private_session(p_user_id uuid, p_host_username text, p_room_code text DEFAULT NULL)
RETURNS TABLE (status text, matched_username text, avatar text, session_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_host_id uuid;
  v_host_username text;
  v_host_avatar text;
  v_session_id uuid;
  v_room_code text;
  v_room_created timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_host_username IS NULL OR length(trim(p_host_username)) = 0 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ft26_matchmaking'));

  SELECT u.id, u.username, u.avatar INTO v_host_id, v_host_username, v_host_avatar
  FROM public.users u WHERE u.username = trim(p_host_username);
  IF NOT FOUND THEN RAISE EXCEPTION 'HOST_NOT_FOUND'; END IF;
  IF v_host_id = p_user_id THEN RAISE EXCEPTION 'CANNOT_JOIN_OWN_ROOM'; END IF;

  SELECT l.session_id, l.room_code, l.created_at INTO v_session_id, v_room_code, v_room_created
  FROM public.lobby_queue l
  WHERE l.user_id = v_host_id
    AND l.status = 'waiting_private'
    AND l.last_seen > now() - public.matchmaking_stale_after()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRIVATE_ROOM_UNAVAILABLE'; END IF;

  IF NOT (
    (v_room_code IS NOT NULL AND p_room_code IS NOT NULL AND upper(trim(p_room_code)) = v_room_code)
    OR EXISTS (
      SELECT 1 FROM public.direct_messages m
      WHERE m.sender_id = v_host_id AND m.recipient_id = p_user_id
        AND m.kind = 'game_invite' AND m.created_at >= v_room_created
    )
  ) THEN
    RAISE EXCEPTION 'ROOM_CODE_INVALID';
  END IF;

  IF v_session_id IS NULL THEN
    INSERT INTO public.game_sessions (host_user_id, status, mode)
    VALUES (v_host_id, 'active', 'private') RETURNING id INTO v_session_id;
    INSERT INTO public.game_session_players (session_id, user_id, role)
    VALUES (v_session_id, v_host_id, 'host');
  END IF;

  INSERT INTO public.game_session_players (session_id, user_id, role)
  VALUES (v_session_id, p_user_id, 'guest');
  UPDATE public.game_sessions s SET status = 'active', updated_at = now() WHERE s.id = v_session_id;
  UPDATE public.lobby_queue l
  SET status = 'matched', matched_with = p_user_id, session_id = v_session_id
  WHERE l.user_id = v_host_id;
  INSERT INTO public.lobby_queue (user_id, status, matched_with, session_id, last_seen)
  VALUES (p_user_id, 'matched', v_host_id, v_session_id, now())
  ON CONFLICT (user_id) DO UPDATE
    SET status = 'matched', matched_with = v_host_id, session_id = v_session_id, last_seen = now();

  RETURN QUERY SELECT 'matched'::text, v_host_username, v_host_avatar, v_session_id;
END;
$$;

-- Özel oda açar/yeniler. Zamanlar veritabanı saatiyle yazılır; davet kontrolü
-- (join_private_session) mesaj zamanıyla aynı saate göre karşılaştırma yapar.
CREATE OR REPLACE FUNCTION public.open_private_room(p_user_id uuid, p_room_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.lobby_queue (user_id, status, room_code, matched_with, session_id, created_at, last_seen)
  VALUES (p_user_id, 'waiting_private', p_room_code, NULL, NULL, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET status = 'waiting_private', room_code = EXCLUDED.room_code, matched_with = NULL,
        session_id = NULL, created_at = now(), last_seen = now();
$$;

-- Çevrimiçi maç bitince iki oyuncunun kalıcı istatistiklerini günceller.
-- Backend bunu yalnızca oturumu 'finished' durumuna ilk kez geçirdiğinde çağırır.
CREATE OR REPLACE FUNCTION public.apply_session_result(p_session_id uuid, p_winner_user_id uuid, p_turns integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_session_id IS NULL THEN RAISE EXCEPTION 'INVALID_ARGUMENT'; END IF;

  UPDATE public.stats st
  SET games_played = st.games_played + 1,
      total_turns = st.total_turns + GREATEST(COALESCE(p_turns, 0), 0),
      wins = st.wins + CASE WHEN st.user_id = p_winner_user_id THEN 1 ELSE 0 END,
      xp = st.xp + 500 + CASE WHEN st.user_id = p_winner_user_id THEN 500 ELSE 0 END,
      updated_at = now()
  WHERE st.user_id IN (SELECT p.user_id FROM public.game_session_players p WHERE p.session_id = p_session_id);
END;
$$;

REVOKE ALL ON FUNCTION public.try_match_player(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.matchmake_player(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.poll_matchmaking(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leave_matchmaking(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_private_session(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_private_room(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_session_result(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_match_player(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.matchmake_player(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.poll_matchmaking(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.leave_matchmaking(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.join_private_session(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.open_private_room(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_session_result(uuid, uuid, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Arkadaşlar arası mesajlaşma
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'game_invite')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS direct_messages_pair_idx
  ON public.direct_messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS direct_messages_unread_idx
  ON public.direct_messages (recipient_id, sender_id) WHERE read_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_conversation(p_user_id uuid, p_friend_id uuid, p_limit integer DEFAULT 50)
RETURNS SETOF public.direct_messages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM (
    SELECT m.* FROM public.direct_messages m
    WHERE (m.sender_id = p_user_id AND m.recipient_id = p_friend_id)
       OR (m.sender_id = p_friend_id AND m.recipient_id = p_user_id)
    ORDER BY m.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
  ) recent
  ORDER BY recent.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_conversation(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation(uuid, uuid, integer) TO service_role;

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
ALTER TABLE public.character_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starter_character_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_pack_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

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
DROP POLICY IF EXISTS coin_pack_catalog_public_read ON public.coin_pack_catalog;
CREATE POLICY coin_pack_catalog_public_read ON public.coin_pack_catalog FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS character_entitlements_self_read ON public.character_entitlements;
CREATE POLICY character_entitlements_self_read ON public.character_entitlements FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS starter_claims_self_read ON public.starter_character_claims;
CREATE POLICY starter_claims_self_read ON public.starter_character_claims FOR SELECT TO authenticated USING (user_id = auth.uid());
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
DROP POLICY IF EXISTS direct_messages_participant_read ON public.direct_messages;
CREATE POLICY direct_messages_participant_read ON public.direct_messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Seçili karakter (oyunda kullanılacak 3D model)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS selected_character text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_selected_character_check' AND conrelid = 'public.users'::regclass) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_selected_character_check
      CHECK (selected_character IS NULL OR selected_character IN ('architect', 'king', 'viking', 'rocket', 'wizard'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Promosyon kodları
-- ---------------------------------------------------------------------------
-- Ödül kaynaklarına 'promo' eklenir (mevcut veritabanlarında constraint yenilenir).
ALTER TABLE public.coin_ledger DROP CONSTRAINT IF EXISTS coin_ledger_entry_type_check;
ALTER TABLE public.coin_ledger ADD CONSTRAINT coin_ledger_entry_type_check
  CHECK (entry_type IN ('purchase', 'character_purchase', 'starter', 'admin', 'refund', 'promo'));
ALTER TABLE public.character_entitlements DROP CONSTRAINT IF EXISTS character_entitlements_source_check;
ALTER TABLE public.character_entitlements ADD CONSTRAINT character_entitlements_source_check
  CHECK (source IN ('starter', 'coin_purchase', 'admin', 'promo'));

CREATE TABLE IF NOT EXISTS public.promo_codes (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9-]{4,32}$'),
  description text CHECK (description IS NULL OR char_length(description) <= 200),
  coin_reward bigint NOT NULL DEFAULT 0 CHECK (coin_reward >= 0 AND coin_reward <= 100000),
  character_key text CHECK (character_key IS NULL OR character_key IN ('architect', 'king', 'viking', 'rocket', 'wizard')),
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redemption_count integer NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (coin_reward > 0 OR character_key IS NOT NULL),
  CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  code text NOT NULL REFERENCES public.promo_codes(code) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  coins_granted bigint NOT NULL DEFAULT 0,
  character_granted text,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, user_id)
);

CREATE INDEX IF NOT EXISTS promo_redemptions_user_idx ON public.promo_redemptions (user_id, redeemed_at DESC);

-- Kodu tek transaction'da doğrular ve ödülü verir. Aynı kullanıcı aynı kodu ikinci kez
-- kullanamaz; kullanım limiti satır kilidiyle korunur (eşzamanlı kullanımda aşılamaz).
CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_user_id uuid, p_code text)
RETURNS TABLE (out_code text, out_coins bigint, out_character text, out_character_already_owned boolean, out_balance bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_promo public.promo_codes%ROWTYPE;
  v_balance bigint;
  v_already_owned boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_code IS NULL THEN RAISE EXCEPTION 'INVALID_ARGUMENT'; END IF;
  v_code := upper(trim(p_code));

  SELECT * INTO v_promo FROM public.promo_codes pc WHERE pc.code = v_code FOR UPDATE;
  IF NOT FOUND OR NOT v_promo.is_active THEN RAISE EXCEPTION 'PROMO_NOT_FOUND'; END IF;
  IF v_promo.starts_at > now() THEN RAISE EXCEPTION 'PROMO_NOT_STARTED'; END IF;
  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at <= now() THEN RAISE EXCEPTION 'PROMO_EXPIRED'; END IF;
  IF v_promo.max_redemptions IS NOT NULL AND v_promo.redemption_count >= v_promo.max_redemptions THEN
    RAISE EXCEPTION 'PROMO_EXHAUSTED';
  END IF;

  INSERT INTO public.promo_redemptions (code, user_id, coins_granted, character_granted)
  VALUES (v_code, p_user_id, v_promo.coin_reward, v_promo.character_key)
  ON CONFLICT ON CONSTRAINT promo_redemptions_pkey DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROMO_ALREADY_REDEEMED'; END IF;

  UPDATE public.promo_codes pc SET redemption_count = pc.redemption_count + 1 WHERE pc.code = v_code;

  IF v_promo.coin_reward > 0 THEN
    UPDATE public.stats st
    SET total_earnings = st.total_earnings + v_promo.coin_reward, updated_at = now()
    WHERE st.user_id = p_user_id
    RETURNING st.total_earnings INTO v_balance;
    IF NOT FOUND THEN RAISE EXCEPTION 'STATS_NOT_FOUND'; END IF;
    INSERT INTO public.coin_ledger (user_id, amount, entry_type, reference_id)
    VALUES (p_user_id, v_promo.coin_reward, 'promo', v_code || ':' || p_user_id::text);
  ELSE
    SELECT st.total_earnings INTO v_balance FROM public.stats st WHERE st.user_id = p_user_id;
  END IF;

  IF v_promo.character_key IS NOT NULL THEN
    INSERT INTO public.character_entitlements (user_id, character_key, source)
    VALUES (p_user_id, v_promo.character_key, 'promo')
    ON CONFLICT ON CONSTRAINT character_entitlements_pkey DO NOTHING;
    v_already_owned := NOT FOUND;
  END IF;

  RETURN QUERY SELECT v_code, v_promo.coin_reward, v_promo.character_key, v_already_owned, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_promo_code(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(uuid, text) TO service_role;

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
-- Kod listesi istemcilere açılmaz (tahmin/sızıntı önlemi); kullanıcı yalnızca kendi kullanımlarını görebilir.
DROP POLICY IF EXISTS promo_redemptions_self_read ON public.promo_redemptions;
CREATE POLICY promo_redemptions_self_read ON public.promo_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- The backend uses service_role and performs authorization in Express.
-- No anon/authenticated write policy is intentionally granted for economy data.
