/**
 * Service for managing work item history processing and trend data
 */

import { WorkItemTrackingRestClient, WorkItemReference } from "azure-devops-extension-api/WorkItemTracking";
import { IDurationSlice } from "../types/trendSliceTypes";
import { IWorkItemWithHistory, IWorkItemStateHistory } from "../types/workItemTypes";
import { getWorkItemIDsForRefs } from "../utils/arrayUtils";
import { calculateBoardColumnTime } from "../utils/workItemCalculations";
import { 
  dateSortWorkItems, 
  getClosedWorkItemSlices,
  calculateDurations 
} from "../utils/trendAnalysis";
import { ICategory } from "../types/categoryTypes";
import { getWorkItemsByQuery, getWorkItemDetailsBatch, getAllWorkItemsHistory } from "./workItemService";

/**
 * Retrieves and processes work item history with calculated durations
 * @param workItemReferences - References to work items to process
 * @param projectName - Name of the project
 * @returns Promise resolving to work items with calculated state history
 */
export const getWorkItemsWithHistory = async (
  workItemReferences: WorkItemReference[],
  projectName: string
): Promise<IWorkItemStateHistory[]> => {
  const workItemIds = getWorkItemIDsForRefs(workItemReferences);
  const workItemsHistory = await getAllWorkItemsHistory(workItemIds, projectName);
  return calculateBoardColumnTime(workItemsHistory);
};

/**
 * Retrieves and processes work item duration slices for trend analysis
 * @param workItemReferences - References to work items
 * @param client - Work item tracking REST client
 * @param projectName - Project name
 * @param sliceDurationDays - Number of days per slice (default 14)
 * @returns Promise resolving to array of duration slices
 */
export const getWorkItemDurationSlices = async (
  workItemReferences: WorkItemReference[],
  client: WorkItemTrackingRestClient,
  projectName: string,
  sliceDurationDays: number = 14
): Promise<IDurationSlice[]> => {
  if (workItemReferences.length === 0) {
    return [];
  }

  const workItemDetails = await getWorkItemDetailsBatch(
    client,
    projectName,
    workItemReferences
  );

  const sortedWorkItems = workItemDetails.sort(dateSortWorkItems);
  const slices = getClosedWorkItemSlices(sortedWorkItems, sliceDurationDays);

  // Get work item times for each slice
  await calculateWorkItemTimesForSlices(slices, projectName);

  return slices;
};

/**
 * Calculates work item column times for all slices
 * @param slices - Array of duration slices
 * @param projectName - Project name
 */
const calculateWorkItemTimesForSlices = async (
  slices: IDurationSlice[],
  projectName: string
): Promise<void> => {
  for (const slice of slices) {
    slice.workItemsWithColumnTimes = await calculateSliceHistory(
      slice,
      projectName
    );
  }
};

/**
 * Calculates history for a single slice
 * @param slice - Duration slice to calculate
 * @param projectName - Project name
 * @returns Promise resolving to work items with calculated state history
 */
const calculateSliceHistory = async (
  slice: IDurationSlice,
  projectName: string
): Promise<IWorkItemStateHistory[]> => {
  const workItemIds = slice.workItemList.map((wi) => wi.id);
  const workItemsWithHistory = await getAllWorkItemsHistory(workItemIds, projectName);
  return calculateBoardColumnTime(workItemsWithHistory);
};

/**
 * Updates duration calculations for slices based on category assignments
 * @param slices - Array of duration slices to update
 * @param categories - Category definitions
 */
export const updateSliceDurations = (
  slices: IDurationSlice[],
  categories: ICategory[]
): void => {
  calculateDurations(slices, categories);
};
