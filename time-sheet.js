import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://chllzkgugwuerlnbltay.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rpzSMoGHXVKEIRwipYmrHg_64fqgX0y';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Roles allowed to access this page
const DEV_ROLES = new Set(['admin', 'developer', 'dev', 'ceo']);

const STORAGE_KEY = 'developerTimeSheetTasksV1';
const SPEC_SEED_VERSION = '2026-05-01-backend-handoff-v1';
const STATUS_OPTIONS = [
    'Not Started',
    'In Development',
    'Ready for Approval',
    'Completed'
];
const SPEC_TASK_TITLES = [
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

// ── DOM refs ──────────────────────────────────────────────────
const tableBody = document.getElementById('timesheetTableBody');
const addForm = document.getElementById('timesheetAddForm');
const newTaskTitleInput = document.getElementById('newTaskTitle');
const newTaskEstimateInput = document.getElementById('newTaskEstimate');
const savedState = document.getElementById('timesheetSavedState');

const summaryNotStarted = document.getElementById('summaryNotStarted');
const summaryInDevelopment = document.getElementById('summaryInDevelopment');
const summaryReadyForApproval = document.getElementById('summaryReadyForApproval');
const summaryCompleted = document.getElementById('summaryCompleted');

if (!tableBody || !addForm || !newTaskTitleInput || !newTaskEstimateInput) {
    throw new Error('Time sheet: required DOM elements not found.');
}

// ── Module state ──────────────────────────────────────────────
let tasks = [];

// ── Pure helpers ──────────────────────────────────────────────
function normalizeRole(raw) {
    return String(raw || '').trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
}

function normalizeHours(value) {
    if (value === '' || value === null || value === undefined) return '';
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return '';
    return Math.round(parsed * 100) / 100;
}

function titleKey(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function slugStatus(status) {
    return String(status || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function formatDate(isoValue) {
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(date);
}

function updateSavedState(text) {
    if (savedState) savedState.textContent = text;
}

// ── Seed tasks (deterministic IDs for idempotent upsert) ──────
function getSeedTasks() {
    const now = Date.now();
    return SPEC_TASK_TITLES.map((title, index) => ({
        id: 'spec-task-' + String(index + 1).padStart(3, '0'),
        title,
        estimateHours: '',
        timeSpentHours: '',
        comments: '',
        status: 'Not Started',
        updatedAt: new Date(now - (SPEC_TASK_TITLES.length - index) * 1000).toISOString()
    }));
}

// ── Supabase row <-> task conversion ──────────────────────────
function rowToTask(row) {
    return {
        id: row.id,
        title: row.title,
        estimateHours: row.estimate_hours ?? '',
        timeSpentHours: row.time_spent_hours ?? '',
        comments: row.comments || '',
        status: STATUS_OPTIONS.includes(row.status) ? row.status : 'Not Started',
        updatedAt: row.updated_at || new Date().toISOString()
    };
}

function taskToRow(task) {
    return {
        id: task.id,
        title: task.title,
        estimate_hours: task.estimateHours === '' ? null : task.estimateHours,
        time_spent_hours: task.timeSpentHours === '' ? null : task.timeSpentHours,
        comments: task.comments || '',
        status: task.status,
        updated_at: task.updatedAt
    };
}

// ── localStorage cache ────────────────────────────────────────
function cacheTasksLocally() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (_) { /* ignore */ }
}

function loadCachedTasks() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return parsed
            .filter(t => t && t.id && t.title)
            .map(t => ({
                id: String(t.id),
                title: String(t.title),
                estimateHours: normalizeHours(t.estimateHours),
                timeSpentHours: normalizeHours(t.timeSpentHours),
                comments: typeof t.comments === 'string' ? t.comments : '',
                status: STATUS_OPTIONS.includes(t.status) ? t.status : 'Not Started',
                updatedAt: t.updatedAt || new Date().toISOString()
            }));
    } catch (_) {
        return null;
    }
}

// ── Supabase operations ───────────────────────────────────────
async function fetchTasksFromSupabase() {
    const { data, error } = await supabase
        .from('timesheet_tasks')
        .select('*')
        .order('updated_at', { ascending: false });
    if (error) return null;
    return data.map(rowToTask);
}

async function upsertTaskToSupabase(task) {
    const { error } = await supabase.from('timesheet_tasks').upsert(taskToRow(task));
    if (error) console.warn('Timesheet upsert error:', error.message);
}

async function deleteTaskFromSupabase(taskId) {
    const { error } = await supabase.from('timesheet_tasks').delete().eq('id', taskId);
    if (error) console.warn('Timesheet delete error:', error.message);
}

async function insertMissingSeedTasks(remoteTasks) {
    const existingByTitle = Object.create(null);
    remoteTasks.forEach(t => { existingByTitle[titleKey(t.title)] = true; });

    const missing = getSeedTasks().filter(t => !existingByTitle[titleKey(t.title)]);
    if (!missing.length) return remoteTasks;

    const { error } = await supabase.from('timesheet_tasks').upsert(missing.map(taskToRow));
    if (error) console.warn('Seed insert error:', error.message);
    return [...remoteTasks, ...missing];
}

// ── Save (single task) ────────────────────────────────────────
function saveTask(task) {
    cacheTasksLocally();
    updateSavedState('Saving…');
    upsertTaskToSupabase(task)
        .then(() => updateSavedState('Saved ' + formatDate(new Date().toISOString())))
        .catch(() => updateSavedState('Saved locally (server sync failed)'));
}

function removeTask(taskId) {
    tasks = tasks.filter(t => t.id !== taskId);
    cacheTasksLocally();
    render();
    deleteTaskFromSupabase(taskId)
        .then(() => updateSavedState('Deleted ' + formatDate(new Date().toISOString())));
}

// ── Render ────────────────────────────────────────────────────
function updateSummary() {
    const counts = { 'Not Started': 0, 'In Development': 0, 'Ready for Approval': 0, 'Completed': 0 };
    tasks.forEach(t => { if (t.status in counts) counts[t.status] += 1; });
    if (summaryNotStarted) summaryNotStarted.textContent = String(counts['Not Started']);
    if (summaryInDevelopment) summaryInDevelopment.textContent = String(counts['In Development']);
    if (summaryReadyForApproval) summaryReadyForApproval.textContent = String(counts['Ready for Approval']);
    if (summaryCompleted) summaryCompleted.textContent = String(counts['Completed']);
}

function buildStatusSelect(task) {
    const select = document.createElement('select');
    select.className = 'timesheet-select status-' + slugStatus(task.status);
    STATUS_OPTIONS.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        if (status === task.status) option.selected = true;
        select.appendChild(option);
    });
    select.addEventListener('change', () => {
        task.status = select.value;
        task.updatedAt = new Date().toISOString();
        select.className = 'timesheet-select status-' + slugStatus(task.status);
        render();
        saveTask(task);
    });
    return select;
}

function buildHoursInput(task, key) {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '0.25';
    input.className = 'timesheet-input';
    input.value = task[key] === '' ? '' : String(task[key]);
    input.addEventListener('change', () => {
        task[key] = normalizeHours(input.value);
        task.updatedAt = new Date().toISOString();
        saveTask(task);
        render();
    });
    return input;
}

function buildComments(task) {
    const textarea = document.createElement('textarea');
    textarea.className = 'timesheet-textarea';
    textarea.value = task.comments;
    textarea.placeholder = 'Work notes, blockers, or details for review';
    textarea.addEventListener('change', () => {
        task.comments = textarea.value.trim();
        task.updatedAt = new Date().toISOString();
        saveTask(task);
        render();
    });
    return textarea;
}

function buildRow(task) {
    const tr = document.createElement('tr');

    const titleCell = document.createElement('td');
    const titleWrap = document.createElement('div');
    titleWrap.className = 'timesheet-task-title';
    const titleEl = document.createElement('strong');
    titleEl.textContent = task.title;
    titleWrap.appendChild(titleEl);
    titleCell.appendChild(titleWrap);

    const estimateCell = document.createElement('td');
    estimateCell.appendChild(buildHoursInput(task, 'estimateHours'));

    const spentCell = document.createElement('td');
    spentCell.appendChild(buildHoursInput(task, 'timeSpentHours'));

    const commentsCell = document.createElement('td');
    commentsCell.appendChild(buildComments(task));

    const statusCell = document.createElement('td');
    statusCell.appendChild(buildStatusSelect(task));

    const updatedCell = document.createElement('td');
    const updatedLabel = document.createElement('span');
    updatedLabel.className = 'timesheet-updated';
    updatedLabel.textContent = formatDate(task.updatedAt);
    updatedCell.appendChild(updatedLabel);

    const actionsCell = document.createElement('td');
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'timesheet-delete-btn';
    removeButton.setAttribute('aria-label', 'Remove task');
    removeButton.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
    removeButton.addEventListener('click', () => removeTask(task.id));
    actionsCell.appendChild(removeButton);

    tr.append(titleCell, estimateCell, spentCell, commentsCell, statusCell, updatedCell, actionsCell);
    return tr;
}

function renderEmpty() {
    tableBody.textContent = '';
    const row = document.createElement('tr');
    const cell = document.createElement('td');
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
    const ordered = tasks.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    tableBody.textContent = '';
    ordered.forEach(task => tableBody.appendChild(buildRow(task)));
    updateSummary();
}

// ── Add task form ─────────────────────────────────────────────
addForm.addEventListener('submit', event => {
    event.preventDefault();
    const title = String(newTaskTitleInput.value || '').trim();
    const estimate = normalizeHours(newTaskEstimateInput.value);
    if (!title) { newTaskTitleInput.focus(); return; }

    const newTask = {
        id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7),
        title,
        estimateHours: estimate,
        timeSpentHours: '',
        comments: '',
        status: 'Not Started',
        updatedAt: new Date().toISOString()
    };

    tasks.unshift(newTask);
    newTaskTitleInput.value = '';
    newTaskEstimateInput.value = '';

    saveTask(newTask);
    render();
});

// ── Init (auth gate + load) ───────────────────────────────────
async function init() {
    // Fast check: role stored in localStorage from login
    const storedRole = normalizeRole(localStorage.getItem('accountRole'));

    if (!DEV_ROLES.has(storedRole)) {
        // localStorage has no valid dev role — verify live session as fallback
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        const { data: userRow } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();
        if (!DEV_ROLES.has(normalizeRole(userRow?.role))) {
            window.location.href = 'index.html';
            return;
        }
    }

    updateSavedState('Loading…');

    const remoteTasks = await fetchTasksFromSupabase();

    if (remoteTasks !== null) {
        // Supabase is reachable — seed any missing spec tasks then render
        tasks = await insertMissingSeedTasks(remoteTasks);
        cacheTasksLocally();
        updateSavedState('Loaded from server ' + formatDate(new Date().toISOString()));
    } else {
        // Supabase unreachable — fall back to localStorage cache
        tasks = loadCachedTasks() || getSeedTasks();
        updateSavedState('Working offline (changes saved locally only)');
    }

    render();
}

init();
