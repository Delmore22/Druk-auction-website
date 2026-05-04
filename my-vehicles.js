(function () {
    var tableBody = document.getElementById('inventoryTableBody');
    var inventoryTableWrap = document.getElementById('inventoryTableWrap');
    var inventoryCardGrid = document.getElementById('inventoryCardGrid');
    var reviewQueueStatus = document.getElementById('reviewQueueStatus');
    var reviewQueueList = document.getElementById('reviewQueueList');
    var reviewDecisionModal = document.getElementById('reviewDecisionModal');
    var reviewDecisionTitle = document.getElementById('reviewDecisionTitle');
    var reviewDecisionVehicle = document.getElementById('reviewDecisionVehicle');
    var reviewDecisionNotes = document.getElementById('reviewDecisionNotes');
    var reviewDecisionNotesLabel = document.getElementById('reviewDecisionNotesLabel');
    var reviewDecisionConfirm = document.getElementById('reviewDecisionConfirm');
    var reviewDecisionCancel = document.getElementById('reviewDecisionCancel');
    var reviewDecisionClose = document.getElementById('reviewDecisionClose');
    var activeReviewEntry = null;
    var activeReviewAction = null;
    var viewedCount = document.getElementById('inventoryViewedCount');
    var totalCount = document.getElementById('inventoryTotalCount');
    var rangeLabel = document.getElementById('inventoryRange');
    var inventoryViewMode = document.getElementById('inventoryViewMode');
    var rowsPerPageSelect = document.getElementById('inventoryRowsPerPage');
    var paginationPrevButton = document.getElementById('inventoryPagePrev');
    var paginationNextButton = document.getElementById('inventoryPageNext');
    var paginationInfo = document.getElementById('inventoryPageInfo');
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
    var statusOptionOrder = ['Active', 'Pending', 'Sold'];
    var inventoryPriceStorageKey = 'myVehiclesBuyNowOverrides';
    var activePriceEditCarId = null;
    var currentInventoryView = inventoryViewMode.value === 'card' ? 'card' : 'table';
    var currentPage = 1;
    var inventorySupabaseClient = null;
    var vehicleSubmissionSupabaseClient = null;
    var INVENTORY_VEHICLES_TABLE = 'inventory_vehicles';
    var VEHICLE_SUBMISSIONS_TABLE = 'vehicle_submissions';

    function getPageSize() {
        var pageSize = Number.parseInt(rowsPerPageSelect.value, 10);
        if (!Number.isFinite(pageSize) || pageSize <= 0) {
            return 20;
        }
        return pageSize;
    }

    function getPaginationMeta(cars) {
        var total = cars.length;
        var pageSize = getPageSize();

        if (!total) {
            currentPage = 1;
            return {
                total: 0,
                pageCount: 1,
                currentPage: 1,
                startIndex: 0,
                endIndex: 0,
                visibleCars: []
            };
        }

        var pageCount = Math.max(1, Math.ceil(total / pageSize));
        if (currentPage < 1) {
            currentPage = 1;
        }
        if (currentPage > pageCount) {
            currentPage = pageCount;
        }

        var startIndex = (currentPage - 1) * pageSize;
        var endIndex = Math.min(startIndex + pageSize, total);

        return {
            total: total,
            pageCount: pageCount,
            currentPage: currentPage,
            startIndex: startIndex,
            endIndex: endIndex,
            visibleCars: cars.slice(startIndex, endIndex)
        };
    }

    function updatePaginationControls(meta) {
        if (paginationInfo) {
            paginationInfo.textContent = 'Page ' + meta.currentPage + ' of ' + meta.pageCount;
        }

        if (paginationPrevButton) {
            paginationPrevButton.disabled = meta.total === 0 || meta.currentPage <= 1;
        }

        if (paginationNextButton) {
            paginationNextButton.disabled = meta.total === 0 || meta.currentPage >= meta.pageCount;
        }
    }

    function getVehicleSubmissionConfig() {
        return window.ADD_VEHICLE_SUPABASE_CONFIG || {};
    }

    function getInventoryConfig() {
        return window.INVENTORY_SUPABASE_CONFIG || window.ADD_VEHICLE_SUPABASE_CONFIG || {};
    }

    function looksLikePlaceholderConfigValue(value) {
        return !value || /your[-_ ]/i.test(value) || /replace[-_ ]/i.test(value);
    }

    function getSubmissionErrorMessage(err, fallback) {
        if (!err) {
            return fallback;
        }

        if (typeof err.message === 'string' && err.message) {
            return err.message;
        }

        if (typeof err.error_description === 'string' && err.error_description) {
            return err.error_description;
        }

        if (typeof err.details === 'string' && err.details) {
            return err.details;
        }

        try {
            return JSON.stringify(err);
        } catch (stringifyError) {
            return fallback;
        }
    }

    function initializeVehicleSubmissionSupabase() {
        if (!window._collectorsAllianceClient) {
            return false;
        }
        vehicleSubmissionSupabaseClient = window._collectorsAllianceClient;
        return true;
    }

    function initializeInventorySupabase() {
        if (!window._collectorsAllianceClient) {
            return false;
        }
        inventorySupabaseClient = window._collectorsAllianceClient;
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

    function loadInventoryCarsFromSupabase() {
        var config = getInventoryConfig();
        var table = config.table || INVENTORY_VEHICLES_TABLE;

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
                console.warn('[my-vehicles] Supabase inventory load failed, falling back to JSON:', error);
                return null;
            });
    }

    function formatSubmittedAt(value) {
        if (!value) return 'Unknown submission time';

        var parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return 'Unknown submission time';

        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(parsed);
    }

    function renderReviewQueue(entries, message) {
        if (!reviewQueueStatus || !reviewQueueList) {
            return;
        }

        reviewQueueStatus.textContent = message || '';
        reviewQueueList.textContent = '';

        if (!Array.isArray(entries) || !entries.length) {
            var emptyState = document.createElement('article');
            emptyState.className = 'review-queue-item is-empty';
            emptyState.textContent = 'No vehicle submissions are waiting for review.';
            reviewQueueList.appendChild(emptyState);
            return;
        }

        entries.forEach(function (entry) {
            var article = document.createElement('article');
            article.className = 'review-queue-item';

            var title = document.createElement('h3');
            title.textContent = entry.summary_label || [entry.year, entry.make, entry.model].filter(Boolean).join(' ') || 'Vehicle Submission';

            var meta = document.createElement('div');
            meta.className = 'review-queue-meta';

            var status = document.createElement('span');
            status.className = 'review-queue-pill';
            status.textContent = entry.status_label || 'Submitted for Review';

            var submittedAt = document.createElement('span');
            submittedAt.textContent = 'Submitted ' + formatSubmittedAt(entry.submitted_at);

            var seller = document.createElement('span');
            seller.textContent = entry.seller_company || entry.seller_name || 'Seller not provided';

            var vin = document.createElement('span');
            vin.textContent = 'VIN: ' + (entry.vin || '--');

            meta.appendChild(status);
            meta.appendChild(submittedAt);
            meta.appendChild(seller);
            meta.appendChild(vin);

            var actions = document.createElement('div');
            actions.className = 'review-queue-actions';

            var approveBtn = document.createElement('button');
            approveBtn.type = 'button';
            approveBtn.className = 'review-queue-btn approve';
            approveBtn.textContent = 'Approve';
            approveBtn.addEventListener('click', function () {
                openReviewDecision(entry, 'approve');
            });

            var rejectBtn = document.createElement('button');
            rejectBtn.type = 'button';
            rejectBtn.className = 'review-queue-btn reject';
            rejectBtn.textContent = 'Reject';
            rejectBtn.addEventListener('click', function () {
                openReviewDecision(entry, 'reject');
            });

            actions.appendChild(approveBtn);
            actions.appendChild(rejectBtn);

            article.appendChild(title);
            article.appendChild(meta);
            article.appendChild(actions);
            reviewQueueList.appendChild(article);
        });
    }

    function openReviewDecision(entry, action) {
        if (!reviewDecisionModal) return;

        activeReviewEntry = entry;
        activeReviewAction = action;

        var vehicleLabel = entry.summary_label || [entry.year, entry.make, entry.model].filter(Boolean).join(' ') || 'Vehicle Submission';

        if (reviewDecisionTitle) {
            reviewDecisionTitle.textContent = action === 'approve' ? 'Approve Submission' : 'Reject Submission';
        }

        if (reviewDecisionVehicle) {
            reviewDecisionVehicle.textContent = vehicleLabel;
        }

        if (reviewDecisionNotesLabel) {
            reviewDecisionNotesLabel.textContent = action === 'approve'
                ? 'Optional approval note (visible to submitter):'
                : 'Reason for rejection (visible to submitter):';
        }

        if (reviewDecisionNotes) {
            reviewDecisionNotes.value = '';
        }

        if (reviewDecisionConfirm) {
            reviewDecisionConfirm.textContent = action === 'approve' ? 'Approve' : 'Reject';
            reviewDecisionConfirm.className = 'hero-btn ' + (action === 'approve' ? 'primary approve' : 'reject');
        }

        reviewDecisionModal.hidden = false;
        document.body.classList.add('inventory-modal-open');

        if (reviewDecisionNotes) {
            window.requestAnimationFrame(function () {
                reviewDecisionNotes.focus();
            });
        }
    }

    function closeReviewDecision() {
        activeReviewEntry = null;
        activeReviewAction = null;
        if (reviewDecisionModal) {
            reviewDecisionModal.hidden = true;
        }
        document.body.classList.remove('inventory-modal-open');
    }

    function submitReviewDecision() {
        if (!activeReviewEntry || !activeReviewAction || !vehicleSubmissionSupabaseClient) {
            closeReviewDecision();
            return;
        }

        var notes = reviewDecisionNotes ? reviewDecisionNotes.value.trim() : '';
        var newStatus = activeReviewAction === 'approve' ? 'approved' : 'rejected';
        var newStatusLabel = activeReviewAction === 'approve' ? 'Approved' : 'Rejected';
        var entryId = activeReviewEntry.id;
        var entrySnapshot = activeReviewEntry;

        if (reviewDecisionConfirm) {
            reviewDecisionConfirm.disabled = true;
            reviewDecisionConfirm.textContent = activeReviewAction === 'approve' ? 'Approving...' : 'Rejecting...';
        }

        vehicleSubmissionSupabaseClient
            .from(VEHICLE_SUBMISSIONS_TABLE)
            .update({
                review_status: newStatus,
                status_label: newStatusLabel,
                review_notes: notes || null,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', entryId)
            .then(function (result) {
                if (result.error) {
                    throw result.error;
                }

                if (newStatus === 'approved') {
                    return upsertApprovedSubmissionToInventory(entrySnapshot);
                }

                return null;
            })
            .then(function () {

                closeReviewDecision();
                loadReviewQueue();
                loadInventoryData();
            })
            .catch(function (error) {
                console.error('Review decision failed:', error);
                if (reviewDecisionConfirm) {
                    reviewDecisionConfirm.disabled = false;
                    reviewDecisionConfirm.textContent = activeReviewAction === 'approve' ? 'Approve' : 'Reject';
                }
                alert('Could not save decision: ' + getSubmissionErrorMessage(error, 'Unknown error'));
            });
    }

    function loadReviewQueue() {
        if (!reviewQueueStatus || !reviewQueueList) {
            return Promise.resolve();
        }

        if (!initializeVehicleSubmissionSupabase()) {
            renderReviewQueue([], 'Supabase is not configured for vehicle review submissions yet.');
            return Promise.resolve();
        }

        reviewQueueStatus.textContent = 'Loading review queue...';

        return vehicleSubmissionSupabaseClient
            .from(VEHICLE_SUBMISSIONS_TABLE)
            .select('id, summary_label, year, make, model, vin, seller_name, seller_company, status_label, review_status, submitted_at')
            .eq('review_status', 'pending')
            .order('submitted_at', { ascending: false })
            .limit(8)
            .then(function (result) {
                if (result.error) {
                    throw result.error;
                }

                renderReviewQueue(result.data || [], (result.data || []).length ? 'These submissions are stored remotely and are waiting for moderation.' : 'Review queue is connected.');
            })
            .catch(function (error) {
                renderReviewQueue([], 'Could not load the review queue: ' + getSubmissionErrorMessage(error, 'Unknown error'));
            });
    }

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

    function getSubmissionPrimaryPhoto(payload) {
        var photos = payload && Array.isArray(payload.photos) ? payload.photos : [];

        if (!photos.length) {
            return '';
        }

        var photo = photos[0];
        if (!photo) {
            return '';
        }

        // Prefer rebuilding the URL from the stored path + current config.
        // The stored url may point to a deleted or old Supabase project.
        if (photo.path) {
            var config = getVehicleSubmissionConfig();
            if (config.url && config.bucket) {
                return config.url + '/storage/v1/object/public/' + config.bucket + '/' + photo.path;
            }
        }

        return photo.url || '';
    }

    function mapApprovedSubmissionToInventoryCar(entry) {
        var payload = entry && entry.submitted_payload && typeof entry.submitted_payload === 'object'
            ? entry.submitted_payload
            : {};
        var sellerName = entry.seller_company || entry.seller_name || payload.sellerCompanyName || payload.sellerContactName || 'Dealer';
        var estimateValue = Number.parseFloat(payload.estimateValue);
        var buyNowValue = Number.parseFloat(payload.reservePrice || payload.estimateValue || payload.startingBid);

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
            photo: getSubmissionPrimaryPhoto(payload),
            currentBid: Number.isFinite(estimateValue) ? Math.round(estimateValue) : 0,
            buyNowPrice: Number.isFinite(buyNowValue) ? Math.round(buyNowValue) : null,
            reservePrice: Number.isFinite(buyNowValue) ? Math.round(buyNowValue) : null,
            status: 'Sale',
            seller: sellerName,
            location: payload.pickupLocation || payload.pickupCity || 'Pending location review',
            pickup: payload.pickupLocation || payload.pickupCity || 'Pending location review',
            auctionEndAt: null,
            auctionStartAt: entry.submitted_at || null,
            inventoryStatusOverride: { label: 'Ready for Sale', className: 'ready-for-sale' }
        };
    }

    function mapApprovedSubmissionToInventoryRow(entry) {
        var payload = entry && entry.submitted_payload && typeof entry.submitted_payload === 'object'
            ? entry.submitted_payload
            : {};
        var estimateValue = Number.parseFloat(payload.estimateValue);
        var reserveValue = Number.parseFloat(payload.reservePrice || payload.startingBid || payload.estimateValue);
        var buyNowValue = Number.parseFloat(payload.buyNowPrice || payload.reservePrice || payload.estimateValue);

        return {
            id: 'submission-' + entry.id,
            vin: entry.vin || payload.vin || null,
            year: Number.parseInt(entry.year || payload.year, 10) || null,
            make: entry.make || payload.make || null,
            model: entry.model || payload.model || null,
            engine: payload.engine || null,
            transmission: payload.transmission || null,
            body_style: payload.bodyType || payload.bodyStyle || null,
            mileage: payload.mileage || null,
            condition: payload.titleStatus || 'Approved Submission',
            description: payload.description || 'Approved submission moved into live inventory.',
            photo: getSubmissionPrimaryPhoto(payload) || null,
            starting_bid: Number.isFinite(estimateValue) ? Math.round(estimateValue) : 0,
            current_bid: Number.isFinite(estimateValue) ? Math.round(estimateValue) : 0,
            reserve_price: Number.isFinite(reserveValue) ? Math.round(reserveValue) : null,
            buy_now_price: Number.isFinite(buyNowValue) ? Math.round(buyNowValue) : null,
            market_status: 'Sale',
            inventory_status: 'Active',
            listing_type: payload.listingType || null,
            time_remaining: '24:00:00',
            seller: entry.seller_company || entry.seller_name || payload.sellerCompanyName || payload.sellerContactName || 'Dealer',
            location: payload.pickupLocation || payload.pickupCity || null,
            pickup: payload.pickupLocation || payload.pickupCity || null,
            auction_start_at: entry.reviewed_at || entry.submitted_at || new Date().toISOString(),
            auction_end_at: null,
            is_demo: false,
            is_archived: false,
            updated_at: new Date().toISOString()
        };
    }

    function upsertApprovedSubmissionToInventory(entry) {
        if (!entry || !entry.id) {
            return Promise.reject(new Error('Missing submission entry for inventory upsert.'));
        }

        if (!initializeInventorySupabase()) {
            return Promise.reject(new Error('Supabase inventory client is not configured.'));
        }

        return inventorySupabaseClient
            .from(INVENTORY_VEHICLES_TABLE)
            .upsert(mapApprovedSubmissionToInventoryRow(entry), { onConflict: 'id' })
            .then(function (result) {
                if (result.error) {
                    throw result.error;
                }
                return true;
            });
    }

    function loadApprovedInventorySubmissions() {
        if (!initializeVehicleSubmissionSupabase()) {
            return Promise.resolve([]);
        }

        return vehicleSubmissionSupabaseClient
            .from(VEHICLE_SUBMISSIONS_TABLE)
            .select('id, vin, year, make, model, seller_name, seller_company, submitted_payload, review_status, reviewed_at, submitted_at')
            .eq('review_status', 'approved')
            .order('reviewed_at', { ascending: false })
            .then(function (result) {
                if (result.error) {
                    throw result.error;
                }

                return (result.data || []).map(mapApprovedSubmissionToInventoryCar);
            })
            .catch(function (error) {
                console.error('Could not load approved inventory submissions:', error);
                return [];
            });
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

    function getInventoryDays(car) {
        if (!car || !car.auctionStartAt) return null;
        var start = new Date(car.auctionStartAt);
        if (Number.isNaN(start.getTime())) return null;
        return Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
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
        if (car && car.inventoryStatusOverride && car.inventoryStatusOverride.label && car.inventoryStatusOverride.className) {
            // Remap legacy override labels to new three-status system
            var ol = (car.inventoryStatusOverride.label || '').toLowerCase();
            if (ol === 'sold') return { label: 'Sold', className: 'sold' };
            if (ol === 'ready for sale') return { label: 'Active', className: 'active' };
            return { label: 'Pending', className: 'pending' };
        }

        var auctionStatus = normalizeStatus(car.status, car);
        var hasCoreListingInfo = Boolean(
            car && car.photo && car.description && car.seller && car.location && car.pickup && car.condition
        );

        // Explicit Sold
        if (auctionStatus.className === 'sold') {
            return { label: 'Sold', className: 'sold' };
        }

        // Manual Pending hold
        if (String(car && car.status || '').trim().toLowerCase() === 'pending') {
            return { label: 'Pending', className: 'pending' };
        }

        // Incomplete listing data — Pending
        if (!hasCoreListingInfo || normalizeMileage(car.mileage) === '--') {
            return { label: 'Pending', className: 'pending' };
        }

        // Everything else is Active
        return { label: 'Active', className: 'active' };
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

    function buildCarDetailsHref(car) {
        var params = [
            'car=' + encodeURIComponent(car.id),
            'source=seller',
            'returnTo=' + encodeURIComponent('my-vehicles.html'),
            'returnLabel=' + encodeURIComponent('My Vehicles'),
            'v=20260427'
        ];

        if (car && car.submissionId) {
            params.push('sid=' + encodeURIComponent(car.submissionId));
        }

        return 'car-details.html?' + params.join('&');
    }

    function createVehicleCell(car) {
        var link = document.createElement('a');
        link.className = 'inventory-vehicle';
        link.href = buildCarDetailsHref(car);
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
        link.href = buildCarDetailsHref(car);
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
        var meta = getPaginationMeta(cars);
        updatePaginationControls(meta);

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

        meta.visibleCars.forEach(function (car) {
            var statusMeta = getInventoryStatus(car);
            var days = getInventoryDays(car);
            var row = document.createElement('tr');
            if (days !== null && days >= 60) {
                row.classList.add('row-danger');
            } else if (days !== null && days >= 40) {
                row.classList.add('row-warning');
            }

            var selectCell = document.createElement('td');
            var selectInput = document.createElement('input');
            selectInput.type = 'checkbox';
            selectInput.setAttribute('aria-label', 'Select ' + car.year + ' ' + car.make + ' ' + car.model);
            selectCell.appendChild(selectInput);

            var vehicleCell = document.createElement('td');
            vehicleCell.appendChild(createVehicleCell(car));

            var guaranteedCell = document.createElement('td');
            guaranteedCell.appendChild(createBuyNowEditor(car));

            var statusCell = document.createElement('td');
            var statusPill = document.createElement('span');
            statusPill.className = 'inventory-status ' + statusMeta.className;
            statusPill.textContent = statusMeta.label;
            statusCell.appendChild(statusPill);

            var daysCell = document.createElement('td');
            daysCell.textContent = days !== null ? String(days) : '--';

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
            row.appendChild(guaranteedCell);
            row.appendChild(statusCell);
            row.appendChild(daysCell);
            row.appendChild(dealerCell);
            row.appendChild(ageCell);
            row.appendChild(odometerCell);
            row.appendChild(expiryCell);
            row.appendChild(stockCell);
            row.appendChild(certifiedCell);
            tableBody.appendChild(row);
        });

        viewedCount.textContent = String(meta.visibleCars.length);
        rangeLabel.textContent = String(meta.startIndex + 1) + '-' + String(meta.endIndex) + ' of ' + String(meta.total);
    }

    function renderCards(cars) {
        inventoryCardGrid.textContent = '';
        var meta = getPaginationMeta(cars);
        updatePaginationControls(meta);

        if (!cars.length) {
            var emptyCard = document.createElement('article');
            emptyCard.className = 'inventory-card inventory-card-empty';
            emptyCard.textContent = 'No inventory vehicles match the selected filters.';
            inventoryCardGrid.appendChild(emptyCard);
            return;
        }

        meta.visibleCars.forEach(function (car) {
            var statusMeta = getInventoryStatus(car);
            var card = document.createElement('article');
            card.className = 'inventory-card';

            var header = document.createElement('div');
            header.className = 'inventory-card-header';
            header.appendChild(createCardVehicleCell(car, statusMeta));

            var metrics = document.createElement('div');
            metrics.className = 'inventory-card-metrics';

            [
                ['Buy Now', createBuyNowEditor(car)],
                ['Days in Inventory', days !== null ? String(days) : '--'],
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
        var meta = getPaginationMeta(cars);
        totalCount.textContent = String(meta.total);

        if (!meta.total) {
            viewedCount.textContent = '0';
            rangeLabel.textContent = '0-0 of 0';
            updatePaginationControls(meta);
            return;
        }

        viewedCount.textContent = String(meta.visibleCars.length);
        rangeLabel.textContent = String(meta.startIndex + 1) + '-' + String(meta.endIndex) + ' of ' + String(meta.total);
        updatePaginationControls(meta);
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
        rowsPerPageSelect.value = '50';
        currentPage = 1;
        renderFilterMenus();
        refreshInventoryView();
    }

    function loadInventoryData() {
        return Promise.all([
            loadInventoryCarsFromSupabase()
                .then(function (supabaseCars) {
                    if (Array.isArray(supabaseCars)) {
                        return supabaseCars;
                    }

                    return fetch('data/cars.json')
                        .then(function (response) {
                            if (!response.ok) {
                                throw new Error('HTTP ' + response.status);
                            }
                            return response.json();
                        })
                        .then(function (payload) {
                            return payload && Array.isArray(payload.cars) ? payload.cars : [];
                        })
                        .catch(function () {
                            return [];
                        });
                }),
            loadApprovedInventorySubmissions()
        ])
            .then(function (results) {
                var staticCars = Array.isArray(results[0]) ? results[0] : [];
                var approvedCars = Array.isArray(results[1]) ? results[1] : [];
                var seenIds = Object.create(null);
                var mergedCars = [];

                staticCars.concat(approvedCars).forEach(function (car) {
                    if (!car || !car.id || seenIds[car.id]) {
                        return;
                    }

                    seenIds[car.id] = true;
                    mergedCars.push(car);
                });

                allCars = applyStoredPriceOverrides(mergedCars);
                allCars.sort(function (a, b) {
                    var aSold = (a.status || '').toLowerCase() === 'sold' ? 1 : 0;
                    var bSold = (b.status || '').toLowerCase() === 'sold' ? 1 : 0;
                    return aSold - bSold;
                });
                renderFilterMenus();
                refreshInventoryView();
                return allCars;
            })
            .catch(function () {
                allCars = [];
                renderFilterMenus();
                refreshInventoryView();
                return [];
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
        currentPage = 1;
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

    if (paginationPrevButton) {
        paginationPrevButton.addEventListener('click', function () {
            currentPage = Math.max(1, currentPage - 1);
            refreshInventoryView();
        });
    }

    if (paginationNextButton) {
        paginationNextButton.addEventListener('click', function () {
            currentPage += 1;
            refreshInventoryView();
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

    if (reviewDecisionCancel) {
        reviewDecisionCancel.addEventListener('click', closeReviewDecision);
    }

    if (reviewDecisionClose) {
        reviewDecisionClose.addEventListener('click', closeReviewDecision);
    }

    if (reviewDecisionConfirm) {
        reviewDecisionConfirm.addEventListener('click', submitReviewDecision);
    }

    if (reviewDecisionModal) {
        reviewDecisionModal.addEventListener('click', function (event) {
            if (event.target === reviewDecisionModal || event.target.hasAttribute('data-close-review-decision')) {
                closeReviewDecision();
            }
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && reviewDecisionModal && !reviewDecisionModal.hidden) {
            closeReviewDecision();
        }
    });

    loadInventoryData();
    loadReviewQueue();
}());
