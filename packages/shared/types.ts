// Shared DTOs and enums between client and server

export type UserRole = "super_admin" | "admin" | "recruiter" | "viewer";

export interface UserDTO {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  orgId: number;
  orgName?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
