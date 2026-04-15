(function () {
    'use strict';

    function initSettingsNav() {
        var navItems = document.querySelectorAll('.settings-nav-item[data-section]');
        var panels   = document.querySelectorAll('.settings-panel');
        if (!navItems.length) return;

        function activateSection(sectionId) {
            navItems.forEach(function (item) {
                item.classList.toggle('active', item.dataset.section === sectionId);
            });
            panels.forEach(function (panel) {
                panel.classList.toggle('active', panel.id === sectionId);
            });
        }

        var contentArea = document.querySelector('.settings-content');

        navItems.forEach(function (item) {
            item.addEventListener('click', function () {
                activateSection(item.dataset.section);
                if (contentArea) contentArea.scrollTop = 0;
            });
        });

        // Honor hash on load
        var hash = location.hash.replace('#', '');
        if (hash && document.getElementById(hash)) {
            activateSection(hash);
        }
    }

    function initClearButtons() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('.settings-field-clear');
            if (!btn) return;
            var targetId = btn.dataset.clears;
            if (!targetId) return;
            var field = document.getElementById(targetId);
            if (field) {
                field.value = '';
                field.focus();
            }
        });
    }

    function initMyAccountForm() {
        var form      = document.getElementById('myAccountForm');
        var nameField = document.getElementById('accountName');
        if (!form) return;

        // Restore saved name into the field on load
        try {
            var saved = localStorage.getItem('accountName');
            if (saved && nameField) nameField.value = saved;
        } catch (e) {}

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            // Persist name to localStorage so header picks it up
            try {
                if (nameField) {
                    var trimmedName = nameField.value.trim();
                    localStorage.setItem('accountName', trimmedName);
                    // Update same-tab header directly (storage event only fires cross-tab)
                    var headerName   = document.getElementById('headerUserName');
                    var headerAvatar = document.getElementById('headerUserAvatar');
                    if (headerName && trimmedName) {
                        headerName.textContent = trimmedName;
                        if (headerAvatar) {
                            var parts = trimmedName.split(/\s+/);
                            var initials = parts.length >= 2
                                ? parts[0][0] + parts[parts.length - 1][0]
                                : parts[0].slice(0, 2);
                            headerAvatar.textContent = initials.toUpperCase();
                        }
                    }
                }
            } catch (err) {}

            var saveBtn = form.querySelector('.settings-save-btn');
            var original = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Saved';
            saveBtn.disabled = true;
            setTimeout(function () {
                saveBtn.innerHTML = original;
                saveBtn.disabled = false;
            }, 2000);
        });

        var deleteBtn = document.getElementById('deleteAccountBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function () {
                // TODO: wire to backend delete with confirmation dialog
                if (window.confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                    alert('Account deletion is not yet wired to a backend.');
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        initSettingsNav();
        initClearButtons();
        initMyAccountForm();
    });
}());
