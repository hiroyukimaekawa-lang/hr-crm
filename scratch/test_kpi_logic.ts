import { getCanonicalFunnelCounts, getEventKpiData, getSalesActuals } from './src/repositories/kpiRepository';

async function test() {
    const filters = { month: '2026-04' };
    console.log('--- Testing getCanonicalFunnelCounts (Cohort View) ---');
    const funnel = await getCanonicalFunnelCounts(filters);
    console.log('Funnel:', JSON.stringify(funnel, null, 2));

    console.log('\n--- Testing getEventKpiData (Filtered Status) ---');
    const eventKpi = await getEventKpiData(filters);
    console.log('First event KPI (summary):', {
        title: eventKpi[0]?.event_title,
        current_seats: eventKpi[0]?.current_seats,
        current_entries: eventKpi[0]?.current_entries,
        status_breakdown: eventKpi[0]?.status_breakdown
    });

    console.log('\n--- Testing getSalesActuals (No entry_deadline) ---');
    const sales = await getSalesActuals(filters);
    console.log('Total Sales:', sales.totalSales);
    console.log('Total Attendance:', sales.totalAttendance);
}

test().catch(console.error).finally(() => process.exit());
