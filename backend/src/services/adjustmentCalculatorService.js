export const adjustmentAmountForPayroll = (adjustment, totalHoursWorked = 0) => {
  const amount = Number(adjustment?.amount) || 0;
  if (adjustment?.type === 'ALLOWANCE' && adjustment?.frequency === 'HOURLY') {
    return Math.round(amount * Math.max(0, Number(totalHoursWorked) || 0) * 100) / 100;
  }
  return amount;
};

export const adjustmentTotalsForPayroll = (adjustments = [], totalHoursWorked = 0) => {
  return adjustments.reduce((totals, adjustment) => {
    const calculatedAmount = adjustmentAmountForPayroll(adjustment, totalHoursWorked);
    if (adjustment?.type === 'ALLOWANCE') {
      totals.allowancesTotal += calculatedAmount;
    } else if (adjustment?.type === 'DEDUCTION') {
      totals.deductionsTotal += calculatedAmount;
    }
    return totals;
  }, { allowancesTotal: 0, deductionsTotal: 0 });
};
