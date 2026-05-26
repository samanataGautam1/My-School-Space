const fs = require('fs');
const path = require('path');

function runSearch() {
  try {
    const srcDir = path.join(__dirname, '../frontend/src');
    const results = [];

    function searchDir(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          searchDir(fullPath);
        } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('publish-terminal') || content.includes('run-calculation')) {
            const lines = content.split('\n');
            lines.forEach((line, i) => {
              if (line.includes('publish-terminal') || line.includes('run-calculation') || line.includes('examTerminal')) {
                results.push(`${path.basename(file)}:${i+1}: ${line.trim()}`);
              }
            });
          }
        }
      }
    }

    searchDir(srcDir);
    const outPath = path.join(__dirname, 'search_frontend.txt');
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
