import React, { useEffect, useState } from 'react';
import { useAuth } from '../services/authContext';
import { projectService } from '../services/projectService';
import { taskService } from '../services/taskService';
import { Project, Task, TaskStatus, TaskPriority } from '../types';
import { CheckCircle2, Clock, ListTodo, Users, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!user) return;

    let taskListeners: Record<string, () => void> = {};
    const tasksMap: Record<string, Task[]> = {};

    const unsubscribeProjects = projectService.getAllProjects((loadedProjects) => {
      setProjects(loadedProjects);
      
      if (loadedProjects.length === 0) {
        setLoading(false);
        setAllTasks([]);
        return;
      }

      // Cleanup listeners for projects that are no longer present
      const projectIds = loadedProjects.map(p => p.id);
      Object.keys(taskListeners).forEach(id => {
        if (!projectIds.includes(id)) {
          taskListeners[id]();
          delete taskListeners[id];
          delete tasksMap[id];
        }
      });

      // Set up listeners for projects
      loadedProjects.forEach(project => {
        if (!taskListeners[project.id]) {
          const unsubscribeTasks = taskService.getTasksInProject(project.id, (projectTasks) => {
            tasksMap[project.id] = projectTasks;
            const flatTasks = Object.values(tasksMap).flat();
            
            // Sort by creation date (descending)
            const sortedTasks = flatTasks.sort((a, b) => {
              const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
              const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
              return dateB - dateA;
            });

            setAllTasks(sortedTasks);
            setLoading(false);
          });
          taskListeners[project.id] = unsubscribeTasks;
        }
      });
    });

    return () => {
      unsubscribeProjects();
      Object.values(taskListeners).forEach(u => u());
    };
  }, [user]);

  const isOverdue = (task: Task) => {
    if (!task.dueDate || task.status === TaskStatus.DONE) return false;
    const date = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    return date < new Date();
  };

  const myTasks = allTasks.filter(t => t.assigneeId === user?.id);
  const overdueTasks = allTasks.filter(t => isOverdue(t));

  const stats = [
    { label: 'Total Tasks', value: allTasks.length, icon: ListTodo, color: 'text-slate-600', bg: 'bg-white' },
    { label: 'In Progress', value: allTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length, icon: Clock, color: 'text-indigo-600', bg: 'bg-white' },
    { label: 'Completed', value: allTasks.filter(t => t.status === TaskStatus.DONE).length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-white' },
    { label: 'Overdue', value: overdueTasks.length, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50/30 ring-2 ring-rose-100' },
  ];

  if (loading) return <div className="animate-pulse p-8 flex flex-col gap-8">
    <div className="grid grid-cols-4 gap-6">
      {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white rounded-xl border border-slate-200" />)}
    </div>
    <div className="h-64 bg-white rounded-xl border border-slate-200" />
  </div>;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm">Welcome back, {user?.name}. Here's current status.</p>
        </div>
        <div className="flex -space-x-2">
           <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700">UI</div>
           <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-emerald-700">BK</div>
        </div>
      </header>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={stat.label} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`${stat.bg} p-6 rounded-xl border border-slate-200 flex flex-col`}
          >
            <p className={`${stat.color} text-[10px] font-bold uppercase tracking-wider mb-1`}>{stat.label}</p>
            <h3 className={`text-2xl font-bold ${stat.color}`}>{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Tasks */}
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-sm uppercase tracking-widest text-slate-400">My Tasks</h4>
            <span className="text-xs font-medium text-slate-400">{myTasks.length}</span>
          </div>
          <div className="space-y-3">
            {myTasks.length === 0 ? (
              <p className="text-slate-400 text-sm italic">No tasks assigned.</p>
            ) : (
              myTasks.slice(0, 5).map(task => (
                <div 
                  key={task.id} 
                  onClick={() => setViewingTask(task)}
                  className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-colors cursor-pointer group hover:bg-white"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{task.title}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{projects.find(p => p.id === task.projectId)?.name || 'Processing...'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    task.status === TaskStatus.DONE ? 'bg-emerald-50 text-emerald-600' : 
                    task.status === TaskStatus.IN_PROGRESS ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 ring-2 ring-rose-50 hover:ring-rose-200 transition-all">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-sm uppercase tracking-widest text-rose-600">Urgent Attention</h4>
            <span className="text-xs font-medium text-rose-400">{overdueTasks.length}</span>
          </div>
          <div className="space-y-3">
            {overdueTasks.length === 0 ? (
              <p className="text-slate-400 text-sm italic">System clear. No overdue tasks.</p>
            ) : (
              overdueTasks.slice(0, 5).map(task => (
                <div 
                  key={task.id} 
                  onClick={() => setViewingTask(task)}
                  className="flex items-center justify-between p-4 rounded-lg bg-rose-50/50 border border-rose-100 hover:border-rose-400 transition-colors cursor-pointer group hover:bg-white"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-rose-900 truncate">{task.title}</p>
                    <p className="text-[10px] text-rose-600 font-bold mt-1 uppercase tracking-tighter">
                      DUE: {new Date(task.dueDate.toDate ? task.dueDate.toDate() : task.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <AlertCircle size={14} className="text-rose-400" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Task Details Modal (consistent with ProjectBoard) */}
      <AnimatePresence>
        {viewingTask && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <div className="flex gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                        viewingTask.priority === TaskPriority.HIGH ? 'bg-rose-50 text-rose-600' :
                        viewingTask.priority === TaskPriority.MEDIUM ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {viewingTask.priority} Priority
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase tracking-wide border border-slate-200">
                        {viewingTask.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 leading-tight">{viewingTask.title}</h2>
                  </div>
                  <button 
                    onClick={() => setViewingTask(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Assignee</label>
                      <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-xs font-bold text-indigo-600 flex items-center justify-center">
                          {viewingTask.assigneeId.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{viewingTask.assigneeId === user?.id ? 'You' : viewingTask.assigneeId.substring(0, 8)}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Contributor</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Due Date</label>
                      <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isOverdue(viewingTask) ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                          <Clock size={16} />
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold ${isOverdue(viewingTask) ? 'text-rose-600' : 'text-slate-700'}`}>
                            {viewingTask.dueDate?.toDate ? viewingTask.dueDate.toDate().toLocaleDateString() : new Date(viewingTask.dueDate || '').toLocaleDateString()}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                            {isOverdue(viewingTask) ? 'Expired' : 'Deadline'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">Description</label>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 min-h-[120px]">
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {viewingTask.description || 'No description provided for this task.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setViewingTask(null)}
                    className="flex-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-xl transition-all uppercase tracking-widest border border-slate-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
