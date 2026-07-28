import { supabase } from './supabaseClient';

function createTableProxy(tableName) {
  return {
    toArray: async () => {
      const { data } = await supabase.from(tableName).select('*');
      return data || [];
    },
    add: async (item) => {
      const { data, error } = await supabase.from(tableName).insert(item).select().single();
      if (error) {
        console.error(`Error adding to ${tableName}:`, error);
        throw error;
      }
      return data?.id;
    },
    bulkAdd: async (items) => {
      const { data, error } = await supabase.from(tableName).insert(items).select();
      if (error) {
        console.error(`Error bulk adding to ${tableName}:`, error);
        throw error;
      }
      return data;
    },
    update: async (id, changes) => {
      const { error } = await supabase.from(tableName).update(changes).eq('id', id);
      if (error) {
        console.error(`Error updating ${tableName}:`, error);
        throw error;
      }
    },
    delete: async (id) => {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) {
        console.error(`Error deleting from ${tableName}:`, error);
        throw error;
      }
    },
    where: (query) => {
      return {
        first: async () => {
          const key = Object.keys(query)[0];
          const { data } = await supabase.from(tableName).select('*').eq(key, query[key]).single();
          return data;
        }
      }
    }
  };
}

export const db = {
  users: createTableProxy('users'),
  shops: createTableProxy('shops'),
  tenants: createTableProxy('tenants'),
  sales: createTableProxy('sales'),
  payments: createTableProxy('payments'),
  blocks: createTableProxy('blocks'),
  floors: createTableProxy('floors'),
  installments: createTableProxy('installments'),
  documents: createTableProxy('documents')
};

export const initializeDefaultAdmin = async () => {
  // Not strictly needed if seeded in SQL, but good as a fallback
  const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
  if (count === 0) {
    await supabase.from('users').insert({
      username: 'admin',
      password: 'admin',
      role: 'admin'
    });
  }
};
