// ==UserScript==
// @name         ADN Killer
// @description  Attempts to avoid Apex Domain Names whenever possible
// @author       PixelSpark987 - https://is.gd/PS987
// @version      2.0
// @namespace    http://tampermonkey.net/
// @downloadURL  https://raw.githubusercontent.com/PixelSpark987/ADN-Killer/refs/heads/main/ADN%20Killer.js
// @updateURL    https://raw.githubusercontent.com/PixelSpark987/ADN-Killer/refs/heads/main/ADN%20Killer.js
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function() {
    'use me strict';

    const hostname = location.hostname;

    // Check if the domain is strictly an IP address or localhost
    const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === 'localhost';
    if (isIP) return;

    // Check if the hostname has any subdomain attached
    const hostParts = hostname.split('.');
    const hasSubdomain = hostParts.length > 2;

    if (!hasSubdomain) {
        // verify if a string or element contains NextDNS block text
        const isNextDNSBlocked = function(text) {
            return text && text.includes('The website you are trying to access is being blocked');
        };

        // Check if the current page itself is already displaying NextDNS's block page
        if (isNextDNSBlocked(document.documentElement ? document.documentElement.innerHTML : '')) {
            console.warn('[ADN Killer] Current page is a NextDNS blockpage. Aborting redirect.');
            return;
        }

        const wwwHost = 'www.' + hostname;
        const wwwURL = location.protocol + '//' + wwwHost + location.pathname + location.search + location.hash;

        // Use GM_xmlhttpRequest / GM.xmlHttpRequest to bypass browser CORS rules
        const gmx = typeof GM_xmlhttpRequest !== 'undefined' ? GM_xmlhttpRequest : GM.xmlHttpRequest;

        gmx({
            method: 'GET', // Using GET to read the body payload for NextDNS block indicators
            url: wwwURL,
            timeout: 5000,
            onload: function(response) {
                // response.finalUrl gives the destination URL if a server redirect occurred
                const finalUrl = response.finalUrl || '';

                let finalHost = '';
                try {
                    if (finalUrl) {
                        finalHost = new URL(finalUrl).hostname;
                    }
                } catch (e) {}

                // Check 1: Did the server redirect back to non-www apex domain?
                if (finalHost && finalHost === hostname) {
                    console.warn('[ADN Killer] Server redirected ' + wwwHost + ' back to ' + hostname + ' - Staying on apex domain.');
                    return;
                }

                // Check 2: Did www. return NextDNS's block page response?
                const responseText = response.responseText || '';
                if (isNextDNSBlocked(responseText)) {
                    console.warn('[ADN Killer] ' + wwwHost + ' is blocked by NextDNS. Cancelling redirect.');
                    return;
                }

                // Check 3: If response status is 200 OK and not blocked, perform redirect
                if (response.status === 200 && (!finalHost || finalHost === wwwHost)) {
                    location.replace(wwwURL);
                } else {
                    console.warn('[ADN Killer] Server returned status ' + response.status + ' for ' + wwwHost + ' - Staying on apex domain.');
                }
            },
            onerror: function(err) {
                console.warn('[ADN Killer] Background check failed or blocked at transport layer for ' + wwwHost + ' - Staying on apex domain.');
            },
            ontimeout: function() {
                console.warn('[ADN Killer] Background check timed out for ' + wwwHost + ' - Staying on apex domain.');
            }
        });
    }
})();
