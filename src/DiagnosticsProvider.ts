import * as vscode from 'vscode';
import VirtualDocumentProvider from './VirtualDocumentProvider';

export class DiagnosticsProvider {
    static provider: DiagnosticsProvider | undefined;

    private virtualDocumentProvider: VirtualDocumentProvider;

    static initialize(
        context: vscode.ExtensionContext,
        virtualDocumentProvider: VirtualDocumentProvider,
    ) {
        DiagnosticsProvider.provider = new DiagnosticsProvider(
            virtualDocumentProvider,
        );
        DiagnosticsProvider.provider.setupDiagnosticsHandler(context);
    }

    static getDiagnosticsProvider() {
        if (!DiagnosticsProvider.provider) {
            throw Error('Cannot get provider before initialize');
        }

        return DiagnosticsProvider.provider;
    }

    private diagnosticsCollection: vscode.DiagnosticCollection;

    private constructor(virtualDocumentProvider: VirtualDocumentProvider) {
        this.diagnosticsCollection =
            vscode.languages.createDiagnosticCollection('inlineJs');
        this.virtualDocumentProvider = virtualDocumentProvider;
    }

    async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
        this.diagnosticsCollection.clear();

        const virtualDocumentUri = VirtualDocumentProvider.getVirtualURIPath(
            document.uri.fsPath,
        );

        this.virtualDocumentProvider
            .provideTextDocumentContent(virtualDocumentUri)
            .then((contents) => {
                const edit = new vscode.WorkspaceEdit();

                // This is a JS document that LSPs interact with since they cannot interact with Virtual documents.
                const tempUri = vscode.Uri.parse('untitled:embedded-stjs.js');
                edit.replace(
                    tempUri,
                    new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE),
                    contents ?? '',
                );
                vscode.workspace.applyEdit(edit);

                setTimeout(() => {
                    const diagnostics =
                        vscode.languages.getDiagnostics(tempUri);

                    const filteredDiag = diagnostics.filter(
                        (diag) => diag.source !== 'biome',
                    );
                    this.diagnosticsCollection.set(document.uri, filteredDiag);
                }, 500);
            });
    }

    async setupDiagnosticsHandler(
        context: vscode.ExtensionContext,
    ): Promise<void> {
        context.subscriptions.push(this.diagnosticsCollection);

        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    this.updateDiagnostics(editor.document);
                }
            }),
        );

        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument((document) => {
                this.updateDiagnostics(document);
            }),
        );

        context.subscriptions.push(
            vscode.workspace.onDidCloseTextDocument((doc) =>
                this.diagnosticsCollection.delete(doc.uri),
            ),
        );
    }
}
