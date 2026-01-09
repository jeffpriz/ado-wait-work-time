/**
 * @deprecated Use ../../utils/trendAnalysis and ../../services/workItemHistoryService instead
 * This file is maintained for backwards compatibility
 */
export type { IDurationSlice } from "../../types/trendSliceTypes";

export {
  getLastMonday,
  getMondayBeforeEarliestWI,
  getDateofEarliestWI,
  dateSortWorkItems as dateSort,
  sliceDateSort,
  getClosedWorkItemSlices,
  calculateDurationCategoryTime as CalculateDurationCategoryTime,
  calculateDurations as CalculateDurations,
} from "../../utils/trendAnalysis";

export {
  calculateBoardColumnTime as CalculateBoardColumnTime,
} from "../../utils/workItemCalculations";

export {
  getWorkItemDurationSlices as GetWorkItemDurationSlices,
} from "../../services/workItemHistoryService";

export { calculateFlowEfficiency as CalculateFlowEfficeincy } from "../../utils/statisticsUtils";
