/**
 * Utilities for trend analysis and time slicing of work items
 */

import { WorkItem, WorkItemReference } from "azure-devops-extension-api/WorkItemTracking";
import { IDurationSlice } from "../types/trendSliceTypes";
import { IWorkItemStateHistory } from "../types/workItemTypes";
import { ICategory } from "../types/categoryTypes";
import { calculateBoardColumnTime } from "./workItemCalculations";
import { getWorkItemIDsForWI } from "./arrayUtils";

/**
 * Gets the most recent Monday before today
 * @returns Date object representing last Monday
 */
export const getLastMonday = (): Date => {
  const prevMonday = new Date();
  prevMonday.setDate(prevMonday.getDate() - ((prevMonday.getDay() + 6) % 7));
  return prevMonday;
};

/**
 * Finds the Monday before the earliest work item in a list
 * @param workItems - Array of work items
 * @returns Date object representing the Monday before the earliest work item
 */
export const getMondayBeforeEarliestWI = (workItems: WorkItem[]): Date => {
  const earliestDate = getDateofEarliestWI(workItems);
  let thisMonday = getLastMonday();

  while (thisMonday > earliestDate) {
    thisMonday = new Date(thisMonday.setDate(thisMonday.getDate() - 7));
  }

  return thisMonday;
};

/**
 * Finds the closed date of the earliest work item
 * @param workItems - Array of work items
 * @returns Date of the earliest closed work item
 */
export const getDateofEarliestWI = (workItems: WorkItem[]): Date => {
  let returnDate = new Date();

  workItems.forEach((wi) => {
    const closedDate: Date = wi.fields["Microsoft.VSTS.Common.ClosedDate"];
    if (closedDate < returnDate) {
      returnDate = closedDate;
    }
  });

  return returnDate;
};

/**
 * Sorts work items by closed date
 * @param a - First work item
 * @param b - Second work item
 * @returns Sort comparison result
 */
export const dateSortWorkItems = (a: WorkItem, b: WorkItem): number => {
  const key1 = a.fields["Microsoft.VSTS.Common.ClosedDate"];
  const key2 = b.fields["Microsoft.VSTS.Common.ClosedDate"];

  if (key1 < key2) {
    return -1;
  } else if (key1 === key2) {
    return 0;
  } else {
    return 1;
  }
};

/**
 * Sorts duration slices by start date
 * @param a - First slice
 * @param b - Second slice
 * @returns Sort comparison result
 */
export const sliceDateSort = (a: IDurationSlice, b: IDurationSlice): number => {
  if (a.startDate < b.startDate) {
    return -1;
  } else if (a.startDate === b.startDate) {
    return 0;
  } else {
    return 1;
  }
};

/**
 * Divides work items into time slices based on their closed dates
 * @param workItems - Sorted array of work items
 * @param sliceDurationDays - Number of days per slice
 * @returns Array of duration slices
 */
export const getClosedWorkItemSlices = (
  workItems: WorkItem[],
  sliceDurationDays: number
): IDurationSlice[] => {
  const slices: IDurationSlice[] = [];

  if (workItems.length === 0) {
    return slices;
  }

  let ndx = 0;
  const itemsCount = workItems.length - 1;
  let sliceDate = getMondayBeforeEarliestWI(workItems);
  const mathDate = new Date(sliceDate);

  let newSlice: IDurationSlice = {
    startDate: sliceDate,
    closeWICount: 0,
    workItemList: [],
    workItemsWithColumnTimes: [],
    totNotSetTime: 0,
    totWorkTime: 0,
    totWaitTime: 0,
  };

  let nextSliceDate = new Date(
    mathDate.setDate(mathDate.getDate() + sliceDurationDays)
  );

  while (ndx <= itemsCount) {
    let addedSlice = false;
    let isThisWIinSlice = false;
    const thisWI = workItems[ndx];
    const thisWIClosedDate: Date = thisWI.fields["Microsoft.VSTS.Common.ClosedDate"];

    // If work item is in a future slice, save current slice and start new one
    if (thisWIClosedDate > nextSliceDate) {
      slices.push({ ...newSlice });
      sliceDate = new Date(nextSliceDate);
      newSlice = {
        startDate: sliceDate,
        closeWICount: 0,
        workItemList: [],
        workItemsWithColumnTimes: [],
        totWaitTime: 0,
        totWorkTime: 0,
        totNotSetTime: 0,
      };
      const mathDate = new Date(sliceDate);
      nextSliceDate = new Date(
        mathDate.setDate(mathDate.getDate() + sliceDurationDays)
      );
      addedSlice = true;
    }

    // Check if work item belongs in current slice
    if (thisWIClosedDate > sliceDate && thisWIClosedDate < nextSliceDate) {
      newSlice.closeWICount += 1;
      newSlice.workItemList.push(workItems[ndx]);
      isThisWIinSlice = true;
    }

    // Only increment if we didn't just add slice without adding item
    if (!addedSlice || isThisWIinSlice) {
      ndx++;
    }
  }

  // Add the final slice
  slices.push({ ...newSlice });

  return slices;
};

/**
 * Calculates duration category times for a slice based on category column assignments
 * @param slice - Duration slice to calculate
 * @param category - Category definition with column names
 * @returns Total time in milliseconds for the category
 */
export const calculateDurationCategoryTime = (
  slice: IDurationSlice,
  category: ICategory
): number => {
  let resultTime = 0;

  slice.workItemsWithColumnTimes.forEach((workItem) => {
    workItem.revisions.forEach((revision) => {
      if (category.boardColumnNames.includes(revision.boardColumn)) {
        resultTime += revision.timeInColumn;
      }
    });
  });

  return resultTime;
};

/**
 * Calculates durations for all slices based on category assignments
 * @param slices - Array of duration slices
 * @param categories - Array of category definitions
 */
export const calculateDurations = (
  slices: IDurationSlice[],
  categories: ICategory[]
): void => {
  const waitCat = categories.find((c) => c.categoryName === "Wait");
  const workCat = categories.find((c) => c.categoryName === "Work");
  const notSetCat = categories.find((c) => c.categoryName === "Not Set");

  slices.forEach((slice) => {
    if (workCat) {
      slice.totWorkTime = calculateDurationCategoryTime(slice, workCat);
    }
    if (waitCat) {
      slice.totWaitTime = calculateDurationCategoryTime(slice, waitCat);
    }
    if (notSetCat) {
      slice.totNotSetTime = calculateDurationCategoryTime(slice, notSetCat);
    }
  });
};
