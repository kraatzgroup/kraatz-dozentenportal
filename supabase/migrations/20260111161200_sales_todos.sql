-- Create sales_todos table for sales calendar
CREATE TABLE IF NOT EXISTS sales_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertrieb_user_id UUID REFERENCES auth.users(id),
  lead_id UUID REFERENCES leads(id),
  todo_type TEXT NOT NULL CHECK (todo_type IN ('beratungsgespraech', 'angebotsversand', 'gespraech_nach_angebot', 'probestunde', 'finalgespraech')),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  teilnehmer_name TEXT,
  teilnehmer_email TEXT,
  teilnehmer_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sales_todos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all sales todos" ON sales_todos FOR SELECT USING (true);
CREATE POLICY "Users can insert sales todos" ON sales_todos FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update sales todos" ON sales_todos FOR UPDATE USING (true);
CREATE POLICY "Users can delete sales todos" ON sales_todos FOR DELETE USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_todos_scheduled_date ON sales_todos(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_sales_todos_status ON sales_todos(status);
CREATE INDEX IF NOT EXISTS idx_sales_todos_todo_type ON sales_todos(todo_type);
