console.log("[ROOT] Initializing School Space Backend...");

async function start() {
  try {
    require("./src/server.js");
    console.log("[ROOT] Server module loaded successfully.");
  } catch (error) {
    console.error("[ROOT] CRITICAL ERROR: Failed to load server module.");
    console.error(error.message);
    if (error.stack) console.debug(error.stack);
    process.exit(1);
  }
}

start();