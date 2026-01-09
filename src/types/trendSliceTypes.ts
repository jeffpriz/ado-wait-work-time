/**
 * Type definitions for trend analysis and time slicing
 */

import { WorkItem } from "azure-devops-extension-api/WorkItemTracking";
import { IWorkItemStateHistory } from "./workItemTypes";

/**
 * Represents a time slice for trend analysis containing work items closed in that period
 */
export interface IDurationSlice {
  /** Start date of this slice period */
  startDate: Date;
  /** Number of work items closed in this slice */
  closeWICount: number;
  /** Work items closed in this period */
  workItemList: WorkItem[];
  /** Work items with calculated column times */
  workItemsWithColumnTimes: IWorkItemStateHistory[];
  /** Total wait time for all work items in this slice (milliseconds) */
  totWaitTime: number;
  /** Total work time for all work items in this slice (milliseconds) */
  totWorkTime: number;
  /** Total "not set" time for all work items in this slice (milliseconds) */
  totNotSetTime: number;
}
