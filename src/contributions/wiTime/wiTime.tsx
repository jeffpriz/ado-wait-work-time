import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import * as API from "azure-devops-extension-api";
import { showRootComponent } from "../../Common";
import { Page } from "azure-devops-ui/Page";
import { Card } from "azure-devops-ui/Card";
import { Toast } from "azure-devops-ui/Toast";
import {Dropdown} from "azure-devops-ui/Dropdown";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";
import { ScrollableList, IListItemDetails, ListSelection, ListItem } from "azure-devops-ui/List";
import { DropdownSelection } from "azure-devops-ui/Utilities/DropdownSelection";
import { Header, TitleSize } from "azure-devops-ui/Header";
import { CommonServiceIds, IProjectPageService, IHostNavigationService, INavigationElement, IPageRoute, getClient, TeamFoundationHostType } from "azure-devops-extension-api";
import {WorkRestClient, BacklogConfiguration, TeamFieldValues, Board, BoardColumnType} from "azure-devops-extension-api/Work";
import { IWorkItemFormNavigationService, WorkItemTrackingRestClient, WorkItemTrackingServiceIds, ReportingWorkItemRevisionsBatch, WorkItem, WorkItemQueryResult, Wiql, WorkItemReference } from "azure-devops-extension-api/WorkItemTracking";
import { ProcessInfo, ProcessWorkItemType, WorkItemTrackingProcessRestClient, GetWorkItemTypeExpand } from "azure-devops-extension-api/WorkItemTrackingProcess"
import {CoreRestClient, WebApiTeam, TeamContext } from "azure-devops-extension-api/Core";
import * as workItemInterfaces from "./WorkItemInfo";
import { IListBoxItem, ListBoxItemType } from "azure-devops-ui/ListBox";
import { Table } from "azure-devops-ui/Table";
import * as WITableSetup from "./WITableSetup";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import * as TimeCalc from "./Time";
import { Button } from "azure-devops-ui/Button";
import { ButtonGroup } from "azure-devops-ui/ButtonGroup";
import { timeout } from "azure-devops-ui/Core/Util/Promise";
import * as ADOProcess from "./ADOProjectCalls";



interface IWorkItemTimeContentState {
    projectInfo: API.IProjectInfo 
    projectName: string;
    teamBacklogConfig:BacklogConfiguration|undefined;
    teamBoard:Board|undefined,
    teamList: Array<IListBoxItem<{}>>;
    teamFields:TeamFieldValues;
    workItemHistory:workItemInterfaces.IWorkItemStateHistory[],
    workItemRevTableData:workItemInterfaces.IWorkItemTableDisplay[],
    boardColumnData:workItemInterfaces.IBoardColumnStat[],
    workItemProcessDetails:ProcessWorkItemType[],
    workItemCount:number,    
    team: string;
    dateOffset:number;
    isToastVisible: boolean;
    isToastFadingOut: boolean;
    foundCompletedPRs: boolean;
    doneLoading:boolean;
    loadingWorkItems:boolean;
    exception:string;
    detailsCollapsed:boolean;
    categories:ICategory[];
}


interface ICategory
{
    categoryName:string,
    categoryType:workItemInterfaces.columnCategoryChoices,
    boardColumnNames:string[],
    stats:workItemInterfaces.IBoardColumnStat
}

class WorkItemTimeContent extends React.Component<{}, IWorkItemTimeContentState> {
    private readonly dayMilliseconds:number = ( 24 * 60 * 60 * 1000);
    private toastRef: React.RefObject<Toast> = React.createRef<Toast>();
    private dateSelection:DropdownSelection;
    private dateSelectionChoices = [        
        { text: "Last 30 Days", id: "30" },
        { text: "Last 60 Days", id: "60" },
        { text: "Last 90 Days", id: "90" },
        { text: "Last 120 Days", id: "120" },
        { text: "Last 365 Days", id: "365" },        

    ];



    private readonly WAIT_CAT_NAME:string = "Wait";
    private readonly WORK_CAT_NAME:string = "Work";


    private columnCategoryChoices = [
        {text:this.WORK_CAT_NAME, id:this.WORK_CAT_NAME},
        {text:this.WAIT_CAT_NAME, id:this.WAIT_CAT_NAME}
    ]
    constructor(props:{}) {
        super(props);
        
        let initState:IWorkItemTimeContentState = {projectInfo:{id:"", name:""}, projectName:"",team:"",isToastVisible :false, isToastFadingOut:false, foundCompletedPRs: false, doneLoading: false, exception:"", teamList:[], teamBoard:undefined, teamBacklogConfig:undefined, workItemHistory:[], teamFields:{_links:undefined, url:"", values:[],defaultValue:"", field:{referenceName:"", url:""}}, workItemRevTableData:[],loadingWorkItems:false, boardColumnData:[], detailsCollapsed:true, dateOffset:30, categories:this.getInitializedCategoryInfo(), workItemCount:0,workItemProcessDetails:[]};
        this.dateSelection = new DropdownSelection();
        this.dateSelection.select(0);
        
        this.state = initState;

    }

    private getInitializedCategoryInfo():ICategory[]
    {
        
        let waitCat:ICategory = {categoryName:this.WAIT_CAT_NAME, boardColumnNames:[], categoryType:workItemInterfaces.columnCategoryChoices.Wait, stats:{boardColumn:"",average:0, stdDev:0, workItemTimes:[],category:workItemInterfaces.columnCategoryChoices.Wait}};
        let workCat:ICategory = {categoryName:this.WORK_CAT_NAME, boardColumnNames:[], categoryType:workItemInterfaces.columnCategoryChoices.Work, stats:{boardColumn:"",average:0, stdDev:0, workItemTimes:[],category:workItemInterfaces.columnCategoryChoices.Work}};
        return [waitCat,workCat]
    }

    public async componentDidMount() {        
        await SDK.init();
        await SDK.ready();
        const projectService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
        const project = await projectService.getProject();
        if(project){
    
        this.setState({projectInfo:project});
        this.initializeState();
        }
        else{
            this.toastError("Did not retrieve the project info");
        }
    }

    private async initializeState():Promise<void> {

        await SDK.ready();
        try {
            
            const project: API.IProjectInfo | undefined = this.state.projectInfo;
            if (project) {
                
                let coreClient:CoreRestClient = getClient(CoreRestClient);
                let wiProcessClient:WorkItemTrackingProcessRestClient = getClient(WorkItemTrackingProcessRestClient);
                let wiTypeDetails:ProcessWorkItemType[] = await ADOProcess.GetProcessWorkItemDetails(coreClient,wiProcessClient,project.id);
                this.setState({ projectName: project.name, doneLoading:true, workItemProcessDetails:wiTypeDetails});
                wiTypeDetails.forEach((wi)=>{
                    console.log("Found: " + wi.referenceName + " - " + wi.name);

                });
            }
            this.getTeamsList();
            //this.getWorkItemReporting()
        }
        catch(ex)
        {
            this.toastError(ex.toString());
        }
    }


    ///getTeamsList -- gets the teams that are a part of the teamProject.
    private async getTeamsList() {
        await SDK.ready();
        try {
            const project: API.IProjectInfo | undefined = this.state.projectInfo;
         const coreClient:CoreRestClient = getClient(CoreRestClient);
            let teamsList:WebApiTeam[] = await coreClient.getTeams(project.id,false,500);
            

            let teamArray: Array<IListBoxItem<{}>> = []
            teamsList.forEach((thisTeam) => {
                let t:IListBoxItem = {id:thisTeam.id, text:thisTeam.name};
                teamArray.push(t);
            });

            this.setState({teamList:teamArray});


        }
        catch(ex)
        {
            this.toastError(ex.toString());
        }
    }


    ///GetTeamConfig -- gets team configuration for Backlog and area
    private async GetTeamConfig(teamID:string)
    {

        try 
        {
            const wClient:WorkRestClient = getClient(WorkRestClient);
            const project: API.IProjectInfo | undefined = this.state.projectInfo;
            if(project)
            {
                let tc:TeamContext = {projectId: project.id, teamId:teamID, project:"",team:"" };
                let teamBacklogConfigPromise:Promise<BacklogConfiguration> = wClient.getBacklogConfigurations(tc);
                let teamSettingPromise:Promise<TeamFieldValues> = wClient.getTeamFieldValues(tc);
                
                let backlogConfig = await teamBacklogConfigPromise;
                let teamSettings:TeamFieldValues = await teamSettingPromise;
                let teamBoard:Board= await wClient.getBoard(tc,backlogConfig.requirementBacklog.name);
                //let currentteamAreaPaths:string[] = [];
                //teamSettings.values.forEach((thisAP) =>{
                //    currentteamAreaPaths.push(thisAP.value);

                //});
                
                this.setState({teamBacklogConfig:backlogConfig,teamFields:teamSettings, teamBoard:teamBoard});

            }
        }
        catch(ex){
            this.toastError(ex.toString());
        }
    }

    private async GetTeam(teamID:string):Promise<WebApiTeam>
    {
        return new Promise<WebApiTeam>(async (resolve, reject) => { 
            try 

            {
                let result:Promise<WebApiTeam>;
                const cClient:CoreRestClient = getClient(CoreRestClient);
                const project: API.IProjectInfo | undefined = this.state.projectInfo;
                if(project)
                {
                    
                    result = cClient.getTeam(project.id,teamID);
                    resolve(result);

    
                }
                else 
                {reject("No Project");}
            }
            catch(ex){
                //this.toastError(ex.toString());
                reject(ex);
                
            }

        });
        
    }


    private getDateInThePast(numberOfDaysAgo:number):Date
    {
        
        let RetDate:Date = new Date(new Date().getTime() - (numberOfDaysAgo * this.dayMilliseconds));

        return RetDate;
    }


    private GetOutgoingBoardColumns():string[]
    {
        let result:string[]=[];

        let teamBoard = this.state.teamBoard;
        
        if(teamBoard)
        {
        
            teamBoard.columns.forEach((bc)=>{

        
                if(bc.columnType == BoardColumnType.Outgoing)
                {
        
                    result.push(bc.name);
                }
        
            });
        }

        return result;
    }

    private async GetWorkItemsByQuery(workItemTypes:string[], dateOffset:number):Promise<WorkItemReference[]>
    {

        const client = getClient(WorkItemTrackingRestClient);
        return new Promise<WorkItemReference[]>(async (resolve,reject) => {

            try
            {
                let project:string = this.state.projectName;
                let team:string = this.state.team;
                let teamAreaPaths:TeamFieldValues = this.state.teamFields;
                let query:string = "";
                let queryResultPromises:Promise<WorkItemQueryResult>[] = [];
                let uniqueStates:string[] = [];

                
                let wiqlWorkItemTypes:string = "(";
                workItemTypes.forEach((t)=>{ 
                    wiqlWorkItemTypes = wiqlWorkItemTypes + "'" + t + "'," 
                    let getWorktemClosedStates:string[] = this.GetClosedStatesForWorkItemType(t);

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
                    query = "SELECT [System.Id], [System.WorkItemType], [System.State], [System.AreaPath] FROM workitems WHERE [System.TeamProject] = '" + project  + "' AND [System.WorkItemType] in " + wiqlWorkItemTypes + " AND [Microsoft.vsts.Common.ClosedDate] > @today-" + dateOffset.toString() + " AND [System.AreaPath] " + wiqlAreaPaths + " AND [System.State] in " + wiqlClosedStates  + " ORDER BY [System.ChangedDate] DESC";
                    console.log(query);
                    let q:Wiql = {query: query};
                    queryResultPromises.push(client.queryByWiql(q,project,team,false,1000));
                });
                
                

                
                let wiresults:WorkItemReference[] = [];
                let AllWIQLResults = await Promise.all(queryResultPromises);
                AllWIQLResults.forEach((r) => {
                    wiresults = wiresults.concat(r.workItems);
                });
                this.setState({workItemCount:wiresults.length});
                resolve(wiresults);

            }
            catch(ex) 
            {
                this.toastError(ex);
                reject(ex);                
            }

        });
    }


    private GetClosedStatesForWorkItemType(workItemType:string):string[]
    {
        let result:string[] = [];

        let workItemDetails:ProcessWorkItemType[] = this.state.workItemProcessDetails;
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


    private async DoTeamSelect(teamId:string)
    {

        this.setState({loadingWorkItems:true,categories:this.getInitializedCategoryInfo()});
        try {
            
            let backlogWorkItemTypes:string[] = [];
            let teamInfoProm:Promise<WebApiTeam> = this.GetTeam(teamId);
            await this.GetTeamConfig(teamId);
            let backlogConfig:BacklogConfiguration|undefined = this.state.teamBacklogConfig
            if(backlogConfig)
            {
                backlogConfig.requirementBacklog.workItemTypes.forEach((thisType) => {
                backlogWorkItemTypes.push(thisType.name);
                    
                });
            }
            let teamInfo:WebApiTeam =  await teamInfoProm;
            let dateOffset = this.state.dateOffset;
            await this.DoGetData(backlogWorkItemTypes,dateOffset);
            //await this.GetWorkItemReporting(backlogWorkItemTypes);

        }
        finally
        {

            this.setState({loadingWorkItems:false, team:teamId});
        }
    }

    private async DoDateSelect(dateOffset:number)
    {
        this.setState({loadingWorkItems:true});
        let backlogWorkItemTypes:string[] = [];
        let backlogConfig:BacklogConfiguration|undefined = this.state.teamBacklogConfig
            if(backlogConfig)
            {
                backlogConfig.requirementBacklog.workItemTypes.forEach((thisType) => {
                backlogWorkItemTypes.push(thisType.name);                    
                });

            }
        if(this.state.team != "")
        {            
            await this.DoGetData(backlogWorkItemTypes,dateOffset);
        }
        this.setState({dateOffset:dateOffset, loadingWorkItems:false});
    }

    private async DoGetData(backlogWorkItemTypes:string[], offsetDays:number)
    {
//        let updatedWorkItems:ReportingWorkItemRevisionsBatch = await this.GetWorkItemReportingLatestByDateRange(backlogWorkItemTypes,this.getDateInThePast(offsetDays));

        let workItemsToCalculate:WorkItemReference[] = await this.GetWorkItemsByQuery(backlogWorkItemTypes, offsetDays);
        
        //let itemsToCalculate:number[] = await this.CollectClosedBacklogItems(updatedWorkItems);
        let workItemsHistory:workItemInterfaces.IWorkItemWithHistory[] = await this.GetAllWorkItemsHistory(workItemsToCalculate);


        let calculatedData:workItemInterfaces.IWorkItemStateHistory[] =  this.CalculateBoardColumnTime(workItemsHistory);
        let boardColumns:workItemInterfaces.IBoardColumnStat[] = this.GatherDistinctBoardColumns(calculatedData);

        this.CalculateBoardColumnAverages(boardColumns);
        this.setState({boardColumnData:boardColumns});
        this.CollectAllWorkItemRevisionForTable(calculatedData);
        this.ReDoCategoryCalcs();
    }


    private ReDoCategoryCalcs()
    {
        
        let categoryInfo = this.state.categories;
        let waitCat:ICategory | undefined = categoryInfo.find(c => c.categoryName == this.WAIT_CAT_NAME);
        let workCat:ICategory | undefined = categoryInfo.find(c => c.categoryName == this.WORK_CAT_NAME);

        if(waitCat)
        {
            waitCat.stats= this.CalculateCategoryColumnAverages(waitCat);
        }
        if(workCat)
        {
            workCat.stats = this.CalculateCategoryColumnAverages(workCat);
        }

        this.setState({categories:categoryInfo});

    }

    ///
    private GatherDistinctBoardColumns(workItemData:workItemInterfaces.IWorkItemStateHistory[]):workItemInterfaces.IBoardColumnStat[]
    {
        let result:workItemInterfaces.IBoardColumnStat[] = [];


        let outgoingColumns = this.GetOutgoingBoardColumns();

        workItemData.forEach((thisWorkItem)=>{

            thisWorkItem.revisions.forEach((thisWIRev)=>{
                
                if(outgoingColumns.find(og=>og == thisWIRev.boardColumn))
                {
                    //excluding outgoing columns
                }
                else
                {
                    
                    let resultBoardColumn:workItemInterfaces.IBoardColumnStat | undefined = result.find(i=> i.boardColumn==thisWIRev.boardColumn);
                    
                    if(resultBoardColumn == undefined)                
                    {
                        let newBoardColumn:workItemInterfaces.IBoardColumnStat = {boardColumn:thisWIRev.boardColumn, average:0,stdDev:0,workItemTimes:[], category:this.GetBoardColumnCategory(thisWIRev.boardColumn)};
                        result.push(newBoardColumn);
                        resultBoardColumn = newBoardColumn;
                    }
                    let boardWITime:workItemInterfaces.IBoardColumnWorkItemTime |undefined = resultBoardColumn.workItemTimes.find(wi=>wi.wiID==thisWIRev.workItemID);
                    if(boardWITime != undefined)
                    {
                        boardWITime.columnTime = boardWITime.columnTime + thisWIRev.timeInColumn;
                    }
                    else
                    {
                        boardWITime = {wiID:thisWIRev.workItemID, columnTime:thisWIRev.timeInColumn};
                        resultBoardColumn.workItemTimes.push(boardWITime);
                    }
                }

            });
            

        });

        return result;
    }

    private GetBoardColumnCategory(boardColumnName:string):workItemInterfaces.columnCategoryChoices
    {
        let result:workItemInterfaces.columnCategoryChoices = workItemInterfaces.columnCategoryChoices.NotSet;

        let categoryInfo:ICategory[] = this.state.categories;
        try {
            if(this.GetWorkItemCategory(this.WORK_CAT_NAME).boardColumnNames.find(c=>c == boardColumnName))
            {
                result = workItemInterfaces.columnCategoryChoices.Work;
            }
            else if(this.GetWorkItemCategory(this.WAIT_CAT_NAME).boardColumnNames.find(c=>c == boardColumnName))
            {
                result = workItemInterfaces.columnCategoryChoices.Wait;
            }
        }
        catch(ex)
        {
            result = workItemInterfaces.columnCategoryChoices.NotSet;
            console.log("Did not successfully get BoardColumnCategory");
        }
        return result;
    }

    private CalculateBoardColumnAverages(boardColumnData:workItemInterfaces.IBoardColumnStat[])
    {
        boardColumnData.forEach((thisColumn)=>{
            let totalTime:number = 0;
            let vals:number[] = [];
            thisColumn.workItemTimes.forEach((thisWITimeinColumn)=>{
                totalTime =  totalTime + thisWITimeinColumn.columnTime;
                vals.push(thisWITimeinColumn.columnTime)
            });
            thisColumn.average = totalTime  / thisColumn.workItemTimes.length;
            thisColumn.stdDev = this.getStandardDeviation(vals);
        });
    }

    private CalculateCategoryColumnAverages(category:ICategory):workItemInterfaces.IBoardColumnStat
    {
        let result:workItemInterfaces.IBoardColumnStat = {boardColumn:"", average:0,stdDev:0,workItemTimes:[],category:category.categoryType};


        let boardColumnData:workItemInterfaces.IBoardColumnStat[] = this.state.boardColumnData;
        category.boardColumnNames.forEach((catCol)=>{            

            let columnData:workItemInterfaces.IBoardColumnStat | undefined = boardColumnData.find(col=>col.boardColumn==catCol)

            if(columnData)
            {
              
                result.workItemTimes = result.workItemTimes.concat(columnData.workItemTimes);
            }
            
        });


        let totalTime:number = 0;
        result.workItemTimes.forEach((wit) =>{

            totalTime = totalTime + wit.columnTime;
        });
        if(this.state.workItemCount >0)
        {
            result.average = totalTime / this.state.workItemCount;
        }
        
        return result;
    }

    private GetCategoryChoiceForName(categoryName:string):workItemInterfaces.columnCategoryChoices
    {
        let result:workItemInterfaces.columnCategoryChoices = workItemInterfaces.columnCategoryChoices.NotSet;

        if(categoryName == this.WAIT_CAT_NAME)
        {
            result = workItemInterfaces.columnCategoryChoices.Wait;
        }
        else if(categoryName == this.WORK_CAT_NAME)
        {
            result = workItemInterfaces.columnCategoryChoices.Work;
        }

        return result;
    }

    private getStandardDeviation (array:number[]):number {
        const n = array.length
        const mean = array.reduce((a, b) => a + b) / n
        return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
    }
    



    //Takes in the list of Work Item history we have after we selected down to the the closed Work Items for the team, and then we will call Azure DevOps to 
    // get all of the revision history for each work Item.
    private async GetAllWorkItemsHistory(workItemsToCollect: WorkItemReference[]): Promise<workItemInterfaces.IWorkItemWithHistory[]>
    {
        let workItemPromises:Promise<WorkItem[]>[] = [];
        return new Promise<workItemInterfaces.IWorkItemWithHistory[]>(async (resolve, reject) => { 
            try{ 
                let returnResult:workItemInterfaces.IWorkItemWithHistory[] = [];
                workItemsToCollect.forEach((thisWI) => {
                    let thisPromise:Promise<WorkItem[]> = this.GetWorkItemWithHistory(thisWI.id);
                    workItemPromises.push(thisPromise);
                });

                let allResults = await Promise.all(workItemPromises);


                ///So we got all the promises for all the calls for the workitems, so now loop through the results 
                allResults.forEach((thisResult)=> {
                    //create a new record for us to keep score with
                    let thisWorkItemDetails:workItemInterfaces.IWorkItemWithHistory = {id:thisResult[0].id,history:[]};
                    
                    //now inside The results for THIS work item, lets go through the collection of revisions
                    thisResult.forEach((wi) => {          
                        
                        if(wi.fields["System.BoardColumn"] == undefined || wi.fields["System.BoardColumn"] == "")
                        {
                            wi.fields["System.BoardColumn"] = "No Board Column";
                        }
                        
                        //if this is the first revision for us, we will just push it on the collection
                        if(thisWorkItemDetails.history.length == 0)
                        {
                            thisWorkItemDetails.history.push(wi);
                        }
                        //otherwise, we only want to keep the revisions that include a change in the board column
                        else 
                        {
                            //so let's look at this revision's board column and compare it to the previous revsion we have to see if the BoardColumn has changed or not
                            if(wi.fields["System.BoardColumn"] != thisWorkItemDetails.history[thisWorkItemDetails.history.length-1].fields["System.BoardColumn"])
                            {
                                thisWorkItemDetails.history.push(wi);
                            }
                        }
                    });
                    returnResult.push(thisWorkItemDetails);
                });
                resolve(returnResult);
            }
            catch(ex)
            {
                this.toastError(ex);
                reject(ex)
            }
        });

    }

    ///
    private async GetWorkItemWithHistory(workItemID:number) : Promise<WorkItem[]>
    {
        const client = getClient(WorkItemTrackingRestClient);
        return client.getRevisions(workItemID,this.state.projectInfo.id)
    }



    //Take the items we have collected and calculated and put them in an object that we can use to display the results on a table on the screen
    private CollectAllWorkItemRevisionForTable(history:workItemInterfaces.IWorkItemStateHistory[])
    {
        
        let revs:workItemInterfaces.IWorkItemTableDisplay[] = [];

        history.forEach((thisWI) => {
            thisWI.revisions.forEach((thisRev) =>{
                let duration:TimeCalc.IPRDuration = TimeCalc.getMillisecondsToTime(thisRev.timeInColumn);
                let durationString:string = duration.days.toString() + " Days, " + duration.hours.toString() + " Hours, " + duration.minutes.toString() + " Minutes, " + duration.seconds.toString() + " Seconds";
                
                let dis:workItemInterfaces.IWorkItemTableDisplay = {workItemID:thisRev.workItemID, revNum:thisRev.revNum, boardColumn:thisRev.boardColumn, boardColumnStartTime: thisRev.boardColumnStartTime.toString(), timeInColumn: durationString}
                revs.push(dis);
           });

        });

        this.setState({workItemRevTableData:revs});
    }


    //take the list of Work Item with revisions that we've collected and now lets' iterate through and calculate the time that the work item has been in that board column
    private CalculateBoardColumnTime(data:workItemInterfaces.IWorkItemWithHistory[]):workItemInterfaces.IWorkItemStateHistory[]
    { 
        let result:workItemInterfaces.IWorkItemStateHistory[] = [];
        let currentDate = new Date();
        ///let workItemInfo:workItemInterfaces.IWorkItemStateHistory[] = this.state.workItemHistory;
        data.forEach((thisWI) => {
            let i:number = 0;
            let historyWithTime:workItemInterfaces.IWorkItemStateHistory = {workItemID:thisWI.id,revisions:[]}

            let topNdx = thisWI.history.length -1;
            for(i=0; i < thisWI.history.length; i++)
            {
                let thisRev:workItemInterfaces.IWorkItemStateInfo = {workItemID: thisWI.id,revNum:thisWI.history[i].rev,boardColumn:thisWI.history[i].fields["System.BoardColumn"],boardColumnStartTime:thisWI.history[i].fields["System.ChangedDate"],timeInColumn:0}
                if(i == topNdx)
                {
                    let thisDate:Date =thisWI.history[i].fields["System.ChangedDate"];
                    thisRev.timeInColumn = Math.floor(currentDate.valueOf() - thisDate.valueOf());
                }
                else
                {
                    let thisDate:Date =thisWI.history[i].fields["System.ChangedDate"];
                    let endDate:Date = thisWI.history[i+1].fields["System.ChangedDate"];
                    thisRev.timeInColumn = Math.floor(endDate.valueOf() - thisDate.valueOf());
                }
                historyWithTime.revisions.push(thisRev);
            }
            result.push(historyWithTime);

        });

        return result;

    }
    
    private SelectDays = (event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<{}>) => {

        let d:number = Number.parseInt(item.id);

        this.DoDateSelect(d);
    };


    ///Team Selection
    private  selectTeam = (event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<{}>) =>{


        this.DoTeamSelect(item.id);

    }

    private setColumnCategory(boardColumnName:string, category:workItemInterfaces.columnCategoryChoices)
    {
        
        let boardColumnData:workItemInterfaces.IBoardColumnStat[] = this.state.boardColumnData;
        let categoryInfo:ICategory[] = this.state.categories;
        let selectedColumn:workItemInterfaces.IBoardColumnStat | undefined = boardColumnData.find(c=> c.boardColumn == boardColumnName)
        if(selectedColumn != undefined)
        {
            selectedColumn.category = category;
            this.setState({boardColumnData:boardColumnData});

            let waitCat:ICategory | undefined = categoryInfo.find(c => c.categoryName == this.WAIT_CAT_NAME);
            let workCat:ICategory | undefined = categoryInfo.find(c => c.categoryName == this.WORK_CAT_NAME);
            if(category == workItemInterfaces.columnCategoryChoices.Wait)
            {
                
                if(waitCat)
                {
                    waitCat.boardColumnNames.push(boardColumnName);
                    
                }
                if(workCat)
                {
                    let ndx = workCat.boardColumnNames.indexOf(boardColumnName);
                    if(ndx > -1)
                    {
                        workCat.boardColumnNames.splice(ndx,1);
                    }
                }
            }
            if(category == workItemInterfaces.columnCategoryChoices.Work)
            {
                
                if(workCat)
                {
                    workCat.boardColumnNames.push(boardColumnName);
                    
                }
                if(waitCat)
                {
                    let ndx = waitCat.boardColumnNames.indexOf(boardColumnName);
                    if(ndx > -1)
                    {
                        waitCat.boardColumnNames.splice(ndx,1);
                    }
                }
            }
            if(waitCat)
            {
                waitCat.stats= this.CalculateCategoryColumnAverages(waitCat);
            }
            if(workCat)
            {
                workCat.stats = this.CalculateCategoryColumnAverages(workCat);
            }

            this.setState({boardColumnData:boardColumnData, categories:categoryInfo});

        }
        else{
            this.toastError("Unable to find column in collection to set the category");
        }


    }



    private GetWorkItemCategory(categoryName:string):ICategory
    {
        let result:ICategory = { categoryName:"",boardColumnNames:[], categoryType:workItemInterfaces.columnCategoryChoices.NotSet, stats:{boardColumn:"",average:0, stdDev:0, workItemTimes:[],category:workItemInterfaces.columnCategoryChoices.NotSet}};

        let categoryInfo:ICategory[] = this.state.categories;
        let selectedCat = categoryInfo.find(c=>c.categoryName == categoryName)
        if(selectedCat)
        {
            result = selectedCat
        }
        return result;
    }

    private detailsTableCollapseClick = () => {
        let v = !this.state.detailsCollapsed;
        this.setState({detailsCollapsed:v});
    };

    ///Toast Error
    private toastError(toastText:string)
    {
        this.setState({isToastVisible:true, isToastFadingOut:false, exception:toastText})
    }

    private renderBoardColiumnListRow = (
        index: number,
        item: workItemInterfaces.IBoardColumnStat,
        details: IListItemDetails<workItemInterfaces.IBoardColumnStat>,
        key?: string
    ): JSX.Element => {
        let timeObject:TimeCalc.IPRDuration = TimeCalc.getMillisecondsToTime(item.average);
        let stdDevObject:TimeCalc.IPRDuration = TimeCalc.getMillisecondsToTime(item.stdDev);
        key = item.boardColumn
        let listClassSet:string = "text-ellipsis"
        let calcOutputClassSet:string ="fontSizeMS font-size-ms text-ellipsis secondary-text ";
        let workButtonClass:string ="";
        let waitButtonClass:string ="";
        let waitButtonDisabled:boolean =false;
        let workButtonDisabled:boolean=false;
        if(item.category == workItemInterfaces.columnCategoryChoices.NotSet)
        {
            listClassSet = listClassSet + " cat-NotSet";                        
        }
        if(item.category == workItemInterfaces.columnCategoryChoices.Work)
        {
            listClassSet = listClassSet + " cat-Work";            
            workButtonClass = "hiddenButton";
            workButtonDisabled = true;
            waitButtonDisabled = false;
        }
        if(item.category == workItemInterfaces.columnCategoryChoices.Wait)
        {
            listClassSet = listClassSet + " cat-Wait";            
            waitButtonClass = "hiddenButton";
            waitButtonDisabled = true;
            workButtonDisabled = false;
        }
        
        return (
            <ListItem key={key || "list-item" + index} index={index} details={details}>
                
                <div className="list-example-row flex-row h-scroll-hidden"> 
                    
                    <div
                        style={{ marginLeft: "10px", padding: "10px 0px" }}
                        className="flex-column h-scroll-hidden"
                    >
                        <span className={listClassSet} style={{ fontWeight:"bolder"}}><span>{item.boardColumn}</span></span> 
                        <span> 
                            <ButtonGroup>
                                <Button 
                                    text="Set as Work"
                                    className={workButtonClass}                                    
                                    dataIndex={index}
                                    disabled={workButtonDisabled}
                                    id={item.boardColumn}                                       
                                    onClick={() => this.setColumnCategory(item.boardColumn,workItemInterfaces.columnCategoryChoices.Work)}
                                />
                                <Button 
                                    text="Set as Wait"
                                    dataIndex={index}
                                    className={waitButtonClass}
                                    disabled={waitButtonDisabled}
                                    id={item.boardColumn}                                       
                                    onClick={() => this.setColumnCategory(item.boardColumn,workItemInterfaces.columnCategoryChoices.Wait)}
                                />
                            </ButtonGroup>
                                 
                        </span>
                        <span className={calcOutputClassSet}> Work Item Count:  <span style={{ fontWeight:"bolder"}}>{item.workItemTimes.length.toString()}</span></span>
                        <span className={calcOutputClassSet}> Average Time:  <span style={{ fontWeight:"bolder"}}>{timeObject.days.toString()} Days,  {timeObject.hours.toString()} Hours, {timeObject.minutes.toString()} Minutes, {timeObject.seconds} Seconds</span></span>
                        <span className={calcOutputClassSet}>Standard Deviation:  <span style={{ fontWeight:"bolder"}}>{stdDevObject.days.toString()} Days,  {stdDevObject.hours.toString()} Hours, {stdDevObject.minutes.toString()} Minutes, {stdDevObject.seconds} Seconds</span></span>
                    </div>
                </div>
            </ListItem>
        );
    }

    public render(): JSX.Element {
        let projectName = this.state.projectName;
        let isToastVisible = this.state.isToastVisible;
        let exception = this.state.exception;
        let doneLoading = this.state.doneLoading;
        let workItemHistory:workItemInterfaces.IWorkItemStateHistory[] = this.state.workItemHistory;
        let teamList:Array<IListBoxItem<{}>> = this.state.teamList;
        let loadingWorkItems:boolean = this.state.loadingWorkItems;
        let requirementName:string = "";
        let selection = new ListSelection(true);
        let boardColumnCount:number = this.state.boardColumnData.length;
        let tableItems = new ArrayItemProvider<workItemInterfaces.IWorkItemTableDisplay>(this.state.workItemRevTableData);
        let boardColumnList = new ArrayItemProvider<workItemInterfaces.IBoardColumnStat>(this.state.boardColumnData);
        let workCategoryInfo = this.GetWorkItemCategory(this.WORK_CAT_NAME);
        let waitCategoryInfo = this.GetWorkItemCategory(this.WAIT_CAT_NAME);
        let workAvgTime:TimeCalc.IPRDuration = TimeCalc.getMillisecondsToTime(workCategoryInfo.stats.average);
        let waitAvgTime:TimeCalc.IPRDuration = TimeCalc.getMillisecondsToTime(waitCategoryInfo.stats.average);

        if(this.state.teamBacklogConfig) {requirementName = this.state.teamBacklogConfig.requirementBacklog.name;}
        if(doneLoading) {
            if(!loadingWorkItems){
            return (
                <Page className="flex-grow prinfo-hub">
                    <Card className="selectionCard" titleProps={{text: "Selections"}}>
                        <div className="flex-cell" style={{ flexWrap: "wrap", textAlign:"center", minWidth:"350px"}}>
                            Teams: &nbsp; &nbsp;<Dropdown items={teamList} placeholder="Select a Team" ariaLabel="Basic" className="teamDropDown" onSelect={this.selectTeam} /> &nbsp;&nbsp;
                        </div>
                        <div className="flex-cell" style={{ flexWrap: "wrap", textAlign:"center", minWidth:"350px"}}>
                            For the Last # Days: &nbsp;&nbsp;
                            <Dropdown
                                                    ariaLabel="Basic"                                                                                                                                                            
                                                    items={this.dateSelectionChoices}
                                                    selection={this.dateSelection}
                                                    onSelect={this.SelectDays}
                            />  
                        </div>
                    </Card>
                    <Card className="boardColumnCard">
                                <Card className="listColumnCard">
                                <ScrollableList
                                    itemProvider={boardColumnList}
                                    renderRow={this.renderBoardColiumnListRow}
                                    selection={selection}
                                    width="450px"
                                />    
                                </Card>
                                <Card className="categoryColumnCard">
                                    <table className="cat-table">
                                        <tr>
                                            <td>
                                                <Header title="Wait Times" className="cat-wait-header"></Header>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <div className="cat-area">
                                                <span className="fontSizeMS font-size-ms text-ellipsis secondary-text"> Average Time:  <span style={{ fontWeight:"bolder"}}>{waitAvgTime.days.toString()} Days,  {waitAvgTime.hours.toString()} Hours, {waitAvgTime.minutes.toString()} Minutes, {waitAvgTime.seconds} Seconds</span></span>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>

                                </Card>
                                <Card className="categoryColumnCard">
                                    <table className="cat-table">
                                        <tr>
                                            <td>
                                                <Header title="Work Times" className="cat-work-header"></Header>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <div className="cat-area">
                                                    
                                                    <span className="fontSizeMS font-size-ms text-ellipsis secondary-text"> Average Time:  <span style={{ fontWeight:"bolder"}}>{workAvgTime.days.toString()} Days,  {workAvgTime.hours.toString()} Hours, {workAvgTime.minutes.toString()} Minutes, {workAvgTime.seconds} Seconds</span></span>
                                                </div>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    
                                </Card>
                    </Card>
                    <Card collapsible={true} collapsed={this.state.detailsCollapsed} titleProps={{ text: "Work Item Details" }} onCollapseClick={this.detailsTableCollapseClick}>
                        
                        <Table 
                        ariaLabel="Work Item Table"
                        columns={WITableSetup.workItemColumns}
                        itemProvider={tableItems}
                        role="table"
                        containerClassName="v-scroll-auto"
                        />
                        
                    </Card>
                    
                    {isToastVisible && (
                        <Toast
                            ref={this.toastRef}
                            message={exception}
                            callToAction="OK"
                            onCallToActionClick={() => {this.setState({isToastFadingOut:true, isToastVisible:false,exception:""})}}
                            />
                        )}

                </Page>
            )
            } //loadingWorkitems
            else {
                return (
                    <Page className="flex-grow prinfo-hub">
                    <Card className="selectionCard" titleProps={{text: "Selections"}}>
                        <div className="flex-cell" style={{ flexWrap: "wrap", textAlign:"center", minWidth:"500px", display:"hidden"}}>
                            Teams: <Dropdown items={teamList} placeholder="Select a Team" ariaLabel="Basic" className="teamDropDown" onSelect={this.selectTeam}  />
                        </div>
                    </Card>
                    <Card>
                        <div>
                            There were {boardColumnCount.toString()} columns found
                        </div>
                    </Card>
                    <Card>
                        
                    <Spinner label="Loading ..." size={SpinnerSize.large} />
                        
                    </Card>
                    
                    {isToastVisible && (
                        <Toast
                            ref={this.toastRef}
                            message={exception}
                            callToAction="OK"
                            onCallToActionClick={() => {this.setState({isToastFadingOut:true, isToastVisible:false,exception:""})}}
                            />
                        )}

                </Page>
                );
            }
        }
        else
        {
            return(                      
                <Page className="flex-grow">                    
                        
                        <Card className="flex-grow flex-center bolt-table-card" contentProps={{ contentPadding: true }}>                            
                        
                            <div className="flex-cell">
                                <div>
                                    <Spinner label="Loading ..." size={SpinnerSize.large} />
                                </div>
                            </div>          
                        </Card>
                    </Page>
            );
        }

        

    }
}

showRootComponent(<WorkItemTimeContent />);