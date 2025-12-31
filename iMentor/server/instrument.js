// server/instrument.js
const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // Performance Monitoring
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });
  console.log("✓ Sentry instrument.js initialized successfully.");
} else {
  console.warn("! SENTRY_DSN not found in .env. Sentry instrumentation is disabled.");
}