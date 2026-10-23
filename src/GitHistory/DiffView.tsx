/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The diff view of GitHistory: parsed files and hunks, unified or side by side, with line numbers
// Added and removed lines are coloured from the VS Code diff theme variables

import React from 'react';
import type { DiffFile, DiffHunk, DiffLine } from './types';

/** Unified (one column) or split (old and new side by side) */
export type DiffViewMode = 'unified' | 'split';

export interface DiffViewProps {
    files: readonly DiffFile[];
    mode?: DiffViewMode;
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

/** One row of the split view; a side is null where the other side has no counterpart */
interface SplitRow {
    left: DiffLine | null;
    right: DiffLine | null;
}

// Pairs a hunk's lines for the split view: context on both sides, a run of deletions
// against the run of additions that follows it, line by line
export function splitHunk(hunk: DiffHunk): SplitRow[] {
    const rows: SplitRow[] = [];
    let deletes: DiffLine[] = [];
    let adds: DiffLine[] = [];
    const flush = (): void => {
        const n = Math.max(deletes.length, adds.length);
        for (let i = 0; i < n; i++) rows.push({ left: deletes[i] ?? null, right: adds[i] ?? null });
        deletes = [];
        adds = [];
    };
    for (const line of hunk.lines) {
        if (line.kind === 'delete') {
            if (adds.length > 0) flush();
            deletes.push(line);
        } else if (line.kind === 'add') {
            adds.push(line);
        } else {
            flush();
            // Context and the no-newline marker belong to both sides
            rows.push({ left: line, right: line });
        }
    }
    flush();
    return rows;
}

function SplitSide({ line, side }: { line: DiffLine | null; side: 'old' | 'new' }): React.ReactElement {
    if (!line) {
        return (
            <>
                <td className="git-history-diff-num" />
                <td className="git-history-diff-code is-empty" />
            </>
        );
    }
    const number = side === 'old' ? line.oldLine : line.newLine;
    return (
        <>
            <td className={`git-history-diff-num is-${line.kind}`}>{number ?? ''}</td>
            <td className={`git-history-diff-code is-${line.kind}`}>
                <span className="git-history-diff-sign" aria-hidden="true">
                    {SIGN[line.kind]}
                </span>
                {line.text}
            </td>
        </>
    );
}

function fileTitle(file: DiffFile, labels: DiffViewProps['labels']): string {
    if (file.oldPath === null) return `${file.newPath ?? ''} (${labels.added})`;
    if (file.newPath === null) return `${file.oldPath} (${labels.deleted})`;
    if (file.oldPath !== file.newPath) return `${file.oldPath} → ${file.newPath} (${labels.renamed})`;
    return file.newPath;
}

export function DiffView({ files, mode = 'unified', labels }: DiffViewProps): React.ReactElement {
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
                    {file.hunks.length > 0 && mode === 'split' && (
                        <table className="git-history-diff-table is-split">
                            {file.hunks.map((hunk, hunkIndex) => (
                                <tbody key={hunkIndex}>
                                    <tr className="git-history-diff-hunk">
                                        <td colSpan={4}>{hunk.header}</td>
                                    </tr>
                                    {splitHunk(hunk).map((row, rowIndex) => (
                                        <tr key={rowIndex} className="git-history-diff-line">
                                            <SplitSide line={row.left} side="old" />
                                            <SplitSide line={row.right} side="new" />
                                        </tr>
                                    ))}
                                </tbody>
                            ))}
                        </table>
                    )}
                    {file.hunks.length > 0 && mode === 'unified' && (
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
