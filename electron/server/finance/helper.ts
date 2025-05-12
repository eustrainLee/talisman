import dayjs from 'dayjs';

// 获取子周期数量
export const getSubPeriodCount = (parentPeriod: string, subPeriod: string): number => {
    switch (parentPeriod) {
        case 'YEAR':
            switch (subPeriod) {
                case 'QUARTER': return 4;
                case 'MONTH': return 12;
                case 'WEEK': return 52;
                default: return 1;
            }
        case 'QUARTER':
            switch (subPeriod) {
                case 'MONTH': return 3;
                case 'WEEK': return 13;
                default: return 1;
            }
        case 'MONTH':
            switch (subPeriod) {
                case 'WEEK': return 4;
                default: return 1;
            }
        default:
            return 1;
    }
};

// 格式化日期：
// 年：年份
// 季度：年份-Q季度
// 月：年份-月份(周几)
// 周：年份-月份-日
// 默认：年份-月份-日(周几)
export const formatDate = (date: dayjs.Dayjs, periodType: string) => {
    switch (periodType) {
        case 'YEAR':
            return date.format('YYYY');
        case 'QUARTER':
            return date.format('YYYY-[Q]Q');
        case 'MONTH':
            return date.format('YYYY-MM(ddd)');
        case 'WEEK':
            return date.format('YYYY-MM-DD');
        default:
            return date.format('YYYY-MM-DD(ddd)');
    }
};

// 获取周期起始时间
export const getPeriodStartDate = (date: dayjs.Dayjs, period: string) => {
    switch (period) {
        case 'WEEK':
            return date.startOf('week');
        case 'MONTH':
            return date.startOf('month');
        case 'QUARTER':
            return date.startOf('quarter');
        case 'YEAR':
            return date.startOf('year');
        default:
            return date;
    }
};


// 计算开支
// 对于平均分配策略和非子记录，计算每个子记录的预算和期末累计值，累计值直接相加即可
// 对于无分配策略的非子记录，期末累计开支直接相加，而期末累计结余应减去当前记录的实际开销
export const calculateExpense = (
    isSubRecord: boolean, budgetAllocation: 'NONE' | 'AVERAGE',
    budgetAmount: number, actualAmount: number, openingCumulativeBalance: number, openingCumulativeExpense: number,
): { balance: number, closing_cumulative_balance: number, closing_cumulative_expense: number } => {
    const balance = budgetAmount - actualAmount;
    if (budgetAllocation === 'AVERAGE' || !isSubRecord) {
        const closingCumulativeBalance = openingCumulativeBalance + balance;
        const closingCumulativeExpense = openingCumulativeExpense + actualAmount;
        return {
            balance,
            closing_cumulative_balance: closingCumulativeBalance,
            closing_cumulative_expense: closingCumulativeExpense,
        };
    }
    // NONE 策略
    const closingCumulativeBalance = openingCumulativeBalance - actualAmount;
    const closingCumulativeExpense = openingCumulativeExpense + actualAmount;
    return {
        balance,
        closing_cumulative_balance: closingCumulativeBalance,
        closing_cumulative_expense: closingCumulativeExpense,
    };
};

// 获取这个月有多少天
export const daysOfMonth = (month: number, year: number) => {
    return dayjs(`${year}-${month}-01`).daysInMonth();
};
