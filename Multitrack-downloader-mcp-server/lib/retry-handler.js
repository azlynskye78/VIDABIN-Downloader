export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function executeWithRetry(fn, maxRetries = 3) {
    let attempt = 0;
    const delays = [3000, 6000, 9000];

    while (attempt <= maxRetries) {
        try {
            const result = await fn();
            return { success: true, result };
        } catch (error) {
            console.error(`Execution failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
            
            if (attempt === maxRetries) {
                return { success: false, error: error.message };
            }
            
            const delay = delays[Math.min(attempt, delays.length - 1)];
            console.error(`Retrying in ${delay}ms...`);
            await sleep(delay);
            attempt++;
        }
    }
}
