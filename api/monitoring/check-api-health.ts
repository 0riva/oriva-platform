#!/usr/bin/env node

/**
 * Production API Health Check Script
 * Run this to verify all endpoints are healthy on production (Vercel)
 */

import https from 'https';
import http from 'http';
import chalk from 'chalk';

interface HealthCheckConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  verbose?: boolean;
}

interface EndpointTest {
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  requiresAuth: boolean;
  expectedStatus: number;
  critical: boolean;
}

class ApiHealthChecker {
  private config: Required<HealthCheckConfig>;
  private results: Map<string, boolean> = new Map();

  constructor(config: HealthCheckConfig) {
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
  private getEndpointsToTest(): EndpointTest[] {
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
  private async testEndpoint(endpoint: EndpointTest): Promise<boolean> {
    return new Promise((resolve) => {
      const url = new URL(this.config.baseUrl + endpoint.path);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

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
            console.log(
              success ? chalk.green('✓') : chalk.red('✗'),
              chalk.bold(endpoint.name),
              chalk.gray(`[${endpoint.method} ${endpoint.path}]`),
              success
                ? chalk.green(`${res.statusCode} OK (${responseTime}ms)`)
                : chalk.red(`${res.statusCode} (expected ${endpoint.expectedStatus})`)
            );

            if (!success && data) {
              try {
                const parsed = JSON.parse(data);
                console.log(chalk.gray('  Error:', parsed.error || parsed.message || data));
              } catch {
                console.log(chalk.gray('  Response:', data.substring(0, 100)));
              }
            }
          }

          resolve(success);
        });
      });

      req.on('error', (error) => {
        console.log(
          chalk.red('✗'),
          chalk.bold(endpoint.name),
          chalk.gray(`[${endpoint.method} ${endpoint.path}]`),
          chalk.red(`Request failed: ${error.message}`)
        );
        resolve(false);
      });

      req.on('timeout', () => {
        console.log(
          chalk.red('✗'),
          chalk.bold(endpoint.name),
          chalk.gray(`[${endpoint.method} ${endpoint.path}]`),
          chalk.red(`Timeout after ${this.config.timeout}ms`)
        );
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<void> {
    console.log(chalk.blue.bold('\n🏥 API Health Check Report'));
    console.log(chalk.gray(`Target: ${this.config.baseUrl}`));
    console.log(chalk.gray(`Time: ${new Date().toISOString()}\n`));

    const endpoints = this.getEndpointsToTest();
    let criticalFailures = 0;
    let nonCriticalFailures = 0;
    let totalTests = 0;

    // Group endpoints by category
    const categories = {
      'Health': endpoints.filter(e => e.path.includes('/health')),
      'Authentication': endpoints.filter(e => e.path.includes('/auth') || e.path.includes('/user/me')),
      'Profiles': endpoints.filter(e => e.path.includes('/profiles')),
      'Core Features': endpoints.filter(e =>
        e.path.includes('/groups') ||
        e.path.includes('/entries') ||
        e.path.includes('/team') ||
        e.path.includes('/analytics')
      ),
      'Developer': endpoints.filter(e => e.path.includes('/developer'))
    };

    for (const [category, categoryEndpoints] of Object.entries(categories)) {
      if (categoryEndpoints.length === 0) continue;

      console.log(chalk.yellow.bold(`\n📋 ${category}`));
      console.log(chalk.gray('─'.repeat(40)));

      for (const endpoint of categoryEndpoints) {
        const success = await this.testEndpoint(endpoint);
        this.results.set(endpoint.name, success);
        totalTests++;

        if (!success) {
          if (endpoint.critical) {
            criticalFailures++;
          } else {
            nonCriticalFailures++;
          }
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Summary
    console.log(chalk.blue.bold('\n📊 Summary'));
    console.log(chalk.gray('─'.repeat(40)));

    const successfulTests = totalTests - criticalFailures - nonCriticalFailures;
    const successRate = (successfulTests / totalTests) * 100;

    console.log(chalk.green(`✓ Passed: ${successfulTests}/${totalTests} (${successRate.toFixed(1)}%)`));

    if (criticalFailures > 0) {
      console.log(chalk.red(`✗ Critical Failures: ${criticalFailures}`));
    }

    if (nonCriticalFailures > 0) {
      console.log(chalk.yellow(`⚠ Non-Critical Failures: ${nonCriticalFailures}`));
    }

    // Overall status
    console.log(chalk.bold('\n🎯 Overall Status:'),
      criticalFailures > 0
        ? chalk.red.bold('UNHEALTHY ⚠️')
        : nonCriticalFailures > 0
        ? chalk.yellow.bold('DEGRADED ⚠️')
        : chalk.green.bold('HEALTHY ✅')
    );

    // Exit with appropriate code
    process.exit(criticalFailures > 0 ? 1 : 0);
  }

  /**
   * Test detailed health endpoint
   */
  async testDetailedHealth(): Promise<void> {
    console.log(chalk.blue.bold('\n🔍 Detailed Health Check'));
    console.log(chalk.gray('─'.repeat(40)));

    const url = new URL(this.config.baseUrl + '/api/v1/health/detailed');
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    return new Promise((resolve) => {
      const req = httpModule.get(url.href, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const health = JSON.parse(data);

            console.log(chalk.bold('Status:'),
              health.status === 'healthy'
                ? chalk.green(health.status.toUpperCase())
                : health.status === 'degraded'
                ? chalk.yellow(health.status.toUpperCase())
                : chalk.red(health.status.toUpperCase())
            );

            console.log(chalk.bold('Uptime:'), `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`);

            if (health.services) {
              console.log(chalk.bold('\nServices:'));
              for (const [key, service] of Object.entries(health.services)) {
                const svc = service as any;
                const statusIcon = svc.status === 'up' ? '✓' : svc.status === 'degraded' ? '⚠' : '✗';
                const statusColor = svc.status === 'up' ? chalk.green : svc.status === 'degraded' ? chalk.yellow : chalk.red;
                console.log(`  ${statusColor(statusIcon)} ${svc.name}: ${statusColor(svc.status)}`);
                if (svc.responseTime) {
                  console.log(chalk.gray(`    Response time: ${svc.responseTime}ms`));
                }
              }
            }

            if (health.metrics) {
              console.log(chalk.bold('\nMetrics:'));
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
          } catch (error) {
            console.log(chalk.red('Failed to parse detailed health response'));
            resolve();
          }
        });
      });

      req.on('error', (error) => {
        console.log(chalk.red(`Failed to fetch detailed health: ${error.message}`));
        resolve();
      });
    });
  }
}

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
  } else if (args[0] && !args[0].startsWith('-')) {
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
  console.log(chalk.bold('\n📖 Usage:'));
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
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });
}

export { ApiHealthChecker };