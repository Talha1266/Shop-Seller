import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const ProjectContext = createContext();

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch all projects
  useEffect(() => {
    let subscription;

    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching projects:', error);
      } else if (data) {
        setProjects(data);
        
        if (data.length > 0) {
          // Check local storage for previously selected project
          const savedProjectId = localStorage.getItem('activeProjectId');
          const savedProject = data.find(p => p.id === savedProjectId);
          
          if (savedProject) {
            setActiveProject(savedProject);
          }
        }
      }
      setLoading(false);
    };

    fetchProjects();

    subscription = supabase
      .channel('public:projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        fetchProjects();
      })
      .subscribe();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, []);

  const changeActiveProject = (projectId) => {
    if (!projectId) {
      setActiveProject(null);
      localStorage.removeItem('activeProjectId');
      return;
    }
    
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setActiveProject(project);
      localStorage.setItem('activeProjectId', project.id);
    }
  };

  const createProject = async (name) => {
    const { data, error } = await supabase
      .from('projects')
      .insert({ name })
      .select()
      .single();
      
    if (error) throw error;
    
    // Automatically switch to the newly created project
    if (data) {
      setActiveProject(data);
      localStorage.setItem('activeProjectId', data.id);
    }
    return data;
  };

  const deleteProject = async (projectId) => {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);
      
    if (error) throw error;
    
    if (activeProject?.id === projectId) {
      setActiveProject(null);
      localStorage.removeItem('activeProjectId');
    }
  };

  const forceDeleteProject = async (projectId) => {
    // Delete all child tables in reverse dependency order
    await supabase.from('payments').delete().eq('project_id', projectId);
    await supabase.from('installments').delete().eq('project_id', projectId);
    await supabase.from('sales').delete().eq('project_id', projectId);
    await supabase.from('documents').delete().eq('project_id', projectId);
    await supabase.from('tenants').delete().eq('project_id', projectId);
    await supabase.from('shops').delete().eq('project_id', projectId);
    await supabase.from('floors').delete().eq('project_id', projectId);
    await supabase.from('blocks').delete().eq('project_id', projectId);
    
    // Finally delete the project
    await deleteProject(projectId);
  };

  return (
    <ProjectContext.Provider value={{ 
      projects, 
      activeProject, 
      changeActiveProject, 
      createProject,
      deleteProject,
      forceDeleteProject,
      loading 
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
