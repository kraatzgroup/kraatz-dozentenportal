// Ambient type declaration for Deno "npm:" imports used by Supabase Edge Functions.
// The TypeScript language server cannot resolve "npm:" specifiers; Deno resolves
// them at runtime/deploy time. Declaring the module silences false
// "Cannot find module" IDE errors (the runtime types still come from the real package).
declare module 'npm:@supabase/supabase-js@2';
