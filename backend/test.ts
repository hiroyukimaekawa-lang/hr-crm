import { getCanonicalFunnelCounts, getDailyApplicationTrend, getSalesActuals, getGoals } from './src/repositories/kpiRepository';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    try {
        console.log("Testing getCanonicalFunnelCounts...");
        await getCanonicalFunnelCounts({ month: '2026-04' });
        console.log("SUCCESS");

        console.log("Testing getDailyApplicationTrend...");
        await getDailyApplicationTrend({ month: '2026-04' });
        console.log("SUCCESS");

        console.log("Testing getSalesActuals...");
        await getSalesActuals({ month: '2026-04' });
        console.log("SUCCESS");

        console.log("Testing getGoals...");
        await getGoals({ scopeType: 'global', periodType: 'monthly', month: '2026-04' });
        console.log("SUCCESS");
    } catch (err: any) {
        console.error("FAILED:");
        console.error(err);
    } process.exit();
})();
