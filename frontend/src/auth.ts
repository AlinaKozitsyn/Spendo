export interface StoredUser {
  email: string;
  password: string;
  acceptedTermsAt: string;
  acceptedCookiesAt: string;
}

const USERS_KEY = "spendo.auth.users";
const SESSION_KEY = "spendo.auth.session";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getCurrentSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function userExists(email: string): boolean {
  const target = normalizeEmail(email);
  return readUsers().some((user) => user.email === target);
}

export function createUser(email: string, password: string): StoredUser {
  const normalized = normalizeEmail(email);
  const users = readUsers();
  if (users.some((user) => user.email === normalized)) {
    throw new Error("An account with this email already exists.");
  }

  const now = new Date().toISOString();
  const user: StoredUser = {
    email: normalized,
    password,
    acceptedTermsAt: now,
    acceptedCookiesAt: now,
  };
  writeUsers([...users, user]);
  localStorage.setItem(SESSION_KEY, normalized);
  return user;
}

export function signIn(email: string, password: string): StoredUser {
  const normalized = normalizeEmail(email);
  const user = readUsers().find((item) => item.email === normalized);
  if (!user || user.password !== password) {
    throw new Error("Email or password is incorrect.");
  }
  localStorage.setItem(SESSION_KEY, normalized);
  return user;
}

export function signOut(): void {
  localStorage.removeItem(SESSION_KEY);
}

