/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The unified diff view of GitHistory: parsed files and hunks with old/new line numbers
// Added and removed lines are coloured from the VS Code diff theme variables

import React from 'react';
import type { DiffFile, DiffLine } from './types';

export interface DiffViewProps {
    files: readonly DiffFile[];
    labels: {
        noChanges: string;
        binary: string;
        renamed: string;
        added: string;
        deleted: string;
    };
}

const SIGN: Record<DiffLine['kind'], string> = {
    add: '+',
    delete: '-',
    context: ' ',
    meta: '',
};

function fileTitle(file: DiffFile, labels: DiffViewProps['labels']): string {
    if (file.oldPath === null) return `${file.newPath ?? ''} (${labels.added})`;
    if (file.newPath === null) return `${file.oldPath} (${labels.deleted})`;
    if (file.oldPath !== file.newPath) return `${file.oldPath} → ${file.newPath} (${labels.renamed})`;
    return file.newPath;
}

export function DiffView({ files, labels }: DiffViewProps): React.ReactElement {
    if (files.length === 0) {
        return <div className="git-history-diff-note">{labels.noChanges}</div>;
    }

    return (
        <div className="git-history-diff">
            {files.map((file, fileIndex) => (
                <section className="git-history-diff-file" key={`${file.oldPath}:${file.newPath}:${fileIndex}`}>
                    <div className="git-history-diff-file-title">{fileTitle(file, labels)}</div>
                    {file.binary && <div className="git-history-diff-note">{labels.binary}</div>}
                    {!file.binary && file.hunks.length === 0 && (
                        <div className="git-history-diff-note">{labels.noChanges}</div>
                    )}
                    {file.hunks.length > 0 && (
                        <table className="git-history-diff-table">
                            {file.hunks.map((hunk, hunkIndex) => (
                                <tbody key={hunkIndex}>
                                    <tr className="git-history-diff-hunk">
                                        <td colSpan={3}>{hunk.header}</td>
                                    </tr>
                                    {hunk.lines.map((line, lineIndex) => (
                                        <tr key={lineIndex} className={`git-history-diff-line is-${line.kind}`}>
                                            <td className="git-history-diff-num">{line.oldLine ?? ''}</td>
                                            <td className="git-history-diff-num">{line.newLine ?? ''}</td>
                                            <td className="git-history-diff-code">
                                                <span className="git-history-diff-sign" aria-hidden="true">
                                                    {SIGN[line.kind]}
                                                </span>
                                                {line.text}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            ))}
                        </table>
                    )}
                </section>
            ))}
        </div>
    );
}
