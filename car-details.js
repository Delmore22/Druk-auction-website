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
        var openerWindow = window.opener;

        if (openerWindow && !openerWindow.closed) {
            try {
                openerWindow.focus();
                window.close();

                window.setTimeout(function () {
                    if (!window.closed) {
                        window.location.href = fallbackUrl;
                    }
                }, 150);
                return;
            } catch (err) {
                window.location.href = fallbackUrl;
                return;
            }
        }

        if (document.referrer && document.referrer.indexOf('car-dashboard.html') !== -1) {
            window.history.back();
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

function buildBidSectionHtml(car, minBid) {
    var status = normalizeCarStatus(car.status);

    if (status === 'sold') {
        return (
            '<div class="bid-section bid-section-sold">' +
                '<h3 class="bid-status-pill bid-status-pill-sold">Sold</h3>' +
                '<p class="current-bid">Sold At: $' + car.currentBid.toLocaleString() + '</p>' +
            '</div>'
        );
    }

    var sectionTitle = status === 'appending' ? 'Make Offer' : 'Bid Now';
    var buttonLabel = status === 'appending' ? 'Submit Offer' : 'Place Bid';
    var amountLabel = status === 'appending' ? 'Your Offer ($):' : 'Your Bid ($):';
    var statusClass = status === 'appending' ? 'bid-section-reserve' : 'bid-section-sale';
    var statusPillClass = status === 'appending' ? 'bid-status-pill-reserve' : 'bid-status-pill-sale';

    return (
        '<div class="bid-section ' + statusClass + '">' +
            '<h3 class="bid-status-pill ' + statusPillClass + '">' + sectionTitle + '</h3>' +
            '<p class="current-bid">Current Bid: $' + car.currentBid.toLocaleString() + '</p>' +
            '<p class="auction-time-remaining"><i class="fas fa-clock"></i> Time Remaining: ' + car.timeRemaining + '</p>' +
            '<form action="#" method="post">' +
                '<label for="bid-amount">' + amountLabel + '</label>' +
                '<input type="number" id="bid-amount" name="bid-amount" min="' + minBid + '" step="100" required>' +
                '<button type="submit">' + buttonLabel + '</button>' +
            '</form>' +
        '</div>'
    );
}

function renderCarDetail(car) {
    var section = document.getElementById('carDetailSection');
    if (!section) return;
    var minBid = car.currentBid + 100;
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
        buildBidSectionHtml(car, minBid);
}
