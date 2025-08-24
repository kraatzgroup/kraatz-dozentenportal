import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJheG1wdmJ3dnRsYnJ6Y2hhYmZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNDAzOCwiZXhwIjoyMDY2NzgwMDM4fQ.QYgIsHuhi_UxdeV9-IyfFg8cExsjWf6y-EgCZS8_TX0';

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration. Please check your .env file.');
}

// Log successful configuration
console.log('✅ Supabase Configuration Validated:', {
  url: supabaseUrl,
  anonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'undefined',
  serviceKey: supabaseServiceKey ? `${supabaseServiceKey.substring(0, 20)}...` : 'undefined'
});

// Create regular client for normal operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

// Create admin client with service role for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

// Test connection on initialization
const testConnection = async () => {
  try {
    // Test basic connectivity first
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('✅ Supabase connectivity test successful');
    
    // Then test auth session
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('⚠️ Auth session error (this is normal if not logged in):', error.message);
    } else {
      console.log('✅ Auth session check successful');
    }
  } catch (error) {
    console.error('❌ Supabase connection test failed:', error);
    // Check if it's a network connectivity issue
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('🌐 Network connectivity issue detected. Please check:');
      console.error('1. Internet connection');
      console.error('2. Supabase project URL in .env file');
      console.error('3. Supabase project status (not paused/deleted)');
    } else if (error instanceof Error && error.message.includes('HTTP')) {
      console.error('🔗 Supabase API error. Please check:');
      console.error('1. VITE_SUPABASE_URL is correct in .env file');
      console.error('2. VITE_SUPABASE_ANON_KEY is correct in .env file');
      console.error('3. Supabase project is not paused or deleted');
    }
  }
};

testConnection();