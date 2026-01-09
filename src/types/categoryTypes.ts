/**
 * Type definitions for work item category management
 */

import { IBoardColumnStat, ColumnCategoryChoices } from "./workItemTypes";

/**
 * Represents a category of board columns (Wait, Work, or Not Set)
 */
export interface ICategory {
  categoryName: string;
  categoryType: ColumnCategoryChoices;
  boardColumnNames: string[];
  stats: IBoardColumnStat;
}

/**
 * Constants for category names
 */
export const WAIT_CAT_NAME = "Wait";
export const WORK_CAT_NAME = "Work";
export const NOT_SET_NAME = "Not Set";
