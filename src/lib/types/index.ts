export type UserRole = "admin" | "foreman" | "worker";
export type WorkerJobTitle =
  | "Şoför"
  | "Operatör"
  | "Tesisçi"
  | "Elektrik Teknisyeni";
export type AssetStatus = "active" | "maintenance" | "fault" | "inactive";
export type TaskType = "operation" | "fault_repair" | "maintenance" | "cleaning" | "stock_check";
export type TaskSource = "manual" | "daily_operation";
export type Priority = "urgent" | "normal" | "low";
export type TaskStatus =
  | "pending"
  | "in_progress"
  | "paused"
  | "completed"
  | "fault"
  | "cancelled";
export type FaultStatus = "open" | "in_progress" | "resolved" | "closed";
export type ChecklistItemType = "tick" | "two_option" | "three_option" | "numeric";
export type WorkerStatus = "working" | "maintenance" | "waiting" | "cleaning";
export type ChecklistItemSeverity = "critical" | "normal";

export interface User {
  id: string;
  tenantId: string;
  fullName: string;
  username: string;
  role: UserRole;
  jobTitle?: WorkerJobTitle;
  phone?: string;
  isActive: boolean;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetCategory {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  displayOrder: number;
  config: Record<string, unknown>;
}

export interface Asset {
  id: string;
  tenantId: string;
  categoryId: string;
  parentId?: string;
  name: string;
  code: string;
  metadata: Record<string, unknown>;
  status: AssetStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  category?: AssetCategory;
  children?: Asset[];
}

export interface WorkerAssetAssignment {
  id: string;
  tenantId: string;
  workerId: string;
  assetId: string;
  assignedBy: string;
  assignedAt: Date;
  unassignedAt?: Date;
}

export interface Task {
  id: string;
  tenantId: string;
  assetId: string;
  assignedTo: string;
  createdBy: string;
  taskType: TaskType;
  source?: TaskSource;
  priority: Priority;
  status: TaskStatus;
  description?: string;
  deadlineAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  durationMinutes?: number;
  completionNote?: string;
  createdAt: Date;
  updatedAt: Date;
  asset?: Asset;
  assignee?: User;
  taskAssignments?: Array<{ user: User }>;
  creator?: User;
}

export interface FaultReport {
  id: string;
  tenantId: string;
  assetId: string;
  reportedBy: string;
  partName?: string;
  operationType?: string;
  description: string;
  status: FaultStatus;
  faultStart?: Date;
  faultEnd?: Date;
  downtimeMinutes?: number;
  resolvedBy?: string;
  resolutionNote?: string;
  createdAt: Date;
  asset?: Asset;
  reporter?: User;
  photos?: Photo[];
}

export interface Photo {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  storagePath: string;
  fileSize?: number;
  uploadedBy: string;
  createdAt: Date;
}

export interface ChecklistTemplate {
  id: string;
  tenantId: string;
  categoryId?: string;
  name: string;
  isActive: boolean;
  templateAssets?: ChecklistTemplateAsset[];
  items?: ChecklistItem[];
  createdAt: Date;
}

export interface ChecklistTemplateAsset {
  id: string;
  tenantId: string;
  templateId: string;
  assetId: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  asset?: Asset;
}

export interface ChecklistItem {
  id: string;
  templateId: string;
  assetId: string;
  label: string;
  itemType: ChecklistItemType;
  severity: ChecklistItemSeverity;
  isActive: boolean;
  options?: string[];
  unit?: string;
  minThreshold?: number;
  maxThreshold?: number;
  photoRequiredOnAbnormal: boolean;
  displayOrder: number;
  asset?: Asset;
}

export interface ChecklistSubmission {
  id: string;
  tenantId: string;
  templateId: string;
  assetId: string;
  submittedBy: string;
  submittedAt: Date;
  status: string;
  entries?: ChecklistEntry[];
  template?: ChecklistTemplate;
  asset?: Asset;
  submitter?: User;
}

export interface ChecklistEntry {
  id: string;
  submissionId: string;
  itemId: string;
  value: Record<string, unknown>;
  isAbnormal: boolean;
  note?: string;
  item?: ChecklistItem;
}

export interface HourlyReport {
  id: string;
  tenantId: string;
  workerId: string;
  status: WorkerStatus;
  note?: string;
  promptedAt: Date;
  respondedAt: Date;
  responseTimeSec?: number;
  worker?: User;
  photos?: Photo[];
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  operation: "Çalıştırma",
  fault_repair: "Arıza Giderme",
  maintenance: "Periyodik Bakım",
  cleaning: "Temizlik",
  stock_check: "Stok Kontrolü",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Acil",
  normal: "Normal",
  low: "Düşük",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Bekliyor",
  in_progress: "Devam Ediyor",
  paused: "Duraklatıldı",
  completed: "Tamamlandı",
  fault: "Arıza",
  cancelled: "İptal",
};

export const FAULT_STATUS_LABELS: Record<FaultStatus, string> = {
  open: "Açık",
  in_progress: "İşleniyor",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
};

export const WORKER_STATUS_LABELS: Record<WorkerStatus, string> = {
  working: "Çalışıyorum",
  maintenance: "Bakım Yapıyorum",
  waiting: "Bekliyorum",
  cleaning: "Temizlik",
};

export const CHECKLIST_ITEM_SEVERITY_LABELS: Record<ChecklistItemSeverity, string> = {
  critical: "Kritik",
  normal: "Normal",
};

export const CHECKLIST_TYPE_LABELS: Record<ChecklistItemType, string> = {
  tick: "Onay (Tik)",
  two_option: "İki Seçenek",
  three_option: "Üç Seçenek",
  numeric: "Sayısal Giriş",
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Yönetici",
  foreman: "Ustabaşı",
  worker: "Personel",
};

export const WORKER_JOB_TITLES: WorkerJobTitle[] = [
  "Şoför",
  "Operatör",
  "Tesisçi",
  "Elektrik Teknisyeni",
];
