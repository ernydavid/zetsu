import { createBrowserClient } from "@supabase/ssr";
import {
  supabaseCookieOptions,
  supabaseKey,
  supabaseUrl,
} from "@/utils/supabase/config";

export const createClient = () =>
  createBrowserClient(supabaseUrl!, supabaseKey!, {
    cookieOptions: supabaseCookieOptions,
  });
