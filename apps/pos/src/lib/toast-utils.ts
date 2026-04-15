import { toast } from "sonner";

/**
 * Standardized toast notification utility
 * Provides consistent messaging across the application
 */

interface ToastOptions {
  duration?: number;
  description?: string;
}

/**
 * Parse backend error messages
 * Handles common error patterns including reference errors
 */
function parseErrorMessage(error: any): string {
  // Check for axios error response
  if (error?.response?.data?.message) {
    const message = error.response.data.message;
    
    // Handle array of messages
    if (Array.isArray(message)) {
      return message.join(", ");
    }
    
    return message;
  }

  // Check for TypeORM/PostgreSQL foreign key constraint errors
  if (error?.message) {
    const msg = error.message.toLowerCase();
    
    // Foreign key constraint violation
    if (msg.includes("foreign key constraint") || 
        msg.includes("violates foreign key") ||
        msg.includes("reference") ||
        msg.includes("constraint")) {
      return "Cannot delete this item because it is being used by other records. Please remove all related records first.";
    }
    
    // Unique constraint violation
    if (msg.includes("unique constraint") || msg.includes("duplicate")) {
      return "This item already exists. Please use a different value.";
    }
    
    return error.message;
  }

  return "An unexpected error occurred";
}

/**
 * Success toast notification
 */
export function showSuccessToast(message: string, options?: ToastOptions) {
  toast.success(message, {
    duration: options?.duration || 3000,
    description: options?.description,
  });
}

/**
 * Error toast notification
 */
export function showErrorToast(message: string, options?: ToastOptions) {
  toast.error(message, {
    duration: options?.duration || 4000,
    description: options?.description,
  });
}

/**
 * Error toast from exception
 * Automatically parses backend error responses
 */
export function showErrorFromException(
  error: any,
  fallbackMessage: string = "An error occurred"
) {
  const errorMessage = parseErrorMessage(error);
  console.error(`Error: ${fallbackMessage}`, error);
  
  toast.error(fallbackMessage, {
    duration: 4000,
    description: errorMessage !== fallbackMessage ? errorMessage : undefined,
  });
}

/**
 * Warning toast notification
 */
export function showWarningToast(message: string, options?: ToastOptions) {
  toast.warning(message, {
    duration: options?.duration || 3500,
    description: options?.description,
  });
}

/**
 * Info toast notification
 */
export function showInfoToast(message: string, options?: ToastOptions) {
  toast.info(message, {
    duration: options?.duration || 3000,
    description: options?.description,
  });
}

/**
 * Standard success messages
 */
export const SUCCESS_MESSAGES = {
  CREATED: (entity: string) => `${entity} created successfully`,
  UPDATED: (entity: string) => `${entity} updated successfully`,
  DELETED: (entity: string) => `${entity} deleted successfully`,
  SAVED: (entity: string) => `${entity} saved successfully`,
  ADDED: (entity: string) => `${entity} added successfully`,
  REMOVED: (entity: string) => `${entity} removed successfully`,
  SYNCED: (entity: string) => `${entity} synced successfully`,
  EXPORTED: (entity: string) => `${entity} exported successfully`,
  COMPLETED: (entity: string) => `${entity} completed successfully`,
} as const;

/**
 * Standard error messages
 */
export const ERROR_MESSAGES = {
  LOAD_FAILED: (entity: string) => `Failed to load ${entity}`,
  CREATE_FAILED: (entity: string) => `Failed to create ${entity}`,
  UPDATE_FAILED: (entity: string) => `Failed to update ${entity}`,
  DELETE_FAILED: (entity: string) => `Failed to delete ${entity}`,
  SAVE_FAILED: (entity: string) => `Failed to save ${entity}`,
  SYNC_FAILED: (entity: string) => `Failed to sync ${entity}`,
  EXPORT_FAILED: (entity: string) => `Failed to export ${entity}`,
  REQUIRED_FIELD: (field: string) => `${field} is required`,
  INVALID_VALUE: (field: string) => `Invalid ${field}`,
  NOT_FOUND: (entity: string) => `${entity} not found`,
} as const;
