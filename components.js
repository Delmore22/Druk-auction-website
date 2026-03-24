(function () {
    'use strict';

    var PARTIALS = [
        { id: 'header-placeholder',       file: 'partials/header.html' },
        { id: 'below-header-placeholder', file: 'partials/below-header.html' },
        { id: 'left-sidebar-placeholder', file: 'partials/left-sidebar.html' },
        { id: 'footer-placeholder',       file: 'partials/footer.html' }
    ];

    function fetchPartial(id, file) {
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
                var placeholder = document.getElementById(id);
                if (placeholder) {
                    placeholder.outerHTML = html;
                }
            });
    }

    function updateStickyOffsets() {
        var header = document.querySelector('.top-header');
        if (!header) return;
        document.documentElement.style.setProperty(
            '--top-header-height',
            header.offsetHeight + 'px'
        );
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
        // Apply saved theme preference
        var savedTheme = storageGet('theme');
        if (savedTheme === 'light') {
            document.body.classList.remove('dark-theme');
        } else if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
        }
        btn.textContent = document.body.classList.contains('dark-theme') ? '☀️' : '🌙';
        btn.addEventListener('click', function () {
            document.body.classList.toggle('dark-theme');
            var isDark = document.body.classList.contains('dark-theme');
            storageSet('theme', isDark ? 'dark' : 'light');
            btn.textContent = isDark ? '☀️' : '🌙';
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
        header.addEventListener('transitionend', updateStickyOffsets);
        // Keep sticky offsets in sync while header height animates.
        if ('ResizeObserver' in window) {
            var headerResizeObserver = new ResizeObserver(updateStickyOffsets);
            headerResizeObserver.observe(header);
        }

        var ticking = false;

        function applyState() {
            var mainContent = document.querySelector('.main-content');
            // Sum both — only one is ever non-zero at a time, covering all layout cases.
            var scrollTop = (window.scrollY || 0) + (mainContent ? mainContent.scrollTop : 0);
            var isShrunk = header.classList.contains('shrunk');
            if (!isShrunk && scrollTop > 30) {
                header.classList.add('shrunk');
                updateStickyOffsets();
            } else if (isShrunk && scrollTop < 2) {
                header.classList.remove('shrunk');
                updateStickyOffsets();
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
        var mainContent = document.querySelector('.main-content');
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
            var containingCandidates = [];
            var upcomingCandidates = [];
            var passedCandidates = [];

            uniqueTargets.forEach(function (target) {
                var rect = target.element.getBoundingClientRect();
                if (rect.top <= anchorOffset && rect.bottom >= anchorOffset) {
                    containingCandidates.push({ id: target.id, score: anchorOffset - rect.top });
                    return;
                }

                if (rect.top > anchorOffset) {
                    upcomingCandidates.push({ id: target.id, score: rect.top - anchorOffset });
                    return;
                }

                passedCandidates.push({ id: target.id, score: anchorOffset - rect.bottom });
            });

            if (containingCandidates.length) {
                containingCandidates.sort(function (a, b) { return a.score - b.score; });
                return containingCandidates[0].id;
            }

            if (upcomingCandidates.length) {
                upcomingCandidates.sort(function (a, b) { return a.score - b.score; });
                return upcomingCandidates[0].id;
            }

            if (passedCandidates.length) {
                passedCandidates.sort(function (a, b) { return a.score - b.score; });
                return passedCandidates[0].id;
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

    function initComponents() {
        updateStickyOffsets();
        window.addEventListener('resize', updateStickyOffsets);
        initThemeToggle();
        initActiveNav();
        initSidebarState();
        initShrinkingHeader();
        initSmoothAnchorScroll();
        initRightSidebarSectionTracking();
        debugUiState('init');
    }

    // Global sidebar toggles — called via onclick in the sidebar partials
    window.toggleLeftSidebar = function () {
        var sidebar = document.getElementById('leftSidebar');
        var arrow   = document.getElementById('leftArrow');
        if (!sidebar) return;
        sidebar.classList.toggle('collapsed');
        var isCollapsed = sidebar.classList.contains('collapsed');
        if (arrow) arrow.textContent = isCollapsed ? '▶' : '◀';
        storageSet('leftSidebarCollapsed', String(isCollapsed));
        debugUiState('toggleLeftSidebar');
    };

    window.toggleRightSidebar = function () {
        var sidebar = document.getElementById('rightSidebar');
        var arrow   = document.getElementById('rightArrow');
        if (!sidebar) return;
        sidebar.classList.toggle('collapsed');
        var isCollapsed = sidebar.classList.contains('collapsed');
        if (arrow) arrow.textContent = isCollapsed ? '◀' : '▶';
        storageSet('rightSidebarCollapsed', String(isCollapsed));
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
