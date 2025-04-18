(function() {
    'use strict';

    // ===========================================================
    // JAVASCRIPT SECTION (Updated)
    // ===========================================================
    const config = {
        GSheetWebAppURL: "https://script.google.com/macros/s/AKfycbzcV_vEcrlZYVYnw-RFQOsHtzfdIIEwh4Vfp2tPp2wR1I8by2TDTGyQZH9i2Gy-0WMoAw/exec",
        HDR_LOGO_URL: "https://as1.ftcdn.net/v2/jpg/05/32/83/72/1000_F_532837228_v8CGZRU0jy39uCtqFRnJz6xDntrGuLLx.webp",
        FOURK_LOGO_URL: "https://i.pinimg.com/736x/85/c4/b0/85c4b0a2fb8612825d0cd2f53460925f.jpg",
        ITEMS_PER_PAGE: 50,
        LOCAL_STORAGE_KEY: 'cinemaGharState_v8_share', // Keep same key for compatibility
        PLAYER_VOLUME_KEY: 'cinemaGharPlayerVolume',
        PLAYER_SPEED_KEY: 'cinemaGharPlayerSpeed',
        SEARCH_DEBOUNCE_DELAY: 300,
        SUGGESTIONS_DEBOUNCE_DELAY: 250,
        MAX_SUGGESTIONS: 50,
        UPDATES_PREVIEW_INITIAL_COUNT: 10,
        UPDATES_PREVIEW_LOAD_MORE_COUNT: 10
    };

    // --- DOM Element References (Grouped) ---
    const container = document.getElementById('cinemaghar-container');
    const pageLoader = document.getElementById('page-loader');
    const searchFocusArea = document.getElementById('search-focus-area');
    const resultsArea = document.getElementById('results-area'); // Now a <main> element
    const sharedItemView = document.getElementById('shared-item-view'); // Now a <main> element
    const sharedItemContent = document.getElementById('shared-item-content');
    const searchInput = document.getElementById('mainSearchInput');
    const suggestionsContainer = document.getElementById('searchInputSuggestions');
    const qualityFilterSelect = document.getElementById('mainQualityFilterSelect');
    const mainErrorArea = document.getElementById('main-error-area');

    // Updates Preview Elements
    const updatesPreviewSection = document.getElementById('updates-preview-section');
    const updatesPreviewList = document.getElementById('updates-preview-list');
    const showMoreUpdatesButton = document.getElementById('showMoreUpdatesButton');

    // Video Player Elements
    const videoContainer = document.getElementById('videoContainer');
    const videoElement = document.getElementById('html5VideoPlayer');
    const videoTitle = document.getElementById('videoTitle');
    const vlcBox = document.getElementById('vlcBox');
    const vlcText = document.getElementById('vlcText');
    const audioWarningDiv = document.getElementById('audioWarning');
    const muteButton = document.getElementById('muteButton');
    const volumeSlider = document.getElementById('volumeSlider');
    const playbackSpeedSelect = document.getElementById('playbackSpeedSelect');
    const customControlsContainer = document.getElementById('customControlsContainer');
    const audioTrackSelect = document.getElementById('audioTrackSelect');

    // Tab Navigation and Content Area
    const tabNavigation = document.querySelector('.tab-navigation'); // Now a <nav> element
    const tabContent = document.querySelector('.tab-content');
    const allFilesTabButton = document.getElementById('allFilesTabButton');
    const moviesTabButton = document.getElementById('moviesTabButton');
    const seriesTabButton = document.getElementById('seriesTabButton');
    const allFilesTabPanel = document.getElementById('allFilesTabPanel');
    const moviesTabPanel = document.getElementById('moviesTabPanel');
    const seriesTabPanel = document.getElementById('seriesTabPanel');
    const allFilesTableBody = document.getElementById('allFilesTableBody');
    const moviesTableBody = document.getElementById('moviesTableBody');
    const seriesTableBody = document.getElementById('seriesTableBody');
    const allFilesTableHead = document.querySelector('#allFilesTable thead');
    const moviesTableHead = document.querySelector('#moviesTable thead');
    const seriesTableHead = document.querySelector('#seriesTable thead');
    const allFilesPaginationControls = document.getElementById('allFilesPaginationControls');
    const moviesPaginationControls = document.getElementById('moviesPaginationControls');
    const seriesPaginationControls = document.getElementById('seriesPaginationControls');

    // Back Button References
    const backToHomeButtonResults = document.getElementById('backToHomeButtonResults');
    const backToHomeButtonShared = document.getElementById('backToHomeButtonShared');

    // Footer Reference
    const pageFooter = document.getElementById('page-footer');


    // --- State Variables ---
    let allMovieData = [];
    let currentViewData = []; // Holds filtered/sorted data for search results
    let weeklyUpdatesData = []; // Holds data for the "Recently Added" preview
    let updatesPreviewShownCount = 0;

    let uniqueQualities = new Set();
    let activeTableActionRow = null; // Reference to the currently open action TR in search results
    let activePreviewActionRow = null; // Reference to the currently open action DIV in updates preview
    let copyFeedbackTimeout; // SINGLE timeout ID for ALL copy feedback spans
    let suggestionDebounceTimeout;
    let searchTimeout;
    let isDirectShareLoad = false; // Flag for direct share link loading

    let currentViewMode = 'homepage'; // 'homepage', 'search', or 'shared'
    let activeResultsTab = 'allFiles'; // 'allFiles', 'movies', 'series'
    let lastFocusedElement = null; // For returning focus

    // Represents the user's current selections for search/filtering/sorting/pagination
    let currentState = {
        searchTerm: '',
        qualityFilter: '',
        sortColumn: 'lastUpdated', // Default sort
        sortDirection: 'desc',     // Default sort
        currentPageAll: 1,
        currentPageMovies: 1,
        currentPageSeries: 1,
    };

    // Mapping for easy access to tab-related elements and state
    const tabMappings = {
        allFiles: { button: allFilesTabButton, panel: allFilesTabPanel, tableBody: allFilesTableBody, pagination: allFilesPaginationControls, pageKey: 'currentPageAll', tableHead: allFilesTableHead },
        movies: { button: moviesTabButton, panel: moviesTabPanel, tableBody: moviesTableBody, pagination: moviesPaginationControls, pageKey: 'currentPageMovies', tableHead: moviesTableHead },
        series: { button: seriesTabButton, panel: seriesTabPanel, tableBody: seriesTableBody, pagination: seriesPaginationControls, pageKey: 'currentPageSeries', tableHead: seriesTableHead }
    };

    // --- Utility Functions (sanitize, TimeAgo, extractSizeData, getMimeTypeFromUrl, handleVideoError, extractQualityFromFilename, normalizeTextForSearch, escapeRegExp, copyToClipboard) ---
    const sanitize = (str) => { if (str === null || typeof str === 'undefined') return ""; const temp = document.createElement('div'); temp.textContent = String(str); return temp.innerHTML; };
    const TimeAgo = { MINUTE: 60, HOUR: 3600, DAY: 86400, WEEK: 604800, MONTH: 2592000, YEAR: 31536000, format: (isoString) => { if (!isoString) return 'N/A'; try { const date = new Date(isoString); const seconds = Math.floor((new Date() - date) / 1000); if (isNaN(seconds) || seconds < 0) { return TimeAgo.formatFullDate(date); } if (seconds < 2) return "just now"; if (seconds < TimeAgo.MINUTE) return `${seconds} sec${seconds > 1 ? 's' : ''} ago`; if (seconds < TimeAgo.HOUR) return `${Math.floor(seconds / TimeAgo.MINUTE)} min${Math.floor(seconds / TimeAgo.MINUTE) > 1 ? 's' : ''} ago`; if (seconds < TimeAgo.DAY) return `${Math.floor(seconds / TimeAgo.HOUR)} hr${Math.floor(seconds / TimeAgo.HOUR) > 1 ? 's' : ''} ago`; if (seconds < TimeAgo.DAY * 2) return "Yesterday"; if (seconds < TimeAgo.WEEK) return `${Math.floor(seconds / TimeAgo.DAY)} days ago`; if (seconds < TimeAgo.MONTH) return `${Math.floor(seconds / TimeAgo.WEEK)} wk${Math.floor(seconds / TimeAgo.WEEK) > 1 ? 's' : ''} ago`; return TimeAgo.formatFullDate(date, true); } catch (e) { console.error("Date Format Error (TimeAgo):", isoString, e); return 'Invalid Date'; } }, formatFullDate: (date, short = false) => { if (!(date instanceof Date) || isNaN(date.getTime())) return 'Invalid Date'; const optsDate = short ? { year: '2-digit', month: 'numeric', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' }; const optsTime = { hour: 'numeric', minute: '2-digit', hour12: true }; try { return `${date.toLocaleDateString(undefined, optsDate)}${short ? '' : ', ' + date.toLocaleTimeString(undefined, optsTime)}`; } catch (e) { console.error("toLocaleDateString/Time failed:", e); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; } } };
    function extractSizeData(inputString) { if (!inputString) return { value: 0, unit: '', display: 'N/A', bytes: 0 }; const r = /(?<size>[\d.]+)\s?(?<unit>GB|MB)/i; const m = String(inputString).match(r); if (m?.groups?.size && m?.groups?.unit) { const value = parseFloat(m.groups.size); const unit = m.groups.unit.toUpperCase(); if (!isNaN(value)) { const bytes = unit === 'GB' ? value * 1024 * 1024 * 1024 : value * 1024 * 1024; return { value: value, unit: unit, display: `${value} ${unit}`, bytes: isNaN(bytes) ? 0 : bytes }; } } return { value: 0, unit: '', display: 'N/A', bytes: 0 }; }
    function getMimeTypeFromUrl(url) { if (!url) return 'video/*'; const m = url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/); if (!m) return 'video/*'; const ext = m[1].toLowerCase(); const mimeMap = { 'mkv': 'video/x-matroska', 'mp4': 'video/mp4', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo', 'webm': 'video/webm', 'wmv': 'video/x-ms-wmv', 'flv': 'video/x-flv', 'ts': 'video/mp2t', 'm4v': 'video/x-m4v', 'ogv': 'video/ogg' }; return mimeMap[ext] || 'video/*'; }
    function handleVideoError(event) { console.error("HTML5 Video Error:", event, videoElement?.error); let msg = "An unknown error occurred while trying to play the video."; if (videoElement?.error) { switch (videoElement.error.code) { case MediaError.MEDIA_ERR_ABORTED: msg = 'Playback was aborted.'; break; case MediaError.MEDIA_ERR_NETWORK: msg = 'A network error caused the video download to fail.'; break; case MediaError.MEDIA_ERR_DECODE: msg = 'Video decoding error (unsupported codec or corrupt file?).'; break; case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: msg = 'Video format not supported or server/network failed.'; break; default: msg = `An unknown video error occurred (Code: ${videoElement.error.code}).`; break; } } if (audioWarningDiv) { audioWarningDiv.innerHTML = `<strong>Playback Error:</strong> ${sanitize(msg)} <br>Consider using 'Copy URL' with an external player (VLC/MX) or 'Open Externally' (Android).`; audioWarningDiv.style.display = 'block'; } } if (videoElement) { videoElement.addEventListener('error', handleVideoError); }
    function extractQualityFromFilename(filename) { if (!filename) return null; const safeFilename = String(filename); const patterns = [ /(?:^|\.|\[|\(|\s|_|-)((?:4k|2160p|1080p|720p|480p))(?=$|\.|\]|\)|\s|_|-)/i, /(?:^|\.|\[|\(|\s|_-)(WEB-?DL|WEBRip|BluRay|BDRip|BRRip|HDTV|HDRip|DVDrip|DVDScr|HDCAM|HC|TC|TS|CAM)(?=$|\.|\]|\)|\s|_|-)/i, /(?:^|\.|\[|\(|\s|_-)(HDR|DV|Dolby.?Vision|HEVC|x265)(?=$|\.|\]|\)|\s|_|-)/i ]; let foundQuality = null; for (const regex of patterns) { const match = safeFilename.match(regex); if (match && match[1]) { let quality = match[1].toUpperCase(); quality = quality.replace(/WEB-?DL/i, 'WEBDL'); quality = quality.replace(/BLURAY/i, 'BluRay'); quality = quality.replace(/DVDRIP/i, 'DVD'); quality = quality.replace(/DOLBY.?VISION/i, 'Dolby Vision'); if (quality === '2160P') quality = '4K'; if (patterns.indexOf(regex) < 2) return quality; if (patterns.indexOf(regex) === 2 && !foundQuality) foundQuality = quality; } } return foundQuality; }
    function normalizeTextForSearch(text) { if (!text) return ""; return String(text) .toLowerCase() .replace(/[.\-_\(\)\[\]]/g, '') .replace(/\s+/g, ' ') .trim(); }
    function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    async function copyToClipboard(text, feedbackSpan) {
        console.log("Attempting to copy:", text);
        let success = false;
        if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                success = true;
                console.log("navigator.clipboard.writeText SUCCEEDED");
            } catch (err) {
                console.error("Async clipboard write failed:", err);
                success = false;
            }
        }

        if (!success) { // Fallback
            console.warn("Using fallback copy method (execCommand).");
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed"; textArea.style.top = "-9999px"; textArea.style.left = "-9999px"; textArea.style.opacity = "0"; textArea.setAttribute("readonly", "");
            document.body.appendChild(textArea);
            try {
                textArea.select();
                textArea.setSelectionRange(0, textArea.value.length); // Ensure selection for mobile
                success = document.execCommand('copy');
                console.log("Fallback execCommand result:", success);
            } catch (err) {
                console.error('Fallback copy execCommand failed:', err);
                success = false;
            } finally {
                document.body.removeChild(textArea);
            }
        }

        if (success) {
            console.log("Copy successful!");
            // Show inline feedback span if provided
            if (feedbackSpan) {
                showCopyFeedback(feedbackSpan, 'Copied!', false); // Pass span, message, isError=false
            }
        } else {
            console.error("Copy FAILED.");
            if (feedbackSpan) {
                showCopyFeedback(feedbackSpan, 'Copy Failed!', true); // Show error in span
            } else {
                alert("Copy failed. Please try again or copy manually. Check console for errors (F12).");
            }
        }
        return success;
    }

    // --- Data Preprocessing ---
    function preprocessMovieData(movie) {
         const processed = {};
         processed.id = movie.id || null;
         processed.url = movie.url || null;
         processed.telegramLink = movie.telegramLink || null;
         processed.gdflixLink = movie.gdflixLink || null;
         processed.hubcloudLink = movie.hubcloudLink || null;
         processed.filepressLink = movie.filepressLink || null;
         processed.gdtotLink = movie.gdtotLink || null;
         processed.languages = movie.languages || null;
         processed.filenameSource = 'sheet';
         processed.displayFilename = sanitize(movie.filename || '');

         // Defensive Filename Extraction from URL
         if (!processed.displayFilename && movie.url) {
             try {
                 const urlObject = new URL(movie.url);
                 let potentialFilename = '';
                 const pathParam = urlObject.searchParams.get('path');
                 if (pathParam) {
                     const pathSegments = pathParam.split('/').filter(Boolean);
                     if (pathSegments.length > 0) potentialFilename = decodeURIComponent(pathSegments[pathSegments.length - 1]);
                 }
                 if (!potentialFilename && urlObject.pathname && urlObject.pathname !== '/') {
                     const pathSegments = urlObject.pathname.split('/').filter(Boolean);
                     if (pathSegments.length > 0 && (pathSegments[pathSegments.length - 1] || '').includes('.')) {
                         potentialFilename = decodeURIComponent(pathSegments[pathSegments.length - 1]);
                     }
                 }
                 if (potentialFilename) {
                     processed.displayFilename = sanitize(potentialFilename);
                     processed.filenameSource = 'url';
                 }
             } catch (e) { console.warn("URL parsing failed for filename extraction:", movie.url, e); }
         }
         if (!processed.displayFilename) {
             processed.displayFilename = `File (ID: ${sanitize(processed.id || 'N/A')})`;
             processed.filenameSource = 'placeholder';
         }

         // Store original filename if different from display filename
         if (processed.displayFilename !== sanitize(movie.filename || '')) {
             processed.originalFilename = movie.filename || null;
         } else {
             processed.originalFilename = null;
         }

         // Size extraction (from explicit 'size' field first, then from filename)
         processed.sizeData = { display: 'N/A', bytes: 0 };
         if (movie.size && String(movie.size).toLowerCase() !== 'n/a') {
             const explicitSize = extractSizeData(String(movie.size));
             if (explicitSize && explicitSize.bytes > 0) processed.sizeData = explicitSize;
         }
         if (processed.sizeData.bytes === 0 && processed.filenameSource !== 'placeholder') {
             const extractedSize = extractSizeData(processed.displayFilename);
             if (extractedSize && extractedSize.bytes > 0) processed.sizeData = extractedSize;
         }

         // Quality extraction (from explicit 'quality' field first, then from filename)
         processed.displayQuality = sanitize(movie.quality || 'N/A');
         if ((!movie.quality || String(movie.quality).toLowerCase() === 'n/a') && processed.filenameSource !== 'placeholder') {
             const extractedQuality = extractQualityFromFilename(processed.displayFilename);
             if (extractedQuality) processed.displayQuality = sanitize(extractedQuality);
         }
         if (processed.displayQuality && processed.displayQuality !== 'N/A') {
             uniqueQualities.add(processed.displayQuality);
         }

         // Date processing
         processed.lastUpdated = movie.lastUpdated || null;
         processed.lastUpdatedTimestamp = 0;
         if (processed.lastUpdated) {
             try {
                 const parsedDate = new Date(processed.lastUpdated);
                 if (!isNaN(parsedDate.getTime())) {
                     processed.lastUpdatedTimestamp = parsedDate.getTime();
                 } else { console.warn("Invalid date format for lastUpdated:", processed.lastUpdated); }
             } catch (e) { console.warn("Error parsing lastUpdated date:", processed.lastUpdated, e); }
         }

         // Numeric ID for sorting
         processed.numericId = Infinity;
         if (processed.id) {
             const parsedId = parseInt(String(processed.id).replace(/\D/g, ''), 10);
             if (!isNaN(parsedId)) processed.numericId = parsedId;
         }

         // Search text and Series detection
         processed.searchText = normalizeTextForSearch(`${processed.id || ''} ${processed.displayFilename}`);
         const seriesRegex = /(?<![a-zA-Z])S(\d{1,3})(?:E\d{1,3}|[._\-\s])|\bSeason[._\-\s]?(\d{1,3})\b/i;
         processed.isSeries = seriesRegex.test(processed.displayFilename || ''); // Added check for displayFilename

         return processed;
    }

    // --- HTML Generation ---
    function createActionContentHTML(movie) {
        const displayFilename = movie.displayFilename;
        const displaySize = movie.sizeData.display;
        const displayQuality = movie.displayQuality;
        const streamTitle = (displayFilename || '').split(/[\.\(\[]/)[0].replace(/[_ ]+/g, ' ').trim() + (displayQuality !== 'N/A' ? ` (${displayQuality})` : '');
        const formattedDateRelative = TimeAgo.format(movie.lastUpdated);
        const formattedDateFull = movie.lastUpdatedTimestamp > 0 ? TimeAgo.formatFullDate(new Date(movie.lastUpdatedTimestamp)) : 'N/A';

        let hdrLogoHtml = ''; let fourkLogoHtml = ''; const lowerFilename = (displayFilename || '').toLowerCase();
        if (displayQuality === '4K' || lowerFilename.includes('2160p') || lowerFilename.includes('.4k.')) {
           fourkLogoHtml = `<img src="${config.FOURK_LOGO_URL}" alt="4K" class="quality-logo fourk-logo" title="4K Ultra HD" />`;
        }
        if ((displayQuality || '').includes('HDR') || (displayQuality || '').includes('DOLBY VISION') || displayQuality === 'DV' || lowerFilename.includes('hdr') || lowerFilename.includes('dolby.vision') || lowerFilename.includes('.dv.')) {
           hdrLogoHtml = `<img src="${config.HDR_LOGO_URL}" alt="HDR/DV" class="quality-logo hdr-logo" title="HDR / Dolby Vision Content" />`;
        }

        const escapedStreamTitle = streamTitle.replace(/'/g, "\\'");
        const escapedFilename = displayFilename.replace(/'/g, "\\'");
        const escapedUrl = movie.url ? movie.url.replace(/'/g, "\\'") : '';
        const escapedId = movie.id ? String(movie.id).replace(/'/g, "\\'") : ''; // Escape ID for data attributes

        let actionButtonsHTML = '';
        if (movie.url) {
            actionButtonsHTML += `<button class="button play-button" data-action="play" data-title="${escapedStreamTitle}" data-url="${escapedUrl}" data-filename="${escapedFilename}">Play here</button>`;
            actionButtonsHTML += `<a class="button download-button" href="${sanitize(movie.url)}" download="${displayFilename}" target="_blank" rel="noopener noreferrer">Direct Download</a>`;
            // --- MODIFICATION: Added feedback span (using generic class) next to VLC button ---
            actionButtonsHTML += `<button class="button vlc-button" data-action="copy-vlc" data-url="${escapedUrl}">Copy URL (for VLC/MX)</button><span class="copy-feedback" role="status" aria-live="polite">Copied!</span>`;
            // --- MODIFICATION END ---
            if (navigator.userAgent.toLowerCase().includes("android")) {
                actionButtonsHTML += `<button class="button intent-button" data-action="open-intent" data-url="${escapedUrl}">Open Externally (Android)</button>`;
            }
        }
        if (movie.telegramLink) actionButtonsHTML += `<a class="button telegram-button" href="${sanitize(movie.telegramLink)}" target="_blank" rel="noopener noreferrer">Telegram File</a>`;
        if (movie.gdflixLink) {
            let gdflixButtonText = "GDFLIX"; if ((movie.gdflixLink || '').includes('/pack/')) gdflixButtonText = "GDFLIX (pack)";
            actionButtonsHTML += `<a class="button gdflix-button" href="${sanitize(movie.gdflixLink)}" target="_blank" rel="noopener noreferrer">${gdflixButtonText}</a>`;
        }
        if (movie.hubcloudLink) actionButtonsHTML += `<a class="button hubcloud-button" href="${sanitize(movie.hubcloudLink)}" target="_blank" rel="noopener noreferrer">HubCloud</a>`;
        if (movie.filepressLink) actionButtonsHTML += `<a class="button filepress-button" href="${sanitize(movie.filepressLink)}" target="_blank" rel="noopener noreferrer">Filepress</a>`;
        if (movie.gdtotLink) actionButtonsHTML += `<a class="button gdtot-button" href="${sanitize(movie.gdtotLink)}" target="_blank" rel="noopener noreferrer">GDToT</a>`;

        // Add Share Button if ID exists
        if (movie.id) {
             // Add feedback span (using generic class, specific class for styling if needed) for share fallback copy
             actionButtonsHTML += `<button class="button share-button" data-action="share" data-id="${escapedId}" data-title="${escapedStreamTitle}" data-filename="${escapedFilename}">Share Post</button><span class="copy-feedback share-fallback" role="status" aria-live="polite">Link copied!</span>`;
        }

        if (!actionButtonsHTML) {
            actionButtonsHTML = '<span style="color: var(--text-muted); font-style: italic; text-align: center; width: 100%; display: block; padding: 10px 0;">No stream/download actions available</span>';
        }

        const actionContentHTML = `
           <div class="action-info">
                <span class="info-item"><strong>Filename:</strong> ${displayFilename}</span>
                <span class="info-item"><strong>Quality:</strong> ${displayQuality} ${fourkLogoHtml}${hdrLogoHtml}</span>
                <span class="info-item"><strong>Size:</strong> ${displaySize}</span>
                <span class="info-item"><strong>Language:</strong> ${sanitize(movie.languages || 'N/A')}</span>
                <span class="info-item"><strong>Updated:</strong> ${formattedDateFull} (${formattedDateRelative})</span>
                ${movie.originalFilename ? `<span class="info-item"><strong>Original Name:</strong> ${sanitize(movie.originalFilename)}</span>` : ''}
           </div>
           <div class="action-buttons-container">
                ${actionButtonsHTML}
           </div>`;

        return actionContentHTML;
    }

    function createMovieTableRowHTML(movie, dataIndex, actionRowId) {
        const displayFilename = movie.displayFilename;
        const displaySize = movie.sizeData.display;
        const displayQuality = movie.displayQuality;
        const formattedDateRelative = TimeAgo.format(movie.lastUpdated);
        const formattedDateFull = movie.lastUpdatedTimestamp > 0 ? TimeAgo.formatFullDate(new Date(movie.lastUpdatedTimestamp)) : 'N/A';

        let hdrLogoHtml = ''; let fourkLogoHtml = ''; const lowerFilename = (displayFilename || '').toLowerCase();
        if (displayQuality === '4K' || lowerFilename.includes('2160p') || lowerFilename.includes('.4k.')) {
            fourkLogoHtml = `<img src="${config.FOURK_LOGO_URL}" alt="4K" class="quality-logo fourk-logo" title="4K Ultra HD" />`;
        }
        if ((displayQuality || '').includes('HDR') || (displayQuality || '').includes('DOLBY VISION') || displayQuality === 'DV' || lowerFilename.includes('hdr') || lowerFilename.includes('dolby.vision') || lowerFilename.includes('.dv.')) {
            hdrLogoHtml = `<img src="${config.HDR_LOGO_URL}" alt="HDR/DV" class="quality-logo hdr-logo" title="HDR / Dolby Vision Content" />`;
        }

        const mainRowHTML = `
            <tr class="movie-data-row" data-index="${dataIndex}" data-action-row-id="${actionRowId}">
                <td class="col-id">${sanitize(movie.id || 'N/A')}</td>
                <td class="col-filename" title="Click to view details: ${displayFilename}">
                    ${displayFilename}${fourkLogoHtml}${hdrLogoHtml}
                </td>
                <td class="col-size">${displaySize}</td>
                <td class="col-quality">${displayQuality}</td>
                <td class="col-updated" title="${formattedDateFull}">${formattedDateRelative}</td>
                <td class="col-view">
                    <button class="button view-button" aria-expanded="false">View</button>
                </td>
            </tr>`;
        return mainRowHTML;
    }

    // --- View Control ---
    function setViewMode(mode) {
        console.log("Setting view mode to:", mode);
        const previousMode = currentViewMode;
        currentViewMode = mode;

        // Only close player if mode changes and player is visible
        if (mode !== previousMode) {
            closePlayerIfNeeded(null); // Don't try to return focus yet
        }

        // Toggle container classes for CSS transitions/styling
        container.classList.toggle('results-active', mode === 'search');
        container.classList.toggle('shared-view-active', mode === 'shared');

        // Explicitly manage display of core sections based on the *new* mode
        const showHomepage = mode === 'homepage';
        const showSearch = mode === 'search';
        const showShared = mode === 'shared';

        if (searchFocusArea) searchFocusArea.style.display = (showHomepage || showSearch) ? 'flex' : 'none';
        if (resultsArea) resultsArea.style.display = showSearch ? 'block' : 'none';
        if (sharedItemView) sharedItemView.style.display = showShared ? 'block' : 'none';
        if (updatesPreviewSection) updatesPreviewSection.style.display = showHomepage ? 'block' : 'none';
        if (pageFooter) pageFooter.style.display = (showHomepage || showSearch) ? 'flex' : 'none';

        // Specific state resets/actions when entering a mode
        if (showHomepage) {
            if (searchInput) searchInput.value = '';
            currentState.searchTerm = '';
            if (suggestionsContainer) suggestionsContainer.style.display = 'none';
            activeResultsTab = 'allFiles';
            resetPagination();
            closeActiveActionRow('table', null); // Don't return focus yet
            closeActiveActionRow('preview', null);

            // Re-display updates if data exists and not coming from share view (handled by reload)
            if (weeklyUpdatesData.length > 0) {
                 displayInitialUpdates();
            } else if (allMovieData.length > 0) {
                 if (updatesPreviewList) updatesPreviewList.innerHTML = '<div class="status-message" style="text-align:center; padding: 15px 0;">No recent updates found in the last 7 days.</div>';
                 if (showMoreUpdatesButton) showMoreUpdatesButton.style.display = 'none';
            } else {
                 if (updatesPreviewList) updatesPreviewList.innerHTML = `<div class="loading-inline-spinner" role="status" aria-live="polite"><div class="spinner"></div><span>Loading updates...</span></div>`;
            }
            document.title = "Cinema Ghar Index"; // Reset page title
        } else if (showSearch) {
            closeActiveActionRow('preview', null);
            document.title = "Cinema Ghar Index"; // Reset page title
        } else if (showShared) {
            closeActiveActionRow('table', null);
            closeActiveActionRow('preview', null);
            // Title will be set by displaySharedItem
        }

        saveStateToLocalStorage();
    }


    // Function needs to be globally accessible for inline onclick
    window.resetToHomepage = function(event) {
        const triggerElement = event?.target; // Element that was clicked (e.g., title, back button)
        const wasInSharedView = (currentViewMode === 'shared');

        // Clear the shareId parameter from URL without reloading if NOT coming from shared view
        if (!wasInSharedView && window.history.pushState) {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.pushState({ path: cleanUrl }, '', cleanUrl);
        } else if (!wasInSharedView) {
            window.location.hash = ''; // Fallback
        }

        isDirectShareLoad = false; // Reset flag regardless

        if (wasInSharedView) {
            console.log("Returning from shared view, performing full page reload to reset.");
            // Force a reload to ensure fresh state including updates
            window.location.href = window.location.origin + window.location.pathname;
            // Script re-executes on reload
        } else {
            // Transition state normally using setViewMode
            lastFocusedElement = triggerElement; // Store element for potential focus return later
            setViewMode('homepage');
            // Attempt to focus the search input after resetting to homepage from search
            if (searchInput) {
                 setTimeout(() => searchInput.focus(), 100); // Delay slightly
            }
        }
    }

    // --- Search and Suggestions Logic ---
    function handleSearchInput() {
        clearTimeout(suggestionDebounceTimeout);
        const searchTerm = searchInput.value.trim();
        if (searchTerm.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        suggestionDebounceTimeout = setTimeout(() => {
            fetchAndDisplaySuggestions(searchTerm);
        }, config.SUGGESTIONS_DEBOUNCE_DELAY);
    }

    function fetchAndDisplaySuggestions(term) {
        const normalizedTerm = normalizeTextForSearch(term);
        if (!normalizedTerm) {
            suggestionsContainer.style.display = 'none';
            return;
        }
        const matchingItems = allMovieData.filter(movie =>
            movie.searchText.includes(normalizedTerm)
        ).slice(0, config.MAX_SUGGESTIONS);

        suggestionsContainer.innerHTML = '';
        if (matchingItems.length > 0) {
            const fragment = document.createDocumentFragment();
            matchingItems.forEach(item => {
                const div = document.createElement('div');
                let displayText = item.displayFilename;
                let highlighted = false;
                if (term.length > 0) {
                     try {
                         const safeTerm = escapeRegExp(term);
                         const regex = new RegExp(`(${safeTerm})`, 'i');
                         if ((item.displayFilename || '').match(regex)) {
                             div.innerHTML = (item.displayFilename || '').replace(regex, '<strong>$1</strong>');
                             highlighted = true;
                         }
                     } catch (e) { console.warn("Regex error during highlighting:", e); }
                }
                if (!highlighted) { div.textContent = item.displayFilename; }
                div.title = item.displayFilename;
                div.onclick = () => selectSuggestion(item.displayFilename);
                fragment.appendChild(div);
            });
            suggestionsContainer.appendChild(fragment);
            suggestionsContainer.style.display = 'block';
        } else {
            suggestionsContainer.style.display = 'none';
        }
    }

    function selectSuggestion(selectedValue) {
        searchInput.value = selectedValue;
        suggestionsContainer.style.display = 'none';
        handleSearchSubmit();
    }

    // Function needs to be globally accessible for inline onclick
    window.handleSearchSubmit = function() {
        clearTimeout(searchTimeout);
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }

        const searchTerm = searchInput.value.trim();
        console.log("Handling search submit for:", searchTerm);

        if (searchInput) {
            searchInput.blur(); // Remove focus from input
        }

        if (searchTerm.length === 0) {
            if (currentViewMode !== 'homepage') { resetToHomepage(); }
            return;
        }

        setViewMode('search'); // Transition view first
        activeResultsTab = 'allFiles';
        currentState.searchTerm = searchTerm;
        currentState.qualityFilter = qualityFilterSelect.value || '';
        resetPagination();
        showLoadingStateInTables(`Searching for "${sanitize(searchTerm)}"...`); // Show specific loading message

        searchTimeout = setTimeout(() => { // Delay actual search logic slightly
            applyFiltersAndSort();
            renderActiveResultsView();
        }, 50);
    }


    function handleSearchClear() {
        clearTimeout(suggestionDebounceTimeout);
        suggestionsContainer.style.display = 'none';
        if (currentViewMode !== 'homepage') {
             clearTimeout(searchTimeout);
             searchTimeout = setTimeout(() => {
                 if (searchInput.value.trim() === '') {
                     console.log("Search input cleared via 'x', resetting to homepage.");
                     resetToHomepage();
                 }
             }, 100);
        } else {
             currentState.searchTerm = '';
             saveStateToLocalStorage();
        }
    }

    function showLoadingStateInTables(message = 'Loading...') {
        const loadingHTML = `<tr><td colspan="6" class="loading-message" role="status" aria-live="polite">
            <div class="spinner"></div>${sanitize(message)}
        </td></tr>`;
        Object.values(tabMappings).forEach(mapping => {
            if (mapping?.tableBody) {
                mapping.tableBody.innerHTML = loadingHTML;
            }
            if (mapping?.pagination) {
                mapping.pagination.style.display = 'none';
            }
        });
    }


    // --- Updates Preview Logic ---
    function prepareWeeklyUpdatesData() {
        const now = Date.now();
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
        weeklyUpdatesData = allMovieData
            .filter(movie => movie.lastUpdatedTimestamp >= sevenDaysAgo)
            .sort((a, b) => b.lastUpdatedTimestamp - a.lastUpdatedTimestamp);
        console.log(`Found ${weeklyUpdatesData.length} updates in the last 7 days.`);
    }

    function displayInitialUpdates() {
        if (isDirectShareLoad) return; // Don't show updates if loading a shared item
        if (!updatesPreviewList || !showMoreUpdatesButton) return;

        updatesPreviewList.innerHTML = ''; // Clear previous content/spinner
        updatesPreviewShownCount = 0;
        closeActiveActionRow('preview', null);

        if (weeklyUpdatesData.length === 0) {
            updatesPreviewList.innerHTML = '<div class="status-message" style="text-align:center; padding: 15px 0;">No recent updates found in the last 7 days.</div>';
            showMoreUpdatesButton.style.display = 'none';
            return;
        }

        const initialCount = Math.min(weeklyUpdatesData.length, config.UPDATES_PREVIEW_INITIAL_COUNT);
        appendUpdatesToPreview(0, initialCount);
        updatesPreviewShownCount = initialCount;

        if (weeklyUpdatesData.length > updatesPreviewShownCount) {
            showMoreUpdatesButton.style.display = 'block';
            showMoreUpdatesButton.disabled = false;
        } else {
            showMoreUpdatesButton.style.display = 'none';
        }
    }

    // Function needs to be globally accessible for inline onclick
    window.appendMoreUpdates = function() {
        if (!updatesPreviewList || !showMoreUpdatesButton) return;
        const currentCount = updatesPreviewShownCount;
        const nextCount = Math.min(weeklyUpdatesData.length, currentCount + config.UPDATES_PREVIEW_LOAD_MORE_COUNT);
        if (nextCount > currentCount) {
            appendUpdatesToPreview(currentCount, nextCount);
            updatesPreviewShownCount = nextCount;
        }
        if (updatesPreviewShownCount >= weeklyUpdatesData.length) {
            showMoreUpdatesButton.disabled = true;
            showMoreUpdatesButton.textContent = "All Updates Shown";
        }
    }

    function appendUpdatesToPreview(startIndex, endIndex) {
         if (!updatesPreviewList) return;
         const fragment = document.createDocumentFragment();
         for (let i = startIndex; i < endIndex; i++) {
            const movie = weeklyUpdatesData[i];
            if (!movie) continue; // Safety check
            const itemDiv = document.createElement('div');
            itemDiv.className = 'update-item';
            const uniqueIdPart = movie.id ? String(movie.id).replace(/[^a-zA-Z0-9-_]/g, '') : `gen-${i}`;
            const actionRowId = `preview-actions-${uniqueIdPart}-${i}`;

            itemDiv.dataset.index = i;
            itemDiv.dataset.actionRowId = actionRowId;

            let hdrLogoHtml = ''; let fourkLogoHtml = ''; const lowerFilename = (movie.displayFilename || '').toLowerCase();
            if (movie.displayQuality === '4K' || lowerFilename.includes('2160p') || lowerFilename.includes('.4k.')) {
                fourkLogoHtml = `<img src="${config.FOURK_LOGO_URL}" alt="4K" class="quality-logo fourk-logo" title="4K Ultra HD" />`;
            }
            if ((movie.displayQuality || '').includes('HDR') || (movie.displayQuality || '').includes('DOLBY VISION') || movie.displayQuality === 'DV' || lowerFilename.includes('hdr') || lowerFilename.includes('dolby.vision') || lowerFilename.includes('.dv.')) {
                hdrLogoHtml = `<img src="${config.HDR_LOGO_URL}" alt="HDR/DV" class="quality-logo hdr-logo" title="HDR / Dolby Vision Content" />`;
            }

            itemDiv.innerHTML = `
                <div class="preview-col-id" title="ID: ${sanitize(movie.id || 'N/A')}">${sanitize(movie.id || 'N/A')}</div>
                <div class="preview-col-filename" title="${movie.displayFilename}">
                    ${sanitize(movie.displayFilename)}${fourkLogoHtml}${hdrLogoHtml}
                </div>
                <div class="preview-col-date" title="${TimeAgo.formatFullDate(new Date(movie.lastUpdatedTimestamp))}">${TimeAgo.format(movie.lastUpdated)}</div>
                <div class="preview-col-view">
                    <button class="button view-button" aria-expanded="false">View</button>
                </div>
            `;
            fragment.appendChild(itemDiv);

            const actionRowDiv = document.createElement('div');
            actionRowDiv.id = actionRowId;
            actionRowDiv.className = 'preview-action-row';
            actionRowDiv.style.display = 'none';
            actionRowDiv.dataset.parentItemId = itemDiv.id; // Maybe needed?
            fragment.appendChild(actionRowDiv);
         }
         updatesPreviewList.appendChild(fragment);
    }


    // --- Filtering, Sorting, and Data Handling ---
    function applyFiltersAndSort() {
        console.time("applyFiltersAndSort");
        let baseData;
        if (currentViewMode === 'search' && currentState.searchTerm) {
            const normalizedSearch = normalizeTextForSearch(currentState.searchTerm);
            const searchKeywords = normalizedSearch.split(' ').filter(Boolean);

            if (searchKeywords.length > 0) {
                baseData = allMovieData.filter(movie =>
                     searchKeywords.every(keyword => (movie.searchText || '').includes(keyword))
                );
            } else {
                baseData = [];
            }
        } else {
            // If not in search mode or no search term, currentViewData should be empty
            currentViewData = [];
            console.timeEnd("applyFiltersAndSort");
            return;
        }

        let filteredData = baseData;
        if (currentState.qualityFilter) {
            filteredData = baseData.filter(movie => movie.displayQuality === currentState.qualityFilter);
        }

        const sortKey = currentState.sortColumn;
        const direction = currentState.sortDirection === 'asc' ? 1 : -1;
        filteredData.sort((a, b) => {
            let valA, valB;
            switch (sortKey) {
                case 'id': valA = a.numericId; valB = b.numericId; break;
                case 'filename': valA = (a.displayFilename || '').toLowerCase(); valB = (b.displayFilename || '').toLowerCase(); break;
                case 'size': valA = a.sizeData?.bytes || 0; valB = b.sizeData?.bytes || 0; break; // Added default 0
                case 'quality': valA = (a.displayQuality || '').toLowerCase(); valB = (b.displayQuality || '').toLowerCase(); break;
                case 'lastUpdated': default: valA = a.lastUpdatedTimestamp || 0; valB = b.lastUpdatedTimestamp || 0; break; // Added default 0
            }
            // Simplified comparison
            const aIsInvalid = (valA === null || typeof valA === 'undefined' || (typeof valA === 'number' && isNaN(valA)));
            const bIsInvalid = (valB === null || typeof valB === 'undefined' || (typeof valB === 'number' && isNaN(valB)));
            if (aIsInvalid && bIsInvalid) return 0;
            if (aIsInvalid) return 1 * direction; // Invalid values sort last
            if (bIsInvalid) return -1 * direction;

            if (valA < valB) return -1 * direction;
            if (valA > valB) return 1 * direction;

            // Secondary sort criteria (Updated first, then ID)
            if (sortKey !== 'lastUpdated') {
                const timeDiff = (b.lastUpdatedTimestamp || 0) - (a.lastUpdatedTimestamp || 0);
                if (timeDiff !== 0) return timeDiff;
            }
            if (sortKey !== 'id') {
                return (a.numericId || Infinity) - (b.numericId || Infinity);
            }
            return 0;
        });

        currentViewData = filteredData;
        saveStateToLocalStorage();
        console.timeEnd("applyFiltersAndSort");
        console.log(`Applied filters/sort for SEARCH "${currentState.searchTerm}". currentViewData has ${currentViewData.length} items.`);
    }


    function triggerFilterChange() {
         if (!qualityFilterSelect) return;
         const newQualityFilter = qualityFilterSelect.value;
         if (newQualityFilter !== currentState.qualityFilter) {
             currentState.qualityFilter = newQualityFilter;
             resetPagination();
             closePlayerIfNeeded(null);
             showLoadingStateInTables(`Applying filter: ${sanitize(newQualityFilter || 'All Qualities')}...`);
             setTimeout(() => {
                applyFiltersAndSort();
                renderActiveResultsView();
             }, 50);
         }
    }

    function handleSort(event) {
        const header = event.target.closest('th.sortable');
        if (!header || currentViewMode !== 'search') return; // Only sort in search view
        const sortKey = header.dataset.sortKey;
        if (!sortKey) return;

        if (currentState.sortColumn === sortKey) {
            currentState.sortDirection = currentState.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentState.sortColumn = sortKey;
            // Default sort directions for specific columns
            currentState.sortDirection = ['filename', 'quality'].includes(sortKey) ? 'asc' : 'desc';
        }

        resetPagination();
        closePlayerIfNeeded(null);
        showLoadingStateInTables(`Sorting by ${sanitize(sortKey)} (${currentState.sortDirection})...`);
        setTimeout(() => {
            applyFiltersAndSort();
            renderActiveResultsView();
        }, 50);
    }


    // --- Rendering Logic ---
    function renderActiveResultsView() {
        if (currentViewMode !== 'search' || !tabMappings[activeResultsTab]) {
            if (currentViewMode === 'search') {
                showLoadingStateInTables('Enter search term above.');
            }
            return;
        }
        console.log(`Rendering SEARCH results view for tab: ${activeResultsTab}`);
        console.time("renderActiveResultsView");

        let dataForThisTab;
        if (activeResultsTab === 'movies') dataForThisTab = currentViewData.filter(m => !m.isSeries);
        else if (activeResultsTab === 'series') dataForThisTab = currentViewData.filter(m => m.isSeries);
        else dataForThisTab = currentViewData; // 'allFiles'

        const { tableBody, pagination, pageKey, tableHead } = tabMappings[activeResultsTab];
        if (!tableBody || !pagination) {
            console.error("Missing table body or pagination controls for tab:", activeResultsTab);
            console.timeEnd("renderActiveResultsView");
            return;
        }

        const currentPage = currentState[pageKey];
        const totalItems = dataForThisTab.length;
        const totalPages = Math.ceil(totalItems / config.ITEMS_PER_PAGE);

        // Validate current page
        let validatedPage = currentPage;
        if (validatedPage < 1) validatedPage = 1;
        if (validatedPage > totalPages && totalPages > 0) validatedPage = totalPages;
        if (totalItems === 0) validatedPage = 1;
        if (validatedPage !== currentPage) {
            currentState[pageKey] = validatedPage;
        }

        const startIndex = (validatedPage - 1) * config.ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + config.ITEMS_PER_PAGE, totalItems);
        const pageData = dataForThisTab.slice(startIndex, endIndex);

        let tableHtml = '';
        if (totalItems === 0) {
            let message = `No ${activeResultsTab === 'movies' ? 'movies' : activeResultsTab === 'series' ? 'series' : 'files'} found`;
            if (currentState.searchTerm) message += ` matching "${sanitize(currentState.searchTerm)}"`;
            if (currentState.qualityFilter) message += ` with quality "${sanitize(currentState.qualityFilter)}"`;
            message += '.';
            tableHtml = `<tr><td colspan="6" class="status-message">${message}</td></tr>`;
        } else {
            pageData.forEach((movie, indexOnPage) => {
                // Find the index in the *original* `currentViewData` to ensure stable IDs/linking
                const overallIndex = currentViewData.findIndex(item => item.id === movie.id && item.url === movie.url); // More robust check
                 if (overallIndex === -1) {
                     console.warn("Movie from pageData not found in currentViewData by ID/URL:", movie);
                     // Fallback: use index within the filtered tab data if absolutely necessary, but this is less ideal
                     // overallIndex = currentViewData.indexOf(movie);
                     return; // Safer to skip if not found reliably
                 }
                const uniqueIdPart = movie.id ? String(movie.id).replace(/[^a-zA-Z0-9-_]/g, '') : `gen-${overallIndex}`;
                const actionRowId = `${activeResultsTab}-actions-${uniqueIdPart}-${overallIndex}`;

                tableHtml += createMovieTableRowHTML(movie, overallIndex, actionRowId); // Pass the overall index
            });
        }
        tableBody.innerHTML = tableHtml;

        renderPaginationControls(pagination, totalItems, validatedPage);

        updateActiveTabAndPanel();
        if (tableHead) updateSortIndicators(tableHead);
        updateFilterIndicator();
        closeActiveActionRow('table', null); // Close any previously open row in this tab

        console.timeEnd("renderActiveResultsView");
    }


    function renderPaginationControls(targetContainer, totalItems, currentPage) {
        if (!targetContainer) return;
        const totalPages = Math.ceil(totalItems / config.ITEMS_PER_PAGE);

        // Recalculate validated page within this function scope
        if (currentPage < 1) currentPage = 1;
        if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
        if (totalItems === 0) currentPage = 1;

        targetContainer.innerHTML = '';
        if (totalPages <= 1) {
            targetContainer.style.display = 'none';
            return;
        }

        let paginationHTML = '';
        const maxPagesToShow = 5; // Number of page buttons to show around current page
        const halfPages = Math.floor(maxPagesToShow / 2);

        paginationHTML += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled title="First page"' : 'title="Previous page"'}>« Prev</button>`;

        // Determine start and end page numbers for the main block
        let startPage, endPage;
        if (totalPages <= maxPagesToShow + 2) { // Show all pages if not many total
            startPage = 1;
            endPage = totalPages;
        } else {
            startPage = Math.max(2, currentPage - halfPages);
            endPage = Math.min(totalPages - 1, currentPage + halfPages);

            // Adjust if near the beginning or end
            if (currentPage - halfPages < 2) {
                endPage = Math.min(totalPages - 1, maxPagesToShow);
            }
            if (currentPage + halfPages > totalPages - 1) {
                startPage = Math.max(2, totalPages - maxPagesToShow + 1);
            }
        }

        // Add '1' and '...' if needed
        if (startPage > 1) {
            paginationHTML += `<button onclick="changePage(1)" title="Page 1">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span class="page-info" title="Skipped pages">...</span>`;
            }
        }

        // Add page numbers in the main block
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += (i === currentPage) ? `<span class="current-page">${i}</span>` : `<button onclick="changePage(${i})" title="Page ${i}">${i}</button>`;
        }

        // Add '...' and last page if needed
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span class="page-info" title="Skipped pages">...</span>`;
            }
            paginationHTML += `<button onclick="changePage(${totalPages})" title="Page ${totalPages}">${totalPages}</button>`;
        }


        paginationHTML += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled title="Last page"' : 'title="Next page"'}>Next »</button>`;

        targetContainer.innerHTML = paginationHTML;
        targetContainer.style.display = 'block';
    }


    function updateSortIndicators(tableHeadElement) {
         if (!tableHeadElement) return;
         tableHeadElement.querySelectorAll('th.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            const sortKey = th.dataset.sortKey;
            if (sortKey === currentState.sortColumn) {
                const directionClass = currentState.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc';
                th.classList.add(directionClass);
                th.setAttribute('aria-sort', currentState.sortDirection === 'asc' ? 'ascending' : 'descending');
            } else {
                th.removeAttribute('aria-sort');
            }
         });
    }

    function updateFilterIndicator() {
        if(qualityFilterSelect) {
            qualityFilterSelect.classList.toggle('filter-active', !!currentState.qualityFilter);
        }
    }

    function updateActiveTabAndPanel() {
        Object.keys(tabMappings).forEach(tabId => {
            const mapping = tabMappings[tabId];
            const isActive = tabId === activeResultsTab;
            if (mapping?.button) mapping.button.classList.toggle('active', isActive);
            if (mapping?.panel) mapping.panel.classList.toggle('active', isActive);
        });
    }

    // --- Pagination and Tab Switching ---
    function resetPagination() {
        currentState.currentPageAll = 1;
        currentState.currentPageMovies = 1;
        currentState.currentPageSeries = 1;
    }

    // Function needs to be globally accessible for inline onclick
    window.changePage = function(newPage) {
        if (currentViewMode !== 'search' || !tabMappings[activeResultsTab]) return;
        const { pageKey } = tabMappings[activeResultsTab];
        const currentPage = currentState[pageKey];

        // Determine total pages for the current tab's data
        let dataForThisTab;
        if (activeResultsTab === 'movies') dataForThisTab = currentViewData.filter(m => !m.isSeries);
        else if (activeResultsTab === 'series') dataForThisTab = currentViewData.filter(m => m.isSeries);
        else dataForThisTab = currentViewData;
        const totalItems = dataForThisTab.length;
        const totalPages = Math.ceil(totalItems / config.ITEMS_PER_PAGE);

        // Validate the new page number
        if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
            currentState[pageKey] = newPage;
            closePlayerIfNeeded(null); // Close player without focus return
            renderActiveResultsView(); // Re-render the view for the new page
            saveStateToLocalStorage();

            // Scroll to the top of the table smoothly
            const activeTableBody = tabMappings[activeResultsTab]?.tableBody;
            scrollToTopOfActiveTable(activeTableBody);
        }
    }

    function scrollToTopOfActiveTable(tableBodyElement) {
        if (!tableBodyElement) return;
        const tableContainer = tableBodyElement.closest('.table-container');
        if (tableContainer) {
            // Calculate the offset based on sticky elements
            const searchBarArea = container.querySelector('#search-focus-area');
            const backButtonElem = resultsArea.querySelector('#backToHomeButtonResults');
            const filterArea = resultsArea.querySelector('.results-filter-area');
            const tabNav = resultsArea.querySelector('.tab-navigation');

            let stickyHeaderHeight = 0;
            if (container.classList.contains('results-active')) {
                 stickyHeaderHeight = (searchBarArea?.offsetHeight || 0) +
                                      (backButtonElem?.offsetHeight || 0) + (backButtonElem ? parseFloat(getComputedStyle(backButtonElem).marginBottom) : 0) +
                                      (filterArea?.offsetHeight || 0) +
                                      (tabNav?.offsetHeight || 0);
            }

            const elementTop = tableContainer.getBoundingClientRect().top + window.pageYOffset;
            const scrollPosition = elementTop - stickyHeaderHeight - 20; // 20px buffer

            window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
        }
    }

    // Function needs to be globally accessible for inline onclick
    window.switchTab = function(tabId) {
        if (currentViewMode !== 'search' || tabId === activeResultsTab || !tabMappings[tabId]) return;
        activeResultsTab = tabId;
        closePlayerIfNeeded(null);
        closeActiveActionRow('table', null); // Close action row in the *old* tab
        renderActiveResultsView(); // Renders the new tab
        saveStateToLocalStorage();
    }


    // --- Action Row Logic (Table vs Preview) ---
    function closeActiveActionRow(type = 'any', elementToFocusAfter = null) {
        let rowToClose = null;
        let mainElement = null;
        let buttonElement = null;

        if ((type === 'table' || type === 'any') && activeTableActionRow) {
            rowToClose = activeTableActionRow;
            mainElement = rowToClose.previousElementSibling;
            if (mainElement) buttonElement = mainElement.querySelector('.view-button');
            activeTableActionRow = null; // Clear reference *before* potential player close
        } else if ((type === 'preview' || type === 'any') && activePreviewActionRow) {
            rowToClose = activePreviewActionRow;
            mainElement = rowToClose.previousElementSibling;
            if (mainElement) buttonElement = mainElement.querySelector('.view-button');
            activePreviewActionRow = null; // Clear reference *before* potential player close
        }

        if (rowToClose && rowToClose.style.display !== 'none') {
            // Check if the player is inside the row being closed
            const isPlayerInside = videoContainer?.parentElement === rowToClose ||
                                  (rowToClose.matches('tr.action-row') && videoContainer?.parentElement === rowToClose.querySelector('td')) ||
                                  (rowToClose.matches('.preview-action-row') && videoContainer?.parentElement === rowToClose);

            if (isPlayerInside) {
                // Close player *first* if it's inside, passing the intended focus element
                closePlayer(elementToFocusAfter || buttonElement || mainElement);
            }

            // Hide or remove the action row/div itself
            rowToClose.style.display = 'none';
            if (mainElement) mainElement.classList.remove('active-main-row');
            if (buttonElement) {
                buttonElement.textContent = 'View';
                buttonElement.setAttribute('aria-expanded', 'false');
            }

            // Clear content for preview row / remove table row
            if (rowToClose.classList.contains('preview-action-row')) {
                rowToClose.innerHTML = '';
            } else if (rowToClose.matches('tr.action-row')) {
                if (rowToClose.parentElement) { // Check if it wasn't already removed by closePlayer
                    rowToClose.remove();
                }
            }

            // Return focus if player wasn't inside and elementToFocusAfter is provided
            if (!isPlayerInside && elementToFocusAfter && typeof elementToFocusAfter.focus === 'function') {
                setTimeout(() => elementToFocusAfter.focus(), 50); // Delay focus slightly
            }
        }
    }


    function toggleTableActions(mainRowElement, triggerElement = null) {
        if (!mainRowElement || !mainRowElement.matches('.movie-data-row')) return;

        const targetRowId = mainRowElement.dataset.actionRowId;
        const dataIndex = parseInt(mainRowElement.dataset.index, 10);
        if (!targetRowId || isNaN(dataIndex)) { console.error("Missing data attributes on table row:", mainRowElement); return; }

        const buttonElement = mainRowElement.querySelector('.view-button');
        if (!buttonElement) { console.error("Could not find view button in row:", mainRowElement); return; }

        const isCurrentlyAssociatedActiveRow = activeTableActionRow && activeTableActionRow.id === targetRowId;
        const elementToFocusAfterClose = triggerElement || buttonElement; // Element that initiated the toggle

        // Close any other open rows (table or preview) or player first
        if (!isCurrentlyAssociatedActiveRow) {
            closePlayerIfNeeded(elementToFocusAfterClose); // Close player if open elsewhere
            closeActiveActionRow('any', elementToFocusAfterClose); // Close other rows
        }

        if (isCurrentlyAssociatedActiveRow) {
            // If clicking the active row's trigger again, close it
            closeActiveActionRow('table', elementToFocusAfterClose);
        } else {
            // Open the new action row
            const movie = currentViewData[dataIndex];
            if (!movie) { console.error("Movie data not found for index:", dataIndex); return; }

            let targetRow = document.getElementById(targetRowId);
            if (!targetRow) { // Create if doesn't exist
                targetRow = document.createElement('tr');
                targetRow.id = targetRowId;
                targetRow.className = 'action-row';
                const colspanValue = mainRowElement.cells.length || 6;
                targetRow.innerHTML = `<td colspan="${colspanValue}">${createActionContentHTML(movie)}</td>`;
                mainRowElement.parentNode.insertBefore(targetRow, mainRowElement.nextSibling);
            } else { // Update content if exists
                 const colspanValue = mainRowElement.cells.length || 6;
                 targetRow.innerHTML = `<td colspan="${colspanValue}">${createActionContentHTML(movie)}</td>`;
            }

            targetRow.style.display = 'table-row';
            buttonElement.textContent = 'Hide';
            buttonElement.setAttribute('aria-expanded', 'true');
            mainRowElement.classList.add('active-main-row');
            activeTableActionRow = targetRow; // Set this as the active row

            // Move focus into the newly opened action row
            focusFirstElementInContainer(targetRow);
            scrollToRowIfNeeded(mainRowElement);
        }
    }


    function togglePreviewActions(mainItemDiv, triggerElement = null) {
         if (!mainItemDiv || !mainItemDiv.matches('.update-item')) return;

         const movieIndex = parseInt(mainItemDiv.dataset.index, 10);
         const targetRowId = mainItemDiv.dataset.actionRowId;
         if (isNaN(movieIndex) || !targetRowId) { console.error("Missing data attributes on preview item.", mainItemDiv); return; }

         const targetRowDiv = document.getElementById(targetRowId);
         const buttonElement = mainItemDiv.querySelector('.view-button');
         if (!targetRowDiv || !buttonElement) { console.error("Target action div or button not found.", targetRowId); return; }

         const isCurrentlyAssociatedActiveRow = activePreviewActionRow && activePreviewActionRow.id === targetRowId;
         const elementToFocusAfterClose = triggerElement || buttonElement; // Element that initiated the toggle

         // Close any other open rows (table or preview) or player first
         if (!isCurrentlyAssociatedActiveRow) {
             closePlayerIfNeeded(elementToFocusAfterClose);
             closeActiveActionRow('any', elementToFocusAfterClose);
         }

         if (isCurrentlyAssociatedActiveRow) {
             // If clicking the active item's trigger again, close it
             closeActiveActionRow('preview', elementToFocusAfterClose);
         } else {
             // Open the new action div
             const movie = weeklyUpdatesData[movieIndex];
             if (!movie) { console.error("Movie data not found for preview index:", movieIndex); return; }

             const actionContentHTML = createActionContentHTML(movie);
             targetRowDiv.innerHTML = actionContentHTML; // Populate content

             targetRowDiv.style.display = 'block';
             buttonElement.textContent = 'Hide';
             buttonElement.setAttribute('aria-expanded', 'true');
             mainItemDiv.classList.add('active-main-row');
             activePreviewActionRow = targetRowDiv; // Set this as the active div

             // Move focus into the newly opened action div
             focusFirstElementInContainer(targetRowDiv);
             scrollToRowIfNeeded(mainItemDiv);
         }
    }

    function scrollToRowIfNeeded(mainElement) {
        setTimeout(() => {
            mainElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }

    function focusFirstElementInContainer(containerElement) {
        if (!containerElement) return;
        // Find the first focusable element (button or link)
        const firstFocusable = containerElement.querySelector('button, a[href]');
        if (firstFocusable) {
            setTimeout(() => firstFocusable.focus(), 50); // Delay focus slightly
        }
    }

    // --- Share Logic ---
    async function handleShareClick(buttonElement) {
        const itemId = buttonElement.dataset.id;
        const itemTitle = buttonElement.dataset.title || "Cinema Ghar Item";
        const itemFilename = buttonElement.dataset.filename || "";

        if (!itemId) {
            console.error("Share failed: Item ID missing.");
            alert("Cannot share this item (missing ID).");
            return;
        }

        // Construct the shareable URL
        const shareUrl = `${window.location.origin}${window.location.pathname}?shareId=${encodeURIComponent(itemId)}`;
        const shareText = `Check out: ${itemTitle}\n${itemFilename ? `(${itemFilename})\n` : ''}`;

        // Find the adjacent feedback span
        const feedbackSpan = buttonElement.nextElementSibling;
        if (!feedbackSpan || !feedbackSpan.classList.contains('copy-feedback')) {
            console.warn("Share fallback feedback span not found next to button:", buttonElement);
            // Proceed without visual feedback on fallback copy
        }

        if (navigator.share) {
            try {
                await navigator.share({
                    title: itemTitle,
                    text: shareText,
                    url: shareUrl,
                });
                console.log('Successful share');
            } catch (error) {
                console.error('Error sharing:', error);
                if (error.name !== 'AbortError') {
                    // Show error in the feedback span if available
                    if (feedbackSpan) {
                        showCopyFeedback(feedbackSpan, 'Share failed!', true); // isError=true
                    } else {
                        alert(`Share failed: ${error.message}`); // Fallback alert
                    }
                }
            }
        } else {
            console.log('Web Share API not supported, falling back to copy.');
            // Fallback: Copy the share URL to clipboard, use the feedback span if found
            await copyToClipboard(shareUrl, feedbackSpan);
        }
    }

    // --- Shared Item Display Logic ---
    function displaySharedItem(shareId) {
        if (!shareId || !sharedItemView || !sharedItemContent) return;

        const sharedMovie = allMovieData.find(movie => String(movie.id) === String(shareId));

        if (sharedMovie) {
            console.log("Displaying shared item:", sharedMovie.displayFilename);
            const actionHTML = createActionContentHTML(sharedMovie);
            sharedItemContent.innerHTML = actionHTML;
            // Set page title
            document.title = `${sharedMovie.displayFilename || 'Shared Item'} - Cinema Ghar`;
            // Ensure player is not visible initially
            if (videoContainer) videoContainer.style.display = 'none';

        } else {
            console.error("Shared item not found for ID:", shareId);
            sharedItemContent.innerHTML = `<div class="error-message" role="alert">Error: Shared item with ID ${sanitize(shareId)} was not found. It might have been removed or the link is incorrect.</div>`;
            document.title = "Item Not Found - Cinema Ghar Index";
        }

        // Set view mode AFTER content is potentially set
        setViewMode('shared');
        // Scroll to top smoothly after content is rendered
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- Player Logic ---
    function streamVideo(title, url, filenameForAudioCheck) {
        // Determine the correct container: action row (table/preview) or shared content div
        let currentActionContainer = null;
        if (currentViewMode === 'shared' && sharedItemContent) {
            currentActionContainer = sharedItemContent; // Player goes inside shared content
        } else {
            const currentActiveRow = activeTableActionRow || activePreviewActionRow;
            if (!currentActiveRow) {
                console.error("Cannot stream: active action row/div missing."); return;
            }
            // Get the direct container (TD for table, the div itself for preview)
            currentActionContainer = currentActiveRow.matches('tr.action-row')
                                    ? currentActiveRow.querySelector('td')
                                    : currentActiveRow.matches('.preview-action-row') ? currentActiveRow : null;
        }

        if (!videoContainer || !videoElement || !currentActionContainer) {
            console.error("Cannot stream: player, video element, or action container missing.", { videoContainer, videoElement, currentActionContainer });
            return;
        }

        // If the video container is not already inside the correct action container, move it.
        if (videoContainer.parentElement !== currentActionContainer) {
            console.log("Moving video container to active container.");
            if (videoElement && videoElement.hasAttribute('src')) {
                videoElement.pause();
                videoElement.removeAttribute('src');
                videoElement.currentTime = 0; // Reset time
                videoElement.load(); // Important to reset state fully
            }
            // Reset player visual state before moving
            if (vlcBox) vlcBox.style.display = 'none';
            if (audioWarningDiv) audioWarningDiv.style.display = 'none';
            if (audioTrackSelect) { audioTrackSelect.innerHTML = ''; audioTrackSelect.style.display = 'none'; }
            clearCopyFeedback(); // Clear feedback spans inside vlcBox

            currentActionContainer.appendChild(videoContainer); // Append to the correct container
        }

        // Reset warnings/options for the new video
        if (audioWarningDiv) { audioWarningDiv.style.display = 'none'; audioWarningDiv.innerHTML = ''; }
        if (audioTrackSelect) { audioTrackSelect.innerHTML = ''; audioTrackSelect.style.display = 'none'; }
        clearCopyFeedback(); // Clear feedback spans inside vlcBox again

        // Restore saved settings or defaults
        const savedVolume = localStorage.getItem(config.PLAYER_VOLUME_KEY);
        const savedSpeed = localStorage.getItem(config.PLAYER_SPEED_KEY);
        videoElement.volume = (savedVolume !== null) ? Math.max(0, Math.min(1, parseFloat(savedVolume))) : 1;
        if (volumeSlider) volumeSlider.value = videoElement.volume;
        videoElement.muted = (videoElement.volume === 0);
        videoElement.playbackRate = (savedSpeed !== null) ? parseFloat(savedSpeed) : 1;
        if(playbackSpeedSelect) playbackSpeedSelect.value = String(videoElement.playbackRate);
        updateMuteButton();
        videoElement.currentTime = 0; // Ensure start from beginning

        // Display audio warnings based on filename
        const ddp51Regex = /\bDDP?([ ._-]?5\.1)?\b/i;
        const advancedAudioRegex = /\b(DTS|ATMOS|TrueHD)\b/i;
        const multiAudioHintRegex = /\b(Multi|Dual)[ ._-]?Audio\b/i;
        let warningText = "";
        if (filenameForAudioCheck) {
            const lowerFilename = (filenameForAudioCheck || '').toLowerCase();
            if (ddp51Regex.test(lowerFilename)) {
                warningText = "<strong>Audio Note:</strong> DDP audio might not work in browser. Use 'Copy URL' or 'Open Externally'.";
            } else if (advancedAudioRegex.test(lowerFilename)) {
                warningText = "<strong>Audio Note:</strong> DTS/Atmos/TrueHD audio likely unsupported. Use external player.";
            } else if (multiAudioHintRegex.test(lowerFilename)) {
                 warningText = "<strong>Audio Note:</strong> May contain multiple audio tracks. Use selector below or external player.";
            }
        }
        if (warningText && audioWarningDiv) {
            audioWarningDiv.innerHTML = warningText;
            audioWarningDiv.style.display = 'block';
        }

        // Set titles and URLs
        if (videoTitle) videoTitle.innerText = title;
        if (vlcText) vlcText.innerText = url;
        if (vlcBox) vlcBox.style.display = 'block'; // Show the VLC box

        // Load and play
        videoElement.src = url;
        videoElement.load(); // Start loading
        videoElement.play().catch(e => {
            console.log("Autoplay was prevented or failed:", e.message);
            // Optionally, show a play button overlay if autoplay fails severely
        });
        videoContainer.style.display = 'flex'; // Make player visible

        // Focus the close button and scroll into view
        const closeButton = videoContainer.querySelector('.close-btn');
        if (closeButton) {
            setTimeout(() => closeButton.focus(), 100);
        }
        setTimeout(() => {
            videoContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
    }


    // Function needs to be globally accessible for inline onclick
    window.closePlayer = function(elementToFocusAfter = null) { // Accept event or element
         if (elementToFocusAfter instanceof Event) {
             // If event is passed, try to get the target, otherwise null
             elementToFocusAfter = elementToFocusAfter?.target;
         }

        if (!videoContainer || !videoElement) return;
        const wasPlaying = videoContainer.style.display !== 'none';
        const parentContainer = videoContainer.parentElement; // Store parent before detaching

        try {
            const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
            if (fsElement && (fsElement === videoElement || fsElement === videoContainer)) {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            }
        } catch(err) { console.error("Error exiting fullscreen:", err); }

        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.currentTime = 0; // Explicitly reset time
        videoElement.load(); // Reset player state

        videoContainer.style.display = 'none'; // Hide the container
        if (vlcBox) vlcBox.style.display = 'none';
        if (audioWarningDiv) { audioWarningDiv.style.display = 'none'; audioWarningDiv.innerHTML = ''; }
        if (audioTrackSelect) { audioTrackSelect.innerHTML = ''; audioTrackSelect.style.display = 'none'; }
        clearCopyFeedback(); // Clear feedback spans inside vlcBox
        if (videoTitle) videoTitle.innerText = '';

        if (videoContainer.classList.contains('is-fullscreen')) {
            videoContainer.classList.remove('is-fullscreen');
        }

        // Detach player and move back to main container if necessary
        const mainBodyContainer = document.getElementById('cinemaghar-container');
        if (mainBodyContainer && videoContainer.parentElement !== mainBodyContainer) {
            mainBodyContainer.appendChild(videoContainer);
            console.log("Moved video player back to main container.");
        } else if (!mainBodyContainer) {
            console.warn("Main container #cinemaghar-container not found, cannot move player back.");
        }

        // Reset associated row/item state *after* potentially moving the player
        if (wasPlaying && parentContainer?.closest('.action-row, .preview-action-row')) {
            const parentActionRow = parentContainer.closest('.action-row, .preview-action-row');
            if (parentActionRow) {
                const mainElement = parentActionRow.previousElementSibling;
                if (mainElement) {
                     const viewButton = mainElement.querySelector('.view-button');
                     if (viewButton && viewButton.getAttribute('aria-expanded') === 'true') {
                         viewButton.textContent = 'View';
                         viewButton.setAttribute('aria-expanded', 'false');
                     }
                     mainElement.classList.remove('active-main-row');
                }
                // Hide the action row itself if it wasn't already hidden or removed
                if (parentActionRow.style.display !== 'none') {
                     parentActionRow.style.display = 'none';
                     if (parentActionRow.classList.contains('preview-action-row')) {
                         parentActionRow.innerHTML = ''; // Clear preview content
                     }
                }
            }
        } else if (wasPlaying && currentViewMode === 'shared') {
             console.log("Closed player within shared view.");
        }

        // --- Focus Management ---
        // Determine the final element to focus
        let finalFocusTarget = elementToFocusAfter || lastFocusedElement;

        // Special case: If closing player triggered by closing an action row, focus the trigger of *that* row
        const closedRowId = parentContainer?.closest('.action-row, .preview-action-row')?.id;
         if (activeTableActionRow?.id === closedRowId || activePreviewActionRow?.id === closedRowId) {
             // The closeActiveActionRow function will handle focus return in this case
             finalFocusTarget = null; // Prevent double focus return
         }

        if (finalFocusTarget && typeof finalFocusTarget.focus === 'function') {
            console.log("Returning focus to:", finalFocusTarget);
            setTimeout(() => finalFocusTarget.focus(), 50); // Delay focus slightly
        }
        lastFocusedElement = null; // Clear after use

        // Reset the active row references if they match the parent's row ID
        // Do this *after* focus logic, in case the row itself was the focus target
        if (activeTableActionRow && activeTableActionRow.id === closedRowId) {
            activeTableActionRow = null;
        }
        if (activePreviewActionRow && activePreviewActionRow.id === closedRowId) {
            activePreviewActionRow = null;
        }
    }


    function closePlayerIfNeeded(elementToFocusAfter = null) {
        if (videoContainer?.style.display === 'flex' || videoContainer?.style.display === 'block') {
            closePlayer(elementToFocusAfter);
        }
    }

    // Functions need to be globally accessible for inline onclick
    window.seekVideo = function(seconds) { if (videoElement) videoElement.currentTime += seconds; }
    window.toggleMute = function() { if (videoElement) videoElement.muted = !videoElement.muted; }
    window.setVolume = function(value) { if (videoElement) { const vol = parseFloat(value); videoElement.volume = vol; videoElement.muted = (vol === 0); } }
    window.setPlaybackSpeed = function(value) { if (videoElement) videoElement.playbackRate = parseFloat(value); }
    window.toggleFullscreen = function() { const elementToMakeFullscreen = videoContainer; if (!elementToMakeFullscreen) return; const fsElement = document.fullscreenElement || document.webkitFullscreenElement; try { if (!fsElement) { if (elementToMakeFullscreen.requestFullscreen) elementToMakeFullscreen.requestFullscreen(); else if (elementToMakeFullscreen.webkitRequestFullscreen) elementToMakeFullscreen.webkitRequestFullscreen(); } else { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); } } catch (err) { console.error("Fullscreen API error:", err); alert("Fullscreen mode failed. Browser might block it."); } }
    window.changeAudioTrack = function(selectElement) { if (!videoElement || !videoElement.audioTracks) return; const selectedTrackValue = selectElement.value; const tracks = videoElement.audioTracks; let trackChanged = false; for (let i = 0; i < tracks.length; i++) { const track = tracks[i]; const isSelectedTrack = (track.id && track.id === selectedTrackValue) || String(i) === selectedTrackValue; if (track.enabled !== isSelectedTrack) { try { track.enabled = isSelectedTrack; if (isSelectedTrack) console.log("Enabled audio track:", track.label || track.id || i); trackChanged = true; } catch (e) { console.error("Error changing audio track state for track:", track.id || i, e); } } } if (!trackChanged) console.warn("Selected audio track already active or no change applied."); }


    function togglePlayPause() { if (videoElement) { if (videoElement.paused || videoElement.ended) videoElement.play().catch(e => console.log("Play error:", e.message)); else videoElement.pause(); } }
    function updateMuteButton() { if (!videoElement || !muteButton) return; const isMuted = videoElement.muted || videoElement.volume === 0; muteButton.textContent = isMuted ? "Unmute" : "Mute"; muteButton.setAttribute('aria-pressed', String(isMuted)); if (volumeSlider) { volumeSlider.style.opacity = isMuted ? '0.5' : '1'; volumeSlider.disabled = isMuted; if (!isMuted && videoElement.volume === 0) { const defaultUnmuteVolume = 0.5; videoElement.volume = defaultUnmuteVolume; volumeSlider.value = defaultUnmuteVolume; } } }
    function handleFullscreenChange() { const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement); if (!videoContainer) return; videoContainer.classList.toggle('is-fullscreen', isFullscreen); console.log("Fullscreen state changed:", isFullscreen); }
    function populateAudioTrackSelector() { if (!videoElement || typeof videoElement.audioTracks === 'undefined' || !audioTrackSelect) { if(audioTrackSelect) audioTrackSelect.style.display = 'none'; return; } const tracks = videoElement.audioTracks; audioTrackSelect.innerHTML = ''; if (tracks.length <= 1) { audioTrackSelect.style.display = 'none'; return; } let hasEnabledTrack = false; for (let i = 0; i < tracks.length; i++) { if (tracks[i].enabled) hasEnabledTrack = true; } if (!hasEnabledTrack && tracks.length > 0) { try { tracks[0].enabled = true; } catch(e) { console.warn("Could not auto-enable first audio track:", e); } } let preferredTrackIndex = -1; for (let i = 0; i < tracks.length; i++) { const track = tracks[i]; const option = document.createElement('option'); const trackValue = track.id || i; option.value = trackValue; let label = track.label || `Track ${i + 1}`; let languageName = ''; if (track.language) { try { languageName = new Intl.DisplayNames(['en'], { type: 'language' }).of(track.language.split('-')[0]); label += ` (${languageName || track.language})`; } catch (e) { label += ` (${track.language})`; } } option.textContent = label; option.selected = track.enabled; option.disabled = track.readyState === 'ended'; audioTrackSelect.appendChild(option); const lang = track.language?.toLowerCase(); const lbl = label.toLowerCase(); if (preferredTrackIndex === -1 && (lang?.startsWith('hi') || lbl.includes('hindi') || languageName?.toLowerCase() === 'hindi')) { preferredTrackIndex = i; } } if (preferredTrackIndex !== -1) { console.log(`Preferred track found at index ${preferredTrackIndex}. Attempting auto-selection.`); try { let trackChanged = false; for (let i = 0; i < tracks.length; i++) { const shouldBeEnabled = (i === preferredTrackIndex); if (tracks[i].enabled !== shouldBeEnabled) { tracks[i].enabled = shouldBeEnabled; trackChanged = true; } } const preferredTrackValue = tracks[preferredTrackIndex].id || preferredTrackIndex; audioTrackSelect.value = preferredTrackValue; if (trackChanged) console.log("Successfully auto-selected preferred track."); } catch(e) { console.error("Error auto-selecting preferred audio track:", e); } } else { console.log("No preferred audio track found."); for (let i = 0; i < tracks.length; i++) { if (tracks[i].enabled) { audioTrackSelect.value = tracks[i].id || i; break; } } } audioTrackSelect.style.display = 'inline-block'; try { if (tracks.onchange === null) tracks.onchange = populateAudioTrackSelector; } catch(e) { console.warn("Browser might not support 'onchange' on AudioTrackList", e)} }
    function openWithIntent(url) { if (!url) return; const mime = getMimeTypeFromUrl(url); const titleEncoded = encodeURIComponent(videoTitle?.innerText || document.title || 'Video'); const intentUri = `intent:${url}#Intent;type=${mime};action=android.intent.action.VIEW;S.title=${titleEncoded};end`; console.log("Intent:", intentUri); window.location.href = intentUri; }

    // --- MODIFIED: copyVLCLink uses shared feedback logic ---
    function copyVLCLink(buttonElement, url) {
        console.log("Copy VLC button clicked. URL:", url);
        if (!url) {
            console.error("copyVLCLink: No URL provided.");
            alert("Cannot copy: URL is missing.");
            return;
        }

        // Find the feedback span directly next to the button
        const feedbackSpan = buttonElement.nextElementSibling;

        // Check if the next sibling is the feedback span we expect
        if (!feedbackSpan || !feedbackSpan.classList.contains('copy-feedback')) {
            console.warn("copyVLCLink: Could not find feedback span immediately after the button:", buttonElement);
            // Attempt copy anyway, but without the visual feedback span
            copyToClipboard(url, null); // Pass null for feedback span
            return;
        }

        // Call the copyToClipboard function, passing the adjacent feedback span
        copyToClipboard(url, feedbackSpan).catch(err => {
             console.error("Error during copyVLCLink process:", err);
             alert("Copy failed. Please try again.");
             // Ensure feedback span is hidden on error if it exists
             if (feedbackSpan) {
                 feedbackSpan.classList.remove('show', 'error');
                 feedbackSpan.style.display = 'none';
             }
        });
    }

    // --- MODIFIED: showCopyFeedback uses single timeout ---
    // Shows the feedback span, sets text/state, and manages the single global timeout.
    function showCopyFeedback(spanElement, message = 'Copied!', isError = false) {
        if (!spanElement) return;

        clearTimeout(copyFeedbackTimeout); // Clear previous timeout

        // Set message and state
        spanElement.textContent = message;
        spanElement.classList.toggle('error', isError);
        spanElement.classList.remove('share-fallback'); // Remove specific style if applied previously
        if (spanElement.classList.contains('share-fallback')) { // Re-add if it IS a share fallback
            spanElement.classList.add('share-fallback');
        }

        // Show the element
        spanElement.style.display = 'inline-block'; // Ensure visible if previously none
        spanElement.classList.add('show');

        // Set new timeout to hide it
        copyFeedbackTimeout = setTimeout(() => {
            spanElement.classList.remove('show', 'error');
            // Optionally hide completely after transition (adjust delay)
            setTimeout(() => {
                // Check if it wasn't re-triggered in the meantime
                if (!spanElement.classList.contains('show')) {
                     spanElement.style.display = 'none';
                     // Reset text content after hiding
                     spanElement.textContent = spanElement.classList.contains('share-fallback') ? 'Link copied!' : 'Copied!';
                }
            }, 300); // Should match CSS transition duration
        }, 2500); // Duration the message is visible
    }

    // --- MODIFIED: clearCopyFeedback clears single timeout and hides all spans ---
    function clearCopyFeedback() {
        clearTimeout(copyFeedbackTimeout); // Clear the single global timeout

        // Hide ALL feedback spans immediately
        document.querySelectorAll('.copy-feedback.show').forEach(span => {
             span.classList.remove('show', 'error');
             span.style.display = 'none';
             // Reset text content
             span.textContent = span.classList.contains('share-fallback') ? 'Link copied!' : 'Copied!';
        });
    }

    function highlightVlcText() { /* Kept as is, for fallback */
        const activeContext = activeTableActionRow || activePreviewActionRow || (currentViewMode === 'shared' ? sharedItemContent : null);
        if (!activeContext) return;
        const currentVlcText = activeContext.querySelector('#vlcBox code');
        if (currentVlcText && currentVlcText.closest('#vlcBox')?.style.display !== 'none') {
            try {
                const range = document.createRange(); range.selectNodeContents(currentVlcText);
                const selection = window.getSelection();
                if (selection) { selection.removeAllRanges(); selection.addRange(range); }
                console.log("Highlighted VLC text as fallback.");
            } catch (selectErr) { console.warn("Could not highlight VLC text:", selectErr); }
        }
    }
    function handlePlayerKeyboardShortcuts(event) { if (!videoContainer || videoContainer.style.display !== 'flex' || !videoElement) return; const targetTagName = event.target.tagName.toLowerCase(); if (targetTagName === 'input' || targetTagName === 'select' || targetTagName === 'textarea') return; const key = event.key; let prevented = false; switch (key) { case ' ': case 'k': togglePlayPause(); prevented = true; break; case 'ArrowLeft': seekVideo(-10); prevented = true; break; case 'ArrowRight': seekVideo(10); prevented = true; break; case 'ArrowUp': setVolume(Math.min(videoElement.volume + 0.05, 1)); if(volumeSlider) volumeSlider.value = videoElement.volume; prevented = true; break; case 'ArrowDown': setVolume(Math.max(videoElement.volume - 0.05, 0)); if(volumeSlider) volumeSlider.value = videoElement.volume; prevented = true; break; case 'm': toggleMute(); prevented = true; break; case 'f': toggleFullscreen(); prevented = true; break; } if (prevented) event.preventDefault(); }

    // --- State Persistence ---
    function saveStateToLocalStorage() {
        try {
            // Only save sorting/filtering state, not search term or pagination
            const stateToSave = {};
            if (currentState.sortColumn !== 'lastUpdated') stateToSave.sortColumn = currentState.sortColumn;
            if (currentState.sortDirection !== 'desc') stateToSave.sortDirection = currentState.sortDirection;
            if (currentState.qualityFilter !== '') stateToSave.qualityFilter = currentState.qualityFilter;

            if (Object.keys(stateToSave).length > 0) {
                localStorage.setItem(config.LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
                 console.log("Saved state:", stateToSave);
            } else {
                localStorage.removeItem(config.LOCAL_STORAGE_KEY); // Remove if default
                 console.log("State is default, removed saved state.");
            }
        } catch (e) { console.error("Failed to save state to localStorage:", e); }
    }

    function loadStateFromLocalStorage() {
        try {
            const savedState = localStorage.getItem(config.LOCAL_STORAGE_KEY);
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                currentState.sortColumn = typeof parsedState.sortColumn === 'string' ? parsedState.sortColumn : 'lastUpdated';
                currentState.sortDirection = (typeof parsedState.sortDirection === 'string' && ['asc', 'desc'].includes(parsedState.sortDirection)) ? parsedState.sortDirection : 'desc';
                currentState.qualityFilter = typeof parsedState.qualityFilter === 'string' ? parsedState.qualityFilter : '';
                 console.log("Loaded state:", { sortColumn: currentState.sortColumn, sortDirection: currentState.sortDirection, qualityFilter: currentState.qualityFilter });
            } else {
                 // Set defaults if no saved state
                 currentState.sortColumn = 'lastUpdated';
                 currentState.sortDirection = 'desc';
                 currentState.qualityFilter = '';
                 console.log("No saved state found, using defaults.");
            }
        } catch (e) {
            console.error("Failed to load or parse state from localStorage:", e);
            localStorage.removeItem(config.LOCAL_STORAGE_KEY); // Clear potentially corrupted state
            currentState.sortColumn = 'lastUpdated';
            currentState.sortDirection = 'desc';
            currentState.qualityFilter = '';
        }

        // Reset dynamic parts of state on every page load
        currentState.searchTerm = '';
        resetPagination();
        activeResultsTab = 'allFiles';
        activeTableActionRow = null;
        activePreviewActionRow = null;
        lastFocusedElement = null;
        // currentViewMode will be determined by shareId check during initial load
    }

    // --- Initial Data Loading and Setup ---

    // Helper: Fetch data from the backend
    async function fetchData() {
        if (!config.GSheetWebAppURL || config.GSheetWebAppURL.includes("macros/library/d/")) {
            throw new Error("Google Sheet Web App URL is missing or incorrect. Please deploy script as Web App.");
        }
        console.log("Fetching data from:", config.GSheetWebAppURL);
        const response = await fetch(config.GSheetWebAppURL);
        if (!response.ok) {
             let errorText = `Network error: ${response.statusText || `HTTP status ${response.status}`}`;
             try { const errorData = await response.json(); if(errorData?.error) errorText = `API Error: ${errorData.error}`; } catch(e) { /* Ignore json parsing error */ }
             throw new Error(errorText);
        }
        const result = await response.json();
        if (result.error) throw new Error(`API Error: ${result.error}`);
        if (!Array.isArray(result.data)) throw new Error("Invalid data format received (expected 'data' array).");
        return result.data;
    }

    // Helper: Process fetched data
    function processFetchedData(rawData) {
        uniqueQualities.clear();
        allMovieData = rawData
                        .filter(movie => movie && (movie.id || movie.filename || movie.url)) // Basic validation
                        .map(preprocessMovieData);
        console.log(`Successfully processed ${allMovieData.length} items.`);
        prepareWeeklyUpdatesData(); // Prepare updates data after processing all data
    }

    // Helper: Setup the initial view based on data and shareId
    function setupInitialView(shareId) {
         // Always populate filter (it's hidden in shared view but needed if user goes back)
         populateQualityFilter();
         if (qualityFilterSelect) {
             qualityFilterSelect.value = currentState.qualityFilter || '';
             updateFilterIndicator();
         }

         if (shareId) {
             displaySharedItem(shareId); // This function now also calls setViewMode('shared')
         } else {
             // Setup homepage view
             displayInitialUpdates();
             if(updatesPreviewSection) updatesPreviewSection.style.display = 'block'; // Show updates section
             // Set default message in result tables
             const defaultMessageHTML = `<tr><td colspan="6" class="status-message">Enter search term above.</td></tr>`;
             Object.values(tabMappings).forEach(mapping => {
                 if (mapping?.tableBody) mapping.tableBody.innerHTML = defaultMessageHTML;
             });
             setViewMode('homepage'); // Explicitly set homepage view
         }
    }

    // Main initial load orchestrator
    async function loadInitialData() {
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('shareId');
        isDirectShareLoad = !!shareId;

        if (pageLoader) pageLoader.style.display = 'flex'; // Show page loader

        // Prepare initial UI state (loading messages, hide/show sections based on shareId)
        if (isDirectShareLoad) {
            console.log("Direct share link detected for ID:", shareId);
            if (sharedItemContent) sharedItemContent.innerHTML = `<div class="loading-inline-spinner" role="status" aria-live="polite"><div class="spinner"></div><span>Loading shared item...</span></div>`;
            if (sharedItemView) sharedItemView.style.display = 'block';
            container.classList.add('shared-view-active');
            if (searchFocusArea) searchFocusArea.style.display = 'none';
            if (resultsArea) resultsArea.style.display = 'none';
            if (updatesPreviewSection) updatesPreviewSection.style.display = 'none';
            if (pageFooter) pageFooter.style.display = 'none';
        } else {
            console.log("Preparing homepage view (pre-data).");
            if(updatesPreviewList) updatesPreviewList.innerHTML = `<div class="loading-inline-spinner" role="status" aria-live="polite"><div class="spinner"></div><span>Loading updates...</span></div>`;
            if(showMoreUpdatesButton) showMoreUpdatesButton.style.display = 'none';
            showLoadingStateInTables('Loading data...');
            if (searchFocusArea) searchFocusArea.style.display = 'flex';
            if (pageFooter) pageFooter.style.display = 'flex';
            if (resultsArea) resultsArea.style.display = 'none';
            if (sharedItemView) sharedItemView.style.display = 'none';
        }

        loadStateFromLocalStorage(); // Load sorting/filter defaults

        try {
            const rawData = await fetchData();
            processFetchedData(rawData);
            setupInitialView(shareId); // Populate UI based on processed data and shareId

        } catch (error) {
            console.error('FATAL: Failed to load or process initial data:', error);
            const errorMessage = `Error loading data: ${error.message}. Please check the script URL or deployment status, then refresh the page.`;
            displayLoadError(errorMessage); // Display error prominently

        } finally {
            // Hide the page loader AFTER everything is processed/rendered (or error shown)
            if (pageLoader) pageLoader.style.display = 'none';
        }
    }

    function populateQualityFilter() {
         if (!qualityFilterSelect) return;
         const currentSelectedValue = qualityFilterSelect.value;
         // Sort qualities: 4K > 1080p > 720p > 480p > WEBDL/BluRay > WEBIP/HDTV > DVD > SCR/CAM > HDR/HEVC/etc.
         const sortedQualities = [...uniqueQualities].sort((a, b) => {
            const getScore = (q) => {
                q = String(q || '').toUpperCase().trim();
                const resMatch = q.match(/^(\d{3,4})P$/);
                if (q === '4K' || q === '2160P') return 100;
                if (resMatch) return parseInt(resMatch[1], 10);
                if (q === '1080P') return 90;
                if (q === '720P') return 80;
                if (q === '480P') return 70;
                if (['WEBDL', 'BLURAY', 'BDRIP', 'BRRIP'].includes(q)) return 60;
                if (['WEBIP', 'HDTV', 'HDRIP'].includes(q)) return 50;
                if (['DVD', 'DVDRIP'].includes(q)) return 40;
                if (['DVDSCR', 'HC', 'HDCAM', 'TC', 'TS', 'CAM'].includes(q)) return 30;
                if (['HDR', 'DOLBY VISION', 'DV', 'HEVC', 'X265'].includes(q)) return 20;
                return 0; // Unknown sorts last alphabetically
            };
            const scoreA = getScore(a);
            const scoreB = getScore(b);
            if (scoreA !== scoreB) return scoreB - scoreA; // Higher score first
            // If scores are equal, sort alphabetically
            return String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });
         });
         // Clear existing options (except the first "All Qualities")
         while (qualityFilterSelect.options.length > 1) { qualityFilterSelect.remove(1); }
         // Add sorted qualities
         sortedQualities.forEach(quality => { if (quality && quality !== 'N/A') { const option = document.createElement('option'); option.value = quality; option.textContent = quality; qualityFilterSelect.appendChild(option); } });
         // Restore previously selected value if possible
         qualityFilterSelect.value = currentSelectedValue || "";
    }

    function displayLoadError(message) {
        const errorHtml = `<div class="error-container" role="alert">${sanitize(message)}</div>`;

        // Clear main content areas and hide specific sections
        if (searchFocusArea) searchFocusArea.innerHTML = ''; searchFocusArea.style.display = 'none';
        if (resultsArea) resultsArea.innerHTML = ''; resultsArea.style.display = 'none';
        if (updatesPreviewSection) updatesPreviewSection.innerHTML = ''; updatesPreviewSection.style.display = 'none';
        if (sharedItemContent) sharedItemContent.innerHTML = '';
        if (sharedItemView) sharedItemView.style.display = 'none'; // Hide shared container initially
        if (pageFooter) pageFooter.style.display = 'none';
        container.classList.remove('results-active', 'shared-view-active'); // Reset container state classes

        // Display error message in the dedicated error area or fallback
        if (mainErrorArea) {
            mainErrorArea.innerHTML = errorHtml;
        } else if (container) { // Absolute fallback if error area itself is missing
            container.insertAdjacentHTML('afterbegin', errorHtml);
        }
    }

    // --- Event Handling Setup (Delegation) ---
    function handleActionClick(event) {
        const target = event.target;
        const button = target.closest('.action-buttons-container .button'); // Target buttons inside any action container

        if (button) {
            const action = button.dataset.action;
            const url = button.dataset.url;
            const title = button.dataset.title;
            const filename = button.dataset.filename;
            const id = button.dataset.id; // For share

            // Store the button that was clicked for focus return
            lastFocusedElement = button;

            if (action === 'play' && url && title) {
                event.preventDefault();
                streamVideo(title, url, filename);
            } else if (action === 'copy-vlc' && url) {
                event.preventDefault();
                copyVLCLink(button, url); // Handles its own feedback
            } else if (action === 'open-intent' && url) {
                event.preventDefault();
                openWithIntent(url);
            } else if (action === 'share' && id) {
                event.preventDefault();
                handleShareClick(button); // Handles its own feedback
            }
            // Let other links (Telegram, GDFLIX, etc. - <a> tags) behave normally
        }
    }

    // --- Combined Click Handler for Tables, Previews, Shared View ---
    function handleContentClick(event) {
        const target = event.target;

        // 1. Check for Action Row Toggle (View button or Filename click)
        const viewButton = target.closest('.view-button');
        const filenameLink = target.closest('td.col-filename, .preview-col-filename'); // Target TD or DIV

        if (viewButton || filenameLink) {
            event.preventDefault();
            const mainRowOrItem = target.closest('tr.movie-data-row, div.update-item');
            if (mainRowOrItem) {
                // Store the triggering element for focus return
                lastFocusedElement = viewButton || filenameLink;
                if (mainRowOrItem.matches('tr.movie-data-row')) {
                    toggleTableActions(mainRowOrItem, lastFocusedElement);
                } else if (mainRowOrItem.matches('div.update-item')) {
                    togglePreviewActions(mainRowOrItem, lastFocusedElement);
                }
            }
            return; // Stop further processing if toggle action was initiated
        }

        // 2. Check for Action Buttons click (Play, Copy, Share, etc.)
        handleActionClick(event);

        // 3. Check for Player Close Button click (delegated via main containers now)
        // Moved the explicit check for .close-btn into the individual container listeners below if needed,
        // but handleActionClick might cover it if data attributes were used.
        // Re-adding explicit check here for safety:
        if (target.matches('.close-btn') && target.closest('#videoContainer')) {
             lastFocusedElement = target; // Store close button as last focused
             closePlayer(lastFocusedElement); // Close player, focus will be handled internally
             return;
        }
    }


    // --- Global Event Listeners Setup ---
    document.addEventListener('DOMContentLoaded', () => {
        loadInitialData(); // Orchestrates fetching, processing, and initial UI setup

        if (searchInput) {
            searchInput.addEventListener('input', handleSearchInput);
            searchInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault(); handleSearchSubmit();
                } else if (event.key === 'Escape') {
                    suggestionsContainer.style.display = 'none';
                }
            });
            searchInput.addEventListener('search', handleSearchClear); // Handles native clear 'x'
            searchInput.addEventListener('blur', () => {
                setTimeout(() => { // Delay check to allow suggestion click
                    const searchButton = document.getElementById('searchSubmitButton');
                    if (document.activeElement !== searchInput &&
                        !suggestionsContainer.contains(document.activeElement) &&
                        document.activeElement !== searchButton) {
                        suggestionsContainer.style.display = 'none';
                    }
                }, 150);
            });
        }

        if (qualityFilterSelect) {
            qualityFilterSelect.addEventListener('change', triggerFilterChange);
        }

        // Delegate clicks within specific content areas using the combined handler
        if (resultsArea) {
            resultsArea.addEventListener('click', (event) => {
                if (event.target.closest('th.sortable')) {
                    handleSort(event); // Handle header sort clicks separately
                } else {
                    handleContentClick(event); // Handle toggles and actions
                }
            });
        }
        if (updatesPreviewList) {
            updatesPreviewList.addEventListener('click', handleContentClick);
        }
        if (sharedItemView) {
            sharedItemView.addEventListener('click', handleContentClick);
        }
        // Delegate clicks inside the player container as well (e.g., for close button)
        if (videoContainer) {
             // Adding click listener directly to videoContainer ensures clicks inside it (like close button) are caught
             // handleContentClick already checks for .close-btn, so this might be redundant but safe.
            videoContainer.addEventListener('click', handleContentClick);
        }


        // Global keyboard shortcuts for player
        document.addEventListener('keydown', handlePlayerKeyboardShortcuts);

        // Global click listener for closing suggestions/player (if click is outside)
        document.addEventListener('click', (event) => {
            // Close suggestions if click is outside search area
            if (searchInput && suggestionsContainer && suggestionsContainer.style.display === 'block') {
               const searchWrapper = searchInput.closest('.search-input-wrapper');
               if (searchWrapper && !searchWrapper.contains(event.target)) {
                     suggestionsContainer.style.display = 'none';
               }
            }

            // Close player ONLY if click is truly outside the player AND its containing action row/div/content
            if (videoContainer && videoContainer.style.display !== 'none' && !videoContainer.contains(event.target)) {
                 // Check if the click is outside the logical parent container (action row/div or shared content)
                 const logicalParent = videoContainer.parentElement?.closest('.action-row, .preview-action-row, #shared-item-content');

                 // Also check if the click is outside the *trigger* row/item that opened the action row/div
                 const triggerElement = logicalParent?.previousElementSibling; // Find the row/item before the action container

                 // Close if click is outside the player AND outside its logical parent AND outside the trigger element
                 if ((!logicalParent || !logicalParent.contains(event.target)) &&
                     (!triggerElement || !triggerElement.contains(event.target)))
                 {
                     console.log("Clicked outside player's logical container and trigger. Closing player.");
                     closePlayer(event.target); // Pass clicked element as potential focus target
                 }
            }
        }, false); // Use capture phase 'false' (bubble)
    });

    // --- Player Event Listeners ---
    if(videoElement) {
        videoElement.addEventListener('volumechange', () => {
            if (volumeSlider && Math.abs(parseFloat(volumeSlider.value) - videoElement.volume) > 0.01) {
                 volumeSlider.value = videoElement.volume;
            }
            updateMuteButton();
            try { localStorage.setItem(config.PLAYER_VOLUME_KEY, String(videoElement.volume));
            } catch (e) { console.warn("LocalStorage volume save failed", e); }
        });
        videoElement.addEventListener('ratechange', () => {
            if(playbackSpeedSelect && playbackSpeedSelect.value !== String(videoElement.playbackRate)) {
                 playbackSpeedSelect.value = String(videoElement.playbackRate);
            }
            try { localStorage.setItem(config.PLAYER_SPEED_KEY, String(videoElement.playbackRate));
            } catch (e) { console.warn("LocalStorage speed save failed", e); }
        });
        videoElement.addEventListener('loadedmetadata', populateAudioTrackSelector);
        videoElement.removeEventListener('error', handleVideoError); // Remove potential duplicates
        videoElement.addEventListener('error', handleVideoError);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

})(); // End of IIFE