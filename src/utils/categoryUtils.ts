/**
 * Utilities for managing work item categories (Wait, Work, Not Set)
 */

import { ICategory, WAIT_CAT_NAME, WORK_CAT_NAME, NOT_SET_NAME } from "../types/categoryTypes";
import { ColumnCategoryChoices, IBoardColumnStat, IBoardColumnWorkItemTime } from "../types/workItemTypes";

/**
 * Creates initial empty category definitions
 * @returns Array of initialized categories
 */
export const getInitializedCategories = (): ICategory[] => {
  const waitCategory: ICategory = {
    categoryName: WAIT_CAT_NAME,
    boardColumnNames: [],
    categoryType: ColumnCategoryChoices.Wait,
    stats: {
      boardColumn: "",
      average: 0,
      stdDev: 0,
      total: 0,
      workItemTimes: [],
      category: ColumnCategoryChoices.Wait,
    },
  };

  const workCategory: ICategory = {
    categoryName: WORK_CAT_NAME,
    boardColumnNames: [],
    categoryType: ColumnCategoryChoices.Work,
    stats: {
      boardColumn: "",
      average: 0,
      stdDev: 0,
      total: 0,
      workItemTimes: [],
      category: ColumnCategoryChoices.Work,
    },
  };

  const notSetCategory: ICategory = {
    categoryName: NOT_SET_NAME,
    boardColumnNames: [],
    categoryType: ColumnCategoryChoices.NotSet,
    stats: {
      boardColumn: "",
      average: 0,
      stdDev: 0,
      total: 0,
      workItemTimes: [],
      category: ColumnCategoryChoices.NotSet,
    },
  };

  return [notSetCategory, waitCategory, workCategory];
};

/**
 * Finds a category by name
 * @param categories - Array of categories to search
 * @param categoryName - Name of the category to find
 * @returns Category if found, otherwise an empty category
 */
export const getCategoryByName = (
  categories: ICategory[],
  categoryName: string
): ICategory => {
  const category = categories.find((c) => c.categoryName === categoryName);
  if (category) {
    return category;
  }

  // Return empty category if not found
  return {
    categoryName: "",
    boardColumnNames: [],
    categoryType: ColumnCategoryChoices.NotSet,
    stats: {
      boardColumn: "",
      average: 0,
      stdDev: 0,
      total: 0,
      workItemTimes: [],
      category: ColumnCategoryChoices.NotSet,
    },
  };
};

/**
 * Gets the category type for a board column name
 * @param categories - Array of categories
 * @param boardColumnName - Name of the board column
 * @returns Category type enum value
 */
export const getBoardColumnCategory = (
  categories: ICategory[],
  boardColumnName: string
): ColumnCategoryChoices => {
  const workCategory = getCategoryByName(categories, WORK_CAT_NAME);
  if (workCategory.boardColumnNames.includes(boardColumnName)) {
    return ColumnCategoryChoices.Work;
  }

  const waitCategory = getCategoryByName(categories, WAIT_CAT_NAME);
  if (waitCategory.boardColumnNames.includes(boardColumnName)) {
    return ColumnCategoryChoices.Wait;
  }

  const notSetCategory = getCategoryByName(categories, NOT_SET_NAME);
  if (notSetCategory.boardColumnNames.includes(boardColumnName)) {
    return ColumnCategoryChoices.NotSet;
  }

  return ColumnCategoryChoices.NotSet;
};

/**
 * Calculates aggregate statistics for a category
 * @param category - Category to calculate stats for
 * @param boardColumnData - Array of board column statistics
 * @param workItemCount - Total number of work items
 * @returns Updated board column stat for the category
 */
export const calculateCategoryStatistics = (
  category: ICategory,
  boardColumnData: IBoardColumnStat[],
  workItemCount: number
): IBoardColumnStat => {
  const workItemTimes: IBoardColumnWorkItemTime[] = [];

  // Aggregate work item times from all columns in this category
  category.boardColumnNames.forEach((columnName) => {
    const columnData = boardColumnData.find((col) => col.boardColumn === columnName);
    if (columnData) {
      workItemTimes.push(...columnData.workItemTimes);
    }
  });

  const totalTime = workItemTimes.reduce((sum, wi) => sum + wi.columnTime, 0);
  const average = workItemCount > 0 ? totalTime / workItemCount : 0;

  return {
    boardColumn: "",
    average,
    stdDev: 0,
    total: totalTime,
    workItemTimes,
    category: category.categoryType,
  };
};

/**
 * Recalculates statistics for all categories
 * @param categories - Array of categories to recalculate
 * @param boardColumnData - Board column statistics
 * @param workItemCount - Total work item count
 * @returns Updated categories array
 */
export const recalculateCategoryStatistics = (
  categories: ICategory[],
  boardColumnData: IBoardColumnStat[],
  workItemCount: number
): ICategory[] => {
  return categories.map((category) => ({
    ...category,
    stats: calculateCategoryStatistics(category, boardColumnData, workItemCount),
  }));
};

/**
 * Sets the category for a board column and updates category assignments
 * @param boardColumnName - Name of the board column
 * @param newCategory - New category to assign
 * @param categories - Array of categories
 * @param boardColumnData - Board column statistics to update
 * @returns Updated categories array
 */
export const setColumnCategory = (
  boardColumnName: string,
  newCategory: ColumnCategoryChoices,
  categories: ICategory[],
  boardColumnData: IBoardColumnStat[]
): ICategory[] => {
  // Update the column's category in board column data
  const column = boardColumnData.find((c) => c.boardColumn === boardColumnName);
  if (column) {
    column.category = newCategory;
  }

  // Remove from all categories
  const updatedCategories = categories.map((cat) => ({
    ...cat,
    boardColumnNames: cat.boardColumnNames.filter((name) => name !== boardColumnName),
  }));

  // Add to the appropriate category
  const targetCategory = updatedCategories.find(
    (cat) => cat.categoryType === newCategory
  );
  if (targetCategory) {
    targetCategory.boardColumnNames.push(boardColumnName);
  }

  return updatedCategories;
};
