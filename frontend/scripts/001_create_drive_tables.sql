-- Create files table for storing file metadata
CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- e.g., 'image/png', 'application/pdf', etc.
  file_size INTEGER NOT NULL, -- in bytes
  storage_path TEXT NOT NULL, -- path in Supabase Storage
  folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create folders table for hierarchical organization
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS for files table
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Enable RLS for folders table
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for files table
CREATE POLICY "users_can_view_own_files" ON public.files
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_can_insert_own_files" ON public.files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_files" ON public.files
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_can_delete_own_files" ON public.files
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for folders table
CREATE POLICY "users_can_view_own_folders" ON public.folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_can_insert_own_folders" ON public.folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_folders" ON public.folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_can_delete_own_folders" ON public.folders
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON public.files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_is_deleted ON public.files(is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON public.files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_name ON public.files(name);

CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_folder_id ON public.folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_is_deleted ON public.folders(is_deleted);
CREATE INDEX IF NOT EXISTS idx_folders_created_at ON public.folders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_folders_name ON public.folders(name);
