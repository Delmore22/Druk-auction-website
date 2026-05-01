(function () {
    'use strict';

    var STORAGE_KEY = 'developerTimeSheetTasksV1';
    var SPEC_SYNC_KEY = 'developerTimeSheetSpecSeedVersion';
    var SPEC_SEED_VERSION = '2026-05-01-backend-handoff-v1';
    var STATUS_OPTIONS = [
        'Not Started',
        'In Development',
        'Ready for Approval',
        'Completed'
    ];
    var SPEC_TASK_TITLES = [
        '[Auth] Verify Firebase ID token on protected requests',
        '[Auth] Implement users profile + role management in Firestore',
        '[Auth] Complete server-side invite/access code issuance flow',
        '[Auth] Create and maintain users collection records',
        '[Auth API] Build POST /api/auth/generate-code (admin only)',
        '[Auth API] Move random code generation from client stub to server',
        '[Vehicles API] Build GET /api/vehicles with filters + pagination',
        '[Vehicles API] Build GET /api/vehicles/:id detail endpoint',
        '[Vehicles API] Build GET /api/vehicles/:id/bids history endpoint',
        '[Favorites API] Build GET /api/users/:uid/favorites',
        '[Favorites API] Build PUT /api/users/:uid/favorites/:vehicleId',
        '[Favorites API] Build DELETE /api/users/:uid/favorites/:vehicleId',
        '[Favorites API] Build POST /api/users/:uid/favorites/sync migration endpoint',
        '[Vehicles API] Build POST /api/vehicles (multipart create listing)',
        '[Vehicles API] Build PATCH /api/vehicles/:id (partial updates)',
        '[Vehicles API] Build DELETE /api/vehicles/:id (role + status rules)',
        '[Vehicles API] Build POST /api/vehicles/import/csv',
        '[Bidding API] Build POST /api/vehicles/:id/bids with validation rules',
        '[Bidding API] Build POST /api/vehicles/:id/buy-now endpoint',
        '[User API] Build GET /api/users/:uid profile endpoint',
        '[User API] Build PATCH /api/users/:uid profile update endpoint',
        '[User API] Build DELETE /api/users/:uid soft-delete endpoint',
        '[User API] Build GET /api/users/:uid/my-vehicles endpoint',
        '[Integrations] Implement Manheim OAuth server flow',
        '[Integrations API] Build POST /api/integrations/manheim/connect',
        '[Integrations API] Build GET /api/integrations/manheim/callback',
        '[Integrations API] Build GET /api/integrations/manheim/inventory proxy',
        '[Integrations API] Build GET /api/integrations/nada/value lookup',
        '[Uploads API] Build POST /api/uploads/photos (max 9 images, <= 10MB each)',
        '[Storage] Store uploaded photos in Firebase Storage and return URLs',
        '[Conventions] Enforce standard API error envelope shape',
        '[Conventions] Apply documented HTTP status codes consistently',
        '[Frontend Wire-Up] Replace index.js randomCode() with POST /api/auth/generate-code',
        '[Frontend Wire-Up] On login call GET /api/users/:uid and store real role',
        '[Frontend Wire-Up] car-dashboard.js use GET /api/vehicles (replace cars.json)',
        '[Frontend Wire-Up] car-details.js use GET /api/vehicles/:id (replace cars.json)',
        '[Frontend Wire-Up] my-vehicles.js use GET /api/users/:uid/my-vehicles',
        '[Frontend Wire-Up] my-searches.js load favorites via API-backed vehicle data',
        '[Frontend Wire-Up] Replace my-vehicles price overrides localStorage with PATCH /api/vehicles/:id',
        '[Frontend Wire-Up] car-add-vehicle.js submitVehicle() -> POST /api/vehicles multipart',
        '[Frontend Wire-Up] car-add-vehicle.js connectManheim() -> OAuth connect endpoint',
        '[Frontend Wire-Up] car-add-vehicle.js connectNADA() -> NADA value endpoint',
        '[Frontend Wire-Up] car-add-vehicle.js CSV stub -> POST /api/vehicles/import/csv',
        '[Frontend Wire-Up] components.js first-login favorites sync call',
        '[Frontend Wire-Up] components.js replace favorites localStorage helpers with API calls',
        '[Frontend Wire-Up] settings.js account name save -> PATCH /api/users/:uid',
        '[Frontend Wire-Up] settings.js delete account stub -> DELETE /api/users/:uid + signOut redirect',
        '[Frontend Wire-Up] car-details.js bid action -> POST /api/vehicles/:id/bids',
        '[Frontend Wire-Up] car-details.js buy-now action -> POST /api/vehicles/:id/buy-now',
        '[Frontend Wire-Up] car-details.js bid history -> GET /api/vehicles/:id/bids',
        '[Frontend Wire-Up] Add Vehicle flow upload photos first via POST /api/uploads/photos'
    ];

    var tableBody = document.getElementById('timesheetTableBody');
    var addForm = document.getElementById('timesheetAddForm');
    var newTaskTitle = document.getElementById('newTaskTitle');
    var newTaskEstimate = document.getElementById('newTaskEstimate');
    var savedState = document.getElementById('timesheetSavedState');

    var summaryNotStarted = document.getElementById('summaryNotStarted');
    var summaryInDevelopment = document.getElementById('summaryInDevelopment');
    var summaryReadyForApproval = document.getElementById('summaryReadyForApproval');
    var summaryCompleted = document.getElementById('summaryCompleted');

    if (!tableBody || !addForm || !newTaskTitle || !newTaskEstimate) {
        return;
    }

    var tasks = loadTasks();

    function getSeedTasks() {
        var now = Date.now();

        return SPEC_TASK_TITLES.map(function (title, index) {
            return {
                id: 'spec-' + String(now + index),
                title: title,
                estimateHours: '',
                timeSpentHours: '',
                comments: '',
                status: 'Not Started',
                updatedAt: new Date(now - ((SPEC_TASK_TITLES.length - index) * 1000)).toISOString()
            };
        });
    }

    function titleKey(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    function mergeMissingSeedTasks(existingTasks) {
        var existingByTitle = Object.create(null);

        existingTasks.forEach(function (task) {
            existingByTitle[titleKey(task.title)] = true;
        });

        var missing = getSeedTasks().filter(function (seedTask) {
            return !existingByTitle[titleKey(seedTask.title)];
        });

        return existingTasks.concat(missing);
    }

    function loadTasks() {
        var raw;
        var seededVersion;
        try {
            raw = window.localStorage.getItem(STORAGE_KEY);
            seededVersion = window.localStorage.getItem(SPEC_SYNC_KEY);
        } catch (err) {
            raw = null;
            seededVersion = null;
        }

        if (!raw) {
            return getSeedTasks();
        }

        try {
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return getSeedTasks();
            }

            var normalizedTasks = parsed
                .filter(function (task) { return task && task.id && task.title; })
                .map(function (task) {
                    var status = STATUS_OPTIONS.indexOf(task.status) >= 0 ? task.status : 'Not Started';
                    return {
                        id: String(task.id),
                        title: String(task.title),
                        estimateHours: normalizeHours(task.estimateHours),
                        timeSpentHours: normalizeHours(task.timeSpentHours),
                        comments: typeof task.comments === 'string' ? task.comments : '',
                        status: status,
                        updatedAt: task.updatedAt || new Date().toISOString()
                    };
                });

            if (seededVersion === SPEC_SEED_VERSION) {
                return normalizedTasks;
            }

            return mergeMissingSeedTasks(normalizedTasks);
        } catch (err) {
            return getSeedTasks();
        }
    }

    function normalizeHours(value) {
        if (value === '' || value === null || typeof value === 'undefined') {
            return '';
        }
        var parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) {
            return '';
        }
        return Math.round(parsed * 100) / 100;
    }

    function slugStatus(status) {
        return String(status || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function formatDate(isoValue) {
        var date = new Date(isoValue);
        if (Number.isNaN(date.getTime())) {
            return 'Unknown';
        }

        return new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        }).format(date);
    }

    function updateSavedState(text) {
        if (!savedState) return;
        savedState.textContent = text;
    }

    function saveTasks() {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
            window.localStorage.setItem(SPEC_SYNC_KEY, SPEC_SEED_VERSION);
            updateSavedState('Saved ' + formatDate(new Date().toISOString()));
        } catch (err) {
            updateSavedState('Unable to save locally in this browser');
        }
    }

    function updateSummary() {
        var counts = {
            'Not Started': 0,
            'In Development': 0,
            'Ready for Approval': 0,
            'Completed': 0
        };

        tasks.forEach(function (task) {
            if (Object.prototype.hasOwnProperty.call(counts, task.status)) {
                counts[task.status] += 1;
            }
        });

        if (summaryNotStarted) summaryNotStarted.textContent = String(counts['Not Started']);
        if (summaryInDevelopment) summaryInDevelopment.textContent = String(counts['In Development']);
        if (summaryReadyForApproval) summaryReadyForApproval.textContent = String(counts['Ready for Approval']);
        if (summaryCompleted) summaryCompleted.textContent = String(counts['Completed']);
    }

    function buildStatusSelect(task) {
        var select = document.createElement('select');
        select.className = 'timesheet-select status-' + slugStatus(task.status);

        STATUS_OPTIONS.forEach(function (status) {
            var option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            if (status === task.status) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.addEventListener('change', function () {
            task.status = select.value;
            task.updatedAt = new Date().toISOString();
            select.className = 'timesheet-select status-' + slugStatus(task.status);
            render();
            saveTasks();
        });

        return select;
    }

    function buildHoursInput(task, key) {
        var input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = '0.25';
        input.className = 'timesheet-input';
        input.value = task[key] === '' ? '' : String(task[key]);

        input.addEventListener('change', function () {
            task[key] = normalizeHours(input.value);
            task.updatedAt = new Date().toISOString();
            saveTasks();
            render();
        });

        return input;
    }

    function buildComments(task) {
        var textarea = document.createElement('textarea');
        textarea.className = 'timesheet-textarea';
        textarea.value = task.comments;
        textarea.placeholder = 'Work notes, blockers, or details for review';

        textarea.addEventListener('change', function () {
            task.comments = textarea.value.trim();
            task.updatedAt = new Date().toISOString();
            saveTasks();
            render();
        });

        return textarea;
    }

    function removeTask(taskId) {
        tasks = tasks.filter(function (task) {
            return task.id !== taskId;
        });
        saveTasks();
        render();
    }

    function buildRow(task) {
        var tr = document.createElement('tr');

        var titleCell = document.createElement('td');
        var titleWrap = document.createElement('div');
        titleWrap.className = 'timesheet-task-title';
        var title = document.createElement('strong');
        title.textContent = task.title;
        titleWrap.appendChild(title);
        titleCell.appendChild(titleWrap);

        var estimateCell = document.createElement('td');
        estimateCell.appendChild(buildHoursInput(task, 'estimateHours'));

        var spentCell = document.createElement('td');
        spentCell.appendChild(buildHoursInput(task, 'timeSpentHours'));

        var commentsCell = document.createElement('td');
        commentsCell.appendChild(buildComments(task));

        var statusCell = document.createElement('td');
        statusCell.appendChild(buildStatusSelect(task));

        var updatedCell = document.createElement('td');
        var updatedLabel = document.createElement('span');
        updatedLabel.className = 'timesheet-updated';
        updatedLabel.textContent = formatDate(task.updatedAt);
        updatedCell.appendChild(updatedLabel);

        var actionsCell = document.createElement('td');
        var removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'timesheet-delete-btn';
        removeButton.setAttribute('aria-label', 'Remove task');
        removeButton.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
        removeButton.addEventListener('click', function () {
            removeTask(task.id);
        });
        actionsCell.appendChild(removeButton);

        tr.appendChild(titleCell);
        tr.appendChild(estimateCell);
        tr.appendChild(spentCell);
        tr.appendChild(commentsCell);
        tr.appendChild(statusCell);
        tr.appendChild(updatedCell);
        tr.appendChild(actionsCell);

        return tr;
    }

    function renderEmpty() {
        tableBody.textContent = '';
        var row = document.createElement('tr');
        var cell = document.createElement('td');
        cell.colSpan = 7;
        cell.className = 'timesheet-empty';
        cell.textContent = 'No assigned tasks yet. Use Add Task to create your first item.';
        row.appendChild(cell);
        tableBody.appendChild(row);
    }

    function render() {
        if (!tasks.length) {
            renderEmpty();
            updateSummary();
            return;
        }

        var orderedTasks = tasks.slice().sort(function (a, b) {
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

        tableBody.textContent = '';
        orderedTasks.forEach(function (task) {
            tableBody.appendChild(buildRow(task));
        });

        updateSummary();
    }

    addForm.addEventListener('submit', function (event) {
        event.preventDefault();

        var title = String(newTaskTitle.value || '').trim();
        var estimate = normalizeHours(newTaskEstimate.value);
        if (!title) {
            newTaskTitle.focus();
            return;
        }

        tasks.unshift({
            id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7),
            title: title,
            estimateHours: estimate,
            timeSpentHours: '',
            comments: '',
            status: 'Not Started',
            updatedAt: new Date().toISOString()
        });

        newTaskTitle.value = '';
        newTaskEstimate.value = '';

        saveTasks();
        render();
    });

    render();
    saveTasks();
})();
