import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = 'https://chllzkgugwuerlnbltay.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rpzSMoGHXVKEIRwipYmrHg_64fqgX0y';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Helpers ────────────────────────────────────────────────────────────────

function setInlineMsg(el, text, isError) {
    if (!el) return;
    el.textContent = text || "";
    el.style.color = isError ? "var(--color-error, #e55)" : "var(--color-ok, #5c5)";
}

function flashSaveBtn(btn) {
    if (!btn) return;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Saved';
    btn.disabled = true;
    setTimeout(() => {
        btn.innerHTML = original;
        btn.disabled = false;
    }, 2000);
}

function friendlyAuthError(err) {
    const msg = (err && err.message) || "Unknown error";
    if (msg.includes("requires-recent-login") || msg.includes("reauthentication")) return "Session expired — please re-enter your current password below and try again.";
    if (msg.includes("Invalid login credentials") || msg.includes("wrong-password") || msg.includes("invalid-credential")) return "Current password is incorrect.";
    if (msg.includes("User already registered") || msg.includes("email-already-in-use")) return "That email is already in use.";
    if (msg.includes("invalid-email") || msg.includes("Unable to validate email")) return "Please enter a valid email address.";
    if (msg.includes("Password should be at least") || msg.includes("weak-password")) return "New password must be at least 8 characters.";
    return msg;
}

function randomCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const parts = [];
    for (let i = 0; i < 4; i++) {
        let chunk = "";
        for (let j = 0; j < 4; j++) chunk += alphabet[Math.floor(Math.random() * alphabet.length)];
        parts.push(chunk);
    }
    return parts.join("-");
}

// ── Populate fields from Supabase ─────────────────────────────────────────

async function populateProfileFields(user) {
    const nameField  = document.getElementById("accountName");
    const phoneField = document.getElementById("accountPhone");
    const extField   = document.getElementById("accountPhoneExt");
    const zipField   = document.getElementById("accountZip");

    const displayName = user.user_metadata?.display_name || "";
    if (nameField && displayName) nameField.value = displayName;

    try {
        const { data } = await supabase
            .from('users')
            .select('phone, phone_ext, zip')
            .eq('id', user.id)
            .single();

        if (data) {
            if (phoneField && data.phone)      phoneField.value = data.phone;
            if (extField   && data.phone_ext)  extField.value   = data.phone_ext;
            if (zipField   && data.zip)        zipField.value   = data.zip;
        }
    } catch (e) {
        // Non-critical — fields stay at their default values.
    }
}

// ── My Account form (name / phone / zip) → Supabase ──────────────────────

function initProfileSave(user) {
    const form = document.getElementById("myAccountForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        // settings.js already calls preventDefault and handles localStorage + header.
        // We piggyback here to also save to Supabase.
        const nameField  = document.getElementById("accountName");
        const phoneField = document.getElementById("accountPhone");
        const extField   = document.getElementById("accountPhoneExt");
        const zipField   = document.getElementById("accountZip");

        const displayName = nameField ? nameField.value.trim() : "";
        const phone    = phoneField ? phoneField.value.trim() : "";
        const phoneExt = extField   ? extField.value.trim()   : "";
        const zip      = zipField   ? zipField.value.trim()   : "";

        try {
            const updates = { id: user.id };
            if (displayName) updates.display_name = displayName;
            if (phone)       updates.phone        = phone;
            if (phoneExt)    updates.phone_ext    = phoneExt;
            if (zip)         updates.zip          = zip;

            await Promise.all([
                displayName
                    ? supabase.auth.updateUser({ data: { display_name: displayName } })
                    : Promise.resolve(),
                supabase.from('users').upsert(updates)
            ]);
        } catch (err) {
            console.error("Settings profile save error:", err);
        }
    });
}

// ── Change Email form ──────────────────────────────────────────────────────

function initChangeEmail(user) {
    const form    = document.getElementById("changeEmailForm");
    const msgEl   = document.getElementById("changeEmailMsg");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newEmail        = form.newEmail.value.trim();
        const currentPassword = form.emailCurrentPassword.value;

        if (!newEmail || !currentPassword) {
            setInlineMsg(msgEl, "New email and current password are required.", true);
            return;
        }

        const btn = form.querySelector("button[type=submit]");
        if (btn) btn.disabled = true;
        setInlineMsg(msgEl, "");

        try {
            // Re-authenticate by signing in with current password first
            const { error: reAuthError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword
            });
            if (reAuthError) throw reAuthError;

            const { error } = await supabase.auth.updateUser({ email: newEmail });
            if (error) throw error;

            // Keep users table in sync (email updates after confirmation)
            await supabase.from('users').upsert({ id: user.id, email: newEmail });
            try { window.localStorage.setItem("accountEmail", newEmail); } catch (_) {}

            setInlineMsg(msgEl, "Confirmation sent to new address. Email will update once confirmed.", false);
            form.reset();
        } catch (err) {
            setInlineMsg(msgEl, friendlyAuthError(err), true);
        } finally {
            if (btn) btn.disabled = false;
        }
    });
}

// ── Change Password form ───────────────────────────────────────────────────

function initChangePassword(user) {
    const form  = document.getElementById("changePasswordForm");
    const msgEl = document.getElementById("changePasswordMsg");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const currentPassword = form.currentPassword.value;
        const newPassword     = form.newPassword.value;
        const confirmPassword = form.confirmPassword.value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            setInlineMsg(msgEl, "All password fields are required.", true);
            return;
        }
        if (newPassword !== confirmPassword) {
            setInlineMsg(msgEl, "New passwords do not match.", true);
            return;
        }
        if (newPassword.length < 8) {
            setInlineMsg(msgEl, "New password must be at least 8 characters.", true);
            return;
        }

        const btn = form.querySelector("button[type=submit]");
        if (btn) btn.disabled = true;
        setInlineMsg(msgEl, "");

        try {
            // Re-authenticate by signing in with current password
            const { error: reAuthError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword
            });
            if (reAuthError) throw reAuthError;

            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            setInlineMsg(msgEl, "Password changed successfully.", false);
            form.reset();
        } catch (err) {
            setInlineMsg(msgEl, friendlyAuthError(err), true);
        } finally {
            if (btn) btn.disabled = false;
        }
    });
}

// ── Admin Tools panel ──────────────────────────────────────────────────────

const ROLE_LABELS = {
    admin:          "Admin",
    developer:      "Developer",
    dev:            "Developer",
    ceo:            "CEO",
    business_owner: "Business Owner",
    co_owner:       "Co-Owner",
    full_access:    "Full Access",
    viewer:         "Viewer",
    member:         "Member",
};

const PREVIEW_ROLE_KEY = "previewRole";

function formatRoleLabel(role) {
    return ROLE_LABELS[role] || (role ? role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ") : "Member");
}

function normalizeRole(rawRole) {
    return String(rawRole || "")
        .trim()
        .toLowerCase()
        .replace(/-/g, "_")
        .replace(/\s+/g, "_");
}

function isUserManagerRole(role) {
    const normalized = normalizeRole(role);
    return normalized === "admin" || normalized === "developer" || normalized === "dev" || normalized === "ceo";
}

function applyManagerSectionVisibility(canManageUsers) {
    const manageUsersNavBtn = document.querySelector('.settings-nav-item[data-section="manage-users"]');
    const adminNavBtn = document.querySelector('.settings-nav-item[data-section="admin-tools"]');
    const manageUsersPanel = document.getElementById('manage-users');
    const adminToolsPanel = document.getElementById('admin-tools');

    if (manageUsersNavBtn) {
        manageUsersNavBtn.hidden = !canManageUsers;
        manageUsersNavBtn.style.display = canManageUsers ? '' : 'none';
        if (!canManageUsers) {
            manageUsersNavBtn.classList.remove('active');
        }
    }

    if (adminNavBtn) {
        adminNavBtn.hidden = !canManageUsers;
        adminNavBtn.style.display = canManageUsers ? '' : 'none';
        if (!canManageUsers) {
            adminNavBtn.classList.remove('active');
        }
    }

    if (manageUsersPanel) {
        manageUsersPanel.hidden = !canManageUsers;
        manageUsersPanel.style.display = canManageUsers ? '' : 'none';
        if (!canManageUsers) {
            manageUsersPanel.classList.remove('active');
        }
    }

    if (adminToolsPanel) {
        adminToolsPanel.hidden = !canManageUsers;
        adminToolsPanel.style.display = canManageUsers ? '' : 'none';
        if (!canManageUsers) {
            adminToolsPanel.classList.remove('active');
        }
    }

    if (!canManageUsers) {
        const fallbackNav = document.querySelector('.settings-nav-item[data-section="my-account"]');
        if (fallbackNav && typeof fallbackNav.click === 'function') {
            fallbackNav.click();
        }
    }
}

// ── Manage Users ──────────────────────────────────────────────────────────

async function initManageUsers(currentUser) {
    const listEl      = document.getElementById("userList");
    const msgEl       = document.getElementById("manageUsersMsg");
    const searchInput = document.getElementById("userSearchInput");
    if (!listEl) return;

    let allUsers = [];

    const ROLE_OPTIONS = [
        { value: "member",      label: "Member" },
        { value: "viewer",      label: "Viewer" },
        { value: "dealer",      label: "Dealer" },
        { value: "full_access", label: "Full Access" },
        { value: "developer",   label: "Developer" },
        { value: "ceo",         label: "CEO" },
        { value: "admin",       label: "Admin" },
    ];

    function buildRoleSelect(userId, currentRole) {
        const sel = document.createElement("select");
        sel.className = "settings-input settings-select";
        sel.style.cssText = "width:auto;min-width:130px";
        sel.dataset.userId = userId;
        ROLE_OPTIONS.forEach(opt => {
            const o = document.createElement("option");
            o.value = opt.value;
            o.textContent = opt.label;
            if (opt.value === currentRole) o.selected = true;
            sel.appendChild(o);
        });
        return sel;
    }

    function renderUsers(users) {
        listEl.innerHTML = "";
        if (!users.length) {
            listEl.innerHTML = '<li class="settings-user-row"><span style="color:var(--color-text-muted,#888)">No users found.</span></li>';
            return;
        }

        users.forEach(u => {
            const role    = normalizeRole(u.role);
            const name    = (u.display_name || "").trim() || u.email.split("@")[0];
            const isSelf  = u.id === currentUser.id;

            const li = document.createElement("li");
            li.className = "settings-user-row";
            li.dataset.userId = u.id;

            // ── Info block
            const info = document.createElement("div");
            info.className = "settings-user-info";

            const nameSpan = document.createElement("span");
            nameSpan.className = "settings-user-name";
            nameSpan.textContent = name + (isSelf ? " (you)" : "");

            const emailA = document.createElement("a");
            emailA.href = "mailto:" + u.email;
            emailA.className = "settings-user-email";
            emailA.textContent = u.email;

            const meta = document.createElement("span");
            meta.style.cssText = "font-size:.72rem;color:var(--color-text-muted,#888);display:block;margin-top:2px";
            meta.textContent = u.created_at
                ? "Joined " + new Date(u.created_at).toLocaleDateString()
                : "";

            info.appendChild(nameSpan);
            info.appendChild(emailA);
            info.appendChild(meta);

            // ── Actions block
            const actions = document.createElement("div");
            actions.style.cssText = "display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-top:.5rem";

            const roleSelect = buildRoleSelect(u.id, role);

            const saveBtn = document.createElement("button");
            saveBtn.type = "button";
            saveBtn.className = "settings-action-btn";
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Role';
            saveBtn.addEventListener("click", async () => {
                saveBtn.disabled = true;
                const newRole = roleSelect.value;
                const { error } = await supabase.from("users").update({ role: newRole }).eq("id", u.id);
                if (error) {
                    setInlineMsg(msgEl, "Failed to update role: " + error.message, true);
                } else {
                    u.role = newRole;
                    setInlineMsg(msgEl, `${name} updated to ${formatRoleLabel(newRole)}.`, false);
                }
                saveBtn.disabled = false;
            });

            const resetBtn = document.createElement("button");
            resetBtn.type = "button";
            resetBtn.className = "settings-reset-pw-btn";
            resetBtn.innerHTML = '<i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Reset Password';
            resetBtn.addEventListener("click", async () => {
                resetBtn.disabled = true;
                const { error } = await supabase.auth.resetPasswordForEmail(u.email, {
                    redirectTo: window.location.origin + "/settings.html",
                });
                if (error) {
                    setInlineMsg(msgEl, "Failed to send reset email: " + error.message, true);
                } else {
                    setInlineMsg(msgEl, `Password reset email sent to ${u.email}.`, false);
                }
                resetBtn.disabled = false;
            });

            actions.appendChild(roleSelect);
            actions.appendChild(saveBtn);
            actions.appendChild(resetBtn);

            if (!isSelf) {
                const deleteBtn = document.createElement("button");
                deleteBtn.type = "button";
                deleteBtn.className = "settings-user-delete";
                deleteBtn.setAttribute("aria-label", "Delete " + name);
                deleteBtn.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
                deleteBtn.addEventListener("click", async () => {
                    if (!confirm(`Remove ${name} (${u.email}) from the user list?\n\nNote: their login account remains active.`)) return;
                    deleteBtn.disabled = true;
                    const { error } = await supabase.from("users").delete().eq("id", u.id);
                    if (error) {
                        setInlineMsg(msgEl, "Failed to remove user: " + error.message, true);
                        deleteBtn.disabled = false;
                    } else {
                        setInlineMsg(msgEl, name + " removed.", false);
                        li.remove();
                        allUsers = allUsers.filter(x => x.id !== u.id);
                    }
                });
                actions.appendChild(deleteBtn);
            }

            li.appendChild(info);
            li.appendChild(actions);
            listEl.appendChild(li);
        });
    }

    async function loadUsers() {
        listEl.innerHTML = '<li class="settings-user-row"><span style="color:var(--color-text-muted,#888)">Loading users…</span></li>';
        setInlineMsg(msgEl, "");

        const { data, error } = await supabase
            .from("users")
            .select("id, email, display_name, role, created_at")
            .order("created_at", { ascending: false });

        if (error) {
            setInlineMsg(msgEl, "Failed to load users: " + error.message, true);
            listEl.innerHTML = "";
            return;
        }

        allUsers = data || [];
        renderUsers(allUsers);
    }

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const q = searchInput.value.trim().toLowerCase();
            if (!q) { renderUsers(allUsers); return; }
            renderUsers(allUsers.filter(u =>
                (u.display_name || "").toLowerCase().includes(q) ||
                (u.email || "").toLowerCase().includes(q)
            ));
        });
    }

    // Reload when the panel is re-opened
    const navBtn = document.querySelector('.settings-nav-item[data-section="manage-users"]');
    if (navBtn) {
        navBtn.addEventListener("click", loadUsers);
    }

    await loadUsers();
}

function initAdminPanel(user, callerRole) {
    const adminNavBtn  = document.querySelector(".settings-nav-item--admin");
    const generateBtn  = document.getElementById("adminGenerateCodeBtn");
    const roleSelect   = document.getElementById("adminCodeRole");
    const codeOutput   = document.getElementById("adminGeneratedCode");
    const codeWrap     = document.getElementById("adminGeneratedCodeWrap");
    const msgEl        = document.getElementById("adminCodeMsg");

    // Show manager-only sections for authorized roles.
    applyManagerSectionVisibility(true);

    if (generateBtn) {
        generateBtn.addEventListener("click", async () => {
            generateBtn.disabled = true;
            setInlineMsg(msgEl, "");
            if (codeWrap) codeWrap.style.display = "none";

            const intendedRole = roleSelect ? roleSelect.value : "full_access";

            try {
                // Re-verify role server-side
                const { data: serverData } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                const serverRole = normalizeRole(serverData?.role || serverData?.account_type || "");
                if (!isUserManagerRole(serverRole)) {
                    throw new Error("Only admin, developer, or CEO accounts can generate access codes.");
                }

                const code = randomCode();
                const { error } = await supabase.from('access_codes').insert({
                    code,
                    status:            'active',
                    intended_role:     intendedRole,
                    created_by:        user.id,
                    created_by_email:  user.email || "",
                    created_at:        new Date().toISOString(),
                    redeemed_by:       null,
                    redeemed_at:       null
                });
                if (error) throw error;

                if (codeOutput) codeOutput.textContent = code;
                if (codeWrap)   codeWrap.style.display = "block";
                setInlineMsg(msgEl, `Code generated for role: ${formatRoleLabel(intendedRole)}`, false);
            } catch (err) {
                setInlineMsg(msgEl, friendlyAuthError(err), true);
            } finally {
                generateBtn.disabled = false;
            }
        });
    }

    // ── View As Role ─────────────────────────────────────────────────────
    initPreviewRolePanel();
}

function initPreviewRolePanel() {
    const enterBtn  = document.getElementById("enterPreviewBtn");
    const exitBtn   = document.getElementById("exitPreviewBtn");
    const selectEl  = document.getElementById("previewRoleSelect");
    const msgEl     = document.getElementById("previewRoleMsg");

    if (!enterBtn || !selectEl) return;

    // If already in preview mode, update UI to show exit button
    const active = getPreviewRole();
    if (active) {
        if (selectEl) selectEl.value = active;
        if (exitBtn)  exitBtn.style.display = "";
        setInlineMsg(msgEl, `Currently previewing as: ${formatRoleLabel(active)}`, false);
    }

    enterBtn.addEventListener("click", () => {
        const role = selectEl.value;
        if (!role) return;
        try { window.localStorage.setItem(PREVIEW_ROLE_KEY, role); } catch (_) {}
        if (exitBtn) exitBtn.style.display = "";
        setInlineMsg(msgEl, `Now previewing as: ${formatRoleLabel(role)} — navigate to any page to see changes.`, false);
        // Update role badge in header immediately
        const roleEl = document.getElementById("headerUserRole");
        if (roleEl) roleEl.textContent = formatRoleLabel(role);
        // Show banner
        const banner = document.getElementById("rolePreviewBanner");
        const labelEl = document.getElementById("rolePreviewLabel");
        if (banner && labelEl) {
            labelEl.textContent = formatRoleLabel(role);
            banner.hidden = false;
        }
    });

    if (exitBtn) {
        exitBtn.addEventListener("click", () => {
            try { window.localStorage.removeItem(PREVIEW_ROLE_KEY); } catch (_) {}
            exitBtn.style.display = "none";
            setInlineMsg(msgEl, "Preview mode exited.", false);
            // Restore real role badge
            const roleEl = document.getElementById("headerUserRole");
            if (roleEl) {
                const real = window.localStorage.getItem("accountRole") || "member";
                roleEl.textContent = formatRoleLabel(real);
            }
            // Hide banner
            const banner = document.getElementById("rolePreviewBanner");
            if (banner) banner.hidden = true;
        });
    }
}

function getPreviewRole() {
    try { return window.localStorage.getItem(PREVIEW_ROLE_KEY) || ""; }
    catch (_) { return ""; }
}

// ── Boot ───────────────────────────────────────────────────────────────────

let _settingsInitialized = false;

// Default to hidden until role is verified.
applyManagerSectionVisibility(false);

async function handleSettingsAuthState(session) {
    if (!session?.user) {
        window.location.replace("index.html");
        return;
    }

    if (_settingsInitialized) return;
    _settingsInitialized = true;

    const user = session.user;

    await populateProfileFields(user);
    initProfileSave(user);
    initChangeEmail(user);
    initChangePassword(user);

    try {
        const { data } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        const role = normalizeRole(data?.role || data?.account_type || "");

        // Keep localStorage in sync so header badge reflects real role immediately.
        try { window.localStorage.setItem("accountRole", role || "member"); } catch (_) {}

        const canManageUsers = isUserManagerRole(role);
        // Update role badge in header immediately.
        const roleEl = document.getElementById("headerUserRole");
        if (roleEl) roleEl.textContent = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Member";

        applyManagerSectionVisibility(canManageUsers);
        if (canManageUsers) {
            initAdminPanel(user, role);
            await initManageUsers(user);
        }
    } catch (e) {
        // Not critical — admin panel stays hidden
        applyManagerSectionVisibility(false);
    }
}

supabase.auth.onAuthStateChange((_event, session) => {
    Promise.resolve().then(() => handleSettingsAuthState(session));
});
