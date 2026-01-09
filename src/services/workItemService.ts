/**
 * Service for querying and retrieving work items from Azure DevOps
 */

import {
  WorkItemTrackingRestClient,
  WorkItem,
  WorkItemQueryResult,
  Wiql,
  WorkItemReference,
  WorkItemExpand,
  WorkItemBatchGetRequest,
  WorkItemErrorPolicy,
} from "azure-devops-extension-api/WorkItemTracking";
import { TeamFieldValues } from "azure-devops-extension-api/Work";
import { ProcessWorkItemType } from "azure-devops-extension-api/WorkItemTrackingProcess";
import {
  IWorkItemWithHistory,
  IWorkItemStateInfo,
} from "../types/workItemTypes";
import { getClient } from "azure-devops-extension-api";

/**
 * Retrieves closed states for a given work item type based on process configuration
 * @param workItemType - Name of the work item type
 * @param workItemDetails - Array of process work item types
 * @returns Array of state names that represent completed/closed states
 */
export const getClosedStatesForWorkItemType = (
  workItemType: string,
  workItemDetails: ProcessWorkItemType[]
): string[] => {
  const wi = workItemDetails.find((w) => w.name === workItemType);
  if (!wi) {
    return [];
  }

  return wi.states
    .filter((s) => s.stateCategory === "Completed")
    .map((s) => s.name);
};

/**
 * Builds a WIQL (Work Item Query Language) query string for retrieving work items
 * @param project - Project name
 * @param workItemTypes - Array of work item type names to query
 * @param closedStates - Array of closed state names
 * @param areaPaths - WIQL string for area path filtering
 * @param dateOffset - Number of days in the past to query
 * @param tagList - Optional array of tags to exclude
 * @returns WIQL query string
 */
const buildWorkItemQuery = (
  project: string,
  workItemTypes: string[],
  closedStates: string[],
  areaPaths: string,
  dateOffset: number,
  tagList: string[]
): string => {
  const wiqlWorkItemTypes = `(${workItemTypes.map((t) => `'${t}'`).join(',')})`;
  const wiqlClosedStates = `(${closedStates.map((s) => `'${s}'`).join(',')})`;

  let query = `SELECT [System.Id], [System.WorkItemType], [System.State], [System.AreaPath] FROM workitems WHERE [System.TeamProject] = '${project}' AND [System.WorkItemType] in ${wiqlWorkItemTypes} AND [Microsoft.vsts.Common.ClosedDate] > @today-${dateOffset} AND [System.AreaPath] ${areaPaths} AND [System.State] in ${wiqlClosedStates}`;

  if (tagList.length > 0) {
    const tagWIQL = tagList
      .map((tag) => `AND NOT [System.Tags] CONTAINS '${tag.trim()} '`)
      .join(' ');
    query += ` ${tagWIQL}`;
  }

  query += ' ORDER BY [Microsoft.vsts.Common.ClosedDate] ASC';

  return query;
};

/**
 * Queries Azure DevOps for work items matching specified criteria
 * @param client - Work item tracking REST client
 * @param project - Project name
 * @param team - Team name
 * @param teamAreaPaths - Team field values containing area paths
 * @param workItemTypes - Array of work item type names
 * @param workItemProcessDetails - Process work item type details
 * @param dateOffset - Number of days to look back
 * @param tagList - Tags to exclude from results
 * @returns Promise resolving to array of work item references
 */
export const getWorkItemsByQuery = async (
  client: WorkItemTrackingRestClient,
  project: string,
  team: string,
  teamAreaPaths: TeamFieldValues,
  workItemTypes: string[],
  workItemProcessDetails: ProcessWorkItemType[],
  dateOffset: number,
  tagList: string[]
): Promise<WorkItemReference[]> => {
  const queryResultPromises: Promise<WorkItemQueryResult>[] = [];
  const uniqueStates: string[] = [];

  // Collect all unique closed states for the work item types
  workItemTypes.forEach((type) => {
    const closedStates = getClosedStatesForWorkItemType(type, workItemProcessDetails);
    closedStates.forEach((state) => {
      if (!uniqueStates.includes(state)) {
        uniqueStates.push(state);
      }
    });
  });

  // Build queries for each area path
  teamAreaPaths.values.forEach((ap) => {
    const areaPaths = ap.includeChildren
      ? `under '${ap.value}'`
      : `= '${ap.value}'`;

    const query = buildWorkItemQuery(
      project,
      workItemTypes,
      uniqueStates,
      areaPaths,
      dateOffset,
      tagList
    );

    console.log(query);

    const wiql: Wiql = { query };
    queryResultPromises.push(client.queryByWiql(wiql, project, team, false, 1000));
  });

  // Execute all queries and combine results
  const allWIQLResults = await Promise.all(queryResultPromises);
  const workItemResults = allWIQLResults.flatMap((r) => r.workItems);

  return workItemResults;
};

/**
 * Retrieves detailed work item information in batches
 * @param client - Work item tracking REST client
 * @param project - Project name
 * @param workItemReferences - Array of work item references to retrieve details for
 * @returns Promise resolving to array of work items with full details
 */
export const getWorkItemDetailsBatch = async (
  client: WorkItemTrackingRestClient,
  project: string,
  workItemReferences: WorkItemReference[]
): Promise<WorkItem[]> => {
  const fields = [
    "System.Id",
    "System.WorkItemType",
    "System.State",
    "System.AreaPath",
    "Microsoft.vsts.Common.ClosedDate",
    "System.CreatedDate",
  ];
  const wiResultPromises: Promise<WorkItem[]>[] = [];
  const BATCH_SIZE = 200;

  let ndx = 0;
  while (ndx < workItemReferences.length) {
    const ids: number[] = [];
    const endNdx = Math.min(ndx + BATCH_SIZE, workItemReferences.length);

    for (let i = ndx; i < endNdx; i++) {
      ids.push(workItemReferences[i].id);
    }

    const req: WorkItemBatchGetRequest = {
      $expand: WorkItemExpand.Links,
      asOf: new Date(),
      fields,
      ids,
      errorPolicy: WorkItemErrorPolicy.Omit,
    };

    wiResultPromises.push(client.getWorkItemsBatch(req, project));
    ndx = endNdx;
  }

  const allWorkItemResults = await Promise.all(wiResultPromises);
  const workItems = allWorkItemResults.flatMap((result) => result);

  console.log(`Requested ${workItemReferences.length} Work Item IDs`);
  console.log(`Returning ${workItems.length} work items`);

  return workItems;
};

/**
 * Processes work item history to keep only revisions where board column changed
 * @param revisions - Array of work item revisions
 * @param workItemDetails - Work item with history object to populate
 */
export const processWorkItemHistory = (
  revisions: WorkItem[],
  workItemDetails: IWorkItemWithHistory
): void => {
  revisions.forEach((wi) => {
    // Ensure board column field exists
    if (!wi.fields["System.BoardColumn"]) {
      wi.fields["System.BoardColumn"] = "No Board Column";
    }

    // Add first revision
    if (workItemDetails.history.length === 0) {
      workItemDetails.history.push(wi);
      return;
    }

    // Only add revision if board column changed
    const lastRevision =
      workItemDetails.history[workItemDetails.history.length - 1];
    if (
      wi.fields["System.BoardColumn"] !== lastRevision.fields["System.BoardColumn"]
    ) {
      workItemDetails.history.push(wi);
    }
  });
};

/**
 * Retrieves the revision history for a single work item
 * @param workItemID - ID of the work item
 * @param projectId - ID of the project
 * @returns Promise resolving to array of work item revisions
 */
export const getWorkItemWithHistory = async (
  workItemID: number,
  projectId: string
): Promise<WorkItem[]> => {
  const client = getClient(WorkItemTrackingRestClient);
  return await client.getRevisions(
    workItemID,
    projectId,
    undefined,
    undefined,
    WorkItemExpand.Links
  );
};

/**
 * Retrieves full history for multiple work items
 * @param workItemIds - Array of work item IDs
 * @param projectID - ID of the project
 * @returns Promise resolving to array of work items with their complete history
 */
export const getAllWorkItemsHistory = async (
  workItemIds: number[],
  projectID: string
): Promise<IWorkItemWithHistory[]> => {
  const workItemRevPromises = workItemIds.map((wiId) =>
    getWorkItemWithHistory(wiId, projectID)
  );

  const allResults = await Promise.all(workItemRevPromises);

  return allResults.map((revisions) => {
    const workItemDetails: IWorkItemWithHistory = {
      id: revisions[0].id,
      title: revisions[0].fields["System.Title"],
      history: [],
      htmlLink: "",
    };

    processWorkItemHistory(revisions, workItemDetails);

    return workItemDetails;
  });
};
