let lastScrollTop = 0;
const mainContent = document.getElementById('mainContent');
const stickyHeader = document.getElementById('stickyHeader');

// Scroll detection for hiding/showing header
mainContent.addEventListener('scroll', function() {
    const scrollTop = mainContent.scrollTop;

    if (scrollTop > lastScrollTop && scrollTop > 100) {
        // Scrolling down
        stickyHeader.classList.remove('visible');
    } else {
        // Scrolling up
        stickyHeader.classList.add('visible');
    }

    lastScrollTop = scrollTop;
});

// Initialize as visible
stickyHeader.classList.add('visible');

// Update countdown timers
function updateTimers() {
    const timers = document.querySelectorAll('.auction-time');
    timers.forEach(timer => {
        if (timer.textContent.includes(':')) {
            let time = timer.textContent.split(':');
            let hours = parseInt(time[0]);
            let minutes = parseInt(time[1]);
            let seconds = parseInt(time[2]);

            seconds--;
            if (seconds < 0) {
                seconds = 59;
                minutes--;
            }
            if (minutes < 0) {
                minutes = 59;
                hours--;
            }
            if (hours < 0) hours = 0;

            timer.textContent =
                String(hours).padStart(2, '0') + ':' +
                String(minutes).padStart(2, '0') + ':' +
                String(seconds).padStart(2, '0');
        }
    });
}

setInterval(updateTimers, 1000);

// Add click handlers
document.querySelectorAll('.auction-item').forEach(item => {
    item.addEventListener('click', function(e) {
        const href = this.getAttribute('href') || this.dataset.href;
        const target = this.getAttribute('target');
        if (href) {
            e.preventDefault();
            if (target) {
                window.open(href, target);
            } else {
                window.location.href = href;
            }
            return;
        }
        alert('Opening auction details...');
    });
});

document.querySelectorAll('.quick-action').forEach(action => {
    action.addEventListener('click', function() {
        const actionName = this.querySelector('h4').textContent;
        alert(`Opening: ${actionName}`);
    });
});

document.addEventListener('components:ready', function() {
    // Find the banner and the main content container (fallbacks included)
    setTimeout(function() {
        var banner = document.querySelector('.welcome-banner');
        var content = document.getElementById('mainContent') || document.querySelector('.main-content');

        if (!banner) return;

        // Ensure banner is visible so the fade animation can be seen
        banner.style.display = '';
        banner.style.opacity = '1';

        // Trigger fade out animation after a delay
        setTimeout(function() {
            banner.classList.add('fade-out');
            setTimeout(function() {
                if (banner.parentNode) banner.parentNode.removeChild(banner);
                if (content) content.style.marginTop = '0';
            }, 3000); // keep in sync with animation duration
        }, 5000);
    }, 2000);

    // Add fade-out animation keyframes (keeps opacity animation only)
    var style = document.createElement('style');
    style.innerHTML = `
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }

        .welcome-banner.fade-out {
            animation: fadeOut 3s forwards;
        }
    `;
    document.head.appendChild(style);

    // Initialize auction view system
    initializeAuctionView();
});

// Auction View Management
let currentView = 'tile';
let currentPage = 1;
const itemsPerPage = 8;
let allAuctionItems = [];
let filteredAuctionItems = [];
let searchFilterState = {
    make: new Set(),
    engine: new Set(),
    body: new Set()
};

function initializeAuctionView() {
    // Get all auction items
    const container = document.getElementById('auctionsContainer');
    allAuctionItems = Array.from(container.querySelectorAll('.auction-item'));
    filteredAuctionItems = [...allAuctionItems];

    // Apply card backgrounds and list thumbnails from /cars-photos
    loadAuctionPhotos();

    initializeAuctionSearch();

    // Initialize with tile view
    switchView('tile');
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

    if (!searchWrap || !searchForm || !searchInput || !searchTriggerBtn || !activeFilterBadge || !panel || !applyFiltersBtn || !clearFiltersBtn) return;

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

    searchInput.addEventListener('focus', openPanel);
    searchInput.addEventListener('click', openPanel);

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

    collectFilters();
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
        const name = item.querySelector('h4')?.textContent.toLowerCase() || '';
        const details = item.querySelector('p')?.textContent.toLowerCase() || '';
        const slug = (item.getAttribute('data-car-name') || '').toLowerCase();
        const combinedText = `${name} ${details} ${slug}`;

        const matchesText =
            query.length === 0 ||
            name.includes(query) ||
            details.includes(query) ||
            slug.includes(query);

        const matchesMake = matchesMappedGroup(combinedText, filters.make, makeMap);
        const matchesEngine = matchesMappedGroup(combinedText, filters.engine, engineMap);
        const matchesBody = matchesMappedGroup(combinedText, filters.body, bodyMap);

        return matchesText && matchesMake && matchesEngine && matchesBody;
    });

    currentPage = 1;
    updatePagination();
}

function loadAuctionPhotos() {
    allAuctionItems.forEach((item) => {
        const carName = item.getAttribute('data-car-name');
        if (!carName) return;

        const imagePath = `cars-photos/${carName}.png`;
        const photoNode = item.querySelector('.auction-photo');

        // Set both tile and list image sources via CSS variable.
        item.style.setProperty('--auction-image', `url('${imagePath}')`);
        if (photoNode) {
            photoNode.style.backgroundImage = `url('${imagePath}')`;
        }
    });
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
    const totalPages = Math.max(1, Math.ceil(visibleItems.length / itemsPerPage));
    const emptyState = document.getElementById('searchEmptyState');

    // Show/hide items based on active search and page
    allAuctionItems.forEach((item, idx) => {
        if (!visibleItems.includes(item)) {
            item.style.display = 'none';
            return;
        }

        const filteredIndex = visibleItems.indexOf(item);
        if (filteredIndex >= startIdx && filteredIndex < endIdx) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
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
