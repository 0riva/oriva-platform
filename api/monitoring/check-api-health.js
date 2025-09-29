#!/usr/bin/env node
"use strict";
/**
 * Production API Health Check Script
 * Run this to verify all endpoints are healthy on production (Vercel)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiHealthChecker = void 0;
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const chalk_1 = __importDefault(require("chalk"));
class ApiHealthChecker {
    constructor(config) {
        this.results = new Map();
        this.config = {
            baseUrl: config.baseUrl.replace(/\/$/, ''), // Remove trailing slash
            apiKey: config.apiKey || '',
            timeout: config.timeout || 10000,
            verbose: config.verbose || false
        };
    }
    /**
     * Define all endpoints to test
     */
    getEndpointsToTest() {
        return [
            // Health endpoints (no auth required)
            {
                name: 'Basic Health',
                path: '/health',
                method: 'GET',
                requiresAuth: false,
                expectedStatus: 200,
                critical: true
            },
            {
                name: 'API Health',
                path: '/api/v1/health',
                method: 'GET',
                requiresAuth: false,
                expectedStatus: 200,
                critical: true
            },
            {
                name: 'Detailed Health',
                path: '/api/v1/health/detailed',
                method: 'GET',
                requiresAuth: false,
                expectedStatus: 200,
                critical: false
            },
            // Auth endpoints
            {
                name: 'Auth Profile',
                path: '/api/v1/auth/profile',
                method: 'GET',
                requiresAuth: true,
                expectedStatus: 200,
                critical: true
            },
            {
                name: 'User Me',
                path: '/api/v1/user/me',
                method: 'GET',
                requiresAuth: true,
                expectedStatus: 200,
                critical: true
            },
            // Profile endpoints
            {
                name: 'Active Profiles',
                path: '/api/v1/profiles/active',
                method: 'GET',
                requiresAuth: true,
                expectedStatus: 200,
                critical: true
            },
            {
                name: 'Available Profiles',
                path: '/api/v1/profiles/available',
                method: 'GET',
                requiresAuth: true,
                expectedStatus: 200,
                critical: false
            },
            // Group endpoints
            {
                name: 'Groups List',
                path: '/api/v1/groups',
                method: 'GET',
                requiresAuth: true,
                expectedStatus: 200,
                critical: false
            },
            // Entry endpoints
            {
                name: 'Entries List',
                path: '/api/v1/entries?limit=1',
                method: 'GET',
                requiresAuth: true,
                expectedStatus: 200,
                critical: false
            },
            // Developer endpoints
            {
                name: 'Developer Apps',
                path: '/api/v1/developer/apps',
                method: 'GET',
                requiresAuth: true,
                expectedStatus: 200,
                critical: false
            },
            // Analytics endpoints
            {
                name: 'Analytics Summary',
                path: '/api/v1/analytics/summary',
                method: 'GET',
                requiresAuth: true,
                expectedStatus: 200,
                critical: false
            },
            // Team endpoints
            {
                name: 'Team Members',
                path: '/api/v1/team/members',
                method: 'GET',
                requiresAuth: true,
                expectedStatus: 200,
                critical: false
            }
        ];
    }
    /**
     * Make HTTP request to endpoint
     */
    async testEndpoint(endpoint) {
        return new Promise((resolve) => {
            const url = new URL(this.config.baseUrl + endpoint.path);
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https_1.default : http_1.default;
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: endpoint.method,
                timeout: this.config.timeout,
                headers: {
                    'Accept': 'application/json',
                    ...(endpoint.requiresAuth && this.config.apiKey ? {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'x-api-key': this.config.apiKey
                    } : {})
                }
            };
            const startTime = Date.now();
            const req = httpModule.request(options, (res) => {
                const responseTime = Date.now() - startTime;
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    const success = res.statusCode === endpoint.expectedStatus;
                    if (this.config.verbose || !success) {
                        console.log(success ? chalk_1.default.green('✓') : chalk_1.default.red('✗'), chalk_1.default.bold(endpoint.name), chalk_1.default.gray(`[${endpoint.method} ${endpoint.path}]`), success
                            ? chalk_1.default.green(`${res.statusCode} OK (${responseTime}ms)`)
                            : chalk_1.default.red(`${res.statusCode} (expected ${endpoint.expectedStatus})`));
                        if (!success && data) {
                            try {
                                const parsed = JSON.parse(data);
                                console.log(chalk_1.default.gray('  Error:', parsed.error || parsed.message || data));
                            }
                            catch {
                                console.log(chalk_1.default.gray('  Response:', data.substring(0, 100)));
                            }
                        }
                    }
                    resolve(success);
                });
            });
            req.on('error', (error) => {
                console.log(chalk_1.default.red('✗'), chalk_1.default.bold(endpoint.name), chalk_1.default.gray(`[${endpoint.method} ${endpoint.path}]`), chalk_1.default.red(`Request failed: ${error.message}`));
                resolve(false);
            });
            req.on('timeout', () => {
                console.log(chalk_1.default.red('✗'), chalk_1.default.bold(endpoint.name), chalk_1.default.gray(`[${endpoint.method} ${endpoint.path}]`), chalk_1.default.red(`Timeout after ${this.config.timeout}ms`));
                req.destroy();
                resolve(false);
            });
            req.end();
        });
    }
    /**
     * Run all health checks
     */
    async runHealthChecks() {
        console.log(chalk_1.default.blue.bold('\n🏥 API Health Check Report'));
        console.log(chalk_1.default.gray(`Target: ${this.config.baseUrl}`));
        console.log(chalk_1.default.gray(`Time: ${new Date().toISOString()}\n`));
        const endpoints = this.getEndpointsToTest();
        let criticalFailures = 0;
        let nonCriticalFailures = 0;
        let totalTests = 0;
        // Group endpoints by category
        const categories = {
            'Health': endpoints.filter(e => e.path.includes('/health')),
            'Authentication': endpoints.filter(e => e.path.includes('/auth') || e.path.includes('/user/me')),
            'Profiles': endpoints.filter(e => e.path.includes('/profiles')),
            'Core Features': endpoints.filter(e => e.path.includes('/groups') ||
                e.path.includes('/entries') ||
                e.path.includes('/team') ||
                e.path.includes('/analytics')),
            'Developer': endpoints.filter(e => e.path.includes('/developer'))
        };
        for (const [category, categoryEndpoints] of Object.entries(categories)) {
            if (categoryEndpoints.length === 0)
                continue;
            console.log(chalk_1.default.yellow.bold(`\n📋 ${category}`));
            console.log(chalk_1.default.gray('─'.repeat(40)));
            for (const endpoint of categoryEndpoints) {
                const success = await this.testEndpoint(endpoint);
                this.results.set(endpoint.name, success);
                totalTests++;
                if (!success) {
                    if (endpoint.critical) {
                        criticalFailures++;
                    }
                    else {
                        nonCriticalFailures++;
                    }
                }
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        // Summary
        console.log(chalk_1.default.blue.bold('\n📊 Summary'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        const successfulTests = totalTests - criticalFailures - nonCriticalFailures;
        const successRate = (successfulTests / totalTests) * 100;
        console.log(chalk_1.default.green(`✓ Passed: ${successfulTests}/${totalTests} (${successRate.toFixed(1)}%)`));
        if (criticalFailures > 0) {
            console.log(chalk_1.default.red(`✗ Critical Failures: ${criticalFailures}`));
        }
        if (nonCriticalFailures > 0) {
            console.log(chalk_1.default.yellow(`⚠ Non-Critical Failures: ${nonCriticalFailures}`));
        }
        // Overall status
        console.log(chalk_1.default.bold('\n🎯 Overall Status:'), criticalFailures > 0
            ? chalk_1.default.red.bold('UNHEALTHY ⚠️')
            : nonCriticalFailures > 0
                ? chalk_1.default.yellow.bold('DEGRADED ⚠️')
                : chalk_1.default.green.bold('HEALTHY ✅'));
        // Exit with appropriate code
        process.exit(criticalFailures > 0 ? 1 : 0);
    }
    /**
     * Test detailed health endpoint
     */
    async testDetailedHealth() {
        console.log(chalk_1.default.blue.bold('\n🔍 Detailed Health Check'));
        console.log(chalk_1.default.gray('─'.repeat(40)));
        const url = new URL(this.config.baseUrl + '/api/v1/health/detailed');
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https_1.default : http_1.default;
        return new Promise((resolve) => {
            const req = httpModule.get(url.href, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const health = JSON.parse(data);
                        console.log(chalk_1.default.bold('Status:'), health.status === 'healthy'
                            ? chalk_1.default.green(health.status.toUpperCase())
                            : health.status === 'degraded'
                                ? chalk_1.default.yellow(health.status.toUpperCase())
                                : chalk_1.default.red(health.status.toUpperCase()));
                        console.log(chalk_1.default.bold('Uptime:'), `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`);
                        if (health.services) {
                            console.log(chalk_1.default.bold('\nServices:'));
                            for (const [key, service] of Object.entries(health.services)) {
                                const svc = service;
                                const statusIcon = svc.status === 'up' ? '✓' : svc.status === 'degraded' ? '⚠' : '✗';
                                const statusColor = svc.status === 'up' ? chalk_1.default.green : svc.status === 'degraded' ? chalk_1.default.yellow : chalk_1.default.red;
                                console.log(`  ${statusColor(statusIcon)} ${svc.name}: ${statusColor(svc.status)}`);
                                if (svc.responseTime) {
                                    console.log(chalk_1.default.gray(`    Response time: ${svc.responseTime}ms`));
                                }
                            }
                        }
                        if (health.metrics) {
                            console.log(chalk_1.default.bold('\nMetrics:'));
                            if (health.metrics.memoryUsage) {
                                const mem = health.metrics.memoryUsage;
                                console.log(`  Memory: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB`);
                            }
                            if (health.metrics.requestsPerMinute !== undefined) {
                                console.log(`  Requests/min: ${health.metrics.requestsPerMinute}`);
                            }
                            if (health.metrics.averageResponseTime !== undefined) {
                                console.log(`  Avg Response Time: ${health.metrics.averageResponseTime}ms`);
                            }
                            if (health.metrics.errorRate !== undefined) {
                                console.log(`  Error Rate: ${health.metrics.errorRate}%`);
                            }
                        }
                        resolve();
                    }
                    catch (error) {
                        console.log(chalk_1.default.red('Failed to parse detailed health response'));
                        resolve();
                    }
                });
            });
            req.on('error', (error) => {
                console.log(chalk_1.default.red(`Failed to fetch detailed health: ${error.message}`));
                resolve();
            });
        });
    }
}
exports.ApiHealthChecker = ApiHealthChecker;
// CLI execution
async function main() {
    const args = process.argv.slice(2);
    const verbose = args.includes('-v') || args.includes('--verbose');
    const detailed = args.includes('-d') || args.includes('--detailed');
    // Get base URL from arguments or environment
    let baseUrl = process.env.API_BASE_URL || 'https://your-api.vercel.app';
    const urlArgIndex = args.findIndex(arg => arg.startsWith('--url='));
    if (urlArgIndex !== -1) {
        baseUrl = args[urlArgIndex].split('=')[1];
    }
    else if (args[0] && !args[0].startsWith('-')) {
        baseUrl = args[0];
    }
    // Get API key from environment or arguments
    let apiKey = process.env.API_KEY || process.env.ORIVA_API_KEY || '';
    const keyArgIndex = args.findIndex(arg => arg.startsWith('--key='));
    if (keyArgIndex !== -1) {
        apiKey = args[keyArgIndex].split('=')[1];
    }
    const checker = new ApiHealthChecker({
        baseUrl,
        apiKey,
        verbose,
        timeout: 10000
    });
    if (detailed) {
        await checker.testDetailedHealth();
    }
    await checker.runHealthChecks();
}
// Show usage if help is requested
if (process.argv.includes('-h') || process.argv.includes('--help')) {
    console.log(chalk_1.default.bold('\n📖 Usage:'));
    console.log('  npm run health:check [URL] [OPTIONS]');
    console.log('  node api/monitoring/check-api-health.js [URL] [OPTIONS]');
    console.log('\nOptions:');
    console.log('  --url=<URL>      API base URL (default: from env API_BASE_URL)');
    console.log('  --key=<KEY>      API key for authenticated endpoints');
    console.log('  -v, --verbose    Show all test results (not just failures)');
    console.log('  -d, --detailed   Show detailed health information');
    console.log('  -h, --help       Show this help message');
    console.log('\nExamples:');
    console.log('  npm run health:check https://api.example.com');
    console.log('  npm run health:check --url=https://api.example.com --key=ok_live_xxx -v');
    console.log('  npm run health:check --detailed');
    process.exit(0);
}
// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error(chalk_1.default.red('Error:'), error);
        process.exit(1);
    });
}
