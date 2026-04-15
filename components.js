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

    function initHeaderUserName() {
        var nameEl   = document.getElementById('headerUserName');
        var avatarEl = document.getElementById('headerUserAvatar');
        if (!nameEl) return;

        function applyName(name) {
            if (!name || !name.trim()) return;
            nameEl.textContent = name.trim();
            if (avatarEl) {
                var parts = name.trim().split(/\s+/);
                var initials = parts.length >= 2
                    ? parts[0][0] + parts[parts.length - 1][0]
                    : parts[0].slice(0, 2);
                avatarEl.textContent = initials.toUpperCase();
            }
        }

        applyName(storageGet('accountName') || 'John Dealer');

        // Update immediately if settings page saves in another tab
        window.addEventListener('storage', function (e) {
            if (e.key === 'accountName') applyName(e.newValue);
        });
    }

    function initUserMenu() {
        var trigger = document.getElementById('userMenuTrigger');
        var dropdown = document.getElementById('userDropdown');
        if (!trigger || !dropdown) return;

        function openMenu() {
            trigger.setAttribute('aria-expanded', 'true');
        }
        function closeMenu() {
            trigger.setAttribute('aria-expanded', 'false');
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
    }

    function initComponents() {
        requestStickyOffsetsUpdate();
        window.addEventListener('resize', requestStickyOffsetsUpdate);
        initActionButtons();
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
