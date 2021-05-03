import { ISimpleTableCell } from "azure-devops-ui/Table";
import {WorkItem } from "azure-devops-extension-api/WorkItemTracking";
export interface IWorkItemStateInfo
{
    workItemID:number,
    revNum: number,
    boardColumn:string,
    boardColumnStartTime:Date,
    timeInColumn:number;
    workItemTitle:string
}

export interface IWorkItemWithHistory
{
    id: number,
    title: string,
    htmlLink: string,
    history:WorkItem[]
}

export interface IWorkItemTableDisplay extends ISimpleTableCell
{
    workItemID:number,
    workItemTitle:string,
    workItemLink:string,
    revNum: number,
    boardColumn:string,
    boardColumnStartTime:string,
    timeInColumn:string
}

export interface IWorkItemStateHistory
{
    workItemID:number,
    title: string,
    htmlLink: string,
    revisions:IWorkItemStateInfo[]
}

export interface IBoardColumnStat
{
    boardColumn:string,
    average:number,
    stdDev:any,
    total:number,
    workItemTimes:IBoardColumnWorkItemTime[];
    category:columnCategoryChoices
}

export enum columnCategoryChoices{ NotSet, Wait, Work}
export interface IBoardColumnWorkItemTime
{
    wiID:number, 
    columnTime:number
}

export function CompareWorkItemStateRev(wi1: IWorkItemStateInfo, wi2:IWorkItemStateInfo)
{
    if(wi1.revNum > wi2.revNum) {return -1;}
    if(wi1.revNum < wi2.revNum) {return 1;}
}