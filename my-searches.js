(function () {
    'use strict';

    // ── Favorites section ──────────────────────────────────────────────────────

    var CARS_JSON = 'data/cars.json';
    var INVENTORY_TABLE = 'inventory_vehicles';
    var inventorySupabaseClient = null;
    var SAVED_ADVANCED_SEARCHES_KEY = 'savedAdvancedSearchesV1';
    var editingSavedSearchId = null;

    function getInventoryConfig() {
        return window.INVENTORY_SUPABASE_CONFIG || window.ADD_VEHICLE_SUPABASE_CONFIG || {};
    }

    function looksLikePlaceholderConfigValue(value) {
        return !value || /your[-_ ]/i.test(value) || /replace[-_ ]/i.test(value);
    }

    function initializeInventorySupabase() {
        var config = getInventoryConfig();

        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            return false;
        }

        if (looksLikePlaceholderConfigValue(config.url) || looksLikePlaceholderConfigValue(config.anonKey)) {
            return false;
        }

        if (!inventorySupabaseClient) {
            inventorySupabaseClient = window.supabase.createClient(config.url, config.anonKey);
        }

        return true;
    }

    function mapInventoryRowToCar(row) {
        return {
            id: row.id,
            vin: row.vin || '',
            year: Number.parseInt(row.year, 10) || row.year || '--',
            make: row.make || 'Vehicle',
            model: row.model || 'Listing',
            engine: row.engine || '',
            transmission: row.transmission || '',
            bodyStyle: row.body_style || row.bodyStyle || '',
            mileage: row.mileage || 'Unknown',
            condition: row.condition || '',
            description: row.description || '',
            photo: row.photo || '',
            startingBid: Number.isFinite(Number(row.starting_bid)) ? Number(row.starting_bid) : 0,
            currentBid: Number.isFinite(Number(row.current_bid)) ? Number(row.current_bid) : 0,
            reservePrice: Number.isFinite(Number(row.reserve_price)) ? Number(row.reserve_price) : null,
            buyNowPrice: Number.isFinite(Number(row.buy_now_price)) ? Number(row.buy_now_price) : null,
            status: row.market_status || row.status || 'Sale',
            timeRemaining: row.time_remaining || '00:00:00',
            seller: row.seller || 'Dealer',
            location: row.location || '',
            pickup: row.pickup || '',
            auctionStartAt: row.auction_start_at || null,
            auctionEndAt: row.auction_end_at || null
        };
    }

    function loadInventoryCars() {
        var config = getInventoryConfig();
        var table = config.table || INVENTORY_TABLE;

        if (!initializeInventorySupabase()) {
            return Promise.resolve(null);
        }

        return inventorySupabaseClient
            .from(table)
            .select('*')
            .then(function (result) {
                if (result.error) {
                    throw result.error;
                }

                return (result.data || [])
                    .filter(function (row) { return row && row.is_archived !== true; })
                    .map(mapInventoryRowToCar);
            })
            .catch(function (error) {
                console.warn('[my-searches] Supabase inventory load failed, falling back to JSON:', error);
                return null;
            });
    }

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

    function pickFeaturedVehicle(allCars) {
        var active = allCars.filter(function (c) {
            var s = (c.status || '').toLowerCase();
            return s === 'sale' || s === 'reserve is off' || s === 'appending';
        });
        if (!active.length) {
            active = allCars.filter(function (c) {
                return (c.status || '').toLowerCase() !== 'sold';
            });
        }
        if (!active.length) return null;
        return active[Math.floor(Math.random() * active.length)];
    }

    function renderHeroFeaturedVehicle(allCars) {
        var container = document.getElementById('heroFeaturedVehicle');
        if (!container) return;

        var car = pickFeaturedVehicle(allCars);
        if (!car) return;

        var href = 'car-details.html?car=' + encodeURIComponent(car.id)
            + '&source=marketplace&returnTo=my-searches.html&returnLabel=My%20Searches';
        var photoSrc = (car.photos && car.photos.length) ? car.photos[0]
            : (car.photo || 'images/placeholder-car.png');
        var title = car.year + ' ' + car.make + ' ' + car.model;
        var specs = [car.bodyStyle, car.transmission, car.engine].filter(Boolean).join(' · ');
        var price = car.currentBid
            ? '$' + Number(car.currentBid).toLocaleString()
            : (car.startingBid ? '$' + Number(car.startingBid).toLocaleString() : '');

        var s = (car.status || '').toLowerCase();
        var pillText = s === 'sale' ? 'Live'
            : s === 'reserve is off' ? 'Reserve Off'
            : s === 'appending' ? 'Reserve'
            : (car.status || 'Listed');
        var pillClass = 'hero-feature-pill'
            + (s === 'appending' ? ' is-reserve' : '')
            + (s === 'reserve is off' ? ' is-reserve-off' : '');

        var label = document.createElement('div');
        label.className = 'hero-feature-label';
        label.textContent = 'Feature Car of the Day';

        var a = document.createElement('a');
        a.className = 'hero-feature-card';
        a.href = href;
        a.setAttribute('title', 'View ' + title);

        var img = document.createElement('img');
        img.className = 'hero-feature-img';
        img.src = photoSrc;
        img.alt = title;
        img.loading = 'lazy';
        img.onerror = function () { this.src = 'images/placeholder-car.png'; };

        var info = document.createElement('div');
        info.className = 'hero-feature-info';

        var nameEl = document.createElement('span');
        nameEl.className = 'hero-feature-name';
        nameEl.textContent = title;

        var specsEl = document.createElement('span');
        specsEl.className = 'hero-feature-specs';
        specsEl.textContent = specs;

        var bottom = document.createElement('div');
        bottom.className = 'hero-feature-bottom';

        var pill = document.createElement('span');
        pill.className = pillClass;
        pill.textContent = pillText;
        bottom.appendChild(pill);

        if (price) {
            var priceEl = document.createElement('span');
            priceEl.className = 'hero-feature-price';
            priceEl.textContent = price;
            bottom.appendChild(priceEl);
        }

        info.appendChild(nameEl);
        info.appendChild(specsEl);
        info.appendChild(bottom);
        a.appendChild(img);
        a.appendChild(info);

        container.appendChild(label);
        container.appendChild(a);
    }

    function init() {
        renderSavedSearches();

        loadInventoryCars()
            .then(function (supabaseCars) {
                if (Array.isArray(supabaseCars)) {
                    return supabaseCars;
                }

                return fetch(CARS_JSON)
                    .then(function (res) {
                        if (!res.ok) throw new Error('Could not load ' + CARS_JSON);
                        return res.json();
                    })
                    .then(function (data) {
                        return data.cars || [];
                    });
            })
            .then(function (cars) {
                renderFavorites(cars);
                renderHeroFeaturedVehicle(cars);
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

    function getSavedAdvancedSearches() {
        try {
            var raw = window.localStorage.getItem(SAVED_ADVANCED_SEARCHES_KEY);
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            return [];
        }
    }

    function saveSavedAdvancedSearches(list) {
        try {
            window.localStorage.setItem(SAVED_ADVANCED_SEARCHES_KEY, JSON.stringify(list));
        } catch (err) {
            // Ignore storage errors.
        }
    }

    function formatSavedSearchDate(iso) {
        if (!iso) return 'Saved recently';
        var date = new Date(iso);
        if (Number.isNaN(date.getTime())) return 'Saved recently';
        return 'Saved ' + date.toLocaleString();
    }

    function buildSavedSearchItem(entry, options) {
        var settings = options || {};
        var isEditing = settings.isEditing === true;
        var item = document.createElement('article');
        item.className = 'saved-search-item';
        if (isEditing) {
            item.classList.add('is-editing');
        }

        var main = document.createElement('div');
        main.className = 'saved-search-main';

        if (isEditing) {
            var titleEditor = document.createElement('input');
            titleEditor.type = 'text';
            titleEditor.className = 'saved-search-name-input';
            titleEditor.value = entry.label || '';
            titleEditor.placeholder = 'Search name';
            titleEditor.setAttribute('aria-label', 'Saved search name');
            titleEditor.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    settings.onSave(entry.id, titleEditor.value);
                }

                if (event.key === 'Escape') {
                    event.preventDefault();
                    settings.onCancel();
                }
            });
            main.appendChild(titleEditor);
            window.setTimeout(function () {
                titleEditor.focus();
                titleEditor.select();
            }, 0);
        } else {
            var title = document.createElement('p');
            title.className = 'saved-search-name';
            title.textContent = entry.label || 'Untitled search';
            main.appendChild(title);
        }

        var meta = document.createElement('p');
        meta.className = 'saved-search-meta';
        meta.textContent = formatSavedSearchDate(entry.createdAt);
        main.appendChild(meta);

        var actions = document.createElement('div');
        actions.className = 'saved-search-actions';

        if (isEditing) {
            var saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'saved-search-action-btn save';
            saveBtn.textContent = 'Save';
            saveBtn.addEventListener('click', function () {
                var input = main.querySelector('.saved-search-name-input');
                settings.onSave(entry.id, input ? input.value : '');
            });
            actions.appendChild(saveBtn);

            var cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'saved-search-action-btn cancel';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', function () {
                settings.onCancel();
            });
            actions.appendChild(cancelBtn);
        } else {
            var runLink = document.createElement('a');
            runLink.className = 'saved-search-action-btn run';
            runLink.href = 'car-dashboard.html?savedSearch=' + encodeURIComponent(entry.id);
            runLink.textContent = 'Run Search';
            actions.appendChild(runLink);

            var editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'saved-search-action-btn edit';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', function () {
                settings.onStartEdit(entry.id);
            });
            actions.appendChild(editBtn);
        }

        var deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'saved-search-action-btn delete';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', function () {
            settings.onDelete(entry.id);
        });
        actions.appendChild(deleteBtn);

        item.appendChild(main);
        item.appendChild(actions);

        return item;
    }

    function renderSavedSearches() {
        var listEl = document.getElementById('savedSearchesList');
        if (!listEl) return;

        var entries = getSavedAdvancedSearches();
        listEl.textContent = '';

        if (!entries.length) {
            var empty = document.createElement('p');
            empty.className = 'saved-search-empty';
            empty.textContent = 'No saved searches yet. Use Save & Search from Advanced Search on the dashboard.';
            listEl.appendChild(empty);
            return;
        }

        entries.forEach(function (entry) {
            var row = buildSavedSearchItem(entry, {
                isEditing: editingSavedSearchId === entry.id,
                onStartEdit: function (entryId) {
                    editingSavedSearchId = entryId;
                    renderSavedSearches();
                },
                onCancel: function () {
                    editingSavedSearchId = null;
                    renderSavedSearches();
                },
                onSave: function (entryId, nextLabel) {
                    var trimmedLabel = String(nextLabel || '').trim();
                    if (!trimmedLabel) return;

                    var renamed = getSavedAdvancedSearches().map(function (candidate) {
                        if (candidate.id !== entryId) return candidate;
                        return Object.assign({}, candidate, { label: trimmedLabel });
                    });
                    saveSavedAdvancedSearches(renamed);
                    editingSavedSearchId = null;
                    renderSavedSearches();
                },
                onDelete: function (entryId) {
                    var next = getSavedAdvancedSearches().filter(function (candidate) {
                        return candidate.id !== entryId;
                    });
                    saveSavedAdvancedSearches(next);
                    if (editingSavedSearchId === entryId) {
                        editingSavedSearchId = null;
                    }
                    renderSavedSearches();
                }
            });
            listEl.appendChild(row);
        });
    }

    document.addEventListener('components:ready', init);
    // Fallback if components already fired before this script ran
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    }

})();
