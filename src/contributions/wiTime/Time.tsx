
export interface IDurationSlice
{
    startDate:Date,
    Count:number,
    minutes:number,
    runningTotalMinutes:number,
    runningTotalCount:number
}

export interface IDuration
{
    days:number,
    hours:number,
    minutes:number,
    seconds:number,
    milliseconds:number
}

export function getMillisecondsToTime(duration:number):IDuration {    
        let remain = duration
      
        let days = Math.floor(remain / (1000 * 60 * 60 * 24))
        remain = remain % (1000 * 60 * 60 * 24)
      
        let hours = Math.floor(remain / (1000 * 60 * 60))
        remain = remain % (1000 * 60 * 60)
      
        let minutes = Math.floor(remain / (1000 * 60))
        remain = remain % (1000 * 60)
      
        let seconds = Math.floor(remain / (1000))
        remain = remain % (1000)
      
        let milliseconds = remain
      
        return {
          days,
          hours,
          minutes,
          seconds,
          milliseconds
        }; 

  }