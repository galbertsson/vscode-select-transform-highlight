import * as vscode from 'vscode';
import { DiagnosticsProvider } from './DiagnosticsProvider';
import { createVirtualDocument } from './VirtualDocumentAdapter';

export const URI_SCHEME = 'embedded-st-js';

export default class VirtualDocumentProvider
    implements vscode.TextDocumentContentProvider
{
    private virtualDocuments = new Map<string, string>();
    private virtualDocumentsTimers = new Map<string, NodeJS.Timeout>();

    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;

    static getVirtualURI(uri: string) {
        return `${URI_SCHEME}:${encodeURI(uri.replace('.ts', '.js'))}`;
    }

    static getVirtualURIPath(uri: string) {
        return vscode.Uri.parse(VirtualDocumentProvider.getVirtualURI(uri));
    }

    constructor() {
        vscode.workspace.onDidChangeTextDocument(
            this.onDidChangeTextDocument,
            this,
        );
    }

    onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
        if (event.document.languageId === 'typescript') {
            const uri = VirtualDocumentProvider.getVirtualURI(
                event.document.uri.fsPath,
            );

            if (this.virtualDocumentsTimers.has(uri)) {
                clearTimeout(this.virtualDocumentsTimers.get(uri));
            }

            // Don't spam update the virtual document, wait for the user to stop typing
            const timer = setTimeout(() => {
                const { content } = createVirtualDocument(event.document);

                this.virtualDocuments.set(uri, content);
                this.virtualDocumentsTimers.delete(uri);

                // Updated diagnostics on update
                DiagnosticsProvider.getDiagnosticsProvider().updateDiagnostics(
                    event.document,
                );
            }, 500);

            this.virtualDocumentsTimers.set(uri, timer);
        }
    }

    async provideTextDocumentContent(uri: vscode.Uri) {
        const virtualURI = uri.fsPath.startsWith(URI_SCHEME)
            ? uri.fsPath
            : VirtualDocumentProvider.getVirtualURI(uri.fsPath);
        const document = this.virtualDocuments.get(virtualURI);

        if (!document) {
            this.forceUpdate(uri);
            return document;
        }

        return document;
    }

    forceUpdate(uri: vscode.Uri) {
        const uriString = VirtualDocumentProvider.getVirtualURI(uri.fsPath);

        // If a debounce is pending, cancel it and process immediately
        if (this.virtualDocumentsTimers.has(uriString)) {
            clearTimeout(this.virtualDocumentsTimers.get(uriString));
            this.virtualDocumentsTimers.delete(uriString);
        }

        const openDocument = vscode.workspace.textDocuments.find(
            (doc) => doc.uri.toString() === uri.toString(),
        );
        if (openDocument) {
            const { content } = createVirtualDocument(openDocument);
            this.virtualDocuments.set(uriString, content);
        }
    }
}
