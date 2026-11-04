import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseClientInstance: SupabaseClient | null = null;

function getSupabaseClient() {
    if (supabaseClientInstance) {
        return supabaseClientInstance;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabasePublishableKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabasePublishableKey) {
        throw new Error("Missing public Supabase environment variables");
    }

    supabaseClientInstance = createClient(supabaseUrl, supabasePublishableKey);
    return supabaseClientInstance;
}

export const supabaseClient = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        const client = getSupabaseClient();
        return client[prop as keyof SupabaseClient];
    },
});
