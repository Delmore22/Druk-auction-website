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

    function initComponents() {
        updateStickyOffsets();
        window.addEventListener('resize', updateStickyOffsets);
        initThemeToggle();
        initActiveNav();
        initSidebarState();
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
