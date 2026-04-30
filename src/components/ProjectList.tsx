import React, { useEffect, useState } from 'react';
import { useAuth } from '../services/authContext';
import { projectService } from '../services/projectService';
import { Project, UserRole } from '../types';
import { Link } from 'react-router-dom';
import { Plus, Users, ArrowRight, FolderKanban } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ProjectList() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my');
  const [isModalOpen, setModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });

  useEffect(() => {
    if (!user) return;
    
    let unsubscribe: () => void;
    if (activeTab === 'my') {
      unsubscribe = projectService.getProjects(user.id, setProjects);
    } else {
      unsubscribe = projectService.getAllProjects(setProjects);
    }
    
    return () => unsubscribe && unsubscribe();
  }, [user, activeTab]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    await projectService.createProject(newProject.name, newProject.description, user.id);
    setNewProject({ name: '', description: '' });
    setModalOpen(false);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Workspaces</h1>
          <p className="text-slate-500 text-sm">Organize your teams and collaborative projects.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => setActiveTab('my')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'my' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              MY STUFF
            </button>
            <button 
              onClick={() => setActiveTab('all')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              EXPLORE
            </button>
          </div>
          <button 
            onClick={() => setModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Create Project
          </button>
        </div>
      </header>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project, i) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="group"
          >
            <Link to={`/projects/${project.id}`} className="block h-full">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full group-hover:border-indigo-400 group-hover:shadow-md transition-all">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold">
                       <FolderKanban size={20} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">{project.name}</h3>
                  </div>
                  <p className="text-slate-500 text-sm line-clamp-2 mb-6 leading-relaxed">{project.description}</p>
                </div>
                
                <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                  <div className="flex -space-x-1.5">
                    {project.memberIds.slice(0, 3).map(id => (
                      <div key={id} className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[8px] font-bold text-slate-400">
                        {id.substring(0, 1).toUpperCase()}
                      </div>
                    ))}
                    {project.memberIds.length > 3 && (
                      <div className="w-6 h-6 rounded-full bg-slate-50 border border-white flex items-center justify-center text-[8px] font-bold text-slate-400">
                        +{project.memberIds.length - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">Open Board</span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}

        {projects.length === 0 && (
          <div className="col-span-full py-24 text-center border-2 border-dashed border-slate-200 rounded-2xl">
             <FolderKanban size={48} className="mx-auto mb-4 text-slate-200" />
             <h2 className="text-lg font-bold text-slate-900">No workspaces yet</h2>
             <p className="text-slate-500 text-sm mt-1">Start by creating a project for your team.</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-white p-8 rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full"
          >
            <h2 className="text-xl font-bold mb-6 text-slate-900">Configure Workspace</h2>
            <form onSubmit={handleCreateProject} className="space-y-6">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Label</label>
                <input 
                  required
                  type="text" 
                  value={newProject.name}
                  onChange={e => setNewProject({...newProject, name: e.target.value})}
                  className="w-full bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm"
                  placeholder="e.g. Design Team 2024"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Summary</label>
                <textarea 
                  value={newProject.description}
                  onChange={e => setNewProject({...newProject, description: e.target.value})}
                  className="w-full bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm h-32"
                  placeholder="Core objectives..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">Abort</button>
                <button type="submit" className="btn-primary flex-2">Initialize</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}
