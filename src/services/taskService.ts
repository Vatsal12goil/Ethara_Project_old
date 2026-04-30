import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { Task, OperationType, TaskStatus, TaskPriority } from '../types';

export const taskService = {
  getTasksInProject(projectId: string, callback: (tasks: Task[]) => void) {
    const q = query(collection(db, 'projects', projectId, 'tasks'));
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      callback(tasks);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/tasks`));
  },

  async createTask(projectId: string, task: Omit<Task, 'id' | 'createdAt' | 'projectId'>) {
    try {
      const docRef = doc(collection(db, 'projects', projectId, 'tasks'));
      const taskData = {
        ...task,
        id: docRef.id,
        projectId,
        createdAt: serverTimestamp(),
      };
      await setDoc(docRef, taskData);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${projectId}/tasks`);
    }
  },

  async updateTask(projectId: string, taskId: string, data: Partial<Task>) {
    try {
      const docRef = doc(db, 'projects', projectId, 'tasks', taskId);
      await updateDoc(docRef, data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}/tasks/${taskId}`);
    }
  },

  async deleteTask(projectId: string, taskId: string) {
    try {
      await deleteDoc(doc(db, 'projects', projectId, 'tasks', taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}/tasks/${taskId}`);
    }
  }
};
