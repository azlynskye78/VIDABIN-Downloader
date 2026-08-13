import { checkDependencies } from '../lib/binary-manager.js';

export async function handleCheckDependencies() {
  try {
    const result = await checkDependencies();
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    console.error('Error checking dependencies:', error);
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }]
    };
  }
}
