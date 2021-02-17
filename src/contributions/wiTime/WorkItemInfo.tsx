
export interface IWorkItemStateInfo
{
    workItemID:number,
    revNum: number,
    boardColumn:string,
    boardColumnStartTime:Date,
}

export interface IWorkItemStateHistory
{
    workItemID:number,
    revisions:IWorkItemStateInfo[]
}