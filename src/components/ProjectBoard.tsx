import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { taskService } from '../services/taskService';
import { useAuth } from '../services/authContext';
import { Project, Task, TaskStatus, TaskPriority, UserRole } from '../types';
import { Plus, ChevronLeft, MoreVertical, Clock, AlertCircle, Trash2, CheckCircle2, UserPlus, X, Minus, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function ProjectBoard() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<{id: string, name: string}[]>([]);
  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: TaskPriority.MEDIUM, assigneeId: '' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  
  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('all');

  useEffect(() => {
    if (!projectId) return;
    const unsubscribeProject = projectService.getProjectStream(projectId, async (p) => {
      setProject(p);
      if (p?.memberIds) {
        try {
          const membersData = [];
          // Fetch names for members (batching would be better but this is fine for small groups)
          for (const id of p.memberIds) {
            const userDoc = await getDocs(query(collection(db, 'users'), where('id', '==', id), limit(1)));
            if (!userDoc.empty) {
              const u = userDoc.docs[0].data();
              membersData.push({ id: u.id, name: u.name || u.email });
            } else {
              membersData.push({ id, name: id.substring(0, 8) });
            }
          }
          setMembers(membersData);
        } catch (err) {
          console.error("Error fetching members:", err);
        }
      }
    });
    const unsubscribeTasks = taskService.getTasksInProject(projectId, setTasks);
    return () => {
      unsubscribeProject();
      unsubscribeTasks();
    };
  }, [projectId]);

  const isOverdue = (task: Task) => {
    if (!task.dueDate || task.status === TaskStatus.DONE) return false;
    const date = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    return date < new Date();
  };

  const columns = [
    { title: 'Overdue', id: 'overdue', dotColor: 'bg-rose-500', icon: AlertCircle },
    { title: 'To Do', status: TaskStatus.TODO, id: TaskStatus.TODO, dotColor: 'bg-slate-300' },
    { title: 'In Progress', status: TaskStatus.IN_PROGRESS, id: TaskStatus.IN_PROGRESS, dotColor: 'bg-indigo-500' },
    { title: 'Done', status: TaskStatus.DONE, id: TaskStatus.DONE, dotColor: 'bg-emerald-500' },
  ];

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !user) return;
    
    // Default due date to tomorrow if not set
    const dueDateInput = (taskForm as any).dueDate;
    const dueDate = dueDateInput ? new Date(dueDateInput) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (editingTask) {
      await taskService.updateTask(projectId, editingTask.id, {
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        assigneeId: taskForm.assigneeId,
        dueDate: dueDate,
      });
    } else {
      await taskService.createTask(projectId, {
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        assigneeId: taskForm.assigneeId,
        status: TaskStatus.TODO,
        creatorId: user.id,
        dueDate: dueDate,
      });
    }
    setTaskForm({ title: '', description: '', priority: TaskPriority.MEDIUM, assigneeId: '' });
    setEditingTask(null);
    setTaskModalOpen(false);
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !inviteEmail) return;
    setInviteError('');

    try {
      const q = query(collection(db, 'users'), where('email', '==', inviteEmail), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setInviteError('User not found. They must sign in to CollabGrid first.');
        return;
      }

      const newUser = querySnapshot.docs[0].data();
      if (project.memberIds.includes(newUser.id)) {
        setInviteError('User is already a member.');
        return;
      }

      await projectService.addMember(project.id, newUser.id);
      setInviteModalOpen(false);
      setInviteEmail('');
    } catch (err: any) {
      console.error(err);
      let message = 'Failed to add member.';
      try {
        const errObj = JSON.parse(err.message);
        if (errObj.error.includes('permissions')) message = 'Permission denied.';
      } catch (e) {}
      setInviteError(message);
    }
  };

  const handleRemoveMember = (targetUserId: string) => {
    if (!project) return;
    if (targetUserId === project.ownerId) {
      alert('Cannot remove the project owner.');
      return;
    }
    setMemberToRemove(targetUserId);
  };

  const confirmRemoveMember = async () => {
    if (!project || !memberToRemove) return;
    try {
      await projectService.removeMember(project.id, memberToRemove);
      setMemberToRemove(null);
    } catch (err: any) {
      console.error(err);
      alert('Failed to remove member. Check console for details.');
    }
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    if (!projectId) return;
    await taskService.updateTask(projectId, taskId, { status });
  };

  const deleteTask = async (taskId: string) => {
    if (!projectId || !window.confirm('Delete this task?')) return;
    await taskService.deleteTask(projectId, taskId);
  };

  const getAssigneeName = (id: string) => {
    const member = members.find(m => m.id === id);
    return member ? member.name : id.substring(0, 4).toUpperCase();
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      assigneeId: task.assigneeId,
    });
    // Format date for input
    const date = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate || Date.now());
    (taskForm as any).dueDate = date.toISOString().split('T')[0];
    setTaskModalOpen(true);
  };

  if (!project) return <div className="h-screen flex items-center justify-center font-mono uppercase tracking-widest text-slate-400">Loading_Data...</div>;

  const isAdmin = project.ownerId === user?.id || user?.role === UserRole.ADMIN;
  const isMember = isAdmin || project.memberIds.includes(user?.id || '');

  const getFilteredTasks = (taskList: Task[]) => {
    return taskList.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            task.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
      const matchesAssignee = filterAssignee === 'all' || task.assigneeId === filterAssignee;
      
      let matchesDate = true;
      if (filterDate !== 'all' && task.dueDate) {
        const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const taskDate = new Date(dueDate);
        taskDate.setHours(0, 0, 0, 0);

        if (filterDate === 'today') {
          matchesDate = taskDate.getTime() === today.getTime();
        } else if (filterDate === 'week') {
          const nextWeek = new Date(today);
          nextWeek.setDate(today.getDate() + 7);
          matchesDate = taskDate >= today && taskDate <= nextWeek;
        } else if (filterDate === 'overdue') {
          matchesDate = taskDate < today && task.status !== TaskStatus.DONE;
        }
      } else if (filterDate !== 'all' && !task.dueDate) {
        matchesDate = false;
      }
      
      return matchesSearch && matchesPriority && matchesAssignee && matchesDate;
    });
  };

  const currentFilteredTasks = getFilteredTasks(tasks);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col gap-6 p-8 overflow-hidden">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/projects" className="text-slate-400 hover:text-slate-900 transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">{project.name}</h2>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase tracking-wide border border-slate-200">
              {isAdmin ? 'Admin' : isMember ? 'Member' : 'Viewer'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex -space-x-2">
            {project.memberIds.slice(0, 3).map(id => (
              <div key={id} className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                {id.substring(0, 2).toUpperCase()}
              </div>
            ))}
            {project.memberIds.length > 3 && (
              <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                +{project.memberIds.length - 3}
              </div>
            )}
            {isAdmin && (
              <button 
                onClick={() => setInviteModalOpen(true)}
                className="w-8 h-8 rounded-full bg-indigo-50 border-2 border-white flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition-colors"
                title="Add member"
              >
                <Plus size={14} />
              </button>
            )}
          </div>
          {isMember && (
            <button 
              onClick={() => setTaskModalOpen(true)}
              className="btn-primary"
            >
              + New Task
            </button>
          )}
        </div>
      </header>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search tasks by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none transition-all shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <Filter size={14} className="text-slate-400" />
            <select 
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="text-xs font-bold text-slate-600 outline-none bg-transparent cursor-pointer"
            >
              <option value="all">ALL PRIORITIES</option>
              <option value={TaskPriority.HIGH}>HIGH ONLY</option>
              <option value={TaskPriority.MEDIUM}>MEDIUM ONLY</option>
              <option value={TaskPriority.LOW}>LOW ONLY</option>
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <Clock size={14} className="text-slate-400" />
            <select 
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="text-xs font-bold text-slate-600 outline-none bg-transparent cursor-pointer"
            >
              <option value="all">ANY TIME</option>
              <option value="today">DUE TODAY</option>
              <option value="week">DUE THIS WEEK</option>
              <option value="overdue">OVERDUE</option>
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <UserPlus size={14} className="text-slate-400" />
            <select 
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="text-xs font-bold text-slate-600 outline-none bg-transparent cursor-pointer max-w-[120px]"
            >
              <option value="all">EVERYONE</option>
              <option value={user?.id}>ASSIGNED TO ME</option>
              {project.memberIds.filter(id => id !== user?.id).map(id => (
                <option key={id} value={id}>MEMBER: {id.substring(0, 6)}</option>
              ))}
            </select>
          </div>

          {(searchQuery || filterPriority !== 'all' || filterAssignee !== 'all' || filterDate !== 'all') && (
            <button 
              onClick={() => {
                setSearchQuery('');
                setFilterPriority('all');
                setFilterAssignee('all');
                setFilterDate('all');
              }}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-6 flex-1 min-h-0 overflow-x-auto pb-4">
        {columns.map(column => {
          const filteredTasks = column.id === 'overdue' 
            ? currentFilteredTasks.filter(t => isOverdue(t))
            : column.id === TaskStatus.DONE 
              ? currentFilteredTasks.filter(t => t.status === TaskStatus.DONE)
              : currentFilteredTasks.filter(t => t.status === column.id && !isOverdue(t));

          return (
            <div key={column.id} className="flex-1 min-w-[300px] flex flex-col">
              <div className="flex items-center justify-between mb-6 group">
                <h4 className="font-bold text-xs flex items-center gap-2 uppercase tracking-widest text-slate-900">
                  <span className={`w-2.5 h-2.5 rounded-full ${column.dotColor}`}></span>
                  {column.title}
                </h4>
                <span className="text-xs font-bold text-slate-300 font-mono">
                  {filteredTasks.length}
                </span>
              </div>

              <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                {filteredTasks.map(task => (
                  <motion.div 
                    layout
                    key={task.id}
                    onClick={() => setViewingTask(task)}
                    className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-400 group relative transition-all cursor-pointer ${
                      task.status === TaskStatus.DONE ? 'opacity-70' : ''
                    } ${isOverdue(task) ? 'border-rose-200 bg-rose-50/20' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                          task.priority === TaskPriority.HIGH ? 'bg-rose-50 text-rose-600' :
                          task.priority === TaskPriority.MEDIUM ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {task.priority}
                        </span>
                        {isOverdue(task) && (
                          <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded uppercase flex items-center gap-1">
                            <Clock size={8} /> Overdue
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                         {task.status === TaskStatus.DONE && <CheckCircle2 size={12} className="text-emerald-500" />}
                         {(isAdmin || task.creatorId === user?.id) && (
                           <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTask(task.id);
                              }} 
                              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                              title="Delete task"
                            >
                              <Trash2 size={12} />
                           </button>
                         )}
                      </div>
                    </div>
                    
                    <p className={`text-sm font-bold text-slate-800 mb-4 leading-snug ${task.status === TaskStatus.DONE ? 'line-through text-slate-400' : ''}`}>
                      {task.title}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div 
                        onClick={(e) => {
                          if (isAdmin || (isMember && task.creatorId === user?.id)) {
                            e.stopPropagation();
                            openEditTask(task);
                          }
                        }}
                        className={`flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-100 bg-slate-50 transition-all ${(isAdmin || (isMember && task.creatorId === user?.id)) ? 'cursor-pointer hover:border-indigo-200 hover:bg-white' : ''}`}
                      >
                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-[7px] font-bold text-indigo-600 flex items-center justify-center">
                          {task.assigneeId.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate max-w-[80px]">
                          {getAssigneeName(task.assigneeId)}
                        </span>
                      </div>
                      <select 
                        value={task.status}
                        disabled={!isMember}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                        className={`text-[9px] font-bold uppercase tracking-tight text-slate-400 outline-none bg-transparent ${isMember ? 'focus:text-indigo-600 cursor-pointer' : ''}`}
                      >
                        {columns.filter(c => c.id !== 'overdue').map(c => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                  </motion.div>
                ))}
                
                {filteredTasks.length === 0 && (
                  <div className="border border-dashed border-slate-200 h-24 rounded-xl flex items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-200">Empty</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Details Modal */}
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
                          <span className="text-xs font-bold text-slate-700">{getAssigneeName(viewingTask.assigneeId)}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{viewingTask.assigneeId === user?.id ? 'Assigned to you' : 'Contributor'}</span>
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
                  {isAdmin && (
                    <button 
                      onClick={() => {
                        const taskToEdit = viewingTask;
                        setViewingTask(null);
                        openEditTask(taskToEdit);
                      }}
                      className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-lg shadow-indigo-200 uppercase tracking-widest"
                    >
                      Edit Task
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Modal */}
      <AnimatePresence>
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-8 rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full"
          >
            <h2 className="text-xl font-bold mb-6 text-slate-900 uppercase tracking-tight">
              {editingTask ? 'Edit Task Details' : 'New Collaboration Task'}
            </h2>
            <form onSubmit={handleCreateTask} className="space-y-5">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Title</label>
                <input 
                  required
                  type="text" 
                  value={taskForm.title}
                  onChange={e => setTaskForm({...taskForm, title: e.target.value})}
                  className="w-full bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm"
                  placeholder="What needs to be done?"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Description</label>
                <textarea 
                  value={taskForm.description}
                  onChange={e => setTaskForm({...taskForm, description: e.target.value})}
                  className="w-full bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm min-h-[80px]"
                  placeholder="Additional details..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Priority</label>
                  <select 
                    value={taskForm.priority}
                    onChange={e => setTaskForm({...taskForm, priority: e.target.value as TaskPriority})}
                    className="w-full bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 outline-none text-sm cursor-pointer"
                  >
                    <option value={TaskPriority.LOW}>Low</option>
                    <option value={TaskPriority.MEDIUM}>Medium</option>
                    <option value={TaskPriority.HIGH}>High</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Assignee</label>
                  <select 
                    required
                    disabled={!isAdmin && !!editingTask}
                    value={taskForm.assigneeId}
                    onChange={e => setTaskForm({...taskForm, assigneeId: e.target.value})}
                    className="w-full bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 outline-none text-sm cursor-pointer"
                  >
                    <option value="">Select Assignee...</option>
                    {members.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name} {member.id === user?.id ? '(Me)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 block">Due Date</label>
                <input 
                  type="date"
                  value={(taskForm as any).dueDate || ''}
                  onChange={e => setTaskForm({...taskForm, dueDate: e.target.value} as any)}
                  className="w-full bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setTaskModalOpen(false);
                    setEditingTask(null);
                    setTaskForm({ title: '', description: '', priority: TaskPriority.MEDIUM, assigneeId: '' });
                  }} 
                  className="flex-1 text-sm font-bold text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-2">
                  {editingTask ? 'Apply Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/10 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-8 rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full font-sans"
          >
            <h2 className="text-lg font-bold mb-2 text-slate-900">Manage Collaborators</h2>
            
            <div className="relative">
              <div className="mb-6 space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-3">Current Members</label>
                {project.memberIds.map(id => (
                  <div key={id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 group transition-all hover:bg-white hover:border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-[8px] font-bold text-indigo-600 flex items-center justify-center">
                        {id.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-mono text-slate-600">{id === project.ownerId ? `${id.substring(0, 8)} (Owner)` : id.substring(0, 8)}</span>
                    </div>
                    {isAdmin && id !== project.ownerId && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMember(id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-100 rounded-full transition-all flex items-center justify-center"
                        title="Kick member"
                      >
                        <Minus size={16} className="stroke-[3px]" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Custom Confirmation Overlay */}
              <AnimatePresence>
                {memberToRemove && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute inset-x-0 -top-2 bg-white/95 backdrop-blur-sm border border-rose-100 shadow-xl p-4 rounded-xl z-20 flex flex-col items-center text-center"
                  >
                    <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-2">
                      <AlertCircle size={20} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Remove Member?</h3>
                    <p className="text-[10px] text-slate-500 mb-4 font-bold uppercase tracking-wider">Are you sure you want to remove this member?</p>
                    <div className="flex gap-2 w-full">
                      <button 
                        onClick={() => setMemberToRemove(null)}
                        className="flex-1 py-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg uppercase tracking-widest"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={confirmRemoveMember}
                        className="flex-1 py-1.5 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg uppercase tracking-widest"
                      >
                        Confirm
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <p className="text-slate-400 text-xs mb-6 leading-relaxed">Enter their email to grant them member access to this project board.</p>
            <form onSubmit={handleInviteMember} className="space-y-4">
              <input 
                required
                type="email" 
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="w-full bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm"
                placeholder="email@example.com"
              />
              {inviteError && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-tight">{inviteError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setInviteModalOpen(false)} className="flex-1 text-xs font-bold text-slate-400">Close</button>
                <button type="submit" className="btn-primary text-xs flex-2">Add Member</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}

