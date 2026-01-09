/**
 * Utilities for calculating work item durations and processing history
 */

import {
  IWorkItemWithHistory,
  IWorkItemStateHistory,
  IWorkItemStateInfo,
  IWorkItemTableDisplay,
  IBoardColumnStat,
  IBoardColumnWorkItemTime,
  ColumnCategoryChoices,
} from "../types/workItemTypes";
import { getMillisecondsToTime, formatDuration } from "./timeUtils";
import { getStandardDeviation } from "./statisticsUtils";

/**
 * Calculates time spent in each board column for work items
 * @param workItemsWithHistory - Array of work items with their revision history
 * @returns Array of work items with calculated time in each column
 */
export const calculateBoardColumnTime = (
  workItemsWithHistory: IWorkItemWithHistory[]
): IWorkItemStateHistory[] => {
  const currentDate = new Date();

  return workItemsWithHistory.map((workItem) => {
    const historyWithTime: IWorkItemStateHistory = {
      workItemID: workItem.id,
      revisions: [],
      title: workItem.title.toString(),
      htmlLink: workItem.htmlLink,
    };

    const topIndex = workItem.history.length - 1;

    for (let i = 0; i < workItem.history.length; i++) {
      const revision = workItem.history[i];
      const thisRev: IWorkItemStateInfo = {
        workItemID: workItem.id,
        workItemTitle: workItem.title,
        revNum: revision.rev,
        boardColumn: revision.fields["System.BoardColumn"],
        boardColumnStartTime: revision.fields["System.ChangedDate"],
        timeInColumn: 0,
      };

      // Calculate time in column
      if (i === topIndex) {
        const thisDate: Date = revision.fields["System.ChangedDate"];
        thisRev.timeInColumn = Math.floor(currentDate.valueOf() - thisDate.valueOf());
      } else {
        const thisDate: Date = revision.fields["System.ChangedDate"];
        const endDate: Date = workItem.history[i + 1].fields["System.ChangedDate"];
        thisRev.timeInColumn = Math.floor(endDate.valueOf() - thisDate.valueOf());
      }

      historyWithTime.revisions.push(thisRev);
    }

    return historyWithTime;
  });
};

/**
 * Collects all work item revisions and formats them for table display
 * @param workItemHistory - Array of work item state histories
 * @returns Array of work item revisions formatted for table display
 */
export const collectWorkItemRevisionsForTable = (
  workItemHistory: IWorkItemStateHistory[]
): IWorkItemTableDisplay[] => {
  const revisions: IWorkItemTableDisplay[] = [];

  workItemHistory.forEach((workItem) => {
    workItem.revisions.forEach((revision) => {
      const duration = getMillisecondsToTime(revision.timeInColumn);
      const durationString = formatDuration(duration);

      const displayRow: IWorkItemTableDisplay = {
        workItemID: revision.workItemID,
        workItemTitle: revision.workItemTitle,
        workItemLink: workItem.htmlLink,
        revNum: revision.revNum,
        boardColumn: revision.boardColumn,
        boardColumnStartTime: revision.boardColumnStartTime.toString(),
        timeInColumn: durationString,
      };

      revisions.push(displayRow);
    });
  });

  return revisions;
};

/**
 * Gathers distinct board columns from work item data and calculates statistics
 * @param workItemData - Array of work item state histories
 * @param outgoingColumns - Columns to exclude (typically "closed" columns)
 * @param getCategoryForColumn - Function to get the category for a column
 * @returns Array of board column statistics
 */
export const gatherDistinctBoardColumns = (
  workItemData: IWorkItemStateHistory[],
  outgoingColumns: string[],
  getCategoryForColumn: (columnName: string) => ColumnCategoryChoices
): IBoardColumnStat[] => {
  const columnStats: IBoardColumnStat[] = [];

  workItemData.forEach((workItem) => {
    workItem.revisions.forEach((revision) => {
      // Skip outgoing columns
      if (outgoingColumns.includes(revision.boardColumn)) {
        return;
      }

      // Find or create board column stat
      let boardColumnStat = columnStats.find(
        (stat) => stat.boardColumn === revision.boardColumn
      );

      if (!boardColumnStat) {
        boardColumnStat = {
          boardColumn: revision.boardColumn,
          average: 0,
          stdDev: 0,
          total: 0,
          workItemTimes: [],
          category: getCategoryForColumn(revision.boardColumn),
        };
        columnStats.push(boardColumnStat);
      }

      // Find or create work item time entry
      let workItemTime = boardColumnStat.workItemTimes.find(
        (wi) => wi.wiID === revision.workItemID
      );

      if (workItemTime) {
        workItemTime.columnTime += revision.timeInColumn;
      } else {
        workItemTime = {
          wiID: revision.workItemID,
          columnTime: revision.timeInColumn,
        };
        boardColumnStat.workItemTimes.push(workItemTime);
      }
    });
  });

  return columnStats;
};

/**
 * Calculates average time and standard deviation for board columns
 * @param boardColumnData - Array of board column statistics to calculate
 */
export const calculateBoardColumnAverages = (
  boardColumnData: IBoardColumnStat[]
): void => {
  boardColumnData.forEach((column) => {
    const times = column.workItemTimes.map((wi) => wi.columnTime);
    const totalTime = times.reduce((sum, time) => sum + time, 0);

    column.average = totalTime / column.workItemTimes.length;
    column.total = totalTime;
    column.stdDev = getStandardDeviation(times);
  });
};
