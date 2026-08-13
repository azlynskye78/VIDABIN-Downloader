import fs from 'fs/promises';

export class CookieManager {
    constructor(globalCookiesFile = null) {
        this.globalCookiesFile = globalCookiesFile;
        this.failedCookies = new Set();
    }

    getCookiesArgs(videoConfig) {
        let cookieFile = null;
        if (videoConfig && videoConfig.cookies_file) {
            cookieFile = videoConfig.cookies_file;
        } else if (this.globalCookiesFile) {
            cookieFile = this.globalCookiesFile;
        }

        if (cookieFile && !this.failedCookies.has(cookieFile)) {
            return ['--cookies', cookieFile];
        }
        return [];
    }

    markFailed(cookiesFile) {
        if (cookiesFile) {
            this.failedCookies.add(cookiesFile);
            console.error(`Marked cookie file as failed: ${cookiesFile}`);
        }
    }

    async validateCookieFile(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch (error) {
            console.error(`Cookie file validation failed for ${filePath}:`, error.message);
            return false;
        }
    }
}
