import { handleCheckDependencies } from '../tools/check-deps.js';

async function test() {
  console.error("Testing handleCheckDependencies()...");
  const res = await handleCheckDependencies();
  console.log("Result:", JSON.stringify(res, null, 2));
}

test().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
