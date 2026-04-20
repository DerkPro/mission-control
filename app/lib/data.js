import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const SENT_EMAILS_FILE = path.join(DATA_DIR, 'sent_emails.json');
const SEQUENCES_FILE = path.join(DATA_DIR, 'sequences.json');
const SAVED_SEARCHES_FILE = path.join(DATA_DIR, 'saved_searches.json');
const AB_TESTS_FILE = path.join(DATA_DIR, 'ab_tests.json');
const WARMUP_FILE = path.join(DATA_DIR, 'warmup.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(file, fallback = []) {
  ensureDir();
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {}
  return fallback;
}

function writeJSON(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Contacts
export function getContacts() { return readJSON(CONTACTS_FILE); }
export function saveContacts(contacts) { writeJSON(CONTACTS_FILE, contacts); }
export function addContacts(newContacts) {
  const existing = getContacts();
  const existingEmails = new Set(existing.map(c => c.email?.toLowerCase()));
  const unique = newContacts.filter(c => c.email && !existingEmails.has(c.email.toLowerCase()));
  const all = [...existing, ...unique.map(c => ({
    ...c,
    id: c.id || crypto.randomUUID(),
    addedAt: c.addedAt || new Date().toISOString(),
    tags: c.tags || [],
    leadScore: c.leadScore || 0,
    verified: c.verified || null,
    enriched: c.enriched || false,
  }))];
  saveContacts(all);
  return { added: unique.length, duplicates: newContacts.length - unique.length, total: all.length };
}

// Sent emails
export function getSentEmails() { return readJSON(SENT_EMAILS_FILE); }
export function saveSentEmails(emails) { writeJSON(SENT_EMAILS_FILE, emails); }
export function addSentEmail(email) {
  const emails = getSentEmails();
  emails.push({ ...email, id: crypto.randomUUID(), sentAt: new Date().toISOString() });
  saveSentEmails(emails);
  return emails;
}

// Sequences
export function getSequences() { return readJSON(SEQUENCES_FILE); }
export function saveSequences(sequences) { writeJSON(SEQUENCES_FILE, sequences); }

// Saved searches
export function getSavedSearches() { return readJSON(SAVED_SEARCHES_FILE); }
export function saveSavedSearches(searches) { writeJSON(SAVED_SEARCHES_FILE, searches); }

// AB tests
export function getABTests() { return readJSON(AB_TESTS_FILE); }
export function saveABTests(tests) { writeJSON(AB_TESTS_FILE, tests); }

// Warmup
export function getWarmup() { return readJSON(WARMUP_FILE, {}); }
export function saveWarmup(data) { writeJSON(WARMUP_FILE, data); }

// Analytics
export function getAnalytics() { return readJSON(ANALYTICS_FILE, {}); }
export function saveAnalytics(data) { writeJSON(ANALYTICS_FILE, data); }
