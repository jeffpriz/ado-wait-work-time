import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import * as API from "azure-devops-extension-api";
import { showRootComponent } from "../../Common";
import { Page } from "azure-devops-ui/Page";
import { Card } from "azure-devops-ui/Card";
import { Toast } from "azure-devops-ui/Toast";
import {Dropdown} from "azure-devops-ui/Dropdown";
import { Spinner, SpinnerSize } from "azure-devops-ui/Spinner";
import { Header, TitleSize } from "azure-devops-ui/Header";
import { CommonServiceIds, IProjectPageService, IHostNavigationService, INavigationElement, IPageRoute, getClient } from "azure-devops-extension-api";
import {WorkRestClient, BacklogConfiguration, TeamFieldValues} from "azure-devops-extension-api/Work";
import { IWorkItemFormNavigationService, WorkItemTrackingRestClient, WorkItemTrackingServiceIds, ReportingWorkItemRevisionsBatch, ReportingRevisionsExpand } from "azure-devops-extension-api/WorkItemTracking";
import {CoreRestClient, WebApiTeam, TeamContext } from "azure-devops-extension-api/Core";
import * as workItemInterfaces from "./WorkItemInfo";
import { IListBoxItem, ListBoxItemType } from "azure-devops-ui/ListBox";


interface IWorkItemTimeContentState {
    projectInfo: API.IProjectInfo 
    projectName: string;
    teamBacklogConfig:BacklogConfiguration|undefined;
    teamList: Array<IListBoxItem<{}>>;
    workItemRevs?: ReportingWorkItemRevisionsBatch,
    workItemHistory:workItemInterfaces.IWorkItemStateHistory[],
    team: string;
    isToastVisible: boolean;
    isToastFadingOut: boolean;
    foundCompletedPRs: boolean;
    doneLoading:boolean;
    exception:string;
}
class WorkItemTimeContent extends React.Component<{}, IWorkItemTimeContentState> {

    private toastRef: React.RefObject<Toast> = React.createRef<Toast>();

    constructor(props:{}) {
        super(props);
        
        let initState:IWorkItemTimeContentState = {projectInfo:{id:"", name:""}, projectName:"",team:"",isToastVisible :false, isToastFadingOut:false, foundCompletedPRs: false, doneLoading: false, exception:"", teamList:[], workItemRevs:undefined, teamBacklogConfig:undefined, workItemHistory:[]};
        this.state = initState;

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
                this.setState({ projectName: project.name, doneLoading:true });
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
                backlogConfig.requirementBacklog.workItemTypes.forEach((thistype)=> {
                    console.log("the team has " + thistype["name"] + " on the backlog");
                });
                this.setState({teamBacklogConfig:backlogConfig});

            }
        }
        catch(ex){
            this.toastError(ex.toString());
        }
    }


    ///GetWorkItemReporting -- gets the list of workitem revisions
    private async GetWorkItemReporting(workItemTypes:string[]) {
        await SDK.ready();
        try {
             
            const client = getClient(WorkItemTrackingRestClient);
            let projectID = ""
            const project: API.IProjectInfo | undefined = this.state.projectInfo;
            if(project) { projectID = project.id;}
            let wirepRevs:ReportingWorkItemRevisionsBatch = await client.readReportingRevisionsGet(projectID,["System.NodeName","System.Rev","System.WorkItemType","System.State","System.CreatedDate","System.ChangedDate","System.BoardColumn"] , workItemTypes);
            this.setState({workItemRevs:wirepRevs});
            //this.CollectWorkItemRevisions();
        }
        catch(ex)
        {
            this.toastError(ex.toString());
            
        }
    }


    private async CollectWorkItemRevisions()
    {
        if(this.state.workItemRevs)
        {
            let currentRevs:ReportingWorkItemRevisionsBatch = this.state.workItemRevs;
            
            let storedRevs:workItemInterfaces.IWorkItemStateHistory[] = this.state.workItemHistory;

            storedRevs = [];

            currentRevs.values.forEach((r) => {
                let existing = storedRevs.find(wi=>wi.workItemID === r.id)
                let workItemType:string ="?";

                try{
                    workItemType = r.fields["System.WorkItemType"];

                    console.log("witype " + workItemType.toString() + " -- " + r.fields["System.WorkItemType"]);

                }
                catch(ex){
                    console.log("couldn't get the workitem type that way");
                }

                let revision:workItemInterfaces.IWorkItemStateInfo = {workItemID:r.id, revNum:r.rev, boardColumn:r.fields["System.BoardColumn"], boardColumnStartTime:r.fields["System.ChangedDate"]}
                if(existing)
                {
                    console.log("we already have the workitem, so we should add a rev to the array");
                      
                    let currentDate = new Date();
                    existing.revisions.push(revision);
                }
                else
                {
                    console.log("We don't yet have this work item in our stored list so we will create an instance and push it to the array");
                    let newWI:workItemInterfaces.IWorkItemStateHistory = {workItemID:r.id, revisions:[]};                                                
                    newWI.revisions.push(revision);
                    storedRevs.push(newWI);
                }
                

            });

            this.setState({workItemHistory:storedRevs});

        }
    }

    private async DoTeamSelect(teamId:string)
    {
        let backlogWorkItemTypes:string[] = [];
        await this.GetTeamConfig(teamId);
        let backlogConfig:BacklogConfiguration|undefined = this.state.teamBacklogConfig
        if(backlogConfig)
        {
            backlogConfig.requirementBacklog.workItemTypes.forEach((thisType) => {
              backlogWorkItemTypes.push(thisType.name);
                
            });
        }

        await this.GetWorkItemReporting(backlogWorkItemTypes);
        await this.CollectWorkItemRevisions();
    }





    ///Team Selection
    private  selectTeam = (event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<{}>) =>{


        this.DoTeamSelect(item.id);

    }



    ///Toast Error
    private toastError(toastText:string)
    {
        this.setState({isToastVisible:true, isToastFadingOut:false, exception:toastText})
    }



    public render(): JSX.Element {
        let projectName = this.state.projectName;
        let isToastVisible = this.state.isToastVisible;
        let exception = this.state.exception;
        let doneLoading = this.state.doneLoading;
        let teamList:Array<IListBoxItem<{}>> = this.state.teamList;
        let workItemRevs:string = ""
        if(this.state.workItemRevs) { workItemRevs = this.state.workItemRevs.values.length.toString();}
        let requirementName:string = ""
        if(this.state.teamBacklogConfig) {requirementName = this.state.teamBacklogConfig.requirementBacklog.name;}
        if(doneLoading) {

            return (
                <Page className="flex-grow prinfo-hub">
                    <Card titleProps={{text: "Team"}}>
                        <div className="page-content page-content-top flex-column rhythm-vertical-16">
                            <div>   Hello! {projectName} </div>
                        </div>

                        <div className="flex-cell" style={{ flexWrap: "wrap", textAlign:"center", minWidth:"500px"}}>
                            Teams: <Dropdown items={teamList} placeholder="Select a Team" ariaLabel="Basic" className="teamDropDown" onSelect={this.selectTeam} />
                        </div>
                        <div>
                            {workItemRevs}
                        </div>
                        <div>Team Backlog Name:  {requirementName}</div>
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
        }
        else
        {
            return(                      
                <Page className="flex-grow">                    
                        <Header title="WORK ITEM Hello World" titleSize={TitleSize.Large} />
                        <Card className="flex-grow flex-center bolt-table-card" contentProps={{ contentPadding: true }}>                            
                            <div className="flex-cell">
                                <Spinner label="Loading ..." size={SpinnerSize.large} />
                            </div>          
                        </Card>
                    </Page>
            );
        }

        

    }
}

showRootComponent(<WorkItemTimeContent />);