/**
 * SecurityEnsemble
 *
 * Specialized ensemble for security analysis and vulnerability detection.
 * Uses AI models to scan code for security issues and suggest fixes.
 */

import * as vscode from 'vscode';
import { EnsembleLLM, TaskResult } from './ensembleLLM';
import { ModelManager } from '../modelManager';
import { Logger } from '../../utils/logger';
import { ConfigService } from '../../services/configService';
import { ModelCapability } from '../providers/baseProvider';
import { SecurityScanner } from '../../security/securityScanner';
import { VulnerabilityDetector } from '../../security/vulnerabilityDetector';

/**
 * Security vulnerability information
 */
export interface SecurityVulnerability {
	type: string;
	severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
	description: string;
	location: {
		startLine: number;
		endLine: number;
		code: string;
	};
	recommendation: string;
	fixedCode?: string;
	cwe?: string;
}

/**
 * Security scan result for a file
 */
export interface SecurityScanResult {
	filePath: string;
	language: string;
	issues: SecurityVulnerability[];
	riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SECURE';
	scannedAt: number;
}

/**
 * Scan result summary
 */
export interface SecurityScanSummary {
	totalFiles: number;
	totalIssues: number;
	issuesBySeverity: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
	highestRiskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SECURE';
	riskScore: number; // 0-100, higher is more risky
	scanResults: SecurityScanResult[];
}

/**
 * Security best practice
 */
export interface SecurityBestPractice {
	title: string;
	category: string;
	description: string;
	recommendation: string;
	code?: string;
	reference?: string;
	importance: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Params for analyzing security
 */
interface AnalyzeSecurityParams {
	code: string;
	language: string;
	filePath?: string;
	framework?: string;
}

/**
 * Params for generating security fixes
 */
interface GenerateSecurityFixParams {
	vulnerabilities: SecurityVulnerability[];
	code: string;
	language: string;
}

/**
 * Params for generating security report
 */
interface GenerateSecurityReportParams {
	scanResults: SecurityScanResult[];
	projectName: string;
	detailLevel?: 'brief' | 'detailed' | 'comprehensive';
	format?: 'markdown' | 'html' | 'json';
}

/**
 * Params for getting security best practices
 */
interface GetSecurityBestPracticesParams {
	language: string;
	framework?: string;
	codeType?: string;
	category?: string;
}

// Add interface for compiler output
interface CompilationResult {
	success: boolean;
	errors?: string[];
	warnings?: string[];
}

// Add type for scan results
interface ScanResult {
	filePath: string;
	issues: SecurityVulnerability[];
	riskLevel: RiskLevel;
	scanTime: number;
	summary: string;
}

// Add type for executeTask parameters
interface SecurityTaskParams {
	code: string;
	language: string;
	filePath?: string;
	framework?: string;
}

interface SecurityScanParams {
	code: string;
	language: string;
	context?: string;
}

interface SecurityResponse {
	issues: SecurityIssue[];
	summary: string;
	riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface SecurityIssue {
	description: string;
	severity: 'low' | 'medium' | 'high' | 'critical';
	line?: number;
	suggestion?: string;
}

/**
 * Security ensemble for vulnerability detection and fixes
 */
export class SecurityEnsemble extends EnsembleLLM {
	private readonly scanner: SecurityScanner;
	private readonly detector: VulnerabilityDetector;

	/**
	 * Create a new security ensemble
	 * @param modelManager Model manager
	 * @param logger Logger
	 * @param configService Configuration service
	 * @param scanner Security scanner
	 * @param detector Vulnerability detector
	 */
	constructor(
		modelManager: ModelManager,
		logger: Logger,
		configService: ConfigService,
		scanner: SecurityScanner,
		detector: VulnerabilityDetector
	) {
		super(modelManager, logger, configService, 'security');
		this.scanner = scanner;
		this.detector = detector;

		this.registerTasks();
	}

	private registerTasks(): void {
		this.registerTask('analyzeSecurity', this.analyzeSecurity.bind(this));
		this.registerTask('suggestFixes', this.suggestFixes.bind(this));
	}

	/**
	 * Analyze code for security vulnerabilities
	 * @param params Analysis parameters
	 * @returns Task result with vulnerabilities
	 */
	private async analyzeSecurity(params: SecurityScanParams): Promise<TaskResult<SecurityResponse>> {
		try {
			// First use traditional scanning
			const vulnerabilities = await this.detector.scanFile(params.code);

			// Then use AI models for deeper analysis
			const aiAnalysis = await this.modelManager.generateCompletion(
				this.buildSecurityPrompt(params),
				{
					capability: ModelCapability.SecurityAnalysis,
					systemPrompt: 'You are a security expert analyzing code for vulnerabilities.'
				}
			);

			// Combine and process results
			const issues = this.processSecurityResults(vulnerabilities, aiAnalysis);

			return {
				success: true,
				content: {
					issues,
					summary: this.generateSummary(issues),
					riskLevel: this.calculateRiskLevel(issues)
				}
			};
		} catch (error) {
			return {
				success: false,
				error: `Security analysis failed: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Generate fixes for security vulnerabilities
	 * @param params Fix generation parameters
	 * @returns Task result with fixed code
	 */
	async task_generateSecurityFix(params: GenerateSecurityFixParams): Promise<TaskResult<{ fixedCode: string, explanation: string }>> {
		this.logger.info('Generating security fix');

		try {
			// Create prompt for security fix
			const prompt = await this.buildSecurityFixPrompt(params);

			// Call the model with the appropriate capability
			const response = await this.modelManager.generateCompletion(prompt, {
				capability: ModelCapability.SecurityAnalysis,
				temperature: 0.2,
				maxTokens: 3072
			});

			// Parse the response to extract fixed code and explanation
			const result = this.parseSecurityFixResponse(response.content);

			return {
				success: true,
				content: result,
				metadata: {
					promptTokens: response.promptTokens,
					completionTokens: response.completionTokens,
					totalTokens: response.totalTokens
				}
			};
		} catch (error) {
			this.logger.error(`Error generating security fix: ${error instanceof Error ? error.message : String(error)}`);

			return {
				success: false,
				error: `Failed to generate security fix: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Get security best practices
	 * @param params Best practices parameters
	 * @returns Task result with best practices
	 */
	async task_getSecurityBestPractices(params: GetSecurityBestPracticesParams): Promise<TaskResult<SecurityBestPractice[]>> {
		this.logger.info('Getting security best practices');

		try {
			// Create prompt for security best practices
			const prompt = await this.buildSecurityBestPracticesPrompt(params);

			// Call the model with the appropriate capability
			const response = await this.modelManager.generateCompletion(prompt, {
				capability: ModelCapability.SecurityAnalysis,
				temperature: 0.1,
				maxTokens: 2048
			});

			// Parse the response to extract best practices
			const bestPractices = this.parseSecurityBestPracticesResponse(response.content, params.language);

			return {
				success: true,
				content: bestPractices,
				metadata: {
					promptTokens: response.promptTokens,
					completionTokens: response.completionTokens,
					totalTokens: response.totalTokens
				}
			};
		} catch (error) {
			this.logger.error(`Error getting security best practices: ${error instanceof Error ? error.message : String(error)}`);

			return {
				success: false,
				error: `Failed to get security best practices: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Generate security report from scan results
	 * @param params Report parameters
	 * @returns Task result with report content
	 */
	async task_generateSecurityReport(params: GenerateSecurityReportParams): Promise<TaskResult<{ report: string, format: string }>> {
		this.logger.info('Generating security report');

		try {
			// Create prompt for security report
			const prompt = await this.buildSecurityReportPrompt(params);

			// Call the model with the appropriate capability
			const response = await this.modelManager.generateCompletion(prompt, {
				capability: ModelCapability.SecurityAnalysis,
				temperature: 0.2,
				maxTokens: 4096
			});

			// Format for output
			const format = params.format || 'markdown';

			return {
				success: true,
				content: {
					report: response.content,
					format
				},
				metadata: {
					promptTokens: response.promptTokens,
					completionTokens: response.completionTokens,
					totalTokens: response.totalTokens
				}
			};
		} catch (error) {
			this.logger.error(`Error generating security report: ${error instanceof Error ? error.message : String(error)}`);

			return {
				success: false,
				error: `Failed to generate security report: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Scan an entire project for security issues
	 * @param params Project scan parameters
	 * @returns Task result with scan summary
	 */
	async task_scanProject(params: { files: Array<{ path: string; content: string; language: string }> }): Promise<TaskResult<SecurityScanSummary>> {
		this.logger.info(`Scanning project with ${params.files.length} files`);

		try {
			// Track scan results
			const scanResults: SecurityScanResult[] = [];
			let totalIssues = 0;
			const issuesBySeverity = {
				critical: 0,
				high: 0,
				medium: 0,
				low: 0
			};

			// Process each file
			for (const file of params.files) {
				// Skip very large files
				if (file.content.length > 50000) {
					this.logger.warn(`Skipping large file: ${file.path} (${file.content.length} chars)`);
					continue;
				}

				// Analyze individual file
				const result = await this.task_analyzeSecurityVulnerabilities({
					code: file.content,
					language: file.language,
					filePath: file.path
				});

				// Process result if successful
				if (result.success && result.content) {
					scanResults.push(result.content);

					// Update totals
					const fileIssues = result.content.issues.length;
					totalIssues += fileIssues;

					// Update severity counts
					result.content.issues.forEach(issue => {
						switch (issue.severity) {
							case 'CRITICAL':
								issuesBySeverity.critical++;
								break;
							case 'HIGH':
								issuesBySeverity.high++;
								break;
							case 'MEDIUM':
								issuesBySeverity.medium++;
								break;
							case 'LOW':
								issuesBySeverity.low++;
								break;
						}
					});
				}
			}

			// Determine highest risk level
			const highestRiskLevel = this.determineHighestRiskLevel(scanResults);

			// Calculate risk score (0-100)
			const riskScore = this.calculateRiskScore(issuesBySeverity);

			// Create summary
			const summary: SecurityScanSummary = {
				totalFiles: params.files.length,
				totalIssues,
				issuesBySeverity,
				highestRiskLevel,
				riskScore,
				scanResults
			};

			return {
				success: true,
				content: summary
			};
		} catch (error) {
			this.logger.error(`Error scanning project: ${error instanceof Error ? error.message : String(error)}`);

			return {
				success: false,
				error: `Failed to scan project: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Build prompt for security analysis
	 * @param params Analysis parameters
	 * @returns Security analysis prompt
	 */
	private async buildSecurityAnalysisPrompt(params: AnalyzeSecurityParams): Promise<string> {
		// Try to get template from prompt manager
		const template = this.promptManager.getTemplate('security-vulnerability-analysis');

		if (template) {
			return this.promptManager.render('security-vulnerability-analysis', {
				code: params.code,
				language: params.language,
				filePath: params.filePath || 'unknown',
				framework: params.framework || 'unknown'
			}) || this.createDefaultSecurityAnalysisPrompt(params);
		}

		return this.createDefaultSecurityAnalysisPrompt(params);
	}

	/**
	 * Create default security analysis prompt
	 * @param params Analysis parameters
	 * @returns Security analysis prompt
	 */
	private createDefaultSecurityAnalysisPrompt(params: AnalyzeSecurityParams): string {
		return `
You are a security expert analyzing code for vulnerabilities.

Analyze the following ${params.language} code for security vulnerabilities and issues:

\`\`\`${params.language}
${params.code}
\`\`\`

File: ${params.filePath || 'unknown'}
${params.framework ? `Framework: ${params.framework}` : ''}

Identify any security vulnerabilities or issues in this code. For each vulnerability, provide:
1. The type of vulnerability
2. The severity (CRITICAL, HIGH, MEDIUM, or LOW)
3. A description of the vulnerability
4. The location in the code (line numbers)
5. A specific recommendation to fix the issue
6. The CWE (Common Weakness Enumeration) identifier if applicable

Format your response as a JSON array with each vulnerability as an object:

\`\`\`json
[
  {
    "type": "vulnerability type",
    "severity": "CRITICAL|HIGH|MEDIUM|LOW",
    "description": "description of the issue",
    "location": {
      "startLine": line_number,
      "endLine": line_number,
      "code": "the problematic code snippet"
    },
    "recommendation": "specific fix recommendation",
    "cwe": "CWE-XXX"
  },
  ...
]
\`\`\`

If no vulnerabilities are found, return an empty array: \`[]\`
`;
	}

	/**
	 * Parse security analysis response
	 * @param response Model response
	 * @param params Original analysis parameters
	 * @returns Array of security vulnerabilities
	 */
	private parseSecurityAnalysisResponse(response: string, params: AnalyzeSecurityParams): SecurityVulnerability[] {
		try {
			// Extract JSON from response (may be wrapped in markdown code blocks)
			const jsonMatch = response.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) ||
				[null, response.trim()];

			const jsonStr = jsonMatch[1];

			// Parse JSON
			const vulnerabilities = JSON.parse(jsonStr) as SecurityVulnerability[];

			// Ensure we have valid vulnerabilities array
			if (!Array.isArray(vulnerabilities)) {
				return [];
			}

			// Validate and normalize each vulnerability
			return vulnerabilities.map(vuln => ({
				type: vuln.type || 'Unknown',
				severity: this.normalizeSeverity(vuln.severity),
				description: vuln.description || 'No description provided',
				location: {
					startLine: this.validateLineNumber(vuln.location?.startLine),
					endLine: this.validateLineNumber(vuln.location?.endLine, vuln.location?.startLine),
					code: vuln.location?.code || this.getCodeSnippet(params.code, vuln.location?.startLine, vuln.location?.endLine)
				},
				recommendation: vuln.recommendation || 'No recommendation provided',
				cwe: vuln.cwe || undefined
			}));
		} catch (error) {
			this.logger.error(`Error parsing security analysis response: ${error instanceof Error ? error.message : String(error)}`);
			return [];
		}
	}

	/**
	 * Build prompt for security fix
	 * @param params Fix parameters
	 * @returns Security fix prompt
	 */
	private async buildSecurityFixPrompt(params: GenerateSecurityFixParams): Promise<string> {
		// Try to get template from prompt manager
		const template = this.promptManager.getTemplate('security-vulnerability-fix');

		if (template) {
			return this.promptManager.render('security-vulnerability-fix', {
				code: params.code,
				language: params.language,
				vulnerabilities: JSON.stringify(params.vulnerabilities, null, 2)
			}) || this.createDefaultSecurityFixPrompt(params);
		}

		return this.createDefaultSecurityFixPrompt(params);
	}

	/**
	 * Create default security fix prompt
	 * @param params Fix parameters
	 * @returns Security fix prompt
	 */
	private createDefaultSecurityFixPrompt(params: GenerateSecurityFixParams): string {
		return `
You are a security expert fixing vulnerabilities in code.

Fix the following security vulnerabilities in this ${params.language} code:

\`\`\`${params.language}
${params.code}
\`\`\`

Vulnerabilities to fix:
${params.vulnerabilities.map(v => `- ${v.type} (${v.severity}): ${v.description} [Lines ${v.location.startLine}-${v.location.endLine}]`).join('\n')}

Provide the complete fixed code and an explanation of the changes made.

Format your response as follows:

\`\`\`${params.language}
// FIXED CODE HERE - include the complete fixed code
\`\`\`

EXPLANATION:
1. Detailed explanation of the fixes and why they address the vulnerabilities
`;
	}

	/**
	 * Parse security fix response
	 * @param response Model response
	 * @returns Fixed code and explanation
	 */
	private parseSecurityFixResponse(response: string): { fixedCode: string, explanation: string } {
		try {
			// Extract code and explanation
			const codeMatch = response.match(/```[\w]*\s*([\s\S]*?)\s*```/);
			let fixedCode = '';
			let explanation = '';

			if (codeMatch && codeMatch[1]) {
				fixedCode = codeMatch[1];

				// Get explanation after code block
				const parts = response.split(/```[\w]*\s*[\s\S]*?\s*```/);
				if (parts.length > 1) {
					explanation = parts[1].trim();
				}
			}

			return { fixedCode, explanation };
		} catch (error) {
			this.logger.error(`Error parsing security fix response: ${error instanceof Error ? error.message : String(error)}`);
			return { fixedCode: '', explanation: '' };
		}
	}

	/**
	 * Build prompt for security best practices
	 * @param params Best practices parameters
	 * @returns Security best practices prompt
	 */
	private async buildSecurityBestPracticesPrompt(params: GetSecurityBestPracticesParams): Promise<string> {
		// Try to get template from prompt manager
		const template = this.promptManager.getTemplate('security-best-practices');

		if (template) {
			return this.promptManager.render('security-best-practices', {
				language: params.language,
				framework: params.framework || 'unknown',
				codeType: params.codeType || 'unknown',
				category: params.category || 'general'
			}) || this.createDefaultSecurityBestPracticesPrompt(params);
		}

		return this.createDefaultSecurityBestPracticesPrompt(params);
	}

	/**
	 * Create default security best practices prompt
	 * @param params Best practices parameters
	 * @returns Security best practices prompt
	 */
	private createDefaultSecurityBestPracticesPrompt(params: GetSecurityBestPracticesParams): string {
		return `
You are a security expert providing best practices for secure coding.

Provide security best practices for ${params.language} code.

${params.framework ? `Framework: ${params.framework}` : ''}
${params.codeType ? `Code Type: ${params.codeType}` : ''}
${params.category ? `Category: ${params.category}` : ''}

For each best practice, provide:
1. Title
2. Category
3. Description
4. Specific recommendation
5. Code example (if applicable)
6. Reference (if applicable)
7. Importance (HIGH, MEDIUM, LOW)

Format your response as a JSON array with each best practice as an object:

\`\`\`json
[
  {
    "title": "Best practice title",
    "category": "Category",
    "description": "Description of the best practice",
    "recommendation": "Specific recommendation",
    "code": "Code example (if applicable)",
    "reference": "Reference (if applicable)",
    "importance": "HIGH|MEDIUM|LOW"
  },
  ...
]
\`\`\`
`;
	}

	/**
	 * Parse security best practices response
	 * @param response Model response
	 * @param language Programming language
	 * @returns Array of security best practices
	 */
	private parseSecurityBestPracticesResponse(response: string, language: string): SecurityBestPractice[] {
		try {
			// Extract JSON from response (may be wrapped in markdown code blocks)
			const jsonMatch = response.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) ||
				[null, response.trim()];

			const jsonStr = jsonMatch[1];

			// Parse JSON
			const bestPractices = JSON.parse(jsonStr) as SecurityBestPractice[];

			// Ensure we have valid best practices array
			if (!Array.isArray(bestPractices)) {
				return [];
			}

			// Validate and normalize each best practice
			return bestPractices.map(bp => ({
				title: bp.title || 'Unknown',
				category: bp.category || 'General',
				description: bp.description || 'No description provided',
				recommendation: bp.recommendation || 'No recommendation provided',
				code: bp.code || undefined,
				reference: bp.reference || undefined,
				importance: this.normalizeImportance(bp.importance)
			}));
		} catch (error) {
			this.logger.error(`Error parsing security best practices response: ${error instanceof Error ? error.message : String(error)}`);
			return [];
		}
	}

	/**
	 * Build prompt for security report
	 * @param params Report parameters
	 * @returns Security report prompt
	 */
	private async buildSecurityReportPrompt(params: GenerateSecurityReportParams): Promise<string> {
		// Try to get template from prompt manager
		const template = this.promptManager.getTemplate('security-report');

		if (template) {
			return this.promptManager.render('security-report', {
				projectName: params.projectName,
				detailLevel: params.detailLevel || 'brief',
				format: params.format || 'markdown',
				scanResults: JSON.stringify(params.scanResults, null, 2)
			}) || this.createDefaultSecurityReportPrompt(params);
		}

		return this.createDefaultSecurityReportPrompt(params);
	}

	/**
	 * Create default security report prompt
	 * @param params Report parameters
	 * @returns Security report prompt
	 */
	private createDefaultSecurityReportPrompt(params: GenerateSecurityReportParams): string {
		return `
You are a security expert generating a security report.

Generate a ${params.detailLevel || 'brief'} security report for the project "${params.projectName}".

Format: ${params.format || 'markdown'}

Scan Results:
${JSON.stringify(params.scanResults, null, 2)}

Provide a detailed report including:
1. Summary of the scan results
2. Detailed analysis of each file
3. Recommendations for fixing vulnerabilities
4. Overall risk assessment and score

Format your response as follows:

\`\`\`${params.format || 'markdown'}
# Security Report for ${params.projectName}

## Summary
- Total Files Scanned: ...
- Total Issues Found: ...
- Issues by Severity: ...
- Highest Risk Level: ...
- Risk Score: ...

## Detailed Analysis
### File: ...
- Vulnerability: ...
- Severity: ...
- Description: ...
- Recommendation: ...

## Recommendations
- ...

## Overall Risk Assessment
- Risk Level: ...
- Risk Score: ...
\`\`\`
`;
	}

	/**
	 * Determine highest risk level from scan results
	 * @param scanResults Array of scan results
	 * @returns Highest risk level
	 */
	private determineHighestRiskLevel(scanResults: SecurityScanResult[]): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SECURE' {
		let highestRiskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SECURE' = 'SECURE';

		for (const result of scanResults) {
			if (result.riskLevel === 'CRITICAL') {
				return 'CRITICAL';
			}
			if (result.riskLevel === 'HIGH' && highestRiskLevel !== 'CRITICAL') {
				highestRiskLevel = 'HIGH';
			}
			if (result.riskLevel === 'MEDIUM' && highestRiskLevel !== 'CRITICAL' && highestRiskLevel !== 'HIGH') {
				highestRiskLevel = 'MEDIUM';
			}
			if (result.riskLevel === 'LOW' && highestRiskLevel !== 'CRITICAL' && highestRiskLevel !== 'HIGH' && highestRiskLevel !== 'MEDIUM') {
				highestRiskLevel = 'LOW';
			}
		}

		return highestRiskLevel;
	}

	/**
	 * Calculate risk score based on issues by severity
	 * @param issuesBySeverity Issues by severity
	 * @returns Risk score (0-100)
	 */
	private calculateRiskScore(issuesBySeverity: { critical: number, high: number, medium: number, low: number }): number {
		const totalIssues = issuesBySeverity.critical + issuesBySeverity.high + issuesBySeverity.medium + issuesBySeverity.low;
		if (totalIssues === 0) {
			return 0;
		}

		const score = (issuesBySeverity.critical * 10 + issuesBySeverity.high * 7 + issuesBySeverity.medium * 4 + issuesBySeverity.low * 1) / totalIssues;
		return Math.min(Math.max(Math.round(score * 10), 0), 100);
	}

	/**
	 * Normalize severity value
	 * @param severity Severity value
	 * @returns Normalized severity
	 */
	private normalizeSeverity(severity: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
		switch (severity.toUpperCase()) {
			case 'CRITICAL':
				return 'CRITICAL';
			case 'HIGH':
				return 'HIGH';
			case 'MEDIUM':
				return 'MEDIUM';
			case 'LOW':
				return 'LOW';
			default:
				return 'LOW';
		}
	}

	/**
	 * Normalize importance value
	 * @param importance Importance value
	 * @returns Normalized importance
	 */
	private normalizeImportance(importance: string): 'HIGH' | 'MEDIUM' | 'LOW' {
		switch (importance.toUpperCase()) {
			case 'HIGH':
				return 'HIGH';
			case 'MEDIUM':
				return 'MEDIUM';
			case 'LOW':
				return 'LOW';
			default:
				return 'LOW';
		}
	}

	/**
	 * Validate line number
	 * @param lineNumber Line number
	 * @param defaultValue Default value if invalid
	 * @returns Validated line number
	 */
	private validateLineNumber(lineNumber?: number, defaultValue: number = 1): number {
		return (typeof lineNumber === 'number' && lineNumber > 0) ? lineNumber : defaultValue;
	}

	/**
	 * Get code snippet from code based on line numbers
	 * @param code Code content
	 * @param startLine Start line number
	 * @param endLine End line number
	 * @returns Code snippet
	 */
	private getCodeSnippet(code: string, startLine?: number, endLine?: number): string {
		const lines = code.split('\n');
		const start = this.validateLineNumber(startLine) - 1;
		const end = this.validateLineNumber(endLine, startLine) - 1;
		return lines.slice(start, end + 1).join('\n');
	}

	/**
	 * Execute a security task
	 * @param taskName Task name
	 * @param params Task parameters
	 * @returns Task result
	 */
	async executeTask<T>(
		taskName: string,
		params: SecurityTaskParams
	): Promise<TaskResult<T>> {
		// ...existing code...
	}

	private async suggestFixes(params: SecurityScanParams): Promise<TaskResult<string[]>> {
		// Implementation for suggesting security fixes
		// ...existing code...
	}

	private buildSecurityPrompt(params: SecurityScanParams): string {
		// Implementation for building security prompt
		// ...existing code...
	}

	private processSecurityResults(
		vulnerabilities: Vulnerability[],
		aiAnalysis: ModelResponse
	): SecurityIssue[] {
		// Implementation for processing security results
		// ...existing code...
	}

	private generateSummary(issues: SecurityIssue[]): string {
		// Implementation for generating summary
		// ...existing code...
	}

	private calculateRiskLevel(issues: SecurityIssue[]): 'low' | 'medium' | 'high' | 'critical' {
		// Implementation for calculating risk level
		// ...existing code...
	}
}
