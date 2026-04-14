let lastScrollTop = 0;
const mainContent = document.getElementById('mainContent');
const stickyHeader = document.getElementById('stickyHeader');
const dashboardPerfDebugEnabled = new URLSearchParams(window.location.search).get('debugPerf') === '1';
const dashboardPerfConsoleEnabled = new URLSearchParams(window.location.search).get('debugPerfLog') === '1';

function initDashboardPerfDebug(scrollHost) {
    if (!dashboardPerfDebugEnabled || !scrollHost) return;

    let frameCount = 0;
    let scrollEvents = 0;
    const perfBadge = document.createElement('div');
    perfBadge.setAttribute('role', 'status');
    perfBadge.setAttribute('aria-live', 'polite');
    perfBadge.style.position = 'fixed';
    perfBadge.style.right = '12px';
    perfBadge.style.bottom = '12px';
    perfBadge.style.zIndex = '9999';
    perfBadge.style.padding = '8px 10px';
    perfBadge.style.borderRadius = '8px';
    perfBadge.style.background = 'rgba(17, 24, 39, 0.88)';
    perfBadge.style.color = '#f9fafb';
    perfBadge.style.fontFamily = 'Consolas, "Courier New", monospace';
    perfBadge.style.fontSize = '12px';
    perfBadge.style.lineHeight = '1.3';
    perfBadge.style.pointerEvents = 'none';
    perfBadge.style.whiteSpace = 'pre';
    perfBadge.textContent = 'perf: initializing...';
    document.body.appendChild(perfBadge);

    scrollHost.addEventListener('scroll', function () {
        scrollEvents += 1;
    }, { passive: true });

    function trackFrames() {
        frameCount += 1;
        requestAnimationFrame(trackFrames);
    }

    requestAnimationFrame(trackFrames);

    setInterval(function () {
        const fpsApprox = frameCount;
        const currentScrollEvents = scrollEvents;
        const currentScrollTop = scrollHost.scrollTop;

        perfBadge.textContent = [
            'debugPerf=1',
            'fps~: ' + fpsApprox,
            'scroll ev/s: ' + currentScrollEvents,
            'scrollTop: ' + Math.round(currentScrollTop)
        ].join('\n');

        if (dashboardPerfConsoleEnabled) {
            console.log('[dashboard-perf]', {
                fpsApprox: fpsApprox,
                scrollEvents: currentScrollEvents,
                scrollTop: currentScrollTop
            });
        }
        frameCount = 0;
        scrollEvents = 0;
    }, 1000);
}

// Scroll detection for hiding/showing header
if (mainContent && stickyHeader) {
    initDashboardPerfDebug(mainContent);

    let headerScrollTicking = false;
    let pendingScrollTop = 0;

    function applyStickyHeaderVisibility() {
        const scrollTop = pendingScrollTop;

        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down
            stickyHeader.classList.remove('visible');
        } else {
            // Scrolling up
            stickyHeader.classList.add('visible');
        }

        lastScrollTop = scrollTop;
        headerScrollTicking = false;
    }

    mainContent.addEventListener('scroll', function () {
        pendingScrollTop = mainContent.scrollTop;
        if (headerScrollTicking) return;
        headerScrollTicking = true;
        requestAnimationFrame(applyStickyHeaderVisibility);
    }, { passive: true });

    // Initialize as visible
    stickyHeader.classList.add('visible');
}

// Suppress welcome banner immediately on return visits. Runs synchronously
// while the DOM is ready (scripts are deferred to end of <body>), so there
// is no visible flash between page paint and event-loop callbacks.
(function () {
    try {
        if (window.sessionStorage.getItem('dashboardWelcomeShown') === '1') {
            var banner = document.querySelector('.welcome-banner');
            if (banner && banner.parentNode) {
                banner.parentNode.removeChild(banner);
            }
        }
    } catch (e) { /* sessionStorage unavailable — banner will show normally */ }
}());

document.addEventListener('components:ready', function() {
    // On the first visit the banner is still in the DOM. Mark it as shown and
    // schedule the fade-out so it disappears after a short display window.
    var banner = document.querySelector('.welcome-banner');
    if (banner) {
        try {
            window.sessionStorage.setItem('dashboardWelcomeShown', '1');
        } catch (e) { /* ignore */ }
        setTimeout(function() {
            banner.classList.add('fade-out');
            setTimeout(function() {
                if (banner.parentNode) banner.parentNode.removeChild(banner);
            }, 3000); // keep in sync with CSS animation duration
        }, 5000);
    }

    // Initialize auction view system
    initializeAuctionView();
    window.addEventListener('pagehide', persistDashboardUiState);
});

// Auction View Management
let currentView = 'tile';
let currentPage = 1;
let currentDashboardMode = 'market';
let currentMarketTab = 'active';
const itemsPerPage = 8;
const DASHBOARD_UI_STATE_KEY = 'dashboardUiState';
let allCars = [];
let allAuctionItems = [];
let filteredAuctionItems = [];
let allActiveAuctionItems = [];
let filteredActiveAuctionItems = [];
let allMarketplaceItems = [];
let filteredMarketplaceItems = [];
let allSoldItems = [];
let filteredSoldItems = [];
const cardPhotoSourceCache = new Map();
let searchFilterState = {
    make: new Set(),
    engine: new Set(),
    body: new Set()
};

function normalizeDashboardUiState(rawState) {
    const source = rawState || {};
    return {
        view: source.view === 'list' ? 'list' : 'tile',
        mode: source.mode === 'sold' ? 'sold' : 'market',
        marketTab: source.marketTab === 'marketplace' ? 'marketplace' : 'active',
        page: Number.isInteger(source.page) && source.page > 0 ? source.page : 1,
        scrollTop: Number.isFinite(source.scrollTop) && source.scrollTop >= 0 ? source.scrollTop : 0
    };
}

function getDashboardUiState() {
    try {
        const raw = window.sessionStorage.getItem(DASHBOARD_UI_STATE_KEY);
        if (!raw) {
            return normalizeDashboardUiState();
        }

        return normalizeDashboardUiState(JSON.parse(raw));
    } catch (err) {
        return normalizeDashboardUiState();
    }
}

function persistDashboardUiState() {
    try {
        window.sessionStorage.setItem(
            DASHBOARD_UI_STATE_KEY,
            JSON.stringify(normalizeDashboardUiState({
                view: currentView,
                mode: currentDashboardMode,
                marketTab: currentMarketTab,
                page: currentPage,
                scrollTop: mainContent ? mainContent.scrollTop : 0
            }))
        );
    } catch (err) {
        // Ignore storage failures so dashboard navigation still works.
    }
}

function restoreDashboardUiState() {
    const savedState = getDashboardUiState();
    const totalPages = Math.max(1, Math.ceil(filteredActiveAuctionItems.length / itemsPerPage));

    switchView(savedState.view);
    setDashboardMode(savedState.mode);
    setMarketTab(savedState.marketTab, { skipPagination: true });
    currentPage = Math.min(savedState.page, totalPages);
    updatePagination();

    if (mainContent && savedState.scrollTop > 0) {
        requestAnimationFrame(function () {
            mainContent.scrollTop = savedState.scrollTop;
            lastScrollTop = savedState.scrollTop;
        });
    }
}

function normalizeStatus(rawStatus, car) {
    const normalized = String(rawStatus || 'Sale').trim().toLowerCase();
    const reserveValue = Number.isFinite(car && car.reservePrice) ? car.reservePrice : null;
    const currentBid = Number.isFinite(car && car.currentBid) ? car.currentBid : NaN;

    if (normalized === 'sold') return { label: 'Sold', className: 'status-sold' };

    if (
        normalized === 'reserve is off' ||
        normalized === 'reserve-off' ||
        normalized === 'reserve_off' ||
        normalized === 'reserveoff'
    ) {
        return { label: 'Reserve is Off', className: 'status-reserve-off' };
    }

    if (normalized === 'appending' || normalized === 'reserve') {
        if (reserveValue !== null && Number.isFinite(currentBid) && currentBid >= reserveValue) {
            return { label: 'Reserve is Off', className: 'status-reserve-off' };
        }
        return { label: 'Reserve', className: 'status-appending' };
    }

    return { label: 'Sale', className: 'status-sale' };
}

function getAuctionCardSummary(car) {
    const parts = [car.engine, car.transmission, car.condition].filter(Boolean);
    return parts.join(' • ');
}

function getAuctionDisplayVin(car) {
    return String((car && car.vin) || (car && car.id) || '-').toUpperCase();
}

function getAuctionSecondaryPrice(car) {
    if (Number.isFinite(car && car.buyNowPrice)) {
        return { label: 'Buy Now', value: '$' + car.buyNowPrice.toLocaleString('en-US') };
    }

    if (Number.isFinite(car && car.reservePrice)) {
        return { label: 'Reserve', value: '$' + car.reservePrice.toLocaleString('en-US') };
    }

    return { label: 'Buy Now', value: '--' };
}

function getAuctionListMeta(car, sectionMode) {
    const meta = [
        { label: 'VIN', value: getAuctionDisplayVin(car) },
        { label: 'Seller', value: car.seller || 'Seller pending' },
        { label: 'Location', value: car.location || car.pickup || 'Location pending' },
        { label: 'Mileage', value: car.mileage || '--' }
    ];

    if (sectionMode === 'active') {
        meta.push({ label: 'Time Left', value: car.timeRemaining || '--' });
    } else if (sectionMode === 'marketplace') {
        const secondaryPrice = getAuctionSecondaryPrice(car);
        meta.push(secondaryPrice);
    }

    return meta;
}

function getCardPhotoCandidateSources(car) {
    const primary = String((car && car.photo) || `cars-photos/${(car && car.id) || ''}.png`).trim();
    const explicitGallery = Array.isArray(car && car.photos) ? car.photos : [];
    const candidates = [primary].concat(explicitGallery).filter(Boolean);

    const extMatch = primary.match(/^(.*?)(\.[a-z0-9]+)$/i);
    if (extMatch) {
        const basePath = extMatch[1];
        const extension = extMatch[2];

        for (let index = 2; index <= 12; index += 1) {
            const suffix = String(index).padStart(2, '0');
            candidates.push(`${basePath}-${suffix}${extension}`);
        }
    }

    return Array.from(new Set(candidates));
}

function probeImageSource(source) {
    return new Promise(function (resolve) {
        const image = new Image();
        image.onload = function () {
            resolve(source);
        };
        image.onerror = function () {
            resolve(null);
        };
        image.src = source;
    });
}

function resolveCardPhotoSources(car) {
    const cacheKey = String((car && car.id) || (car && car.photo) || '');
    if (!cacheKey) {
        return Promise.resolve([]);
    }

    if (cardPhotoSourceCache.has(cacheKey)) {
        return Promise.resolve(cardPhotoSourceCache.get(cacheKey));
    }

    const candidates = getCardPhotoCandidateSources(car);
    return Promise.all(candidates.map(probeImageSource)).then(function (sources) {
        const availableSources = sources.filter(Boolean);
        cardPhotoSourceCache.set(cacheKey, availableSources);
        return availableSources;
    });
}

function parseTimeRemainingSeconds(timeRemaining) {
    const raw = String(timeRemaining || '').trim();
    const match = raw.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
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

    // Compatibility fallback if listing fields are provided directly in data.
    if (car && car.listingStartDate) {
        var dateParts = String(car.listingStartDate).split('-');
        if (dateParts.length === 3) {
            var year = parseInt(dateParts[0], 10);
            var month = parseInt(dateParts[1], 10);
            var day = parseInt(dateParts[2], 10);

            var rawTime = car.listingStartTime ? String(car.listingStartTime) : '00:00';
            var timeParts = rawTime.split(':');
            var hour = parseInt(timeParts[0] || '0', 10);
            var minute = parseInt(timeParts[1] || '0', 10);

            if (![year, month, day, hour, minute].some(Number.isNaN)) {
                var tzOffsets = { ET: -5, CT: -6, MT: -7, PT: -8 };
                var tzKey = car.listingTimezone || 'ET';
                var offset = Object.prototype.hasOwnProperty.call(tzOffsets, tzKey) ? tzOffsets[tzKey] : -5;
                var startUtcMs = Date.UTC(year, month - 1, day, hour - offset, minute, 0, 0);
                var fallbackStart = new Date(startUtcMs);
                if (!Number.isNaN(fallbackStart.getTime())) {
                    return fallbackStart;
                }
            }
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

function isActiveAuctionCar(car) {
    const status = normalizeStatus(car.status, car);
    if (status.className === 'status-sold') return false;

    const startTime = parseAuctionStartTime(car);
    if (startTime) {
        const now = Date.now();
        const startMs = startTime.getTime();
        const endTime = parseAuctionEndTime(car);
        const endMs = endTime ? endTime.getTime() : (startMs + (24 * 60 * 60 * 1000));
        return now >= startMs && now < endMs;
    }

    const secondsRemaining = parseTimeRemainingSeconds(car.timeRemaining);
    if (secondsRemaining === null) return false;
    if (secondsRemaining <= 0) return false;

    return secondsRemaining <= (24 * 3600);
}

function isDemoActiveAuctionCandidate(car) {
    const status = normalizeStatus(car.status, car);
    if (status.className === 'status-sold') return false;

    const secondsRemaining = parseTimeRemainingSeconds(car.timeRemaining);
    if (secondsRemaining === null || secondsRemaining <= 0) return false;

    return secondsRemaining <= (24 * 3600);
}

function hasReserveMet(car) {
    return normalizeStatus(car.status, car).className === 'status-reserve-off';
}

function getDashboardDisplayStatus(car, sectionMode) {
    const status = normalizeStatus(car.status, car);

    if (sectionMode === 'active') {
        return status;
    }

    if (sectionMode === 'sold') {
        return { label: 'Sold', className: 'status-sold' };
    }

    if (status.className === 'status-appending') {
        return { label: 'Reserve', className: 'status-appending' };
    }

    return status;
}

function getStatusOrderingRank(car, sectionMode) {
    const status = getDashboardDisplayStatus(car, sectionMode);
    switch (status.className) {
        case 'status-reserve-off':
            return 0;
        case 'status-sale':
            return 1;
        case 'status-appending':
            return 2;
        case 'status-sold':
            return 3;
        default:
            return 4;
    }
}

function getCurrentBidValue(car) {
    return Number.isFinite(car && car.currentBid) ? car.currentBid : 0;
}

function getAuctionOrderingTime(car) {
    const endTime = parseAuctionEndTime(car);
    if (endTime) {
        return endTime.getTime();
    }

    const startTime = parseAuctionStartTime(car);
    if (startTime) {
        return startTime.getTime();
    }

    return 0;
}

function compareBySoonestEnding(left, right) {
    const leftSeconds = parseTimeRemainingSeconds(left.timeRemaining);
    const rightSeconds = parseTimeRemainingSeconds(right.timeRemaining);

    if (leftSeconds !== null && rightSeconds !== null && leftSeconds !== rightSeconds) {
        return leftSeconds - rightSeconds;
    }

    const leftTime = getAuctionOrderingTime(left);
    const rightTime = getAuctionOrderingTime(right);
    if (leftTime !== rightTime) {
        return leftTime - rightTime;
    }

    return getCurrentBidValue(right) - getCurrentBidValue(left);
}

function compareMarketplaceCars(left, right) {
    const statusDelta = getStatusOrderingRank(left, 'marketplace') - getStatusOrderingRank(right, 'marketplace');
    if (statusDelta !== 0) {
        return statusDelta;
    }

    const leftTime = getAuctionOrderingTime(left);
    const rightTime = getAuctionOrderingTime(right);
    if (leftTime !== rightTime) {
        return rightTime - leftTime;
    }

    return getCurrentBidValue(right) - getCurrentBidValue(left);
}

function compareSoldCars(left, right) {
    const leftTime = getAuctionOrderingTime(left);
    const rightTime = getAuctionOrderingTime(right);
    if (leftTime !== rightTime) {
        return rightTime - leftTime;
    }

    return getCurrentBidValue(right) - getCurrentBidValue(left);
}

function getDemoActiveAuctionIds(cars) {
    const candidates = cars.filter(function (car) {
        return !isActiveAuctionCar(car) && isDemoActiveAuctionCandidate(car);
    });
    const reserveMetCandidates = candidates
        .filter(function (car) {
            return normalizeStatus(car.status, car).className === 'status-reserve-off';
        })
        .sort(compareBySoonestEnding);
    const reservePendingCandidates = candidates
        .filter(function (car) {
            return normalizeStatus(car.status, car).className === 'status-appending';
        })
        .sort(compareBySoonestEnding);
    const saleCandidates = candidates
        .filter(function (car) {
            return normalizeStatus(car.status, car).className === 'status-sale';
        })
        .sort(compareBySoonestEnding);
    const selected = [];
    const reserveMetQuota = Math.min(1, reserveMetCandidates.length);
    const reservePendingQuota = Math.min(2, reservePendingCandidates.length, Math.max(0, itemsPerPage - 2));

    while (selected.length < reserveMetQuota && reserveMetCandidates.length > 0) {
        selected.push(reserveMetCandidates.shift());
    }

    while (selected.length < reserveMetQuota + reservePendingQuota && reservePendingCandidates.length > 0) {
        selected.push(reservePendingCandidates.shift());
    }

    while (selected.length < itemsPerPage && saleCandidates.length > 0) {
        selected.push(saleCandidates.shift());
    }

    while (selected.length < itemsPerPage && reservePendingCandidates.length > 0) {
        selected.push(reservePendingCandidates.shift());
    }

    while (selected.length < itemsPerPage && reserveMetCandidates.length > 0) {
        selected.push(reserveMetCandidates.shift());
    }

    return new Set(
        selected
            .sort(compareBySoonestEnding)
            .map(function (car) {
                return car.id;
            })
    );
}

function getDashboardSectionMode(car, realActiveIds, demoActiveIds) {
    const normalizedStatus = normalizeStatus(car.status, car);

    if (normalizedStatus.className === 'status-sold') {
        return 'sold';
    }

    if (realActiveIds.has(car.id) || demoActiveIds.has(car.id)) {
        return 'active';
    }

    if (hasReserveMet(car)) {
        return 'sold';
    }

    return 'marketplace';
}

function createAuctionCardElement(car, sectionMode) {
    const title = `${car.year} ${car.make} ${car.model}`;
    const status = getDashboardDisplayStatus(car, sectionMode);
    const summary = getAuctionCardSummary(car);
    const bid = Number.isFinite(car.currentBid) ? car.currentBid.toLocaleString('en-US') : '0';
    const listMeta = getAuctionListMeta(car, sectionMode);

    const item = document.createElement('a');
    item.className = 'auction-item';
    item.setAttribute('data-car-name', car.id);
    item.dataset.searchText = `${title} ${summary} ${car.id}`.toLowerCase();
    item.href = `car-details.html?car=${encodeURIComponent(car.id)}&source=${encodeURIComponent(sectionMode)}`;
    item.target = '_blank';
    item.rel = 'opener';

    const photo = document.createElement('div');
    photo.className = 'auction-photo';
    photo.setAttribute('aria-hidden', 'true');

    const photoImage = document.createElement('img');
    photoImage.className = 'auction-photo-image';
    photoImage.alt = '';
    photoImage.loading = 'lazy';
    photoImage.decoding = 'async';
    if ('fetchPriority' in photoImage) {
        photoImage.fetchPriority = 'low';
    }
    photoImage.src = car.photo || `cars-photos/${car.id}.png`;
    photo.appendChild(photoImage);

    const photoNav = document.createElement('div');
    photoNav.className = 'auction-photo-nav';
    const photoCountBadge = document.createElement('span');
    photoCountBadge.className = 'auction-photo-count';
    photoCountBadge.setAttribute('aria-hidden', 'true');
    let photoSources = [photoImage.src];
    let currentPhotoIndex = 0;

    function renderPhotoCount() {
        if (photoSources.length < 2) {
            photoCountBadge.textContent = '';
            return;
        }

        photoCountBadge.textContent = `${currentPhotoIndex + 1}/${photoSources.length}`;
    }

    function updatePhotoSource(stepDelta) {
        if (photoSources.length < 2) return;
        currentPhotoIndex = (currentPhotoIndex + stepDelta + photoSources.length) % photoSources.length;
        photoImage.src = photoSources[currentPhotoIndex];
        renderPhotoCount();
    }

    const prevPhotoBtn = document.createElement('button');
    prevPhotoBtn.type = 'button';
    prevPhotoBtn.className = 'auction-photo-nav-btn is-prev';
    prevPhotoBtn.setAttribute('aria-label', 'Previous photo');
    prevPhotoBtn.innerHTML = '<i class="fas fa-chevron-left" aria-hidden="true"></i>';

    const nextPhotoBtn = document.createElement('button');
    nextPhotoBtn.type = 'button';
    nextPhotoBtn.className = 'auction-photo-nav-btn is-next';
    nextPhotoBtn.setAttribute('aria-label', 'Next photo');
    nextPhotoBtn.innerHTML = '<i class="fas fa-chevron-right" aria-hidden="true"></i>';

    [prevPhotoBtn, nextPhotoBtn].forEach(function (btn) {
        btn.addEventListener('click', function (event) {
            // Keep image controls interactive without opening the detail page link.
            event.preventDefault();
            event.stopPropagation();
        });
    });

    prevPhotoBtn.addEventListener('click', function () {
        updatePhotoSource(-1);
    });

    nextPhotoBtn.addEventListener('click', function () {
        updatePhotoSource(1);
    });

    photoNav.appendChild(prevPhotoBtn);
    photoNav.appendChild(nextPhotoBtn);
    photo.appendChild(photoCountBadge);
    photo.appendChild(photoNav);

    resolveCardPhotoSources(car)
        .then(function (availableSources) {
            if (!Array.isArray(availableSources) || availableSources.length < 2) {
                photo.classList.remove('has-multiple-photos');
                return;
            }

            photoSources = availableSources;
            currentPhotoIndex = 0;
            photoImage.src = photoSources[currentPhotoIndex];
            photo.classList.add('has-multiple-photos');
            renderPhotoCount();
        })
        .catch(function () {
            photo.classList.remove('has-multiple-photos');
            photoCountBadge.textContent = '';
        });

    const details = document.createElement('div');
    details.className = 'auction-details';

    const detailsHeader = document.createElement('div');
    detailsHeader.className = 'auction-details-header';

    const detailsSummary = document.createElement('div');
    detailsSummary.className = 'auction-details-summary';

    const heading = document.createElement('h4');
    heading.textContent = title;

    const description = document.createElement('p');
    description.textContent = summary;

    detailsSummary.appendChild(heading);
    detailsSummary.appendChild(description);
    detailsHeader.appendChild(detailsSummary);

    const detailGrid = document.createElement('div');
    detailGrid.className = 'auction-detail-grid';

    listMeta.forEach(function (entry) {
        const metaItem = document.createElement('div');
        metaItem.className = 'auction-detail-item';

        const metaLabel = document.createElement('span');
        metaLabel.className = 'auction-detail-label';
        metaLabel.textContent = entry.label;

        const metaValue = document.createElement('strong');
        metaValue.className = 'auction-detail-value';
        metaValue.textContent = entry.value;

        metaItem.appendChild(metaLabel);
        metaItem.appendChild(metaValue);
        detailGrid.appendChild(metaItem);
    });

    const saleTag = document.createElement('div');
    saleTag.className = 'sale-tag';

    const saleLabel = document.createElement('span');
    saleLabel.className = `sale-label ${status.className}`;
    saleLabel.textContent = status.label;

    const salePrice = document.createElement('span');
    salePrice.className = 'sale-price';
    salePrice.textContent = `$${bid}`;

    const salePriceLabel = document.createElement('span');
    salePriceLabel.className = 'sale-price-label';
    salePriceLabel.textContent = sectionMode === 'active' ? 'Current Bid' : 'Lead Bid';

    saleTag.appendChild(saleLabel);
    saleTag.appendChild(salePriceLabel);
    saleTag.appendChild(salePrice);

    let listActionRow = null;
    let tileActionRow = null;

    if (sectionMode === 'active' || sectionMode === 'marketplace') {
        const buildActionRow = function (rowTypeClass) {
            const row = document.createElement('div');
            row.className = 'auction-row-actions ' + rowTypeClass + ' ' + (sectionMode === 'marketplace' ? 'is-marketplace' : 'is-active');

            const bidNow = document.createElement('span');
            bidNow.className = sectionMode === 'active'
                ? 'auction-action-chip is-primary is-bid-action'
                : 'auction-action-chip is-bid-action';
            bidNow.textContent = 'Bid Now';

            const buyNow = document.createElement('span');
            buyNow.className = sectionMode === 'marketplace'
                ? 'auction-action-chip is-primary is-buy-action'
                : 'auction-action-chip is-buy-action';
            buyNow.textContent = 'Buy Now';

            row.appendChild(bidNow);
            row.appendChild(buyNow);
            return row;
        };

        listActionRow = buildActionRow('is-list-row');
        tileActionRow = buildActionRow('is-tile-row');
        detailsHeader.appendChild(listActionRow);
        saleTag.appendChild(tileActionRow);
    }

    details.appendChild(detailsHeader);
    details.appendChild(detailGrid);

    item.appendChild(photo);
    item.appendChild(details);
    item.appendChild(saleTag);

    return item;
}

function renderAuctionGroups(cars) {
    const activeContainer = document.getElementById('auctionsContainer');
    const marketplaceContainer = document.getElementById('marketplaceContainer');
    const soldContainer = document.getElementById('soldContainer');
    if (!activeContainer || !marketplaceContainer || !soldContainer) return;

    activeContainer.textContent = '';
    marketplaceContainer.textContent = '';
    soldContainer.textContent = '';

    const activeFragment = document.createDocumentFragment();
    const marketplaceFragment = document.createDocumentFragment();
    const soldFragment = document.createDocumentFragment();
    const activeItems = [];
    const marketplaceItems = [];
    const soldItems = [];
    const realActiveIds = new Set(
        cars.filter(function (car) {
            return isActiveAuctionCar(car);
        }).map(function (car) {
            return car.id;
        })
    );
    const demoActiveIds = realActiveIds.size === 0 ? getDemoActiveAuctionIds(cars) : new Set();
    const activeCars = [];
    const marketplaceCars = [];
    const soldCars = [];

    cars.forEach(car => {
        const sectionMode = getDashboardSectionMode(car, realActiveIds, demoActiveIds);

        if (sectionMode === 'sold') {
            soldCars.push(car);
            return;
        }

        if (sectionMode === 'active') {
            activeCars.push(car);
        } else {
            marketplaceCars.push(car);
        }
    });

    activeCars
        .sort(compareBySoonestEnding)
        .forEach(function (car) {
            const item = createAuctionCardElement(car, 'active');
            activeFragment.appendChild(item);
            activeItems.push(item);
        });

    marketplaceCars
        .sort(compareMarketplaceCars)
        .forEach(function (car) {
            const item = createAuctionCardElement(car, 'marketplace');
            marketplaceFragment.appendChild(item);
            marketplaceItems.push(item);
        });

    soldCars
        .sort(compareSoldCars)
        .forEach(function (car) {
            const item = createAuctionCardElement(car, 'sold');
            soldFragment.appendChild(item);
            soldItems.push(item);
        });

    activeContainer.appendChild(activeFragment);
    marketplaceContainer.appendChild(marketplaceFragment);
    soldContainer.appendChild(soldFragment);

    allActiveAuctionItems = activeItems;
    filteredActiveAuctionItems = [...allActiveAuctionItems];
    allMarketplaceItems = marketplaceItems;
    filteredMarketplaceItems = [...allMarketplaceItems];
    allSoldItems = soldItems;
    filteredSoldItems = [...allSoldItems];

    allAuctionItems = allActiveAuctionItems.concat(allMarketplaceItems, allSoldItems);
    filteredAuctionItems = filteredActiveAuctionItems.concat(filteredMarketplaceItems, filteredSoldItems);
}

function loadMarketplaceData() {
    return fetch('data/cars.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (!data || !Array.isArray(data.cars)) {
                allCars = [];
                renderAuctionGroups([]);
                return [];
            }

            allCars = data.cars;
            renderAuctionGroups(allCars);
            return allCars;
        })
        .catch(() => {
            allCars = [];
            renderAuctionGroups([]);
            return [];
        });
}

function bindDashboardControls() {
    const tileBtns = document.querySelectorAll('.tile-btn');
    const listBtns = document.querySelectorAll('.list-btn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    // Bind all tile buttons
    tileBtns.forEach(btn => {
        if (!btn.dataset.bound) {
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () {
                switchView('tile');
            });
        }
    });

    // Bind all list buttons
    listBtns.forEach(btn => {
        if (!btn.dataset.bound) {
            btn.dataset.bound = '1';
            btn.addEventListener('click', function () {
                switchView('list');
            });
        }
    });

    if (prevBtn && !prevBtn.dataset.bound) {
        prevBtn.dataset.bound = '1';
        prevBtn.addEventListener('click', previousPage);
    }

    if (nextBtn && !nextBtn.dataset.bound) {
        nextBtn.dataset.bound = '1';
        nextBtn.addEventListener('click', nextPage);
    }
}

function syncDashboardModeUi() {
    const marketSections = document.getElementById('dashboardMarketSections');
    const bottomRow = document.getElementById('dashboardBottomRow');
    const soldSection = document.getElementById('soldSection');
    const soldToggleBtn = document.getElementById('dashboardSoldToggleBtn');
    const isSoldMode = currentDashboardMode === 'sold';

    if (marketSections) {
        marketSections.hidden = isSoldMode;
        marketSections.classList.toggle('dashboard-section-hidden', isSoldMode);
    }

    if (bottomRow) {
        bottomRow.hidden = isSoldMode;
        bottomRow.classList.toggle('dashboard-section-hidden', isSoldMode);
    }

    if (soldSection) {
        soldSection.hidden = !isSoldMode;
        soldSection.classList.toggle('dashboard-section-hidden', !isSoldMode);
    }

    if (soldToggleBtn) {
        soldToggleBtn.classList.toggle('is-active', isSoldMode);
        soldToggleBtn.setAttribute('aria-pressed', isSoldMode ? 'true' : 'false');
    }
}

function setDashboardMode(mode) {
    currentDashboardMode = mode === 'sold' ? 'sold' : 'market';
    currentPage = 1;
    syncDashboardModeUi();
}

function syncMarketTabUi() {
    const activeSection = document.getElementById('activeBiddingSection');
    const marketplaceSection = document.getElementById('marketplaceSection');
    const activeTabBtn = document.getElementById('dashboardTabActive');
    const marketplaceTabBtn = document.getElementById('dashboardTabMarketplace');
    const showActive = currentMarketTab === 'active';

    if (activeSection) {
        activeSection.hidden = !showActive;
        activeSection.classList.toggle('dashboard-section-hidden', !showActive);
    }

    if (marketplaceSection) {
        marketplaceSection.hidden = showActive;
        marketplaceSection.classList.toggle('dashboard-section-hidden', showActive);
    }

    if (activeTabBtn) {
        activeTabBtn.classList.toggle('active', showActive);
        activeTabBtn.setAttribute('aria-selected', showActive ? 'true' : 'false');
    }

    if (marketplaceTabBtn) {
        marketplaceTabBtn.classList.toggle('active', !showActive);
        marketplaceTabBtn.setAttribute('aria-selected', showActive ? 'false' : 'true');
    }
}

function setMarketTab(tab, options) {
    const settings = options || {};
    currentMarketTab = tab === 'marketplace' ? 'marketplace' : 'active';
    syncMarketTabUi();

    if (!settings.skipPagination) {
        updatePagination();
    }
}

function initializeMarketTabs() {
    const tabButtons = document.querySelectorAll('[data-market-tab]');
    if (tabButtons.length === 0) return;

    tabButtons.forEach(function (button) {
        if (button.dataset.bound === '1') return;

        button.dataset.bound = '1';
        button.addEventListener('click', function () {
            setMarketTab(button.dataset.marketTab);
        });
    });
}

function initializeDashboardModeToggle() {
    const soldToggleBtn = document.getElementById('dashboardSoldToggleBtn');
    if (!soldToggleBtn || soldToggleBtn.dataset.bound) return;

    soldToggleBtn.dataset.bound = '1';
    soldToggleBtn.addEventListener('click', function () {
        setDashboardMode(currentDashboardMode === 'sold' ? 'market' : 'sold');
        updatePagination();
    });
}

function initializeAuctionView() {
    const activeContainer = document.getElementById('auctionsContainer');
    const marketplaceContainer = document.getElementById('marketplaceContainer');
    const soldContainer = document.getElementById('soldContainer');
    if (!activeContainer || !marketplaceContainer || !soldContainer) return;

    bindDashboardControls();
    initializeDashboardModeToggle();
    initializeMarketTabs();

    loadMarketplaceData().then(function () {
        initializeAuctionSearch();
        restoreDashboardUiState();
    });
}

function initializeAuctionSearch() {
    const searchWrap = document.querySelector('.below-header-search');
    const searchForm = document.getElementById('auctionSearchForm');
    const searchInput = document.getElementById('auctionSearch');
    const searchTriggerBtn = document.getElementById('searchTriggerBtn');
    const activeFilterBadge = document.getElementById('activeFilterBadge');
    const panel = document.getElementById('searchFiltersPanel');
    const applyFiltersBtn = document.getElementById('applySearchFiltersBtn');
    const clearFiltersBtn = document.getElementById('clearSearchFiltersBtn');
    const filterInputs = Array.from(document.querySelectorAll('#searchFiltersPanel input[type="checkbox"]'));
    let lastSearchUiStateSignature = '';

    if (!searchWrap || !searchForm || !searchInput || !searchTriggerBtn || !activeFilterBadge || !panel || !applyFiltersBtn || !clearFiltersBtn) return;

    const createSearchUiStateSnapshot = () => ({
        query: searchInput.value,
        filters: {
            make: Array.from(searchFilterState.make),
            engine: Array.from(searchFilterState.engine),
            body: Array.from(searchFilterState.body)
        }
    });

    const getSearchUiStateSignature = snapshot => JSON.stringify(snapshot);

    const applySavedSearchUiState = savedState => {
        searchInput.value = savedState.query || '';

        filterInputs.forEach(input => {
            const group = input.dataset.filterGroup;
            const selectedValues = savedState.filters[group] || [];
            input.checked = selectedValues.includes(input.value);
        });
    };

    const persistSearchUiState = () => {
        if (typeof window.setAuctionSearchUiState !== 'function') return;

        const snapshot = createSearchUiStateSnapshot();
        lastSearchUiStateSignature = getSearchUiStateSignature(snapshot);
        window.setAuctionSearchUiState(snapshot);
    };

    const openPanel = () => {
        panel.hidden = false;
    };

    const closePanel = () => {
        panel.hidden = true;
    };

    const collectFilters = () => {
        searchFilterState = {
            make: new Set(),
            engine: new Set(),
            body: new Set()
        };

        filterInputs.forEach(input => {
            if (!input.checked) return;
            const group = input.dataset.filterGroup;
            if (searchFilterState[group]) {
                searchFilterState[group].add(input.value);
            }
        });

        updateFilterBadge();
        persistSearchUiState();
    };

    const updateFilterBadge = () => {
        const activeFilterCount =
            searchFilterState.make.size +
            searchFilterState.engine.size +
            searchFilterState.body.size;

        activeFilterBadge.textContent = String(activeFilterCount);
        activeFilterBadge.hidden = activeFilterCount === 0;
    };

    const runSearch = () => {
        collectFilters();
        const query = searchInput.value.trim().toLowerCase();
        applyAuctionSearch(query, searchFilterState);
    };

    const restoreSearchUiState = () => {
        if (typeof window.getAuctionSearchUiState !== 'function') {
            collectFilters();
            applyAuctionSearch(searchInput.value.trim().toLowerCase(), searchFilterState);
            return;
        }

        const savedState = window.getAuctionSearchUiState();
        const savedStateSignature = getSearchUiStateSignature(savedState);
        if (savedStateSignature === lastSearchUiStateSignature) {
            return;
        }

        applySavedSearchUiState(savedState);

        collectFilters();
        applyAuctionSearch(searchInput.value.trim().toLowerCase(), searchFilterState);
        lastSearchUiStateSignature = savedStateSignature;
    };

    searchInput.addEventListener('focus', openPanel);
    searchInput.addEventListener('click', openPanel);
    searchInput.addEventListener('input', persistSearchUiState);

    searchTriggerBtn.addEventListener('click', function() {
        if (panel.hidden) {
            openPanel();
            return;
        }
        runSearch();
        closePanel();
    });

    searchForm.addEventListener('submit', function(event) {
        event.preventDefault();
        runSearch();
        closePanel();
    });

    applyFiltersBtn.addEventListener('click', function() {
        runSearch();
        closePanel();
    });

    clearFiltersBtn.addEventListener('click', function() {
        filterInputs.forEach(input => {
            input.checked = false;
        });
        runSearch();
    });

    filterInputs.forEach(input => {
        input.addEventListener('change', collectFilters);
    });

    document.addEventListener('click', function(event) {
        if (!searchWrap.contains(event.target)) {
            closePanel();
        }
    });

    window.addEventListener('storage', function(event) {
        if (event.key !== 'auctionSearchUiState') return;
        restoreSearchUiState();
    });

    window.addEventListener('focus', function() {
        restoreSearchUiState();
    });

    restoreSearchUiState();
}

function applyAuctionSearch(query, filters = searchFilterState) {
    const makeMap = {
        ford: ['ford'],
        chevrolet: ['chevrolet'],
        cadillac: ['cadillac'],
        porsche: ['porsche', 'prosche'],
        jaguar: ['jaguar'],
        mercury: ['mercury']
    };

    const engineMap = {
        v8: ['v8'],
        'inline-6': ['inline-6', 'inline 6']
    };

    const bodyMap = {
        convertible: ['convertible'],
        coupe: ['coupe'],
        hardtop: ['hardtop'],
        wagon: ['wagon']
    };

    const hasGroupSelection = groupSet => groupSet && groupSet.size > 0;

    const matchesMappedGroup = (searchText, selectedSet, map) => {
        if (!hasGroupSelection(selectedSet)) return true;

        return Array.from(selectedSet).some(selected => {
            const aliases = map[selected] || [selected];
            return aliases.some(alias => searchText.includes(alias));
        });
    };

    const itemMatchesFilters = item => {
        const combinedText = item.dataset.searchText || '';

        const matchesText =
            query.length === 0 ||
            combinedText.includes(query);

        const matchesMake = matchesMappedGroup(combinedText, filters.make, makeMap);
        const matchesEngine = matchesMappedGroup(combinedText, filters.engine, engineMap);
        const matchesBody = matchesMappedGroup(combinedText, filters.body, bodyMap);

        return matchesText && matchesMake && matchesEngine && matchesBody;
    };

    filteredActiveAuctionItems = allActiveAuctionItems.filter(itemMatchesFilters);
    filteredMarketplaceItems = allMarketplaceItems.filter(itemMatchesFilters);
    filteredSoldItems = allSoldItems.filter(itemMatchesFilters);
    filteredAuctionItems = filteredActiveAuctionItems.concat(filteredMarketplaceItems, filteredSoldItems);

    currentPage = 1;
    updatePagination();
}
function switchView(viewType) {
    const activeContainer = document.getElementById('auctionsContainer');
    const marketplaceContainer = document.getElementById('marketplaceContainer');
    const soldContainer = document.getElementById('soldContainer');
    const tileBtns = document.querySelectorAll('.tile-btn');
    const listBtns = document.querySelectorAll('.list-btn');

    if (!activeContainer || !marketplaceContainer || !soldContainer || tileBtns.length === 0 || listBtns.length === 0) return;

    currentView = viewType;
    currentPage = 1;

    // Update button states for all buttons
    if (viewType === 'tile') {
        activeContainer.classList.remove('list-view');
        activeContainer.classList.add('tile-view');
        marketplaceContainer.classList.remove('list-view');
        marketplaceContainer.classList.add('tile-view');
        soldContainer.classList.remove('list-view');
        soldContainer.classList.add('tile-view');
        tileBtns.forEach(btn => btn.classList.add('active'));
        listBtns.forEach(btn => btn.classList.remove('active'));
    } else {
        activeContainer.classList.remove('tile-view');
        activeContainer.classList.add('list-view');
        marketplaceContainer.classList.remove('tile-view');
        marketplaceContainer.classList.add('list-view');
        soldContainer.classList.remove('tile-view');
        soldContainer.classList.add('list-view');
        listBtns.forEach(btn => btn.classList.add('active'));
        tileBtns.forEach(btn => btn.classList.remove('active'));
    }

    // Update pagination and display
    updatePagination();
}

function updatePagination() {
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const visibleItems = filteredActiveAuctionItems;
    const visibleIndexes = new Map();
    const totalPages = Math.max(1, Math.ceil(visibleItems.length / itemsPerPage));
    const emptyState = document.getElementById('searchEmptyState');
    const marketplaceEmptyState = document.getElementById('marketplaceEmptyState');
    const soldEmptyState = document.getElementById('soldEmptyState');
    const marketplaceVisibleSet = new Set(filteredMarketplaceItems);
    const soldVisibleSet = new Set(filteredSoldItems);

    visibleItems.forEach((item, index) => {
        visibleIndexes.set(item, index);
    });

    // Show/hide active auction items based on page
    allActiveAuctionItems.forEach((item) => {
        const filteredIndex = visibleIndexes.get(item);

        if (filteredIndex === undefined) {
            item.hidden = true;
            return;
        }

        if (filteredIndex >= startIdx && filteredIndex < endIdx) {
            item.hidden = false;
        } else {
            item.hidden = true;
        }
    });

    // Marketplace section does not paginate, but still respects search filters.
    allMarketplaceItems.forEach((item) => {
        item.hidden = !marketplaceVisibleSet.has(item);
    });

    allSoldItems.forEach((item) => {
        item.hidden = !soldVisibleSet.has(item);
    });

    if (visibleItems.length === 0) {
        document.getElementById('pageInfo').textContent = 'No active bidding';
        if (emptyState) emptyState.hidden = false;
    } else {
        document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
        if (emptyState) emptyState.hidden = true;
    }

    if (marketplaceEmptyState) {
        marketplaceEmptyState.hidden = currentDashboardMode === 'sold' || currentMarketTab !== 'marketplace' || filteredMarketplaceItems.length > 0;
    }

    if (soldEmptyState) {
        soldEmptyState.hidden = currentDashboardMode !== 'sold' || filteredSoldItems.length > 0;
    }

    // Enable/disable pagination buttons
    document.getElementById('prevBtn').disabled = currentDashboardMode === 'sold' || currentPage === 1 || visibleItems.length === 0;
    document.getElementById('nextBtn').disabled = currentDashboardMode === 'sold' || currentPage === totalPages || visibleItems.length === 0;

    syncDashboardModeUi();
    persistDashboardUiState();
}

function nextPage() {
    const totalPages = Math.max(1, Math.ceil(filteredActiveAuctionItems.length / itemsPerPage));
    if (currentPage < totalPages) {
        currentPage++;
        updatePagination();
    }
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        updatePagination();
    }
}
