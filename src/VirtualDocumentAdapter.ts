import * as vscode from 'vscode';

/* 
Creates a virtual document containing only JS. All TS has been replaced with 
*/
export function createVirtualDocument(source: vscode.TextDocument) {
    const virtualDocumentUri = vscode.Uri.parse('untitled:test_document.js');
    const content = getJsDocument(source);

    return { virtualDocumentUri, content };
}

function getJsDocument(document: vscode.TextDocument): string {
    let lastRange: vscode.Range | undefined;
    let currentLine = 0;
    let parsedJavascript = '';

    while (currentLine < document.lineCount) {
        const line = document.lineAt(currentLine);
        const lineText = line.text;

        // I let GPT cook, but its matching {{ }} inside strings
        // For strings that are JSON like this '{ "bar": "{{bar}}" }' it will only match "{{bar}}"
        const matchIterator = lineText.matchAll(
            /(["'])(?:\\.|(?!\1).)*?\{\{.*?\}\}(?:\\.|(?!\1).)*?\1/g,
        );

        for (const match of matchIterator) {
            const range = new vscode.Range(
                currentLine,
                match.index,
                currentLine,
                match[0].length + match.index,
            );
            const prevLineEnd = lastRange?.end.line ?? 0;

            // Fill with new lines
            parsedJavascript += '\n'.repeat(currentLine - prevLineEnd);

            const prevStartIndex =
                lastRange?.end.line === currentLine
                    ? lastRange.end.character
                    : 0;
            parsedJavascript += ' '.repeat(match.index - prevStartIndex);

            // Replace Select transform words such as #if, #merge
            let out = match[0]
                .substring(1, match[0].length - 1)
                .replace(/#(\w+|\?)/g, (stKeyword) =>
                    ' '.repeat(stKeyword.length),
                );

            // This matches only if out only contains a single set of {{ and }}
            const fullRegexp = /^\{\{((?!\}\}).)*\}\}$/;
            if (fullRegexp.test(out)) {
                // If is only one,
                out = out.replace('{{', '  {');
                out = out.replace('}}', '}  ');
            } else {
                const captureAll = /\{\{(.*?)\}\}/g;
                const allMatches = out.matchAll(captureAll);

                let lastStopIndex = 0;
                for (const innerMatch of allMatches) {
                    const newStopIndex =
                        innerMatch.index + innerMatch[0].length - 1;
                    out =
                        out.substring(0, lastStopIndex) +
                        ' '.repeat(innerMatch.index - lastStopIndex) +
                        out.substring(innerMatch.index);

                    lastStopIndex = newStopIndex;

                    let cleanMatch = innerMatch[0].replace('{{', ' {');
                    cleanMatch = cleanMatch.replace('}}', '} ');
                    out = out.replace(innerMatch[0], cleanMatch);
                }

                out =
                    out.substring(0, lastStopIndex) +
                    ' '.repeat(out.length - lastStopIndex);
            }

            parsedJavascript += out;

            lastRange = range;
        }

        currentLine++;
    }

    return parsedJavascript;
}
