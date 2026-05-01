(function () {
    'use strict';

    var TABLE_NAME = 'brainstorming_entries';
    var DEFAULT_BUCKET = 'brainstorming-images';
    var MAX_IMAGES = 4;
    var MAX_FILE_SIZE = 5 * 1024 * 1024;

    var form = document.getElementById('brainstormForm');
    var createdByInput = document.getElementById('createdBy');
    var ideaText = document.getElementById('ideaText');
    var ideaImages = document.getElementById('ideaImages');
    var imagePreview = document.getElementById('imagePreview');
    var formMessage = document.getElementById('formMessage');
    var connectionStatus = document.getElementById('connectionStatus');
    var entriesList = document.getElementById('entriesList');
    var emptyState = document.getElementById('emptyState');
    var entryCount = document.getElementById('entryCount');
    var clearDraftBtn = document.getElementById('clearDraftBtn');
    var exportIdeasBtn = document.getElementById('exportIdeasBtn');
    var clearAllBtn = document.getElementById('clearAllBtn');
    var sidebarExportIdeasBtn = document.getElementById('sidebarExportIdeasBtn');
    var sidebarClearAllBtn = document.getElementById('sidebarClearAllBtn');
    var collapsedExportIdeasBtn = document.getElementById('collapsedExportIdeasBtn');
    var collapsedClearAllBtn = document.getElementById('collapsedClearAllBtn');
    var saveIdeaBtn = form.querySelector('button[type="submit"]');

    var pendingUploads = [];
    var currentEntries = [];
    var supabaseClient = null;
    var supabaseBucket = DEFAULT_BUCKET;

    function setConnectionMessage(message, variant) {
        connectionStatus.textContent = message || '';
        connectionStatus.classList.remove('is-success', 'is-warning', 'is-error');
        if (variant) {
            connectionStatus.classList.add('is-' + variant);
        }
    }

    function setRemoteActionsDisabled(disabled) {
        saveIdeaBtn.disabled = disabled;
        exportIdeasBtn.disabled = disabled;
        clearAllBtn.disabled = disabled;
        sidebarExportIdeasBtn.disabled = disabled;
        sidebarClearAllBtn.disabled = disabled;
        collapsedExportIdeasBtn.disabled = disabled;
        collapsedClearAllBtn.disabled = disabled;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatTimestamp(value) {
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return 'Unknown time';
        }

        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(date);
    }

    function setMessage(message, variant) {
        formMessage.textContent = message || '';
        formMessage.classList.remove('is-error', 'is-success');
        if (variant) {
            formMessage.classList.add(variant === 'error' ? 'is-error' : 'is-success');
        }
    }

    function getErrorMessage(err, fallback) {
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

    function destroyPendingPreviews() {
        pendingUploads.forEach(function (item) {
            if (item.previewUrl) {
                URL.revokeObjectURL(item.previewUrl);
            }
        });
    }

    function renderPendingImages() {
        imagePreview.innerHTML = pendingUploads.map(function (item) {
            return [
                '<figure class="image-preview-card">',
                '<img src="' + item.previewUrl + '" alt="Selected screenshot preview">',
                '<figcaption>' + escapeHtml(item.file.name) + '</figcaption>',
                '</figure>'
            ].join('');
        }).join('');
    }

    function normalizeAttachments(entry) {
        if (!entry || typeof entry !== 'object') {
            return [];
        }

        if (Array.isArray(entry.attachments)) {
            return entry.attachments;
        }

        // Some migrated rows may store a single attachment object instead of an array.
        if (entry.attachments && typeof entry.attachments === 'object') {
            return [entry.attachments];
        }

        return [];
    }

    function normalizeAuthor(entry) {
        return typeof entry.created_by === 'string' && entry.created_by.trim() ? entry.created_by.trim() : 'Unknown owner';
    }

    function renderEntries(entries) {
        entries = Array.isArray(entries) ? entries : [];
        currentEntries = entries.slice();
        entryCount.textContent = entries.length + (entries.length === 1 ? ' entry' : ' entries');

        emptyState.hidden = entries.length > 0;
        entriesList.innerHTML = entries.map(function (entry) {
            var images = normalizeAttachments(entry);
            var author = normalizeAuthor(entry);
            var imageMarkup = images.length ? [
                '<div class="entry-image-grid">',
                images.map(function (image) {
                    return [
                        '<figure class="entry-image-card">',
                        '<a class="entry-image-link" href="' + escapeHtml(image.url || '') + '" target="_blank" rel="noreferrer">',
                        '<img src="' + escapeHtml(image.url || '') + '" alt="Attached screenshot for saved idea">',
                        '</a>',
                        '<figcaption>' + escapeHtml(image.name || 'Screenshot') + '</figcaption>',
                        '</figure>'
                    ].join('');
                }).join(''),
                '</div>'
            ].join('') : '';

            return [
                '<article class="idea-entry">',
                '<div class="idea-entry-header">',
                '<div class="idea-entry-meta">',
                '<span class="idea-entry-badge"><i class="fa-regular fa-lightbulb" aria-hidden="true"></i> Idea saved</span>',
                '<div class="idea-entry-author">Created by <strong>' + escapeHtml(author) + '</strong></div>',
                '</div>',
                '<time datetime="' + escapeHtml(entry.created_at) + '">' + escapeHtml(formatTimestamp(entry.created_at)) + '</time>',
                '</div>',
                '<div class="idea-entry-body">' + escapeHtml(entry.note_text) + '</div>',
                imageMarkup,
                '</article>'
            ].join('');
        }).join('');
    }

    function resetComposer() {
        destroyPendingPreviews();
        pendingUploads = [];
        ideaImages.value = '';
        createdByInput.value = '';
        ideaText.value = '';
        renderPendingImages();
        setMessage('Draft cleared.');
    }

    function getArchiveFileName() {
        return 'brainstorming-archive-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    }

    function exportIdeas() {
        if (!currentEntries.length) {
            setMessage('There are no ideas to export yet.', 'error');
            return;
        }

        var archivePayload = currentEntries.map(function (entry) {
            return {
                id: entry.id,
                createdBy: normalizeAuthor(entry),
                noteText: entry.note_text || '',
                createdAt: entry.created_at || '',
                attachments: normalizeAttachments(entry)
            };
        });

        var blob = new Blob([JSON.stringify(archivePayload, null, 2)], {
            type: 'application/json'
        });
        var downloadUrl = URL.createObjectURL(blob);
        var downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = getArchiveFileName();
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadUrl);
        setMessage('Ideas exported as a JSON archive.', 'success');
    }

    function getSupabaseConfig() {
        return window.BRAINSTORMING_SUPABASE_CONFIG || {};
    }

    function looksLikePlaceholder(value) {
        return !value || /your[-_ ]/i.test(value) || /replace[-_ ]/i.test(value);
    }

    function generateEntryId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }

        return 'entry-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    }

    function sanitizeFileName(name) {
        return String(name || 'upload')
            .toLowerCase()
            .replace(/[^a-z0-9.\-_]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    function collectAttachmentPaths(entries) {
        return entries.reduce(function (paths, entry) {
            normalizeAttachments(entry).forEach(function (image) {
                if (image && image.path) {
                    paths.push(image.path);
                }
            });
            return paths;
        }, []);
    }

    async function uploadPendingImages(entryId) {
        if (!pendingUploads.length) {
            return [];
        }

        var storage = supabaseClient.storage.from(supabaseBucket);
        var uploaded = [];

        try {
            for (var index = 0; index < pendingUploads.length; index += 1) {
                var item = pendingUploads[index];
                var fileName = sanitizeFileName(item.file.name);
                var filePath = entryId + '/' + Date.now() + '-' + index + '-' + fileName;
                var uploadResult = await storage.upload(filePath, item.file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: item.file.type || undefined
                });

                if (uploadResult.error) {
                    throw uploadResult.error;
                }

                var publicUrlResult = storage.getPublicUrl(filePath);
                uploaded.push({
                    name: item.file.name,
                    path: filePath,
                    type: item.file.type || '',
                    url: publicUrlResult.data.publicUrl
                });
            }
        } catch (err) {
            await removeUploadedImages(collectAttachmentPaths([{ attachments: uploaded }]));
            throw err;
        }

        return uploaded;
    }

    async function removeUploadedImages(paths) {
        if (!paths.length) {
            return;
        }

        await supabaseClient.storage.from(supabaseBucket).remove(paths);
    }

    async function loadEntries() {
        var result = await supabaseClient
            .from(TABLE_NAME)
            .select('*')
            .order('created_at', { ascending: false });

        if (result.error) {
            throw result.error;
        }

        renderEntries(result.data || []);
    }

    function handleImageSelection(fileList) {
        var files = Array.prototype.slice.call(fileList || []);
        destroyPendingPreviews();

        if (!files.length) {
            pendingUploads = [];
            renderPendingImages();
            return Promise.resolve();
        }

        if (files.length > MAX_IMAGES) {
            setMessage('Please select up to ' + MAX_IMAGES + ' screenshots per entry.', 'error');
            ideaImages.value = '';
            return Promise.resolve();
        }

        var oversized = files.find(function (file) {
            return file.size > MAX_FILE_SIZE;
        });

        if (oversized) {
            setMessage('"' + oversized.name + '" is too large. Keep each screenshot under 5 MB.', 'error');
            ideaImages.value = '';
            return Promise.resolve();
        }

        pendingUploads = files.map(function (file) {
            return {
                file: file,
                previewUrl: URL.createObjectURL(file)
            };
        });

        return Promise.resolve().then(function () {
            renderPendingImages();
            setMessage(pendingUploads.length ? 'Screenshots ready to upload with the note.' : '');
        });
    }

    async function confirmClearAll() {
        if (!window.confirm('Clear all shared brainstorming entries from Supabase?')) {
            return;
        }

        try {
            var existingEntries = await supabaseClient
                .from(TABLE_NAME)
                .select('attachments');

            if (existingEntries.error) {
                throw existingEntries.error;
            }

            var paths = collectAttachmentPaths(existingEntries.data || []);
            await removeUploadedImages(paths);

            var deleteResult = await supabaseClient
                .from(TABLE_NAME)
                .delete()
                .not('id', 'is', null);

            if (deleteResult.error) {
                throw deleteResult.error;
            }

            renderEntries([]);
            setMessage('All shared ideas were cleared from Supabase.', 'success');
        } catch (err) {
            console.error('Brainstorming clear-all failed:', err);
            setMessage('Unable to clear the shared ideas right now.', 'error');
        }
    }

    function hasValidSupabaseConfig() {
        var config = getSupabaseConfig();
        return !looksLikePlaceholder(config.url) && !looksLikePlaceholder(config.anonKey);
    }

    function initializeSupabase() {
        if (!window._collectorsAllianceClient) {
            setConnectionMessage('Supabase client library failed to load.', 'error');
            setRemoteActionsDisabled(true);
            return false;
        }

        var config = getSupabaseConfig();
        supabaseBucket = config.bucket || DEFAULT_BUCKET;
        supabaseClient = window._collectorsAllianceClient;
        setRemoteActionsDisabled(false);
        return true;
    }

    ideaImages.addEventListener('change', function (event) {
        handleImageSelection(event.target.files);
    });

    clearDraftBtn.addEventListener('click', function () {
        resetComposer();
    });

    exportIdeasBtn.addEventListener('click', exportIdeas);
    clearAllBtn.addEventListener('click', confirmClearAll);
    sidebarExportIdeasBtn.addEventListener('click', exportIdeas);
    sidebarClearAllBtn.addEventListener('click', confirmClearAll);
    collapsedExportIdeasBtn.addEventListener('click', exportIdeas);
    collapsedClearAllBtn.addEventListener('click', confirmClearAll);

    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        if (!supabaseClient) {
            setMessage('Supabase is not configured yet.', 'error');
            return;
        }

        var createdBy = createdByInput.value.trim();
        if (!createdBy) {
            setMessage('Add a name in Created By before saving the idea.', 'error');
            createdByInput.focus();
            return;
        }

        var text = ideaText.value.trim();
        if (!text) {
            setMessage('Write the idea before saving it.', 'error');
            ideaText.focus();
            return;
        }

        var entryId = generateEntryId();
        var uploadedImages = [];

        try {
            saveIdeaBtn.disabled = true;
            setMessage('Saving idea to Supabase...');

            uploadedImages = await uploadPendingImages(entryId);

            var insertResult = await supabaseClient
                .from(TABLE_NAME)
                .insert({
                    id: entryId,
                    created_by: createdBy,
                    note_text: text,
                    attachments: uploadedImages
                })
                .select('*')
                .single();

            if (insertResult.error) {
                throw insertResult.error;
            }

            await loadEntries();
            resetComposer();
            setMessage('Idea saved with timestamp ' + formatTimestamp(insertResult.data.created_at) + '.', 'success');
            setConnectionMessage('Connected to Supabase. Shared ideas are live.', 'success');
        } catch (err) {
            await removeUploadedImages(collectAttachmentPaths([{ attachments: uploadedImages }]));
            console.error('Brainstorming save failed:', err);
            if (/created_by/i.test(getErrorMessage(err, ''))) {
                setMessage('This page needs the unified schema setup. Run data/collectors-alliance-schema.sql in Supabase.', 'error');
            } else {
                setMessage('This idea could not be saved to Supabase: ' + getErrorMessage(err, 'Unknown error'), 'error');
            }
        } finally {
            saveIdeaBtn.disabled = false;
        }
    });

    async function init() {
        if (!initializeSupabase()) {
            renderEntries([]);
            return;
        }

        try {
            setConnectionMessage('Loading ideas from Supabase...', null);
            await loadEntries();
            setConnectionMessage('Connected to Supabase. Shared ideas are loading from the database.', 'success');
        } catch (err) {
            console.error('Brainstorming init/load failed:', err);
            renderEntries([]);
            setConnectionMessage('Supabase connection failed: ' + getErrorMessage(err, 'Unknown error'), 'error');
            setMessage('Could not load the shared ideas feed yet.', 'error');
            setRemoteActionsDisabled(true);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
