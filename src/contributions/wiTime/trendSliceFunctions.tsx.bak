import { WorkItemTrackingRestClient,  WorkItem, WorkItemQueryResult, Wiql, WorkItemReference, WorkItemExpand } from "azure-devops-extension-api/WorkItemTracking";
import * as GetWorkItems from './GetWorkItems';
import { IDuration } from "./Time";
import * as workItemInterfaces from "./WorkItemInfo";
import {ICategory, WAIT_CAT_NAME, WORK_CAT_NAME, NOT_SET_NAME } from './wiTime'

export interface IDurationSlice
{
    startDate:Date,
    closeWICount:number,
    workItemList:WorkItem[],
    workItemsWithColumnTimes:workItemInterfaces.IWorkItemStateHistory[],
    totWaitTime:number,
    totWorkTime:number,
    totNotSetTime:number
}


export async function GetWorkItemDurationSlices(workItemList:WorkItemReference[], client:WorkItemTrackingRestClient, projectName:string):Promise<IDurationSlice[]>
{
    let slices:IDurationSlice[] = [];
    let ndx:number = workItemList.length-1;

    return new Promise<IDurationSlice[]>(async (resolve,reject) => {
        try 
        {       
            let wiDetails:WorkItem[] = []
            if(workItemList.length > 0)
            {
                wiDetails = await GetWorkItems.GetWorkItemDetailsBatch(client, projectName, workItemList);
                wiDetails = wiDetails.sort(dateSort);            
                slices = getClosedWorkItemSlices(wiDetails,14);
                getWorkItemTimesForSlices(slices,projectName);
            }
            resolve(slices);
        }
        catch(ex)
        {
            reject(ex);
        }
    });
}

export function getLastMonday():Date
{ 
  var prevMonday = new Date();
  prevMonday.setDate(prevMonday.getDate() - (prevMonday.getDay() + 6) % 7);

  return prevMonday;

}


export function getMondayBeforeEarliestWI(workItems:WorkItem[]):Date
{
  
  let earliestPR:Date = getDateofEarliestWI(workItems);
  let thisMonday = getLastMonday();       
  do {
      
      thisMonday = new Date(thisMonday.setDate((thisMonday.getDate() - 7)));
  
  } while(thisMonday >  earliestPR)
  
  return thisMonday;
}


export function getDateofEarliestWI(workItems:WorkItem[]):Date
{
      let returnDate:Date = new Date();

      workItems.forEach(thisWI => {
        let thisWIClosedDate:Date = thisWI.fields["Microsoft.VSTS.Common.ClosedDate"];
          if(thisWIClosedDate < returnDate)
          {
              returnDate = thisWIClosedDate;
          }
      });
      return returnDate;
  

}



export function CalculateDurations(slices:IDurationSlice[], categories:ICategory[])
{
    let waitCat:ICategory | undefined = categories.find(c => c.categoryName == WAIT_CAT_NAME);
    let workCat:ICategory | undefined = categories.find(c => c.categoryName == WORK_CAT_NAME);
    let notSetCat:ICategory | undefined = categories.find(c => c.categoryName == NOT_SET_NAME);

    slices.forEach((thisSlice)=>{

        if(workCat)
        {
            thisSlice.totWorkTime = CalculateDurationCategoryTime(thisSlice, workCat);
        }

        if(waitCat)
        {
            thisSlice.totWaitTime = CalculateDurationCategoryTime(thisSlice, waitCat);   
        }

        if(notSetCat)
        {
            thisSlice.totNotSetTime = CalculateDurationCategoryTime(thisSlice, notSetCat);
        }

    });
}

export function CalculateDurationCategoryTime(slice:IDurationSlice, category:ICategory):number
{
    let resultTime:number =0;

    slice.workItemsWithColumnTimes.forEach((thisWI)=>{

        thisWI.revisions.forEach((thisRev) => {

            category.boardColumnNames.forEach((catCol)=>{
                if(thisRev.boardColumn == catCol)
                {
                    resultTime += thisRev.timeInColumn;
                }
            });
        });
        
    });

    return resultTime;

}

export async function getWorkItemTimesForSlices(slices:IDurationSlice[], projectName:string)
{

    let ndx:number=0;
    for(ndx =0; ndx < slices.length; ndx++)
    {
        slices[ndx].workItemsWithColumnTimes = await calculateThisSlice(slices[ndx], projectName);
    }

}


export  async function calculateThisSlice(thisSlice:IDurationSlice, projectName:string):Promise<workItemInterfaces.IWorkItemStateHistory[]>
{

    let result:workItemInterfaces.IWorkItemStateHistory[] = []
    let wiIDs: number[] = GetWorkItems.getWorkItemIDsForWI(thisSlice.workItemList);

    return new Promise<workItemInterfaces.IWorkItemStateHistory[]>(async (resolve,reject) => {
        
        try{
            let wiWithHistory:workItemInterfaces.IWorkItemWithHistory[] = await GetWorkItems.GetAllWorkItemsHistory(wiIDs,projectName);


            result = CalculateBoardColumnTime(wiWithHistory);

            resolve(result);
        }
        catch(ex)
        {
            reject("Error calculating slice history");
        }
    });



}

export function getClosedWorkItemSlices(workItems:WorkItem[], sliceDurationDays:number):IDurationSlice[]
{

  let slices:IDurationSlice[] = [];
  let ndx:number = 0;
  let itemsCount = workItems.length-1;
  let sliceDate:Date = getMondayBeforeEarliestWI(workItems);
  let mathDate:Date = new Date(sliceDate);

  //console.log("the date of the first work item now " + workItems[0].fields["Microsoft.VSTS.Common.ClosedDate"]);
  //console.log("monday before earliest PR: " + sliceDate.toLocaleString());
  //console.log("PR NDX " + ndx.toString());
  if(itemsCount >= 0)
  {
      let newSlice:IDurationSlice = {startDate:sliceDate,closeWICount:0, workItemList:[], workItemsWithColumnTimes:[], totNotSetTime:0, totWorkTime:0,totWaitTime:0};
      let nextSliceDate:Date =new Date(mathDate.setDate((mathDate.getDate() + sliceDurationDays)));
      //console.log("newsliceDate : " + sliceDate.toLocaleString() + "   next sliceDate : " + nextSliceDate.toLocaleString());
      do
      {
          let addedSlice:boolean = false;
          let isthisWIinSlice:boolean =false;
          let thisWI:WorkItem = workItems[ndx];
          //console.log(thisPR.closedDate.toLocaleString());
          let thisWIClosedDate:Date = thisWI.fields["Microsoft.VSTS.Common.ClosedDate"];
          if(thisWIClosedDate > nextSliceDate) // we have a PR that goes to a future slice, we're done with the current slice.
          {
              //console.log("new slice push");
              slices.push({startDate: newSlice.startDate, closeWICount:newSlice.closeWICount, workItemList:newSlice.workItemList, workItemsWithColumnTimes:[], totWaitTime:0, totWorkTime:0, totNotSetTime:0});                
              sliceDate = new Date(nextSliceDate);

              newSlice = {startDate:sliceDate, closeWICount:0, workItemList:[], workItemsWithColumnTimes:[],totWaitTime:0, totWorkTime:0, totNotSetTime:0};
              mathDate = new Date(sliceDate);
              nextSliceDate = new Date(mathDate.setDate((mathDate.getDate() + sliceDurationDays)));               
              addedSlice = true;
              //console.log("newsliceDate : " + sliceDate.toLocaleString() + "   next sliceDate : " + nextSliceDate.toLocaleString());
          }
          //console.log("this Close: " + thisWIClosedDate + "  ---  This Slice " + sliceDate +  " ---  next slice " + nextSliceDate );
          if(thisWIClosedDate > sliceDate && thisWIClosedDate < nextSliceDate)
          {
              //console.log("adding this WI to the slice --");
              newSlice.closeWICount +=1;             
              newSlice.workItemList.push(workItems[ndx]);
              isthisWIinSlice = true;
          }
          
          if(addedSlice && !isthisWIinSlice)
          {

          }
          else
          {
              ndx ++;
          }
          
          

      }
      while(ndx<=itemsCount);
      slices.push({startDate: newSlice.startDate, closeWICount:newSlice.closeWICount, workItemList:newSlice.workItemList, workItemsWithColumnTimes:[],totWaitTime:0, totWorkTime:0, totNotSetTime:0});                
  }   
  return slices;

}



    //take the list of Work Item with revisions that we've collected and now lets' iterate through and calculate the time that the work item has been in that board column
    export function CalculateBoardColumnTime(data:workItemInterfaces.IWorkItemWithHistory[]):workItemInterfaces.IWorkItemStateHistory[]
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

    export function CalculateFlowEfficeincy(workTime:number, watiTime:number):number
    {
        let result:number = 0;
        let totalTime:number = workTime + watiTime;
        if(totalTime > 0)
        {
            result = workTime / totalTime;
        }

        return result;
    }

export function sliceDateSort(a:IDurationSlice, b:IDurationSlice)
{
    var key1 = a.startDate;
    var key2 = b.startDate;

    if (key1 < key2) {
        return -1;
    } else if (key1 == key2) {
        return 0;
    } else {
        return 1;
    }
}

export function dateSort(a:WorkItem, b:WorkItem) {
    var key1 = a.fields["Microsoft.VSTS.Common.ClosedDate"]
    var key2 = b.fields["Microsoft.VSTS.Common.ClosedDate"];

    if (key1 < key2) {
        return -1;
    } else if (key1 == key2) {
        return 0;
    } else {
        return 1;
    }
  }