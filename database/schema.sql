-- ==========================================
-- SUPABASE POSTGRESQL SCHEMA
-- ==========================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
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
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- Servis rolü ile backend üzerinden erişeceğimiz için 
-- genel okuma/yazma politikalarını backend servisine açık bırakıyoruz:
CREATE POLICY "Allow Service Role" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow Service Role" ON public.stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow Service Role" ON public.achievements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow Service Role" ON public.games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow Service Role" ON public.store_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow Service Role" ON public.purchases FOR ALL USING (true) WITH CHECK (true);

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

CREATE POLICY "Allow Service Role" ON public.friends FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow Service Role" ON public.lobby_queue FOR ALL USING (true) WITH CHECK (true);

-- 9. GAME SAVES TABLE
CREATE TABLE IF NOT EXISTS public.game_saves (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    save_data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.game_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow Service Role" ON public.game_saves FOR ALL USING (true) WITH CHECK (true);
