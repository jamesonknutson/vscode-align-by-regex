'use strict'
import * as vscode from 'vscode'
import { Block } from './block'

export function activate (context: vscode.ExtensionContext) {

    type Argument = (
        | { mode: 'last', value?: string }
        | { mode: 'template', value: string }
        | { mode: 'regex', value: string }
    )

    let lastInput: string

    const getInput = async () => await vscode.window.showInputBox({ prompt: 'Enter regular expression or template name.', value: lastInput })

    const resolveTemplate = (input: string | undefined, templates: Record<string, string> | undefined) => {
        if (input && templates && input in templates && templates[ input ]) {
            return templates[ input ]
        }
        return input
    }

    const resolveInput = async (argument: null | Argument, templates: Record<string, string> | undefined) => {
        if (argument === null) {
            return resolveTemplate(await getInput(), templates)
        }
        const { mode, value } = argument
        if (mode === 'last') {
            return resolveTemplate(value || lastInput || await getInput(), templates)
        } else if (mode === 'regex') {
            return value
        } else if (mode === 'template') {
            return resolveTemplate(value, templates)
        }
    }

    let alignByRegex = vscode.commands.registerTextEditorCommand('align.by.regex', async (
        textEditor: vscode.TextEditor,
        edit: vscode.TextEditorEdit,
        args?: (Argument | Argument[] | undefined)
    ) => {
        let templates = vscode.workspace.getConfiguration().get<Record<string, string>>('align.by.regex.templates')

        const firstArg = !args
            ? null
            : Array.isArray(args)
                ? args.length > 0
                    ? args[ 0 ]
                    : null
                : args

        let input = await resolveInput(firstArg, templates)
        if (input !== undefined && input.length > 0) {
            lastInput = input
            if (templates !== undefined) {
                let template = (templates)[ input ]
                if (template !== undefined) {
                    input = template as string
                }
            }
            let selection: vscode.Selection = textEditor.selection
            if (!selection.isEmpty) {
                let textDocument = textEditor.document

                // Don't select last line, if no character of line is selected.
                let endLine = selection.end.line
                let endPosition = selection.end
                if (endPosition.character === 0) {
                    endLine--
                }

                let range = new vscode.Range(new vscode.Position(selection.start.line, 0), new vscode.Position(endLine, textDocument.lineAt(endLine).range.end.character))
                let text = textDocument.getText(range)
                let block: Block = new Block(text, input, selection.start.line, textDocument.eol).trim().align()
                await textEditor.edit(e => {
                    for (let line of block.lines) {
                        let deleteRange = new vscode.Range(new vscode.Position(line.number, 0), new vscode.Position(line.number, textDocument.lineAt(line.number).range.end.character))
                        let replacement: string = ''
                        for (let part of line.parts) {
                            replacement += part.value
                        }
                        e.replace(deleteRange, replacement)
                    }
                })
            }
        }
    })
    context.subscriptions.push(alignByRegex)
}

// this method is called when your extension is deactivated
export function deactivate () {
}