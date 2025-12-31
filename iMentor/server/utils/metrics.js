// server/utils/metrics.js
const client = require('prom-client');

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label `service` to all metrics
register.setDefaultLabels({
  service: 'ai-tutor-nodejs-backend'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Define a custom metric for tracking HTTP request durations
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10] // Buckets for response time from 0.1s to 10s
});

// Register the custom metric
register.registerMetric(httpRequestDurationMicroseconds);

module.exports = {
    register,
    httpRequestDurationMicroseconds
};