import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "your_supabase_url_here";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "your_supabase_anon_key_here";

const isMock = !supabaseUrl || supabaseUrl === "your_supabase_url_here" || !supabaseUrl.startsWith("http");

function getMockTableData(table: string): any[] {
  try {
    const data = localStorage.getItem(`spicehub_mock_table_${table}`);
    if (data) return JSON.parse(data);
  } catch (e) {}
  
  if (table === 'orders') {
    return [
      { id: 'SPH123', details: '2x Biryani, 1x Cold Drink', total: 1150, status: 'Out for Delivery. 20 min me pahunchega.', created_at: new Date(Date.now() - 3600000).toISOString(), user_id: 'guest-123' },
      { id: 'SPH124', details: '1x Garlic Mayo Burger', total: 450, status: 'Preparing', created_at: new Date(Date.now() - 10 * 3600000).toISOString(), user_id: 'guest-124' }
    ];
  }
  return [];
}

function saveMockTableData(table: string, data: any[]) {
  try {
    localStorage.setItem(`spicehub_mock_table_${table}`, JSON.stringify(data));
  } catch (e) {}
}

function createChainablePromise(table: string, result: any) {
  const chain: any = {
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  
  const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order', 'or', 'and', 'match', 'single', 'limit', 'gt', 'lt'];
  methods.forEach(method => {
    chain[method] = (...args: any[]) => {
      if (method === 'eq') {
        const [column, value] = args;
        let filteredData = Array.isArray(result?.data) ? result.data : [];
        if (column && value !== undefined) {
          filteredData = filteredData.filter((item: any) => item[column] == value);
        }
        return createChainablePromise(table, { data: filteredData, error: null });
      }
      if (method === 'order') {
        const [column, options] = args;
        const ascending = options?.ascending !== false;
        let sortedData = Array.isArray(result?.data) ? [...result.data] : [];
        if (column) {
          sortedData.sort((a: any, b: any) => {
            if (a[column] < b[column]) return ascending ? -1 : 1;
            if (a[column] > b[column]) return ascending ? 1 : -1;
            return 0;
          });
        }
        return createChainablePromise(table, { data: sortedData, error: null });
      }
      return chain;
    };
  });
  
  return chain;
}

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
      const initialData = getMockTableData(table);
      const chain = createChainablePromise(table, { data: initialData, error: null });
      
      // Augment chain with insert helper
      chain.insert = async (data: any) => {
        console.log(`Mock insert into ${table}:`, data);
        const list = getMockTableData(table);
        const itemsToInsert = Array.isArray(data) ? data : [data];
        const newItems = itemsToInsert.map(item => ({
          id: item.id || `SPH-${Math.floor(100000 + Math.random() * 900000)}`,
          created_at: new Date().toISOString(),
          ...item
        }));
        const updatedList = [...newItems, ...list];
        saveMockTableData(table, updatedList);
        return { data: newItems, error: null };
      };

      chain.delete = () => {
        // Return a mock delete action that can chain .eq() and delete elements
        const deleteChain = {
          eq: async (column: string, value: any) => {
            console.log(`Mock delete from ${table} where ${column} = ${value}`);
            const list = getMockTableData(table);
            const filtered = list.filter(item => item[column] != value);
            saveMockTableData(table, filtered);
            return { data: [], error: null };
          }
        };
        return deleteChain;
      };

      return chain;
    },
  };
}

export const supabase = isMock ? createMockSupabase() as unknown as ReturnType<typeof createClient> : createClient(supabaseUrl, supabaseAnonKey);
