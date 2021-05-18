
import { WorkItemTrackingRestClient,  WorkItem, WorkItemQueryResult, Wiql, WorkItemReference, WorkItemExpand, WorkItemBatchGetRequest,WorkItemErrorPolicy } from "azure-devops-extension-api/WorkItemTracking";
import {WorkRestClient, BacklogConfiguration, TeamFieldValues, Board, BoardColumnType, BacklogLevelConfiguration} from "azure-devops-extension-api/Work";
import {  ProcessWorkItemType, WorkItemTrackingProcessRestClient } from "azure-devops-extension-api/WorkItemTrackingProcess"
import * as workItemInterfaces from "./WorkItemInfo";
import { CommonServiceIds, IProjectPageService,IGlobalMessagesService, getClient, IProjectInfo } from "azure-devops-extension-api";

export async function GetWorkItemsByQuery(client:WorkItemTrackingRestClient, project:string, team:string, teamAreaPaths:TeamFieldValues, workItemTypes:string[], workItemProcessDetails: ProcessWorkItemType[], dateOffset:number, tagList:string[]):Promise<WorkItemReference[]>
    {

        
        return new Promise<WorkItemReference[]>(async (resolve,reject) => {

            try
            {

                let query:string = "";
                let queryResultPromises:Promise<WorkItemQueryResult>[] = [];
                let uniqueStates:string[] = [];

                
                let wiqlWorkItemTypes:string = "(";
                workItemTypes.forEach((t)=>{ 
                    wiqlWorkItemTypes = wiqlWorkItemTypes + "'" + t + "'," 
                    let getWorktemClosedStates:string[] = GetClosedStatesForWorkItemType(t, workItemProcessDetails);

                    getWorktemClosedStates.forEach((s)=>{
                        if(uniqueStates.find(thisOne => thisOne ==s) ==undefined)
                        {
                            uniqueStates.push(s);
                        }
                    });
                });
                wiqlWorkItemTypes = wiqlWorkItemTypes.substr(0,wiqlWorkItemTypes.length-1) + ")";
                
                let wiqlClosedStates:string = "(";
                uniqueStates.forEach((s)=>{
                    wiqlClosedStates = wiqlClosedStates + "'" + s + "',";
                });

                wiqlClosedStates = wiqlClosedStates.substr(0, wiqlClosedStates.length-1) + ")";


                let wiqlAreaPaths:string = "(";

                teamAreaPaths.values.forEach((ap) => {                     
                    wiqlAreaPaths = wiqlAreaPaths + "'" + ap + "',"   
                    if(ap.includeChildren)
                    {
                        wiqlAreaPaths = "under '" + ap.value + "'";
                    }
                    else
                    {
                        wiqlAreaPaths = " = '" + ap.value + "'";
                    }
                    
                    if(tagList.length > 0)
                    {
                        let tagWIQL:string = "";
                        tagList.forEach((thisTag)=>{
                            tagWIQL = tagWIQL + "AND NOT [System.Tags] CONTAINS '" + thisTag.trim() + " ' ";
                        });
                        
                        query = "SELECT [System.Id], [System.WorkItemType], [System.State], [System.AreaPath] FROM workitems WHERE [System.TeamProject] = '" + project  + "' AND [System.WorkItemType] in " + wiqlWorkItemTypes + " AND [Microsoft.vsts.Common.ClosedDate] > @today-" + dateOffset.toString() + " AND [System.AreaPath] " + wiqlAreaPaths + " AND [System.State] in " + wiqlClosedStates + " " +  tagWIQL  + "ORDER BY [Microsoft.vsts.Common.ClosedDate] ASC";
                    }
                    else
                    {
                        query = "SELECT [System.Id], [System.WorkItemType], [System.State], [System.AreaPath] FROM workitems WHERE [System.TeamProject] = '" + project  + "' AND [System.WorkItemType] in " + wiqlWorkItemTypes + " AND [Microsoft.vsts.Common.ClosedDate] > @today-" + dateOffset.toString() + " AND [System.AreaPath] " + wiqlAreaPaths + " AND [System.State] in " + wiqlClosedStates  + " ORDER BY [Microsoft.vsts.Common.ClosedDate] ASC";
                    }
                    console.log(query);
                    let q:Wiql = {query: query};
                    queryResultPromises.push(client.queryByWiql(q,project,team,false,1000));
                });
                
                

                
                let wiresults:WorkItemReference[] = [];
                let AllWIQLResults = await Promise.all(queryResultPromises);
                AllWIQLResults.forEach((r) => {
                    wiresults = wiresults.concat(r.workItems);
                });
                
                resolve(wiresults);

            }
            catch(ex) 
            {
                
                reject(ex);                
            }

        });
    }


        //Finds the Completed state name for this team so that we know what to query for (since the states are a customization item, we don't want to assume that the "completed" state is "Closed")
        export function GetClosedStatesForWorkItemType(workItemType:string, workItemDetails:ProcessWorkItemType[]):string[]
        {
            let result:string[] = [];
    
            
            let wi:ProcessWorkItemType|undefined = workItemDetails.find(w=>w.name == workItemType);
            if(wi)
            {
                wi.states.forEach((s) => {
                    if(s.stateCategory == "Completed")
                    {
                        result.push(s.name); 
                    }
                });
            }
    
            return result;
    
        }

        //
        export async function GetWorkItemDetailsBatch(client:WorkItemTrackingRestClient, project:string, workItemReferences:WorkItemReference[]):Promise<WorkItem[]>
        {

            let fields:string[] = ["System.Id", "System.WorkItemType", "System.State", "System.AreaPath", "Microsoft.vsts.Common.ClosedDate", "System.CreatedDate"];
            let ids:number[] = [];            
            let wiResultPromises:Promise<WorkItem[]>[] = [];

            return new Promise<WorkItem[]>(async (resolve,reject) => {
                try {
                    let ndx:number = 0;
                    let cntr:number = 0;
                    do{

                        ids = [];
                        for(cntr=0; ndx<workItemReferences.length && cntr < 200; cntr++)
                        {
                            ids.push(workItemReferences[ndx].id);
                            ndx++;
                        }
                        let req:WorkItemBatchGetRequest = {$expand: WorkItemExpand.Links, asOf:new Date(), fields:fields, ids:ids, errorPolicy:WorkItemErrorPolicy.Omit};
                        wiResultPromises.push(client.getWorkItemsBatch(req,project));
                    } while (ndx < workItemReferences.length)
                    
                    
                    //let req:WorkItemBatchGetRequest = {$expand: WorkItemExpand.Links, asOf:new Date(), fields:fields, ids:ids, errorPolicy:WorkItemErrorPolicy.Omit};

                    let allWorkItemResult:WorkItem[][] = await Promise.all(wiResultPromises);
                    let workItemResult:WorkItem[] = [];
                    for(const thisResult of allWorkItemResult) {
                        thisResult.forEach((thisWI)=>{

                            workItemResult.push(thisWI);
                        });
                    }
                    console.log("requested " + workItemReferences.length.toString() + " Work Item IDs");
                    console.log("returning " + workItemResult.length.toString() + " work items");
                    //let workItemResult:WorkItem[] = await  client.getWorkItemsBatch(req,project);
                    resolve(workItemResult);
                }
                catch(ex)
                {
                    reject(ex);
                }
            });
        }


            //Takes in the list of Work Item history we have after we selected down to the the closed Work Items for the team, and then we will call Azure DevOps to 
    // get all of the revision history for each work Item.
    export async function GetAllWorkItemsHistory(workItemIds: number[], projectID:string): Promise<workItemInterfaces.IWorkItemWithHistory[]>
    {
        let workItemRevPromises:Promise<WorkItem[]>[] = [];        
        return new Promise<workItemInterfaces.IWorkItemWithHistory[]>(async (resolve, reject) => { 
            try{ 
                let returnResult:workItemInterfaces.IWorkItemWithHistory[] = [];
                workItemIds.forEach((thisWI) => {
                    let thisPromise:Promise<WorkItem[]> = GetWorkItemWithHistory(thisWI, projectID);
                    
                    
                    workItemRevPromises.push(thisPromise);
                });

                
                let allResults = await Promise.all(workItemRevPromises);
                //let detailResutls = await Promise.all(workItemDetailPromises);


                ///So we got all the promises for all the calls for the workitems, so now loop through the results 
                for(const thisResult of allResults) {
                //await allResults.forEach(async (thisResult)=>  {
                    
                    //create a new record for us to keep score with
                    //let thisWIPromise:Promise<WorkItem> = this.GetWorkItemDetails(thisResult[0].id);
                    let thisWorkItemDetails:workItemInterfaces.IWorkItemWithHistory = {id:thisResult[0].id, title:thisResult[0].fields["System.Title"],  history:[], htmlLink:""};
                    
                    //now inside The results for THIS work item, lets go through the collection of revisions
                    ProcessWorkItemHistory(thisResult, thisWorkItemDetails);
                    //let wiDetail:WorkItem = await thisWIPromise;
                    //try{
                    //    thisWorkItemDetails.htmlLink =  wiDetail._links["html"].href;                
                    //}
                    //catch
                    //{
                    //    thisWorkItemDetails.htmlLink = "";
                    //}
                    returnResult.push(thisWorkItemDetails);
                }
                
                resolve(returnResult);
            }
            catch(ex)
            {

                reject(ex);
            }
        });

    }

    export function ProcessWorkItemHistory(thisResult: WorkItem[], thisWorkItemDetails: workItemInterfaces.IWorkItemWithHistory) {
        thisResult.forEach((wi) => {

            if (wi.fields["System.BoardColumn"] == undefined || wi.fields["System.BoardColumn"] == "") {
                wi.fields["System.BoardColumn"] = "No Board Column";
            }

            //if this is the first revision for us, we will just push it on the collection
            if (thisWorkItemDetails.history.length == 0) {
                thisWorkItemDetails.history.push(wi);
            }


            //otherwise, we only want to keep the revisions that include a change in the board column
            else {
                //so let's look at this revision's board column and compare it to the previous revsion we have to see if the BoardColumn has changed or not
                if (wi.fields["System.BoardColumn"] != thisWorkItemDetails.history[thisWorkItemDetails.history.length - 1].fields["System.BoardColumn"]) {
                    thisWorkItemDetails.history.push(wi);
                }
            }
        });
    }


        //Gets the Revision history for a given work item
        export async function GetWorkItemWithHistory(workItemID:number, projectId:string) : Promise<WorkItem[]>
        {
            const client = getClient(WorkItemTrackingRestClient);
            
            return client.getRevisions(workItemID,projectId, undefined,undefined,WorkItemExpand.Links)
        }

        
    export function getWorkItemIDsForRefs(workItemsToCollect: WorkItemReference[]):number[]
    {
        let result:number[] = [];
        workItemsToCollect.forEach((thisWI) => {
            result.push(thisWI.id);
        });

        return result;
    }


    export function getWorkItemIDsForWI(workItemsToCollect: WorkItem[]):number[]
    {
        let result:number[] = [];
        workItemsToCollect.forEach((thisWI) => {
            result.push(thisWI.id);
        });

        return result;
    }
