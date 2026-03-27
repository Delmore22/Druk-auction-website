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
const itemsPerPage = 8;
const DASHBOARD_UI_STATE_KEY = 'dashboardUiState';
let allCars = [];
let allAuctionItems = [];
let filteredAuctionItems = [];
let searchFilterState = {
    make: new Set(),
    engine: new Set(),
    body: new Set()
};

function normalizeDashboardUiState(rawState) {
    const source = rawState || {};
    return {
        view: source.view === 'list' ? 'list' : 'tile',
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
    const totalPages = Math.max(1, Math.ceil(filteredAuctionItems.length / itemsPerPage));

    switchView(savedState.view);
    currentPage = Math.min(savedState.page, totalPages);
    updatePagination();

    if (mainContent && savedState.scrollTop > 0) {
        requestAnimationFrame(function () {
            mainContent.scrollTop = savedState.scrollTop;
            lastScrollTop = savedState.scrollTop;
        });
    }
}

function normalizeStatus(rawStatus) {
    const normalized = String(rawStatus || 'Sale').trim().toLowerCase();
    if (normalized === 'sold') return { label: 'Sold', className: 'status-sold' };
    if (normalized === 'appending' || normalized === 'reserve') return { label: 'Reserve', className: 'status-appending' };
    return { label: 'Sale', className: 'status-sale' };
}

function getAuctionCardSummary(car) {
    const parts = [car.engine, car.transmission, car.condition].filter(Boolean);
    return parts.join(' • ');
}

function renderMarketplaceCards(cars) {
    const container = document.getElementById('auctionsContainer');
    if (!container) return;

    container.textContent = '';
    const fragment = document.createDocumentFragment();
    const auctionItems = [];

    cars.forEach(car => {
        const title = `${car.year} ${car.make} ${car.model}`;
        const status = normalizeStatus(car.status);
        const summary = getAuctionCardSummary(car);
        const bid = Number.isFinite(car.currentBid) ? car.currentBid.toLocaleString('en-US') : '0';

        const item = document.createElement('a');
        item.className = 'auction-item';
        item.setAttribute('data-car-name', car.id);
        item.dataset.searchText = `${title} ${summary} ${car.id}`.toLowerCase();
        item.href = `car-details.html?car=${encodeURIComponent(car.id)}`;
        item.target = '_blank';
        // Internal same-origin navigation intentionally keeps opener so the
        // detail tab can focus and close back to the dashboard tab.
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

        const details = document.createElement('div');
        details.className = 'auction-details';

        const heading = document.createElement('h4');
        heading.textContent = title;

        const description = document.createElement('p');
        description.textContent = summary;

        details.appendChild(heading);
        details.appendChild(description);

        const saleTag = document.createElement('div');
        saleTag.className = 'sale-tag';

        const saleLabel = document.createElement('span');
        saleLabel.className = `sale-label ${status.className}`;
        saleLabel.textContent = status.label;

        const salePrice = document.createElement('span');
        salePrice.className = 'sale-price';
        salePrice.textContent = `$${bid}`;

        saleTag.appendChild(saleLabel);
        saleTag.appendChild(salePrice);

        item.appendChild(photo);
        item.appendChild(details);
        item.appendChild(saleTag);

        fragment.appendChild(item);
        auctionItems.push(item);
    });

    container.appendChild(fragment);
    allAuctionItems = auctionItems;
    filteredAuctionItems = [...allAuctionItems];
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
                renderMarketplaceCards([]);
                return [];
            }

            allCars = data.cars;
            renderMarketplaceCards(allCars);
            return allCars;
        })
        .catch(() => {
            allCars = [];
            renderMarketplaceCards([]);
            return [];
        });
}

function bindDashboardControls() {
    const tileBtn = document.querySelector('.tile-btn');
    const listBtn = document.querySelector('.list-btn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (tileBtn && !tileBtn.dataset.bound) {
        tileBtn.dataset.bound = '1';
        tileBtn.addEventListener('click', function () {
            switchView('tile');
        });
    }

    if (listBtn && !listBtn.dataset.bound) {
        listBtn.dataset.bound = '1';
        listBtn.addEventListener('click', function () {
            switchView('list');
        });
    }

    if (prevBtn && !prevBtn.dataset.bound) {
        prevBtn.dataset.bound = '1';
        prevBtn.addEventListener('click', previousPage);
    }

    if (nextBtn && !nextBtn.dataset.bound) {
        nextBtn.dataset.bound = '1';
        nextBtn.addEventListener('click', nextPage);
    }
}

function initializeAuctionView() {
    const container = document.getElementById('auctionsContainer');
    if (!container) return;

    bindDashboardControls();

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

    filteredAuctionItems = allAuctionItems.filter(item => {
        const combinedText = item.dataset.searchText || '';

        const matchesText =
            query.length === 0 ||
            combinedText.includes(query);

        const matchesMake = matchesMappedGroup(combinedText, filters.make, makeMap);
        const matchesEngine = matchesMappedGroup(combinedText, filters.engine, engineMap);
        const matchesBody = matchesMappedGroup(combinedText, filters.body, bodyMap);

        return matchesText && matchesMake && matchesEngine && matchesBody;
    });

    currentPage = 1;
    updatePagination();
}
function switchView(viewType) {
    const container = document.getElementById('auctionsContainer');
    const tileBtn = document.querySelector('.tile-btn');
    const listBtn = document.querySelector('.list-btn');

    currentView = viewType;
    currentPage = 1;

    // Update button states
    if (viewType === 'tile') {
        container.classList.remove('list-view');
        container.classList.add('tile-view');
        tileBtn.classList.add('active');
        listBtn.classList.remove('active');
    } else {
        container.classList.remove('tile-view');
        container.classList.add('list-view');
        listBtn.classList.add('active');
        tileBtn.classList.remove('active');
    }

    // Update pagination and display
    updatePagination();
}

function updatePagination() {
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const visibleItems = filteredAuctionItems;
    const visibleIndexes = new Map();
    const totalPages = Math.max(1, Math.ceil(visibleItems.length / itemsPerPage));
    const emptyState = document.getElementById('searchEmptyState');

    visibleItems.forEach((item, index) => {
        visibleIndexes.set(item, index);
    });

    // Show/hide items based on active search and page
    allAuctionItems.forEach((item) => {
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

    if (visibleItems.length === 0) {
        document.getElementById('pageInfo').textContent = 'No results';
        if (emptyState) emptyState.hidden = false;
    } else {
        document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
        if (emptyState) emptyState.hidden = true;
    }

    // Enable/disable pagination buttons
    document.getElementById('prevBtn').disabled = currentPage === 1 || visibleItems.length === 0;
    document.getElementById('nextBtn').disabled = currentPage === totalPages || visibleItems.length === 0;

    persistDashboardUiState();
}

function nextPage() {
    const totalPages = Math.max(1, Math.ceil(filteredAuctionItems.length / itemsPerPage));
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
