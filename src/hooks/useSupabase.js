import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useSupabase(tableName) {
  const [data, setData] = useState([]);

  useEffect(() => {
    let subscription;
    
    const fetchData = async () => {
      const { data: result, error } = await supabase.from(tableName).select('*');
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
  }, [tableName]);

  return data;
}
