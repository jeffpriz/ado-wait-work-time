import * as trendSliceFunctions from './trendSliceFunctions';

export var WaitColumnColor = "rgb(255, 235, 124)";
export var WorkColumnColor = "royalblue";
export var NotSetColor ="darkgrey";

export var RunningAverageChartColor = "#FF8833";

export interface ILineChartDataset
{
    type:string,
    label:string,
    data:number[],
    backgroundColor:string,
    borderColor:string,
    fill:boolean
}
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

export const BarCharOptions = {
    scales: {
      yAxes: [
        {
          ticks: {
            beginAtZero: true,
          },
        },
      ],
    },
  }

export function GetWaitWorkPieChartData(waittime:number, worktime:number, notsettime:number):IChartData
{

    let result:IChartData = {labels:[], datasets:[]};
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


export function GetWorkWaitTimeItemLineChart(data:trendSliceFunctions.IDurationSlice[]):IBarChartData
{
    var d:IBarChartData = {labels:[], datasets:[]};
    var WaitWorkItemsDataset:ILineChartDataset={type:"line", label:"Wait Time", backgroundColor:RunningAverageChartColor, borderColor:WaitColumnColor, data:[], fill:false};
    var WorkWorkItemsDataset:ILineChartDataset={type:"line", label:"Work Time", backgroundColor:RunningAverageChartColor, borderColor:WorkColumnColor, data:[], fill:false};

    

    data.forEach((thisSlice)=>{
      d.labels.push(thisSlice.startDate.toLocaleDateString())
      let waitTimehrs = Number.parseFloat(Math.floor(thisSlice.totWaitTime / 1000 / 60/ 60 / 24).toFixed(2))
      let workTiemhrs = Number.parseFloat(Math.floor(thisSlice.totWorkTime / 1000 / 60/ 60 / 24).toFixed(2))
      WaitWorkItemsDataset.data.push(waitTimehrs);
      WorkWorkItemsDataset.data.push(workTiemhrs);
    });
    d.datasets.push(WaitWorkItemsDataset);
    d.datasets.push(WorkWorkItemsDataset);
    return d;
}



export function GetEfficiencyLineChart(data:trendSliceFunctions.IDurationSlice[]):IBarChartData
{
    var d:IBarChartData = {labels:[], datasets:[]};
    var RunningItemsDataset:ILineChartDataset={type:"line", label:"Running Efficiency", backgroundColor:RunningAverageChartColor, borderColor:WorkColumnColor, data:[], fill:false};
    var ThisSliceItemsDataset:ILineChartDataset={type:"line", label:"Efficiency In This 2 weeks", backgroundColor:RunningAverageChartColor, borderColor:WaitColumnColor, data:[], fill:false};

    let sortedSlices:trendSliceFunctions.IDurationSlice[] = data.sort(trendSliceFunctions.sliceDateSort);
    
    let runningWorkTot:number = 0;
    let runningWaitTot:number =0;
    sortedSlices.forEach((thisSlice)=>{
      d.labels.push(thisSlice.startDate.toLocaleDateString())
      
      let thisSliceEfficiency:number = trendSliceFunctions.CalculateFlowEfficeincy(thisSlice.totWorkTime,thisSlice.totWaitTime);
      thisSliceEfficiency = parseFloat((thisSliceEfficiency*100).toFixed(2));
      ThisSliceItemsDataset.data.push(thisSliceEfficiency);

      runningWorkTot += thisSlice.totWorkTime;
      runningWaitTot += thisSlice.totWaitTime;
      let runningSliceEfficiency = trendSliceFunctions.CalculateFlowEfficeincy(runningWorkTot, runningWaitTot);
      runningSliceEfficiency = parseFloat((runningSliceEfficiency*100).toFixed(2));
      RunningItemsDataset.data.push((runningSliceEfficiency));
    });
    d.datasets.push(ThisSliceItemsDataset);
    d.datasets.push(RunningItemsDataset);
    return d;
}