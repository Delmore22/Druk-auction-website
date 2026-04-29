(function () {
    'use strict';

    var PARTIALS = [
        { id: 'header-placeholder',       file: 'partials/header.html' },
        { id: 'below-header-placeholder', file: 'partials/below-header.html' },
        { id: 'left-sidebar-placeholder', file: 'partials/left-sidebar.html' },
        { id: 'footer-placeholder',       file: 'partials/footer.html' }
    ];

    function fetchPartial(id, file) {
        var placeholder = document.getElementById(id);
        if (!placeholder) {
            return Promise.resolve();
        }

        return fetch(file)
            .then(function (res) {
                if (!res.ok) {
                    console.error('Failed to load partial "' + file + '": HTTP ' + res.status);
                    return '';
                }
                return res.text();
            })
            .then(function (html) {
                if (!html) return;
                if (placeholder) {
                    placeholder.outerHTML = html;
                }
            });
    }

    var stickyOffsetFrame = 0;

    function updateStickyOffsets() {
        var header = document.querySelector('.top-header');
        if (!header) return;
        document.documentElement.style.setProperty(
            '--top-header-height',
            header.offsetHeight + 'px'
        );
    }

    function requestStickyOffsetsUpdate() {
        if (stickyOffsetFrame) return;
        stickyOffsetFrame = requestAnimationFrame(function () {
            stickyOffsetFrame = 0;
            updateStickyOffsets();
        });
    }

    function storageGet(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (err) {
            return null;
        }
    }

    function storageSet(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (err) {
            // Ignore storage failures so UI behavior still works.
        }
    }

    var SAVED_ADVANCED_SEARCHES_KEY = 'savedAdvancedSearchesV1';
    var PENDING_ADVANCED_SEARCH_KEY = 'pendingAdvancedSearchV1';

    function isDashboardPage() {
        return document.body && document.body.dataset && document.body.dataset.page === 'dashboard';
    }

    function getOrCreateAdvancedSearchModal() {
        var existing = document.getElementById('advanceSearchesModal');
        if (existing) return existing;

        var wrapper = document.createElement('div');
        wrapper.innerHTML =
            '<div id="advanceSearchesModal" class="advance-searches-modal" hidden>' +
                '<div class="advance-searches-overlay"></div>' +
                '<div class="advance-searches-content">' +
                    '<div class="advance-searches-header">' +
                        '<h2>Advanced Search</h2>' +
                        '<button type="button" class="modal-close-btn" aria-label="Close advanced search" id="closeAdvanceSearchesBtn">' +
                            '<i class="fa-solid fa-times" aria-hidden="true"></i>' +
                        '</button>' +
                    '</div>' +
                    '<div class="advance-searches-body">' +
                        '<fieldset class="search-fieldset">' +
                            '<legend>Vehicle Information</legend>' +
                            '<div class="search-grid">' +
                                '<div class="search-field"><label for="advYear">Year Range</label><select id="advYear" class="search-input"><option value="">All Years</option><option value="1950-1960">1950-1960</option><option value="1961-1970">1961-1970</option><option value="1971-1980">1971-1980</option><option value="1980+">1980+</option></select></div>' +
                                '<div class="search-field"><label for="advMake">Manufacturer</label><select id="advMake" class="search-input"><option value="">All Makes</option><option value="ford">Ford</option><option value="chevrolet">Chevrolet</option><option value="cadillac">Cadillac</option><option value="porsche">Porsche</option><option value="jaguar">Jaguar</option></select></div>' +
                                '<div class="search-field"><label for="advModel">Model</label><input type="text" id="advModel" class="search-input" placeholder="e.g., Mustang, Bel Air"></div>' +
                                '<div class="search-field"><label for="advVin">Vehicle ID (VIN)</label><input type="text" id="advVin" class="search-input" placeholder="Full or partial VIN"></div>' +
                            '</div>' +
                        '</fieldset>' +
                        '<fieldset class="search-fieldset">' +
                            '<legend>Pricing &amp; Auction Details</legend>' +
                            '<div class="search-grid">' +
                                '<div class="search-field"><label for="advMinBid">Minimum Bid Range</label><select id="advMinBid" class="search-input"><option value="">Any</option><option value="0-25000">$0 - $25k</option><option value="25000-50000">$25k - $50k</option><option value="50000-100000">$50k - $100k</option><option value="100000+">$100k+</option></select></div>' +
                                '<div class="search-field"><label for="advAuctionFormat">Sale Format</label><select id="advAuctionFormat" class="search-input"><option value="">All Formats</option><option value="live">Live Auction</option><option value="buynow">Buy Now Available</option><option value="sealed">Sealed Bid</option></select></div>' +
                                '<div class="search-field"><label for="advListingStatus">Listing Status</label><select id="advListingStatus" class="search-input"><option value="">All</option><option value="active">Active</option><option value="upcoming">Upcoming</option><option value="closed">Recently Closed</option></select></div>' +
                                '<div class="search-field"><label for="advSeller">Seller Name</label><input type="text" id="advSeller" class="search-input" placeholder="Filter by dealer"></div>' +
                            '</div>' +
                        '</fieldset>' +
                        '<fieldset class="search-fieldset">' +
                            '<legend>Mechanical Specifications</legend>' +
                            '<div class="search-grid">' +
                                '<div class="search-field"><label for="advEngine">Engine Type</label><select id="advEngine" class="search-input"><option value="">All Engines</option><option value="v8">V8</option><option value="v6">V6</option><option value="inline6">Inline-6</option><option value="v12">V12</option></select></div>' +
                                '<div class="search-field"><label for="advTransmission">Transmission</label><select id="advTransmission" class="search-input"><option value="">All Types</option><option value="manual">Manual</option><option value="automatic">Automatic</option><option value="3speed">3-Speed</option><option value="4speed">4-Speed</option></select></div>' +
                                '<div class="search-field"><label for="advDrivetrain">Drivetrain</label><select id="advDrivetrain" class="search-input"><option value="">All Types</option><option value="rwd">Rear-Wheel Drive</option><option value="awd">All-Wheel Drive</option></select></div>' +
                                '<div class="search-field"><label for="advMileage">Mileage Range</label><select id="advMileage" class="search-input"><option value="">Any</option><option value="0-25000">Under 25k miles</option><option value="25000-75000">25k - 75k miles</option><option value="75000+">Over 75k miles</option></select></div>' +
                            '</div>' +
                        '</fieldset>' +
                        '<fieldset class="search-fieldset">' +
                            '<legend>Condition &amp; Features</legend>' +
                            '<div class="search-grid">' +
                                '<div class="search-field"><label for="advCondition">Overall Condition</label><select id="advCondition" class="search-input"><option value="">All Conditions</option><option value="excellent">Excellent</option><option value="very-good">Very Good</option><option value="good">Good</option><option value="restored">Fully Restored</option><option value="survivor">Original Survivor</option></select></div>' +
                                '<div class="search-field"><label for="advColor">Exterior Color</label><input type="text" id="advColor" class="search-input" placeholder="e.g., Blue, Red"></div>' +
                                '<div class="search-field"><label for="advInterior">Interior Color</label><input type="text" id="advInterior" class="search-input" placeholder="e.g., Leather Black"></div>' +
                            '</div>' +
                            '<div class="search-checkboxes">' +
                                '<label class="search-checkbox"><input type="checkbox" value="powertop"> Power Top</label>' +
                                '<label class="search-checkbox"><input type="checkbox" value="powerwheels"> Power Windows</label>' +
                                '<label class="search-checkbox"><input type="checkbox" value="aircon"> Air Conditioning</label>' +
                                '<label class="search-checkbox"><input type="checkbox" value="numbermatch"> Numbers Matching</label>' +
                            '</div>' +
                        '</fieldset>' +
                    '</div>' +
                    '<div class="advance-searches-footer">' +
                        '<div class="advance-searches-save-name"><label for="advSearchLabel">Saved search name</label><input type="text" id="advSearchLabel" class="search-input" placeholder="e.g., Weekend Muscle Cars"></div>' +
                        '<button type="button" class="search-action-btn clear" id="clearAdvanceFiltersBtn">Clear All</button>' +
                        '<button type="button" class="search-action-btn save" id="saveAdvanceFiltersBtn">Save &amp; Search</button>' +
                        '<button type="button" class="search-action-btn search" id="applyAdvanceFiltersBtn">Apply Search</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        var modal = wrapper.firstChild;
        document.body.appendChild(modal);
        return modal;
    }

    function getAdvancedSearchFiltersFromModal(modal) {
        function value(id) {
            var input = modal.querySelector('#' + id);
            return input ? input.value : '';
        }

        return {
            year: value('advYear'),
            make: value('advMake'),
            model: value('advModel'),
            vin: value('advVin'),
            minBid: value('advMinBid'),
            auctionFormat: value('advAuctionFormat'),
            listingStatus: value('advListingStatus'),
            seller: value('advSeller'),
            engine: value('advEngine'),
            transmission: value('advTransmission'),
            drivetrain: value('advDrivetrain'),
            mileage: value('advMileage'),
            condition: value('advCondition'),
            color: value('advColor'),
            interior: value('advInterior'),
            equipment: Array.prototype.slice.call(modal.querySelectorAll('.search-checkboxes input[type="checkbox"]:checked')).map(function (el) {
                return el.value;
            })
        };
    }

    function resetAdvancedSearchModal(modal) {
        ['advYear','advMake','advModel','advVin','advMinBid','advAuctionFormat','advListingStatus','advSeller','advEngine','advTransmission','advDrivetrain','advMileage','advCondition','advColor','advInterior','advSearchLabel'].forEach(function (id) {
            var input = modal.querySelector('#' + id);
            if (input) input.value = '';
        });

        Array.prototype.forEach.call(modal.querySelectorAll('.search-checkboxes input[type="checkbox"]'), function (checkbox) {
            checkbox.checked = false;
        });
    }

    function getSavedAdvancedSearches() {
        var raw = storageGet(SAVED_ADVANCED_SEARCHES_KEY);
        if (!raw) return [];
        try {
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            return [];
        }
    }

    function saveSavedAdvancedSearches(list) {
        storageSet(SAVED_ADVANCED_SEARCHES_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    }

    function savePendingAdvancedSearch(filters) {
        storageSet(PENDING_ADVANCED_SEARCH_KEY, JSON.stringify({ filters: filters, createdAt: Date.now() }));
    }

    function navigateToDashboard() {
        var dashboardUrl = new URL('car-dashboard.html', window.location.href);
        window.location.href = dashboardUrl.pathname + dashboardUrl.search + dashboardUrl.hash;
    }

    function initializeGlobalAdvancedSearchModal() {
        var modal = getOrCreateAdvancedSearchModal();
        if (!modal || modal.dataset.globalBound === '1') return;
        modal.dataset.globalBound = '1';

        if (isDashboardPage()) {
            return;
        }

        var overlay = modal.querySelector('.advance-searches-overlay');
        var closeBtn = modal.querySelector('#closeAdvanceSearchesBtn');
        var applyBtn = modal.querySelector('#applyAdvanceFiltersBtn');
        var clearBtn = modal.querySelector('#clearAdvanceFiltersBtn');
        var saveBtn = modal.querySelector('#saveAdvanceFiltersBtn');
        var saveNameInput = modal.querySelector('#advSearchLabel');

        function setSubmittingState(actionLabel) {
            modal.classList.add('is-submitting');
            if (applyBtn) applyBtn.disabled = true;
            if (saveBtn) saveBtn.disabled = true;
            if (clearBtn) clearBtn.disabled = true;
            if (closeBtn) closeBtn.disabled = true;
            if (overlay) overlay.style.pointerEvents = 'none';

            if (actionLabel === 'apply' && applyBtn) {
                applyBtn.textContent = 'Opening Results...';
            }

            if (actionLabel === 'save' && saveBtn) {
                saveBtn.textContent = 'Saving & Opening...';
            }
        }

        function openModal() {
            modal.removeAttribute('hidden');
        }

        function closeModal() {
            modal.setAttribute('hidden', '');
        }

        document.addEventListener('click', function (event) {
            var trigger = event.target.closest('#openAdvanceSearchesBtn');
            if (!trigger) return;
            event.preventDefault();
            openModal();
        });

        if (overlay) overlay.addEventListener('click', closeModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !modal.hasAttribute('hidden')) {
                closeModal();
            }
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                resetAdvancedSearchModal(modal);
            });
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', function () {
                var filters = getAdvancedSearchFiltersFromModal(modal);
                setSubmittingState('apply');
                savePendingAdvancedSearch(filters);
                navigateToDashboard();
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                var filters = getAdvancedSearchFiltersFromModal(modal);
                var typedLabel = saveNameInput ? String(saveNameInput.value || '').trim() : '';
                var label = typedLabel || ('Saved search ' + new Date().toLocaleString());

                var savedSearches = getSavedAdvancedSearches();
                savedSearches.unshift({
                    id: 'adv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                    label: label,
                    filters: filters,
                    createdAt: new Date().toISOString()
                });
                saveSavedAdvancedSearches(savedSearches.slice(0, 40));

                setSubmittingState('save');
                savePendingAdvancedSearch(filters);
                navigateToDashboard();
            });
        }
    }

    var SEARCH_UI_STATE_KEY = 'auctionSearchUiState';

    function normalizeSearchUiState(rawState) {
        var source = rawState || {};
        var filters = source.filters || {};

        function normalizeGroup(groupName) {
            var values = filters[groupName];
            return Array.isArray(values) ? values.filter(function (value) {
                return typeof value === 'string' && value.length > 0;
            }) : [];
        }

        return {
            query: typeof source.query === 'string' ? source.query : '',
            filters: {
                make: normalizeGroup('make'),
                engine: normalizeGroup('engine'),
                body: normalizeGroup('body')
            }
        };
    }

    window.getAuctionSearchUiState = function () {
        var raw = storageGet(SEARCH_UI_STATE_KEY);
        if (!raw) {
            return normalizeSearchUiState();
        }

        try {
            return normalizeSearchUiState(JSON.parse(raw));
        } catch (err) {
            return normalizeSearchUiState();
        }
    };

    window.setAuctionSearchUiState = function (state) {
        storageSet(SEARCH_UI_STATE_KEY, JSON.stringify(normalizeSearchUiState(state)));
    };

    function isUiDebugEnabled() {
        var params = new URLSearchParams(window.location.search);
        if (params.get('debugUI') === '1') return true;
        if (window.__UI_DEBUG__ === true) return true;
        return storageGet('uiDebug') === 'true';
    }

    function debugUiState(source) {
        if (!isUiDebugEnabled()) return;
        console.log('[ui-debug][' + source + ']', {
            theme: storageGet('theme'),
            leftSidebarCollapsed: storageGet('leftSidebarCollapsed'),
            rightSidebarCollapsed: storageGet('rightSidebarCollapsed')
        });
    }

    function initThemeToggle() {
        var btn = document.getElementById('theme-toggle');
        if (!btn) return;
        function setThemeToggleIcon(isDark) {
            btn.textContent = '';
            var icon = document.createElement('i');
            icon.className = isDark ? 'fa-solid fa-moon' : 'fa-regular fa-sun';
            icon.setAttribute('aria-hidden', 'true');
            btn.appendChild(icon);
            btn.setAttribute('aria-label', isDark ? 'Dark theme active' : 'Light theme active');
            btn.setAttribute('title', isDark ? 'Dark theme active' : 'Light theme active');
        }
        // Apply saved theme preference
        var savedTheme = storageGet('theme');
        if (savedTheme === 'light') {
            document.body.classList.remove('dark-theme');
        } else if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
        }
        setThemeToggleIcon(document.body.classList.contains('dark-theme'));
        btn.addEventListener('click', function () {
            document.body.classList.toggle('dark-theme');
            var isDark = document.body.classList.contains('dark-theme');
            storageSet('theme', isDark ? 'dark' : 'light');
            setThemeToggleIcon(isDark);
        });

        // Sync theme across tabs: when another tab saves a new theme, apply it here.
        window.addEventListener('storage', function (event) {
            if (event.key !== 'theme') return;
            var isDark = event.newValue === 'dark';
            document.body.classList.toggle('dark-theme', isDark);
            setThemeToggleIcon(isDark);
        });
    }

    function initSidebarState() {
        var leftSidebar = document.getElementById('leftSidebar');
        var leftArrow   = document.getElementById('leftArrow');
        if (leftSidebar && storageGet('leftSidebarCollapsed') === 'true') {
            leftSidebar.classList.add('collapsed');
            if (leftArrow) leftArrow.textContent = '▶';
        }
        var rightSidebar = document.getElementById('rightSidebar');
        if (rightSidebar && storageGet('rightSidebarCollapsed') === 'true') {
            rightSidebar.classList.add('collapsed');
        }
    }

    function initActiveNav() {
        var page = document.body.dataset.page;
        if (!page) return;
        var item = document.querySelector('.nav-item[data-page="' + page + '"]');
        if (item) item.classList.add('active');
    }

    function initShrinkingHeader() {
        var header = document.querySelector('.top-header');
        if (!header) return;
        var mainContent = document.querySelector('.main-content');
        header.addEventListener('transitionend', requestStickyOffsetsUpdate);
        // Keep sticky offsets in sync while header height animates.
        if ('ResizeObserver' in window) {
            var headerResizeObserver = new ResizeObserver(requestStickyOffsetsUpdate);
            headerResizeObserver.observe(header);
        }

        var ticking = false;

        function applyState() {
            // Sum both — only one is ever non-zero at a time, covering all layout cases.
            var scrollTop = (window.scrollY || 0) + (mainContent ? mainContent.scrollTop : 0);
            var isShrunk = header.classList.contains('shrunk');
            if (!isShrunk && scrollTop > 30) {
                header.classList.add('shrunk');
                requestStickyOffsetsUpdate();
            } else if (isShrunk && scrollTop < 2) {
                header.classList.remove('shrunk');
                requestStickyOffsetsUpdate();
            }
            ticking = false;
        }

        function onScroll() {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(applyState);
        }

        // Listen on both — whichever is the real scroll container will fire.
        window.addEventListener('scroll', onScroll, { passive: true });
        if (mainContent) mainContent.addEventListener('scroll', onScroll, { passive: true });
    }

    function initSmoothAnchorScroll() {
        document.addEventListener('click', function (event) {
            var trigger = event.target.closest('a[href*="#"]');
            if (!trigger) return;

            var href = trigger.getAttribute('href');
            if (!href || href === '#') return;

            var url;
            try {
                url = new URL(trigger.href, window.location.href);
            } catch (err) {
                return;
            }

            if (!url.hash) return;
            if (url.pathname !== window.location.pathname || url.search !== window.location.search) return;

            var targetId = decodeURIComponent(url.hash.slice(1));
            if (!targetId) return;

            var target = document.getElementById(targetId);
            if (!target) return;

            event.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (window.history && window.history.pushState) {
                window.history.pushState(null, '', '#' + encodeURIComponent(targetId));
            } else {
                window.location.hash = targetId;
            }
        });
    }

    function initRightSidebarSectionTracking() {
        var sidebar = document.getElementById('rightSidebar');
        if (!sidebar) return;

        var links = Array.prototype.slice.call(
            sidebar.querySelectorAll('a.quick-action[href*="#"], a.collapsed-icon[href*="#"]')
        );
        if (!links.length) return;

        var tracked = links.map(function (link) {
            var url;
            try {
                url = new URL(link.href, window.location.href);
            } catch (err) {
                return null;
            }

            if (!url.hash) return null;
            if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
                return null;
            }

            var targetId = decodeURIComponent(url.hash.slice(1));
            if (!targetId) return null;

            var target = document.getElementById(targetId);
            if (!target) return null;

            return {
                link: link,
                targetId: targetId,
                target: target
            };
        }).filter(Boolean);

        if (!tracked.length) return;

        var uniqueTargets = [];
        var seenTargetIds = {};
        tracked.forEach(function (item) {
            if (!seenTargetIds[item.targetId]) {
                seenTargetIds[item.targetId] = true;
                uniqueTargets.push({
                    id: item.targetId,
                    element: item.target
                });
            }
        });

        function setActive(targetId) {
            tracked.forEach(function (item) {
                var isActive = item.targetId === targetId;
                item.link.classList.toggle('is-active', isActive);
                if (isActive) {
                    item.link.setAttribute('aria-current', 'location');
                } else {
                    item.link.removeAttribute('aria-current');
                }
            });
        }

        function pickActiveTarget() {
            var anchorOffset = 150;
            var containingCandidate = null;
            var upcomingCandidate = null;
            var passedCandidate = null;

            uniqueTargets.forEach(function (target) {
                var rect = target.element.getBoundingClientRect();
                if (rect.top <= anchorOffset && rect.bottom >= anchorOffset) {
                    var containingScore = anchorOffset - rect.top;
                    if (!containingCandidate || containingScore < containingCandidate.score) {
                        containingCandidate = { id: target.id, score: containingScore };
                    }
                    return;
                }

                if (rect.top > anchorOffset) {
                    var upcomingScore = rect.top - anchorOffset;
                    if (!upcomingCandidate || upcomingScore < upcomingCandidate.score) {
                        upcomingCandidate = { id: target.id, score: upcomingScore };
                    }
                    return;
                }

                var passedScore = anchorOffset - rect.bottom;
                if (!passedCandidate || passedScore < passedCandidate.score) {
                    passedCandidate = { id: target.id, score: passedScore };
                }
            });

            if (containingCandidate) {
                return containingCandidate.id;
            }

            if (upcomingCandidate) {
                return upcomingCandidate.id;
            }

            if (passedCandidate) {
                return passedCandidate.id;
            }

            return null;
        }

        var ticking = false;
        function requestUpdate() {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                setActive(pickActiveTarget());
                ticking = false;
            });
        }

        var mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.addEventListener('scroll', requestUpdate, { passive: true });
        }
        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);

        requestUpdate();
    }

    function initActionButtons() {
        document.addEventListener('click', function (event) {
            var actionButton = event.target.closest('button[data-action]');
            if (!actionButton) return;

            var action = actionButton.getAttribute('data-action');
            if (action === 'toggle-left-sidebar') {
                window.toggleLeftSidebar();
                return;
            }

            if (action === 'toggle-right-sidebar') {
                window.toggleRightSidebar();
            }
        });
    }

    function initAdvanceSearchesShortcut() {
        initializeGlobalAdvancedSearchModal();
    }

    function initHeaderUserName() {
        var nameEl   = document.getElementById('headerUserName');
        var avatarEl = document.getElementById('headerUserAvatar');
        var nameDropdownEl = document.getElementById('headerUserNameDropdown');
        var emailEl = document.getElementById('headerUserEmail');
        var roleEl = document.getElementById('headerUserRole');
        if (!nameEl) return;

        function applyName(name) {
            if (!name || !name.trim()) return;
            nameEl.textContent = name.trim();
            if (nameDropdownEl) {
                nameDropdownEl.textContent = name.trim();
            }
            if (avatarEl) {
                var parts = name.trim().split(/\s+/);
                var initials = parts.length >= 2
                    ? parts[0][0] + parts[parts.length - 1][0]
                    : parts[0].slice(0, 2);
                avatarEl.textContent = initials.toUpperCase();
            }
        }

        function applyRole(role) {
            if (!roleEl) return;
            if (!role || !role.trim()) {
                roleEl.textContent = 'Member';
                return;
            }
            roleEl.textContent = role.charAt(0).toUpperCase() + role.slice(1);
        }

        function applyEmail(email) {
            if (!emailEl) return;
            if (!email || !email.trim()) {
                emailEl.textContent = 'No email available';
                return;
            }
            emailEl.textContent = email.trim();
        }

        var storedEmail = storageGet('accountEmail') || '';
        var fallbackName = storedEmail ? storedEmail.split('@')[0].replace(/[._-]+/g, ' ') : '';
        applyName(storageGet('accountName') || fallbackName || 'John Dealer');
        applyEmail(storedEmail || 'john.dealer@example.com');
        applyRole(storageGet('accountRole') || 'member');

        // Update immediately if settings page saves in another tab
        window.addEventListener('storage', function (e) {
            if (e.key === 'accountName') applyName(e.newValue);
            if (e.key === 'accountEmail') applyEmail(e.newValue);
            if (e.key === 'accountRole') applyRole(e.newValue);
        });
    }

    function initUserMenu() {
        var trigger = document.getElementById('userMenuTrigger');
        var dropdown = document.getElementById('userDropdown');
        var logoutLink = document.getElementById('userMenuLogout');
        if (!trigger || !dropdown) return;
        dropdown.hidden = true;

        function openMenu() {
            trigger.setAttribute('aria-expanded', 'true');
            dropdown.hidden = false;
        }
        function closeMenu() {
            trigger.setAttribute('aria-expanded', 'false');
            dropdown.hidden = true;
        }
        function toggleMenu() {
            trigger.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu();
        }

        trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleMenu();
        });

        trigger.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleMenu();
            } else if (e.key === 'Escape') {
                closeMenu();
            }
        });

        document.addEventListener('click', function (e) {
            if (!trigger.contains(e.target)) closeMenu();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeMenu();
        });

        if (logoutLink) {
            logoutLink.addEventListener('click', function () {
                try {
                    window.localStorage.removeItem('accountName');
                    window.localStorage.removeItem('accountEmail');
                    window.localStorage.removeItem('accountRole');
                } catch (err) {
                    // Ignore storage failures and continue to logout redirect.
                }
            });
        }
    }

    function initComponents() {
        requestStickyOffsetsUpdate();
        window.addEventListener('resize', requestStickyOffsetsUpdate);
        initActionButtons();
        initAdvanceSearchesShortcut();
        initThemeToggle();
        initHeaderUserName();
        initUserMenu();
        initActiveNav();
        initSidebarState();
        initShrinkingHeader();
        initSmoothAnchorScroll();
        initRightSidebarSectionTracking();
        debugUiState('init');
    }

    // Global sidebar toggles shared by all pages
    window.toggleLeftSidebar = function () {
        var sidebar = document.getElementById('leftSidebar');
        var arrow   = document.getElementById('leftArrow');
        if (!sidebar) return;
        if (sidebar.dataset.sidebarAnimating === '1') return;

        var isCollapsed = sidebar.classList.contains('collapsed');
        sidebar.dataset.sidebarAnimating = '1';

        function finish() {
            sidebar.dataset.sidebarAnimating = '0';
            sidebar.classList.remove('is-expanding');
            sidebar.removeEventListener('transitionend', onTransitionEnd);
        }

        function onTransitionEnd(event) {
            if (event.target !== sidebar || event.propertyName !== 'width') return;
            finish();
        }

        if (isCollapsed) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('is-expanding');
            if (arrow) arrow.textContent = '◀';
            storageSet('leftSidebarCollapsed', 'false');
            sidebar.addEventListener('transitionend', onTransitionEnd);
            window.setTimeout(finish, 350);
        } else {
            sidebar.classList.add('collapsed');
            if (arrow) arrow.textContent = '▶';
            storageSet('leftSidebarCollapsed', 'true');
            window.setTimeout(finish, 0);
        }

        debugUiState('toggleLeftSidebar');
    };

    window.toggleRightSidebar = function () {
        var sidebar = document.getElementById('rightSidebar');
        var arrow   = document.getElementById('rightArrow');
        if (!sidebar) return;
        if (sidebar.dataset.sidebarAnimating === '1') return;

        var isCollapsed = sidebar.classList.contains('collapsed');
        sidebar.dataset.sidebarAnimating = '1';

        function finish() {
            sidebar.dataset.sidebarAnimating = '0';
            sidebar.classList.remove('is-expanding');
            sidebar.removeEventListener('transitionend', onTransitionEnd);
        }

        function onTransitionEnd(event) {
            if (event.target !== sidebar || event.propertyName !== 'width') return;
            finish();
        }

        if (isCollapsed) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('is-expanding');
            if (arrow) arrow.textContent = '▶';
            storageSet('rightSidebarCollapsed', 'false');
            sidebar.addEventListener('transitionend', onTransitionEnd);
            window.setTimeout(finish, 350);
        } else {
            sidebar.classList.add('collapsed');
            if (arrow) arrow.textContent = '◀';
            storageSet('rightSidebarCollapsed', 'true');
            window.setTimeout(finish, 0);
        }

        debugUiState('toggleRightSidebar');
    };

    function init() {
        Promise.all(PARTIALS.map(function (p) {
            return fetchPartial(p.id, p.file);
        })).then(function () {
            initComponents();
            document.dispatchEvent(new CustomEvent('components:ready'));
        }).catch(function (err) {
            console.error('Component loading error:', err);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// ========== Vehicle Gallery Sources (shared across dashboard/details) ==========
(function () {
    'use strict';

    function getVehicleGallerySources(car) {
        var primary = String((car && car.photo) || ('cars-photos/' + ((car && car.id) || '') + '.png')).trim();
        var explicitGallery = Array.isArray(car && car.photos) ? car.photos : [];
        var inferredGallery = [];

        // Legacy demo compatibility: Mustang has file-based gallery assets.
        if (car && car.id === '1967-ford-mustang-fastback') {
            ['02', '03', '04', '05', '06', '07', '08', '09'].forEach(function (suffix) {
                inferredGallery.push('cars-photos/1967-ford-mustang-fastback-' + suffix + '.png');
            });
        }

        return Array.from(new Set([primary].concat(explicitGallery, inferredGallery).filter(Boolean)));
    }

    window.getVehicleGallerySources = getVehicleGallerySources;
})();

// ========== Favorites (shared across dashboard and details pages) ==========
(function () {
    'use strict';

    var FAVORITES_KEY = 'dashboardFavoritesV1';
    var favSupabaseClient = null;

    function getFavSupabaseClient() {
        if (favSupabaseClient) return favSupabaseClient;
        var config = window.INVENTORY_SUPABASE_CONFIG || window.ADD_VEHICLE_SUPABASE_CONFIG || {};
        if (!config.url || !config.anonKey) return null;
        if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
        favSupabaseClient = window.supabase.createClient(config.url, config.anonKey);
        return favSupabaseClient;
    }

    function getCurrentUserId() {
        try { return window.localStorage.getItem('accountUserId') || null; } catch (e) { return null; }
    }

    function getFavorites() {
        try {
            var raw = window.localStorage.getItem(FAVORITES_KEY);
            var parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }

    function saveFavorites(ids) {
        try {
            window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
        } catch (e) {}
    }

    function isFavorite(carId) {
        return getFavorites().indexOf(carId) !== -1;
    }

    function toggleFavorite(carId) {
        var favs = getFavorites();
        var idx = favs.indexOf(carId);
        var nowFavorited = idx === -1;
        if (nowFavorited) {
            favs.push(carId);
        } else {
            favs.splice(idx, 1);
        }
        saveFavorites(favs);

        // Sync to Supabase in the background
        var userId = getCurrentUserId();
        var client = getFavSupabaseClient();
        if (userId && client) {
            if (nowFavorited) {
                client.from('user_favorites').insert({ user_id: userId, vehicle_id: carId }).then(function () {});
            } else {
                client.from('user_favorites').delete().eq('user_id', userId).eq('vehicle_id', carId).then(function () {});
            }
        }

        return nowFavorited; // true = now favorited
    }

    function loadFavoritesFromSupabase() {
        var userId = getCurrentUserId();
        var client = getFavSupabaseClient();
        if (!userId || !client) return;

        client.from('user_favorites').select('vehicle_id').eq('user_id', userId).then(function (result) {
            if (result.error || !Array.isArray(result.data)) return;
            var remoteIds = result.data.map(function (r) { return r.vehicle_id; });
            // Merge remote with any local ids (preserves offline toggles)
            var local = getFavorites();
            var merged = remoteIds.slice();
            local.forEach(function (id) {
                if (merged.indexOf(id) === -1) merged.push(id);
            });
            saveFavorites(merged);
            // Refresh any rendered fav buttons on the page
            merged.forEach(function (id) {
                document.querySelectorAll('.fav-btn[data-car-id="' + id + '"]').forEach(function (btn) {
                    btn.classList.add('is-favorited');
                    btn.setAttribute('aria-pressed', 'true');
                    btn.setAttribute('aria-label', 'Remove from favorites');
                    var icon = btn.querySelector('i');
                    if (icon) icon.className = 'fas fa-heart';
                });
            });
        });
    }

    function createFavoriteBtn(carId) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fav-btn' + (isFavorite(carId) ? ' is-favorited' : '');
        btn.setAttribute('aria-label', isFavorite(carId) ? 'Remove from favorites' : 'Add to favorites');
        btn.setAttribute('aria-pressed', isFavorite(carId) ? 'true' : 'false');
        btn.innerHTML = '<i class="' + (isFavorite(carId) ? 'fas' : 'far') + ' fa-heart" aria-hidden="true"></i>';
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var nowFav = toggleFavorite(carId);
            btn.classList.toggle('is-favorited', nowFav);
            btn.setAttribute('aria-pressed', nowFav ? 'true' : 'false');
            btn.setAttribute('aria-label', nowFav ? 'Remove from favorites' : 'Add to favorites');
            btn.querySelector('i').className = (nowFav ? 'fas' : 'far') + ' fa-heart';
            btn.classList.add('fav-btn-pulse');
            btn.addEventListener('animationend', function () {
                btn.classList.remove('fav-btn-pulse');
            }, { once: true });
            // Sync all other fav buttons for the same car on the page
            document.querySelectorAll('.fav-btn[data-car-id="' + carId + '"]').forEach(function (other) {
                if (other === btn) return;
                other.classList.toggle('is-favorited', nowFav);
                other.setAttribute('aria-pressed', nowFav ? 'true' : 'false');
                other.setAttribute('aria-label', nowFav ? 'Remove from favorites' : 'Add to favorites');
                other.querySelector('i').className = (nowFav ? 'fas' : 'far') + ' fa-heart';
            });
        });
        btn.dataset.carId = carId;
        return btn;
    }

    window.getFavorites = getFavorites;
    window.saveFavorites = saveFavorites;
    window.isFavorite = isFavorite;
    window.toggleFavorite = toggleFavorite;
    window.createFavoriteBtn = createFavoriteBtn;
    window.loadFavoritesFromSupabase = loadFavoritesFromSupabase;

    // Auto-sync from Supabase when the page loads (after a short delay so the
    // Supabase client scripts have had a chance to execute)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { loadFavoritesFromSupabase(); });
    } else {
        setTimeout(loadFavoritesFromSupabase, 0);
    }
})();

// ========== Buy Now Tooltip (body-level, escapes all overflow clipping) ==========
(function () {
    'use strict';

    var tip = null;
    var hideTimer = null;

    function getOrCreateTip() {
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'buyNowTooltip';
            document.body.appendChild(tip);
        }
        return tip;
    }

    function showTip(el) {
        var label = el.getAttribute('data-tooltip');
        if (!label) return;
        clearTimeout(hideTimer);
        var t = getOrCreateTip();
        t.textContent = label;
        // Position above the element, centered
        var rect = el.getBoundingClientRect();
        t.style.left = '0px';
        t.style.top = '0px';
        t.classList.add('is-visible');
        // Measure after paint
        requestAnimationFrame(function () {
            var tw = t.offsetWidth;
            var th = t.offsetHeight;
            var left = rect.left + (rect.width / 2) - (tw / 2);
            var top = rect.top - th - 10;
            // Keep within viewport horizontally
            left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
            t.style.left = left + 'px';
            t.style.top = top + 'px';
        });
    }

    function hideTip() {
        clearTimeout(hideTimer);
        if (tip) {
            tip.classList.remove('is-visible');
        }
    }

    document.addEventListener('mouseover', function (e) {
        var el = e.target.closest('[data-tooltip]');
        // Skip sidebar elements (they use CSS pseudo-element tooltips)
        if (el && !el.classList.contains('nav-item') && !el.classList.contains('collapsed-icon')) {
            showTip(el);
        }
    });

    document.addEventListener('mouseout', function (e) {
        var el = e.target.closest('[data-tooltip]');
        // Skip sidebar elements (they use CSS pseudo-element tooltips)
        if (el && !el.classList.contains('nav-item') && !el.classList.contains('collapsed-icon')) {
            hideTip();
        }
    });

    document.addEventListener('scroll', hideTip, true);
})();
