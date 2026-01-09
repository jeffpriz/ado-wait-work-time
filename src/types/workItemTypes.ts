/**
 * Type definitions for work item tracking and analysis
 */

import { ISimpleTableCell } from "azure-devops-ui/Table";
import { WorkItem } from "azure-devops-extension-api/WorkItemTracking";

/**
 * Represents detailed information about a work item's state at a specific revision
 */
export interface IWorkItemStateInfo {
  workItemID: number;
  revNum: number;
  boardColumn: string;
  boardColumnStartTime: Date;
  timeInColumn: number;
  workItemTitle: string;
}

/**
 * Represents a work item with its complete revision history
 */
export interface IWorkItemWithHistory {
  id: number;
  title: string;
  htmlLink: string;
  history: WorkItem[];
}

/**
 * Represents work item data formatted for table display
 */
export interface IWorkItemTableDisplay extends ISimpleTableCell {
  workItemID: number;
  workItemTitle: string;
  workItemLink: string;
  revNum: number;
  boardColumn: string;
  boardColumnStartTime: string;
  timeInColumn: string;
}

/**
 * Represents the state history of a work item with calculated time in each state
 */
export interface IWorkItemStateHistory {
  workItemID: number;
  title: string;
  htmlLink: string;
  revisions: IWorkItemStateInfo[];
}

/**
 * Statistical information about time spent in a board column
 */
export interface IBoardColumnStat {
  boardColumn: string;
  average: number;
  stdDev: number;
  total: number;
  workItemTimes: IBoardColumnWorkItemTime[];
  category: ColumnCategoryChoices;
}

/**
 * Categories for classifying board columns
 */
export enum ColumnCategoryChoices {
  NotSet = 0,
  Wait = 1,
  Work = 2,
}

/**
 * Represents time spent by a specific work item in a column
 */
export interface IBoardColumnWorkItemTime {
  wiID: number;
  columnTime: number;
}

/**
 * Compares two work item state info objects by revision number
 * @param wi1 - First work item state
 * @param wi2 - Second work item state
 * @returns Comparison result for sorting
 */
export const compareWorkItemStateRev = (
  wi1: IWorkItemStateInfo,
  wi2: IWorkItemStateInfo
): number => {
  if (wi1.revNum > wi2.revNum) {
    return -1;
  }
  if (wi1.revNum < wi2.revNum) {
    return 1;
  }
  return 0;
};
