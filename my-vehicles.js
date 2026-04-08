(function () {
    var tableBody = document.getElementById('inventoryTableBody');
    var inventoryTableWrap = document.getElementById('inventoryTableWrap');
    var inventoryCardGrid = document.getElementById('inventoryCardGrid');
    var viewedCount = document.getElementById('inventoryViewedCount');
    var totalCount = document.getElementById('inventoryTotalCount');
    var rangeLabel = document.getElementById('inventoryRange');
    var inventoryViewMode = document.getElementById('inventoryViewMode');
    var rowsPerPageSelect = document.getElementById('inventoryRowsPerPage');
    var clearButton = document.getElementById('inventoryClearSearch');
    var dealershipFilterMenu = document.getElementById('dealershipFilterMenu');
    var launchFilterMenu = document.getElementById('launchFilterMenu');
    var statusFilterMenu = document.getElementById('statusFilterMenu');
    var filterDetails = document.querySelectorAll('.hero-filter');
    var inventoryEditModal = document.getElementById('inventoryEditModal');
    var inventoryEditVehicleLabel = document.getElementById('inventoryEditVehicleLabel');
    var inventoryEditPriceInput = document.getElementById('inventoryEditPriceInput');
    var inventoryEditSave = document.getElementById('inventoryEditSave');
    var inventoryEditCancel = document.getElementById('inventoryEditCancel');
    var inventoryEditClose = document.getElementById('inventoryEditClose');
    var inventoryEditReset = document.getElementById('inventoryEditReset');

    if (!tableBody || !inventoryTableWrap || !inventoryCardGrid || !viewedCount || !totalCount || !rangeLabel || !rowsPerPageSelect || !inventoryViewMode) {
        return;
    }

    var allCars = [];
    var filterState = {
        dealership: new Set(),
        launch: new Set(),
        status: new Set()
    };
    var launchOptions = [
        { value: 'ready', label: 'Ready' },
        { value: 'review', label: 'Needs Review' },
        { value: 'sold', label: 'Sold Archive' }
    ];
    var statusOptionOrder = ['Ready for sale', 'Inspection Pending', 'Needs inspection', 'Expired', 'Sold'];
    var inventoryPriceStorageKey = 'myVehiclesBuyNowOverrides';
    var activePriceEditCarId = null;
    var currentInventoryView = inventoryViewMode.value === 'card' ? 'card' : 'table';

    function formatCurrency(amount) {
        if (!Number.isFinite(amount)) return '--';
        return '$' + amount.toLocaleString('en-US');
    }

    function getStoredPriceOverrides() {
        try {
            var raw = window.localStorage.getItem(inventoryPriceStorageKey);
            if (!raw) return {};

            var parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function saveStoredPriceOverride(carId, buyNowPrice) {
        try {
            var overrides = getStoredPriceOverrides();
            overrides[carId] = buyNowPrice;
            window.localStorage.setItem(inventoryPriceStorageKey, JSON.stringify(overrides));
        } catch (error) {
            // Ignore storage failures so editing still works for the current session.
        }
    }

    function removeStoredPriceOverride(carId) {
        try {
            var overrides = getStoredPriceOverrides();
            delete overrides[carId];
            window.localStorage.setItem(inventoryPriceStorageKey, JSON.stringify(overrides));
        } catch (error) {
            // Ignore storage failures so the current page state can still recover.
        }
    }

    function applyStoredPriceOverrides(cars) {
        var overrides = getStoredPriceOverrides();

        cars.forEach(function (car) {
            car.originalBuyNowPrice = Number.isFinite(car.buyNowPrice)
                ? car.buyNowPrice
                : (Number.isFinite(car.reservePrice) ? car.reservePrice : null);

            if (Object.prototype.hasOwnProperty.call(overrides, car.id) && Number.isFinite(overrides[car.id])) {
                car.buyNowPrice = overrides[car.id];
            }
        });

        return cars;
    }

    function getEditableBuyNowValue(car) {
        if (Number.isFinite(car && car.buyNowPrice)) return car.buyNowPrice;
        if (Number.isFinite(car && car.reservePrice)) return car.reservePrice;
        return null;
    }

    function getOriginalBuyNowValue(car) {
        if (Number.isFinite(car && car.originalBuyNowPrice)) return car.originalBuyNowPrice;
        if (Number.isFinite(car && car.reservePrice)) return car.reservePrice;
        return null;
    }

    function formatDateTime(dateInput) {
        if (!dateInput) return '--';
        var parsed = new Date(dateInput);
        if (Number.isNaN(parsed.getTime())) return '--';

        return parsed.toLocaleString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).replace('/', '-').replace('/', '-');
    }

    function deriveDealerId(name) {
        var source = String(name || 'Dealer');
        var hash = 0;

        for (var i = 0; i < source.length; i += 1) {
            hash = ((hash << 5) - hash) + source.charCodeAt(i);
            hash |= 0;
        }

        return String(Math.abs(hash % 90000) + 10000);
    }

    function normalizeStatus(rawStatus, car) {
        var normalized = String(rawStatus || 'Sale').trim().toLowerCase();
        var reserveValue = Number.isFinite(car && car.reservePrice) ? car.reservePrice : null;
        var currentBid = Number.isFinite(car && car.currentBid) ? car.currentBid : NaN;

        if (normalized === 'sold') {
            return { label: 'Sold', className: 'sold' };
        }

        if (
            normalized === 'reserve is off' ||
            normalized === 'reserve-off' ||
            normalized === 'reserve_off' ||
            normalized === 'reserveoff'
        ) {
            return { label: 'Reserve is Off', className: 'reserve-off' };
        }

        if (normalized === 'appending' || normalized === 'reserve') {
            if (reserveValue !== null && Number.isFinite(currentBid) && currentBid >= reserveValue) {
                return { label: 'Reserve is Off', className: 'reserve-off' };
            }
            return { label: 'Reserve', className: 'reserve' };
        }

        return { label: 'Sale', className: 'sale' };
    }

    function hasExpiredAuction(car) {
        if (!car || !car.auctionEndAt) return false;

        var parsed = new Date(car.auctionEndAt);
        if (Number.isNaN(parsed.getTime())) return false;

        return parsed.getTime() < Date.now();
    }

    function getInventoryStatus(car) {
        var auctionStatus = normalizeStatus(car.status, car);
        var hasCoreListingInfo = Boolean(
            car && car.photo && car.description && car.seller && car.location && car.pickup && car.condition
        );

        if (auctionStatus.className === 'sold') {
            return { label: 'Sold', className: 'sold' };
        }

        if (!hasCoreListingInfo || normalizeMileage(car.mileage) === '--') {
            return { label: 'Needs inspection', className: 'needs-inspection' };
        }

        if (auctionStatus.className === 'reserve') {
            return { label: 'Inspection Pending', className: 'inspection-pending' };
        }

        if (hasExpiredAuction(car)) {
            return { label: 'Expired', className: 'expired' };
        }

        return { label: 'Ready for sale', className: 'ready-for-sale' };
    }

    function normalizeMileage(value) {
        if (value == null) return '--';
        var raw = String(value).trim();
        if (!raw || raw.toLowerCase() === 'unknown') return '--';
        return raw;
    }

    function getAgeValue(year) {
        if (!Number.isFinite(year)) return '--';
        var currentYear = new Date().getFullYear();
        return String(Math.max(0, currentYear - year));
    }

    function getLaunchState(car) {
        var inventoryStatus = getInventoryStatus(car);
        if (inventoryStatus.className === 'sold') {
            return { value: 'sold', label: 'Sold Archive' };
        }

        if (inventoryStatus.className === 'ready-for-sale') {
            return { value: 'ready', label: 'Ready' };
        }

        return { value: 'review', label: 'Needs Review' };
    }

    function createVehicleCell(car) {
        var link = document.createElement('a');
        link.className = 'inventory-vehicle';
        link.href = 'car-details.html?car=' + encodeURIComponent(car.id) + '&source=seller&returnTo=' + encodeURIComponent('my-vehicles.html') + '&returnLabel=' + encodeURIComponent('My Vehicles');
        link.target = '_blank';
        link.rel = 'opener';

        var image = document.createElement('img');
        image.src = car.photo || ('cars-photos/' + car.id + '.png');
        image.alt = car.year + ' ' + car.make + ' ' + car.model;
        image.loading = 'lazy';

        var label = document.createElement('span');
        label.textContent = car.year + ' ' + car.make + ' ' + car.model;

        var vin = document.createElement('small');
        vin.textContent = String(car.vin || car.id || '--').toUpperCase();
        label.appendChild(vin);

        link.appendChild(image);
        link.appendChild(label);
        return link;
    }

    function createCardVehicleCell(car, statusMeta) {
        var link = document.createElement('a');
        link.className = 'inventory-vehicle inventory-card-vehicle';
        link.href = 'car-details.html?car=' + encodeURIComponent(car.id) + '&source=seller&returnTo=' + encodeURIComponent('my-vehicles.html') + '&returnLabel=' + encodeURIComponent('My Vehicles');
        link.target = '_blank';
        link.rel = 'opener';

        var image = document.createElement('img');
        image.src = car.photo || ('cars-photos/' + car.id + '.png');
        image.alt = car.year + ' ' + car.make + ' ' + car.model;
        image.loading = 'lazy';

        var content = document.createElement('span');
        content.className = 'inventory-card-vehicle-copy';

        var title = document.createElement('span');
        title.className = 'inventory-card-vehicle-title';
        title.textContent = car.year + ' ' + car.make + ' ' + car.model;
        content.appendChild(title);

        var vin = document.createElement('small');
        vin.textContent = String(car.vin || car.id || '--').toUpperCase();
        content.appendChild(vin);

        var statusPill = document.createElement('span');
        statusPill.className = 'inventory-status ' + statusMeta.className;
        statusPill.textContent = statusMeta.label;
        content.appendChild(statusPill);

        link.appendChild(image);
        link.appendChild(content);
        return link;
    }

    function createBuyNowEditor(car) {
        var buyNowValue = formatCurrency(getEditableBuyNowValue(car));
        var buyNowWrap = document.createElement('div');
        buyNowWrap.className = 'inventory-price-edit';

        var buyNowText = document.createElement('span');
        buyNowText.textContent = buyNowValue;

        var buyNowEdit = document.createElement('button');
        buyNowEdit.type = 'button';
        buyNowEdit.className = 'inventory-price-edit-btn';
        buyNowEdit.setAttribute('aria-label', 'Edit Buy Now price for ' + car.year + ' ' + car.make + ' ' + car.model);
        buyNowEdit.title = 'Edit Buy Now price';
        buyNowEdit.innerHTML = '<i class="fa-solid fa-pen" aria-hidden="true"></i>';
        buyNowEdit.addEventListener('click', function () {
            openPriceEditor(car);
        });

        buyNowWrap.appendChild(buyNowText);
        buyNowWrap.appendChild(buyNowEdit);
        return buyNowWrap;
    }

    function openPriceEditor(car) {
        if (!inventoryEditModal || !inventoryEditPriceInput || !inventoryEditVehicleLabel) {
            return;
        }

        activePriceEditCarId = car.id;
        inventoryEditVehicleLabel.textContent = car.year + ' ' + car.make + ' ' + car.model;
        inventoryEditPriceInput.value = getEditableBuyNowValue(car) == null ? '' : String(getEditableBuyNowValue(car));
        inventoryEditModal.hidden = false;
        document.body.classList.add('inventory-modal-open');

        window.requestAnimationFrame(function () {
            inventoryEditPriceInput.focus();
            inventoryEditPriceInput.select();
        });
    }

    function closePriceEditor() {
        activePriceEditCarId = null;
        if (inventoryEditModal) {
            inventoryEditModal.hidden = true;
        }
        document.body.classList.remove('inventory-modal-open');
    }

    function savePriceEditor() {
        if (!inventoryEditPriceInput || !activePriceEditCarId) {
            closePriceEditor();
            return;
        }

        var parsedValue = Number.parseFloat(inventoryEditPriceInput.value);
        if (!Number.isFinite(parsedValue) || parsedValue < 0) {
            inventoryEditPriceInput.focus();
            return;
        }

        var roundedValue = Math.round(parsedValue);
        var targetCar = allCars.find(function (car) {
            return car.id === activePriceEditCarId;
        });

        if (targetCar) {
            targetCar.buyNowPrice = roundedValue;
            saveStoredPriceOverride(targetCar.id, roundedValue);
        }

        closePriceEditor();
        refreshInventoryView();
    }

    function resetPriceEditor() {
        if (!activePriceEditCarId) {
            closePriceEditor();
            return;
        }

        var targetCar = allCars.find(function (car) {
            return car.id === activePriceEditCarId;
        });

        if (targetCar) {
            targetCar.buyNowPrice = getOriginalBuyNowValue(targetCar);
            removeStoredPriceOverride(targetCar.id);
        }

        closePriceEditor();
        refreshInventoryView();
    }

    function getFilteredCars() {
        return allCars.filter(function (car) {
            var seller = car.seller || 'Dealer';
            var statusMeta = getInventoryStatus(car);
            var launchState = getLaunchState(car);

            var dealershipMatch = filterState.dealership.size === 0 || filterState.dealership.has(seller);
            var launchMatch = filterState.launch.size === 0 || filterState.launch.has(launchState.value);
            var statusMatch = filterState.status.size === 0 || filterState.status.has(statusMeta.label);

            return dealershipMatch && launchMatch && statusMatch;
        });
    }

    function updateSummaryBadge(filterType) {
        var detail = document.querySelector('.hero-filter[data-filter="' + filterType + '"]');
        if (!detail) return;

        var countNode = detail.querySelector('.hero-filter-count');
        if (!countNode) return;

        var count = filterState[filterType].size;
        countNode.textContent = String(count);
        countNode.hidden = count === 0;
    }

    function closeOtherMenus(activeType) {
        filterDetails.forEach(function (detail) {
            if (detail.getAttribute('data-filter') !== activeType) {
                detail.open = false;
            }
        });
    }

    function createFilterOption(filterType, optionValue, optionLabel, optionCount) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'hero-filter-option';
        button.setAttribute('role', 'menuitemcheckbox');
        button.setAttribute('aria-checked', filterState[filterType].has(optionValue) ? 'true' : 'false');
        if (filterState[filterType].has(optionValue)) {
            button.classList.add('is-selected');
        }

        var text = document.createElement('span');
        text.textContent = optionLabel;

        var count = document.createElement('span');
        count.className = 'hero-filter-option-count';
        count.textContent = String(optionCount);

        button.appendChild(text);
        button.appendChild(count);

        button.addEventListener('click', function () {
            if (filterState[filterType].has(optionValue)) {
                filterState[filterType].delete(optionValue);
            } else {
                filterState[filterType].add(optionValue);
            }

            updateSummaryBadge(filterType);
            renderFilterMenus();
            refreshInventoryView();
        });

        return button;
    }

    function renderFilterMenus() {
        if (dealershipFilterMenu) {
            dealershipFilterMenu.textContent = '';
            var sellerCounts = {};
            allCars.forEach(function (car) {
                var seller = car.seller || 'Dealer';
                sellerCounts[seller] = (sellerCounts[seller] || 0) + 1;
            });

            Object.keys(sellerCounts).sort().forEach(function (seller) {
                dealershipFilterMenu.appendChild(createFilterOption('dealership', seller, seller, sellerCounts[seller]));
            });
        }

        if (launchFilterMenu) {
            launchFilterMenu.textContent = '';
            var launchCounts = { ready: 0, review: 0, sold: 0 };
            allCars.forEach(function (car) {
                var state = getLaunchState(car);
                launchCounts[state.value] += 1;
            });

            launchOptions.forEach(function (option) {
                launchFilterMenu.appendChild(createFilterOption('launch', option.value, option.label, launchCounts[option.value] || 0));
            });
        }

        if (statusFilterMenu) {
            statusFilterMenu.textContent = '';
            var statusCounts = {};
            allCars.forEach(function (car) {
                var statusLabel = getInventoryStatus(car).label;
                statusCounts[statusLabel] = (statusCounts[statusLabel] || 0) + 1;
            });

            statusOptionOrder.forEach(function (label) {
                statusFilterMenu.appendChild(createFilterOption('status', label, label, statusCounts[label] || 0));
            });
        }

        updateSummaryBadge('dealership');
        updateSummaryBadge('launch');
        updateSummaryBadge('status');
    }

    function renderTable(cars) {
        tableBody.textContent = '';

        if (!cars.length) {
            var emptyRow = document.createElement('tr');
            var emptyCell = document.createElement('td');
            emptyCell.colSpan = 11;
            emptyCell.className = 'inventory-empty';
            emptyCell.textContent = 'No inventory vehicles match the selected filters.';
            emptyRow.appendChild(emptyCell);
            tableBody.appendChild(emptyRow);

            viewedCount.textContent = '0';
            rangeLabel.textContent = '0-0 of 0';
            return;
        }

        var pageSize = Number.parseInt(rowsPerPageSelect.value, 10);
        if (!Number.isFinite(pageSize) || pageSize <= 0) {
            pageSize = 20;
        }

        var visibleCars = cars.slice(0, pageSize);

        visibleCars.forEach(function (car) {
            var statusMeta = getInventoryStatus(car);
            var row = document.createElement('tr');

            var selectCell = document.createElement('td');
            var selectInput = document.createElement('input');
            selectInput.type = 'checkbox';
            selectInput.setAttribute('aria-label', 'Select ' + car.year + ' ' + car.make + ' ' + car.model);
            selectCell.appendChild(selectInput);

            var vehicleCell = document.createElement('td');
            vehicleCell.appendChild(createVehicleCell(car));

            var estimateCell = document.createElement('td');
            estimateCell.textContent = formatCurrency(car.currentBid);

            var guaranteedCell = document.createElement('td');
            guaranteedCell.appendChild(createBuyNowEditor(car));

            var statusCell = document.createElement('td');
            var statusPill = document.createElement('span');
            statusPill.className = 'inventory-status ' + statusMeta.className;
            statusPill.textContent = statusMeta.label;
            statusCell.appendChild(statusPill);

            var dealerCell = document.createElement('td');
            dealerCell.textContent = car.seller || 'Dealer';
            var dealerId = document.createElement('span');
            dealerId.textContent = deriveDealerId(car.seller);
            dealerCell.appendChild(dealerId);

            var ageCell = document.createElement('td');
            ageCell.textContent = getAgeValue(car.year);

            var odometerCell = document.createElement('td');
            odometerCell.textContent = normalizeMileage(car.mileage);

            var expiryCell = document.createElement('td');
            expiryCell.textContent = formatDateTime(car.auctionEndAt);

            var stockCell = document.createElement('td');
            stockCell.textContent = '--';

            var certifiedCell = document.createElement('td');
            certifiedCell.textContent = 'No';

            row.appendChild(selectCell);
            row.appendChild(vehicleCell);
            row.appendChild(estimateCell);
            row.appendChild(guaranteedCell);
            row.appendChild(statusCell);
            row.appendChild(dealerCell);
            row.appendChild(ageCell);
            row.appendChild(odometerCell);
            row.appendChild(expiryCell);
            row.appendChild(stockCell);
            row.appendChild(certifiedCell);
            tableBody.appendChild(row);
        });

        viewedCount.textContent = String(visibleCars.length);
        rangeLabel.textContent = '1-' + visibleCars.length + ' of ' + cars.length;
    }

    function renderCards(cars) {
        inventoryCardGrid.textContent = '';

        if (!cars.length) {
            var emptyCard = document.createElement('article');
            emptyCard.className = 'inventory-card inventory-card-empty';
            emptyCard.textContent = 'No inventory vehicles match the selected filters.';
            inventoryCardGrid.appendChild(emptyCard);
            return;
        }

        var pageSize = Number.parseInt(rowsPerPageSelect.value, 10);
        if (!Number.isFinite(pageSize) || pageSize <= 0) {
            pageSize = 20;
        }

        var visibleCars = cars.slice(0, pageSize);

        visibleCars.forEach(function (car) {
            var statusMeta = getInventoryStatus(car);
            var card = document.createElement('article');
            card.className = 'inventory-card';

            var header = document.createElement('div');
            header.className = 'inventory-card-header';
            header.appendChild(createCardVehicleCell(car, statusMeta));

            var metrics = document.createElement('div');
            metrics.className = 'inventory-card-metrics';

            [
                ['Estimate', formatCurrency(car.currentBid)],
                ['Buy Now', createBuyNowEditor(car)],
                ['Dealership', car.seller || 'Dealer'],
                ['Dealer ID', deriveDealerId(car.seller)],
                ['Age', getAgeValue(car.year)],
                ['Odometer', normalizeMileage(car.mileage)]
            ].forEach(function (entry) {
                var item = document.createElement('div');
                item.className = 'inventory-card-metric';

                var label = document.createElement('span');
                label.className = 'inventory-card-label';
                label.textContent = entry[0];

                var value = document.createElement('strong');
                value.className = 'inventory-card-value';
                if (entry[1] instanceof Node) {
                    value.appendChild(entry[1]);
                } else {
                    value.textContent = entry[1];
                }

                item.appendChild(label);
                item.appendChild(value);
                metrics.appendChild(item);
            });

            card.appendChild(header);
            card.appendChild(metrics);
            inventoryCardGrid.appendChild(card);
        });
    }

    function setInventoryCounts(cars) {
        totalCount.textContent = String(cars.length);

        if (!cars.length) {
            viewedCount.textContent = '0';
            rangeLabel.textContent = '0-0 of 0';
            return;
        }

        var pageSize = Number.parseInt(rowsPerPageSelect.value, 10);
        if (!Number.isFinite(pageSize) || pageSize <= 0) {
            pageSize = 20;
        }

        var visibleCount = Math.min(cars.length, pageSize);
        viewedCount.textContent = String(visibleCount);
        rangeLabel.textContent = '1-' + visibleCount + ' of ' + cars.length;
    }

    function refreshInventoryView() {
        var filteredCars = getFilteredCars();

        setInventoryCounts(filteredCars);
        inventoryTableWrap.hidden = currentInventoryView !== 'table';
        inventoryCardGrid.hidden = currentInventoryView !== 'card';

        if (currentInventoryView === 'card') {
            renderCards(filteredCars);
        } else {
            renderTable(filteredCars);
        }
    }

    function resetFilters() {
        filterState.dealership.clear();
        filterState.launch.clear();
        filterState.status.clear();
        rowsPerPageSelect.value = '20';
        renderFilterMenus();
        refreshInventoryView();
    }

    function loadInventoryData() {
        fetch('data/cars.json')
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function (payload) {
                allCars = payload && Array.isArray(payload.cars) ? applyStoredPriceOverrides(payload.cars) : [];
                renderFilterMenus();
                refreshInventoryView();
            })
            .catch(function () {
                allCars = [];
                renderFilterMenus();
                refreshInventoryView();
            });
    }

    filterDetails.forEach(function (detail) {
        detail.addEventListener('toggle', function () {
            if (detail.open) {
                closeOtherMenus(detail.getAttribute('data-filter'));
            }
        });
    });

    document.addEventListener('click', function (event) {
        var target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        if (!target.closest('.hero-filter')) {
            filterDetails.forEach(function (detail) {
                detail.open = false;
            });
        }
    });

    rowsPerPageSelect.addEventListener('change', function () {
        refreshInventoryView();
    });

    inventoryViewMode.addEventListener('change', function () {
        currentInventoryView = inventoryViewMode.value === 'card' ? 'card' : 'table';
        refreshInventoryView();
    });

    if (clearButton) {
        clearButton.addEventListener('click', function () {
            resetFilters();
        });
    }

    if (inventoryEditSave) {
        inventoryEditSave.addEventListener('click', function () {
            savePriceEditor();
        });
    }

    if (inventoryEditCancel) {
        inventoryEditCancel.addEventListener('click', function () {
            closePriceEditor();
        });
    }

    if (inventoryEditClose) {
        inventoryEditClose.addEventListener('click', function () {
            closePriceEditor();
        });
    }

    if (inventoryEditReset) {
        inventoryEditReset.addEventListener('click', function () {
            resetPriceEditor();
        });
    }

    if (inventoryEditModal) {
        inventoryEditModal.addEventListener('click', function (event) {
            var target = event.target;
            if (!(target instanceof Element)) {
                return;
            }

            if (target.hasAttribute('data-action') && target.getAttribute('data-action') === 'close-price-modal') {
                closePriceEditor();
            }
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && inventoryEditModal && !inventoryEditModal.hidden) {
            closePriceEditor();
        }

        if (event.key === 'Enter' && inventoryEditModal && !inventoryEditModal.hidden && document.activeElement === inventoryEditPriceInput) {
            event.preventDefault();
            savePriceEditor();
        }
    });

    loadInventoryData();
}());
