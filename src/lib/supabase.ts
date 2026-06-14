import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "your_supabase_url_here";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "your_supabase_anon_key_here";

const isMock = !supabaseUrl || supabaseUrl === "your_supabase_url_here" || !supabaseUrl.startsWith("http");

function createMockSupabase() {
  let listeners: any[] = [];
  let currentUser: any = null;
  try {
    const savedUser = localStorage.getItem("spicehub_mock_user");
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
    }
  } catch (e) {
    console.warn("localStorage loading failed", e);
  }

  const notify = (event: string) => {
    listeners.forEach(cb => cb(event, currentUser ? { user: currentUser } : null));
  };

  return {
    auth: {
      getSession: async () => ({
        data: { session: currentUser ? { user: currentUser } : null },
        error: null,
      }),
      onAuthStateChange: (cb: any) => {
        listeners.push(cb);
        cb("INITIAL_SESSION", currentUser ? { user: currentUser } : null);
        return { 
          data: { 
            subscription: { 
              unsubscribe: () => {
                listeners = listeners.filter(l => l !== cb);
              } 
            } 
          } 
        };
      },
      signInWithPassword: async ({ email, password }: any) => {
        if (!email || !password) return { error: { message: "Invalid credentials" } };
        
        // Match specific admin credentials or general accounts
        if (email === 'admin@spicehub.com' && password === 'admin123') {
          currentUser = { 
            id: "admin", 
            email: "admin@spicehub.com", 
            role: "admin", 
            user_metadata: { name: "Admin" } 
          };
        } else {
          currentUser = { 
            id: `mock-id-${Date.now()}`, 
            email, 
            user_metadata: { name: email.split('@')[0] } 
          };
        }

        try {
          localStorage.setItem("spicehub_mock_user", JSON.stringify(currentUser));
        } catch (e) {}
        notify("SIGNED_IN");
        return { data: { user: currentUser }, error: null };
      },
      signUp: async ({ email, password }: any) => {
        if (!email || !password) return { error: { message: "Invalid credentials" } };
        currentUser = { 
          id: `mock-id-${Date.now()}`, 
          email, 
          user_metadata: { name: email.split('@')[0] } 
        };
        try {
          localStorage.setItem("spicehub_mock_user", JSON.stringify(currentUser));
        } catch (e) {}
        notify("SIGNED_IN");
        return { data: { user: currentUser }, error: null };
      },
      signOut: async () => {
        currentUser = null;
        try {
          localStorage.removeItem("spicehub_mock_user");
        } catch (e) {}
        notify("SIGNED_OUT");
        return { error: null };
      },
    },
    from: (table: string) => {
      return {
        insert: async (data: any) => {
          console.log(`Mock insert into ${table}:`, data);
          // Return generic success
          return { data: [data], error: null };
        },
        select: (columns?: string) => {
          return {
             eq: async (column: string, value: any) => {
                if (table === "orders") {
                   if (value === "SPH123") return { data: [{ status: "Out for Delivery. 20 min me pahunchega." }], error: null };
                   if (value === "SPH124") return { data: [{ status: "Preparing." }], error: null };
                   // Mock check if recently inserted via local state, simplified to just return not found for others
                   return { data: [], error: null };
                }
                return { data: [], error: null };
             }
          }
        }
      };
    },
  };
}

export const supabase = isMock ? createMockSupabase() as unknown as ReturnType<typeof createClient> : createClient(supabaseUrl, supabaseAnonKey);
