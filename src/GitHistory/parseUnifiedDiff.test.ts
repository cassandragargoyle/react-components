/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Unit tests for parseUnifiedDiff: line numbering, root commits, deletions, renames,
// binary files, the no-newline marker, plain diffs and lines that look like headers

import { describe, it, expect } from 'vitest';
import { parseUnifiedDiff } from './parseUnifiedDiff';

describe('parseUnifiedDiff', () => {
    it('returns no files for an empty diff', () => {
        expect(parseUnifiedDiff('')).toEqual([]);
        expect(parseUnifiedDiff('\n')).toEqual([]);
    });

    it('numbers context, deleted and added lines from the hunk header', () => {
        const [file] = parseUnifiedDiff(
            [
                'diff --git a/src/a.ts b/src/a.ts',
                'index 1111111..2222222 100644',
                '--- a/src/a.ts',
                '+++ b/src/a.ts',
                '@@ -10,3 +10,4 @@ function f() {',
                ' keep',
                '-old',
                '+new',
                '+added',
                ' tail',
                '',
            ].join('\n')
        );
        expect(file.oldPath).toBe('src/a.ts');
        expect(file.newPath).toBe('src/a.ts');
        expect(file.binary).toBe(false);
        expect(file.hunks).toHaveLength(1);
        expect(file.hunks[0]).toMatchObject({ oldStart: 10, oldLines: 3, newStart: 10, newLines: 4 });
        expect(file.hunks[0].lines).toEqual([
            { kind: 'context', text: 'keep', oldLine: 10, newLine: 10 },
            { kind: 'delete', text: 'old', oldLine: 11 },
            { kind: 'add', text: 'new', newLine: 11 },
            { kind: 'add', text: 'added', newLine: 12 },
            { kind: 'context', text: 'tail', oldLine: 12, newLine: 13 },
        ]);
    });

    it('treats a root commit as an added file', () => {
        const [file] = parseUnifiedDiff(
            [
                'diff --git a/README.md b/README.md',
                'new file mode 100644',
                'index 0000000..3333333',
                '--- /dev/null',
                '+++ b/README.md',
                '@@ -0,0 +1,2 @@',
                '+# Title',
                '+text',
            ].join('\n')
        );
        expect(file.oldPath).toBeNull();
        expect(file.newPath).toBe('README.md');
        expect(file.hunks[0].lines.map((l) => l.newLine)).toEqual([1, 2]);
    });

    it('treats a deletion as a file without a new path', () => {
        const [file] = parseUnifiedDiff(
            ['diff --git a/x.txt b/x.txt', 'deleted file mode 100644', '--- a/x.txt', '+++ /dev/null', '@@ -1 +0,0 @@', '-gone'].join('\n')
        );
        expect(file.oldPath).toBe('x.txt');
        expect(file.newPath).toBeNull();
        expect(file.hunks[0]).toMatchObject({ oldLines: 1, newLines: 0 });
        expect(file.hunks[0].lines).toEqual([{ kind: 'delete', text: 'gone', oldLine: 1 }]);
    });

    it('reads a pure rename, which has no hunks', () => {
        const [file] = parseUnifiedDiff(
            ['diff --git a/old.ts b/new.ts', 'similarity index 100%', 'rename from old.ts', 'rename to new.ts'].join('\n')
        );
        expect(file).toEqual({ oldPath: 'old.ts', newPath: 'new.ts', binary: false, hunks: [] });
    });

    it('marks a binary change', () => {
        const [file] = parseUnifiedDiff(
            ['diff --git a/logo.png b/logo.png', 'index 1..2 100644', 'Binary files a/logo.png and b/logo.png differ'].join('\n')
        );
        expect(file.binary).toBe(true);
        expect(file.hunks).toEqual([]);
    });

    it('keeps the no-newline marker as a meta line', () => {
        const [file] = parseUnifiedDiff(
            ['--- a/f', '+++ b/f', '@@ -1 +1 @@', '-a', '\\ No newline at end of file', '+b', '\\ No newline at end of file'].join('\n')
        );
        expect(file.hunks[0].lines.map((l) => l.kind)).toEqual(['delete', 'meta', 'add', 'meta']);
    });

    it('reads a plain diff -u with timestamps and several files', () => {
        const files = parseUnifiedDiff(
            [
                '--- a.txt\t2026-01-01 10:00:00',
                '+++ a.txt\t2026-01-02 10:00:00',
                '@@ -1 +1 @@',
                '-1',
                '+2',
                '--- b.txt',
                '+++ b.txt',
                '@@ -1 +1 @@',
                '-3',
                '+4',
            ].join('\n')
        );
        expect(files.map((f) => f.newPath)).toEqual(['a.txt', 'b.txt']);
    });

    it('does not mistake removed or added lines that look like headers for headers', () => {
        const [file] = parseUnifiedDiff(
            ['--- a/f', '+++ b/f', '@@ -1,2 +1,2 @@', '--- dashes', '+++ pluses', ' @@ not a hunk', ''].join('\n')
        );
        expect(file.hunks).toHaveLength(1);
        expect(file.hunks[0].lines).toEqual([
            { kind: 'delete', text: '-- dashes', oldLine: 1 },
            { kind: 'add', text: '++ pluses', newLine: 1 },
            { kind: 'context', text: '@@ not a hunk', oldLine: 2, newLine: 2 },
        ]);
    });

    it('skips the commit header that git show prints before the diff', () => {
        const files = parseUnifiedDiff(
            ['commit abc', 'Author: A <a@b>', '', '    subject', '', 'diff --git a/f b/f', '--- a/f', '+++ b/f', '@@ -1 +1 @@', '-x', '+y'].join('\n')
        );
        expect(files).toHaveLength(1);
        expect(files[0].hunks[0].lines).toHaveLength(2);
    });
});
