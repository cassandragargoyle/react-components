/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The GitHistory demo at /demo/git-history.html: a generated file history from an in-memory source
// The source answers with a delay, so the loading states and the paging are visible

import React, { useMemo } from 'react';
import { createRoot } from 'react-dom/client';

import { GitHistory, type GitCommit, type GitHistorySource } from '../src';

const DELAY_MS = 300;
const TOTAL = 120;
const AUTHORS = ['Jana Novak', 'Alex Roe', 'Sam Lee'];
const SUBJECTS = ['fix: handle an empty list', 'feat: add paging', 'refactor: split the parser', 'docs: describe the source'];

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Newest first, one commit a day back from today; the oldest one creates the file
const COMMITS: GitCommit[] = Array.from({ length: TOTAL }, (_, i) => {
    const sha = (0x1000000 + (TOTAL - i) * 7919).toString(16).padStart(40, 'a');
    return {
        sha,
        shortSha: sha.slice(-7),
        author: AUTHORS[i % AUTHORS.length],
        date: new Date(Date.now() - i * 24 * 3600 * 1000).toISOString(),
        subject: i === TOTAL - 1 ? 'init' : SUBJECTS[i % SUBJECTS.length],
        path: i > TOTAL - 10 ? 'src/oldName.ts' : undefined,
    };
});

function diffFor(commit: GitCommit): string {
    const index = COMMITS.indexOf(commit);
    const file = commit.path ?? 'src/history.ts';
    if (index === TOTAL - 1) {
        return [`diff --git a/${file} b/${file}`, 'new file mode 100644', '--- /dev/null', `+++ b/${file}`, '@@ -0,0 +1,3 @@', '+export function history() {', '+    return [];', '+}'].join('\n');
    }
    const line = 10 + (index % 20);
    return [
        `diff --git a/${file} b/${file}`,
        `--- a/${file}`,
        `+++ b/${file}`,
        `@@ -${line},4 +${line},5 @@ export function history() {`,
        '     const items = load();',
        `-    const limit = ${index};`,
        `+    const limit = ${index + 1};`,
        '+    // paged',
        '     return items.slice(0, limit);',
        ' }',
    ].join('\n');
}

function Demo(): React.ReactElement {
    const source = useMemo<GitHistorySource>(
        () => ({
            async loadCommits({ skip, limit }) {
                await wait(DELAY_MS);
                return { commits: COMMITS.slice(skip, skip + limit), hasMore: skip + limit < COMMITS.length };
            },
            async loadDiff(commit) {
                await wait(DELAY_MS / 2);
                return diffFor(commit);
            },
        }),
        []
    );

    return (
        <GitHistory
            path="src/history.ts"
            branch="main"
            source={source}
            pageSize={30}
            onCopySha={(commit) => void navigator.clipboard?.writeText(commit.sha)}
        />
    );
}

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Demo />
    </React.StrictMode>
);
