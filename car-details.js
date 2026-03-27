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
    var filterInputs = Array.prototype.slice.call(document.querySelectorAll('#searchFiltersPanel input[type="checkbox"]'));

    if (triggerBtn && filtersPanel) {
        function syncSearchUiState() {
            if (typeof window.setAuctionSearchUiState !== 'function') return;

            var savedFilters = {
                make: [],
                engine: [],
                body: []
            };

            filterInputs.forEach(function (input) {
                if (!input.checked) return;
                if (savedFilters[input.dataset.filterGroup]) {
                    savedFilters[input.dataset.filterGroup].push(input.value);
                }
            });

            window.setAuctionSearchUiState({
                query: searchInput ? searchInput.value : '',
                filters: savedFilters
            });
        }

        function updateFilterBadge() {
            if (!filterBadge) return;

            var checkedCount = filtersPanel.querySelectorAll('input[type="checkbox"]:checked').length;
            filterBadge.textContent = String(checkedCount);
            filterBadge.hidden = checkedCount === 0;
        }

        function restoreSearchUiState() {
            if (typeof window.getAuctionSearchUiState !== 'function') {
                updateFilterBadge();
                return;
            }

            var savedState = window.getAuctionSearchUiState();

            if (searchInput) {
                searchInput.value = savedState.query || '';
            }

            filterInputs.forEach(function (input) {
                var selectedValues = savedState.filters[input.dataset.filterGroup] || [];
                input.checked = selectedValues.indexOf(input.value) !== -1;
            });

            updateFilterBadge();
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
                filtersPanel.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
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
    var currentLightboxIndex = 0;
    var lightboxSrcs = [];

    ensureCarPhotoLightbox();

    function navigate(direction) {
        if (!lightboxSrcs.length) return;
        currentLightboxIndex = (currentLightboxIndex + direction + lightboxSrcs.length) % lightboxSrcs.length;
        openCarPhotoLightbox(lightboxSrcs[currentLightboxIndex].src, lightboxSrcs[currentLightboxIndex].alt);
    }

    document.addEventListener('click', function (event) {
        var target = event.target;
        if (!target) return;

        if (target.matches('.car-photo-grid img')) {
            var allImgs = Array.prototype.slice.call(document.querySelectorAll('.car-photo-grid img'));
            lightboxSrcs = allImgs.map(function (img) { return { src: img.src, alt: img.alt || 'Vehicle photo' }; });
            currentLightboxIndex = allImgs.indexOf(target);
            openCarPhotoLightbox(lightboxSrcs[currentLightboxIndex].src, lightboxSrcs[currentLightboxIndex].alt);
            return;
        }

        if (target.matches('.car-photo-lightbox') || target.matches('.car-photo-lightbox-close')) {
            closeCarPhotoLightbox();
            return;
        }

        if (target.matches('.car-photo-lightbox-prev')) { navigate(-1); return; }
        if (target.matches('.car-photo-lightbox-next')) { navigate(1); return; }
    });

    document.addEventListener('keydown', function (event) {
        var lb = document.getElementById('carPhotoLightbox');
        if (!lb || !lb.classList.contains('is-open')) return;
        if (event.key === 'Escape') { closeCarPhotoLightbox(); return; }
        if (event.key === 'ArrowLeft') { navigate(-1); return; }
        if (event.key === 'ArrowRight') { navigate(1); return; }
    });
}

function ensureCarPhotoLightbox() {
    if (document.getElementById('carPhotoLightbox')) return;

    var overlay = document.createElement('div');
    overlay.id = 'carPhotoLightbox';
    overlay.className = 'car-photo-lightbox';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
        '<button type="button" class="car-photo-lightbox-close" aria-label="Close photo viewer">&times;</button>' +
        '<button type="button" class="car-photo-lightbox-prev" aria-label="Previous photo">&#8249;</button>' +
        '<div class="car-photo-lightbox-content">' +
            '<img id="carPhotoLightboxImage" src="" alt="Expanded vehicle photo">' +
        '</div>' +
        '<button type="button" class="car-photo-lightbox-next" aria-label="Next photo">&#8250;</button>';

    document.body.appendChild(overlay);
}

function openCarPhotoLightbox(src, altText) {
    var lightbox = document.getElementById('carPhotoLightbox');
    var lightboxImage = document.getElementById('carPhotoLightboxImage');
    if (!lightbox || !lightboxImage) return;

    lightboxImage.src = src;
    lightboxImage.alt = altText || 'Expanded vehicle photo';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
}

function closeCarPhotoLightbox() {
    var lightbox = document.getElementById('carPhotoLightbox');
    var lightboxImage = document.getElementById('carPhotoLightboxImage');
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
        showCarError('No vehicle selected. <a href="car-dashboard.html">Browse auctions &rarr;</a>');
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
                showCarError('Vehicle not found. <a href="car-dashboard.html">Browse auctions &rarr;</a>');
                return;
            }
            renderCarDetail(car);
            document.title = car.year + ' ' + car.make + ' ' + car.model + ' — Druk Classic Bid';
        })
        .catch(function () {
            showCarError('Could not load vehicle data. Please try again.');
        });
}

function showCarError(msg) {
    var section = document.getElementById('carDetailSection');
    if (section) section.innerHTML = '<p class="car-detail-error">' + msg + '</p>';
}

function normalizeCarStatus(rawStatus) {
    var normalized = String(rawStatus || 'Sale').trim().toLowerCase();
    if (normalized === 'sold') return 'sold';
    if (normalized === 'appending' || normalized === 'reserve') return 'appending';
    return 'sale';
}

function buildAuctionPanelHtml(car) {
    var status = normalizeCarStatus(car.status);
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

    var actionsHtml;
    if (status === 'sold') {
        actionsHtml =
            '<div class="ap-sold-notice">' +
                '<i class="fas fa-check-circle"></i> Sold for $' + car.currentBid.toLocaleString() +
            '</div>';
    } else {
        var bidBtns = '';
        if (status === 'sale') {
            var buyNow = car.buyNowPrice ? car.buyNowPrice : Math.round(car.currentBid * 1.1);
            bidBtns += '<button type="button" class="ap-btn ap-btn-buynow">BUY NOW $' + buyNow.toLocaleString() + '</button>';
        }
        bidBtns +=
            '<button type="button" class="ap-btn ap-btn-bid">BID $' + car.currentBid.toLocaleString() + '</button>' +
            '<button type="button" class="ap-btn ap-btn-offer">MAKE OFFER</button>';
        actionsHtml = bidBtns;
    }

    var footerHtml = status !== 'sold'
        ? '<div class="ap-footer">' +
              '<span class="ap-floor-note"><i class="fas fa-check-circle"></i> Starting Bid&nbsp;=&nbsp;Floor</span>' +
              '<a href="#" class="ap-fees-link">View Fees</a>' +
          '</div>'
        : '';

    var timeLeft = status === 'sold' ? '&mdash;' : 'Ends in ' + car.timeRemaining;

    return (
        '<div class="auction-panel">' +
            '<div class="ap-header">' +
                '<span class="ap-sale-type">Timed Sale&nbsp;<i class="fas fa-info-circle ap-info-icon" title="Timed auction \u2014 highest valid bid wins when the timer expires"></i></span>' +
            '</div>' +
            '<div class="ap-info-grid">' +
                '<span class="ap-label">Status</span>' +
                '<span class="ap-value"><span class="ap-status-badge ' + statusClass + '">' + statusLabel + '</span></span>' +
                '<span class="ap-label">Time Left</span>' +
                '<span class="ap-value ap-time-value">' + timeLeft + '</span>' +
                '<span class="ap-label">Current Bid</span>' +
                '<span class="ap-value ap-current-bid">$' + car.currentBid.toLocaleString() + '</span>' +
                '<span class="ap-label">Pickup</span>' +
                '<span class="ap-value">' + (car.pickup || '&mdash;') + '</span>' +
                '<span class="ap-label">Location</span>' +
                '<span class="ap-value">' + (car.location || '&mdash;') + '</span>' +
                '<span class="ap-label">Seller</span>' +
                '<span class="ap-value ap-seller-name">' + (car.seller || '&mdash;') + '</span>' +
            '</div>' +
            '<div class="ap-actions">' +
                actionsHtml +
            '</div>' +
            footerHtml +
            '<div class="ap-zip-section">' +
                '<span class="ap-zip-label">Estimate Transport Cost</span>' +
                '<div class="ap-zip-row">' +
                    '<input type="text" class="ap-zip-input" placeholder="ZIP code" maxlength="5" aria-label="ZIP code for transport estimate">' +
                    '<button type="button" class="ap-zip-btn">GO</button>' +
                '</div>' +
            '</div>' +
            '<div class="ap-history-section">' +
                '<h4 class="ap-history-title">Vehicle History</h4>' +
                '<div class="ap-history-grid">' +
                    '<div class="ap-history-col"><span class="ap-history-label">Owners</span><span class="ap-history-val">&mdash;</span></div>' +
                    '<div class="ap-history-col"><span class="ap-history-label">AC&amp;INT</span><span class="ap-history-val">&mdash;</span></div>' +
                    '<div class="ap-history-col"><span class="ap-history-label">Titles/Probs</span><span class="ap-history-val">&mdash;</span></div>' +
                    '<div class="ap-history-col"><span class="ap-history-label">ODO</span><span class="ap-history-val">&mdash;</span></div>' +
                    '<a href="#" class="ap-carfax-btn" target="_blank" rel="noopener noreferrer" aria-label="View CARFAX vehicle history report"><i class="fas fa-car"></i>&nbsp;CARFAX</a>' +
                '</div>' +
            '</div>' +
        '</div>'
    );
}

function renderCarDetail(car) {
    var section = document.getElementById('carDetailSection');
    if (!section) return;
    var photoGalleryHtml = '';

    if (car.id === '1967-ford-mustang-fastback') {
        photoGalleryHtml =
            '<div class="car-photo-gallery">' +
                '<div class="car-photo-grid">' +
                    '<img src="cars-photos/1967-ford-mustang-fastback-02.png" alt="1967 Ford Mustang Fastback photo 2" loading="lazy">' +
                    '<img src="cars-photos/1967-ford-mustang-fastback-03.png" alt="1967 Ford Mustang Fastback photo 3" loading="lazy">' +
                    '<img src="cars-photos/1967-ford-mustang-fastback-04.png" alt="1967 Ford Mustang Fastback photo 4" loading="lazy">' +
                    '<img src="cars-photos/1967-ford-mustang-fastback-05.png" alt="1967 Ford Mustang Fastback photo 5" loading="lazy">' +
                    '<img src="cars-photos/1967-ford-mustang-fastback-06.png" alt="1967 Ford Mustang Fastback photo 6" loading="lazy">' +
                    '<img src="cars-photos/1967-ford-mustang-fastback-07.png" alt="1967 Ford Mustang Fastback photo 7" loading="lazy">' +
                    '<img src="cars-photos/1967-ford-mustang-fastback-08.png" alt="1967 Ford Mustang Fastback photo 8" loading="lazy">' +
                    '<img src="cars-photos/1967-ford-mustang-fastback-09.png" alt="1967 Ford Mustang Fastback photo 9" loading="lazy">' +
                '</div>' +
            '</div>';
    }

    section.innerHTML =
        '<h2>' + car.year + ' ' + car.make + ' ' + car.model + '</h2>' +
        '<div class="car-detail-layout">' +
            '<div class="car-detail-main">' +
                '<div class="car-info">' +
                    '<img src="' + car.photo + '" alt="' + car.year + ' ' + car.make + ' ' + car.model + '">' +
                    '<div class="car-description">' +
                        '<h3>' + car.year + ' ' + car.make + ' ' + car.model + '</h3>' +
                        '<p><strong>Engine:</strong> ' + car.engine + '</p>' +
                        '<p><strong>Transmission:</strong> ' + car.transmission + '</p>' +
                        '<p><strong>Body Style:</strong> ' + car.bodyStyle + '</p>' +
                        '<p><strong>Mileage:</strong> ' + car.mileage + ' miles</p>' +
                        '<p><strong>Condition:</strong> ' + car.condition + '</p>' +
                        '<p class="car-description-text">' + car.description + '</p>' +
                    '</div>' +
                '</div>' +
                photoGalleryHtml +
            '</div>' +
            '<div class="car-detail-panel">' +
                buildAuctionPanelHtml(car) +
            '</div>' +
        '</div>';
}
