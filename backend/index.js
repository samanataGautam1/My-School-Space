// Database reset module disabled

console.log("[ROOT] Initializing School Space Backend...");

const fs = require('fs');
const path = require('path');

let results = [];
function searchFiles(dir, query) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchFiles(fullPath, query);
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(query)) {
        results.push(`[SEARCH MATCH] Found "${query}" in file: ${fullPath}`);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes(query)) {
            results.push(`  Line ${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

if (process.env.NODE_ENV !== 'production') {
  try {
    searchFiles(path.join(__dirname, '../frontend/src'), 'Trendline Graph');
    searchFiles(path.join(__dirname, '../frontend/src'), 'Select a class to view students');
    fs.writeFileSync(path.join(__dirname, 'search_results.txt'), results.join('\n'), 'utf8');
  } catch (e) {
    fs.writeFileSync(path.join(__dirname, 'search_results.txt'), "Search failed: " + e.message, 'utf8');
  }
} else {
  console.log("[ROOT] Production mode: Skipping local file search.");
}

async function start() {
  try {
    require("./src/server.js");
    console.log("[ROOT] Server module loaded successfully.");
  } catch (error) {
    console.error("[ROOT] CRITICAL ERROR: Failed to load server module.");
    console.error(error.message);
    if (error.stack) {
      console.debug(error.stack);
    }
    process.exit(1);
  }
}

start();


