import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import axios from 'axios';
const LOG_API_URL = 'http://20.244.56.144/evaluation-service/logs';
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJqYXllbmRyYW1hbGxhMjZAZ21haWwuY29tIiwiZXhwIjoxNzU2OTY0MTEzLCJpYXQiOjE3NTY5NjMyMTMsImlzcyI6IkFmZm9yZCBNZWRpY2FsIFRlY2hub2xvZ2llcyBQcml2YXRlIExpbWl0ZWQiLCJqdGkiOiJiYmNhNTY4MC1lZmZjLTRmZGUtOWMxZS01NzdhM2RmODIzM2QiLCJsb2NhbGUiOiJlbi1JTiIsIm5hbWUiOiJtYWxsYSBqYXllbmRyYSIsInN1YiI6IjNiZmE2NDBmLTNjOTktNDI3Yi05ZTg4LWIyNTg5NGFjOWQxNyJ9LCJlbWFpbCI6ImpheWVuZHJhbWFsbGEyNkBnbWFpbC5jb20iLCJuYW1lIjoibWFsbGEgamF5ZW5kcmEiLCJyb2xsTm8iOiIyMmwzMWEwNWMxIiwiYWNjZXNzQ29kZSI6Ill6dUplVSIsImNsaWVudElEIjoiM2JmYTY0MGYtM2M5OS00MjdiLTllODgtYjI1ODk0YWM5ZDE3IiwiY2xpZW50U2VjcmV0IjoiU1lwS3RGRXBZTWtrbVlZZyJ9.Rify78k3LtJZx0roiMlLKnBpNuf6fgJOwaw2dKD41is';

/**
 * Reusable Log function for remote API logging
 * @param {"backend"|"frontend"} stack
 * @param {"debug"|"info"|"warn"|"error"|"fatal"} level
 * @param {string} pkg - package name (see spec)
 * @param {string} message - descriptive log message
 */
export async function Log(stack, level, pkg, message) {
  try {
    const body = { stack, level, package: pkg, message };
    const res = await axios.post(LOG_API_URL, body, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.status === 200) {
      console.log(`[REMOTE LOGGED] [${stack}] [${level}] [${pkg}] ${message}`);
    } else {
      console.warn(`[REMOTE LOG FAIL] [${stack}] [${level}] [${pkg}] ${message}`);
    }
  } catch (err) {
    console.error(`[REMOTE LOG ERROR] [${stack}] [${level}] [${pkg}] ${message}`, err.response?.data || err.message);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.join(__dirname, '..', 'logs');
const logFile = path.join(logDir, 'app.log');

if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

function writeLog(obj) {
  const line = JSON.stringify({ t: new Date().toISOString(), ...obj }) + '\n';
  fs.appendFileSync(logFile, line, { encoding: 'utf8' });
}

export function requestIdMiddleware() {
  return (req, res, next) => {
    req.id = req.headers['x-request-id'] || crypto.randomBytes(8).toString('hex');
    res.setHeader('x-request-id', req.id);
    next();
  };
}

export function loggingMiddleware() {
  return (req, res, next) => {
    const start = Date.now();
    req.log = {
      info: (msg, extra={}) => writeLog({ level: 'info', rid: req.id, msg, ...extra }),
      warn: (msg, extra={}) => writeLog({ level: 'warn', rid: req.id, msg, ...extra }),
      error: (msg, extra={}) => writeLog({ level: 'error', rid: req.id, msg, ...extra }),
      remote: Log
    };
    writeLog({ level: 'info', rid: req.id, msg: 'request', method: req.method, path: req.path });
    res.on('finish', () => {
      const ms = Date.now() - start;
      writeLog({ level: 'info', rid: req.id, msg: 'response', status: res.statusCode, ms });
    });

    next();
  };
}
