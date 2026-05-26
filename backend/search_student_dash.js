const fs = require('fs');
const path = require('path');

function runSearch() {
  try {
    const filePath = path.join(__dirname, '../frontend/src/StudentDashboard/StudentDashboard.jsx');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const results = [];
    
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes('results') || line.toLowerCase().includes('performance') || line.toLowerCase().includes('grade')) {
        results.push(`${i+1}: ${line.trim()}`);
      }
    });
    
    const outPath = path.join(__dirname, 'search_student_dash.txt');
    fs.writeFileSync(outPath, results.join('\n'));
    console.log(`[SEARCH] Results written to ${outPath}`);
  } catch (err) {
    console.error('Search error:', err);
  }
}

module.exports = runSearch;
if (require.main === module) {
  runSearch();
}
