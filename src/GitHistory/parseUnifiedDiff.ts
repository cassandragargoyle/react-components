/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Parser of unified-diff text (git diff, git show, diff -u) into files, hunks and numbered lines
// Pure and dependency-free, so the diff view needs no optional peer

import type { DiffFile, DiffHunk } from './types';

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const GIT_HEADER = /^diff --git (?:"?a\/)?(.+?)"? (?:"?b\/)?(.+?)"?$/;

// Strips the a/ or b/ prefix and a trailing tab-separated timestamp; /dev/null is no file
function headerPath(raw: string): string | null {
    const value = raw.split('\t')[0].trim().replace(/^"(.*)"$/, '$1');
    if (value === '/dev/null') return null;
    return value.replace(/^[ab]\//, '');
}

function newFile(oldPath: string | null = null, newPath: string | null = null): DiffFile {
    return { oldPath, newPath, binary: false, hunks: [] };
}

/**
 * Parses unified-diff text into its files. Lines outside a file or a hunk that are not
 * recognised headers (commit header, index lines, modes) are skipped
 */
export function parseUnifiedDiff(text: string): DiffFile[] {
    const files: DiffFile[] = [];
    let file: DiffFile | null = null;
    let hunk: DiffHunk | null = null;
    let oldLeft = 0;
    let newLeft = 0;
    let oldNo = 0;
    let newNo = 0;

    const lines = text.replace(/\r\n/g, '\n').split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

    for (const line of lines) {
        // Inside a hunk the line counts, not the first characters, decide where it ends:
        // a deleted line may itself start with "--" or "@@"
        if (hunk && (oldLeft > 0 || newLeft > 0)) {
            const marker = line[0];
            const body = line.slice(1);
            if (marker === '+') {
                hunk.lines.push({ kind: 'add', text: body, newLine: newNo++ });
                newLeft--;
                continue;
            }
            if (marker === '-') {
                hunk.lines.push({ kind: 'delete', text: body, oldLine: oldNo++ });
                oldLeft--;
                continue;
            }
            if (marker === ' ' || line === '') {
                hunk.lines.push({ kind: 'context', text: body, oldLine: oldNo++, newLine: newNo++ });
                oldLeft--;
                newLeft--;
                continue;
            }
            if (marker === '\\') {
                hunk.lines.push({ kind: 'meta', text: line });
                continue;
            }
            // A malformed count: fall through and treat the line as a header
            hunk = null;
        }

        if (line.startsWith('\\') && hunk) {
            hunk.lines.push({ kind: 'meta', text: line });
            continue;
        }

        const git = GIT_HEADER.exec(line);
        if (git) {
            file = newFile(git[1], git[2]);
            files.push(file);
            hunk = null;
            continue;
        }

        if (line.startsWith('--- ')) {
            // A plain diff without a "diff --git" line starts its file here
            if (!file || file.hunks.length > 0) {
                file = newFile();
                files.push(file);
            }
            file.oldPath = headerPath(line.slice(4));
            hunk = null;
            continue;
        }

        if (line.startsWith('+++ ') && file) {
            file.newPath = headerPath(line.slice(4));
            continue;
        }

        if (!file) continue;

        if (line.startsWith('new file mode')) {
            file.oldPath = null;
        } else if (line.startsWith('deleted file mode')) {
            file.newPath = null;
        } else if (line.startsWith('rename from ')) {
            file.oldPath = line.slice('rename from '.length);
        } else if (line.startsWith('rename to ')) {
            file.newPath = line.slice('rename to '.length);
        } else if (line.startsWith('Binary files ') || line === 'GIT binary patch') {
            file.binary = true;
        } else {
            const header = HUNK_HEADER.exec(line);
            if (header) {
                const oldStart = Number(header[1]);
                const oldLines = header[2] === undefined ? 1 : Number(header[2]);
                const newStart = Number(header[3]);
                const newLines = header[4] === undefined ? 1 : Number(header[4]);
                hunk = { header: line, oldStart, oldLines, newStart, newLines, lines: [] };
                file.hunks.push(hunk);
                oldLeft = oldLines;
                newLeft = newLines;
                oldNo = oldStart;
                newNo = newStart;
            }
        }
    }

    return files;
}
