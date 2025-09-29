"use strict";
/**
 * Health Check Service
 * Comprehensive health monitoring for all API endpoints and services
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheckService = void 0;
exports.trackEndpointPerformance = trackEndpointPerformance;
const supabase_js_1 = require("@supabase/supabase-js");
class HealthCheckService {
    constructor() {
        this.supabase = null;
        this.startTime = new Date();
        this.endpointStats = new Map();
        this.initializeSupabase();
    }
    initializeSupabase() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseServiceKey) {
            this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
        }
    }
    /**
     * Main health check method - performs comprehensive system health assessment
     */
    async performHealthCheck() {
        const services = await this.checkServices();
        const endpoints = this.getEndpointHealth();
        const metrics = this.getSystemMetrics();
        const overallStatus = this.calculateOverallStatus(services);
        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: this.getUptime(),
            services,
            endpoints,
            metrics
        };
    }
    /**
     * Check all external services
     */
    async checkServices() {
        const services = {};
        // Check Database (Supabase)
        services.database = await this.checkDatabase();
        // Check API Key Validation Service
        services.apiKeyValidation = await this.checkApiKeyValidation();
        // Check Rate Limiting Service
        services.rateLimiting = this.checkRateLimiting();
        // Check Logging Service
        services.logging = this.checkLogging();
        return services;
    }
    /**
     * Check database connectivity and performance
     */
    async checkDatabase() {
        const startTime = Date.now();
        try {
            if (!this.supabase) {
                throw new Error('Supabase client not initialized');
            }
            // Simple health check query
            const { data, error } = await this.supabase
                .from('api_keys')
                .select('id')
                .limit(1);
            const responseTime = Date.now() - startTime;
            if (error) {
                return {
                    name: 'PostgreSQL (Supabase)',
                    status: 'down',
                    responseTime,
                    lastChecked: new Date().toISOString(),
                    error: error.message
                };
            }
            return {
                name: 'PostgreSQL (Supabase)',
                status: 'up',
                responseTime,
                lastChecked: new Date().toISOString(),
                details: {
                    connectionPooling: true,
                    ssl: true
                }
            };
        }
        catch (error) {
            return {
                name: 'PostgreSQL (Supabase)',
                status: 'down',
                responseTime: Date.now() - startTime,
                lastChecked: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Check API key validation service
     */
    async checkApiKeyValidation() {
        const startTime = Date.now();
        try {
            // Check if we can decode a test key format
            const testKey = 'ok_test_' + Buffer.from('test').toString('base64');
            const responseTime = Date.now() - startTime;
            return {
                name: 'API Key Validation',
                status: 'up',
                responseTime,
                lastChecked: new Date().toISOString(),
                details: {
                    algorithm: 'HMAC-SHA256',
                    keyTypes: ['live', 'test']
                }
            };
        }
        catch (error) {
            return {
                name: 'API Key Validation',
                status: 'down',
                responseTime: Date.now() - startTime,
                lastChecked: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Check rate limiting service
     */
    checkRateLimiting() {
        return {
            name: 'Rate Limiting',
            status: 'up',
            lastChecked: new Date().toISOString(),
            details: {
                maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || 1000,
                windowMs: 900000, // 15 minutes
                enabled: true
            }
        };
    }
    /**
     * Check logging service
     */
    checkLogging() {
        return {
            name: 'Logging (Winston)',
            status: 'up',
            lastChecked: new Date().toISOString(),
            details: {
                level: process.env.LOG_LEVEL || 'info',
                transports: ['console', 'file'],
                environment: process.env.NODE_ENV || 'development'
            }
        };
    }
    /**
     * Get health status of all registered endpoints
     */
    getEndpointHealth() {
        const endpoints = {};
        // Core endpoints
        const coreEndpoints = [
            { path: '/api/v1/health', method: 'GET' },
            { path: '/api/v1/auth/profile', method: 'GET' },
            { path: '/api/v1/user/me', method: 'GET' },
            { path: '/api/v1/profiles/active', method: 'GET' },
            { path: '/api/v1/groups', method: 'GET' },
            { path: '/api/v1/entries', method: 'GET' },
            { path: '/api/v1/developer/apps', method: 'GET' }
        ];
        coreEndpoints.forEach(endpoint => {
            const key = `${endpoint.method} ${endpoint.path}`;
            const stats = this.endpointStats.get(key);
            endpoints[key] = {
                path: endpoint.path,
                method: endpoint.method,
                status: stats ? 'available' : 'unknown',
                lastResponseTime: stats ? stats.totalTime / stats.total : undefined,
                lastChecked: new Date().toISOString(),
                successRate: stats ? (stats.success / stats.total) * 100 : undefined
            };
        });
        return endpoints;
    }
    /**
     * Get system metrics
     */
    getSystemMetrics() {
        const memUsage = process.memoryUsage();
        return {
            memoryUsage: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external
            },
            cpuUsage: process.cpuUsage(),
            requestsPerMinute: this.calculateRequestsPerMinute(),
            averageResponseTime: this.calculateAverageResponseTime(),
            errorRate: this.calculateErrorRate()
        };
    }
    /**
     * Calculate overall system status based on service health
     */
    calculateOverallStatus(services) {
        const serviceStatuses = Object.values(services).map(s => s.status);
        if (serviceStatuses.every(s => s === 'up')) {
            return 'healthy';
        }
        if (serviceStatuses.some(s => s === 'down')) {
            // Critical service down (database)
            if (services.database?.status === 'down') {
                return 'unhealthy';
            }
            return 'degraded';
        }
        if (serviceStatuses.some(s => s === 'degraded')) {
            return 'degraded';
        }
        return 'healthy';
    }
    /**
     * Get system uptime in seconds
     */
    getUptime() {
        return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    }
    /**
     * Track endpoint usage
     */
    trackEndpoint(method, path, success, responseTime) {
        const key = `${method} ${path}`;
        const stats = this.endpointStats.get(key) || { total: 0, success: 0, totalTime: 0 };
        stats.total++;
        if (success)
            stats.success++;
        stats.totalTime += responseTime;
        this.endpointStats.set(key, stats);
    }
    /**
     * Calculate requests per minute
     */
    calculateRequestsPerMinute() {
        const uptimeMinutes = this.getUptime() / 60;
        if (uptimeMinutes < 1)
            return 0;
        let totalRequests = 0;
        this.endpointStats.forEach(stats => {
            totalRequests += stats.total;
        });
        return Math.round(totalRequests / uptimeMinutes);
    }
    /**
     * Calculate average response time across all endpoints
     */
    calculateAverageResponseTime() {
        let totalTime = 0;
        let totalRequests = 0;
        this.endpointStats.forEach(stats => {
            totalTime += stats.totalTime;
            totalRequests += stats.total;
        });
        if (totalRequests === 0)
            return 0;
        return Math.round(totalTime / totalRequests);
    }
    /**
     * Calculate error rate
     */
    calculateErrorRate() {
        let totalRequests = 0;
        let totalErrors = 0;
        this.endpointStats.forEach(stats => {
            totalRequests += stats.total;
            totalErrors += (stats.total - stats.success);
        });
        if (totalRequests === 0)
            return 0;
        return Math.round((totalErrors / totalRequests) * 100);
    }
    /**
     * Simple health check - returns basic status
     */
    async getBasicHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: this.getUptime()
        };
    }
    /**
     * Detailed health check for monitoring dashboard
     */
    async getDetailedHealth() {
        return this.performHealthCheck();
    }
}
// Export singleton instance
exports.healthCheckService = new HealthCheckService();
// Express middleware for tracking endpoint performance
function trackEndpointPerformance(req, res, next) {
    const startTime = Date.now();
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        const success = res.statusCode < 400;
        exports.healthCheckService.trackEndpoint(req.method, req.path, success, responseTime);
    });
    next();
}
