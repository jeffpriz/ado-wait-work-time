import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { showRootComponent } from "../../Common";
import { Doughnut, Bar} from 'react-chartjs-2';
import { Page } from "azure-devops-ui/Page";
import { Card } from "azure-devops-ui/Card";
import { ObservableValue } from "azure-devops-ui/Core/Observable";
import {Dropdown} from "azure-devops-ui/Dropdown";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";
import { ScrollableList, IListItemDetails, ListSelection, ListItem } from "azure-devops-ui/List";
import { DropdownSelection } from "azure-devops-ui/Utilities/DropdownSelection";
import { Header } from "azure-devops-ui/Header";
import { CommonServiceIds, IProjectPageService,IGlobalMessagesService, getClient, IProjectInfo } from "azure-devops-extension-api";
import {WorkRestClient, BacklogConfiguration, TeamFieldValues, Board, BoardColumnType, BacklogLevelConfiguration} from "azure-devops-extension-api/Work";
import { WorkItemTrackingRestClient,  WorkItem, WorkItemQueryResult, Wiql, WorkItemReference, WorkItemExpand } from "azure-devops-extension-api/WorkItemTracking";
import {  ProcessWorkItemType, WorkItemTrackingProcessRestClient } from "azure-devops-extension-api/WorkItemTrackingProcess"
import {CoreRestClient, WebApiTeam, TeamContext } from "azure-devops-extension-api/Core";
import * as workItemInterfaces from "./WorkItemInfo";
import { IListBoxItem} from "azure-devops-ui/ListBox";
import { Table } from "azure-devops-ui/Table";
import * as WITableSetup from "./WITableSetup";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import * as TimeCalc from "./Time";
import { Button } from "azure-devops-ui/Button";
import { ButtonGroup } from "azure-devops-ui/ButtonGroup";
import * as ADOProcess from "./ADOProjectCalls";
import { FormItem } from "azure-devops-ui/FormItem";
import { TextField } from "azure-devops-ui/TextField";
import {GetWaitWorkBarChartData, IBarChartData, IChartData, GetWaitWorkPieChartData, BarCharOptions, GetWorkWaitTimeItemLineChart, GetEfficiencyLineChart} from "./ChartingInfo";
import * as GetWorkItems from "./GetWorkItems";
import * as TrendSlice from "./trendSliceFunctions";



interface IWorkItemTimeContentState {
    projectInfo: IProjectInfo 
    projectName: string;
    teamBacklogConfig:BacklogConfiguration|undefined;
    teamBoard:Board|undefined,
    teamList: Array<IListBoxItem<{}>>;
    teamBacklogLevelsList:Array<IListBoxItem<{}>>;
    teamFields:TeamFieldValues;
    workItemRevTableData:workItemInterfaces.IWorkItemTableDisplay[],
    boardColumnData:workItemInterfaces.IBoardColumnStat[],
    workItemProcessDetails:ProcessWorkItemType[],
    backlogLevelConfig:BacklogLevelConfiguration|undefined,
    workItemCount:number,    
    team: string;
    dateOffset:number;
    doneLoading:boolean;
    loadingWorkItems:boolean;
    detailsCollapsed:boolean;
    categories:ICategory[];
    tagExclusions:string[];
    backlogWorkItemTypes:string[];
    workItemClosedSlices:TrendSlice.IDurationSlice[];
}


export interface ICategory
{
    categoryName:string,
    categoryType:workItemInterfaces.columnCategoryChoices,
    boardColumnNames:string[],
    stats:workItemInterfaces.IBoardColumnStat
}

export var  WAIT_CAT_NAME:string = "Wait";
export var WORK_CAT_NAME:string = "Work";
export var NOT_SET_NAME:string = "Not Set";


class WorkItemTimeContent extends React.Component<{}, IWorkItemTimeContentState> {
    private readonly dayMilliseconds:number = ( 24 * 60 * 60 * 1000);
    //private toastRef: React.RefObject<Toast> = React.createRef<Toast>();
    private dateSelection:DropdownSelection;
    private backlogSelection:DropdownSelection;
    private dateSelectionChoices = [        
        { text: "Last 14 Days", id: "14" },
        { text: "Last 30 Days", id: "30" },
        { text: "Last 60 Days", id: "60" },
        { text: "Last 90 Days", id: "90" },
        { text: "Last 120 Days", id: "120" },
        { text: "Last 365 Days", id: "365" },        

    ];


    private tagListObservable: ObservableValue<string>;
    

    private columnCategoryChoices = [
        {text:WORK_CAT_NAME, id:WORK_CAT_NAME},
        {text:WAIT_CAT_NAME, id:WAIT_CAT_NAME}
    ]
    constructor(props:{}) {
        super(props);
        
        let initState:IWorkItemTimeContentState = {projectInfo:{id:"", name:""}, projectName:"",team:"",   doneLoading: false,  teamList:[], teamBoard:undefined, teamBacklogConfig:undefined,  teamFields:{_links:undefined, url:"", values:[],defaultValue:"", field:{referenceName:"", url:""}}, workItemRevTableData:[],loadingWorkItems:false, boardColumnData:[], detailsCollapsed:true, dateOffset:14, categories:this.getInitializedCategoryInfo(), workItemCount:0,workItemProcessDetails:[], teamBacklogLevelsList:[], backlogLevelConfig:undefined, tagExclusions:[], backlogWorkItemTypes:[], workItemClosedSlices:[]};
        this.dateSelection = new DropdownSelection();
        this.backlogSelection = new DropdownSelection();
        this.dateSelection.select(0);
        this.tagListObservable = new ObservableValue<string>("");
        
        this.state = initState;

    }

    private getInitializedCategoryInfo():ICategory[]
    {
        
        let waitCat:ICategory = {categoryName:WAIT_CAT_NAME, boardColumnNames:[], categoryType:workItemInterfaces.columnCategoryChoices.Wait, stats:{boardColumn:"",average:0, stdDev:0, total:0, workItemTimes:[],category:workItemInterfaces.columnCategoryChoices.Wait}};
        let workCat:ICategory = {categoryName:WORK_CAT_NAME, boardColumnNames:[], categoryType:workItemInterfaces.columnCategoryChoices.Work, stats:{boardColumn:"",average:0, stdDev:0, total:0, workItemTimes:[],category:workItemInterfaces.columnCategoryChoices.Work}};
        let notSetCat:ICategory = {categoryName:NOT_SET_NAME, boardColumnNames:[], categoryType:workItemInterfaces.columnCategoryChoices.NotSet, stats:{boardColumn:"",average:0, stdDev:0, total:0, workItemTimes:[],category:workItemInterfaces.columnCategoryChoices.NotSet}};
        return [notSetCat, waitCat,workCat]
    }


    //After the Component has successfully loaded and is ready for processing, begin the initialization
    public async componentDidMount() {        
        await SDK.init();
        await SDK.ready();
        SDK.getConfiguration()
        SDK.getExtensionContext()
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


    //Init State -- set the SDK Ready, gets the current teams Team Project Process information, and handles getting initial items like the team list
    private async initializeState():Promise<void> {

        await SDK.ready();
        try {
            
            const project: IProjectInfo | undefined = this.state.projectInfo;
            if (project) {
                
                let coreClient:CoreRestClient = getClient(CoreRestClient);
                let wiProcessClient:WorkItemTrackingProcessRestClient = getClient(WorkItemTrackingProcessRestClient);
                let wiTypeDetails:ProcessWorkItemType[] = await ADOProcess.GetProcessWorkItemDetails(coreClient,wiProcessClient,project.id);
                this.setState({ projectName: project.name, doneLoading:true, workItemProcessDetails:wiTypeDetails});
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
            const project: IProjectInfo | undefined = this.state.projectInfo;
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
            const project: IProjectInfo | undefined = this.state.projectInfo;
            if(project)
            {
                let tc:TeamContext = {projectId: project.id, teamId:teamID, project:"",team:"" };
                let teamBacklogConfigPromise:Promise<BacklogConfiguration> = wClient.getBacklogConfigurations(tc);
                let teamSettingPromise:Promise<TeamFieldValues> = wClient.getTeamFieldValues(tc);
                
                let backlogConfig = await teamBacklogConfigPromise;
                let teamSettings:TeamFieldValues = await teamSettingPromise;
                let teamBoard:Board= await wClient.getBoard(tc,backlogConfig.requirementBacklog.name);

                
                this.setState({teamBacklogConfig:backlogConfig,teamFields:teamSettings, teamBoard:teamBoard});

            }
        }
        catch(ex){
            this.toastError(ex.toString());
        }
    }


    //Get the Team information record from ADO
    private async GetTeam(teamID:string):Promise<WebApiTeam>
    {
        return new Promise<WebApiTeam>(async (resolve, reject) => { 
            try 

            {
                let result:Promise<WebApiTeam>;
                const cClient:CoreRestClient = getClient(CoreRestClient);
                const project: IProjectInfo | undefined = this.state.projectInfo;
                if(project)
                {
                    
                    result = cClient.getTeam(project.id,teamID);
                    resolve(result);

    
                }
                else 
                {reject("No Project");}
            }
            catch(ex){
                reject(ex);                
            }

        });
        
    }


    //Gets a date object in the past given a number of days ago to get
    private getDateInThePast(numberOfDaysAgo:number):Date
    {        
        return new Date(new Date().getTime() - (numberOfDaysAgo * this.dayMilliseconds));
    }



    //Looks at the team board information we have gathered and determins the Outgoing columns, so that we know what column(s) later we may not want to deal with (i.e. things stay in the Closed column forever)
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


    //Builds the WIQ to query the Work Items based on the filters the user has selected
    private async GetWorkItemsByQuery(workItemTypes:string[], dateOffset:number, tagList:string[]):Promise<WorkItemReference[]>
    {

        
        return new Promise<WorkItemReference[]>(async (resolve,reject) => {

            try
            {

                let project:string = this.state.projectName;
                let team:string = this.state.team;
                let teamAreaPaths:TeamFieldValues = this.state.teamFields;
                let workItemProcessDetails:ProcessWorkItemType[] = this.state.workItemProcessDetails;
                const client = getClient(WorkItemTrackingRestClient);
                let wiResults:WorkItemReference[] = await  GetWorkItems.GetWorkItemsByQuery(client, project,team,teamAreaPaths, workItemTypes, workItemProcessDetails, dateOffset,tagList);
                this.setState({workItemCount:wiResults.length});
                resolve(wiResults);
            }
            catch(ex) 
            {
                this.toastError(ex);
                reject(ex);                
            }

        });
    }



    private SplitTagsValue(tagString:string):string[]
    {
        let tagList:string[] = [];
        if(tagString.trim().length > 0)
        {
            tagList = tagString.split(',');
            tagList.forEach((thisTag)=>{ thisTag = thisTag.trim(); });
        }
        return tagList;
    }

    //Activities to take after the user has selected a Team from the drop down.  
    private async DoTeamSelect(teamId:string)
    {

        this.setState({loadingWorkItems:true,categories:this.getInitializedCategoryInfo()});
        let teamBacklogLevels:Array<IListBoxItem<{}>> = [];
        let backlogWorkItemTypes:string[] = [];
        try {
            
            
            let teamInfoProm:Promise<WebApiTeam> = this.GetTeam(teamId);
            await this.GetTeamConfig(teamId);
            let backlogConfig:BacklogConfiguration|undefined = this.state.teamBacklogConfig;
            
            if(backlogConfig)
            {
                let c:BacklogLevelConfiguration = backlogConfig.requirementBacklog;
                backlogWorkItemTypes = this.GetWorkItemTypesForBacklog(c);
            }

            await teamInfoProm;
            let dateOffset = this.state.dateOffset;
            await this.DoGetData(backlogWorkItemTypes,dateOffset, this.state.tagExclusions);
            teamBacklogLevels = this.getListOfBacklogLevels();
            this.backlogSelection.select(0);
            let boardColumnData:workItemInterfaces.IBoardColumnStat[] = this.state.boardColumnData;
            let notsetcat = this.GetWorkItemCategory(NOT_SET_NAME);
            
            if(boardColumnData && notsetcat)            
            {
                boardColumnData.forEach((bc)=> {
                    notsetcat.boardColumnNames.push(bc.boardColumn);
                });
            }
        }
        finally
        {
            let backlogLevelConfig:BacklogLevelConfiguration|undefined = undefined;
            if(this.state.teamBacklogConfig)
            {
                backlogLevelConfig = this.state.teamBacklogConfig.requirementBacklog;
            }
            this.setState({loadingWorkItems:false, team:teamId, teamBacklogLevelsList:teamBacklogLevels, backlogLevelConfig: backlogLevelConfig, backlogWorkItemTypes:backlogWorkItemTypes});
            this.DoGetTrendData();
        }
    }


    //Activities to take on when the user has selected a backlog level from the drop down filter
    private async DoBacklogSelect(backlog:string)
    {

        this.setState({loadingWorkItems:true,categories:this.getInitializedCategoryInfo()});
        let backlogConfig:BacklogConfiguration|undefined = this.state.teamBacklogConfig
        
        if(backlogConfig)
        {
            let backlogLevelConfig: BacklogLevelConfiguration = backlogConfig.requirementBacklog;
            if(backlog != "Microsoft.RequirementCategory")
            {
                backlogConfig.portfolioBacklogs.forEach((b) => {
                    if(b.id == backlog)
                    {
                        backlogLevelConfig = b;
                    }
                });
            }
            let workItemTypes:string[] = this.GetWorkItemTypesForBacklog(backlogLevelConfig)
            this.setState({backlogLevelConfig: backlogLevelConfig, backlogWorkItemTypes:workItemTypes});
            await this.DoGetData(workItemTypes,this.state.dateOffset, this.state.tagExclusions);
            
        }
        this.setState({loadingWorkItems:false,categories:this.getInitializedCategoryInfo()});
        this.DoGetTrendData();
    }


    //Takes the backlog configuration information and returns the names of the Work Item types that are a part of the chosen backlog (User Story, PBI, Bug, Feature, Epic.. )
    private GetWorkItemTypesForBacklog(levelConfig:BacklogLevelConfiguration):string[]
    {
        let result:string[] = [];

        
            if(levelConfig)
            {
                levelConfig.workItemTypes.forEach((thisType) => {
                    result.push(thisType.name);
                    
                });
            }

        return result;
    }


    //activities to take when the user selects that date range from the filter bar
    private async DoDateSelect(dateOffset:number)
    {
        this.setState({loadingWorkItems:true});

        let backlogWorkItemTypes:string[] = [];
        
        if(this.state.team != "")
        {            
            if(this.state.backlogLevelConfig != undefined)
            {
                let c:BacklogLevelConfiguration = this.state.backlogLevelConfig;
                backlogWorkItemTypes =  this.GetWorkItemTypesForBacklog(c);
            }
            await this.DoGetData(backlogWorkItemTypes,dateOffset, this.state.tagExclusions);
        }
        this.setState({dateOffset:dateOffset, loadingWorkItems:false});
    }

    ///
    private async DoTagFilter()
    {
        this.setState({loadingWorkItems:true});
        let tagList:string[] = [];
        try
        {
            tagList = this.SplitTagsValue(this.tagListObservable.value);                    
            await this.DoGetData(this.state.backlogWorkItemTypes, this.state.dateOffset, tagList);
        }
        catch(e) 
        {
            console.log("error tag filtering: " + e.toString());
        }
        finally 
        {
            this.setState({loadingWorkItems:false, tagExclusions:tagList});
        

            
        }

    }


    private async DoGetTrendData()
    {
        let oneYearWorkItems:WorkItemReference[] = await this.GetHistoricalTrendWorkItems();

        
        let slices:TrendSlice.IDurationSlice[] = await TrendSlice.GetWorkItemDurationSlices(oneYearWorkItems, getClient(WorkItemTrackingRestClient), this.state.projectName);

        this.setState({workItemClosedSlices:slices});

    }

    //Coordinates the calls to get the Work Item data from ADO and then calls to perform processing and calculations against that information for display and charting
    private async DoGetData(backlogWorkItemTypes:string[], offsetDays:number, tagList:string[])
    {
        
        let workItemsToCalculate:WorkItemReference[] = await this.GetWorkItemsByQuery(backlogWorkItemTypes, offsetDays, tagList);
        let workItemsHistory:workItemInterfaces.IWorkItemWithHistory[] = await this.GetAllWorkItemsHistory(this.getWorkItemIDsForRefs(workItemsToCalculate));
        let calculatedData:workItemInterfaces.IWorkItemStateHistory[] =  this.CalculateBoardColumnTime(workItemsHistory);
        let boardColumns:workItemInterfaces.IBoardColumnStat[] = this.GatherDistinctBoardColumns(calculatedData);
        this.CalculateBoardColumnAverages(boardColumns);
        this.setState({boardColumnData:boardColumns});
        this.CollectAllWorkItemRevisionForTable(calculatedData);
        this.ReDoCategoryCalcs(this.state.categories);
        //this.DoGetTrendData();
    }


    private async GetHistoricalTrendWorkItems(): Promise<WorkItemReference[]>
    {
        let backlogWorkItemTypes:string[] = this.state.backlogWorkItemTypes;
        let offsetDays:number = 365;
        let tagList = this.state.tagExclusions;
        return new Promise<WorkItemReference[]>(async (resolve, reject) => { 
            try {
                let workItemsToCalculate:Promise<WorkItemReference[]> = this.GetWorkItemsByQuery(backlogWorkItemTypes, offsetDays, tagList);
                resolve(workItemsToCalculate);
            }
            catch 
            {
                reject("error while retrieving historical work items");
            }
        });
        
    }



    //takes the array of categories (wait, work, not set) and executes the calls to re-calculate.  As items are changed by the user this function will be called to make sure that the calculated values are correct
    private ReDoCategoryCalcs(categoryInfo: ICategory[])
    {
        let waitCat:ICategory | undefined = categoryInfo.find(c => c.categoryName == WAIT_CAT_NAME);
        let workCat:ICategory | undefined = categoryInfo.find(c => c.categoryName == WORK_CAT_NAME);
        let notSetCat:ICategory | undefined = categoryInfo.find(c => c.categoryName == NOT_SET_NAME);

        if(waitCat)
        {
            waitCat.stats= this.CalculateCategoryColumnAverages(waitCat);
        }
        if(workCat)
        {
            workCat.stats = this.CalculateCategoryColumnAverages(workCat);
        }
        if(notSetCat)
        {
            notSetCat.stats = this.CalculateCategoryColumnAverages(notSetCat);
        }

        this.setState({categories:categoryInfo});

    }

    // GEts the list of Board Columns that were found in the work item history for the work items we are looking at.  
    // We get the board column list this way instead of calling ADO to get the Team's current set of board columns because the columns may have been altered.. but we still want to be able to represent this history properly
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
                        let newBoardColumn:workItemInterfaces.IBoardColumnStat = {boardColumn:thisWIRev.boardColumn, average:0,stdDev:0, total:0, workItemTimes:[], category:this.GetBoardColumnCategory(thisWIRev.boardColumn)};
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


    //Give a board column name this will return then Enum value for the category that it has been assigned to
    private GetBoardColumnCategory(boardColumnName:string):workItemInterfaces.columnCategoryChoices
    {
        let result:workItemInterfaces.columnCategoryChoices = workItemInterfaces.columnCategoryChoices.NotSet;
        try {
            if(this.GetWorkItemCategory(WORK_CAT_NAME).boardColumnNames.find(c=>c == boardColumnName))
            {
                result = workItemInterfaces.columnCategoryChoices.Work;
            }
            else if(this.GetWorkItemCategory(WAIT_CAT_NAME).boardColumnNames.find(c=>c == boardColumnName))
            {
                result = workItemInterfaces.columnCategoryChoices.Wait;
            }
            else if(this.GetWorkItemCategory(NOT_SET_NAME).boardColumnNames.find(c=> c == boardColumnName))
            {
                result = workItemInterfaces.columnCategoryChoices.NotSet;
            }
        }
        catch(ex)
        {
            result = workItemInterfaces.columnCategoryChoices.NotSet;
            console.log("Did not successfully get BoardColumnCategory");
        }
        return result;
    }


    //calculates average and Std Dev for the workitems for a given set of stats.  Used to calculate those metrics for a given board column
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


    //Given one of the categories (Wait, work, Not Set) this will work to process the info and calculate the Averages for that entire category
    private CalculateCategoryColumnAverages(category:ICategory):workItemInterfaces.IBoardColumnStat
    {
        let result:workItemInterfaces.IBoardColumnStat = {boardColumn:"", average:0,stdDev:0, total:0, workItemTimes:[],category:category.categoryType};


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
            result.total = totalTime;
        }
        
        return result;
    }

    private GetCategoryChoiceForName(categoryName:string):workItemInterfaces.columnCategoryChoices
    {
        let result:workItemInterfaces.columnCategoryChoices = workItemInterfaces.columnCategoryChoices.NotSet;

        if(categoryName == WAIT_CAT_NAME)
        {
            result = workItemInterfaces.columnCategoryChoices.Wait;
        }
        else if(categoryName == WORK_CAT_NAME)
        {
            result = workItemInterfaces.columnCategoryChoices.Work;
        }

        return result;
    }


    //Calculates a Standard Deviation for a given array of values
    private getStandardDeviation (array:number[]):number {
        const n = array.length
        const mean = array.reduce((a, b) => a + b) / n
        return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
    }
    

    private getWorkItemIDsForRefs(workItemsToCollect: WorkItemReference[]):number[]
    {
        let result:number[] = [];
        workItemsToCollect.forEach((thisWI) => {
            result.push(thisWI.id);
        });

        return result;
    }


    private getWorkItemIDsForWI(workItemsToCollect: WorkItem[]):number[]
    {
        let result:number[] = [];
        workItemsToCollect.forEach((thisWI) => {
            result.push(thisWI.id);
        });

        return result;
    }


    //Takes in the list of Work Item history we have after we selected down to the the closed Work Items for the team, and then we will call Azure DevOps to 
    // get all of the revision history for each work Item.
    private async GetAllWorkItemsHistory(workItemIds: number[]): Promise<workItemInterfaces.IWorkItemWithHistory[]>
    {
        let workItemRevPromises:Promise<WorkItem[]>[] = [];        
        return new Promise<workItemInterfaces.IWorkItemWithHistory[]>(async (resolve, reject) => { 
            try{ 
                let returnResult:workItemInterfaces.IWorkItemWithHistory[] = [];
                workItemIds.forEach((thisWI) => {
                    let thisPromise:Promise<WorkItem[]> = this.GetWorkItemWithHistory(thisWI);
                    
                    
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
                    this.ProcessWorkItemHistory(thisResult, thisWorkItemDetails);
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
                this.toastError(ex);
                reject(ex);
            }
        });

    }

    ///
    private ProcessWorkItemHistory(thisResult: WorkItem[], thisWorkItemDetails: workItemInterfaces.IWorkItemWithHistory) {
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
    private async GetWorkItemWithHistory(workItemID:number) : Promise<WorkItem[]>
    {
        const client = getClient(WorkItemTrackingRestClient);
        
        return client.getRevisions(workItemID,this.state.projectInfo.id, undefined,undefined,WorkItemExpand.Links)
    }


    private async GetWorkItemDetails(workItemID:number) : Promise<WorkItem>
    {
        const client = getClient(WorkItemTrackingRestClient);
        
        return client.getWorkItem(workItemID,this.state.projectInfo.id, undefined,undefined,WorkItemExpand.Links)
    }



    //Take the items we have collected and calculated and put them in an object that we can use to display the results on a table on the screen
    private CollectAllWorkItemRevisionForTable(history:workItemInterfaces.IWorkItemStateHistory[])
    {
        
        let revs:workItemInterfaces.IWorkItemTableDisplay[] = [];

        history.forEach((thisWI) => {
            thisWI.revisions.forEach((thisRev) =>{
                let duration:TimeCalc.IDuration = TimeCalc.getMillisecondsToTime(thisRev.timeInColumn);
                let durationString:string = duration.days.toString() + " Days, " + duration.hours.toString() + " Hours, " + duration.minutes.toString() + " Minutes, " + duration.seconds.toString() + " Seconds";
                
                let dis:workItemInterfaces.IWorkItemTableDisplay = {workItemID:thisRev.workItemID, workItemTitle: thisRev.workItemTitle, workItemLink:thisWI.htmlLink, revNum:thisRev.revNum, boardColumn:thisRev.boardColumn, boardColumnStartTime: thisRev.boardColumnStartTime.toString(), timeInColumn: durationString}
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
            
            let historyWithTime:workItemInterfaces.IWorkItemStateHistory = {workItemID:thisWI.id,revisions:[], title:thisWI.title.toString(), htmlLink: thisWI.htmlLink}

            let topNdx = thisWI.history.length -1;

            
            for(let i=0; i < thisWI.history.length; i++)
            {
                let thisRev:workItemInterfaces.IWorkItemStateInfo = {workItemID: thisWI.id, workItemTitle:thisWI.title,  revNum:thisWI.history[i].rev,boardColumn:thisWI.history[i].fields["System.BoardColumn"],boardColumnStartTime:thisWI.history[i].fields["System.ChangedDate"],timeInColumn:0}
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
    
    //Day drop down select
    private SelectDays = (event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<{}>) => {

        let d:number = Number.parseInt(item.id);

        this.DoDateSelect(d);
    };


    ///Team drop down Selection
    private  selectTeam = (event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<{}>) =>{


        this.DoTeamSelect(item.id);

    }

    // Backlog drop down select
    private selectBacklog = (event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<{}>) =>{
        this.DoBacklogSelect(item.id);
    }


    //
    private setColumnCategory(boardColumnName:string, category:workItemInterfaces.columnCategoryChoices)
    {
        
        let boardColumnData:workItemInterfaces.IBoardColumnStat[] = this.state.boardColumnData;
        let categoryInfo:ICategory[] = this.state.categories;
        let selectedColumn:workItemInterfaces.IBoardColumnStat | undefined = boardColumnData.find(c=> c.boardColumn == boardColumnName);
        if(selectedColumn != undefined)
        {
            selectedColumn.category = category;
            this.setState({boardColumnData:boardColumnData});

            let waitCat:ICategory | undefined = categoryInfo.find(c => c.categoryName == WAIT_CAT_NAME);
            let workCat:ICategory | undefined = categoryInfo.find(c => c.categoryName == WORK_CAT_NAME);
            let notSetCat:ICategory | undefined = categoryInfo.find(c => c.categoryName == NOT_SET_NAME);
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
                if(notSetCat)
                {
                    let ndx = notSetCat.boardColumnNames.indexOf(boardColumnName);
                    if(ndx > -1)
                    {
                        notSetCat.boardColumnNames.splice(ndx,1);
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
                if(notSetCat)
                {
                    let ndx = notSetCat.boardColumnNames.indexOf(boardColumnName);
                    if(ndx > -1)
                    {
                        notSetCat.boardColumnNames.splice(ndx,1);
                    }
                }
            }
            this.ReDoCategoryCalcs(categoryInfo);

            this.setState({boardColumnData:boardColumnData});

            let slices = this.state.workItemClosedSlices;
            TrendSlice.CalculateDurations(slices, categoryInfo);

        }
        else{
            this.toastError("Unable to find column in collection to set the category");
        }


    }


    private CalculateFlowEfficeincy(waitTimeInfo:ICategory, workTimeInfo:ICategory):number
    {
        let result:number = 0;
        let totalTime:number = waitTimeInfo.stats.total + workTimeInfo.stats.total;
        if(totalTime > 0)
        {
            result = workTimeInfo.stats.total / totalTime;
        }

        return result;
    }


    private GetWorkItemCategory(categoryName:string):ICategory
    {
        let result:ICategory = { categoryName:"",boardColumnNames:[], categoryType:workItemInterfaces.columnCategoryChoices.NotSet, stats:{boardColumn:"",average:0, stdDev:0,  total:0, workItemTimes:[],category:workItemInterfaces.columnCategoryChoices.NotSet}};

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
    private async toastError(toastText:string)
    {
        const globalMessagesSvc = await SDK.getService<IGlobalMessagesService>(CommonServiceIds.GlobalMessagesService);
        globalMessagesSvc.addToast({        
            duration: 3000,
            message: toastText        
        });
        //this.setState({isToastVisible:true, isToastFadingOut:false, exception:toastText})
    }



    private getListOfBacklogLevels():Array<IListBoxItem<{}>>
    {
        let result:Array<IListBoxItem<{}>> =[];

        let teamBacklogConfig:BacklogConfiguration|undefined = this.state.teamBacklogConfig;
        if(teamBacklogConfig != undefined)
        {
            let t:IListBoxItem = {id:teamBacklogConfig.requirementBacklog.id, text:teamBacklogConfig.requirementBacklog.name};
            result.push(t);
            teamBacklogConfig.portfolioBacklogs.forEach((pb)=>{
                t ={id:pb.id, text:pb.name};
                result.push(t);
            });
        }

        return result;
    }

    private tagTextonChange = (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        newValue: string
    ) => {
        this.tagListObservable.value = newValue;
    };

    private tagButtonClick = () => {

        this.DoTagFilter();
        
    }


    //for a given board column generates the List Item object to put in to the List rendered out to the user
    private renderBoardColumnListRow = (
        index: number,
        item: workItemInterfaces.IBoardColumnStat,
        details: IListItemDetails<workItemInterfaces.IBoardColumnStat>,
        key?: string
    ): JSX.Element => {
        let timeObject:TimeCalc.IDuration = TimeCalc.getMillisecondsToTime(item.average);
        let stdDevObject:TimeCalc.IDuration = TimeCalc.getMillisecondsToTime(item.stdDev);
        let keyBoardCol = item.boardColumn
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
            <ListItem key={keyBoardCol || "list-item" + index} index={index} details={details}>
                
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
        let doneLoading = this.state.doneLoading;
        let teamList:Array<IListBoxItem<{}>> = this.state.teamList;
        let backlogLevelList:Array<IListBoxItem<{}>> = this.state.teamBacklogLevelsList;
        let loadingWorkItems:boolean = this.state.loadingWorkItems;
        let requirementName:string = "";
        let selection = new ListSelection(true);        
        let tableItems = new ArrayItemProvider<workItemInterfaces.IWorkItemTableDisplay>(this.state.workItemRevTableData);
        let boardColumnList = new ArrayItemProvider<workItemInterfaces.IBoardColumnStat>(this.state.boardColumnData);
        let workCategoryInfo = this.GetWorkItemCategory(WORK_CAT_NAME);
        let waitCategoryInfo = this.GetWorkItemCategory(WAIT_CAT_NAME);
        let notSetCategoryInfo = this.GetWorkItemCategory(NOT_SET_NAME);
        let workAvgTime:TimeCalc.IDuration = TimeCalc.getMillisecondsToTime(workCategoryInfo.stats.average);
        let waitAvgTime:TimeCalc.IDuration = TimeCalc.getMillisecondsToTime(waitCategoryInfo.stats.average);
        let timeBarData:IBarChartData = GetWaitWorkBarChartData(waitCategoryInfo.stats.average,workCategoryInfo.stats.average);
        let timeWILineData:IBarChartData = GetWorkWaitTimeItemLineChart(this.state.workItemClosedSlices);
        let effLineData:IBarChartData = GetEfficiencyLineChart(this.state.workItemClosedSlices);
        let pieChartData:IChartData = GetWaitWorkPieChartData(waitCategoryInfo.stats.total, workCategoryInfo.stats.total,notSetCategoryInfo.stats.total);
        let flowEfficiency:string = (this.CalculateFlowEfficeincy(waitCategoryInfo, workCategoryInfo) * 100).toFixed(2).toString();


        if(this.state.teamBacklogConfig) {requirementName = this.state.teamBacklogConfig.requirementBacklog.name;}
        if(doneLoading) {
            if(!loadingWorkItems){
            return (
                <Page className="flex-grow prinfo-hub">
                    <Card className="selectionCard flex-row" titleProps={{text: "Selections"}} >                        
                        <div className="flex-cell" style={{ flexWrap: "wrap", textAlign:"left", minWidth:"325px", minHeight:""}}>
                            <FormItem className="teamDropDownFF" label="Team: " message="Select the team you want to examine the board for">
                                <Dropdown items={teamList} placeholder="Select a Team" ariaLabel="Basic" className="teamDropDown" onSelect={this.selectTeam} /> 
                            </FormItem>
                        </div>
                        <div className="flex-cell" style={{ flexWrap: "wrap", textAlign:"left", minWidth:"270px"}}>
                            <FormItem className="backlogDropDownFF" label="Backlog Level: &nbsp;" message="Choose which board you'd like to look at">    
                                <Dropdown items={backlogLevelList} ariaLabel="Basic" className="backlogDropDown" selection={this.backlogSelection} onSelect={this.selectBacklog} />
                            </FormItem>
                        </div>
                        <div className="flex-cell" style={{ flexWrap: "wrap", textAlign:"left", minWidth:"220px"}}>
                        <FormItem className="daysDropDownFF" label="Work Items Closed in: &nbsp;" message="Select the timeframe you want to look at">    
                            <Dropdown ariaLabel="Basic" className="daysDropDown" items={this.dateSelectionChoices} selection={this.dateSelection} onSelect={this.SelectDays} />  
                        </FormItem>
                        </div>
                        <div className="flex-cell" style={{ flexWrap: "wrap", textAlign:"left", minWidth:"400px"}}>
                        <FormItem className="tagsTextFF" label="Work Item Tags to Exclude : &nbsp;" message="Comma separated list of tags you don't want included in the calculation">
                            <TextField  ariaLabel="Basic" className="tagsTextField" value={this.tagListObservable} placeholder="Tag list (ex. 'outlier')" onChange={this.tagTextonChange} />  
                           
                        </FormItem>
                        <Button
                            text="Apply Tag Filter"
                            primary={false}
                            onClick={this.tagButtonClick}                            
                        />
                        </div>
                        
                    </Card>
                    <Card className="mainDisplayArea flex-row">
                                
                                <div  className="listColumnCard flex-column">
                                    <Card>
                                    <ScrollableList
                                        itemProvider={boardColumnList}
                                        renderRow={this.renderBoardColumnListRow}
                                        selection={selection}
                                        width="450px"
                                        className="flex-cell"
                                    />    
                                    </Card>
                                
                                </div>
                                
                                <div className="flex-column categoryColumnArea">
                                <div className="flex-row" style={{width:"100%"}}>
                                        <div>
                                            <Card className="flex-column flex-grow efficiencyColumnCard" titleProps={{text:"Flow Efficiency %"}}>
                                                <div className="flex-grow" style={{minWidth:"190px"}}>
                                                <table>
                                                    <tbody>
                                                    <tr>
                                                        <td>
                                                        <div className="flex-grow efficiencyText flex-row">                                                    
                                                            {flowEfficiency}%
                                                        </div>
                                                        </td>
                                                    </tr>
                                                    
                                                    <tr>
                                                        <td>
                                                        <div className="body-s flex-row">
                                                            Calculated as Work Time / (Work Time + Wait Time)
                                                        </div>
                                                        </td>
                                                    </tr>
                                                    </tbody>
                                                </table>
                                                </div>
                                                <div  className="flex-grow" style={{minWidth:"310px"}}>
                                                    <table>
                                                        <tbody>
                                                            <tr>
                                                                <td>Efficiency Trend Chart</td>
                                                            </tr>
                                                            <tr>
                                                                <td>
                                                                <Bar data={effLineData} options={BarCharOptions} height={270}/>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                    
                                                </div>
                                                <div  className="flex-grow" style={{minWidth:"310px"}}>
                                                    <table>
                                                        <tbody>
                                                            <tr>
                                                                <td>Wait Work Time Chart</td>
                                                            </tr>
                                                            <tr>
                                                                <td>
                                                                <Bar data={timeWILineData} options={BarCharOptions} height={270}/>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                    
                                                </div>
                                            </Card>
                                        </div>
                                    </div>
                                    <div className="flex-row" style={{width:"100%"}}>
                                        <div>
                                            <Card className="flex-column flex-grow chartColumnCard" titleProps={{text:"Wait Work Charts for Selected Time Period"}}>
                                                <div className="flex-grow">
                                                <Bar data={timeBarData} options={BarCharOptions} height={250}/>
                                                </div>
                                                
                                                <div  className="flex-grow" style={{minWidth:"450px"}}>
                                                <Doughnut data={pieChartData} height={150} />
                                                </div>
                                                

                                            </Card>
                                        </div>
                                    </div>
                                    <div className="flex-row">
                                        <div className="flex-column categoryAveagesArea">
                                            <div className="flex-row">
                                                <Card className="flex-column categoryColumnCard">
                                                    <table className="cat-table">
                                                        <tbody>
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
                                                        </tbody>
                                                    </table>
                                                </Card>
                                                <Card className="flex-column categoryColumnCard">
                                                                                        
                                                    <table className="cat-table">
                                                        <tbody>
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
                                                        </tbody>
                                                    </table>
                                                
                                                </Card>
                                            </div>
                                        </div>
                                    </div>
                                    

                                </div>
                                
                    </Card>
                    <Card collapsible={true} collapsed={this.state.detailsCollapsed} titleProps={{ text: "Work Item Details" }} onCollapseClick={this.detailsTableCollapseClick}>
                        
                        <Table 
                        ariaLabel="Work Item Table"
                        columns={WITableSetup.workItemColumns}
                        itemProvider={tableItems}
                        role="table"
                        className="wiTable"
                        containerClassName="v-scroll-auto"
                        />
                        
                    </Card>
                    


                </Page>
            );
            } //loadingWorkitems
            else {
                return (
                    <Page className="flex-grow prinfo-hub">
                    <Card className="selectionCard flex-row" titleProps={{text: "Selections"}} >
                        <div className="flex-cell" style={{ flexWrap: "wrap", textAlign:"left", minWidth:"325px"}}>
                            <FormItem className="teamDropDownFF" label="Team: " message="Select the team you want to examine the board for">
                                <Dropdown items={teamList} placeholder="Select a Team" ariaLabel="Basic" className="teamDropDown" onSelect={this.selectTeam} /> 
                            </FormItem>
                        </div>
                    </Card>

                    <Card>
                        
                    <Spinner label="Loading ..." size={SpinnerSize.large} />
                        
                    </Card>
                    


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