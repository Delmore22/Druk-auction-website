var currentLightboxIndex = 0;
var lightboxSrcs = [];
var bidCountdownIntervalId = null;
var lightboxElements = {
    overlay: null,
    image: null
};
var vehicleSubmissionSupabaseClient = null;
var VEHICLE_SUBMISSIONS_TABLE = 'vehicle_submissions';

// Re-init search panel using the shared partial IDs once components are ready
document.addEventListener('components:ready', function () {
    initBackToAuctions();
    initCarPhotoLightbox();

    var searchForm = document.getElementById('auctionSearchForm');
    var searchInput = document.getElementById('auctionSearch');
    var triggerBtn = document.getElementById('searchTriggerBtn');
    var filtersPanel = document.getElementById('searchFiltersPanel');
    var filterBadge = document.getElementById('activeFilterBadge');
    var applyBtn = document.getElementById('applySearchFiltersBtn');
    var clearBtn = document.getElementById('clearSearchFiltersBtn');
    var searchWrap = document.querySelector('.below-header-search');
    var filterInputs = Array.from(document.querySelectorAll('#searchFiltersPanel input[type="checkbox"]'));
    var lastSearchUiStateSignature = '';

    if (triggerBtn && filtersPanel) {
        function createSearchUiStateSnapshot() {
            return {
                query: searchInput ? searchInput.value : '',
                filters: {
                    make: [],
                    engine: [],
                    body: []
                }
            };
        }

        function getSearchUiStateSignature(snapshot) {
            return JSON.stringify(snapshot);
        }

        function syncSearchUiState() {
            if (typeof window.setAuctionSearchUiState !== 'function') return;

            var snapshot = createSearchUiStateSnapshot();

            filterInputs.forEach(function (input) {
                if (!input.checked) return;
                if (snapshot.filters[input.dataset.filterGroup]) {
                    snapshot.filters[input.dataset.filterGroup].push(input.value);
                }
            });

            lastSearchUiStateSignature = getSearchUiStateSignature(snapshot);
            window.setAuctionSearchUiState(snapshot);
        }

        function updateFilterBadge() {
            if (!filterBadge) return;

            var checkedCount = filterInputs.reduce(function (count, input) {
                return count + (input.checked ? 1 : 0);
            }, 0);
            filterBadge.textContent = String(checkedCount);
            filterBadge.hidden = checkedCount === 0;
        }

        function restoreSearchUiState() {
            if (typeof window.getAuctionSearchUiState !== 'function') {
                updateFilterBadge();
                return;
            }

            var savedState = window.getAuctionSearchUiState() || { query: '', filters: {} };
            var savedFilters = savedState.filters || {};
            var savedStateSignature = getSearchUiStateSignature({
                query: savedState.query || '',
                filters: {
                    make: Array.isArray(savedFilters.make) ? savedFilters.make : [],
                    engine: Array.isArray(savedFilters.engine) ? savedFilters.engine : [],
                    body: Array.isArray(savedFilters.body) ? savedFilters.body : []
                }
            });

            if (savedStateSignature === lastSearchUiStateSignature) {
                return;
            }

            if (searchInput) {
                searchInput.value = savedState.query || '';
            }

            filterInputs.forEach(function (input) {
                var selectedValues = savedFilters[input.dataset.filterGroup] || [];
                input.checked = selectedValues.indexOf(input.value) !== -1;
            });

            updateFilterBadge();
            lastSearchUiStateSignature = savedStateSignature;
        }

        function openPanel() {
            filtersPanel.hidden = false;
        }

        function closePanel() {
            filtersPanel.hidden = true;
        }

        if (searchInput) {
            searchInput.addEventListener('focus', openPanel);
            searchInput.addEventListener('click', openPanel);
            searchInput.addEventListener('input', syncSearchUiState);
        }

        triggerBtn.addEventListener('click', function () {
            filtersPanel.hidden = !filtersPanel.hidden;
        });

        if (searchForm) {
            searchForm.addEventListener('submit', function (event) {
                event.preventDefault();
                closePanel();
            });
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', function () {
                updateFilterBadge();
                syncSearchUiState();
                closePanel();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                filterInputs.forEach(function (cb) {
                    cb.checked = false;
                });
                updateFilterBadge();
                syncSearchUiState();
                closePanel();
            });
        }

        filterInputs.forEach(function (input) {
            input.addEventListener('change', function () {
                updateFilterBadge();
                syncSearchUiState();
            });
        });

        if (searchWrap) {
            document.addEventListener('click', function (event) {
                if (!searchWrap.contains(event.target)) {
                    closePanel();
                }
            });
        }

        restoreSearchUiState();
    }

    // Load car details
    loadCarDetails();
});

function initCarPhotoLightbox() {
    ensureCarPhotoLightbox();

    function navigate(direction) {
        if (!lightboxSrcs.length) return;
        currentLightboxIndex = (currentLightboxIndex + direction + lightboxSrcs.length) % lightboxSrcs.length;
        openCarPhotoLightbox(lightboxSrcs[currentLightboxIndex].src, lightboxSrcs[currentLightboxIndex].alt);
    }

    document.addEventListener('click', function (event) {
        var target = event.target;
        if (!target) return;

        var galleryImage = target.closest('img[data-lightbox-index]');
        if (galleryImage) {
            var imageIndex = Number(galleryImage.getAttribute('data-lightbox-index'));
            if (!Number.isNaN(imageIndex) && lightboxSrcs[imageIndex]) {
                currentLightboxIndex = imageIndex;
                openCarPhotoLightbox(lightboxSrcs[currentLightboxIndex].src, lightboxSrcs[currentLightboxIndex].alt);
                return;
            }
        }

        if (target.matches('.car-photo-lightbox') || target.matches('.car-photo-lightbox-close')) {
            closeCarPhotoLightbox();
            return;
        }

        if (target.matches('.car-photo-lightbox-prev')) { navigate(-1); return; }
        if (target.matches('.car-photo-lightbox-next')) { navigate(1); return; }
    });

    document.addEventListener('keydown', function (event) {
        var lb = lightboxElements.overlay;
        if (!lb || !lb.classList.contains('is-open')) return;
        if (event.key === 'Escape') { closeCarPhotoLightbox(); return; }
        if (event.key === 'ArrowLeft') { navigate(-1); return; }
        if (event.key === 'ArrowRight') { navigate(1); return; }
    });
}

function ensureCarPhotoLightbox() {
    if (lightboxElements.overlay && lightboxElements.image) return;

    var existingOverlay = document.getElementById('carPhotoLightbox');
    var existingImage = document.getElementById('carPhotoLightboxImage');
    if (existingOverlay && existingImage) {
        lightboxElements.overlay = existingOverlay;
        lightboxElements.image = existingImage;
        return;
    }

    var overlay = document.createElement('div');
    overlay.id = 'carPhotoLightbox';
    overlay.className = 'car-photo-lightbox';
    overlay.setAttribute('aria-hidden', 'true');

    var closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'car-photo-lightbox-close';
    closeButton.setAttribute('aria-label', 'Close photo viewer');
    closeButton.textContent = '×';

    var prevButton = document.createElement('button');
    prevButton.type = 'button';
    prevButton.className = 'car-photo-lightbox-prev';
    prevButton.setAttribute('aria-label', 'Previous photo');
    prevButton.textContent = '‹';

    var content = document.createElement('div');
    content.className = 'car-photo-lightbox-content';

    var image = document.createElement('img');
    image.id = 'carPhotoLightboxImage';
    image.src = '';
    image.alt = 'Expanded vehicle photo';

    content.appendChild(image);

    var nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'car-photo-lightbox-next';
    nextButton.setAttribute('aria-label', 'Next photo');
    nextButton.textContent = '›';

    overlay.appendChild(closeButton);
    overlay.appendChild(prevButton);
    overlay.appendChild(content);
    overlay.appendChild(nextButton);

    document.body.appendChild(overlay);

    lightboxElements.overlay = overlay;
    lightboxElements.image = image;
}

function openCarPhotoLightbox(src, altText) {
    var lightbox = lightboxElements.overlay;
    var lightboxImage = lightboxElements.image;
    if (!lightbox || !lightboxImage) return;

    lightboxImage.src = src;
    lightboxImage.alt = altText || 'Expanded vehicle photo';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
}

function closeCarPhotoLightbox() {
    var lightbox = lightboxElements.overlay;
    var lightboxImage = lightboxElements.image;
    if (!lightbox || !lightbox.classList.contains('is-open')) return;

    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');

    if (lightboxImage) {
        lightboxImage.src = '';
    }
}

function clearBidCountdown() {
    if (bidCountdownIntervalId !== null) {
        window.clearInterval(bidCountdownIntervalId);
        bidCountdownIntervalId = null;
    }
}

window.addEventListener('pagehide', clearBidCountdown);

function initBackToAuctions() {
    var backButton = document.querySelector('.back-button');
    if (!backButton) return;

    var params = new URLSearchParams(window.location.search);
    var requestedReturnTo = params.get('returnTo');
    var requestedReturnLabel = params.get('returnLabel');
    var sourceSection = params.get('source');
    var fallbackUrl = 'car-dashboard.html';
    var fallbackLabel = 'Back to Dashboard';

    if (requestedReturnTo === 'my-vehicles.html' || sourceSection === 'seller') {
        fallbackUrl = 'my-vehicles.html';
        fallbackLabel = requestedReturnLabel || 'Back to My Vehicles';
    }

    backButton.innerHTML = '<i class="fas fa-chevron-left" aria-hidden="true"></i> ' + fallbackLabel;

    backButton.addEventListener('click', function () {
        var referrer = document.referrer || '';
        var referrerMatchesReturnPage = false;

        if (referrer) {
            try {
                var refUrl = new URL(referrer, window.location.href);
                var fallbackPath = new URL(fallbackUrl, window.location.href).pathname.toLowerCase();
                referrerMatchesReturnPage =
                    refUrl.origin === window.location.origin &&
                    refUrl.pathname.toLowerCase() === fallbackPath;
            } catch (err) {
                referrerMatchesReturnPage = false;
            }
        }

        var openerWindow = window.opener;
        var trustedOpener = null;

        if (openerWindow && !openerWindow.closed) {
            try {
                if (openerWindow.location && openerWindow.location.origin === window.location.origin) {
                    trustedOpener = openerWindow;
                }
            } catch (err) {
                trustedOpener = null;
            }
        }

        if (trustedOpener) {
            try {
                trustedOpener.focus();
                window.close();

                // If close is blocked, navigate this tab as a safe fallback.
                window.setTimeout(function () {
                    if (!window.closed) {
                        window.location.href = fallbackUrl;
                    }
                }, 200);
                return;
            } catch (err) {
                // Fall through to history/referrer handling if opener access fails.
            }
        }

        if (referrerMatchesReturnPage && window.history.length > 1) {
            window.history.back();
            return;
        }

        if (referrerMatchesReturnPage) {
            window.location.href = referrer;
            return;
        }

        window.location.href = fallbackUrl;
    });
}

function loadCarDetails() {
    var params = new URLSearchParams(window.location.search);
    var carId = params.get('car');
    var submissionIdParam = params.get('sid');
    var sourceSection = params.get('source');

    if (!carId) {
        showCarError('No vehicle selected.', 'car-dashboard.html', 'Browse listings ->');
        return;
    }
    fetch('data/cars.json')
        .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function (data) {
            var car = data.cars.find(function (c) { return c.id === carId; });
            if (car) {
                renderCarDetail(car, sourceSection);
                document.title = car.year + ' ' + car.make + ' ' + car.model + ' — Collectors Alliance Exchange';
                return;
            }

            return loadApprovedSubmissionCar(carId, submissionIdParam)
                .then(function (submissionCar) {
                    if (!submissionCar) {
                        showCarError('Vehicle not found.', 'car-dashboard.html', 'Browse listings ->');
                        return;
                    }

                    renderCarDetail(submissionCar, sourceSection);
                    document.title = submissionCar.year + ' ' + submissionCar.make + ' ' + submissionCar.model + ' — Collectors Alliance Exchange';
                });
        })
        .catch(function () {
            showCarError('Could not load vehicle data. Please try again.');
        });
}

function getVehicleSubmissionConfig() {
    return window.ADD_VEHICLE_SUPABASE_CONFIG || {};
}

function looksLikePlaceholderConfigValue(value) {
    return !value || /your[-_ ]/i.test(value) || /replace[-_ ]/i.test(value);
}

function initializeVehicleSubmissionSupabase() {
    var config = getVehicleSubmissionConfig();

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        return false;
    }

    if (looksLikePlaceholderConfigValue(config.url) || looksLikePlaceholderConfigValue(config.anonKey)) {
        return false;
    }

    if (!vehicleSubmissionSupabaseClient) {
        vehicleSubmissionSupabaseClient = window.supabase.createClient(config.url, config.anonKey);
    }

    return true;
}

function loadSubmissionViaRest(submissionId) {
    var config = getVehicleSubmissionConfig();

    if (looksLikePlaceholderConfigValue(config.url) || looksLikePlaceholderConfigValue(config.anonKey)) {
        return Promise.resolve(null);
    }

    var endpoint = String(config.url || '').replace(/\/$/, '') + '/rest/v1/' + VEHICLE_SUBMISSIONS_TABLE
        + '?select=id,vin,year,make,model,seller_name,seller_company,submitted_payload,review_status'
        + '&id=eq.' + encodeURIComponent(submissionId)
        + '&limit=1';

    return fetch(endpoint, {
        headers: {
            apikey: config.anonKey,
            Authorization: 'Bearer ' + config.anonKey
        }
    })
        .then(function (response) {
            if (!response.ok) {
                return null;
            }

            return response.json();
        })
        .then(function (rows) {
            if (!Array.isArray(rows) || !rows.length) {
                return null;
            }

            return mapApprovedSubmissionToCar(rows[0]);
        })
        .catch(function () {
            return null;
        });
}

function getSubmissionIdFromCarId(carId) {
    var value = String(carId || '');
    if (value.indexOf('submission-') === 0) {
        return value.slice('submission-'.length);
    }

    // Accept direct UUID-style ids as well so deep links stay resilient.
    if (/^[0-9a-fA-F-]{30,}$/.test(value)) {
        return value;
    }

    return null;
}

function getSubmissionPhotoUrls(payload) {
    if (!payload || !Array.isArray(payload.photos)) {
        return [];
    }

    return payload.photos.map(function (photo) {
        if (!photo || typeof photo !== 'object') {
            return '';
        }

        return photo.url || photo.path || '';
    }).filter(Boolean);
}

function mapApprovedSubmissionToCar(entry) {
    var payload = entry && entry.submitted_payload && typeof entry.submitted_payload === 'object'
        ? entry.submitted_payload
        : {};
    var photoUrls = getSubmissionPhotoUrls(payload);
    var estimateValue = Number.parseFloat(payload.estimateValue);
    var startingBid = Number.parseFloat(payload.startingBid);
    var reservePrice = Number.parseFloat(payload.reservePrice);
    var fallbackBid = Number.isFinite(estimateValue)
        ? estimateValue
        : (Number.isFinite(startingBid) ? startingBid : 0);

    return {
        id: 'submission-' + entry.id,
        submissionId: entry.id,
        vin: entry.vin || payload.vin || '',
        year: Number.parseInt(entry.year || payload.year, 10) || entry.year || payload.year || '--',
        make: entry.make || payload.make || 'Vehicle',
        model: entry.model || payload.model || 'Submission',
        engine: payload.engine || '',
        transmission: payload.transmission || '',
        bodyStyle: payload.bodyType || payload.bodyStyle || '',
        mileage: payload.mileage || 'Unknown',
        condition: payload.titleStatus || 'Approved Submission',
        description: payload.description || 'Approved submission awaiting auction launch.',
        photo: photoUrls[0] || '',
        photos: photoUrls,
        currentBid: Math.round(fallbackBid),
        startingBid: Number.isFinite(startingBid) ? Math.round(startingBid) : Math.round(fallbackBid),
        buyNowPrice: Number.isFinite(reservePrice) ? Math.round(reservePrice) : null,
        reservePrice: Number.isFinite(reservePrice) ? Math.round(reservePrice) : null,
        status: 'ready-for-sale',
        seller: entry.seller_company || entry.seller_name || payload.sellerCompanyName || payload.sellerContactName || 'Dealer',
        location: payload.pickupLocation || payload.pickupCity || 'Pending location review',
        pickup: payload.pickupLocation || payload.pickupCity || 'Pending location review',
        timeRemaining: null,
        auctionStartAt: null,
        auctionEndAt: null
    };
}

function loadApprovedSubmissionCar(carId, submissionIdOverride) {
    var submissionId = submissionIdOverride || getSubmissionIdFromCarId(carId);
    if (!submissionId) {
        return Promise.resolve(null);
    }

    if (!initializeVehicleSubmissionSupabase()) {
        return loadSubmissionViaRest(submissionId);
    }

    return vehicleSubmissionSupabaseClient
        .from(VEHICLE_SUBMISSIONS_TABLE)
        .select('id, vin, year, make, model, seller_name, seller_company, submitted_payload, review_status')
        .eq('id', submissionId)
        .maybeSingle()
        .then(function (result) {
            if (result.error || !result.data) {
                return loadSubmissionViaRest(submissionId);
            }

            return mapApprovedSubmissionToCar(result.data);
        })
        .catch(function () {
            return loadSubmissionViaRest(submissionId);
        });
}

function showCarError(message, linkHref, linkLabel) {
    var section = document.getElementById('carDetailSection');
    if (!section) return;

    section.textContent = '';

    var paragraph = document.createElement('p');
    paragraph.className = 'car-detail-error';
    paragraph.appendChild(document.createTextNode(message || 'Unable to load vehicle details.'));

    if (linkHref && linkLabel) {
        paragraph.appendChild(document.createTextNode(' '));
        var link = document.createElement('a');
        link.href = linkHref;
        link.textContent = linkLabel;
        paragraph.appendChild(link);
    }

    section.appendChild(paragraph);
}

function createElement(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) {
        element.className = className;
    }
    if (text !== undefined && text !== null) {
        element.textContent = text;
    }
    return element;
}

function createIcon(className) {
    var icon = document.createElement('i');
    icon.className = className;
    icon.setAttribute('aria-hidden', 'true');
    return icon;
}

function appendLabeledParagraph(container, label, value, suffix) {
    var paragraph = createElement('p');
    var strong = createElement('strong', null, label + ':');
    paragraph.appendChild(strong);
    paragraph.appendChild(document.createTextNode(' ' + String(value == null ? '' : value) + (suffix || '')));
    container.appendChild(paragraph);
}

function appendInfoRow(grid, label, valueContent, valueClassName) {
    grid.appendChild(createElement('span', 'ap-label', label));

    var value = createElement('span', valueClassName ? 'ap-value ' + valueClassName : 'ap-value');
    if (valueContent instanceof Node) {
        value.appendChild(valueContent);
    } else {
        value.textContent = String(valueContent == null ? '' : valueContent);
    }

    grid.appendChild(value);
}

function normalizeCarStatus(rawStatus, car) {
    var normalized = String(rawStatus || 'Sale').trim().toLowerCase();
    var reserveValue = Number.isFinite(car && car.reservePrice) ? car.reservePrice : null;
    var currentBid = Number.isFinite(car && car.currentBid) ? car.currentBid : NaN;

    if (normalized === 'sold') return 'sold';

    if (
        normalized === 'reserve is off' ||
        normalized === 'reserve-off' ||
        normalized === 'reserve_off' ||
        normalized === 'reserveoff'
    ) {
        return 'reserve-off';
    }

    if (normalized === 'appending' || normalized === 'reserve') {
        if (reserveValue !== null && Number.isFinite(currentBid) && currentBid >= reserveValue) {
            return 'reserve-off';
        }
        return 'appending';
    }

    return 'sale';
}

function parseTimeRemainingToSeconds(timeRemaining) {
    var raw = String(timeRemaining || '').trim();
    var match = raw.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (!match) return null;

    var hours = Number(match[1]);
    var minutes = Number(match[2]);
    var seconds = Number(match[3]);
    if ([hours, minutes, seconds].some(Number.isNaN)) return null;
    return (hours * 3600) + (minutes * 60) + seconds;
}

function parseAuctionStartTime(car) {
    if (car && car.auctionStartAt) {
        var parsedStart = new Date(car.auctionStartAt);
        if (!Number.isNaN(parsedStart.getTime())) {
            return parsedStart;
        }
    }

    return null;
}

function parseAuctionEndTime(car) {
    if (car && car.auctionEndAt) {
        var parsedEnd = new Date(car.auctionEndAt);
        if (!Number.isNaN(parsedEnd.getTime())) {
            return parsedEnd;
        }
    }

    var startTime = parseAuctionStartTime(car);
    if (!startTime) {
        return null;
    }

    return new Date(startTime.getTime() + (24 * 60 * 60 * 1000));
}

function getBidCountdownEndTime(car, status) {
    if (status === 'sold') {
        return null;
    }

    var endTime = parseAuctionEndTime(car);
    if (endTime && endTime.getTime() > Date.now()) {
        return endTime.getTime();
    }

    var secondsRemaining = parseTimeRemainingToSeconds(car.timeRemaining);
    if (secondsRemaining !== null && secondsRemaining > 0) {
        return Date.now() + (secondsRemaining * 1000);
    }

    return null;
}

function isActiveAuctionCar(car, status) {
    if (status === 'sold') {
        return false;
    }

    var startTime = parseAuctionStartTime(car);
    if (startTime) {
        var now = Date.now();
        var endTime = parseAuctionEndTime(car);
        var endMs = endTime ? endTime.getTime() : (startTime.getTime() + (24 * 60 * 60 * 1000));
        return now >= startTime.getTime() && now < endMs;
    }

    var secondsRemaining = parseTimeRemainingToSeconds(car.timeRemaining);
    if (secondsRemaining === null || secondsRemaining <= 0) {
        return false;
    }

    return secondsRemaining <= (24 * 3600);
}

function getCarDetailSectionMode(car, status, sourceSection) {
    if (sourceSection === 'seller') {
        return 'seller';
    }

    if (sourceSection === 'active' || sourceSection === 'marketplace' || sourceSection === 'sold') {
        return sourceSection;
    }

    if (status === 'sold') {
        return 'sold';
    }

    if (isActiveAuctionCar(car, status)) {
        return 'active';
    }

    if (status === 'reserve-off') {
        return 'sold';
    }

    return 'marketplace';
}

function getCarDetailDisplayStatus(status, sectionMode) {
    if (sectionMode === 'sold') {
        return 'sold';
    }

    return status;
}

function formatCountdownMs(remainingMs) {
    var totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;

    return [hours, minutes, seconds].map(function (value) {
        return String(value).padStart(2, '0');
    }).join(':');
}

function startBidCountdown(target, car, status) {
    clearBidCountdown();

    if (!target || status === 'sold') {
        return;
    }

    var endTimeMs = getBidCountdownEndTime(car, status);
    if (!endTimeMs) {
        return;
    }

    function updateCountdown() {
        var remainingMs = endTimeMs - Date.now();
        if (remainingMs <= 0) {
            target.textContent = 'Bidding Closed';
            clearBidCountdown();
            return;
        }

        target.textContent = formatCountdownMs(remainingMs);
    }

    updateCountdown();
    bidCountdownIntervalId = window.setInterval(updateCountdown, 1000);
}

function getBidIncrementAmount(currentBid) {
    var safeBid = Number.isFinite(currentBid) ? currentBid : 0;

    if (safeBid <= 10000) {
        return 100;
    }

    if (safeBid <= 30000) {
        return 200;
    }

    if (safeBid <= 50000) {
        return 250;
    }

    if (safeBid <= 100000) {
        return 500;
    }

    return 1000;
}

function buildAuctionPanelElement(car) {
    var status = normalizeCarStatus(car.status, car);
    var safeBid = Number.isFinite(car.currentBid) ? car.currentBid : 0;
    var safePickup = car.pickup || '\u2014';
    var safeLocation = car.location || '\u2014';
    var safeSeller = car.seller || '\u2014';
    var safeTimeRemaining = car.timeRemaining || '\u2014';
    var statusLabel, statusClass;

    if (status === 'sold') {
        statusLabel = 'Sold';
        statusClass = 'ap-status-sold';
    } else if (status === 'reserve-off') {
        statusLabel = 'Reserve Is Off';
        statusClass = 'ap-status-reserveoff';
    } else if (status === 'appending') {
        statusLabel = 'Reserve';
        statusClass = 'ap-status-reserve';
    } else {
        statusLabel = 'On Sale';
        statusClass = 'ap-status-sale';
    }

    var panel = createElement('div', 'auction-panel');
    var header = createElement('div', 'ap-header');
    var saleType = createElement('span', 'ap-sale-type');
    var infoIcon = createIcon('fas fa-info-circle ap-info-icon');
    infoIcon.setAttribute('title', 'Timed bidding - highest valid bid wins when the timer expires');
    saleType.appendChild(document.createTextNode('Timed Sale '));
    saleType.appendChild(infoIcon);
    header.appendChild(saleType);
    panel.appendChild(header);

    var infoGrid = createElement('div', 'ap-info-grid');
    var statusBadge = createElement('span', 'ap-status-badge ' + statusClass, statusLabel);
    appendInfoRow(infoGrid, 'Status', statusBadge);
    appendInfoRow(infoGrid, 'Time Left', status === 'sold' ? '\u2014' : 'Ends in ' + safeTimeRemaining, 'ap-time-value');
    if (status !== 'sold') {
        appendInfoRow(infoGrid, 'Current Bid', '$' + safeBid.toLocaleString(), 'ap-current-bid');
    }
    appendInfoRow(infoGrid, 'Pickup', safePickup);
    appendInfoRow(infoGrid, 'Location', safeLocation);
    appendInfoRow(infoGrid, 'Seller', safeSeller, 'ap-seller-name');
    panel.appendChild(infoGrid);

    var actions = createElement('div', 'ap-actions');

    if (status === 'sold') {
        var soldNotice = createElement('div', 'ap-sold-notice');
        soldNotice.appendChild(createIcon('fas fa-check-circle'));
        soldNotice.appendChild(document.createTextNode(' Sold for $' + safeBid.toLocaleString()));
        actions.appendChild(soldNotice);
    } else {
        if (status === 'sale' || status === 'reserve-off') {
            var buyNow = car.buyNowPrice ? car.buyNowPrice : Math.round(safeBid * 1.1);
            var buyNowBtn = createElement('button', 'ap-btn ap-btn-buynow', 'BUY NOW $' + buyNow.toLocaleString());
            buyNowBtn.type = 'button';
            buyNowBtn.dataset.tooltip = 'Buy Now: $' + buyNow.toLocaleString();
            actions.appendChild(buyNowBtn);
        }

        actions.appendChild(createElement('button', 'ap-btn ap-btn-bid', 'BID $' + safeBid.toLocaleString()));
        actions.lastChild.type = 'button';
        actions.appendChild(createElement('button', 'ap-btn ap-btn-offer', 'MAKE OFFER'));
        actions.lastChild.type = 'button';
    }
    panel.appendChild(actions);

    if (status !== 'sold') {
        var footer = createElement('div', 'ap-footer');
        var floorNote = createElement('span', 'ap-floor-note');
        floorNote.appendChild(createIcon('fas fa-check-circle'));
        floorNote.appendChild(document.createTextNode(' Starting Bid = Floor'));

        var feesLink = createElement('a', 'ap-fees-link', 'View Fees');
        feesLink.href = '#';

        footer.appendChild(floorNote);
        footer.appendChild(feesLink);
        panel.appendChild(footer);
    }

    var zipSection = createElement('div', 'ap-zip-section');
    zipSection.appendChild(createElement('span', 'ap-zip-label', 'Estimate Transport Cost'));

    var zipRow = createElement('div', 'ap-zip-row');
    var zipInput = createElement('input', 'ap-zip-input');
    zipInput.type = 'text';
    zipInput.placeholder = 'ZIP code';
    zipInput.maxLength = 5;
    zipInput.setAttribute('aria-label', 'ZIP code for transport estimate');

    var zipButton = createElement('button', 'ap-zip-btn', 'GO');
    zipButton.type = 'button';

    zipRow.appendChild(zipInput);
    zipRow.appendChild(zipButton);
    zipSection.appendChild(zipRow);
    panel.appendChild(zipSection);

    var historySection = createElement('div', 'ap-history-section');
    historySection.appendChild(createElement('h4', 'ap-history-title', 'Vehicle History'));

    var historyGrid = createElement('div', 'ap-history-grid');
    [
        ['Owners', '\u2014'],
        ['AC&INT', '\u2014'],
        ['Titles/Probs', '\u2014'],
        ['ODO', '\u2014']
    ].forEach(function (entry) {
        var col = createElement('div', 'ap-history-col');
        col.appendChild(createElement('span', 'ap-history-label', entry[0]));
        col.appendChild(createElement('span', 'ap-history-val', entry[1]));
        historyGrid.appendChild(col);
    });

    var carfaxButton = createElement('a', 'ap-carfax-btn', 'CARFAX');
    carfaxButton.href = '#';
    carfaxButton.target = '_blank';
    carfaxButton.rel = 'noopener noreferrer';
    carfaxButton.setAttribute('aria-label', 'View CARFAX vehicle history report');
    carfaxButton.insertBefore(createIcon('fas fa-car'), carfaxButton.firstChild);
    carfaxButton.insertBefore(document.createTextNode(' '), carfaxButton.childNodes[1] || null);
    historyGrid.appendChild(carfaxButton);

    historySection.appendChild(historyGrid);
    panel.appendChild(historySection);

    return panel;
}

function getStableSeed(text) {
    return String(text || '').split('').reduce(function (total, character, index) {
        return total + character.charCodeAt(0) * (index + 1);
    }, 0);
}

function getAuctionIdentifier(car) {
    var seed = getStableSeed(car.id || car.model || 'vehicle');
    return String(1000000 + (seed % 9000000));
}

function getVehicleVin(car) {
    return car && car.vin ? String(car.vin).toUpperCase() : '-';
}

function getVehiclePhotoSources(car, titleText) {
    var gallery = typeof window.getVehicleGallerySources === 'function'
        ? window.getVehicleGallerySources(car)
        : (car && car.photo ? [car.photo] : []);

    return gallery.map(function (src, index) {
        return {
            src: src,
            alt: index === 0 ? (titleText + ' primary photo') : (titleText + ' photo ' + (index + 1))
        };
    });
}

function getVehicleLocationParts(car) {
    var location = String(car.location || '').split(',');
    return {
        city: location[0] ? location[0].trim() : '-',
        region: location[1] ? location[1].trim() : '-'
    };
}

function getFuelType(engineText) {
    var normalized = String(engineText || '').toLowerCase();
    if (normalized.indexOf('electric') !== -1) return 'Electric';
    if (normalized.indexOf('diesel') !== -1) return 'Diesel';
    if (normalized.indexOf('hybrid') !== -1) return 'Hybrid';
    return 'Gasoline';
}

function getDerivedViews(car) {
    return 40 + (getStableSeed(car.id) % 180);
}

function getDerivedPhotoCount(photoSources) {
    return Math.max(1, photoSources.length);
}

function getMarketRange(car) {
    var baseValue = Number.isFinite(car.currentBid) ? car.currentBid : (Number.isFinite(car.startingBid) ? car.startingBid : 0);
    var lower = Math.max(1000, Math.round((baseValue * 0.93) / 100) * 100);
    var upper = Math.max(lower + 500, Math.round(((car.buyNowPrice || (baseValue * 1.14))) / 100) * 100);
    return {
        lower: lower,
        upper: upper
    };
}

function getTransportEstimate(car) {
    var seed = getStableSeed(car.pickup || car.location || car.id);
    return {
        destination: car.pickup || car.location || 'Destination pending',
        price: 850 + (seed % 1450),
        etaDays: 3 + (seed % 6)
    };
}

function getAnnouncementItems(car) {
    var items = [];

    items.push({
        title: 'Condition Summary',
        detail: (car.condition || 'Condition pending') + ' - ' + (car.description || 'Vehicle summary not yet provided.')
    });

    items.push({
        title: 'Powertrain',
        detail: [car.engine || 'Engine pending', car.transmission || 'Transmission pending'].join(' - ')
    });

    items.push({
        title: 'Collection Details',
        detail: [car.pickup || '-', car.location || '-'].join(' | ')
    });

    if (car.seller) {
        items.push({
            title: 'Seller Notes',
            detail: 'Offered by ' + car.seller + ' with live bidding support through Collectors Alliance Exchange.'
        });
    }

    return items;
}

function getDisclosureItems(car) {
    return [
        'Listing data is provided for preview and may be updated before the lot closes.',
        'Transport timing and reserve guidance are estimates based on current listing information.',
        'Review the photo gallery and vehicle details before placing a bid or submitting an offer.',
        'Seller contact and pickup information.'
    ];
}

function createDetailMetaItem(label, value) {
    var item = createElement('div', 'cdv-meta-item');
    item.appendChild(createElement('span', 'cdv-meta-label', label));
    item.appendChild(createElement('strong', 'cdv-meta-value', value));
    return item;
}

function buildMediaMetaStrip(car, photoSources, sourceSection) {
    var auctionId = getAuctionIdentifier(car);
    var metaStrip = createElement('div', 'cdv-meta-strip');
    var status = normalizeCarStatus(car.status, car);
    var sectionMode = getCarDetailSectionMode(car, status, sourceSection);
    var displayStatus = getCarDetailDisplayStatus(status, sectionMode);
    var bids = displayStatus === 'sold' ? 'Closed' : 'Open';
    var location = getVehicleLocationParts(car);

    [
        ['Listing ID', '#' + auctionId],
        ['Location', [location.city, location.region].filter(Boolean).join(', ') || 'Location pending'],
        ['Listing Type', displayStatus === 'sold' ? 'Sold' : 'Ready to Sell'],
        ['Bids', bids],
        ['Views', String(getDerivedViews(car))],
        ['Photos', String(getDerivedPhotoCount(photoSources))]
    ].forEach(function (entry) {
        metaStrip.appendChild(createDetailMetaItem(entry[0], entry[1]));
    });

    return metaStrip;
}

function buildMediaSection(car, titleText) {
    var mediaSection = createElement('section', 'cdv-media-section');
    var photoSources = getVehiclePhotoSources(car, titleText);

    lightboxSrcs = photoSources.slice();
    currentLightboxIndex = 0;

    var mediaGrid = createElement('div', photoSources.length > 1 ? 'cdv-media-grid' : 'cdv-media-grid is-single');
    var hero = createElement('div', 'cdv-media-hero');
    var heroImage = document.createElement('img');
    heroImage.src = photoSources[0] ? photoSources[0].src : '';
    heroImage.alt = photoSources[0] ? photoSources[0].alt : titleText;
    heroImage.loading = 'eager';
    heroImage.setAttribute('data-lightbox-index', '0');
    hero.appendChild(heroImage);

    // Favorite button overlaid on the hero image (top-right corner)
    var favBtnHero = createFavoriteBtn(car.id);
    favBtnHero.classList.add('fav-btn-hero');
    hero.appendChild(favBtnHero);

    mediaGrid.appendChild(hero);

    if (photoSources.length > 1) {
        var thumbGrid = createElement('div', 'cdv-media-thumbs');
        photoSources.slice(1, 5).forEach(function (photo, index) {
            var thumb = createElement('div', 'cdv-media-thumb');
            var image = document.createElement('img');
            image.src = photo.src;
            image.alt = photo.alt;
            image.loading = 'lazy';
            image.setAttribute('data-lightbox-index', String(index + 1));
            thumb.appendChild(image);

            if (index === 3 && photoSources.length > 5) {
                thumb.appendChild(createElement('span', 'cdv-media-more', '+' + (photoSources.length - 5) + ' more'));
            }

            thumbGrid.appendChild(thumb);
        });
        mediaGrid.appendChild(thumbGrid);
    }

    mediaSection.appendChild(mediaGrid);

    var chips = createElement('div', 'cdv-media-chips');
    [
        'Gallery (' + getDerivedPhotoCount(photoSources) + ')',
        car.condition || 'Condition pending',
        car.bodyStyle || 'Body style pending',
        getFuelType(car.engine)
    ].forEach(function (label, index) {
        chips.appendChild(createElement('span', index === 0 ? 'cdv-chip is-active' : 'cdv-chip', label));
    });

    mediaSection.appendChild(chips);

    return mediaSection;
}

function buildBidStrip(car, sourceSection) {
    var section = createElement('section', 'cdv-bid-strip');
    var status = normalizeCarStatus(car.status, car);
    var sectionMode = getCarDetailSectionMode(car, status, sourceSection);
    var displayStatus = getCarDetailDisplayStatus(status, sectionMode);
    var safeBid = Number.isFinite(car.currentBid) ? car.currentBid : 0;
    var remaining = car.timeRemaining || '-';
    var reserveValue = Number.isFinite(car.buyNowPrice) ? car.buyNowPrice : Math.round(safeBid * 1.12);
    var stats = createElement('div', 'cdv-bid-stats');
    var actions = createElement('div', 'cdv-bid-actions');
    var statusLabel = displayStatus === 'sold' ? 'Sold' : (displayStatus === 'reserve-off' ? 'Reserve Is Off' : (displayStatus === 'appending' ? 'Reserve' : 'Sale'));
    var statusBadge = createElement('span', 'cdv-status-badge cdv-status-' + displayStatus, statusLabel);
    var countdownValue = null;
    var createBidStat = function (label, valueContent, valueClassName, statClassName) {
        var stat = createElement('div', statClassName ? 'cdv-bid-stat ' + statClassName : 'cdv-bid-stat');
        var value = createElement('strong', valueClassName || 'cdv-bid-value');
        stat.appendChild(createElement('span', 'cdv-bid-label', label));

        if (valueContent instanceof Node) {
            value.appendChild(valueContent);
        } else {
            value.textContent = String(valueContent == null ? '' : valueContent);
        }

        stat.appendChild(value);
        return stat;
    };

    if (sectionMode === 'seller') {
        var sellerStatusBadge = createElement('span', 'cdv-status-badge cdv-status-ready-for-sale', 'Ready for Sale');
        var sellerNote = createElement('span', 'cdv-bid-value cdv-seller-preview-note', 'Not yet listed for auction');
        stats.appendChild(createBidStat('Status', sellerStatusBadge));
        stats.appendChild(createElement('div', 'cdv-bid-stat cdv-bid-stat-preview', sellerNote));

        var previewPrimary = createElement('button', 'cdv-bid-button is-primary', 'Bid —');
        previewPrimary.type = 'button';
        previewPrimary.disabled = true;
        previewPrimary.setAttribute('title', 'Listing not yet active');

        var previewBuyNow = createElement('button', 'cdv-bid-button', 'Buy Now —');
        previewBuyNow.type = 'button';
        previewBuyNow.disabled = true;
        previewBuyNow.setAttribute('title', 'Listing not yet active');

        var previewProxy = createElement('button', 'cdv-bid-button', 'Set Proxy');
        previewProxy.type = 'button';
        previewProxy.disabled = true;
        previewProxy.setAttribute('title', 'Listing not yet active');

        actions.appendChild(previewPrimary);
        actions.appendChild(previewBuyNow);
        actions.appendChild(previewProxy);

        section.appendChild(stats);
        section.appendChild(actions);
        return section;
    }

    if (displayStatus === 'sold') {
        var transportSearchRow = createElement('div', 'cdv-transport-search-row');
        var transportInput = createElement('input', 'cdv-transport-search-input');
        transportInput.type = 'text';
        transportInput.placeholder = 'Enter ZIP code';
        transportInput.maxLength = 10;
        transportInput.setAttribute('aria-label', 'Transportation ZIP code');

        var transportButton = createElement('button', 'cdv-transport-search-btn', 'Search');
        transportButton.type = 'button';

        transportSearchRow.appendChild(transportInput);
        transportSearchRow.appendChild(transportButton);

        stats.appendChild(createBidStat('Status', statusBadge));
        stats.appendChild(createBidStat('Transportation', transportSearchRow, 'cdv-bid-value cdv-bid-value-input', 'cdv-bid-stat-transport'));
    } else {
        if (sectionMode === 'active') {
            var countdownStat = createBidStat('Bidding time remaining', remaining, 'cdv-bid-value is-accent');
            countdownValue = countdownStat.querySelector('.cdv-bid-value');
            stats.appendChild(countdownStat);
        }

        stats.appendChild(createBidStat('Status', statusBadge));
        stats.appendChild(createBidStat('Current Bid', '$' + safeBid.toLocaleString()));
    }

    var nextBidAmount = safeBid + getBidIncrementAmount(safeBid);
    var primary = createElement('button', 'cdv-bid-button is-primary', displayStatus === 'sold' ? 'Bidding Closed' : 'Bid $' + nextBidAmount.toLocaleString());
    primary.type = 'button';
    primary.disabled = displayStatus === 'sold';

    var buyNow = createElement('button', 'cdv-bid-button', displayStatus === 'sold' ? 'Sale Closed' : 'Buy Now $' + reserveValue.toLocaleString());
    buyNow.type = 'button';
    buyNow.disabled = displayStatus === 'sold';
    if (displayStatus !== 'sold') {
        buyNow.dataset.tooltip = 'Buy Now: $' + reserveValue.toLocaleString();
    }

    var secondary = createElement('button', 'cdv-bid-button', displayStatus === 'sold' ? 'View History' : 'Set Proxy');
    secondary.type = 'button';

    actions.appendChild(primary);
    if (displayStatus !== 'sold') {
        actions.appendChild(buyNow);
    }
    actions.appendChild(secondary);

    section.appendChild(stats);
    section.appendChild(actions);

    if (countdownValue && sectionMode === 'active' && displayStatus !== 'sold') {
        startBidCountdown(countdownValue, car, status);
    }

    return section;
}

function buildOverviewSection(car, titleText, sourceSection) {
    var wrapper = createElement('section', 'cdv-overview-grid');
    var summary = createElement('article', 'cdv-card cdv-summary-card');
    var location = getVehicleLocationParts(car);
    var summaryMeta = createElement('div', 'cdv-summary-meta');
    var badges = createElement('div', 'cdv-summary-badges');
    var status = normalizeCarStatus(car.status, car);
    var sectionMode = getCarDetailSectionMode(car, status, sourceSection);
    var displayStatus = getCarDetailDisplayStatus(status, sectionMode);

    summary.appendChild(createElement('h1', 'cdv-title', titleText));
    summary.appendChild(createElement('p', 'cdv-subtitle', [car.bodyStyle, car.transmission, car.engine].filter(Boolean).join(' - ')));

    [
        ['VIN', getVehicleVin(car)],
        ['Lot', '#' + getAuctionIdentifier(car)],
        ['Pickup', car.pickup || '-'],
        ['Mileage', (car.mileage || '-') + ' miles'],
        ['Location', [location.city, location.region].filter(Boolean).join(', ') || '-']
    ].forEach(function (entry) {
        var row = createElement('div', 'cdv-summary-row');
        row.appendChild(createElement('span', 'cdv-summary-label', entry[0]));
        row.appendChild(createElement('span', 'cdv-summary-value', entry[1]));
        summaryMeta.appendChild(row);
    });

    [car.condition || 'Condition pending', displayStatus === 'sold' ? 'Sold' : 'Live Bidding', getFuelType(car.engine)].forEach(function (text, index) {
        badges.appendChild(createElement('span', index === 1 ? 'cdv-badge is-accent' : 'cdv-badge', text));
    });

    summary.appendChild(summaryMeta);
    summary.appendChild(badges);
    summary.appendChild(createElement('p', 'cdv-description', car.description || 'Vehicle description pending.'));

    wrapper.appendChild(summary);
    return wrapper;
}

function buildInspectionCard(car) {
    var card = createElement('article', 'cdv-card');
    card.appendChild(createElement('h3', 'cdv-card-title', 'Announcements'));
    var list = createElement('div', 'cdv-list');

    getAnnouncementItems(car).forEach(function (item) {
        var row = createElement('div', 'cdv-list-row');
        row.appendChild(createElement('strong', 'cdv-list-title', item.title));
        row.appendChild(createElement('p', 'cdv-list-text', item.detail));
        list.appendChild(row);
    });

    card.appendChild(list);
    return card;
}

function buildValueCard(car) {
    var range = getMarketRange(car);
    var card = createElement('article', 'cdv-card');
    card.appendChild(createElement('h3', 'cdv-card-title', 'Market Range'));
    card.appendChild(createElement('div', 'cdv-report-brand', 'Collectors Alliance Insight'));
    card.appendChild(createElement('p', 'cdv-muted-text', 'Estimated wholesale range based on current bid position, vehicle segment, and listing condition.'));
    card.appendChild(createElement('div', 'cdv-range-value', '$' + range.lower.toLocaleString() + ' - $' + range.upper.toLocaleString()));
    return card;
}

function buildTransportCard(car) {
    var estimate = getTransportEstimate(car);
    var card = createElement('article', 'cdv-card');
    card.appendChild(createElement('h3', 'cdv-card-title', 'Transportation Quote'));
    card.appendChild(createElement('p', 'cdv-muted-text', 'Experience streamlined transport estimates based on the current pickup location.'));

    var row = createElement('div', 'cdv-transport-row');
    var destination = createElement('div', 'cdv-transport-destination');
    destination.appendChild(createElement('strong', null, estimate.destination));
    destination.appendChild(createElement('span', 'cdv-muted-text', estimate.etaDays + ' business days'));
    row.appendChild(destination);
    row.appendChild(createElement('strong', 'cdv-transport-price', '$' + estimate.price.toLocaleString()));
    card.appendChild(row);
    return card;
}

function buildVehicleDetailsCard(car) {
    var card = createElement('article', 'cdv-card');
    var detailsTable = createElement('div', 'cdv-detail-table');
    var location = getVehicleLocationParts(car);

    card.appendChild(createElement('h3', 'cdv-card-title', 'Vehicle Details'));

    [
        ['City', [location.city, location.region].filter(Boolean).join(', ') || '-'],
        ['VIN', getVehicleVin(car)],
        ['Lot', '#' + getAuctionIdentifier(car)],
        ['Odometer', (car.mileage || '-')],
        ['Transmission', car.transmission || '-'],
        ['Body Style', car.bodyStyle || '-'],
        ['Engine', car.engine || '-'],
        ['Fuel Type', getFuelType(car.engine)],
        ['Year', String(car.year || '-')],
        ['Make', car.make || '-'],
        ['Model', car.model || '-'],
        ['Pickup', car.pickup || '-'],
        ['Listing Status', 'Live Now']
    ].forEach(function (entry) {
        var row = createElement('div', 'cdv-detail-row');
        row.appendChild(createElement('span', 'cdv-detail-label', entry[0]));
        row.appendChild(createElement('span', 'cdv-detail-value', entry[1]));
        detailsTable.appendChild(row);
    });

    card.appendChild(detailsTable);
    return card;
}

function buildDisclosureCard(car) {
    var card = createElement('article', 'cdv-card');
    card.appendChild(createElement('h3', 'cdv-card-title', 'Additional Disclosures'));
    var list = createElement('div', 'cdv-list');

    getDisclosureItems(car).forEach(function (item) {
        list.appendChild(createElement('p', 'cdv-list-text', item));
    });

    card.appendChild(list);
    return card;
}

function buildHistoryCard() {
    var card = createElement('article', 'cdv-card');
    card.appendChild(createElement('h3', 'cdv-card-title', 'Vehicle History'));

    var header = createElement('div', 'cdv-history-row');
    header.appendChild(createElement('div', 'cdv-report-brand', 'CARFAX'));
    var link = createElement('a', 'cdv-inline-link', 'View Report');
    link.href = '#';
    header.appendChild(link);
    card.appendChild(header);

    card.appendChild(createElement('p', 'cdv-muted-text', 'History snapshots, title notes, and ownership disclosures can be surfaced here as your listing data grows.'));
    return card;
}

function buildContentSection(car) {
    var section = createElement('section', 'cdv-content-grid');
    var left = createElement('div', 'cdv-column');
    var right = createElement('div', 'cdv-column');

    left.appendChild(buildInspectionCard(car));
    left.appendChild(buildDisclosureCard(car));

    right.appendChild(buildHistoryCard());
    right.appendChild(buildValueCard(car));
    right.appendChild(buildTransportCard(car));
    right.appendChild(buildVehicleDetailsCard(car));

    section.appendChild(left);
    section.appendChild(right);
    return section;
}

function renderCarDetail(car, sourceSection) {
    var section = document.getElementById('carDetailSection');
    if (!section) return;

    section.textContent = '';

    var titleText = [car.year, car.make, car.model].filter(Boolean).join(' ');
    var photoSources = getVehiclePhotoSources(car, titleText);
    var photoCount = getDerivedPhotoCount(photoSources);

    section.appendChild(buildMediaMetaStrip(car, photoSources, sourceSection));
    section.appendChild(buildBidStrip(car, sourceSection));
    section.appendChild(buildMediaSection(car, titleText));
    section.appendChild(buildOverviewSection(car, titleText, sourceSection));
    section.appendChild(buildContentSection(car));

    // Wire sidebar Watchlist quick-action to favorites
    var sidebarFavAction = document.getElementById('sidebarFavAction');
    var sidebarFavIcon = document.getElementById('sidebarFavIcon');
    if (sidebarFavAction) {
        function syncSidebarFav() {
            var fav = isFavorite(car.id);
            sidebarFavAction.setAttribute('aria-label', fav ? 'Remove from favorites' : 'Save to favorites');
            sidebarFavAction.setAttribute('title', fav ? 'Remove from favorites' : 'Save to favorites');
            var iconEl = sidebarFavAction.querySelector('.action-icon i');
            if (iconEl) iconEl.className = (fav ? 'fas' : 'far') + ' fa-heart';
            if (sidebarFavIcon) {
                var collapsedIcon = sidebarFavIcon.querySelector('i');
                if (collapsedIcon) collapsedIcon.className = (fav ? 'fas' : 'far') + ' fa-heart';
                sidebarFavIcon.setAttribute('aria-label', fav ? 'Remove from favorites' : 'Save to favorites');
                sidebarFavIcon.setAttribute('title', fav ? 'Remove from favorites' : 'Save to favorites');
                sidebarFavIcon.setAttribute('data-tooltip', fav ? 'Remove from favorites' : 'Save to favorites');
            }
        }
        syncSidebarFav();
        sidebarFavAction.addEventListener('click', function (e) {
            e.preventDefault();
            toggleFavorite(car.id);
            syncSidebarFav();
            // Sync all fav-btn instances on the page too
            document.querySelectorAll('.fav-btn[data-car-id="' + car.id + '"]').forEach(function (btn) {
                var fav = isFavorite(car.id);
                btn.classList.toggle('is-favorited', fav);
                btn.setAttribute('aria-pressed', fav ? 'true' : 'false');
                btn.setAttribute('aria-label', fav ? 'Remove from favorites' : 'Add to favorites');
                btn.querySelector('i').className = (fav ? 'fas' : 'far') + ' fa-heart';
            });
        });
        if (sidebarFavIcon) {
            sidebarFavIcon.addEventListener('click', function (e) {
                e.preventDefault();
                sidebarFavAction.click();
            });
        }
    }
}
