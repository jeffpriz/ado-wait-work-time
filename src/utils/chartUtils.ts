/**
 * Chart data generation and configuration utilities
 */

/**
 * Chart color constants
 */
export const WAIT_COLUMN_COLOR = "rgb(255, 235, 124)";
export const WORK_COLUMN_COLOR = "royalblue";
export const NOT_SET_COLOR = "darkgrey";
export const RUNNING_AVERAGE_CHART_COLOR = "#FF8833";

/**
 * Dataset configuration for line charts
 */
export interface ILineChartDataset {
  type: string;
  label: string;
  data: number[];
  backgroundColor: string;
  borderColor: string;
  fill: boolean;
}

/**
 * Dataset configuration for bar charts
 */
export interface IBarChartDataset {
  type: string;
  label: string;
  data: number[];
  backgroundColor: string;
  fill: boolean;
}

/**
 * Dataset configuration for pie/doughnut charts
 */
export interface IChartDataset {
  data: number[];
  backgroundColor: string[];
}

/**
 * Chart data structure for pie/doughnut charts
 */
export interface IChartData {
  labels: string[];
  datasets: IChartDataset[];
}

/**
 * Chart data structure for bar/line charts
 */
export interface IBarChartData {
  labels: string[];
  datasets: IBarChartDataset[];
}

/**
 * Configuration options for bar charts
 */
export const BAR_CHART_OPTIONS = {
  scales: {
    yAxes: [
      {
        ticks: {
          beginAtZero: true,
        },
      },
    ],
  },
};

/**
 * Converts milliseconds to hours
 * @param milliseconds - Time in milliseconds
 * @returns Time in hours, floored and rounded to 2 decimals
 */
const millisecondsToHours = (milliseconds: number): number => {
  return Number.parseFloat(Math.floor(milliseconds / 1000 / 60 / 60).toFixed(2));
};

/**
 * Converts milliseconds to days
 * @param milliseconds - Time in milliseconds
 * @returns Time in days, floored and rounded to 2 decimals
 */
const millisecondsToDays = (milliseconds: number): number => {
  return Number.parseFloat(
    Math.floor(milliseconds / 1000 / 60 / 60 / 24).toFixed(2)
  );
};

/**
 * Generates bar chart data comparing wait and work times
 * @param waitTime - Total wait time in milliseconds
 * @param workTime - Total work time in milliseconds
 * @returns Chart data structure for bar chart
 */
export const getWaitWorkBarChartData = (
  waitTime: number,
  workTime: number
): IBarChartData => {
  const waitHrs = millisecondsToHours(waitTime);
  const workHrs = millisecondsToHours(workTime);

  const waitData: IBarChartDataset = {
    label: "Wait",
    type: "bar",
    fill: true,
    backgroundColor: WAIT_COLUMN_COLOR,
    data: [waitHrs],
  };

  const workData: IBarChartDataset = {
    label: "Work",
    type: "bar",
    fill: true,
    backgroundColor: WORK_COLUMN_COLOR,
    data: [workHrs],
  };

  return {
    labels: ["Average Time in Hours"],
    datasets: [waitData, workData],
  };
};

/**
 * Generates pie chart data showing time distribution
 * @param waitTime - Total wait time in milliseconds
 * @param workTime - Total work time in milliseconds
 * @param notSetTime - Total not set time in milliseconds
 * @returns Chart data structure for pie/doughnut chart
 */
export const getWaitWorkPieChartData = (
  waitTime: number,
  workTime: number,
  notSetTime: number
): IChartData => {
  const waitDays = millisecondsToDays(waitTime);
  const workDays = millisecondsToDays(workTime);
  const notSetDays = millisecondsToDays(notSetTime);

  const data: IChartDataset = {
    data: [waitDays, workDays, notSetDays],
    backgroundColor: [WAIT_COLUMN_COLOR, WORK_COLUMN_COLOR, NOT_SET_COLOR],
  };

  return {
    labels: [
      "Total Wait Time (days)",
      "Total Work Time (days)",
      "Total Not Set Time (days)",
    ],
    datasets: [data],
  };
};

/**
 * Generates line chart showing wait and work time trends over slices
 * @param slices - Array of duration slices
 * @returns Chart data for line chart
 */
export const getWorkWaitTimeItemLineChart = (slices: any[]): IBarChartData => {
  const waitDataset: ILineChartDataset = {
    type: "line",
    label: "Wait Time",
    backgroundColor: RUNNING_AVERAGE_CHART_COLOR,
    borderColor: WAIT_COLUMN_COLOR,
    data: [],
    fill: false,
  };

  const workDataset: ILineChartDataset = {
    type: "line",
    label: "Work Time",
    backgroundColor: RUNNING_AVERAGE_CHART_COLOR,
    borderColor: WORK_COLUMN_COLOR,
    data: [],
    fill: false,
  };

  const labels: string[] = [];

  slices.forEach((slice) => {
    labels.push(slice.startDate.toLocaleDateString());
    const waitTimeDays = millisecondsToDays(slice.totWaitTime);
    const workTimeDays = millisecondsToDays(slice.totWorkTime);
    waitDataset.data.push(waitTimeDays);
    workDataset.data.push(workTimeDays);
  });

  return {
    labels,
    datasets: [waitDataset, workDataset],
  };
};

/**
 * Generates efficiency trend chart showing flow efficiency over time
 * @param slices - Array of duration slices
 * @returns Chart data for efficiency trend
 */
export const getEfficiencyLineChart = (slices: any[]): IBarChartData => {
  const runningDataset: ILineChartDataset = {
    type: "line",
    label: "Running Efficiency",
    backgroundColor: RUNNING_AVERAGE_CHART_COLOR,
    borderColor: WORK_COLUMN_COLOR,
    data: [],
    fill: false,
  };

  const sliceDataset: ILineChartDataset = {
    type: "line",
    label: "Efficiency In This 2 weeks",
    backgroundColor: RUNNING_AVERAGE_CHART_COLOR,
    borderColor: WAIT_COLUMN_COLOR,
    data: [],
    fill: false,
  };

  const labels: string[] = [];
  let runningWorkTotal = 0;
  let runningWaitTotal = 0;

  // Sort slices by date
  const sortedSlices = [...slices].sort((a, b) => {
    if (a.startDate < b.startDate) return -1;
    if (a.startDate > b.startDate) return 1;
    return 0;
  });

  sortedSlices.forEach((slice) => {
    labels.push(slice.startDate.toLocaleDateString());

    // Calculate efficiency for this slice
    const totalTime = slice.totWorkTime + slice.totWaitTime;
    const sliceEfficiency =
      totalTime > 0
        ? parseFloat(((slice.totWorkTime / totalTime) * 100).toFixed(2))
        : 0;
    sliceDataset.data.push(sliceEfficiency);

    // Calculate running efficiency
    runningWorkTotal += slice.totWorkTime;
    runningWaitTotal += slice.totWaitTime;
    const runningTotal = runningWorkTotal + runningWaitTotal;
    const runningEfficiency =
      runningTotal > 0
        ? parseFloat(((runningWorkTotal / runningTotal) * 100).toFixed(2))
        : 0;
    runningDataset.data.push(runningEfficiency);
  });

  return {
    labels,
    datasets: [sliceDataset, runningDataset],
  };
};
