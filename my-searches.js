(function () {
    'use strict';

    // ── Favorites section ──────────────────────────────────────────────────────

    var CARS_JSON = 'data/cars.json';

    function getFavoritedCars(allCars) {
        var ids = getFavorites(); // provided by components.js
        return ids
            .map(function (id) { return allCars.find(function (c) { return c.id === id; }); })
            .filter(Boolean);
    }

    function getPhotoSrc(car) {
        if (car.photos && car.photos.length) return car.photos[0];
        if (car.photo) return car.photo;
        return 'images/placeholder-car.png';
    }

    function getStatusLabel(car) {
        var s = (car.status || '').toLowerCase();
        if (s === 'sold') return { text: 'Sold', cls: 'fav-card-pill sold' };
        if (s === 'sale') return { text: 'Live', cls: 'fav-card-pill live' };
        if (s === 'upcoming') return { text: 'Upcoming', cls: 'fav-card-pill upcoming' };
        return { text: car.status || 'Listed', cls: 'fav-card-pill' };
    }

    function formatPrice(val) {
        if (!val && val !== 0) return null;
        return '$' + Number(val).toLocaleString('en-US');
    }

    function buildFavCard(car, onRemove) {
        var card = document.createElement('article');
        card.className = 'fav-card';
        card.setAttribute('data-fav-id', car.id);

        var imgWrap = document.createElement('a');
        imgWrap.className = 'fav-card-photo';
        imgWrap.href = 'car-details.html?car=' + encodeURIComponent(car.id);
        imgWrap.setAttribute('aria-label', [car.year, car.make, car.model].filter(Boolean).join(' '));

        var img = document.createElement('img');
        img.src = getPhotoSrc(car);
        img.alt = [car.year, car.make, car.model].filter(Boolean).join(' ');
        img.loading = 'lazy';
        imgWrap.appendChild(img);

        // Remove (heart) button
        var removeBtn = createFavoriteBtn(car.id); // from components.js — already is-favorited
        removeBtn.classList.add('fav-card-remove-btn');
        removeBtn.setAttribute('aria-label', 'Remove from favorites');
        removeBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            onRemove(car.id, card);
        });
        imgWrap.appendChild(removeBtn);

        card.appendChild(imgWrap);

        var body = document.createElement('div');
        body.className = 'fav-card-body';

        var titleLink = document.createElement('a');
        titleLink.className = 'fav-card-title';
        titleLink.href = 'car-details.html?car=' + encodeURIComponent(car.id);
        titleLink.textContent = [car.year, car.make, car.model].filter(Boolean).join(' ');
        body.appendChild(titleLink);

        var meta = document.createElement('p');
        meta.className = 'fav-card-meta';
        meta.textContent = [car.bodyStyle, car.transmission, car.engine].filter(Boolean).join(' · ');
        body.appendChild(meta);

        var footer = document.createElement('div');
        footer.className = 'fav-card-footer';

        var statusInfo = getStatusLabel(car);
        var pill = document.createElement('span');
        pill.className = statusInfo.cls;
        pill.textContent = statusInfo.text;
        footer.appendChild(pill);

        var price = formatPrice(car.currentBid || car.startingBid);
        if (price) {
            var priceEl = document.createElement('span');
            priceEl.className = 'fav-card-price';
            priceEl.textContent = price;
            footer.appendChild(priceEl);
        }

        body.appendChild(footer);
        card.appendChild(body);

        return card;
    }

    function buildEmptyState() {
        var wrap = document.createElement('div');
        wrap.className = 'fav-empty';
        wrap.innerHTML =
            '<i class="far fa-heart fav-empty-icon" aria-hidden="true"></i>' +
            '<p class="fav-empty-heading">No favorites yet</p>' +
            '<p class="fav-empty-sub">Click the <i class="far fa-heart" aria-hidden="true"></i> on any vehicle to save it here.</p>' +
            '<a class="hero-btn primary fav-empty-cta" href="car-dashboard.html">Browse Listings</a>';
        return wrap;
    }

    function removeCard(carId, cardEl, grid, clearBtn) {
        // Animate out, then remove from DOM
        cardEl.classList.add('fav-card-removing');
        cardEl.addEventListener('transitionend', function () {
            cardEl.remove();
            if (!grid.querySelector('.fav-card')) {
                grid.appendChild(buildEmptyState());
                if (clearBtn) clearBtn.hidden = true;
            }
        }, { once: true });
    }

    function renderFavorites(cars) {
        var grid = document.getElementById('favoritesGrid');
        var clearBtn = document.getElementById('clearAllFavsBtn');
        if (!grid) return;

        grid.textContent = '';

        var favCars = getFavoritedCars(cars);

        if (!favCars.length) {
            grid.appendChild(buildEmptyState());
            if (clearBtn) clearBtn.hidden = true;
            return;
        }

        if (clearBtn) {
            clearBtn.hidden = false;
            clearBtn.addEventListener('click', function () {
                saveFavorites([]); // from components.js
                grid.querySelectorAll('.fav-card').forEach(function (c) {
                    c.classList.add('fav-card-removing');
                });
                setTimeout(function () {
                    grid.textContent = '';
                    grid.appendChild(buildEmptyState());
                    clearBtn.hidden = true;
                }, 280);
            });
        }

        favCars.forEach(function (car) {
            var card = buildFavCard(car, function (carId, cardEl) {
                removeCard(carId, cardEl, grid, clearBtn);
            });
            grid.appendChild(card);
        });
    }

    function init() {
        fetch(CARS_JSON)
            .then(function (res) {
                if (!res.ok) throw new Error('Could not load ' + CARS_JSON);
                return res.json();
            })
            .then(function (data) {
                renderFavorites(data.cars || []);
            })
            .catch(function (err) {
                console.error('[my-searches]', err);
                var grid = document.getElementById('favoritesGrid');
                if (grid) {
                    grid.textContent = '';
                    var msg = document.createElement('p');
                    msg.className = 'fav-load-error';
                    msg.textContent = 'Could not load vehicle data. Please refresh the page.';
                    grid.appendChild(msg);
                }
            });
    }

    document.addEventListener('components:ready', init);
    // Fallback if components already fired before this script ran
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    }

})();
