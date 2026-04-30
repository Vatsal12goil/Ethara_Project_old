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
  getDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { Project, OperationType } from '../types';

export const projectService = {
  getProjects(userId: string, callback: (projects: Project[]) => void) {
    const q = query(collection(db, 'projects'), where('memberIds', 'array-contains', userId));
    return onSnapshot(q, (snapshot) => {
      const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      callback(projects);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'projects'));
  },

  getAllProjects(callback: (projects: Project[]) => void) {
    const q = query(collection(db, 'projects'));
    return onSnapshot(q, (snapshot) => {
      const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      callback(projects);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'projects'));
  },

  getProjectStream(projectId: string, callback: (project: Project | null) => void) {
    const docRef = doc(db, 'projects', projectId);
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() } as Project);
      } else {
        callback(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `projects/${projectId}`));
  },

  async getProject(projectId: string) {
    try {
      const docRef = doc(db, 'projects', projectId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Project;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `projects/${projectId}`);
    }
  },

  async createProject(name: string, description: string, ownerId: string) {
    try {
      const docRef = doc(collection(db, 'projects'));
      const projectData = {
        id: docRef.id,
        name,
        description,
        ownerId,
        memberIds: [ownerId],
        createdAt: serverTimestamp(),
      };
      await setDoc(docRef, projectData);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  },

  async updateProject(projectId: string, data: Partial<Project>) {
    try {
      const docRef = doc(db, 'projects', projectId);
      await updateDoc(docRef, data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    }
  },

  async addMember(projectId: string, userId: string) {
    try {
      const docRef = doc(db, 'projects', projectId);
      await updateDoc(docRef, {
        memberIds: arrayUnion(userId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    }
  },

  async removeMember(projectId: string, userId: string) {
    try {
      const docRef = doc(db, 'projects', projectId);
      await updateDoc(docRef, {
        memberIds: arrayRemove(userId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    }
  },

  async deleteProject(projectId: string) {
    try {
      await deleteDoc(doc(db, 'projects', projectId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}`);
    }
  }
};
