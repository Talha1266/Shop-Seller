import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useProject } from '../contexts/ProjectContext';

export function useSupabase(tableName) {
  const [data, setData] = useState([]);
  const { activeProject } = useProject();

  useEffect(() => {
    let subscription;
    
    const fetchData = async () => {
      let query = supabase.from(tableName).select('*');
      
      const globalTables = ['users', 'projects', 'app_settings', 'petrol_pumps', 'petrol_pump_rent_collections'];
      if (!globalTables.includes(tableName) && activeProject) {
        query = query.eq('project_id', activeProject.id);
      }
      
      const { data: result, error } = await query;
      if (error) {
        console.error(`Error fetching from ${tableName}:`, error);
      } else if (result) {
        setData(result);
      }
    };

    fetchData();

    subscription = supabase
      .channel(`public:${tableName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, (payload) => {
        // Re-fetch data on any change
        fetchData();
      })
      .subscribe();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [tableName, activeProject]);

  return data;
}
