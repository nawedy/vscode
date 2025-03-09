import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

interface DependencyNode {
	uri: vscode.Uri;
	imports: Set<string>;
	exports: Set<string>;
	dependsOn: Set<string>;
	dependedBy: Set<string>;
}

export class DependencyGraph {
	private nodes: Map<string, DependencyNode> = new Map();
	private readonly logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	public addNode(uri: vscode.Uri, imports: string[], exports: string[]): void {
		const key = uri.toString();
		this.nodes.set(key, {
			uri,
			imports: new Set(imports),
			exports: new Set(exports),
			dependsOn: new Set(),
			dependedBy: new Set()
		});
	}

	public addDependency(from: vscode.Uri, to: vscode.Uri): void {
		const fromKey = from.toString();
		const toKey = to.toString();

		const fromNode = this.nodes.get(fromKey);
		const toNode = this.nodes.get(toKey);

		if (fromNode && toNode) {
			fromNode.dependsOn.add(toKey);
			toNode.dependedBy.add(fromKey);
		}
	}

	public getRelatedFiles(uri: vscode.Uri, depth: number = 1): vscode.Uri[] {
		const visited = new Set<string>();
		const result: vscode.Uri[] = [];
		const key = uri.toString();

		this.traverseGraph(key, depth, visited, result);
		return result;
	}

	private traverseGraph(key: string, depth: number, visited: Set<string>, result: vscode.Uri[]): void {
		if (depth <= 0 || visited.has(key)) {
			return;
		}

		visited.add(key);
		const node = this.nodes.get(key);

		if (!node) {
			return;
		}

		// Add dependencies
		for (const depKey of node.dependsOn) {
			const depNode = this.nodes.get(depKey);
			if (depNode && !visited.has(depKey)) {
				result.push(depNode.uri);
				this.traverseGraph(depKey, depth - 1, visited, result);
			}
		}

		// Add dependents
		for (const depKey of node.dependedBy) {
			const depNode = this.nodes.get(depKey);
			if (depNode && !visited.has(depKey)) {
				result.push(depNode.uri);
				this.traverseGraph(depKey, depth - 1, visited, result);
			}
		}
	}
}
