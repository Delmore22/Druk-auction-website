import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
	getAuth,
	onAuthStateChanged,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	updateProfile,
	deleteUser,
	signOut,
	getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
	getFirestore,
	doc,
	setDoc,
	runTransaction,
	serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
	apiKey: "AIzaSyAC3xaSFXMBH4Q5_3t_8ahitDqLKhBWOQA",
	authDomain: "classicauction.firebaseapp.com",
	projectId: "classicauction",
	storageBucket: "classicauction.firebasestorage.app",
	messagingSenderId: "621471898709",
	appId: "1:621471898709:web:ea94de1b232bb7c82f48dc",
	measurementId: "G-LVZ75CWDE9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

function normalizeCode(code) {
	return (code || "").trim().toUpperCase().replace(/\s+/g, "");
}

function randomCode() {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	const segmentLength = 4;
	const segments = 2;
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

async function redeemAccessCode(code, uid) {
	const cleanCode = normalizeCode(code);
	if (!cleanCode) {
		throw new Error("Access code is required.");
	}

	const codeRef = doc(db, "access_codes", cleanCode);

	await runTransaction(db, async (transaction) => {
		const snapshot = await transaction.get(codeRef);
		if (!snapshot.exists()) {
			throw new Error("Access code not found.");
		}

		const data = snapshot.data();
		if (data.status !== "active") {
			throw new Error("Access code is not active.");
		}
		if (data.redeemedBy) {
			throw new Error("Access code has already been used.");
		}

		transaction.update(codeRef, {
			status: "used",
			redeemedBy: uid,
			redeemedAt: serverTimestamp()
		});
	});

	return cleanCode;
}

function showTab(tabName) {
	const showLogin = tabName === "login";

	tabLogin.classList.toggle("is-active", showLogin);
	tabLogin.setAttribute("aria-selected", showLogin ? "true" : "false");

	tabSignup.classList.toggle("is-active", !showLogin);
	tabSignup.setAttribute("aria-selected", !showLogin ? "true" : "false");

	loginPanel.classList.toggle("is-hidden", !showLogin);
	signupPanel.classList.toggle("is-hidden", showLogin);
}

async function updateSessionUi(user) {
	if (!user) {
		sessionPanel.classList.add("is-hidden");
		adminPanel.classList.add("is-hidden");
		generatedCode.textContent = "";
		return;
	}

	const token = await getIdTokenResult(user, true);
	const isAdmin = Boolean(token.claims.admin);

	sessionSummary.textContent = `${user.email} is signed in${isAdmin ? " (admin)" : ""}.`;
	sessionPanel.classList.remove("is-hidden");
	adminPanel.classList.toggle("is-hidden", !isAdmin);
}

function toFriendlyError(err) {
	const message = err && err.message ? err.message : "Unknown error";
	if (message.includes("auth/invalid-credential")) return "Invalid email or password.";
	if (message.includes("auth/email-already-in-use")) return "This email is already registered.";
	if (message.includes("auth/weak-password")) return "Use a stronger password with at least 8 characters.";
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
		await signInWithEmailAndPassword(auth, email, password);
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

	let createdUser = null;
	try {
		setLoading(signupButton, true);
		const createResult = await createUserWithEmailAndPassword(auth, email, password);
		createdUser = createResult.user;

		const code = await redeemAccessCode(rawCode, createdUser.uid);

		if (name) {
			await updateProfile(createdUser, { displayName: name });
		}

		await setDoc(doc(db, "users", createdUser.uid), {
			email: createdUser.email,
			displayName: name || "",
			role: "member",
			accessCode: code,
			createdAt: serverTimestamp()
		}, { merge: true });

		signupPanel.reset();
		setMessage("Account created. You are now signed in.", "is-ok");
	} catch (err) {
		if (createdUser && auth.currentUser && auth.currentUser.uid === createdUser.uid) {
			try {
				await deleteUser(auth.currentUser);
			} catch (deleteErr) {
				console.error("Rollback failed after signup error:", deleteErr);
			}
		}
		setMessage(toFriendlyError(err), "is-error");
	} finally {
		setLoading(signupButton, false);
	}
});

logoutButton.addEventListener("click", async () => {
	try {
		await signOut(auth);
		setMessage("Logged out.", "is-ok");
	} catch (err) {
		setMessage(toFriendlyError(err), "is-error");
	}
});

generateCodeButton.addEventListener("click", async () => {
	const user = auth.currentUser;
	if (!user) {
		setMessage("You must be logged in.", "is-warn");
		return;
	}

	try {
		setLoading(generateCodeButton, true);
		const token = await getIdTokenResult(user, true);
		if (!token.claims.admin) {
			throw new Error("Only admin accounts can generate access codes.");
		}

		const code = randomCode();
		await setDoc(doc(db, "access_codes", code), {
			status: "active",
			createdBy: user.uid,
			createdByEmail: user.email || "",
			createdAt: serverTimestamp(),
			redeemedBy: null,
			redeemedAt: null
		}, { merge: false });

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

onAuthStateChanged(auth, async (user) => {
	try {
		await updateSessionUi(user);
		if (user) {
			loginPanel.classList.add("is-hidden");
			signupPanel.classList.add("is-hidden");
			tabLogin.classList.remove("is-active");
			tabSignup.classList.remove("is-active");
		} else {
			showTab("login");
		}
	} catch (err) {
		setMessage(toFriendlyError(err), "is-error");
	}
});

showTab("login");
