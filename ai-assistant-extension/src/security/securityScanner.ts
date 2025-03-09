import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';

interface SecurityScanResult {
	issues: SecurityIssue[];
	summary: string;
	timestamp: number;
}

interface SecurityIssue {
	severity: 'critical' | 'high' | 'medium' | 'low';
	type: SecurityIssueType;
	message: string;
	location?: vscode.Location;
	suggestedFix?: string;
}

enum SecurityIssueType {
	ApiKeyExposure = 'apiKeyExposure',
	InsecureTransport = 'insecureTransport',
	WeakEncryption = 'weakEncryption',
	UnsafeDeserialization = 'unsafeDeserialization',
	TokenExposure = 'tokenExposure'
}

export class SecurityScanner {
	constructor(
		private readonly logger: Logger,
		private readonly errorHandler: ErrorHandler
	) {}

	public async scanWorkspace(): Promise<SecurityScanResult> {
		try {
			const issues: SecurityIssue[] = [];
			const files = await vscode.workspace.findFiles('**/*.{ts,js,json}', '**/node_modules/**');

			for (const file of files) {
				const fileIssues = await this.scanFile(file);
				issues.push(...fileIssues);
			}

			return {
				issues,
				summary: this.generateSummary(issues),
				timestamp: Date.now()
			};
		} catch (error) {
			this.errorHandler.handleError(error, 'Failed to complete security scan');
			return {
				issues: [],
				summary: 'Scan failed',
				timestamp: Date.now()
			};
		}
	}

	private async scanFile(uri: vscode.Uri): Promise<SecurityIssue[]> {
		const issues: SecurityIssue[] = [];
		const content = await vscode.workspace.fs.readFile(uri);
		const text = Buffer.from(content).toString('utf-8');

		// Check for API keys
		const apiKeyIssues = this.checkForApiKeys(text, uri);
		issues.push(...apiKeyIssues);

		// Check for insecure transport
		const transportIssues = this.checkForInsecureTransport(text, uri);
		issues.push(...transportIssues);

		return issues;
	}

	private checkForApiKeys(content: string, uri: vscode.Uri): SecurityIssue[] {
		const issues: SecurityIssue[] = [];
		const apiKeyPatterns = [
			/['"]sk-[a-zA-Z0-9]{32,}['"]/g,
			/['"]ak-[a-zA-Z0-9]{32,}['"]/g,
			/['"]key-[a-zA-Z0-9]{32,}['"]/g
		];

		for (const pattern of apiKeyPatterns) {
			const matches = content.matchAll(pattern);
			for (const match of matches) {
				if (match.index !== undefined) {
					issues.push({
						severity: 'critical',
						type: SecurityIssueType.ApiKeyExposure,
						message: 'Potential API key exposure detected',
						location: new vscode.Location(
							uri,
							new vscode.Position(
								content.substring(0, match.index).split('\n').length - 1,
								0
							)
						),
						suggestedFix: 'Move API keys to secure storage or environment variables'
					});
				}
			}
		}

		return issues;
	}

	private checkForInsecureTransport(content: string, uri: vscode.Uri): SecurityIssue[] {
		const issues: SecurityIssue[] = [];
		const insecurePatterns = [
			/http:\/\//g,
			/axios\.create\(\{[^}]*httpsAgent:\s*false[^}]*\}\)/g
		];

		for (const pattern of insecurePatterns) {
			const matches = content.matchAll(pattern);
			for (const match of matches) {
				if (match.index !== undefined) {
					issues.push({
						severity: 'high',
						type: SecurityIssueType.InsecureTransport,
						message: 'Insecure HTTP transport detected',
						location: new vscode.Location(
							uri,
							new vscode.Position(
								content.substring(0, match.index).split('\n').length - 1,
								0
							)
						),
						suggestedFix: 'Use HTTPS for all external communications'
					});
				}
			}
		}

		return issues;
	}

	private generateSummary(issues: SecurityIssue[]): string {
		const criticalCount = issues.filter(i => i.severity === 'critical').length;
		const highCount = issues.filter(i => i.severity === 'high').length;
		const mediumCount = issues.filter(i => i.severity === 'medium').length;
		const lowCount = issues.filter(i => i.severity === 'low').length;

		return `Security scan complete. Found:\n` +
			`${criticalCount} critical issues\n` +
			`${highCount} high severity issues\n` +
			`${mediumCount} medium severity issues\n` +
			`${lowCount} low severity issues`;
	}
}
