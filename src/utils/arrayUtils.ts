/**
 * Utility functions for array and collection operations
 */

import { WorkItemReference, WorkItem } from "azure-devops-extension-api/WorkItemTracking";

/**
 * Extracts work item IDs from an array of work item references
 * @param workItemReferences - Array of work item references
 * @returns Array of work item IDs
 */
export const getWorkItemIDsForRefs = (
  workItemReferences: WorkItemReference[]
): number[] => {
  return workItemReferences.map((wi) => wi.id);
};

/**
 * Extracts work item IDs from an array of work items
 * @param workItems - Array of work items
 * @returns Array of work item IDs
 */
export const getWorkItemIDsForWI = (workItems: WorkItem[]): number[] => {
  return workItems.map((wi) => wi.id);
};

/**
 * Parses a comma-separated string of tags into an array
 * @param tagString - Comma-separated tag string
 * @returns Array of trimmed tag strings
 */
export const splitTagsValue = (tagString: string): string[] => {
  if (tagString.trim().length === 0) {
    return [];
  }
  return tagString.split(',').map((tag) => tag.trim());
};
