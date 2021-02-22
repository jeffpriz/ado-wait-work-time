import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import * as API from "azure-devops-extension-api";
import { ProcessInfo, ProcessWorkItemType, WorkItemTrackingProcessRestClient, GetWorkItemTypeExpand } from "azure-devops-extension-api/WorkItemTrackingProcess"

import {CoreRestClient, WebApiTeam, TeamContext, ProjectProperty,  } from "azure-devops-extension-api/Core";

export function GetProjectProcessList(client:WorkItemTrackingProcessRestClient)
{

 //   client.getList()
}

export async function GetWorkItemListForProcessTemplate(client:WorkItemTrackingProcessRestClient, processTemplateId:string):Promise<ProcessWorkItemType[]>
{
    
    let result:Promise<ProcessWorkItemType[]> = client.getProcessWorkItemTypes(processTemplateId,GetWorkItemTypeExpand.States);

    return result;    
}


export async function GetProjectProperties(client:CoreRestClient, projectId:string): Promise<ProjectProperty[]>
{

    let result:Promise<ProjectProperty[]>;
    

    result = client.getProjectProperties(projectId)

    //let thisPRoperty:ProjectProperty[] = await result;

    
    return result;
    

}



export async function GetProcessWorkItemDetails(coreRestClient:CoreRestClient,wiProcessclient:WorkItemTrackingProcessRestClient, projectId:string):Promise<ProcessWorkItemType[]>
{

    let projectProps:ProjectProperty[] = await GetProjectProperties(coreRestClient,projectId);
    let projectProperty:ProjectProperty|undefined =projectProps.find(p=>p.name == "System.ProcessTemplateType");
    if(projectProperty)
    {
        let processTemplate:string = projectProperty.value;
        
        let listProcessWIT:Promise<ProcessWorkItemType[]> ;
        return new Promise<ProcessWorkItemType[]>(async(resolve,reject) => {

            try
            {
                if(processTemplate)
                {
                    listProcessWIT =  GetWorkItemListForProcessTemplate(wiProcessclient,processTemplate);        
                }            
                resolve(listProcessWIT);
            
            }
            catch(ex)
            {
                reject(ex);
            }
        
    
        });
    }
    else
    {
        return new Promise<ProcessWorkItemType[]>(async(resolve,reject) => {
            reject("No project template property found for the project: " + projectProps);
        });
    }
    
}