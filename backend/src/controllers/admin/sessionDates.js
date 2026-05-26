/**
 * Calculates rigid start and end dates based on a 3-month active session descriptor.
 * Exposes a 5-day autoAdvance threshold buffer.
 */
function getSessionDateRange(session, year) {
    let startMonth = 0; // Default: 1st Session (Jan=0, Feb=1, Mar=2)
    let endMonth = 2;
    
    // Determine the literal 3-month bound mappings:
    if (session.toLowerCase().includes('2nd')) {
        startMonth = 3; // April
        endMonth = 5;   // June
    } else if (session.toLowerCase().includes('3rd')) {
        startMonth = 6; // July
        endMonth = 8;   // September
    } else if (session.toLowerCase().includes('4th')) {
        startMonth = 9;  // October
        endMonth = 11;   // December
    }

    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
    
    // Auto Advance Date (5 days before the month ends)
    const autoAdvanceDate = new Date(year, endMonth + 1, 0, 0, 0, 0); 
    autoAdvanceDate.setDate(autoAdvanceDate.getDate() - 5);
    
    return { startDate, endDate, autoAdvanceDate };
}

function getNextSession(currentSession, currentYear) {
    const nextSessionMap = {
        '1st Session': '2nd Session',
        '2nd Session': '3rd Session',
        '3rd Session': '4th Session',
        '4th Session': '1st Session'
    };
    
    const nextSession = nextSessionMap[currentSession] || '1st Session';
    const nextYear = currentSession === '4th Session' ? currentYear + 1 : currentYear;
    
    return { nextSession, nextYear };
}

module.exports = {
    getSessionDateRange,
    getNextSession
};
