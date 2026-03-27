var currentLightboxIndex = 0;
var lightboxSrcs = [];
var lightboxElements = {
    overlay: null,
    image: null
};

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

        var galleryImage = target.closest('.car-photo-grid img');
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

function initBackToAuctions() {
    var backButton = document.querySelector('.back-button');
    if (!backButton) return;

    backButton.addEventListener('click', function () {
        var fallbackUrl = 'car-dashboard.html';
        var referrer = document.referrer || '';
        var referrerIsDashboard = false;

        if (referrer) {
            try {
                var refUrl = new URL(referrer, window.location.href);
                referrerIsDashboard =
                    refUrl.origin === window.location.origin &&
                    /\/car-dashboard\.html$/i.test(refUrl.pathname);
            } catch (err) {
                referrerIsDashboard = false;
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

        if (referrerIsDashboard && window.history.length > 1) {
            window.history.back();
            return;
        }

        if (referrerIsDashboard) {
            window.location.href = referrer;
            return;
        }

        window.location.href = fallbackUrl;
    });
}

function loadCarDetails() {
    var params = new URLSearchParams(window.location.search);
    var carId = params.get('car');
    if (!carId) {
        showCarError('No vehicle selected.', 'car-dashboard.html', 'Browse auctions ->');
        return;
    }
    fetch('data/cars.json')
        .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function (data) {
            var car = data.cars.find(function (c) { return c.id === carId; });
            if (!car) {
                showCarError('Vehicle not found.', 'car-dashboard.html', 'Browse auctions ->');
                return;
            }
            renderCarDetail(car);
            document.title = car.year + ' ' + car.make + ' ' + car.model + ' — Druk Classic Bid';
        })
        .catch(function () {
            showCarError('Could not load vehicle data. Please try again.');
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

function normalizeCarStatus(rawStatus) {
    var normalized = String(rawStatus || 'Sale').trim().toLowerCase();
    if (normalized === 'sold') return 'sold';
    if (normalized === 'appending' || normalized === 'reserve') return 'appending';
    return 'sale';
}

function buildAuctionPanelElement(car) {
    var status = normalizeCarStatus(car.status);
    var safeBid = Number.isFinite(car.currentBid) ? car.currentBid : 0;
    var safePickup = car.pickup || '\u2014';
    var safeLocation = car.location || '\u2014';
    var safeSeller = car.seller || '\u2014';
    var safeTimeRemaining = car.timeRemaining || '\u2014';
    var statusLabel, statusClass;

    if (status === 'sold') {
        statusLabel = 'Sold';
        statusClass = 'ap-status-sold';
    } else if (status === 'appending') {
        statusLabel = 'Reserve Not Met';
        statusClass = 'ap-status-reserve';
    } else {
        statusLabel = 'On Sale';
        statusClass = 'ap-status-sale';
    }

    var panel = createElement('div', 'auction-panel');
    var header = createElement('div', 'ap-header');
    var saleType = createElement('span', 'ap-sale-type');
    var infoIcon = createIcon('fas fa-info-circle ap-info-icon');
    infoIcon.setAttribute('title', 'Timed auction - highest valid bid wins when the timer expires');
    saleType.appendChild(document.createTextNode('Timed Sale '));
    saleType.appendChild(infoIcon);
    header.appendChild(saleType);
    panel.appendChild(header);

    var infoGrid = createElement('div', 'ap-info-grid');
    var statusBadge = createElement('span', 'ap-status-badge ' + statusClass, statusLabel);
    appendInfoRow(infoGrid, 'Status', statusBadge);
    appendInfoRow(infoGrid, 'Time Left', status === 'sold' ? '\u2014' : 'Ends in ' + safeTimeRemaining, 'ap-time-value');
    appendInfoRow(infoGrid, 'Current Bid', '$' + safeBid.toLocaleString(), 'ap-current-bid');
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
        if (status === 'sale') {
            var buyNow = car.buyNowPrice ? car.buyNowPrice : Math.round(safeBid * 1.1);
            actions.appendChild(createElement('button', 'ap-btn ap-btn-buynow', 'BUY NOW $' + buyNow.toLocaleString()));
            actions.lastChild.type = 'button';
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

function createPhotoGallery(car) {
    lightboxSrcs = [];
    currentLightboxIndex = 0;

    if (car.id !== '1967-ford-mustang-fastback') {
        return null;
    }

    var gallery = createElement('div', 'car-photo-gallery');
    var grid = createElement('div', 'car-photo-grid');

    ['02', '03', '04', '05', '06', '07', '08', '09'].forEach(function (suffix, index) {
        var src = 'cars-photos/1967-ford-mustang-fastback-' + suffix + '.png';
        var alt = '1967 Ford Mustang Fastback photo ' + (index + 2);
        var image = document.createElement('img');
        image.src = src;
        image.alt = alt;
        image.loading = 'lazy';
        image.setAttribute('data-lightbox-index', String(index));
        grid.appendChild(image);

        lightboxSrcs.push({ src: src, alt: alt });
    });

    gallery.appendChild(grid);
    return gallery;
}

function renderCarDetail(car) {
    var section = document.getElementById('carDetailSection');
    if (!section) return;

    section.textContent = '';

    var titleText = [car.year, car.make, car.model].filter(Boolean).join(' ');
    section.appendChild(createElement('h2', null, titleText));

    var layout = createElement('div', 'car-detail-layout');
    var main = createElement('div', 'car-detail-main');
    var info = createElement('div', 'car-info');

    var heroImage = document.createElement('img');
    heroImage.src = car.photo || '';
    heroImage.alt = titleText;
    info.appendChild(heroImage);

    var description = createElement('div', 'car-description');
    description.appendChild(createElement('h3', null, titleText));
    appendLabeledParagraph(description, 'Engine', car.engine);
    appendLabeledParagraph(description, 'Transmission', car.transmission);
    appendLabeledParagraph(description, 'Body Style', car.bodyStyle);
    appendLabeledParagraph(description, 'Mileage', car.mileage, ' miles');
    appendLabeledParagraph(description, 'Condition', car.condition);
    description.appendChild(createElement('p', 'car-description-text', car.description || ''));

    info.appendChild(description);
    main.appendChild(info);

    var gallery = createPhotoGallery(car);
    if (gallery) {
        main.appendChild(gallery);
    }

    var panelWrapper = createElement('div', 'car-detail-panel');
    panelWrapper.appendChild(buildAuctionPanelElement(car));

    layout.appendChild(main);
    layout.appendChild(panelWrapper);
    section.appendChild(layout);
}
