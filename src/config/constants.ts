/**
 * Configuration constants for the application
 */

import { IListBoxItem } from "azure-devops-ui/ListBox";
import { ColumnCategoryChoices } from "../types/workItemTypes";
import { WORK_CAT_NAME, WAIT_CAT_NAME } from "../types/categoryTypes";

/**
 * Date range selection options for the dropdown
 */
export const DATE_SELECTION_CHOICES: IListBoxItem[] = [
  { text: "Last 14 Days", id: "14" },
  { text: "Last 30 Days", id: "30" },
  { text: "Last 60 Days", id: "60" },
  { text: "Last 90 Days", id: "90" },
  { text: "Last 120 Days", id: "120" },
  { text: "Last 365 Days", id: "365" },
];

/**
 * Column category choices for classification
 */
export const COLUMN_CATEGORY_CHOICES: IListBoxItem[] = [
  { text: WORK_CAT_NAME, id: WORK_CAT_NAME },
  { text: WAIT_CAT_NAME, id: WAIT_CAT_NAME },
];

/**
 * Milliseconds in one day constant
 */
export const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

/**
 * Default date offset in days
 */
export const DEFAULT_DATE_OFFSET = 14;

/**
 * Number of days for historical trend analysis
 */
export const HISTORICAL_TREND_DAYS = 365;

/**
 * Slice duration for trend analysis (in days)
 */
export const TREND_SLICE_DURATION = 14;
