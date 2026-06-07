-- Yaorozu God OS - Supabase PostgreSQL Database Schema

-- Enable pgvector extension for RAG (vector search)
create extension if not exists vector;

-- 1. USERS TABLE
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  avatar_url text,
  total_toku integer default 0 not null,
  current_title text default '見習い巡礼者' not null, -- Title based on Toku (e.g. 巡礼者, 神職, 創世主)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for users
alter table public.users enable row level security;

create policy "Users can read all user profiles" on public.users
  for select using (true);

create policy "Users can update their own profile" on public.users
  for update using (auth.uid() = id);

-- 2. SPOTS TABLE
create table public.spots (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  latitude double precision not null,
  longitude double precision not null,
  creator_id uuid references public.users(id) on delete set null, -- The current "Creator" (創世主)
  image_url text,
  category text default '神社仏閣' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.spots enable row level security;

create policy "Everyone can read spots" on public.spots
  for select using (true);

create policy "Only system/admin can create spots" on public.spots
  for insert with check (true); -- Custom logic or admin bypass in practice

create policy "Creator can update their spot" on public.spots
  for update using (auth.uid() = creator_id);

-- 3. UGC POSTS TABLE
create table public.ugc_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  spot_id uuid references public.spots(id) on delete cascade not null,
  content text not null,
  image_url text,
  likes_count integer default 0 not null,
  embedding vector(1536), -- 1536-dimensional OpenAI embeddings for RAG
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ugc_posts enable row level security;

create policy "Everyone can read UGC posts" on public.ugc_posts
  for select using (true);

create policy "Authenticated users can write UGC posts" on public.ugc_posts
  for insert with check (auth.uid() = user_id);

-- 4. UGC LIKES TABLE (To prevent duplicate likes and track Toku points)
create table public.ugc_likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  post_id uuid references public.ugc_posts(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, post_id)
);

alter table public.ugc_likes enable row level security;

create policy "Everyone can view likes" on public.ugc_likes
  for select using (true);

create policy "Authenticated users can like posts" on public.ugc_likes
  for insert with check (auth.uid() = user_id);

create policy "Authenticated users can unlike posts" on public.ugc_likes
  for delete using (auth.uid() = user_id);

-- 5. AGENTS (GODS) TABLE
create table public.agents (
  id uuid default gen_random_uuid() primary key,
  spot_id uuid references public.spots(id) on delete cascade not null unique,
  name text not null,
  persona_description text not null, -- Short description of the God
  system_prompt text not null, -- Detailed system prompt for LLM personality
  avatar_3d_url text, -- Path to 3D model/AR asset
  halo_color text default '#FFD700' not null, -- Light/Aura color for AR visual effects
  accessory_type text default 'なし' not null, -- Visual accessories (e.g. 鏡, 剣, 扇子)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.agents enable row level security;

create policy "Everyone can read agents" on public.agents
  for select using (true);

create policy "Spot Creator can edit their agent" on public.agents
  for update using (
    exists (
      select 1 from public.spots
      where spots.id = agents.spot_id and spots.creator_id = auth.uid()
    )
  );

-- 6. AFFILIATE LINKS TABLE
create table public.affiliate_links (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  category text not null, -- 'hotel', 'restaurant', 'activity'
  target_area text not null, -- City, region, or keyword to match
  url text not null,
  price_range text,
  rating double precision,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.affiliate_links enable row level security;

create policy "Everyone can view affiliate links" on public.affiliate_links
  for select using (true);


-- 7. TRIGGERS & FUNCTIONS FOR TOKU POINTS & CREATOR STATUS

-- Automatically add "Toku" to post author when someone likes their post
create or replace function public.handle_post_like()
returns trigger as $$
begin
  -- Increase the likes count on the post
  update public.ugc_posts
  set likes_count = likes_count + 1
  where id = new.post_id;

  -- Add Toku to the author of the post (10 points per like)
  update public.users
  set total_toku = total_toku + 10
  where id = (select user_id from public.ugc_posts where id = new.post_id);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_post_liked
  after insert on public.ugc_likes
  for each row execute procedure public.handle_post_like();

-- Automatically subtract "Toku" from post author when someone unlikes
create or replace function public.handle_post_unlike()
returns trigger as $$
begin
  update public.ugc_posts
  set likes_count = likes_count - 1
  where id = old.post_id;

  update public.users
  set total_toku = max(0, total_toku - 10)
  where id = (select user_id from public.ugc_posts where id = old.post_id);

  return old;
end;
$$ language plpgsql security definer;

create trigger on_post_unliked
  after delete on public.ugc_likes
  for each row execute procedure public.handle_post_unlike();

-- Award Toku points for submitting UGC (50 points per post)
create or replace function public.handle_new_post()
returns trigger as $$
begin
  update public.users
  set total_toku = total_toku + 50
  where id = new.user_id;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_post_created
  after insert on public.ugc_posts
  for each row execute procedure public.handle_new_post();
