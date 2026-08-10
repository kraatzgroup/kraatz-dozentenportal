// Type declarations for Deno globals in Supabase Edge Functions
// This silences IDE false positives about missing Deno types

declare global {
  const Deno: {
    env: {
      get(name: string): string | undefined;
    };
    serve(handler: (req: Request) => Response | Promise<Response>): void;
    readonly cwd: string;
    readonly args: string[];
  };
}

export {};
