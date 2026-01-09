/**
 * Azure DevOps Project API service for retrieving project and process information
 */

import {
  ProcessWorkItemType,
  WorkItemTrackingProcessRestClient,
  GetWorkItemTypeExpand,
} from "azure-devops-extension-api/WorkItemTrackingProcess";
import { CoreRestClient, ProjectProperty } from "azure-devops-extension-api/Core";

/**
 * Retrieves all work item types for a given process template
 * @param client - Work item tracking process REST client
 * @param processTemplateId - ID of the process template
 * @returns Promise resolving to array of process work item types
 */
export const getWorkItemListForProcessTemplate = async (
  client: WorkItemTrackingProcessRestClient,
  processTemplateId: string
): Promise<ProcessWorkItemType[]> => {
  return await client.getProcessWorkItemTypes(
    processTemplateId,
    GetWorkItemTypeExpand.States
  );
};

/**
 * Retrieves project properties from Azure DevOps
 * @param client - Core REST client
 * @param projectId - ID of the project
 * @returns Promise resolving to array of project properties
 */
export const getProjectProperties = async (
  client: CoreRestClient,
  projectId: string
): Promise<ProjectProperty[]> => {
  return await client.getProjectProperties(projectId);
};

/**
 * Retrieves detailed work item type information for a project based on its process template
 * @param coreRestClient - Core REST client for project operations
 * @param wiProcessClient - Work item process REST client
 * @param projectId - ID of the project
 * @returns Promise resolving to array of process work item types with states
 * @throws Error if project template property is not found
 */
export const getProcessWorkItemDetails = async (
  coreRestClient: CoreRestClient,
  wiProcessClient: WorkItemTrackingProcessRestClient,
  projectId: string
): Promise<ProcessWorkItemType[]> => {
  const projectProps = await getProjectProperties(coreRestClient, projectId);
  const projectProperty = projectProps.find(
    (p) => p.name === "System.ProcessTemplateType"
  );

  if (!projectProperty) {
    throw new Error(
      `No project template property found for the project. Properties: ${JSON.stringify(
        projectProps
      )}`
    );
  }

  const processTemplate = projectProperty.value;
  return await getWorkItemListForProcessTemplate(wiProcessClient, processTemplate);
};
