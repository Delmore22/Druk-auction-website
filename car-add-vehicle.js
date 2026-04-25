// Car Add Vehicle Page Script

var siteNoticeController = null;
var siteConfirmController = null;
var ADD_VEHICLE_DRAFT_KEY = 'addVehicleManualDraftV1';
var VEHICLE_SUBMISSIONS_TABLE = 'vehicle_submissions';
var DEFAULT_VEHICLE_SUBMISSIONS_BUCKET = 'vehicle-submission-photos';
var vehicleSubmissionSupabaseClient = null;
var vehicleSubmissionSupabaseBucket = DEFAULT_VEHICLE_SUBMISSIONS_BUCKET;

document.addEventListener('components:ready', function () {
    initSiteNotice();
    initSiteConfirm();
    initializeVehicleSubmissionSupabase();
    initAddVehicleToggle();
    initInventoryProviders();
    initAddVehicleForm();
    initManualEntryEnhancements();
    initBackButton();
});

function getVehicleSubmissionConfig() {
    return window.ADD_VEHICLE_SUPABASE_CONFIG || {};
}

function looksLikePlaceholderConfigValue(value) {
    return !value || /your[-_ ]/i.test(value) || /replace[-_ ]/i.test(value);
}

function hasValidVehicleSubmissionConfig() {
    var config = getVehicleSubmissionConfig();
    return !looksLikePlaceholderConfigValue(config.url) && !looksLikePlaceholderConfigValue(config.anonKey);
}

function initializeVehicleSubmissionSupabase() {
    var config;

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        return false;
    }

    if (!hasValidVehicleSubmissionConfig()) {
        return false;
    }

    config = getVehicleSubmissionConfig();
    vehicleSubmissionSupabaseBucket = config.bucket || DEFAULT_VEHICLE_SUBMISSIONS_BUCKET;
    vehicleSubmissionSupabaseClient = window.supabase.createClient(config.url, config.anonKey);
    return true;
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

function generateVehicleSubmissionId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }

    return 'vehicle-submission-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function sanitizeSubmissionFileName(name) {
    return String(name || 'upload')
        .toLowerCase()
        .replace(/[^a-z0-9.\-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function collectSubmissionAttachmentPaths(items) {
    return (Array.isArray(items) ? items : []).reduce(function (paths, item) {
        if (item && item.path) {
            paths.push(item.path);
        }
        return paths;
    }, []);
}

async function uploadSubmissionPhotos(submissionId, files) {
    var uploaded = [];
    var storage;

    if (!vehicleSubmissionSupabaseClient || !Array.isArray(files) || !files.length) {
        return uploaded;
    }

    storage = vehicleSubmissionSupabaseClient.storage.from(vehicleSubmissionSupabaseBucket);

    for (var index = 0; index < files.length; index += 1) {
        var file = files[index];
        var safeName = sanitizeSubmissionFileName(file && file.name);
        var filePath = submissionId + '/' + (index + 1) + '-' + safeName;
        var uploadResult = await storage.upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

        if (uploadResult.error) {
            throw uploadResult.error;
        }

        var publicUrlResult = storage.getPublicUrl(filePath);
        uploaded.push({
            name: file.name || safeName,
            type: file.type || '',
            sizeBytes: file.size || 0,
            path: filePath,
            url: publicUrlResult && publicUrlResult.data ? publicUrlResult.data.publicUrl : ''
        });
    }

    return uploaded;
}

async function removeSubmissionPhotos(paths) {
    if (!vehicleSubmissionSupabaseClient || !Array.isArray(paths) || !paths.length) {
        return;
    }

    await vehicleSubmissionSupabaseClient.storage.from(vehicleSubmissionSupabaseBucket).remove(paths);
}

function getFileArray(input) {
    if (!input || !input.files) {
        return [];
    }

    return Array.prototype.slice.call(input.files);
}

function buildVehicleSubmissionRecord(vehicleData, photoAttachments) {
    var photos = Array.isArray(photoAttachments) ? photoAttachments : [];
    var normalizedPayload = createSubmissionPreviewPayload(vehicleData);
    var summaryLabel = [vehicleData.year, vehicleData.make, vehicleData.model].filter(Boolean).join(' ');

    normalizedPayload.photos = photos;

    return {
        vin: vehicleData.vin || null,
        year: vehicleData.year ? String(vehicleData.year) : null,
        make: vehicleData.make || null,
        model: vehicleData.model || null,
        seller_name: vehicleData.sellerContactName || null,
        seller_company: vehicleData.sellerCompanyName || null,
        seller_email: vehicleData.sellerContactEmail || null,
        status_label: 'Submitted for Review',
        review_status: 'pending',
        review_notes: null,
        summary_label: summaryLabel || 'Vehicle Submission',
        submitted_payload: normalizedPayload,
        submitted_at: new Date().toISOString()
    };
}

function initAddVehicleToggle() {
    var toggles = document.querySelectorAll('.option-toggle');
    var importSection = document.getElementById('importInventory');
    var formSection = document.getElementById('addVehicleForm');

    toggles.forEach(function (toggle) {
        toggle.addEventListener('click', function () {
            var option = this.getAttribute('data-option');

            // Update active state
            toggles.forEach(function (t) {
                t.classList.remove('active');
            });
            toggle.classList.add('active');

            // Show/hide sections
            if (option === 'import-inventory') {
                importSection.classList.add('active');
                formSection.hidden = true;
            } else {
                importSection.classList.remove('active');
                formSection.hidden = false;
            }
        });
    });
}

function initInventoryProviders() {
    var providerButtons = document.querySelectorAll('.btn-connect');

    providerButtons.forEach(function (button) {
        button.addEventListener('click', function (event) {
            event.preventDefault();
            var provider = this.getAttribute('data-provider');
            handleProviderConnection(provider);
        });
    });
}

function handleProviderConnection(provider) {
    console.log('Connecting to provider:', provider);

    switch (provider) {
        case 'manheim':
            connectManheim();
            break;
        case 'nada':
            connectNADA();
            break;
        case 'csv':
            uploadCSV();
            break;
        default:
            console.log('Unknown provider');
    }
}

function connectManheim() {
    // TODO: Implement Manheim OAuth/API connection
    showSiteNotice('Integration Preview', 'Manheim integration coming soon...');
    simulateInventoryLoad([
        { id: 1, year: 2019, make: 'Tesla', model: 'Model S', vin: 'VIN123456' },
        { id: 2, year: 2020, make: 'BMW', model: '740i', vin: 'VIN789012' }
    ]);
}

function connectNADA() {
    // TODO: Implement NADA Guides connection
    showSiteNotice('Integration Preview', 'NADA Guides integration coming soon...');
    simulateInventoryLoad([
        { id: 3, year: 2018, make: 'Mercedes', model: 'E-Class', vin: 'VIN345678' }
    ]);
}

function uploadCSV() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.addEventListener('change', function () {
        if (this.files.length > 0) {
            console.log('Uploading CSV:', this.files[0].name);
            // TODO: Parse CSV and load vehicles
            showSiteNotice('CSV Upload', 'CSV import from file: ' + this.files[0].name);
        }
    });
    input.click();
}

function initSiteNotice() {
    var modal = document.getElementById('siteNoticeModal');
    var title = document.getElementById('siteNoticeTitle');
    var message = document.getElementById('siteNoticeMessage');
    var okButton = document.getElementById('siteNoticeOkBtn');
    var closeButtons;
    var lastFocusedElement = null;

    if (!modal || !title || !message || !okButton) {
        return;
    }

    closeButtons = modal.querySelectorAll('[data-close-site-notice]');

    siteNoticeController = {
        open: function (heading, body) {
            lastFocusedElement = document.activeElement;
            title.textContent = heading || 'Notice';
            message.textContent = body || '';
            modal.hidden = false;
            document.body.classList.add('preview-modal-open');
            window.setTimeout(function () {
                okButton.focus();
            }, 0);
        },
        close: function () {
            modal.hidden = true;
            document.body.classList.remove('preview-modal-open');
            if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
                lastFocusedElement.focus();
            }
        }
    };

    closeButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            siteNoticeController.close();
        });
    });

    okButton.addEventListener('click', function () {
        siteNoticeController.close();
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && siteNoticeController && !modal.hidden) {
            siteNoticeController.close();
        }
    });
}

function showSiteNotice(title, message) {
    if (!siteNoticeController) {
        return;
    }

    siteNoticeController.open(title, message);
}

function initSiteConfirm() {
    var modal = document.getElementById('siteConfirmModal');
    var title = document.getElementById('siteConfirmTitle');
    var message = document.getElementById('siteConfirmMessage');
    var okButton = document.getElementById('siteConfirmOkBtn');
    var cancelButton = document.getElementById('siteConfirmCancelBtn');
    var closeButtons;
    var lastFocusedElement = null;
    var pendingAction = null;

    if (!modal || !title || !message || !okButton || !cancelButton) {
        return;
    }

    closeButtons = modal.querySelectorAll('[data-close-site-confirm]');

    siteConfirmController = {
        open: function (heading, body, confirmLabel, onConfirm) {
            lastFocusedElement = document.activeElement;
            pendingAction = typeof onConfirm === 'function' ? onConfirm : null;
            title.textContent = heading || 'Confirm Action';
            message.textContent = body || '';
            okButton.textContent = confirmLabel || 'Confirm';
            modal.hidden = false;
            document.body.classList.add('preview-modal-open');
            window.setTimeout(function () {
                okButton.focus();
            }, 0);
        },
        close: function () {
            pendingAction = null;
            modal.hidden = true;
            document.body.classList.remove('preview-modal-open');
            if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
                lastFocusedElement.focus();
            }
        },
        confirm: function () {
            var action = pendingAction;
            pendingAction = null;
            modal.hidden = true;
            document.body.classList.remove('preview-modal-open');
            if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
                lastFocusedElement.focus();
            }
            if (action) {
                action();
            }
        }
    };

    closeButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            siteConfirmController.close();
        });
    });

    cancelButton.addEventListener('click', function () {
        siteConfirmController.close();
    });

    okButton.addEventListener('click', function () {
        siteConfirmController.confirm();
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && siteConfirmController && !modal.hidden) {
            siteConfirmController.close();
        }
    });
}

function showSiteConfirm(title, message, confirmLabel, onConfirm) {
    if (!siteConfirmController) {
        return;
    }

    siteConfirmController.open(title, message, confirmLabel, onConfirm);
}

function simulateInventoryLoad(vehicles) {
    var connectedResources = document.getElementById('connectedResources');
    var resourceList = document.getElementById('resourceList');

    resourceList.innerHTML = '';

    vehicles.forEach(function (vehicle) {
        var vehicleElement = document.createElement('div');
        vehicleElement.className = 'resource-item';
        vehicleElement.innerHTML = '<div>' +
            '<h4>' + vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model + '</h4>' +
            '<p>VIN: ' + vehicle.vin + '</p>' +
            '</div>' +
            '<div class="resource-item-actions">' +
            '<button type="button" class="btn-import-item" data-vehicle-id="' + vehicle.id + '">Import</button>' +
            '</div>';

        resourceList.appendChild(vehicleElement);
    });

    connectedResources.removeAttribute('hidden');
}

function initAddVehicleForm() {
    var form = document.getElementById('addVehicleForm');
    var cancelBtn = document.getElementById('cancelBtn');
    var submitButtons;
    var draftController;

    if (!form) return;

    form.setAttribute('novalidate', 'novalidate');
    draftController = initFormDraftAutoSave(form);
    initRequiredFieldValidation(form);
    initSubmissionPreview(form);
    submitButtons = form.querySelectorAll('[type="submit"]');

    submitButtons.forEach(function (button) {
        button.addEventListener('pointerdown', function () {
            form.dataset.submitIntent = 'true';
        });

        button.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
                form.dataset.submitIntent = 'true';
            }
        });
    });

    // Handle form submission
    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        form.dataset.submitIntent = 'false';

        if (!validateForm()) {
            console.log('Form validation failed');
            return;
        }

        var vehicleData = collectVehicleData(form);
        var submitButton = form.querySelector('.btn-submit');
        var originalLabel = submitButton ? submitButton.textContent : '';

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';
        }

        try {
            var submitResult = await submitVehicle(vehicleData);
            if (submitResult && submitResult.saved && draftController) {
                draftController.clear();
            }
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalLabel;
            }
        }
    });

    // Handle cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function (e) {
            e.preventDefault();
            openCancelAllModal();
        });
    }

    function openCancelAllModal() {
        var modal = document.getElementById('cancelAllModal');
        var cancelBtn = document.getElementById('cancelAllCancelBtn');
        var confirmBtn = document.getElementById('cancelAllConfirmBtn');
        if (!modal || !cancelBtn || !confirmBtn) return;
        modal.hidden = false;
        document.body.classList.add('preview-modal-open');
        confirmBtn.focus();

        function closeModal() {
            modal.hidden = true;
            document.body.classList.remove('preview-modal-open');
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
            modal.querySelectorAll('[data-close-cancel-all]').forEach(function (el) {
                el.removeEventListener('click', onCancel);
            });
        }
        function onCancel() { closeModal(); }
        function onConfirm() {
            clearAllFields();
            closeModal();
        }
        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        modal.querySelectorAll('[data-close-cancel-all]').forEach(function (el) {
            el.addEventListener('click', onCancel);
        });
    }

    function clearAllFields() {
        // Clear all form fields
        var form = document.getElementById('addVehicleForm');
        if (!form) return;
        form.reset();
        // Clear VIN and decoder fields
        var vinInput = document.getElementById('vehicleVin');
        if (vinInput) vinInput.value = '';
        var decodedFieldIds = [
            'vehicleYear', 'vehicleMake', 'vehicleModel', 'vehicleBodyType',
            'vehicleTrim', 'vehicleEngine', 'vehicleTransmission',
            'vehicleDriveTrain', 'vehicleFuelType'
        ];
        decodedFieldIds.forEach(function (fieldId) {
            var field = document.getElementById(fieldId);
            if (field) field.value = '';
        });
        // Clear localStorage draft
        try {
            window.localStorage.removeItem(ADD_VEHICLE_DRAFT_KEY);
        } catch (e) {}
    }
}

function initFormDraftAutoSave(form) {
    var debounceTimer = null;
    var controls = [];
    var restoring = false;
    var notice = document.getElementById('draftRestoreNotice');

    if (!form || !window.localStorage) {
        return null;
    }

    controls = Array.prototype.slice.call(form.querySelectorAll('input[name], select[name], textarea[name]')).filter(function (control) {
        return control.type !== 'file';
    });

    function getControlKey(control) {
        return [control.tagName.toLowerCase(), control.type || 'text', control.name].join('::');
    }

    function formatDraftTime(savedAtIso) {
        var savedAtDate;

        if (!savedAtIso) {
            return '';
        }

        savedAtDate = new Date(savedAtIso);
        if (Number.isNaN(savedAtDate.getTime())) {
            return '';
        }

        return savedAtDate.toLocaleString();
    }

    function setDraftRestoreNotice(savedAtIso) {
        var label = formatDraftTime(savedAtIso);

        if (!notice) {
            return;
        }

        if (!label) {
            notice.hidden = true;
            notice.textContent = '';
            return;
        }

        notice.textContent = 'Draft restored from ' + label + '.';
        notice.hidden = false;
    }

    function buildDraftPayload() {
        var keyCounters = {};

        return {
            savedAt: new Date().toISOString(),
            values: controls.map(function (control) {
                var key = getControlKey(control);
                var position = keyCounters[key] || 0;
                keyCounters[key] = position + 1;

                return {
                    key: key,
                    position: position,
                    checked: control.type === 'checkbox' || control.type === 'radio' ? control.checked : null,
                    value: control.value
                };
            })
        };
    }

    function saveDraftNow() {
        var payload;

        if (restoring) {
            return;
        }

        payload = buildDraftPayload();
        window.localStorage.setItem(ADD_VEHICLE_DRAFT_KEY, JSON.stringify(payload));
    }

    function scheduleDraftSave() {
        if (restoring) {
            return;
        }

        if (debounceTimer) {
            window.clearTimeout(debounceTimer);
        }

        debounceTimer = window.setTimeout(saveDraftNow, 700);
    }

    function restoreDraftIfAvailable() {
        var raw = window.localStorage.getItem(ADD_VEHICLE_DRAFT_KEY);
        var parsed;
        var entries;
        var indexByKeyPosition = {};

        if (!raw) {
            return;
        }

        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            return;
        }

        if (!parsed || !Array.isArray(parsed.values)) {
            return;
        }

        entries = parsed.values;
        entries.forEach(function (entry) {
            if (!entry || typeof entry.key !== 'string') return;
            indexByKeyPosition[entry.key + '::' + String(entry.position || 0)] = entry;
        });

        restoring = true;

        (function applyEntries() {
            var keyCounters = {};

            controls.forEach(function (control) {
                var key = getControlKey(control);
                var position = keyCounters[key] || 0;
                var entry = indexByKeyPosition[key + '::' + String(position)];

                keyCounters[key] = position + 1;
                if (!entry) return;

                if (control.type === 'checkbox' || control.type === 'radio') {
                    control.checked = Boolean(entry.checked);
                } else {
                    control.value = typeof entry.value === 'string' ? entry.value : '';
                }

                control.dispatchEvent(new Event('input', { bubbles: true }));
                control.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }());

        restoring = false;
        return parsed.savedAt || '';
    }

    controls.forEach(function (control) {
        control.addEventListener('input', scheduleDraftSave);
        control.addEventListener('change', scheduleDraftSave);
    });

    setDraftRestoreNotice(restoreDraftIfAvailable());

    return {
        clear: function () {
            window.localStorage.removeItem(ADD_VEHICLE_DRAFT_KEY);
            setDraftRestoreNotice('');
        }
    };
}

function initSubmissionPreview(form) {
    var previewButton = document.getElementById('previewSubmissionBtn');
    var downloadButton = document.getElementById('downloadSampleBtn');
    var downloadCsvButton = document.getElementById('downloadSampleCsvBtn');
    var downloadPreviewButton = document.getElementById('downloadPreviewJsonBtn');
    var downloadPreviewCsvButton = document.getElementById('downloadPreviewCsvBtn');
    var modal = document.getElementById('submissionPreviewModal');
    var previewContent = document.getElementById('submissionPreviewContent');
    var closeButtons;
    var currentPreviewPayload = null;

    if (!form || !previewButton || !downloadButton || !downloadCsvButton || !downloadPreviewButton || !downloadPreviewCsvButton || !modal || !previewContent) {
        return;
    }

    closeButtons = modal.querySelectorAll('[data-close-preview]');

    [previewButton, downloadButton, downloadCsvButton].forEach(function (button) {
        button.addEventListener('pointerdown', function () {
            form.dataset.submitIntent = 'true';
        });

        button.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
                form.dataset.submitIntent = 'true';
            }
        });
    });

    var closePreview = function () {
        modal.hidden = true;
        document.body.classList.remove('preview-modal-open');
    };

    var openPreview = function (payload) {
        currentPreviewPayload = payload;
        previewContent.textContent = JSON.stringify(payload, null, 2);
        modal.hidden = false;
        document.body.classList.add('preview-modal-open');
    };

    var preparePreviewPayload = function () {
        form.dataset.submitIntent = 'false';

        if (!validateForm()) {
            return null;
        }

        return createSubmissionPreviewPayload(collectVehicleData(form));
    };

    previewButton.addEventListener('click', function () {
        var payload = preparePreviewPayload();
        if (!payload) {
            return;
        }

        openPreview(payload);
    });

    downloadButton.addEventListener('click', function () {
        var payload = preparePreviewPayload();
        if (!payload) {
            return;
        }

        downloadSubmissionPayload(payload, 'json');
    });

    downloadCsvButton.addEventListener('click', function () {
        var payload = preparePreviewPayload();
        if (!payload) {
            return;
        }

        downloadSubmissionPayload(payload, 'csv');
    });

    downloadPreviewButton.addEventListener('click', function () {
        if (!currentPreviewPayload) {
            return;
        }

        downloadSubmissionPayload(currentPreviewPayload, 'json');
    });

    downloadPreviewCsvButton.addEventListener('click', function () {
        if (!currentPreviewPayload) {
            return;
        }

        downloadSubmissionPayload(currentPreviewPayload, 'csv');
    });

    closeButtons.forEach(function (button) {
        button.addEventListener('click', closePreview);
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !modal.hidden) {
            closePreview();
        }
    });
}

function collectVehicleData(form) {
    var formData = new FormData(form);
    var vehicleData = serializeFormData(formData);
    var auctionWindow = deriveAuctionWindowFromFormData(formData);

    if (auctionWindow) {
        vehicleData.auctionStartAt = auctionWindow.startAt;
        vehicleData.auctionEndAt = auctionWindow.endAt;
    }

    return vehicleData;
}

function createSubmissionPreviewPayload(vehicleData) {
    return normalizeSubmissionValue(vehicleData);
}

function normalizeSubmissionValue(value) {
    var normalized;
    var keys;

    if (value instanceof File) {
        return {
            name: value.name,
            type: value.type,
            sizeBytes: value.size,
            lastModified: value.lastModified ? new Date(value.lastModified).toISOString() : null
        };
    }

    if (Array.isArray(value)) {
        return value.map(normalizeSubmissionValue);
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (value && typeof value === 'object') {
        normalized = {};
        keys = Object.keys(value);
        keys.forEach(function (key) {
            normalized[key] = normalizeSubmissionValue(value[key]);
        });
        return normalized;
    }

    return value;
}

function downloadSubmissionPayload(payload, format) {
    var timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    var normalizedFormat = format === 'csv' ? 'csv' : 'json';
    var filename = 'vehicle-submission-sample-' + timestamp + '.' + normalizedFormat;
    var fileContents = normalizedFormat === 'csv'
        ? convertPayloadToCsv(payload)
        : JSON.stringify(payload, null, 2);
    var mimeType = normalizedFormat === 'csv' ? 'text/csv;charset=utf-8' : 'application/json';
    var blob = new Blob([fileContents], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 0);
}

function convertPayloadToCsv(payload) {
    var flattened = flattenPayloadForCsv(payload);
    var headers = Object.keys(flattened);
    var values = headers.map(function (header) {
        return escapeCsvValue(flattened[header]);
    });

    return headers.map(escapeCsvValue).join(',') + '\r\n' + values.join(',');
}

function flattenPayloadForCsv(payload) {
    var flat = {};

    var visit = function (value, prefix) {
        var keys;

        if (Array.isArray(value)) {
            flat[prefix] = JSON.stringify(value);
            return;
        }

        if (value && typeof value === 'object') {
            keys = Object.keys(value);

            if (keys.length === 0) {
                flat[prefix] = '';
                return;
            }

            keys.forEach(function (key) {
                var nextPrefix = prefix ? prefix + '.' + key : key;
                visit(value[key], nextPrefix);
            });
            return;
        }

        flat[prefix] = value == null ? '' : String(value);
    };

    Object.keys(payload).forEach(function (key) {
        visit(payload[key], key);
    });

    return flat;
}

function escapeCsvValue(value) {
    var normalized = value == null ? '' : String(value);

    if (/[",\r\n]/.test(normalized)) {
        return '"' + normalized.replace(/"/g, '""') + '"';
    }

    return normalized;
}

function initManualEntryEnhancements() {
    initConditionRowButtons();
    initKeyRowButtons();
    initEquipmentCheckAll();
    initVinDecoder();
    initPickupLocationAutocomplete();
    initAnnouncementCounter();
    initPhotoPreview();
    initListingDurationPreview();
    initManualJumpNavigation();
}

function initVinDecoder() {
    var vinInput = document.getElementById('vehicleVin');
    var decodeButton = document.getElementById('decodeVinBtn');
    var statusEl = document.getElementById('vinDecodeStatus');

    var clearVinBtn = document.getElementById('clearVinBtn');
    if (clearVinBtn) {
        clearVinBtn.addEventListener('click', function () {
            // Clear VIN and decode status
            vinInput.value = '';
            setStatus('', null);

            // Clear all fields the decoder populates so a new decode starts fresh
            var decodedFieldIds = [
                'vehicleYear', 'vehicleMake', 'vehicleModel', 'vehicleBodyType',
                'vehicleTrim', 'vehicleEngine', 'vehicleTransmission',
                'vehicleDriveTrain', 'vehicleFuelType'
            ];
            decodedFieldIds.forEach(function (fieldId) {
                var field = document.getElementById(fieldId);
                if (field) {
                    field.value = '';
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            // Remove VIN and decoded fields from draft
            try {
                var draft = JSON.parse(window.localStorage.getItem(ADD_VEHICLE_DRAFT_KEY) || '{}');
                if (draft && typeof draft === 'object') {
                    var toClear = ['vin', 'year', 'make', 'model', 'bodyType', 'trim', 'engine', 'transmission', 'driveTrain', 'fuelType'];
                    toClear.forEach(function (key) { draft[key] = ''; });
                    window.localStorage.setItem(ADD_VEHICLE_DRAFT_KEY, JSON.stringify(draft));
                }
            } catch (e) {}

            vinInput.focus();
        });
    }

    if (!vinInput || !decodeButton || !statusEl) return;

    function sanitizeVin(raw) {
        return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    function setStatus(message, type) {
        statusEl.textContent = message || '';
        statusEl.classList.remove('is-success', 'is-warning', 'is-error');

        if (type === 'success') {
            statusEl.classList.add('is-success');
        } else if (type === 'warning') {
            statusEl.classList.add('is-warning');
        } else if (type === 'error') {
            statusEl.classList.add('is-error');
        }
    }

    function mapBodyStyle(bodyClass) {
        var normalized = String(bodyClass || '').toLowerCase();
        if (!normalized) return '';
        if (normalized.indexOf('sport utility') >= 0 || normalized.indexOf('utility') >= 0 || normalized.indexOf('crossover') >= 0) return 'SUV';
        if (normalized.indexOf('pickup') >= 0 || normalized.indexOf('truck') >= 0) return 'Truck';
        if (normalized.indexOf('convertible') >= 0 || normalized.indexOf('cabriolet') >= 0 || normalized.indexOf('roadster') >= 0) return 'Convertible';
        if (normalized.indexOf('wagon') >= 0 || normalized.indexOf('estate') >= 0) return 'Wagon';
        if (normalized.indexOf('coupe') >= 0) return 'Coupe';
        if (normalized.indexOf('sedan') >= 0 || normalized.indexOf('saloon') >= 0) return 'Sedan';
        return '';
    }

    function mapTransmission(transmissionStyle) {
        var normalized = String(transmissionStyle || '').toLowerCase();
        if (!normalized) return '';
        if (normalized.indexOf('continuously variable') >= 0 || normalized.indexOf('cvt') >= 0) return 'CVT';
        if (normalized.indexOf('manual') >= 0) return 'Manual';
        if (normalized.indexOf('automatic') >= 0) return 'Automatic';
        return '';
    }

    function mapDriveTrain(driveType) {
        var normalized = String(driveType || '').toLowerCase();
        if (!normalized) return '';
        if (normalized.indexOf('all-wheel') >= 0 || normalized.indexOf('awd') >= 0) return 'AWD';
        if (normalized.indexOf('4x4') >= 0 || normalized.indexOf('four-wheel') >= 0 || normalized.indexOf('4wd') >= 0) return '4WD';
        if (normalized.indexOf('front-wheel') >= 0 || normalized.indexOf('fwd') >= 0) return 'FWD';
        if (normalized.indexOf('rear-wheel') >= 0 || normalized.indexOf('rwd') >= 0) return 'RWD';
        return '';
    }

    function mapFuelType(fuelType) {
        var normalized = String(fuelType || '').toLowerCase();
        if (!normalized) return '';
        if (normalized.indexOf('electric') >= 0) return 'Electric';
        if (normalized.indexOf('hybrid') >= 0) return 'Hybrid';
        if (normalized.indexOf('diesel') >= 0) return 'Diesel';
        if (normalized.indexOf('gas') >= 0 || normalized.indexOf('gasoline') >= 0 || normalized.indexOf('petrol') >= 0) return 'Gasoline';
        return '';
    }

    function mapEngineCylinders(cylinders) {
        var numeric = parseInt(String(cylinders || '').replace(/[^0-9]/g, ''), 10);
        if (Number.isNaN(numeric)) return '';
        if (numeric === 4) return 'I4';
        if (numeric === 6) return 'V6';
        if (numeric === 8) return 'V8';
        return '';
    }

    function setFieldIfEmpty(fieldId, value) {
        var field = document.getElementById(fieldId);
        var normalizedValue = String(value || '').trim();
        if (!field || !normalizedValue) return false;
        if (String(field.value || '').trim()) return false;

        if (field.tagName === 'SELECT') {
            var hasOption = Array.prototype.some.call(field.options, function (option) {
                return option.value === normalizedValue;
            });

            if (!hasOption) {
                return false;
            }
        }

        field.value = normalizedValue;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    function buildDecodeEndpoint(vin, modelYear) {
        var endpoint = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/' + encodeURIComponent(vin) + '?format=json';
        if (modelYear) {
            endpoint += '&modelyear=' + encodeURIComponent(modelYear);
        }
        return endpoint;
    }

    function decodeVin() {
        var vin = sanitizeVin(vinInput.value);
        var modelYearField = document.getElementById('vehicleYear');
        var modelYear = modelYearField && modelYearField.value ? modelYearField.value : '';

        if (vin.length < 5) {
            setStatus('Enter at least 5 VIN characters before decoding.', 'warning');
            return;
        }

        vinInput.value = vin;
        decodeButton.disabled = true;
        setStatus('Decoding VIN...', 'warning');

        fetch(buildDecodeEndpoint(vin, modelYear))
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function (payload) {
                var result = payload && Array.isArray(payload.Results) ? payload.Results[0] : null;
                var fillCount = 0;

                if (!result) {
                    setStatus('No VIN data returned from decoder.', 'error');
                    return;
                }

                fillCount += setFieldIfEmpty('vehicleYear', result.ModelYear) ? 1 : 0;
                fillCount += setFieldIfEmpty('vehicleMake', result.Make) ? 1 : 0;
                fillCount += setFieldIfEmpty('vehicleModel', result.Model) ? 1 : 0;
                fillCount += setFieldIfEmpty('vehicleBodyType', mapBodyStyle(result.BodyClass)) ? 1 : 0;
                fillCount += setFieldIfEmpty('vehicleTrim', result.Trim || result.Series || result.Trim2) ? 1 : 0;
                fillCount += setFieldIfEmpty('vehicleEngine', mapEngineCylinders(result.EngineCylinders)) ? 1 : 0;
                fillCount += setFieldIfEmpty('vehicleTransmission', mapTransmission(result.TransmissionStyle)) ? 1 : 0;
                fillCount += setFieldIfEmpty('vehicleDriveTrain', mapDriveTrain(result.DriveType)) ? 1 : 0;
                fillCount += setFieldIfEmpty('vehicleFuelType', mapFuelType(result.FuelTypePrimary)) ? 1 : 0;

                if (fillCount > 0) {
                    setStatus('VIN decoded. Auto-filled ' + fillCount + ' field' + (fillCount === 1 ? '' : 's') + '.', 'success');
                } else {
                    setStatus('VIN decoded, but no empty fields matched mappable values.', 'warning');
                }
            })
            .catch(function () {
                setStatus('VIN decode failed. Check network or try manual entry.', 'error');
            })
            .finally(function () {
                decodeButton.disabled = false;
            });
    }

    decodeButton.addEventListener('click', decodeVin);
}

function initPickupLocationAutocomplete() {
    var input = document.getElementById('vehiclePickupLocation');
    var providerSelect = document.getElementById('pickupLocationProvider');
    var suggestions = document.getElementById('pickupLocationSuggestions');
    var hint = document.getElementById('pickupLocationHint');
    var structuredFields;
    var state;

    if (!input || !providerSelect || !suggestions) return;

    structuredFields = {
        street: document.getElementById('pickupStreet'),
        city: document.getElementById('pickupCity'),
        state: document.getElementById('pickupState'),
        postalCode: document.getElementById('pickupPostalCode'),
        country: document.getElementById('pickupCountry'),
        lat: document.getElementById('pickupLat'),
        lng: document.getElementById('pickupLng'),
        placeId: document.getElementById('pickupPlaceId')
    };

    state = {
        activeProvider: providerSelect.value || 'manual',
        suggestionItems: [],
        highlightedIndex: -1,
        debounceTimer: null,
        googleAutocomplete: null,
        googleScriptPromise: null,
        googleListenerAttached: false,
        selectedFromAutocomplete: false
    };

    var publicConfig = window.ADD_VEHICLE_AUTOCOMPLETE_CONFIG || {};
    var googleKey = publicConfig.googleApiKey || '';
    var mapboxToken = publicConfig.mapboxAccessToken || '';

    function clearStructuredFields() {
        Object.keys(structuredFields).forEach(function (key) {
            if (structuredFields[key]) {
                structuredFields[key].value = '';
            }
        });
    }

    function hideSuggestions() {
        suggestions.hidden = true;
        suggestions.innerHTML = '';
        state.suggestionItems = [];
        state.highlightedIndex = -1;
    }

    function setHint(message) {
        if (hint) {
            hint.textContent = message;
        }
    }

    function updateSelectionIndex(nextIndex) {
        var buttons = suggestions.querySelectorAll('.pickup-location-option');
        state.highlightedIndex = nextIndex;
        buttons.forEach(function (button, index) {
            button.classList.toggle('is-active', index === state.highlightedIndex);
        });
    }

    function parseMapboxContext(feature) {
        var placeName = feature && feature.place_name ? feature.place_name : '';
        var firstSegment = placeName.split(',')[0] || '';
        var context = Array.isArray(feature && feature.context) ? feature.context : [];
        var place = context.find(function (entry) {
            return entry.id && entry.id.indexOf('place') === 0;
        });
        var region = context.find(function (entry) {
            return entry.id && entry.id.indexOf('region') === 0;
        });
        var postcode = context.find(function (entry) {
            return entry.id && entry.id.indexOf('postcode') === 0;
        });
        var country = context.find(function (entry) {
            return entry.id && entry.id.indexOf('country') === 0;
        });
        var stateCode = region && region.short_code
            ? String(region.short_code).split('-').pop().toUpperCase()
            : '';

        return {
            label: placeName,
            street: (feature && feature.address ? feature.address + ' ' : '') + firstSegment,
            city: place ? place.text : '',
            state: stateCode,
            postalCode: postcode ? postcode.text : '',
            country: country ? (country.short_code || country.text || '') : '',
            lat: feature && feature.center ? String(feature.center[1] || '') : '',
            lng: feature && feature.center ? String(feature.center[0] || '') : '',
            placeId: feature && feature.id ? feature.id : ''
        };
    }

    function applySelection(selection) {
        input.value = selection.label || '';
        if (structuredFields.street) structuredFields.street.value = selection.street || '';
        if (structuredFields.city) structuredFields.city.value = selection.city || '';
        if (structuredFields.state) structuredFields.state.value = selection.state || '';
        if (structuredFields.postalCode) structuredFields.postalCode.value = selection.postalCode || '';
        if (structuredFields.country) structuredFields.country.value = selection.country || '';
        if (structuredFields.lat) structuredFields.lat.value = selection.lat || '';
        if (structuredFields.lng) structuredFields.lng.value = selection.lng || '';
        if (structuredFields.placeId) structuredFields.placeId.value = selection.placeId || '';
        state.selectedFromAutocomplete = true;
        hideSuggestions();
    }

    function renderSuggestions(items) {
        hideSuggestions();
        if (!items || items.length === 0) return;

        state.suggestionItems = items;
        suggestions.innerHTML = '';

        items.forEach(function (item, index) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'pickup-location-option';
            button.setAttribute('role', 'option');
            button.textContent = item.label;

            button.addEventListener('click', function (event) {
                event.preventDefault();
                applySelection(item);
            });

            button.addEventListener('mouseenter', function () {
                updateSelectionIndex(index);
            });

            suggestions.appendChild(button);
        });

        suggestions.hidden = false;
        updateSelectionIndex(0);
    }

    function fetchMapboxSuggestions(query) {
        if (!mapboxToken) {
            setHint('Mapbox token not configured. Using manual entry.');
            hideSuggestions();
            return;
        }

        var endpoint = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(query) + '.json' +
            '?autocomplete=true&limit=5&types=address,place,postcode,locality&country=us,ca&access_token=' + encodeURIComponent(mapboxToken);

        fetch(endpoint)
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function (payload) {
                var features = Array.isArray(payload && payload.features) ? payload.features : [];
                var items = features.map(parseMapboxContext).filter(function (entry) {
                    return entry.label;
                });
                renderSuggestions(items);
            })
            .catch(function () {
                hideSuggestions();
            });
    }

    function loadGooglePlacesScript() {
        if (!googleKey) {
            return Promise.reject(new Error('Google API key not configured.'));
        }

        if (window.google && window.google.maps && window.google.maps.places) {
            return Promise.resolve(window.google);
        }

        if (state.googleScriptPromise) {
            return state.googleScriptPromise;
        }

        state.googleScriptPromise = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(googleKey) + '&libraries=places';
            script.async = true;
            script.defer = true;
            script.onload = function () {
                resolve(window.google);
            };
            script.onerror = function () {
                reject(new Error('Failed to load Google Places script.'));
            };
            document.head.appendChild(script);
        });

        return state.googleScriptPromise;
    }

    function enableGoogleAutocomplete() {
        loadGooglePlacesScript()
            .then(function (googleRef) {
                if (!googleRef || !googleRef.maps || !googleRef.maps.places) {
                    throw new Error('Google Places unavailable.');
                }

                if (!state.googleAutocomplete) {
                    state.googleAutocomplete = new googleRef.maps.places.Autocomplete(input, {
                        types: ['address'],
                        componentRestrictions: { country: ['us', 'ca'] },
                        fields: ['address_components', 'formatted_address', 'geometry', 'place_id']
                    });
                }

                if (!state.googleListenerAttached) {
                    state.googleListenerAttached = true;
                    state.googleAutocomplete.addListener('place_changed', function () {
                        var place = state.googleAutocomplete.getPlace();
                        var components = Array.isArray(place && place.address_components) ? place.address_components : [];
                        var getComponent = function (type) {
                            var entry = components.find(function (component) {
                                return Array.isArray(component.types) && component.types.indexOf(type) >= 0;
                            });
                            return entry || null;
                        };

                        applySelection({
                            label: place && place.formatted_address ? place.formatted_address : input.value,
                            street: [
                                getComponent('street_number') ? getComponent('street_number').long_name : '',
                                getComponent('route') ? getComponent('route').long_name : ''
                            ].join(' ').trim(),
                            city: getComponent('locality') ? getComponent('locality').long_name : '',
                            state: getComponent('administrative_area_level_1') ? getComponent('administrative_area_level_1').short_name : '',
                            postalCode: getComponent('postal_code') ? getComponent('postal_code').long_name : '',
                            country: getComponent('country') ? getComponent('country').short_name : '',
                            lat: place && place.geometry && place.geometry.location ? String(place.geometry.location.lat()) : '',
                            lng: place && place.geometry && place.geometry.location ? String(place.geometry.location.lng()) : '',
                            placeId: place && place.place_id ? place.place_id : ''
                        });
                    });
                }

                setHint('Google Places enabled. Start typing and choose an address suggestion.');
            })
            .catch(function () {
                providerSelect.value = 'manual';
                state.activeProvider = 'manual';
                setHint('Google Places is not configured. Using manual entry.');
                hideSuggestions();
            });
    }

    function onProviderChange() {
        state.activeProvider = providerSelect.value || 'manual';
        hideSuggestions();

        if (state.activeProvider === 'mapbox') {
            setHint('Mapbox autocomplete enabled. Type an address and select a suggestion.');
            return;
        }

        if (state.activeProvider === 'google') {
            setHint('Loading Google Places...');
            enableGoogleAutocomplete();
            return;
        }

        setHint('Manual entry mode. Enter pickup location directly.');
    }

    input.addEventListener('input', function () {
        var query = input.value.trim();
        state.selectedFromAutocomplete = false;
        clearStructuredFields();

        if (state.debounceTimer) {
            window.clearTimeout(state.debounceTimer);
        }

        if (state.activeProvider !== 'mapbox' || query.length < 3) {
            hideSuggestions();
            return;
        }

        state.debounceTimer = window.setTimeout(function () {
            fetchMapboxSuggestions(query);
        }, 220);
    });

    input.addEventListener('keydown', function (event) {
        if (suggestions.hidden || state.suggestionItems.length === 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            updateSelectionIndex((state.highlightedIndex + 1) % state.suggestionItems.length);
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            updateSelectionIndex((state.highlightedIndex - 1 + state.suggestionItems.length) % state.suggestionItems.length);
            return;
        }

        if (event.key === 'Enter' && state.highlightedIndex >= 0) {
            event.preventDefault();
            applySelection(state.suggestionItems[state.highlightedIndex]);
            return;
        }

        if (event.key === 'Escape') {
            hideSuggestions();
        }
    });

    providerSelect.addEventListener('change', onProviderChange);

    document.addEventListener('click', function (event) {
        var target = event.target;
        if (!target) return;
        if (target === input || suggestions.contains(target)) return;
        hideSuggestions();
    });

    onProviderChange();
}

function initRequiredFieldValidation(form) {
    var requiredControls = Array.prototype.slice.call(form.querySelectorAll('[required]'));

    requiredControls.forEach(function (control) {
        decorateRequiredField(control);

        control.addEventListener('blur', function () {
            if (!shouldAlertOnBlur(control)) {
                return;
            }

            markControlValidity(control);
            showSiteNotice('Required Field', getFieldLabel(control) + ' is required. Please fill it in before continuing.');
        });

        control.addEventListener('input', function () {
            markControlValidity(control);
        });

        control.addEventListener('change', function () {
            markControlValidity(control);
        });
    });
}

function decorateRequiredField(control) {
    var label = getFieldLabelElement(control);

    if (!label || label.querySelector('.required-marker')) {
        return;
    }

    label.insertAdjacentHTML('beforeend', ' <span class="required-marker" aria-hidden="true">*</span>');
}

function getFieldLabelElement(control) {
    if (!control) {
        return null;
    }

    if ((control.type === 'checkbox' || control.type === 'radio') && control.closest('label')) {
        return control.closest('label');
    }

    if (control.id) {
        return document.querySelector('label[for="' + control.id + '"]');
    }

    return control.closest('.form-group') ? control.closest('.form-group').querySelector('label') : null;
}

function getFieldLabel(control) {
    var label = getFieldLabelElement(control);

    if (!label) {
        return 'This field';
    }

    return label.textContent.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
}

function shouldAlertOnBlur(control) {
    if (!control.required || control.disabled) {
        return false;
    }

    if (control.form && control.form.dataset.submitIntent === 'true') {
        return false;
    }

    if (control.type === 'checkbox' || control.type === 'radio' || control.type === 'file') {
        return false;
    }

    return !control.checkValidity();
}

function markControlValidity(control) {
    var isInvalid = !control.checkValidity();
    control.classList.toggle('is-invalid', isInvalid);

    var label = getFieldLabelElement(control);
    if (label) {
        label.classList.toggle('is-invalid-label', isInvalid && (control.type === 'checkbox' || control.type === 'radio'));
    }
}

function getInvalidRequiredControls(form) {
    return Array.prototype.filter.call(form.querySelectorAll('[required]'), function (control) {
        return !control.disabled && !control.checkValidity();
    });
}

function buildMissingFieldsMessage(invalidControls) {
    var fieldNames = invalidControls.map(function (control) {
        if (control.validity && control.validity.customError) {
            return getFieldLabel(control) + ' (' + control.validationMessage + ')';
        }

        if (control.validity && control.validity.typeMismatch) {
            return getFieldLabel(control) + ' (enter a valid value)';
        }

        if (control.validity && control.validity.rangeUnderflow) {
            return getFieldLabel(control) + ' (value is too low)';
        }

        if (control.validity && control.validity.rangeOverflow) {
            return getFieldLabel(control) + ' (value is too high)';
        }

        return getFieldLabel(control);
    });

    return 'Please complete the required fields before adding the vehicle:\n\n- ' + fieldNames.join('\n- ');
}

function scrollToControl(control) {
    var offset = 16;
    var header = document.querySelector('.top-header');
    var jump = document.querySelector('.manual-jump');

    if (header) {
        var headerStyle = window.getComputedStyle(header);
        if (headerStyle.position === 'sticky' || headerStyle.position === 'fixed') {
            offset += header.offsetHeight;
        }
    }

    if (jump) {
        var jumpStyle = window.getComputedStyle(jump);
        if (jumpStyle.position === 'sticky') {
            offset += jump.offsetHeight + 10;
        }
    }

    var top = control.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });

    window.setTimeout(function () {
        control.focus({ preventScroll: true });
    }, 150);
}

function initManualJumpNavigation() {
    var jumpLinks = Array.prototype.slice.call(document.querySelectorAll('.manual-jump .jump-link'));
    if (jumpLinks.length === 0) return;

    var sections = jumpLinks
        .map(function (link) {
            var sectionId = link.getAttribute('data-section');
            return document.getElementById(sectionId);
        })
        .filter(function (section) {
            return !!section;
        });

    if (sections.length === 0) return;

    var getStickyOffset = function () {
        var offset = 16;
        var header = document.querySelector('.top-header');
        var jump = document.querySelector('.manual-jump');

        if (header) {
            var headerStyle = window.getComputedStyle(header);
            if (headerStyle.position === 'sticky' || headerStyle.position === 'fixed') {
                offset += header.offsetHeight;
            }
        }

        if (jump) {
            var jumpStyle = window.getComputedStyle(jump);
            if (jumpStyle.position === 'sticky') {
                offset += jump.offsetHeight + 10;
            }
        }

        return offset;
    };

    var setActive = function (sectionId) {
        jumpLinks.forEach(function (link) {
            var isActive = link.getAttribute('data-section') === sectionId;
            link.classList.toggle('active', isActive);
            if (isActive) {
                link.setAttribute('aria-current', 'true');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    };

    var updateActiveFromScroll = function () {
        var offset = getStickyOffset();
        var currentSectionId = sections[0].id;

        sections.forEach(function (section) {
            if (section.getBoundingClientRect().top - offset <= 0) {
                currentSectionId = section.id;
            }
        });

        setActive(currentSectionId);
    };

    var updateCompletion = function () {
        jumpLinks.forEach(function (link) {
            var sectionId = link.getAttribute('data-section');
            var section = document.getElementById(sectionId);
            if (!section) return;

            var requiredControls = section.querySelectorAll('input[required], select[required], textarea[required]');
            if (requiredControls.length === 0) {
                link.classList.remove('completed');
                return;
            }

            var isComplete = Array.prototype.every.call(requiredControls, function (control) {
                return control.checkValidity();
            });

            link.classList.toggle('completed', isComplete);
        });
    };

    jumpLinks.forEach(function (link) {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            var sectionId = link.getAttribute('data-section');
            var section = document.getElementById(sectionId);
            if (!section) return;

            var top = section.getBoundingClientRect().top + window.pageYOffset - getStickyOffset();
            window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
            setActive(sectionId);

            section.classList.remove('jump-flash');
            // Force reflow so repeated clicks retrigger the animation.
            void section.offsetWidth;
            section.classList.add('jump-flash');

            window.setTimeout(function () {
                section.classList.remove('jump-flash');
            }, 1000);
        });
    });

    var form = document.getElementById('addVehicleForm');
    if (form) {
        form.addEventListener('input', updateCompletion);
        form.addEventListener('change', updateCompletion);
    }

    window.addEventListener('scroll', updateActiveFromScroll, { passive: true });
    window.addEventListener('resize', updateActiveFromScroll);

    updateCompletion();
    updateActiveFromScroll();
}

function initConditionRowButtons() {
    var addButtons = document.querySelectorAll('[data-add-row]');
    addButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            var targetId = button.getAttribute('data-add-row');
            var target = document.getElementById(targetId);
            if (!target) return;

            var firstRow = target.querySelector('.condition-row');
            if (!firstRow) return;

            var cloned = firstRow.cloneNode(true);
            var fields = cloned.querySelectorAll('select');
            fields.forEach(function (field) {
                field.selectedIndex = 0;
            });
            target.appendChild(cloned);
        });
    });
}

function initKeyRowButtons() {
    var addButton = document.querySelector('[data-add-key-row]');
    if (!addButton) return;

    addButton.addEventListener('click', function () {
        var targetId = addButton.getAttribute('data-add-key-row');
        var target = document.getElementById(targetId);
        if (!target) return;

        var firstRow = target.querySelector('.keys-row');
        if (!firstRow) return;

        var cloned = firstRow.cloneNode(true);
        var fields = cloned.querySelectorAll('select');
        fields.forEach(function (field) {
            field.selectedIndex = 0;
        });
        target.appendChild(cloned);
    });
}

function initEquipmentCheckAll() {
    var checkAll = document.getElementById('equipmentCheckAll');
    if (!checkAll) return;

    var equipmentChecks = document.querySelectorAll('input[name="equipment[]"]');
    checkAll.addEventListener('change', function () {
        equipmentChecks.forEach(function (checkbox) {
            checkbox.checked = checkAll.checked;
        });
    });
}

function initAnnouncementCounter() {
    var textarea = document.getElementById('additionalAnnouncements');
    var remaining = document.getElementById('announcementCharsRemaining');
    if (!textarea || !remaining) return;

    var maxLength = parseInt(textarea.getAttribute('maxlength') || '2000', 10);
    var update = function () {
        var remainingCount = maxLength - textarea.value.length;
        remaining.textContent = String(remainingCount);
    };

    textarea.addEventListener('input', update);
    update();
}

function initPhotoPreview() {
    var input = document.getElementById('vehiclePhotos');
    var grid = document.getElementById('photoGrid');
    var minimumPhotos = 10;
    var maximumPhotos = 40;

    if (!input || !grid) return;

    var updatePhotoValidation = function (files) {
        var count = files.length;

        if (count === 0) {
            input.setCustomValidity('Please upload at least ' + minimumPhotos + ' photos.');
            return;
        }

        if (count < minimumPhotos) {
            input.setCustomValidity('Please upload at least ' + minimumPhotos + ' photos.');
            return;
        }

        if (count > maximumPhotos) {
            input.setCustomValidity('You can upload a maximum of ' + maximumPhotos + ' photos.');
            return;
        }

        input.setCustomValidity('');
    };

    input.addEventListener('change', function () {
        grid.innerHTML = '';
        var files = Array.prototype.slice.call(input.files || []).filter(function (file) {
            return file.type.startsWith('image/');
        });

        if (files.length > maximumPhotos) {
            showSiteNotice('Photo Limit Reached', 'You can upload a maximum of ' + maximumPhotos + ' photos. Only the first ' + maximumPhotos + ' photos were kept.');
            files = files.slice(0, maximumPhotos);

            if (typeof DataTransfer !== 'undefined') {
                var dataTransfer = new DataTransfer();
                files.forEach(function (file) {
                    dataTransfer.items.add(file);
                });
                input.files = dataTransfer.files;
            }
        }

        updatePhotoValidation(files);

        files.forEach(function (file) {
            var tile = document.createElement('div');
            tile.className = 'photo-tile';

            var img = document.createElement('img');
            img.alt = file.name;
            img.src = URL.createObjectURL(file);

            img.addEventListener('load', function () {
                URL.revokeObjectURL(img.src);
            });

            tile.appendChild(img);
            grid.appendChild(tile);
        });

        markControlValidity(input);
    });

    updatePhotoValidation(Array.prototype.slice.call(input.files || []).filter(function (file) {
        return file.type.startsWith('image/');
    }));
}

function initListingDurationPreview() {
    var startNow = document.getElementById('startNow');
    var startDate = document.getElementById('listingStartDate');
    var startTime = document.getElementById('listingStartTime');
    var timezone = document.getElementById('listingTimezone');
    var duration = document.getElementById('listingDuration');
    var preview = document.getElementById('listingEndPreview');
    if (!startDate || !duration || !preview) return;

    duration.value = '1';
    duration.disabled = true;
    duration.title = 'Active bidding runs for 24 hours from the selected start time.';

    var toggleStartInputs = function () {
        var shouldDisable = !!(startNow && startNow.checked);
        startDate.disabled = shouldDisable;
        if (startTime) startTime.disabled = shouldDisable;
        if (timezone) timezone.disabled = shouldDisable;
    };

    var updatePreview = function () {
        var auctionWindow = deriveAuctionWindowFromInputs(startNow, startDate, startTime, timezone);
        if (!auctionWindow) {
            preview.value = 'End date preview';
            return;
        }

        preview.value = auctionWindow.end.toLocaleString();
    };

    if (startNow) {
        startNow.addEventListener('change', function () {
            toggleStartInputs();
            updatePreview();
        });
    }
    startDate.addEventListener('change', updatePreview);
    if (startTime) {
        startTime.addEventListener('change', updatePreview);
    }
    if (timezone) {
        timezone.addEventListener('change', updatePreview);
    }

    toggleStartInputs();
    updatePreview();
}

function deriveAuctionWindowFromInputs(startNow, startDate, startTime, timezone) {
    var start;

    if (startNow && startNow.checked) {
        start = new Date();
    } else {
        if (!startDate || !startDate.value) {
            return null;
        }

        var dateParts = startDate.value.split('-');
        if (dateParts.length !== 3) {
            return null;
        }

        var year = parseInt(dateParts[0], 10);
        var month = parseInt(dateParts[1], 10);
        var day = parseInt(dateParts[2], 10);

        var rawTime = startTime && startTime.value ? startTime.value : '00:00';
        var timeParts = rawTime.split(':');
        if (timeParts.length < 2) {
            return null;
        }

        var hour = parseInt(timeParts[0], 10);
        var minute = parseInt(timeParts[1], 10);

        if ([year, month, day, hour, minute].some(Number.isNaN)) {
            return null;
        }

        var tzKey = timezone && timezone.value ? timezone.value : 'ET';
        var timezoneOffsets = {
            ET: -5,
            CT: -6,
            MT: -7,
            PT: -8
        };
        var offset = Object.prototype.hasOwnProperty.call(timezoneOffsets, tzKey) ? timezoneOffsets[tzKey] : -5;

        var startUtcMs = Date.UTC(year, month - 1, day, hour - offset, minute, 0, 0);
        start = new Date(startUtcMs);
    }

    if (Number.isNaN(start.getTime())) {
        return null;
    }

    var end = new Date(start.getTime() + (24 * 60 * 60 * 1000));
    return {
        start: start,
        end: end
    };
}

function deriveAuctionWindowFromFormData(formData) {
    var startNow = formData.get('startNow');
    var startDateValue = formData.get('listingStartDate');
    var startTimeValue = formData.get('listingStartTime');
    var timezoneValue = formData.get('listingTimezone');

    var startDate = { value: startDateValue || '' };
    var startTime = { value: startTimeValue || '' };
    var timezone = { value: timezoneValue || '' };
    var windowRange = deriveAuctionWindowFromInputs({ checked: !!startNow }, startDate, startTime, timezone);
    if (!windowRange) {
        return null;
    }

    return {
        startAt: windowRange.start.toISOString(),
        endAt: windowRange.end.toISOString()
    };
}

function serializeFormData(formData) {
    var data = {};

    formData.forEach(function (value, key) {
        if (key.slice(-2) === '[]') {
            var normalizedKey = key.slice(0, -2);
            if (!Array.isArray(data[normalizedKey])) {
                data[normalizedKey] = [];
            }
            data[normalizedKey].push(value);
            return;
        }

        if (Object.prototype.hasOwnProperty.call(data, key)) {
            if (!Array.isArray(data[key])) {
                data[key] = [data[key]];
            }
            data[key].push(value);
            return;
        }

        data[key] = value;
    });

    return data;
}

function validateForm() {
    var form = document.getElementById('addVehicleForm');

    if (!form) {
        return false;
    }

    var invalidControls = getInvalidRequiredControls(form);

    if (invalidControls.length > 0) {
        invalidControls.forEach(function (control) {
            markControlValidity(control);
        });

        showSiteNotice('Required Fields', buildMissingFieldsMessage(invalidControls));
        scrollToControl(invalidControls[0]);
        return false;
    }

    return true;
}

function isFormDirty() {
    var form = document.getElementById('addVehicleForm');
    var inputs = form.querySelectorAll('input, select, textarea');

    for (var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        if (input.type === 'checkbox' || input.type === 'radio') {
            if (input.defaultChecked !== input.checked) {
                return true;
            }
        } else if (input.value !== input.defaultValue) {
            return true;
        }
    }

    return false;
}

async function submitVehicle(vehicleData) {
    var photoInput = document.getElementById('vehiclePhotos');
    var photoFiles = getFileArray(photoInput);
    var submissionId;
    var uploadedPhotos = [];
    var insertResult;

    console.log('Submitting vehicle data:', vehicleData);

    if (!vehicleSubmissionSupabaseClient) {
        showSiteNotice('Submission Backend Needed', 'The manual entry form is ready, but Supabase is not configured for vehicle submissions yet. Add your project settings in add-vehicle.supabase-config.js.');
        return { saved: false };
    }

    submissionId = generateVehicleSubmissionId();

    try {
        uploadedPhotos = await uploadSubmissionPhotos(submissionId, photoFiles);
        insertResult = await vehicleSubmissionSupabaseClient
            .from(VEHICLE_SUBMISSIONS_TABLE)
            .insert(buildVehicleSubmissionRecord(vehicleData, uploadedPhotos))
            .select('id, summary_label, review_status, submitted_at')
            .single();

        if (insertResult.error) {
            throw insertResult.error;
        }

        showSiteNotice('Vehicle Submitted', 'Your vehicle was sent to the review queue and is now marked as pending approval. It will stay out of the live marketplace until it is approved.');
        resetForm();
        return {
            saved: true,
            entry: insertResult.data || null
        };
    } catch (error) {
        await removeSubmissionPhotos(collectSubmissionAttachmentPaths(uploadedPhotos));
        console.error('Vehicle submission failed:', error);
        showSiteNotice('Submission Failed', 'The vehicle could not be sent to Supabase: ' + getSubmissionErrorMessage(error, 'Unknown error'));
        throw error;
    }
}

function resetForm() {
    var form = document.getElementById('addVehicleForm');
    if (form) {
        form.reset();
    }

    if (window.localStorage) {
        window.localStorage.removeItem(ADD_VEHICLE_DRAFT_KEY);
    }
}

function initBackButton() {
    var backButton = document.querySelector('.back-button');
    if (backButton) {
        backButton.addEventListener('click', function (event) {
            event.preventDefault();
            if (isFormDirty()) {
                showSiteConfirm('Discard Changes', 'Are you sure you want to discard your changes?', 'Discard Changes', function () {
                    navigateBack();
                });
            } else {
                navigateBack();
            }
        });
    }
}

function navigateBack() {
    // Check if there's a referrer or go to dashboard
    if (document.referrer && document.referrer.includes(window.location.hostname)) {
        history.back();
    } else {
        window.location.href = 'car-dashboard.html';
    }
}

// Collapsible Condition of Vehicle section
function initConditionCollapse() {
    var toggle = document.querySelector('#conditionOfVehicleSection .collapse-toggle');
    var content = document.getElementById('conditionOfVehicleContent');
    if (!toggle || !content) return;
    toggle.addEventListener('click', function () {
        var expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', !expanded);
        content.hidden = expanded;
    });
    // Default collapsed
    toggle.setAttribute('aria-expanded', 'false');
    content.hidden = true;
}

// Add Row buttons for condition tables
function initConditionAddRows() {
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.btn-add-row');
        if (!btn) return;
        var targetId = btn.getAttribute('data-target');
        var container = document.getElementById(targetId);
        if (!container) return;
        var firstRow = container.querySelector('.condition-row');
        if (!firstRow) return;
        var clone = firstRow.cloneNode(true);
        // Reset select values in the clone
        clone.querySelectorAll('select').forEach(function (sel) { sel.value = ''; });
        container.appendChild(clone);
    });
}

document.addEventListener('DOMContentLoaded', function () {
    initConditionCollapse();
    initConditionAddRows();
    initWeekendWarning();
});

// Weekend warning: Friday noon – Sunday noon
function isWeekendWindow(date) {
    // date is a JS Date object
    var day = date.getDay();   // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    var hour = date.getHours();
    var min = date.getMinutes();
    var timeInMinutes = hour * 60 + min;
    var noon = 12 * 60;

    // Friday at noon or later
    if (day === 5 && timeInMinutes >= noon) return true;
    // All day Saturday
    if (day === 6) return true;
    // Sunday before noon (strictly before 12:00)
    if (day === 0 && timeInMinutes < noon) return true;

    return false;
}

function initWeekendWarning() {
    var modal = document.getElementById('weekendWarningModal');
    var cancelBtn = document.getElementById('weekendWarningCancelBtn');
    var continueBtn = document.getElementById('weekendWarningContinueBtn');
    var startNowChk = document.getElementById('startNow');
    var startDateInput = document.getElementById('listingStartDate');
    var startTimeInput = document.getElementById('listingStartTime');

    if (!modal || !cancelBtn || !continueBtn) return;

    var lastFocused = null;
    var pendingCancel = null; // function to call if user cancels

    function openModal(onCancel) {
        lastFocused = document.activeElement;
        pendingCancel = typeof onCancel === 'function' ? onCancel : null;
        modal.hidden = false;
        document.body.classList.add('preview-modal-open');
        continueBtn.focus();
    }

    function closeModal(runCancel) {
        modal.hidden = true;
        document.body.classList.remove('preview-modal-open');
        if (runCancel && pendingCancel) {
            pendingCancel();
        }
        pendingCancel = null;
        if (lastFocused && typeof lastFocused.focus === 'function') {
            lastFocused.focus();
        }
    }

    // Close on backdrop / X
    modal.querySelectorAll('[data-close-weekend-warning]').forEach(function (el) {
        el.addEventListener('click', function () { closeModal(false); });
    });

    // Cancel — undo the triggering action
    cancelBtn.addEventListener('click', function () { closeModal(true); });

    // Continue — just dismiss
    continueBtn.addEventListener('click', function () { closeModal(false); });

    // Trap Escape key
    modal.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closeModal(false); }
    });

    // Trigger: Start Now checkbox
    if (startNowChk) {
        startNowChk.addEventListener('change', function () {
            if (!startNowChk.checked) return;
            if (isWeekendWindow(new Date())) {
                openModal(function () {
                    startNowChk.checked = false;
                });
            }
        });
    }

    // Trigger: manual start date or time change
    function checkManualDate() {
        var dateVal = startDateInput ? startDateInput.value : '';
        var timeVal = startTimeInput ? startTimeInput.value : '00:00';
        if (!dateVal) return;

        // Build a Date from the selected date + time (local)
        var dt = new Date(dateVal + 'T' + (timeVal || '00:00'));
        if (isNaN(dt.getTime())) return;

        if (isWeekendWindow(dt)) {
            openModal(function () {
                if (startDateInput) startDateInput.value = '';
                if (startTimeInput) startTimeInput.value = '';
            });
        }
    }

    if (startDateInput) startDateInput.addEventListener('change', checkManualDate);
    if (startTimeInput) startTimeInput.addEventListener('change', checkManualDate);
}
