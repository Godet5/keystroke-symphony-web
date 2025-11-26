import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Type helpers for database tables
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          birthdate: string;
          subscription_tier: 'public' | 'free' | 'basic' | 'pro';
          is_subscriber: boolean;
          parent_approved: boolean;
          parent_email: string | null;
          consult_credits: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      parental_consents: {
        Row: {
          id: string;
          child_id: string;
          parent_email: string;
          consent_token: string;
          approved: boolean;
          approved_at: string | null;
          expires_at: string;
          attempts: number;
          created_at: string;
        };
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          metadata: any;
          created_at: string;
        };
      };
    };
  };
};
