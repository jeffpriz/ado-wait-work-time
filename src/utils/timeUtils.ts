/**
 * Time calculation utilities for work item duration analysis
 */

/**
 * Represents a duration broken down into time components
 */
export interface IDuration {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

/**
 * Converts milliseconds to a structured duration object
 * @param duration - Duration in milliseconds
 * @returns Structured duration with days, hours, minutes, seconds, milliseconds
 */
export const getMillisecondsToTime = (duration: number): IDuration => {
  let remain = duration;

  const days = Math.floor(remain / (1000 * 60 * 60 * 24));
  remain = remain % (1000 * 60 * 60 * 24);

  const hours = Math.floor(remain / (1000 * 60 * 60));
  remain = remain % (1000 * 60 * 60);

  const minutes = Math.floor(remain / (1000 * 60));
  remain = remain % (1000 * 60);

  const seconds = Math.floor(remain / 1000);
  remain = remain % 1000;

  const milliseconds = remain;

  return {
    days,
    hours,
    minutes,
    seconds,
    milliseconds,
  };
};

/**
 * Formats a duration object as a human-readable string
 * @param duration - Structured duration object
 * @returns Formatted string like "2 Days, 3 Hours, 45 Minutes, 10 Seconds"
 */
export const formatDuration = (duration: IDuration): string => {
  return `${duration.days} Days, ${duration.hours} Hours, ${duration.minutes} Minutes, ${duration.seconds} Seconds`;
};

/**
 * Gets a date in the past relative to now
 * @param numberOfDaysAgo - Number of days to go back
 * @returns Date object representing the past date
 */
export const getDateInThePast = (numberOfDaysAgo: number): Date => {
  const dayMilliseconds = 24 * 60 * 60 * 1000;
  return new Date(new Date().getTime() - numberOfDaysAgo * dayMilliseconds);
};
