export var WaitColumnColor = "rgb(255, 235, 124)";
export var WorkColumnColor = "royalblue";
export var NotSetColor ="darkgrey";

export interface IBarChartDataset
{
    type:string,
    label:string,
    data:number[],
    backgroundColor:string,
    fill:boolean
}
export interface IChartDataset
{
    data:number[],
    backgroundColor:string[]
}
export interface IChartData
{
    labels:string[],
    datasets:IChartDataset[]
}

export interface IBarChartData
{
    labels:string[],
    datasets:IBarChartDataset[]
}

export function GetWaitWorkBarChartData(waittime:number, worktime:number): IBarChartData
{

    let result:IBarChartData = {labels:[], datasets:[]};

    result.labels.push("Average Time in Hours");
    
    let waitHrs = Number.parseFloat(Math.floor(waittime / 1000 / 60/ 60).toFixed(2))
    let workHrs = Number.parseFloat(Math.floor(worktime / 1000 / 60/ 60).toFixed(2))

    let waitData:IBarChartDataset = {label:"Wait", type:"bar", fill:true,backgroundColor:WaitColumnColor,data:[waitHrs]};
    let workData:IBarChartDataset = {label:"Work", type:"bar", fill:true,backgroundColor:WorkColumnColor,data:[workHrs]};
    result.datasets.push(waitData);
    result.datasets.push(workData);
    return result;
}

export function GetWaitWorkPieChartData(waittime:number, worktime:number, notsettime:number):IChartData
{

    let result:IChartData = {labels:[], datasets:[]};

    //result.labels.push("Time in Hours");

    result.labels.push("Total Wait Time (days)");
    result.labels.push("Total Work Time (days)");
    result.labels.push("Total Not Set Time (days)");
    let waitHrs = Number.parseFloat(Math.floor(waittime / 1000 / 60/ 60 / 24).toFixed(2))
    let workHrs = Number.parseFloat(Math.floor(worktime / 1000 / 60/ 60 / 24).toFixed(2))
    let notSetHrs = Number.parseFloat(Math.floor(notsettime / 1000 / 60/ 60 / 24).toFixed(2))
    let data:IChartDataset = {data:[waitHrs,workHrs,notSetHrs], backgroundColor:[WaitColumnColor,WorkColumnColor, NotSetColor]}

    result.datasets.push(data);

    return result;
}