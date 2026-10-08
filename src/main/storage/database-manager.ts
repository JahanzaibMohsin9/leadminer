import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { BusinessData, ScrapeConfig } from '../../common/types';
import log from 'electron-log';


export interface ScrapeSession {
  id: number;
  keyword: string;
  city: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  leadCount: number;
}

export class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'leadminer.db');
    log.info(`Database path: ${dbPath}`);

    this.db = new Database(dbPath);

    // Enable WAL mode for better reliability and performance
    this.db.pragma('journal_mode = WAL');

    this.initTables();

    // Create initial backup
    this.createBackup();
  }


  private initTables() {
    // Create sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL,
        city TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        leadCount INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Create leads table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        sessionId INTEGER NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        website TEXT,
        address TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_leads_sessionId ON leads(sessionId);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_createdAt ON sessions(createdAt DESC);
    `);
  }

  // Session management
  createSession(config: ScrapeConfig): number {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (keyword, city, status)
      VALUES (?, ?, 'running')
    `);
    const result = stmt.run(config.keyword, config.city);
    return result.lastInsertRowid as number;
  }

  updateSessionStatus(sessionId: number, status: string) {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = ?, updatedAt = datetime('now')
      WHERE id = ?
    `);
    stmt.run(status, sessionId);
  }

  getSession(sessionId: number): ScrapeSession | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `);
    return stmt.get(sessionId) as ScrapeSession | undefined;
  }

  getAllSessions(): ScrapeSession[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions ORDER BY createdAt DESC
    `);
    return stmt.all() as ScrapeSession[];
  }

  getRecentSessions(limit: number = 10): ScrapeSession[] {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions 
      ORDER BY createdAt DESC 
      LIMIT ?
    `);
    return stmt.all(limit) as ScrapeSession[];
  }

  // Lead management
  saveLead(sessionId: number, lead: BusinessData) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO leads (id, sessionId, name, phone, email, website, address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(lead.id, sessionId, lead.name, lead.phone, lead.email, lead.website, lead.address);

    // Update session lead count
    this.updateLeadCount(sessionId);
  }

  saveLeads(sessionId: number, leads: BusinessData[]) {
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO leads (id, sessionId, name, phone, email, website, address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((leads: BusinessData[]) => {
      for (const lead of leads) {
        insertStmt.run(lead.id, sessionId, lead.name, lead.phone, lead.email, lead.website, lead.address);
      }
    });

    insertMany(leads);
    this.updateLeadCount(sessionId);
  }

  private updateLeadCount(sessionId: number) {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET leadCount = (SELECT COUNT(*) FROM leads WHERE sessionId = ?),
          updatedAt = datetime('now')
      WHERE id = ?
    `);
    stmt.run(sessionId, sessionId);
  }

  getSessionLeads(sessionId: number): BusinessData[] {
    const stmt = this.db.prepare(`
      SELECT id, name, phone, email, website, address 
      FROM leads 
      WHERE sessionId = ? 
      ORDER BY createdAt ASC
    `);
    return stmt.all(sessionId) as BusinessData[];
  }

  getAllLeads(): BusinessData[] {
    const stmt = this.db.prepare(`
      SELECT id, name, phone, email, website, address 
      FROM leads 
      ORDER BY createdAt DESC
    `);
    return stmt.all() as BusinessData[];
  }

  // Cleanup
  deleteSession(sessionId: number) {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    stmt.run(sessionId);
  }

  deleteOldSessions(daysOld: number = 30) {
    const stmt = this.db.prepare(`
      DELETE FROM sessions 
      WHERE datetime(createdAt) < datetime('now', '-' || ? || ' days')
    `);
    stmt.run(daysOld);
  }

  /**
   * Create a backup of the database
   */
  createBackup() {
    try {
      const userDataPath = app.getPath('userData');
      const dbPath = path.join(userDataPath, 'leadminer.db');
      const backupPath = path.join(userDataPath, `leadminer_backup_${Date.now()}.db`);

      // Copy database file
      fs.copyFileSync(dbPath, backupPath);

      // Keep only last 5 backups
      const backups = fs.readdirSync(userDataPath)
        .filter(f => f.startsWith('leadminer_backup_'))
        .sort()
        .reverse();

      // Delete old backups
      for (let i = 5; i < backups.length; i++) {
        fs.unlinkSync(path.join(userDataPath, backups[i]));
      }

      log.info(`Database backup created: ${backupPath}`);
    } catch (error) {
      log.error('Error creating database backup:', error);
    }
  }

  close() {
    // Create backup before closing
    this.createBackup();
    this.db.close();
  }
}
