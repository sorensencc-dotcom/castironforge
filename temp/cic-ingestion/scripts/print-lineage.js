#!/usr/bin/env node
// Print recent lineage rows from DB
import Database from 'better-sqlite3';
const dbPath = 'C:\\Users\\soren\\temp\\cic-ingestion\\data\\cic.db';
const db = new Database(dbPath, { readonly: true });
const rows = db.prepare('SELECT * FROM lineage ORDER BY id DESC LIMIT 50').all();
console.log(JSON.stringify(rows, null, 2));
db.close();
