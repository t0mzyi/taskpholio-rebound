export interface User {
  _id: string;
  name: string;
  email: string;
  role: "CEO" | "CTO" | "Member";
  avatar?: string;
  team?: any;
  status: "active" | "away" | "busy";
  lastActive: string;
  createdAt: string;
}

export interface Attachment {
  fileName: string;
  fileUrl: string;
  fileType: string;
  uploadedAt: string;
}

export interface Subtask {
  _id: string;
  title: string;
  completed: boolean;
  assignedTo?: User;
}

export interface Comment {
  _id: string;
  user: User;
  text: string;
  attachments: Attachment[];
  createdAt: string;
}

export interface Activity {
  user: User;
  action: string;
  details: string;
  timestamp: string;
}

export interface TeamProgressEntry {
  userId: string;
  userName: string;
  status: "pending" | "in-progress" | "completed";
  updatedAt: string;
}

export interface Task {
  _id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "blocked" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent" | "critical";
  assignedTo?: User | null;
  assignedToId?: string | null;
  team?: any;
  teamId?: string | null;
  assignmentType?: "individual" | "team" | "hybrid";
  createdBy?: User | null;
  visibility?: "personal" | "team" | "all";
  dueDate?: string;
  client?: Client | null;
  attachments: Attachment[];
  subtasks: Subtask[];
  comments: Comment[];
  activity: Activity[];
  teamProgress?: TeamProgressEntry[];
  tags: string[];
  isArchived: boolean;
  progress: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  _id: string;
  title: string;
  description: string;
  organizer: User;
  attendees: User[];
  startTime: string;
  endTime: string;
  location: string;
  meetingLink?: string;
  status: "scheduled" | "ongoing" | "completed" | "cancelled";
  team: any;
  createdAt: string;
}

export interface Notification {
  _id: string;
  user: string;
  type:
    | "TASK_ASSIGNED"
    | "TASK_UPDATED"
    | "TASK_COMPLETED"
    | "COMMENT_ADDED"
    | "SUBTASK_UPDATED"
    | "MEETING_READY"
    | "SYSTEM"
    | "task_assigned"
    | "task_updated"
    | "task_completed"
    | "member_added"
    | "meeting_scheduled";
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface Team {
  _id: string;
  name: string;
  description: string;
  manager: User;
  members: User[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    activeProjects: number;
  };
  createdAt: string;
}
export interface ProgressUpdate {
  task: string;
  newProgress: number;
}

export interface Client {
  _id: string;
  name: string;
  email: string;
  company: string;
  status: "pending" | "active" | "inactive";
  lastLogin?: string;
  createdAt: string;
}

export interface Project {
  _id: string;
  name: string;
  description?: string;
  status: 'planning' | 'in-progress' | 'review' | 'completed';
  client: string | Client;
  dueDate?: string;
  progress: number;
  milestones: {
    started: { status: boolean; date?: string };
    discovery: { status: boolean; date?: string };
    designing: { status: boolean; date?: string; FigmaLink?: string };
    development: { status: boolean; date?: string };
    testing: { status: boolean; date?: string };
    finalLaunch: { status: boolean; date?: string; productLink?: string };
  };
  createdAt: string;
}

export interface Agreement {
  _id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize?: string;
  category: 'Agreement' | 'Invoice' | 'Document' | 'Other';
  status: 'draft' | 'signed' | 'expired';
  project?: string;
  client: string | Client;
  createdAt: string;
}

export interface Message {
  _id: string;
  text: string;
  client: string;
  sender: string;
  senderType: 'User' | 'Client';
  senderName?: string;
  attachments?: any[];
  createdAt: string;
}
