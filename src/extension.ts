import * as vscode from 'vscode';
import { DiagnosticsProvider } from './DiagnosticsProvider';
import VirtualDocumentProvider, { URI_SCHEME } from './VirtualDocumentProvider';

export function activate(context: vscode.ExtensionContext) {
    const virtualDocumentProvider = new VirtualDocumentProvider();

    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(
            URI_SCHEME,
            virtualDocumentProvider,
        ),
    );

    context.subscriptions.push(
        vscode.languages.registerHoverProvider('typescript', {
            async provideHover(document, position, token) {
                // Prevent infinite loops
                if (document.uri.scheme === URI_SCHEME) {
                    return undefined;
                }

                const virtualDocumentUri =
                    VirtualDocumentProvider.getVirtualURIPath(
                        document.uri.fsPath,
                    );

                const res = await vscode.commands.executeCommand<
                    vscode.Hover[]
                >('vscode.executeHoverProvider', virtualDocumentUri, position);

                return Promise.resolve(res[0]);
            },
        }),
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            'typescript',
            {
                async provideCompletionItems(
                    document,
                    position,
                    token,
                    context,
                ) {
                    // Prevent infinite loops
                    if (document.uri.scheme === URI_SCHEME) {
                        return undefined;
                    }

                    // Force update, since the debounce logic means that this might not have been saved
                    virtualDocumentProvider.forceUpdate(document.uri);

                    // ST keywords
                    const keywords = [
                        'concat',
                        'each',
                        'flatten',
                        'for',
                        'let',
                        'lets',
                        'merge',
                        'optional',
                        'unwrap',
                    ];

                    const virtualDocumentUri =
                        VirtualDocumentProvider.getVirtualURIPath(
                            document.uri.fsPath,
                        );
                    const res =
                        await vscode.commands.executeCommand<vscode.CompletionList>(
                            'vscode.executeCompletionItemProvider',
                            virtualDocumentUri,
                            position,
                        );

                    return res.items;
                },
            },
            '.',
        ),
    );

    DiagnosticsProvider.initialize(context, virtualDocumentProvider);
}

export function deactivate() {}
