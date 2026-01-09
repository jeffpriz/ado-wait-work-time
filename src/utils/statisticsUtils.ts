/**
 * Statistical calculation utilities
 */

/**
 * Calculates the standard deviation of an array of numbers
 * @param array - Array of numeric values
 * @returns Standard deviation
 */
export const getStandardDeviation = (array: number[]): number => {
  const n = array.length;
  if (n === 0) {
    return 0;
  }
  const mean = array.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(
    array.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / n
  );
};

/**
 * Calculates flow efficiency as a percentage
 * @param workTime - Time spent in work state (milliseconds)
 * @param waitTime - Time spent in wait state (milliseconds)
 * @returns Flow efficiency as a decimal (0-1)
 */
export const calculateFlowEfficiency = (
  workTime: number,
  waitTime: number
): number => {
  const totalTime = workTime + waitTime;
  if (totalTime > 0) {
    return workTime / totalTime;
  }
  return 0;
};
