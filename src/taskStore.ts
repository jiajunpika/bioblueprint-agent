import { BioBlueprint } from "./types/bioblueprint";

export interface Task {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: BioBlueprint;
  error?: string;
  createdAt: Date;
}

// In-memory task storage (consider Redis for production)
const tasks = new Map<string, Task>();

// Auto-cleanup old tasks after 1 hour
const TASK_EXPIRY_MS = 60 * 60 * 1000;

export function createTask(id: string): Task {
  const task: Task = {
    id,
    status: "pending",
    createdAt: new Date(),
  };
  tasks.set(id, task);

  // Schedule cleanup
  setTimeout(() => {
    tasks.delete(id);
  }, TASK_EXPIRY_MS);

  return task;
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}

export function updateTask(id: string, updates: Partial<Task>): void {
  const task = tasks.get(id);
  if (task) {
    Object.assign(task, updates);
  }
}

export function getAllTasks(): Task[] {
  return Array.from(tasks.values());
}
