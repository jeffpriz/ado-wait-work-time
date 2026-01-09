/**
 * @deprecated Use ../../services/workItemService and related utilities instead
 * This file is maintained for backwards compatibility
 */
export {
  getWorkItemsByQuery as GetWorkItemsByQuery,
  getClosedStatesForWorkItemType as GetClosedStatesForWorkItemType,
  getWorkItemDetailsBatch as GetWorkItemDetailsBatch,
  getAllWorkItemsHistory as GetAllWorkItemsHistory,
  processWorkItemHistory as ProcessWorkItemHistory,
  getWorkItemWithHistory as GetWorkItemWithHistory,
} from "../../services/workItemService";

export {
  getWorkItemIDsForRefs,
  getWorkItemIDsForWI,
} from "../../utils/arrayUtils";
