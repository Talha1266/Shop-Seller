import { useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useProject } from '../contexts/ProjectContext';

export function useDb() {
  const { activeProject } = useProject();

  const db = useMemo(() => {
    function createTableProxy(tableName) {
      return {
        toArray: async () => {
          let query = supabase.from(tableName).select('*');
          if (tableName !== 'users' && tableName !== 'projects' && activeProject) {
            query = query.eq('project_id', activeProject.id);
          }
          const { data } = await query;
          return data || [];
        },
        add: async (item) => {
          const itemToInsert = { ...item };
          if (tableName !== 'users' && tableName !== 'projects' && activeProject) {
            itemToInsert.project_id = activeProject.id;
          }
          const { data, error } = await supabase.from(tableName).insert(itemToInsert).select().single();
          if (error) {
            console.error(`Error adding to ${tableName}:`, error);
            throw error;
          }
          return data?.id;
        },
        bulkAdd: async (items) => {
          const itemsToInsert = items.map(item => {
            if (tableName !== 'users' && tableName !== 'projects' && activeProject) {
              return { ...item, project_id: activeProject.id };
            }
            return item;
          });
          const { data, error } = await supabase.from(tableName).insert(itemsToInsert).select();
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
        where: (queryObj) => {
          return {
            first: async () => {
              const key = Object.keys(queryObj)[0];
              let query = supabase.from(tableName).select('*').eq(key, queryObj[key]);
              if (tableName !== 'users' && tableName !== 'projects' && activeProject) {
                query = query.eq('project_id', activeProject.id);
              }
              const { data } = await query.single();
              return data;
            }
          }
        }
      };
    }

    return {
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
  }, [activeProject]);

  return db;
}

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
