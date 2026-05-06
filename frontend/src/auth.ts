export interface StoredUser {
  email: string;
  password: string;
  acceptedTermsAt: string;
  acceptedCookiesAt: string;
}

export interface Note {
  id: string;
  month: number;
  year: number;
  text: string;
  createdAt: string;
}

export interface Goal {
  category: string;
  goalAmount: number;
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

export function deleteAccount(email: string): void {
  const users = readUsers().filter((u) => u.email !== email);
  writeUsers(users);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(`spendo.notes.${email}`);
  localStorage.removeItem(`spendo.goals.${email}`);
  localStorage.removeItem(`spendo.last-cats.${email}`);
}

// ── Notes ──────────────────────────────────────────────────────────────────

export function getNotes(email: string): Note[] {
  try {
    const raw = localStorage.getItem(`spendo.notes.${email}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveNote(
  email: string,
  note: { month: number; year: number; text: string }
): Note {
  const notes = getNotes(email);
  const newNote: Note = {
    ...note,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(`spendo.notes.${email}`, JSON.stringify([...notes, newNote]));
  window.dispatchEvent(new CustomEvent("spendo:notes-updated"));
  return newNote;
}

export function deleteNote(email: string, id: string): void {
  const notes = getNotes(email).filter((n) => n.id !== id);
  localStorage.setItem(`spendo.notes.${email}`, JSON.stringify(notes));
  window.dispatchEvent(new CustomEvent("spendo:notes-updated"));
}

// ── Goals ──────────────────────────────────────────────────────────────────

export function getGoals(email: string): Goal[] {
  try {
    const raw = localStorage.getItem(`spendo.goals.${email}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGoals(email: string, goals: Goal[]): void {
  localStorage.setItem(`spendo.goals.${email}`, JSON.stringify(goals));
  window.dispatchEvent(new CustomEvent("spendo:goals-updated"));
}

// ── Last-seen categories (persisted so AccountPanel can access them) ───────

export function saveLastCategories(
  email: string,
  categories: Array<{ name: string; icon: string | null }>
): void {
  localStorage.setItem(`spendo.last-cats.${email}`, JSON.stringify(categories));
}

export function getLastCategories(
  email: string
): Array<{ name: string; icon: string | null }> {
  try {
    const raw = localStorage.getItem(`spendo.last-cats.${email}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
