(function () {
    'use strict';

    var STORAGE_KEY = 'classicBidLaunchChecklistState';
    var sectionsContainer = document.getElementById('launchSections');
    var masterNotesInput = document.getElementById('masterLaunchNotes');
    var resetChecklistBtn = document.getElementById('resetChecklistBtn');
    var summaryTotal = document.getElementById('summaryTotal');
    var summaryCompleted = document.getElementById('summaryCompleted');
    var summaryRemaining = document.getElementById('summaryRemaining');
    var summarySections = document.getElementById('summarySections');

    var checklistSections = [
        {
            id: 'shared-partials',
            title: 'Shared Partials',
            file: 'partials/footer.html, partials/header.html, partials/below-header.html, partials/left-sidebar.html',
            description: 'Cross-site markup that affects multiple pages at once.',
            tasks: [
                {
                    id: 'footer-remove-ideas-link',
                    title: 'Remove the owner-only Ideas link from the footer',
                    text: 'The footer explicitly marks the Ideas link as temporary and notes that it should be removed before the public site goes live.',
                    file: 'partials/footer.html'
                },
                {
                    id: 'footer-remove-launch-checklist-link',
                    title: 'Remove the owner-only Launch Checklist link from the footer',
                    text: 'This checklist is an internal tool and should not stay in public navigation after launch prep is complete.',
                    file: 'partials/footer.html'
                },
                {
                    id: 'footer-fix-placeholder-links',
                    title: 'Replace placeholder footer links with real destinations',
                    text: 'Dashboard, Auction Houses, My Vehicles, Watchlist, and Contact Us still point to # and should either link correctly or be removed.',
                    file: 'partials/footer.html'
                },
                {
                    id: 'footer-fix-social-links',
                    title: 'Replace placeholder social links and emoji labels',
                    text: 'Facebook, Twitter, and Instagram still use # targets and temporary text styling.',
                    file: 'partials/footer.html'
                },
                {
                    id: 'header-replace-demo-user',
                    title: 'Replace demo user identity in the shared header',
                    text: 'The header still shows JD / John Dealer / Administrator, which reads like a mock account rather than launch-ready UI.',
                    file: 'partials/header.html'
                },
                {
                    id: 'header-remove-hardcoded-notification-count',
                    title: 'Replace the hardcoded notification badge count',
                    text: 'The header still shows a static notification count of 4, which should become dynamic or be hidden until real data exists.',
                    file: 'partials/header.html'
                },
                {
                    id: 'below-header-review-toolbar',
                    title: 'Decide whether the below-header toolbar belongs in the public build',
                    text: 'Offers, Purchased, Watch List, and Sold may be owner-only controls depending on how this site launches.',
                    file: 'partials/below-header.html'
                },
                {
                    id: 'below-header-search-functional',
                    title: 'Make shared search and filters fully functional or hide them where needed',
                    text: 'The global search/filter strip appears broadly, so it should either work consistently or be scoped more narrowly.',
                    file: 'partials/below-header.html'
                }
            ]
        },
        {
            id: 'dashboard-page',
            title: 'Dashboard',
            file: 'car-dashboard.html, car-dashboard.js',
            description: 'Primary owner dashboard and overview panels.',
            tasks: [
                {
                    id: 'dashboard-replace-greeting',
                    title: 'Replace the Welcome back, John Dealer greeting',
                    text: 'The dashboard greeting still uses a specific demo identity instead of live user data or neutral copy.',
                    file: 'car-dashboard.html'
                },
                {
                    id: 'dashboard-replace-high-match-placeholder',
                    title: 'Replace or remove the High Match Vehicles placeholder card',
                    text: 'One of the bottom-row dashboard cards is still placeholder content and should not survive launch unchanged.',
                    file: 'car-dashboard.html'
                },
                {
                    id: 'dashboard-replace-recent-purchases-placeholder',
                    title: 'Replace or remove the Recent Purchases placeholder card',
                    text: 'This card reads like demo filler and should either use real data or an intentional empty state.',
                    file: 'car-dashboard.html'
                },
                {
                    id: 'dashboard-replace-portfolio-placeholder',
                    title: 'Replace or remove the Portfolio Performance placeholder card',
                    text: 'The dashboard still labels the lower modules as placeholders, which is a direct launch risk.',
                    file: 'car-dashboard.html'
                },
                {
                    id: 'dashboard-replace-popular-categories-placeholder',
                    title: 'Replace or remove the Popular Categories placeholder card',
                    text: 'The fourth bottom-row module is still placeholder content rather than a finished production component.',
                    file: 'car-dashboard.html'
                },
                {
                    id: 'dashboard-review-debug-flags',
                    title: 'Review performance debug query flags for production readiness',
                    text: 'The dashboard script includes debugPerf and debugPerfLog entry points that should be intentional in production.',
                    file: 'car-dashboard.js'
                },
                {
                    id: 'dashboard-disable-debug-overlay',
                    title: 'Remove or gate the dashboard performance overlay badge',
                    text: 'The debugPerf mode exposes an on-page debug badge that should not appear accidentally in production.',
                    file: 'car-dashboard.js'
                },
                {
                    id: 'dashboard-clean-debug-logging',
                    title: 'Remove or gate dashboard performance console logging',
                    text: 'The dashboard script logs [dashboard-perf] output when debugPerfLog is enabled, so make sure that behavior is explicitly intended.',
                    file: 'car-dashboard.js'
                }
            ]
        },
        {
            id: 'my-vehicles-page',
            title: 'My Vehicles',
            file: 'my-vehicles.html',
            description: 'Collection overview page with summary metrics and curated records.',
            tasks: [
                {
                    id: 'my-vehicles-review-summary-stats',
                    title: 'Replace or validate the My Vehicles summary metrics',
                    text: 'Counts like 24 In Collection, 8 Ready to List, and the estimated portfolio value read as demo content and should be confirmed before launch.',
                    file: 'my-vehicles.html'
                },
                {
                    id: 'my-vehicles-review-demo-records',
                    title: 'Review the My Vehicles record list for demo-only inventory',
                    text: 'The page currently presents polished sample vehicles and supporting copy, which should match the real launch data plan.',
                    file: 'my-vehicles.html'
                },
                {
                    id: 'my-vehicles-validate-actions',
                    title: 'Validate that My Vehicles calls to action map to real workflows',
                    text: 'Check the hero and panel actions end to end so the page does not ship with dead-end navigation.',
                    file: 'my-vehicles.html'
                }
            ]
        },
        {
            id: 'car-details-page',
            title: 'Car Details',
            file: 'car-details.html, car-details.js',
            description: 'Vehicle detail page, notes flow, and related quick actions.',
            tasks: [
                {
                    id: 'car-details-fix-placeholder-quick-actions',
                    title: 'Replace placeholder quick-action links on the car details page',
                    text: 'Contact Seller, Share on Social Media, and Add to Watchlist still use # links in the right sidebar.',
                    file: 'car-details.html'
                },
                {
                    id: 'car-details-fix-view-fees-link',
                    title: 'Replace the generated View Fees placeholder link',
                    text: 'The auction panel builder still creates a View Fees link with a # href instead of a real destination or modal trigger.',
                    file: 'car-details.js'
                },
                {
                    id: 'car-details-fix-carfax-link',
                    title: 'Replace the generated CARFAX placeholder link',
                    text: 'The vehicle history card still generates a CARFAX button with a # href, which makes the action look live when it is not.',
                    file: 'car-details.js'
                },
                {
                    id: 'car-details-fix-history-report-link',
                    title: 'Replace the generated View Report placeholder link',
                    text: 'The history section still renders a View Report link with a # href rather than a working report destination.',
                    file: 'car-details.js'
                },
                {
                    id: 'car-details-validate-demo-vehicle-data',
                    title: 'Review the car details experience for demo-only content',
                    text: 'The detail page is fed from the local cars.json source and should be checked to ensure that vehicle content is launch-appropriate.',
                    file: 'car-details.html / car-details.js / data/cars.json'
                },
                {
                    id: 'car-details-confirm-local-data-strategy',
                    title: 'Confirm whether fetching local cars.json is the intended production data strategy',
                    text: 'The car details script currently loads inventory directly from data/cars.json rather than a live service.',
                    file: 'car-details.js'
                }
            ]
        },
        {
            id: 'watchlist-page',
            title: 'Watchlist',
            file: 'watchlist.html',
            description: 'Saved opportunities and bid monitoring page.',
            tasks: [
                {
                    id: 'watchlist-review-summary-stats',
                    title: 'Replace or validate the Watchlist summary metrics',
                    text: 'Tracked Lots, Bid Alerts, High Match, and Next Closing values are currently fixed sample numbers.',
                    file: 'watchlist.html'
                },
                {
                    id: 'watchlist-review-demo-vehicles',
                    title: 'Review the tracked vehicle list for sample-only watchlist content',
                    text: 'The current watchlist entries and strategy notes read as polished demo data and should be reconciled with the real launch plan.',
                    file: 'watchlist.html'
                },
                {
                    id: 'watchlist-validate-actions',
                    title: 'Validate Watchlist actions and sidebar shortcuts',
                    text: 'Check that the page actions, anchor jumps, and browse links support a real user flow rather than a static demonstration.',
                    file: 'watchlist.html'
                }
            ]
        },
        {
            id: 'network-page',
            title: 'Network',
            file: 'network.html',
            description: 'Partner and lead management page.',
            tasks: [
                {
                    id: 'network-review-summary-stats',
                    title: 'Replace or validate the Network summary metrics',
                    text: 'Counts such as 42 Active Partners, 9 Warm Leads, and 5 Open Requests appear to be seeded demo values.',
                    file: 'network.html'
                },
                {
                    id: 'network-review-demo-partner-content',
                    title: 'Review partner cards and notes for demo-only relationship data',
                    text: 'The page reads like a showcase of sample partner activity and should be checked against what launches publicly.',
                    file: 'network.html'
                },
                {
                    id: 'network-validate-actions',
                    title: 'Validate Network actions and contact flows',
                    text: 'Ensure any outreach, follow-up, or jump links represent real workflows instead of static mock interactions.',
                    file: 'network.html'
                }
            ]
        },
        {
            id: 'add-vehicle-page',
            title: 'Add Vehicle',
            file: 'car-add-vehicle.html, car-add-vehicle.js',
            description: 'Vehicle intake and provider connection flow.',
            tasks: [
                {
                    id: 'add-vehicle-provider-todos',
                    title: 'Finish or hide unfinished provider integrations',
                    text: 'The add-vehicle script still has TODO markers for Manheim OAuth/API and NADA Guides connections.',
                    file: 'car-add-vehicle.js'
                },
                {
                    id: 'add-vehicle-manheim-coming-soon',
                    title: 'Remove the coming soon alert for Manheim integration',
                    text: 'The current flow still displays a Manheim integration coming soon alert, which is not launch-ready behavior.',
                    file: 'car-add-vehicle.js'
                },
                {
                    id: 'add-vehicle-nada-coming-soon',
                    title: 'Remove the coming soon alert for NADA Guides integration',
                    text: 'The NADA connection path still announces that the integration is coming soon instead of offering a finished experience.',
                    file: 'car-add-vehicle.js'
                },
                {
                    id: 'add-vehicle-import-todo',
                    title: 'Finish or hide CSV import behavior',
                    text: 'CSV parsing is still marked TODO, so the page may expose an unfinished flow.',
                    file: 'car-add-vehicle.js'
                },
                {
                    id: 'add-vehicle-submit-todo',
                    title: 'Connect the final submit flow to a real backend or clearly disable it',
                    text: 'The submit path still contains a TODO for sending data to the server.',
                    file: 'car-add-vehicle.js'
                },
                {
                    id: 'add-vehicle-clean-console-logging',
                    title: 'Remove or gate add-vehicle debug console logging',
                    text: 'The script still logs provider connections, CSV uploads, validation failures, and submit payloads to the console.',
                    file: 'car-add-vehicle.js'
                },
                {
                    id: 'add-vehicle-fix-form-help-link',
                    title: 'Replace the Add Vehicle Form Help placeholder link',
                    text: 'The collapsed Form Help sidebar icon still uses a # href, so it should become a real action or a button instead of a dead link.',
                    file: 'car-add-vehicle.html'
                }
            ]
        },
        {
            id: 'branding-pages',
            title: 'Home And Branding',
            file: 'index.html, logo-gallery.html',
            description: 'Public-facing entry points and brand asset surfaces.',
            tasks: [
                {
                    id: 'index-review-launch-copy',
                    title: 'Review the homepage for final launch copy and working CTAs',
                    text: 'The public entry page should be checked for final messaging, complete navigation, and anything that still reads like a draft.',
                    file: 'index.html'
                },
                {
                    id: 'logo-gallery-private-or-public',
                    title: 'Decide whether the logo gallery remains internal',
                    text: 'The logo gallery looks like a brand asset utility page, so confirm whether it belongs in the public launch footprint.',
                    file: 'logo-gallery.html'
                }
            ]
        },
        {
            id: 'internal-pages',
            title: 'Internal Utility Pages',
            file: 'brainstorming.html, brainstorming.js, brainstorming.supabase-config.js, style-guide.html, launch-checklist.html',
            description: 'Owner-only tools and documentation pages that should not accidentally ride into production.',
            tasks: [
                {
                    id: 'brainstorming-private-or-remove',
                    title: 'Decide whether the brainstorming board stays private or gets removed',
                    text: 'The page is clearly an internal utility and the footer already warns that its public link is temporary.',
                    file: 'brainstorming.html'
                },
                {
                    id: 'brainstorming-review-created-by-placeholder',
                    title: 'Review brainstorming form example placeholders for internal names',
                    text: 'The Created By field still uses example text like Danny or John Dealer, which is another sign that the page is an internal tool.',
                    file: 'brainstorming.html'
                },
                {
                    id: 'brainstorming-secure-config',
                    title: 'Review Supabase setup and client-side exposure for the brainstorming tool',
                    text: 'The current brainstorming config exposes a live project URL and publishable key, so access controls and intended visibility should be confirmed.',
                    file: 'brainstorming.js / brainstorming.supabase-config.js'
                },
                {
                    id: 'brainstorming-clean-debug-errors',
                    title: 'Review brainstorming console error output for production readiness',
                    text: 'The brainstorming script uses console.error for failed clear, save, and load flows, which should be an intentional production choice.',
                    file: 'brainstorming.js'
                },
                {
                    id: 'style-guide-private-or-remove',
                    title: 'Keep the style guide private or remove it from the launch surface',
                    text: 'The style guide is useful during development but likely not something you want indexed or publicly discoverable.',
                    file: 'style-guide.html'
                },
                {
                    id: 'style-guide-ignore-demo-links-or-keep-private',
                    title: 'Keep style guide demo links private so placeholder hrefs do not matter publicly',
                    text: 'The style guide intentionally uses # links in component examples, which is fine for internal documentation but not for a public-facing page.',
                    file: 'style-guide.html'
                },
                {
                    id: 'launch-checklist-private-or-remove',
                    title: 'Keep this launch checklist private or remove it before public release',
                    text: 'This page is deliberately internal, so it should not remain publicly linked when the site launches.',
                    file: 'launch-checklist.html'
                }
            ]
        },
        {
            id: 'data-and-deployment',
            title: 'Data And Deployment Assets',
            file: 'data/cars.json, data/*.sql, smoke-check.ps1, smoke-check-dashboard-state.ps1, tmp-video-frames/, cars-photos/, components.js',
            description: 'Support files, sample data, and debug hooks that need explicit deployment decisions.',
            tasks: [
                {
                    id: 'data-review-cars-json-demo-content',
                    title: 'Replace or reconcile the demo inventory in cars.json',
                    text: 'cars.json contains sample vehicles, seller names, auction timing, and status values that should match the real production data strategy.',
                    file: 'data/cars.json'
                },
                {
                    id: 'data-review-sql-exposure',
                    title: 'Keep SQL support files out of the public website surface',
                    text: 'The data folder includes SQL migration files that should not be casually exposed depending on how the site is hosted.',
                    file: 'data/brainstorming-supabase.sql / data/brainstorming-created-by-upgrade.sql'
                },
                {
                    id: 'deployment-exclude-smoke-scripts',
                    title: 'Confirm smoke-check PowerShell scripts do not ship with the site',
                    text: 'These scripts are useful for development and validation, but they should not be exposed in a production web root.',
                    file: 'smoke-check.ps1 / smoke-check-dashboard-state.ps1'
                },
                {
                    id: 'deployment-exclude-temp-assets',
                    title: 'Review temporary asset folders for deployment exclusion',
                    text: 'tmp-video-frames and any other utility asset folders should be checked so only launch-ready assets are deployed.',
                    file: 'tmp-video-frames/ / cars-photos/'
                },
                {
                    id: 'components-review-ui-debug-logging',
                    title: 'Review shared UI debug logging in components.js',
                    text: 'components.js supports debugUI-driven console logging and partial-load errors, so decide whether those diagnostics should remain in production.',
                    file: 'components.js'
                }
            ]
        }
    ];

    var checklistState = readState();

    function readState() {
        try {
            var raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return createDefaultState();
            }

            return normalizeState(JSON.parse(raw));
        } catch (err) {
            return createDefaultState();
        }
    }

    function createDefaultState() {
        return {
            completed: {},
            customTasks: {},
            sectionNotes: {},
            masterNotes: ''
        };
    }

    function normalizeState(state) {
        var source = state || {};
        return {
            completed: source.completed && typeof source.completed === 'object' ? source.completed : {},
            customTasks: source.customTasks && typeof source.customTasks === 'object' ? source.customTasks : {},
            sectionNotes: source.sectionNotes && typeof source.sectionNotes === 'object' ? source.sectionNotes : {},
            masterNotes: typeof source.masterNotes === 'string' ? source.masterNotes : ''
        };
    }

    function saveState() {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checklistState));
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getSectionTasks(section) {
        var customTasks = checklistState.customTasks[section.id] || [];
        return section.tasks.concat(customTasks);
    }

    function updateSummary() {
        var totals = checklistSections.reduce(function (accumulator, section) {
            var tasks = getSectionTasks(section);
            tasks.forEach(function (task) {
                accumulator.total += 1;
                if (checklistState.completed[task.id]) {
                    accumulator.completed += 1;
                }
            });
            return accumulator;
        }, { total: 0, completed: 0 });

        summaryTotal.textContent = String(totals.total);
        summaryCompleted.textContent = String(totals.completed);
        summaryRemaining.textContent = String(Math.max(totals.total - totals.completed, 0));
        summarySections.textContent = String(checklistSections.length);
    }

    function render() {
        var html = checklistSections.map(function (section) {
            var tasks = getSectionTasks(section);
            var completedCount = tasks.filter(function (task) {
                return Boolean(checklistState.completed[task.id]);
            }).length;

            var taskMarkup = tasks.length ? tasks.map(function (task) {
                var isComplete = Boolean(checklistState.completed[task.id]);
                var isCustom = Boolean(task.isCustom);

                return [
                    '<li class="launch-task-row' + (isComplete ? ' is-complete' : '') + '">',
                    '    <input class="launch-task-toggle" type="checkbox" data-task-id="' + escapeHtml(task.id) + '" ' + (isComplete ? 'checked' : '') + '>',
                    '    <label>',
                    '        <span class="launch-task-title">' + escapeHtml(task.title) + '</span>',
                    '        <span class="launch-task-text">' + escapeHtml(task.text) + '</span>',
                    '        <span class="launch-task-meta">' + escapeHtml(task.file) + (isCustom ? ' · custom' : '') + '</span>',
                    '    </label>',
                    isCustom
                        ? '    <button class="launch-task-remove" type="button" data-remove-task-id="' + escapeHtml(task.id) + '" data-section-id="' + escapeHtml(section.id) + '" aria-label="Remove custom task"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>'
                        : '    <span></span>',
                    '</li>'
                ].join('');
            }).join('') : '<li class="launch-empty-state">No tasks yet for this section.</li>';

            return [
                '<section class="launch-section-card" id="' + escapeHtml(section.id) + '">',
                '    <div class="launch-section-header">',
                '        <div>',
                '            <h3>' + escapeHtml(section.title) + '</h3>',
                '            <p>' + escapeHtml(section.description) + '</p>',
                '            <span class="launch-section-file">' + escapeHtml(section.file) + '</span>',
                '        </div>',
                '        <div class="launch-section-progress">' + completedCount + '/' + tasks.length + ' complete</div>',
                '    </div>',
                '    <ul class="launch-task-list">' + taskMarkup + '</ul>',
                '    <div class="launch-section-footer">',
                '        <form class="launch-custom-form" data-section-form="' + escapeHtml(section.id) + '">',
                '            <input class="launch-custom-input" type="text" name="taskText" maxlength="220" placeholder="Add another launch item for ' + escapeHtml(section.title) + '">',
                '            <button class="launch-custom-button" type="submit">Add Item</button>',
                '        </form>',
                '        <div class="launch-section-note-block">',
                '            <label class="launch-notes-label" for="note-' + escapeHtml(section.id) + '">Section notes</label>',
                '            <textarea class="launch-notes-input" id="note-' + escapeHtml(section.id) + '" data-section-note="' + escapeHtml(section.id) + '" rows="4" placeholder="Write any extra page-specific launch notes here.">' + escapeHtml(checklistState.sectionNotes[section.id] || '') + '</textarea>',
                '        </div>',
                '    </div>',
                '</section>'
            ].join('');
        }).join('');

        sectionsContainer.innerHTML = html;
        masterNotesInput.value = checklistState.masterNotes;
        updateSummary();
    }

    function addCustomTask(sectionId, text) {
        var cleanText = text.replace(/\s+/g, ' ').trim();
        if (!cleanText) {
            return;
        }

        if (!Array.isArray(checklistState.customTasks[sectionId])) {
            checklistState.customTasks[sectionId] = [];
        }

        checklistState.customTasks[sectionId].push({
            id: 'custom-' + Date.now() + '-' + Math.random().toString(16).slice(2),
            title: cleanText,
            text: 'Custom launch item added from the checklist page.',
            file: 'Custom note',
            isCustom: true
        });

        saveState();
        render();
    }

    function removeCustomTask(sectionId, taskId) {
        var sectionTasks = checklistState.customTasks[sectionId];
        if (!Array.isArray(sectionTasks)) {
            return;
        }

        checklistState.customTasks[sectionId] = sectionTasks.filter(function (task) {
            return task.id !== taskId;
        });
        delete checklistState.completed[taskId];
        saveState();
        render();
    }

    sectionsContainer.addEventListener('change', function (event) {
        var checkbox = event.target.closest('[data-task-id]');
        if (checkbox) {
            checklistState.completed[checkbox.getAttribute('data-task-id')] = checkbox.checked;
            saveState();
            updateSummary();
            checkbox.closest('.launch-task-row').classList.toggle('is-complete', checkbox.checked);
            return;
        }

        var noteField = event.target.closest('[data-section-note]');
        if (noteField) {
            checklistState.sectionNotes[noteField.getAttribute('data-section-note')] = noteField.value;
            saveState();
        }
    });

    sectionsContainer.addEventListener('input', function (event) {
        var noteField = event.target.closest('[data-section-note]');
        if (!noteField) {
            return;
        }

        checklistState.sectionNotes[noteField.getAttribute('data-section-note')] = noteField.value;
        saveState();
    });

    sectionsContainer.addEventListener('submit', function (event) {
        var form = event.target.closest('[data-section-form]');
        if (!form) {
            return;
        }

        event.preventDefault();
        addCustomTask(form.getAttribute('data-section-form'), form.elements.taskText.value);
    });

    sectionsContainer.addEventListener('click', function (event) {
        var removeButton = event.target.closest('[data-remove-task-id]');
        if (!removeButton) {
            return;
        }

        removeCustomTask(
            removeButton.getAttribute('data-section-id'),
            removeButton.getAttribute('data-remove-task-id')
        );
    });

    masterNotesInput.addEventListener('input', function () {
        checklistState.masterNotes = masterNotesInput.value;
        saveState();
    });

    resetChecklistBtn.addEventListener('click', function () {
        if (!window.confirm('Reset all saved checklist progress and notes in this browser?')) {
            return;
        }

        checklistState = createDefaultState();
        saveState();
        render();
    });

    render();
})();