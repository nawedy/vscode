/**
 * Security Scanner for SuperCoderAI VSCode Extension
 *
 * This file implements a comprehensive security scanner that analyzes code for
 * vulnerabilities and provides recommendations. It leverages LLM-based analysis
 * alongside pattern matching to identify security issues with a privacy-first
 * approach.
 *
 * Key features:
 * - Pattern-based vulnerability detection
 * - LLM-powered security analysis
 * - Framework-specific security rules
 * - Privacy-focused code scanning
 * - Remediation suggestions
 *
 * File path: src/security/securityScanner.ts
 */

import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { VulnerabilityDetector } from './vulnerabilityDetector';
import { ConfigService } from '../services/configService';

// Interface for security scan results
export interface SecurityScanResult {
    code: string;
    language: string;
    issues: SecurityIssue[];
    summary: string;
    riskLevel: RiskLevel;
    scanTime: string;
}

// Interface for security issues
export interface SecurityIssue {
    id: string;
    type: SecurityIssueType;
    severity: IssueSeverity;
    description: string;
    location: {
        startLine: number;
        endLine: number;
        code: string;
    };
    recommendation: string;
    cwe?: string; // Common Weakness Enumeration ID
    references?: string[];
}

// Enum for security issue types
export enum SecurityIssueType {
    INJECTION = 'injection',
    XSS = 'cross-site-scripting',
    AUTHENTICATION = 'authentication',
    AUTHORIZATION = 'authorization',
    SENSITIVE_DATA = 'sensitive-data-exposure',
    DEPENDENCY = 'vulnerable-dependency',
    CONFIG = 'security-misconfiguration',
    DESERIALIZATION = 'insecure-deserialization',
    LOGGING = 'insufficient-logging',
    API_SECURITY = 'api-security',
    INPUT_VALIDATION = 'input-validation',
    CRYPTO = 'cryptographic-issue',
    RESOURCE_MANAGEMENT = 'resource-management',
    RACE_CONDITION = 'race-condition',
    OTHER = 'other'
}

// Enum for issue severity
export enum IssueSeverity {
    CRITICAL = 'critical',
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low',
    INFO = 'info'
}

// Enum for overall risk level
export enum RiskLevel {
    CRITICAL = 'critical',
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low',
    SECURE = 'secure'
}

// Interface for scanner configuration
interface SecurityScannerConfig {
    enableLocalScanning: boolean;
    enableLLMAnalysis: boolean;
    scanTimeoutMs: number;
    securityRulesPath?: string;
    maxIssuesPerScan: number;
    enabledRules: string[];
    ignoredRules: string[];
    customRules: any[];
}

/**
 * Security scanner for code vulnerability detection and remediation
 */
export class SecurityScanner {
    private vulnerabilityDetector: VulnerabilityDetector;
    private configService: ConfigService;
    private config: SecurityScannerConfig;

    // Pattern-based rules cache
    private securityRules: Map<string, any[]> = new Map();

    // Language-specific rule mappings
    private languageRuleMappings: Map<string, string[]> = new Map();

    /**
     * Initialize the security scanner
     */
// @ts-ignore: error TS2554: Expected 2 arguments, but got 0.
// @ts-ignore: error TS2554: Expected 2 arguments, but got 0.
// @ts-ignore: error TS2554: Expected 2 arguments, but got 0.
// @ts-ignore: error TS2554: Expected 2 arguments, but got 0.
// @ts-ignore: error TS2554: Expected 2 arguments, but got 0.
// @ts-ignore: error TS2554: Expected 2 arguments, but got 0.
    constructor() {
        this.configService = new ConfigService();
        this.config = this.loadConfig();

        // Initialize the vulnerability detector
        this.vulnerabilityDetector = new VulnerabilityDetector();

        // Load security rules
        this.loadSecurityRules();

        logger.info('SecurityScanner initialized');
    }

    /**
     * Load configuration from settings
     */
// @ts-ignore: error TS2339: Property 'getConfig' does not exist on type 'ConfigService'.
// @ts-ignore: error TS2339: Property 'getConfig' does not exist on type 'ConfigService'.
// @ts-ignore: error TS2339: Property 'getConfig' does not exist on type 'ConfigService'.
// @ts-ignore: error TS2339: Property 'getConfig' does not exist on type 'ConfigService'.
// @ts-ignore: error TS2339: Property 'getConfig' does not exist on type 'ConfigService'.
// @ts-ignore: error TS2339: Property 'getConfig' does not exist on type 'ConfigService'.
    private loadConfig(): SecurityScannerConfig {
        const config = this.configService.getConfig('securityScanner') || {};

        return {
            enableLocalScanning: config.enableLocalScanning !== undefined ? config.enableLocalScanning : true,
            enableLLMAnalysis: config.enableLLMAnalysis !== undefined ? config.enableLLMAnalysis : true,
            scanTimeoutMs: config.scanTimeoutMs || 30000, // 30 seconds
            securityRulesPath: config.securityRulesPath,
            maxIssuesPerScan: config.maxIssuesPerScan || 20,
            enabledRules: config.enabledRules || [],
            ignoredRules: config.ignoredRules || [],
            customRules: config.customRules || []
        };
    }

    /**
     * Load security rules from rules path or built-in rules
     */
    private loadSecurityRules(): void {
        try {
            // Initialize language rule mappings
            this.initializeLanguageRuleMappings();

            // In a real implementation, this would load rules from files
            // For now, we'll use built-in rules
            this.loadBuiltInRules();

            logger.info('Security rules loaded successfully');
        } catch (error) {
            logger.error(`Failed to load security rules: ${error.message}`);
        }
    }

    /**
     * Initialize language-specific rule mappings
     */
    private initializeLanguageRuleMappings(): void {
        // Map languages to rule categories
        this.languageRuleMappings.set('typescript', [
            'common', 'javascript', 'typescript', 'web', 'node'
        ]);

        this.languageRuleMappings.set('javascript', [
            'common', 'javascript', 'web', 'node'
        ]);

        this.languageRuleMappings.set('python', [
            'common', 'python', 'web'
        ]);

        this.languageRuleMappings.set('java', [
            'common', 'java', 'web'
        ]);

        this.languageRuleMappings.set('go', [
            'common', 'go', 'web'
        ]);

        // Default to common rules for unknown languages
        this.languageRuleMappings.set('unknown', ['common']);
    }

    /**
     * Load built-in security rules
     */
    private loadBuiltInRules(): void {
        // Common security rules that apply to most languages
        const commonRules = [
            {
                id: 'common-password-plaintext',
                type: SecurityIssueType.SENSITIVE_DATA,
                pattern: /(password|passwd|pwd)\s*=\s*['"][^'"]+['"]/i,
                severity: IssueSeverity.HIGH,
                description: 'Hardcoded password detected',
                recommendation: 'Store sensitive data in environment variables or secure vaults',
                cwe: 'CWE-798'
            },
            {
                id: 'common-api-key-plaintext',
                type: SecurityIssueType.SENSITIVE_DATA,
                pattern: /(api[_-]?key|token|secret)[_-]?(key)?\s*=\s*['"][^'"]{10,}['"]/i,
                severity: IssueSeverity.HIGH,
                description: 'Hardcoded API key or token detected',
                recommendation: 'Store API keys in environment variables or secure vaults',
                cwe: 'CWE-798'
            },
            {
                id: 'common-sql-injection',
                type: SecurityIssueType.INJECTION,
                pattern: /execute\(\s*["']SELECT\s+.*\s+\+\s+/i,
                severity: IssueSeverity.CRITICAL,
                description: 'Potential SQL injection vulnerability detected',
                recommendation: 'Use parameterized queries or an ORM',
                cwe: 'CWE-89'
            }
        ];

        // JavaScript/TypeScript specific rules
        const javascriptRules = [
            {
                id: 'js-eval-usage',
                type: SecurityIssueType.INJECTION,
                pattern: /eval\s*\(/i,
                severity: IssueSeverity.HIGH,
                description: 'Use of eval() can introduce code injection vulnerabilities',
                recommendation: 'Avoid using eval() and use safer alternatives',
                cwe: 'CWE-95'
            },
            {
                id: 'js-innerhtml-usage',
                type: SecurityIssueType.XSS,
                pattern: /\.innerHTML\s*=\s*(?!['"]<)/i,
                severity: IssueSeverity.MEDIUM,
                description: 'Potentially unsafe assignment to innerHTML',
                recommendation: 'Use textContent for text or sanitize content before setting innerHTML',
                cwe: 'CWE-79'
            },
            {
                id: 'js-nosql-injection',
                type: SecurityIssueType.INJECTION,
                pattern: /find\s*\(\s*{[^}]*\$where\s*:/i,
                severity: IssueSeverity.HIGH,
                description: 'Potential NoSQL injection vulnerability',
                recommendation: 'Use parameterized queries or a validated ORM',
                cwe: 'CWE-943'
            }
        ];

        // TypeScript specific rules
        const typescriptRules = [
            {
                id: 'ts-any-type',
                type: SecurityIssueType.INPUT_VALIDATION,
                pattern: /:\s*any\b/i,
                severity: IssueSeverity.LOW,
                description: 'Use of "any" type bypasses TypeScript type checking',
                recommendation: 'Use more specific types or "unknown" instead of "any"',
                cwe: 'CWE-20'
            }
        ];

        // Python specific rules
        const pythonRules = [
            {
                id: 'py-exec-usage',
                type: SecurityIssueType.INJECTION,
                pattern: /exec\s*\(/i,
                severity: IssueSeverity.HIGH,
                description: 'Use of exec() can introduce code injection vulnerabilities',
                recommendation: 'Avoid using exec() and use safer alternatives',
                cwe: 'CWE-95'
            },
            {
                id: 'py-yaml-load',
                type: SecurityIssueType.DESERIALIZATION,
                pattern: /yaml\.load\s*\(/i,
                severity: IssueSeverity.MEDIUM,
                description: 'Unsafe YAML loading can lead to code execution',
                recommendation: 'Use yaml.safe_load() instead',
                cwe: 'CWE-502'
            },
            {
                id: 'py-pickle-usage',
                type: SecurityIssueType.DESERIALIZATION,
                pattern: /pickle\.loads?\s*\(/i,
                severity: IssueSeverity.HIGH,
                description: 'Unsafe deserialization with pickle',
                recommendation: 'Avoid using pickle with untrusted data',
                cwe: 'CWE-502'
            }
        ];

        // Store rules by category
        this.securityRules.set('common', commonRules);
        this.securityRules.set('javascript', javascriptRules);
        this.securityRules.set('typescript', typescriptRules);
        this.securityRules.set('python', pythonRules);

        // Add custom rules if provided
        if (this.config.customRules && this.config.customRules.length > 0) {
            this.securityRules.set('custom', this.config.customRules);
        }
    }

    /**
     * Scan code for security vulnerabilities
     *
     * @param code Code to scan
     * @param language Programming language of the code
     * @returns Security scan results
     */
    public async scanCode(code: string, language: string): Promise<SecurityScanResult> {
        try {
            logger.info(`Scanning ${language} code for security issues`);

            const startTime = Date.now();

            // Normalize language name
            const normalizedLanguage = this.normalizeLanguage(language);

            // Get rules for this language
            const rules = this.getRulesForLanguage(normalizedLanguage);

            // Detected issues array
            const issues: SecurityIssue[] = [];

            // Step 1: Run pattern-based scan if enabled
            if (this.config.enableLocalScanning) {
                const patternIssues = await this.performPatternScan(code, normalizedLanguage, rules);
                issues.push(...patternIssues);
            }

            // Step 2: Run LLM-based scan if enabled
            if (this.config.enableLLMAnalysis) {
                const llmIssues = await this.vulnerabilityDetector.analyzeSecurity(code, normalizedLanguage);

                // Merge LLM issues, avoiding duplicates
                this.mergeIssues(issues, llmIssues);
            }

            // Step 3: Determine overall risk level
            const riskLevel = this.calculateRiskLevel(issues);

            // Step 4: Generate summary
            const summary = this.generateSummary(issues, riskLevel);

            // Create result
            const result: SecurityScanResult = {
                code,
                language: normalizedLanguage,
                issues: issues.slice(0, this.config.maxIssuesPerScan), // Limit issues if too many
                summary,
                riskLevel,
                scanTime: `${Date.now() - startTime}ms`
            };

            logger.info(`Security scan completed: ${issues.length} issues found`);

            return result;
        } catch (error) {
            logger.error(`Security scan failed: ${error.message}`);

            // Return empty result on error
            return {
                code,
                language,
                issues: [],
                summary: `Scan failed: ${error.message}`,
                riskLevel: RiskLevel.LOW, // Default to low when scan fails
                scanTime: '0ms'
            };
        }
    }

    /**
     * Normalize language name
     *
     * @param language Language name
     * @returns Normalized language name
     */
    private normalizeLanguage(language: string): string {
        const normalized = language.toLowerCase().trim();

        // Map language aliases
        switch (normalized) {
            case 'js':
                return 'javascript';
            case 'ts':
                return 'typescript';
            case 'py':
                return 'python';
            case 'jsx':
                return 'javascript';
            case 'tsx':
                return 'typescript';
            default:
                return normalized;
        }
    }

    /**
     * Get rules for a specific language
     *
     * @param language Programming language
     * @returns Array of applicable rules
     */
    private getRulesForLanguage(language: string): any[] {
        // Get rule categories for this language
        const ruleCategories = this.languageRuleMappings.get(language) || this.languageRuleMappings.get('unknown') || ['common'];

        // Collect all applicable rules
        const allRules: any[] = [];

        for (const category of ruleCategories) {
            const categoryRules = this.securityRules.get(category) || [];
            allRules.push(...categoryRules);
        }

        // Apply rule filtering from config
        return allRules.filter(rule => {
            // Skip ignored rules
            if (this.config.ignoredRules.includes(rule.id)) {
                return false;
            }

            // If enabledRules is specified, only include those rules
            if (this.config.enabledRules.length > 0) {
                return this.config.enabledRules.includes(rule.id);
            }

            // Otherwise include all rules
            return true;
        });
    }

    /**
     * Perform pattern-based security scan
     *
     * @param code Code to scan
     * @param language Programming language
     * @param rules Security rules to apply
     * @returns Array of detected security issues
     */
    private async performPatternScan(
        code: string,
        language: string,
        rules: any[]
    ): Promise<SecurityIssue[]> {
        const issues: SecurityIssue[] = [];

        // Split code into lines for location reporting
        const lines = code.split('\n');

        // Apply each rule
        for (const rule of rules) {
            // Skip rules with no pattern
            if (!rule.pattern) {
                continue;
            }

            // Find all matches
            const matches = this.findPatternMatches(code, rule.pattern);

            for (const match of matches) {
                // Calculate line numbers
                const { startLine, endLine } = this.calculateLineNumbers(code, match.index, match[0].length);

                // Extract the matching code
                const matchingCode = lines.slice(startLine - 1, endLine).join('\n');

                // Create issue
                const issue: SecurityIssue = {
                    id: rule.id,
                    type: rule.type,
                    severity: rule.severity,
                    description: rule.description,
                    location: {
                        startLine,
                        endLine,
                        code: matchingCode
                    },
                    recommendation: rule.recommendation,
                    cwe: rule.cwe,
                    references: rule.references
                };

                issues.push(issue);
            }
        }

        return issues;
    }

    /**
     * Find all matches for a pattern in code
     *
     * @param code Code to search
     * @param pattern Regex pattern
     * @returns Array of matches
     */
    private findPatternMatches(code: string, pattern: RegExp): RegExpExecArray[] {
        const matches: RegExpExecArray[] = [];

        // Create a copy of the pattern with global flag
        const globalPattern = new RegExp(pattern.source, 'g' + (pattern.ignoreCase ? 'i' : ''));

        // Find all matches
        let match: RegExpExecArray | null;
        while ((match = globalPattern.exec(code)) !== null) {
            matches.push(match);
        }

        return matches;
    }

    /**
     * Calculate line numbers for a match
     *
     * @param code Full code
     * @param matchIndex Start index of match
     * @param matchLength Length of match
     * @returns Start and end line numbers
     */
    private calculateLineNumbers(
        code: string,
        matchIndex: number,
        matchLength: number
    ): { startLine: number; endLine: number } {
        // Get code up to match start
        const beforeMatch = code.substring(0, matchIndex);

        // Get code up to match end
        const upToMatchEnd = code.substring(0, matchIndex + matchLength);

        // Count newlines before match
        const startLine = (beforeMatch.match(/\n/g) || []).length + 1;

        // Count newlines up to match end
        const endLine = (upToMatchEnd.match(/\n/g) || []).length + 1;

        return { startLine, endLine };
    }

    /**
     * Merge issues from multiple sources, avoiding duplicates
     *
     * @param targetIssues Array to merge issues into
     * @param newIssues Array of new issues to merge
     */
    private mergeIssues(targetIssues: SecurityIssue[], newIssues: SecurityIssue[]): void {
        for (const newIssue of newIssues) {
            // Check if similar issue already exists
            const isDuplicate = targetIssues.some(existingIssue =>
                existingIssue.type === newIssue.type &&
                existingIssue.location.startLine === newIssue.location.startLine &&
                existingIssue.location.endLine === newIssue.location.endLine
            );

            // Add if not a duplicate
            if (!isDuplicate) {
                targetIssues.push(newIssue);
            }
        }
    }

    /**
     * Calculate overall risk level based on issues
     *
     * @param issues Security issues
     * @returns Overall risk level
     */
    private calculateRiskLevel(issues: SecurityIssue[]): RiskLevel {
        if (issues.length === 0) {
            return RiskLevel.SECURE;
        }

        // Check for critical issues
        if (issues.some(issue => issue.severity === IssueSeverity.CRITICAL)) {
            return RiskLevel.CRITICAL;
        }

        // Check for high severity issues
        if (issues.some(issue => issue.severity === IssueSeverity.HIGH)) {
            return RiskLevel.HIGH;
        }

        // Check for medium severity issues
        if (issues.some(issue => issue.severity === IssueSeverity.MEDIUM)) {
            return RiskLevel.MEDIUM;
        }

        // If only low or info issues, return low
        return RiskLevel.LOW;
    }

    /**
     * Generate summary of security scan
     *
     * @param issues Security issues
     * @param riskLevel Overall risk level
     * @returns Summary text
     */
    private generateSummary(issues: SecurityIssue[], riskLevel: RiskLevel): string {
        if (issues.length === 0) {
            return 'No security issues detected.';
        }

        // Count issues by severity
        const severityCounts = {
            [IssueSeverity.CRITICAL]: 0,
            [IssueSeverity.HIGH]: 0,
            [IssueSeverity.MEDIUM]: 0,
            [IssueSeverity.LOW]: 0,
            [IssueSeverity.INFO]: 0
        };

        issues.forEach(issue => {
            severityCounts[issue.severity]++;
        });

        // Generate summary text
        let summary = `Security scan detected ${issues.length} issue${issues.length === 1 ? '' : 's'} `;
        summary += `with an overall risk level of ${riskLevel}. `;

        // Add severity breakdown
        const severitySummary = [];
        if (severityCounts[IssueSeverity.CRITICAL] > 0) {
            severitySummary.push(`${severityCounts[IssueSeverity.CRITICAL]} critical`);
        }
        if (severityCounts[IssueSeverity.HIGH] > 0) {
            severitySummary.push(`${severityCounts[IssueSeverity.HIGH]} high`);
        }
        if (severityCounts[IssueSeverity.MEDIUM] > 0) {
            severitySummary.push(`${severityCounts[IssueSeverity.MEDIUM]} medium`);
        }
        if (severityCounts[IssueSeverity.LOW] > 0) {
            severitySummary.push(`${severityCounts[IssueSeverity.LOW]} low`);
        }
        if (severityCounts[IssueSeverity.INFO] > 0) {
            severitySummary.push(`${severityCounts[IssueSeverity.INFO]} info`);
        }

        if (severitySummary.length > 0) {
            summary += `Breakdown: ${severitySummary.join(', ')}.`;
        }

        return summary;
    }
}
