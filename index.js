import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = 'https://chllzkgugwuerlnbltay.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rpzSMoGHXVKEIRwipYmrHg_64fqgX0y';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");
const loginPanel = document.getElementById("loginPanel");
const signupPanel = document.getElementById("signupPanel");
const authMessage = document.getElementById("authMessage");
const sessionPanel = document.getElementById("sessionPanel");
const sessionSummary = document.getElementById("sessionSummary");
const adminPanel = document.getElementById("adminPanel");
const generatedCode = document.getElementById("generatedCode");

const loginButton = document.getElementById("loginButton");
const signupButton = document.getElementById("signupButton");
const logoutButton = document.getElementById("logoutButton");
const generateCodeButton = document.getElementById("generateCodeButton");

function setMessage(text, type = "") {
	authMessage.textContent = text || "";
	authMessage.classList.remove("is-ok", "is-warn", "is-error");
	if (type) {
		authMessage.classList.add(type);
	}
}

function setLoading(button, loading) {
	button.disabled = loading;
	button.textContent = loading ? "Working..." : button.dataset.defaultText;
}

function setIdentityStorage(user, role) {
	if (!user) return;
	const email = String(user.email || "").trim();
	const displayName = String(user.user_metadata?.display_name || "").trim();
	const fallbackName = email ? email.split("@")[0].replace(/[._-]+/g, " ").trim() : "";
	const accountName = displayName || fallbackName || "Member";

	try {
		window.localStorage.setItem("accountName", accountName);
		window.localStorage.setItem("accountEmail", email);
		window.localStorage.setItem("accountRole", role || "member");
	} catch (err) {
		// Ignore storage failures to avoid blocking auth behavior.
	}
}

function clearIdentityStorage() {
	try {
		window.localStorage.removeItem("accountName");
		window.localStorage.removeItem("accountEmail");
		window.localStorage.removeItem("accountRole");
	} catch (err) {
		// Ignore storage failures to avoid blocking auth behavior.
	}
}

const CODE_GENERATOR_ROLES = new Set(["admin", "developer", "dev", "ceo"]);
const DEFAULT_ADMIN_EMAILS = new Set(["drukauto@gmail.com"]);

function normalizeRole(rawRole) {
	return String(rawRole || "")
		.trim()
		.toLowerCase()
		.replace(/-/g, "_")
		.replace(/\s+/g, "_");
}

function canGenerateAccessCodes(role) {
	return CODE_GENERATOR_ROLES.has(normalizeRole(role));
}

function getBootstrapRoleForEmail(email) {
	return DEFAULT_ADMIN_EMAILS.has(String(email || "").trim().toLowerCase()) ? "admin" : "member";
}

function formatRoleLabel(role) {
	const normalized = normalizeRole(role);
	if (!normalized) return "Member";
	if (normalized === "ceo") return "CEO";
	if (normalized === "dev") return "Developer";
	return normalized.charAt(0).toUpperCase() + normalized.slice(1).replace(/_/g, " ");
}

async function upsertUserProfileFromAuthUser(user, accessCode) {
	if (!user) return "member";

	const email = String(user.email || "").trim();
	const displayName = String(user.user_metadata?.display_name || "").trim();

	// Always read the current role — never overwrite it from the client.
	const { data: existingRow } = await supabase
		.from("users")
		.select("role")
		.eq("id", user.id)
		.maybeSingle();

	if (existingRow) {
		// Row exists: update only safe fields, never touch role.
		const updates = { id: user.id, email, display_name: displayName };
		if (accessCode) updates.access_code = accessCode;
		const { error } = await supabase.from("users").upsert(updates);
		if (error) throw error;
		return normalizeRole(existingRow.role);
	}

	// New user: assign bootstrap role (admin for known emails, member otherwise).
	const bootstrapRole = getBootstrapRoleForEmail(email);
	const payload = {
		id: user.id,
		email,
		display_name: displayName,
		role: bootstrapRole,
		created_at: new Date().toISOString()
	};
	if (accessCode) payload.access_code = accessCode;

	const { error } = await supabase.from("users").insert(payload);
	if (error) throw error;

	return bootstrapRole;
}

function normalizeCode(code) {
	return (code || "").trim().toUpperCase().replace(/\s+/g, "");
}

function isValidCodeFormat(code) {
	// Accept both legacy 8-char (AB12-CD34) and new 16-char (AB12-CD34-EF56-GH78) formats.
	return /^[A-Z2-9]{4}-[A-Z2-9]{4}(-[A-Z2-9]{4}-[A-Z2-9]{4})?$/.test(code);
}

function randomCode() {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	const segmentLength = 4;
	const segments = 4;
	const parts = [];

	for (let i = 0; i < segments; i += 1) {
		let chunk = "";
		for (let j = 0; j < segmentLength; j += 1) {
			chunk += alphabet[Math.floor(Math.random() * alphabet.length)];
		}
		parts.push(chunk);
	}

	return parts.join("-");
}

async function validateAccessCode(code) {
	const cleanCode = normalizeCode(code);
	if (!cleanCode) throw new Error("Access code is required.");
	if (!isValidCodeFormat(cleanCode)) throw new Error("Invalid access code format.");

	const { data, error } = await supabase
		.from('access_codes')
		.select('status, redeemed_by')
		.eq('code', cleanCode)
		.single();

	if (error || !data) throw new Error("Access code not found.");
	if (data.status !== 'active') throw new Error("Access code is not active.");
	if (data.redeemed_by) throw new Error("Access code has already been used.");

	return cleanCode;
}

async function markCodeUsed(code, userId) {
	const { data, error } = await supabase
		.from('access_codes')
		.update({ status: 'used', redeemed_by: userId, redeemed_at: new Date().toISOString() })
		.eq('code', code)
		.eq('status', 'active')
		.is('redeemed_by', null)
		.select();

	if (error) throw new Error("Failed to redeem access code.");
	if (!data || data.length === 0) throw new Error("Access code has already been used.");
	return code;
}

function showTab(tabName) {
	const showLogin = tabName === "login";

	tabLogin.classList.toggle("is-active", showLogin);
	tabLogin.setAttribute("aria-selected", showLogin ? "true" : "false");

	tabSignup.classList.toggle("is-active", !showLogin);
	tabSignup.setAttribute("aria-selected", !showLogin ? "true" : "false");

	loginPanel.classList.toggle("is-hidden", !showLogin);
	loginPanel.hidden = !showLogin;
	signupPanel.classList.toggle("is-hidden", showLogin);
	signupPanel.hidden = showLogin;
}

async function updateSessionUi(user) {
	if (!user) {
		sessionPanel.classList.add("is-hidden");
		sessionPanel.hidden = true;
		adminPanel.classList.add("is-hidden");
		adminPanel.hidden = true;
		generatedCode.textContent = "";
		clearIdentityStorage();
		return;
	}

	const role = await upsertUserProfileFromAuthUser(user);
	const canManageCodes = canGenerateAccessCodes(role);
	setIdentityStorage(user, role || "member");

	sessionSummary.textContent = `${user.email} is signed in (${formatRoleLabel(role)}).`;
	sessionPanel.classList.remove("is-hidden");
	sessionPanel.hidden = false;
	adminPanel.classList.toggle("is-hidden", !canManageCodes);
	adminPanel.hidden = !canManageCodes;
}

function toFriendlyError(err) {
	const message = err && err.message ? err.message : "Unknown error";
	if (message.includes("Invalid login credentials")) return "Invalid email or password.";
	if (message.includes("User already registered")) return "This email is already registered.";
	if (message.includes("Password should be at least")) return "Use a stronger password with at least 8 characters.";
	return message;
}

tabLogin.addEventListener("click", () => {
	showTab("login");
	setMessage("");
});

tabSignup.addEventListener("click", () => {
	showTab("signup");
	setMessage("");
});

loginPanel.addEventListener("submit", async (event) => {
	event.preventDefault();
	const form = new FormData(loginPanel);
	const email = String(form.get("email") || "").trim();
	const password = String(form.get("password") || "");

	if (!email || !password) {
		setMessage("Email and password are required.", "is-warn");
		return;
	}

	try {
		setLoading(loginButton, true);
		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) throw error;
		setMessage("Logged in successfully.", "is-ok");
	} catch (err) {
		setMessage(toFriendlyError(err), "is-error");
	} finally {
		setLoading(loginButton, false);
	}
});

signupPanel.addEventListener("submit", async (event) => {
	event.preventDefault();
	const form = new FormData(signupPanel);
	const name = String(form.get("name") || "").trim();
	const email = String(form.get("email") || "").trim();
	const password = String(form.get("password") || "");
	const rawCode = String(form.get("accessCode") || "");

	if (!email || !password || !rawCode) {
		setMessage("Email, password, and access code are required.", "is-warn");
		return;
	}

	try {
		setLoading(signupButton, true);

		// Validate access code before creating the auth user
		const code = await validateAccessCode(rawCode);

		const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { display_name: name } }
		});
		if (signUpError) throw signUpError;

		const user = signUpData.user;
		if (!user) {
			// Email confirmation is required — user won't be signed in yet
			signupPanel.reset();
			setMessage("Account created. Check your email to confirm your address before signing in.", "is-ok");
			return;
		}

		// Mark code as used — only succeeds if still active (optimistic lock)
		try {
			await markCodeUsed(code, user.id);
		} catch (codeErr) {
			await supabase.auth.signOut();
			throw codeErr;
		}

		await upsertUserProfileFromAuthUser(user, code);

		signupPanel.reset();
		setMessage("Account created. You are now signed in.", "is-ok");
	} catch (err) {
		setMessage(toFriendlyError(err), "is-error");
	} finally {
		setLoading(signupButton, false);
	}
});

logoutButton.addEventListener("click", async () => {
	try {
		await supabase.auth.signOut();
		clearIdentityStorage();
		setMessage("Logged out.", "is-ok");
	} catch (err) {
		setMessage(toFriendlyError(err), "is-error");
	}
});

if (new URLSearchParams(window.location.search).get("logout") === "1") {
	supabase.auth.signOut().catch(() => {});
	clearIdentityStorage();
	setMessage("Logged out.", "is-ok");
}

generateCodeButton.addEventListener("click", async () => {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) {
		setMessage("You must be logged in.", "is-warn");
		return;
	}

	try {
		setLoading(generateCodeButton, true);
		const { data: userRow } = await supabase
			.from('users')
			.select('role')
			.eq('id', user.id)
			.single();

		const role = userRow ? String(userRow.role || "") : "";
		if (!canGenerateAccessCodes(role)) {
			throw new Error("Only admin, developer, or CEO accounts can generate access codes.");
		}

		const code = randomCode();
		const { error } = await supabase.from('access_codes').insert({
			code,
			status: 'active',
			created_by: user.id,
			created_by_email: user.email || "",
			created_at: new Date().toISOString(),
			redeemed_by: null,
			redeemed_at: null
		});
		if (error) throw error;

		generatedCode.textContent = code;
		setMessage("Access code generated.", "is-ok");
	} catch (err) {
		setMessage(toFriendlyError(err), "is-error");
	} finally {
		setLoading(generateCodeButton, false);
	}
});

[loginButton, signupButton, generateCodeButton].forEach((button) => {
	button.dataset.defaultText = button.textContent;
});

async function handleAuthStateChange(session) {
	const user = session?.user ?? null;
	try {
		await updateSessionUi(user);
		if (user) {
			loginPanel.classList.add("is-hidden");
			loginPanel.hidden = true;
			signupPanel.classList.add("is-hidden");
			signupPanel.hidden = true;
			tabLogin.classList.remove("is-active");
			tabSignup.classList.remove("is-active");
		} else {
			showTab("login");
		}
	} catch (err) {
		setMessage(toFriendlyError(err), "is-error");
	}
}

supabase.auth.onAuthStateChange((_event, session) => {
	Promise.resolve().then(() => handleAuthStateChange(session));
});

showTab("login");
