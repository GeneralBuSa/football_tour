-- ==========================================
-- SUPABASE POSTGRESQL SCHEMA
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. STATS TABLE
CREATE TABLE IF NOT EXISTS public.stats (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    total_earnings BIGINT DEFAULT 0,
    total_properties INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    highest_money BIGINT DEFAULT 0,
    wins INTEGER DEFAULT 0,
    total_turns INTEGER DEFAULT 0,
    xp INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ACHIEVEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- 4. GAMES TABLE
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    result_data JSONB NOT NULL,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. STORE ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.store_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    price BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. PURCHASES TABLE
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.store_items(id) ON DELETE CASCADE,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Backend service role anahtarıyla çalışır. Anon/client rolleri bu tablolara
-- doğrudan erişmemelidir; erişim backend API üzerinden yapılır.
DROP POLICY IF EXISTS "Allow Service Role" ON public.users;
DROP POLICY IF EXISTS "Allow Service Role" ON public.stats;
DROP POLICY IF EXISTS "Allow Service Role" ON public.achievements;
DROP POLICY IF EXISTS "Allow Service Role" ON public.games;
DROP POLICY IF EXISTS "Allow Service Role" ON public.store_items;
DROP POLICY IF EXISTS "Allow Service Role" ON public.purchases;

CREATE POLICY "Allow Service Role" ON public.users FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Allow Service Role" ON public.stats FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Allow Service Role" ON public.achievements FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Allow Service Role" ON public.games FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Allow Service Role" ON public.store_items FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Allow Service Role" ON public.purchases FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 7. FRIENDS TABLE
CREATE TABLE IF NOT EXISTS public.friends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- 8. LOBBY QUEUE TABLE
CREATE TABLE IF NOT EXISTS public.lobby_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'searching',
    matched_with UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobby_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Service Role" ON public.friends;
DROP POLICY IF EXISTS "Allow Service Role" ON public.lobby_queue;

CREATE POLICY "Allow Service Role" ON public.friends FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Allow Service Role" ON public.lobby_queue FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 9. GAME SAVES TABLE
CREATE TABLE IF NOT EXISTS public.game_saves (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    save_data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.game_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow Service Role" ON public.game_saves;
CREATE POLICY "Allow Service Role" ON public.game_saves FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 10. INITIAL STORE ITEMS
INSERT INTO public.store_items (name, type, price)
SELECT 'Altın Piyon Kutusu', 'Kutu', 1500
WHERE NOT EXISTS (SELECT 1 FROM public.store_items WHERE name = 'Altın Piyon Kutusu');

INSERT INTO public.store_items (name, type, price)
SELECT 'Efsanevi Stadyum Teması', 'Tema', 5000
WHERE NOT EXISTS (SELECT 1 FROM public.store_items WHERE name = 'Efsanevi Stadyum Teması');

INSERT INTO public.store_items (name, type, price)
SELECT 'Elmas Zar Görünümü', 'Zar', 3000
WHERE NOT EXISTS (SELECT 1 FROM public.store_items WHERE name = 'Elmas Zar Görünümü');

INSERT INTO public.store_items (name, type, price)
SELECT 'VIP Oyuncu Rozeti', 'Rozet', 10000
WHERE NOT EXISTS (SELECT 1 FROM public.store_items WHERE name = 'VIP Oyuncu Rozeti');
-- 11. MULTIPLAYER GAME SESSIONS
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'waiting',
    mode TEXT DEFAULT 'private',
    state_data JSONB DEFAULT '{}'::jsonb,
    result_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.game_session_players (
    session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'guest',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.game_session_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.lobby_queue ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.game_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_session_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Service Role" ON public.game_sessions;
DROP POLICY IF EXISTS "Allow Service Role" ON public.game_session_players;
DROP POLICY IF EXISTS "Allow Service Role" ON public.game_session_events;

CREATE POLICY "Allow Service Role" ON public.game_sessions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Allow Service Role" ON public.game_session_players FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Allow Service Role" ON public.game_session_events FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

