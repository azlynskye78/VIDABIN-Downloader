export function parseFormats(rawOutput) {
    const audioStreams = [];
    const videoStreams = [];

    const lines = rawOutput.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.includes('audio only')) {
            const idMatch = trimmed.match(/^(\S+)/);
            const extMatch = trimmed.match(/^\S+\s+(\S+)/);
            const langMatch = trimmed.match(/\[([a-zA-Z-]+)\]([^,]+)/);
            const bitrateMatch = trimmed.match(/(\d+k)/); 
            const codecMatch = trimmed.match(/audio only\s+(\S+)/);
            
            if (idMatch && extMatch && langMatch) {
                const id = idMatch[1];
                const ext = extMatch[1];
                const language = langMatch[1];
                const language_name = langMatch[2].trim();
                const is_default = trimmed.includes('(default)');
                const bitrate = bitrateMatch ? bitrateMatch[1] : '';
                const codec = codecMatch ? codecMatch[1] : '';

                audioStreams.push({
                    id,
                    ext,
                    language,
                    language_name,
                    is_default,
                    bitrate,
                    codec
                });
            }
        } else if (trimmed.includes('video only')) {
            const idMatch = trimmed.match(/^(\S+)/);
            const extMatch = trimmed.match(/^\S+\s+(\S+)/);
            const resMatch = trimmed.match(/(\d+x\d+)/);
            const fpsMatch = trimmed.match(/\d+x\d+\s+(\d+)/);
            const codecMatch = trimmed.match(/│\s+(\S+)/);
            const sizeMatch = trimmed.match(/│\s+([\d.]+MiB|[\d.]+KiB|[\d.]+GiB)/);

            if (idMatch && extMatch) {
                videoStreams.push({
                    id: idMatch[1],
                    ext: extMatch[1],
                    resolution: resMatch ? resMatch[1] : '',
                    fps: fpsMatch ? fpsMatch[1] : '',
                    codec: codecMatch ? codecMatch[1] : '',
                    size: sizeMatch ? sizeMatch[1] : ''
                });
            }
        }
    }

    return { audioStreams, videoStreams };
}

export function filterByLanguages(audioStreams, languages) {
    if (languages.includes('all')) {
        return audioStreams;
    }
    return audioStreams.filter(stream => languages.includes(stream.language));
}

/**
 * Parse bitrate string like "48k", "128k" into a number.
 * Returns 0 if parsing fails.
 */
function parseBitrate(bitrateStr) {
    if (!bitrateStr) return 0;
    const match = bitrateStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Select the best audio track per language based on quality preference.
 * @param {Array} audioStreams - Filtered audio streams
 * @param {string} quality - 'best' | 'medium' | 'lowest' | 'all'
 * @returns {Array} - One track per language (unless quality='all')
 */
export function selectBestPerLanguage(audioStreams, quality = 'best') {
    if (quality === 'all') return audioStreams;

    // Group streams by language
    const byLanguage = {};
    for (const stream of audioStreams) {
        const lang = stream.language || 'unknown';
        if (!byLanguage[lang]) byLanguage[lang] = [];
        byLanguage[lang].push(stream);
    }

    const selected = [];
    for (const [lang, streams] of Object.entries(byLanguage)) {
        if (streams.length === 1) {
            selected.push(streams[0]);
            continue;
        }

        // Sort by bitrate descending (highest first)
        const sorted = [...streams].sort((a, b) => parseBitrate(b.bitrate) - parseBitrate(a.bitrate));

        if (quality === 'best') {
            selected.push(sorted[0]);
        } else if (quality === 'lowest') {
            selected.push(sorted[sorted.length - 1]);
        } else if (quality === 'medium') {
            const midIndex = Math.floor(sorted.length / 2);
            selected.push(sorted[midIndex]);
        }
    }

    return selected;
}
