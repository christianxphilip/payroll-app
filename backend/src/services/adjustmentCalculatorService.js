export const adjustmentAmountForPayroll = (adjustment, totalHoursWorked = 0) => {
  const amount = Number(adjustment?.amount) || 0;
  if (adjustment?.type === 'ALLOWANCE' && adjustment?.frequency === 'HOURLY') {
    return Math.round(amount * Math.max(0, Number(totalHoursWorked) || 0) * 100) / 100;
  }
  return amount;
};
