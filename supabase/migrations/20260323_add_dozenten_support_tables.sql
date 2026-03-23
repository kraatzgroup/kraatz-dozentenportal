-- Create table for Dozenten Support FAQs
CREATE TABLE IF NOT EXISTS public.dozenten_support_faqs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Allgemein',
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create table for Dozenten Support Videos
CREATE TABLE IF NOT EXISTS public.dozenten_support_videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    category TEXT NOT NULL DEFAULT 'Allgemein',
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.dozenten_support_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dozenten_support_videos ENABLE ROW LEVEL SECURITY;

-- Create policies for dozenten_support_faqs
CREATE POLICY "Allow authenticated users to read active FAQs"
    ON public.dozenten_support_faqs
    FOR SELECT
    TO authenticated
    USING (is_active = true);

CREATE POLICY "Allow admins to manage FAQs"
    ON public.dozenten_support_faqs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Create policies for dozenten_support_videos
CREATE POLICY "Allow authenticated users to read active videos"
    ON public.dozenten_support_videos
    FOR SELECT
    TO authenticated
    USING (is_active = true);

CREATE POLICY "Allow admins to manage videos"
    ON public.dozenten_support_videos
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_dozenten_support_faqs_active ON public.dozenten_support_faqs(is_active);
CREATE INDEX IF NOT EXISTS idx_dozenten_support_faqs_order ON public.dozenten_support_faqs(order_index);
CREATE INDEX IF NOT EXISTS idx_dozenten_support_videos_active ON public.dozenten_support_videos(is_active);
CREATE INDEX IF NOT EXISTS idx_dozenten_support_videos_order ON public.dozenten_support_videos(order_index);
