-- Phase 1: Create vb_* prefixed tables for videobesprechung migration
-- This creates the schema only (no data). Data migration is Phase 3.
-- All user_id FKs are replaced with profile_id (will map via vb_id_mapping in Phase 3)
-- Tables with name collisions get vb_ prefix to avoid conflicts

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- VB PACKAGES (collision: portal has packages table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vb_packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    case_study_count INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    stripe_price_id TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- VB ORDERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vb_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    package_id UUID REFERENCES public.vb_packages(id) ON DELETE CASCADE NOT NULL,
    stripe_payment_intent_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    total_cents INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- VB CASE STUDY REQUESTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vb_case_study_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    case_study_number INTEGER,
    study_phase TEXT NOT NULL,
    legal_area TEXT NOT NULL,
    sub_area TEXT NOT NULL,
    focus_area TEXT NOT NULL,
    status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'materials_ready', 'submitted', 'under_review', 'corrected', 'completed')),
    pdf_url TEXT,
    case_study_material_url TEXT,
    additional_materials_url TEXT,
    submission_url TEXT,
    submission_downloaded_at TIMESTAMP WITH TIME ZONE,
    video_correction_url TEXT,
    written_correction_url TEXT,
    video_viewed_at TIMESTAMP WITH TIME ZONE,
    pdf_downloaded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- VB SUBMISSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vb_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    case_study_request_id UUID REFERENCES public.vb_case_study_requests(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx')),
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'corrected')),
    correction_video_url TEXT,
    landing_page_url TEXT,
    grade NUMERIC(4,2) CHECK (grade >= 0 AND grade <= 18),
    grade_text TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    corrected_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- VB NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vb_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning')),
    read BOOLEAN DEFAULT false,
    related_case_study_id UUID REFERENCES public.vb_case_study_requests(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- VB VIDEO LESSONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vb_video_lessons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    youtube_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id),
    is_active BOOLEAN DEFAULT true
);

-- ============================================================================
-- VB VIDEO PROGRESS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vb_video_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    video_lesson_id UUID NOT NULL REFERENCES public.vb_video_lessons(id) ON DELETE CASCADE,
    watched BOOLEAN DEFAULT FALSE,
    watch_time INTEGER DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(profile_id, video_lesson_id)
);

-- ============================================================================
-- VB CASE STUDY RATINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vb_case_study_ratings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    case_study_id UUID NOT NULL REFERENCES public.vb_case_study_requests(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(case_study_id, profile_id)
);

-- ============================================================================
-- VB CHAT CONVERSATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vb_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT CHECK (type IN ('support', 'group')) DEFAULT 'group',
    title TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- ============================================================================
-- VB CONVERSATION PARTICIPANTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vb_conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.vb_conversations(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(conversation_id, profile_id)
);

-- ============================================================================
-- VB CHAT MESSAGES (collision: portal has messages table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vb_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.vb_conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_at TIMESTAMP WITH TIME ZONE,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system'))
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vb_packages_active ON public.vb_packages(active);
CREATE INDEX IF NOT EXISTS idx_vb_orders_profile_id ON public.vb_orders(profile_id);
CREATE INDEX IF NOT EXISTS idx_vb_orders_package_id ON public.vb_orders(package_id);
CREATE INDEX IF NOT EXISTS idx_vb_case_study_requests_profile_id ON public.vb_case_study_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_vb_case_study_requests_status ON public.vb_case_study_requests(status);
CREATE INDEX IF NOT EXISTS idx_vb_submissions_case_study_request_id ON public.vb_submissions(case_study_request_id);
CREATE INDEX IF NOT EXISTS idx_vb_notifications_profile_id ON public.vb_notifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_vb_video_lessons_category ON public.vb_video_lessons(category);
CREATE INDEX IF NOT EXISTS idx_vb_video_lessons_created_at ON public.vb_video_lessons(created_at);
CREATE INDEX IF NOT EXISTS idx_vb_video_lessons_active ON public.vb_video_lessons(is_active);
CREATE INDEX IF NOT EXISTS idx_vb_video_progress_profile_id ON public.vb_video_progress(profile_id);
CREATE INDEX IF NOT EXISTS idx_vb_video_progress_video_lesson_id ON public.vb_video_progress(video_lesson_id);
CREATE INDEX IF NOT EXISTS idx_vb_case_study_ratings_case_study_id ON public.vb_case_study_ratings(case_study_id);
CREATE INDEX IF NOT EXISTS idx_vb_case_study_ratings_profile_id ON public.vb_case_study_ratings(profile_id);
CREATE INDEX IF NOT EXISTS idx_vb_conversations_created_by ON public.vb_conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_vb_conversations_updated_at ON public.vb_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vb_conversation_participants_profile_id ON public.vb_conversation_participants(profile_id);
CREATE INDEX IF NOT EXISTS idx_vb_conversation_participants_conversation_id ON public.vb_conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_vb_chat_messages_conversation_id ON public.vb_chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_vb_chat_messages_created_at ON public.vb_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vb_chat_messages_sender_id ON public.vb_chat_messages(sender_id);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION (create if not exists)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_vb_case_study_requests_updated_at 
    BEFORE UPDATE ON public.vb_case_study_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vb_video_lessons_updated_at 
    BEFORE UPDATE ON public.vb_video_lessons 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vb_video_progress_updated_at 
    BEFORE UPDATE ON public.vb_video_progress 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vb_case_study_ratings_updated_at 
    BEFORE UPDATE ON public.vb_case_study_ratings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vb_conversations_updated_at 
    BEFORE UPDATE ON public.vb_conversations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vb_video_progress_updated_at 
    BEFORE UPDATE ON public.vb_video_progress 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.vb_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_case_study_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_video_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_case_study_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
-- Check if user has videobesprechung role in additional_roles
CREATE OR REPLACE FUNCTION has_videobesprechung_role()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND 'videobesprechung' = ANY(additional_roles)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Packages: anyone with videobesprechung role can view active packages
CREATE POLICY "VB: Users with videobesprechung role can view active packages" ON public.vb_packages
    FOR SELECT USING (public.vb_packages.is_active = true AND has_videobesprechung_role());

-- Orders: users can view their own orders
CREATE POLICY "VB: Users can view own orders" ON public.vb_orders
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "VB: Users can create own orders" ON public.vb_orders
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Case study requests: users can view their own
CREATE POLICY "VB: Users can view own case study requests" ON public.vb_case_study_requests
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "VB: Users can create own case study requests" ON public.vb_case_study_requests
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "VB: Users can update own case study requests" ON public.vb_case_study_requests
    FOR UPDATE USING (auth.uid() = profile_id);

-- Submissions: users can view their own (via case study request)
CREATE POLICY "VB: Users can view own submissions" ON public.vb_submissions
    FOR SELECT USING (
        auth.uid() = (SELECT profile_id FROM public.vb_case_study_requests WHERE id = case_study_request_id)
    );

CREATE POLICY "VB: Users can create own submissions" ON public.vb_submissions
    FOR INSERT WITH CHECK (
        auth.uid() = (SELECT profile_id FROM public.vb_case_study_requests WHERE id = case_study_request_id)
    );

-- Notifications: users can view their own
CREATE POLICY "VB: Users can view own notifications" ON public.vb_notifications
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "VB: Users can update own notifications" ON public.vb_notifications
    FOR UPDATE USING (auth.uid() = profile_id);

-- Video lessons: users with videobesprechung role can view active lessons
CREATE POLICY "VB: Users with videobesprechung role can view active video lessons" ON public.vb_video_lessons
    FOR SELECT USING (is_active = true AND has_videobesprechung_role());

-- Video progress: users can view their own
CREATE POLICY "VB: Users can view own video progress" ON public.vb_video_progress
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "VB: Users can insert own video progress" ON public.vb_video_progress
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "VB: Users can update own video progress" ON public.vb_video_progress
    FOR UPDATE USING (auth.uid() = profile_id);

-- Case study ratings: users can view their own
CREATE POLICY "VB: Users can view their own ratings" ON public.vb_case_study_ratings
    FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "VB: Users can insert their own ratings" ON public.vb_case_study_ratings
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "VB: Users can update their own ratings" ON public.vb_case_study_ratings
    FOR UPDATE USING (auth.uid() = profile_id);

-- Conversations: users can view conversations they participate in
CREATE POLICY "VB: Users can view conversations they participate in" ON public.vb_conversations
    FOR SELECT USING (
        id IN (
            SELECT conversation_id 
            FROM public.vb_conversation_participants 
            WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "VB: Users can create conversations" ON public.vb_conversations
    FOR INSERT WITH CHECK (
        created_by = auth.uid() AND has_videobesprechung_role()
    );

CREATE POLICY "VB: Users can update their own conversations" ON public.vb_conversations
    FOR UPDATE USING (created_by = auth.uid());

-- Conversation participants: users can view participants in their conversations
CREATE POLICY "VB: Users can view participants in their conversations" ON public.vb_conversation_participants
    FOR SELECT USING (
        conversation_id IN (
            SELECT conversation_id 
            FROM public.vb_conversation_participants 
            WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "VB: Users can join conversations" ON public.vb_conversation_participants
    FOR INSERT WITH CHECK (
        profile_id = auth.uid() AND has_videobesprechung_role()
    );

CREATE POLICY "VB: Users can update their own participation" ON public.vb_conversation_participants
    FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "VB: Users can leave conversations" ON public.vb_conversation_participants
    FOR DELETE USING (profile_id = auth.uid());

-- Chat messages: users can view messages in their conversations
CREATE POLICY "VB: Users can view messages in their conversations" ON public.vb_chat_messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT conversation_id 
            FROM public.vb_conversation_participants 
            WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "VB: Users can send messages in their conversations" ON public.vb_chat_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        conversation_id IN (
            SELECT conversation_id 
            FROM public.vb_conversation_participants 
            WHERE profile_id = auth.uid()
        )
    );

CREATE POLICY "VB: Users can edit their own messages" ON public.vb_chat_messages
    FOR UPDATE USING (sender_id = auth.uid());

-- ============================================================================
-- HELPER FUNCTION FOR UNREAD MESSAGES
-- ============================================================================
CREATE OR REPLACE FUNCTION vb_get_unread_message_count(conversation_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM public.vb_chat_messages m
        WHERE m.conversation_id = conversation_uuid
        AND m.created_at > (
            SELECT COALESCE(last_read_at, '1970-01-01'::timestamp)
            FROM public.vb_conversation_participants
            WHERE conversation_id = conversation_uuid
            AND profile_id = auth.uid()
        )
        AND m.sender_id != auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VIEW FOR CONVERSATION DETAILS
-- ============================================================================
CREATE OR REPLACE VIEW vb_conversation_details AS
SELECT 
    c.*,
    (
        SELECT COUNT(*) 
        FROM public.vb_conversation_participants cp 
        WHERE cp.conversation_id = c.id
    ) as participant_count,
    (
        SELECT content 
        FROM public.vb_chat_messages m 
        WHERE m.conversation_id = c.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
    ) as last_message,
    (
        SELECT m.created_at 
        FROM public.vb_chat_messages m 
        WHERE m.conversation_id = c.id 
        ORDER BY m.created_at DESC 
        LIMIT 1
    ) as last_message_at,
    vb_get_unread_message_count(c.id) as unread_count
FROM public.vb_conversations c
WHERE c.id IN (
    SELECT conversation_id 
    FROM public.vb_conversation_participants 
    WHERE profile_id = auth.uid()
);

COMMENT ON TABLE public.vb_packages IS 'Videobesprechung: Packages for case study bundles';
COMMENT ON TABLE public.vb_orders IS 'Videobesprechung: User orders for packages';
COMMENT ON TABLE public.vb_case_study_requests IS 'Videobesprechung: Case study requests from students';
COMMENT ON TABLE public.vb_submissions IS 'Videobesprechung: Student submissions for case studies';
COMMENT ON TABLE public.vb_notifications IS 'Videobesprechung: User notifications';
COMMENT ON TABLE public.vb_video_lessons IS 'Videobesprechung: Video lessons for Klausuren-Masterclass';
COMMENT ON TABLE public.vb_video_progress IS 'Videobesprechung: User video viewing progress';
COMMENT ON TABLE public.vb_case_study_ratings IS 'Videobesprechung: Ratings for case studies';
COMMENT ON TABLE public.vb_conversations IS 'Videobesprechung: Chat conversations';
COMMENT ON TABLE public.vb_conversation_participants IS 'Videobesprechung: Chat conversation participants';
COMMENT ON TABLE public.vb_chat_messages IS 'Videobesprechung: Chat messages';
COMMENT ON VIEW vb_conversation_details IS 'Videobesprechung: Extended conversation details with statistics';
