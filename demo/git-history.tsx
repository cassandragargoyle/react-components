/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The GitHistory demo at /demo/git-history.html: a generated history with branches, merges and refs
// The in-memory source answers with a delay, so loading states and paging are visible;
// ?folder shows a folder history, ?simple only the phase 1 fields, ?narrow fixed narrow columns

import React, { useMemo } from 'react';
import { createRoot } from 'react-dom/client';

import { GitHistory, type GitChangedFile, type GitCommit, type GitHistorySource } from '../src';

const query = new URLSearchParams(window.location.search);
const FOLDER = query.has('folder');
const SIMPLE = query.has('simple');

const DELAY_MS = 300;
const TOTAL = 160;
const AUTHORS = [
    { name: 'Jana Novak', email: 'jana.novak@example.com' },
    { name: 'Alex Roe', email: 'alex.roe@example.com' },
    { name: 'Sam Lee', email: 'sam.lee@example.com' },
];
const SUBJECTS = ['fix: handle an empty list', 'feat: add paging', 'refactor: split the parser', 'docs: describe the source'];
const STATUSES = ['success', 'success', 'failure', 'pending', 'unknown'] as const;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const shaOf = (n: number): string => (0x1000000 + n * 7919).toString(16).padStart(40, 'a');

// Newest first. Every tenth commit merges a short feature branch of two commits, which
// forks from the commit below the merge; the oldest commit creates the file
function buildHistory(): GitCommit[] {
    const commits: GitCommit[] = [];
    const now = Date.now();
    let n = TOTAL;
    let i = 0;
    while (n > 0) {
        const author = AUTHORS[i % AUTHORS.length];
        const date = new Date(now - i * 9 * 3600 * 1000).toISOString();
        const base: GitCommit = {
            sha: shaOf(n),
            shortSha: shaOf(n).slice(-8),
            author: author.name,
            authorEmail: author.email,
            date,
            commitDate: date,
            subject: n === 1 ? 'init' : SUBJECTS[i % SUBJECTS.length],
            body: n % 7 === 0 ? `Longer explanation of the change.\n\nPartly fixes #${100 + n}` : undefined,
            parents: n > 1 ? [shaOf(n - 1)] : [],
            status: STATUSES[i % STATUSES.length],
        };
        if (i === 0) base.refs = [{ name: 'main', kind: 'head' }, { name: 'origin/main', kind: 'remote' }];
        if (n === 120) base.refs = [{ name: 'v1.0.0', kind: 'tag' }];
        if (n % 10 === 0 && n > 3) {
            // A merge of feature commits f2 -> f1 that fork from n - 1
            const f1 = `f${n}1`.padEnd(40, 'b');
            const f2 = `f${n}2`.padEnd(40, 'b');
            commits.push({ ...base, subject: `Merge branch 'feature/${n}'`, parents: [shaOf(n - 1), f2] });
            commits.push({ ...base, sha: f2, shortSha: f2.slice(0, 8), subject: `feat: second step of ${n}`, parents: [f1], refs: n === TOTAL ? [{ name: 'origin/feature/160', kind: 'remote' }] : undefined });
            commits.push({ ...base, sha: f1, shortSha: f1.slice(0, 8), subject: `feat: first step of ${n}`, parents: [shaOf(n - 1)], refs: undefined });
        } else {
            commits.push(base);
        }
        n--;
        i++;
    }
    if (!SIMPLE) return commits;
    return commits.map(({ sha, shortSha, author, date, subject }) => ({ sha, shortSha, author, date, subject }));
}

const COMMITS = buildHistory();

function filesOf(commit: GitCommit): GitChangedFile[] {
    const index = COMMITS.indexOf(commit);
    return [
        { path: 'src/history.ts', status: index === COMMITS.length - 1 ? 'added' : 'modified', additions: 2, deletions: 1, lines: 40 },
        { path: 'src/history.test.ts', status: 'modified', additions: 5, deletions: 0, lines: 12 },
        { path: 'src/table.ts', status: 'modified', additions: 10, deletions: 2, lines: 10_000 },
        { path: 'docs/history.md', status: 'modified', additions: 30, deletions: 28, lines: 60 },
        { path: 'docs/old.md', oldPath: 'docs/older.md', status: 'renamed', additions: 0, deletions: 0, lines: 5 },
        { path: 'assets/logo.png', status: 'modified' },
    ];
}

function diffFor(commit: GitCommit, file = 'src/history.ts'): string {
    const index = COMMITS.indexOf(commit);
    if (index === COMMITS.length - 1 && file === 'src/history.ts') {
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
            async loadDiff(commit, path) {
                await wait(DELAY_MS / 2);
                return diffFor(commit, path);
            },
            ...(SIMPLE
                ? {}
                : {
                      async loadCommitDetails(commit: GitCommit) {
                          await wait(DELAY_MS * 3);
                          const index = COMMITS.indexOf(commit);
                          return {
                              branches: index < 20 ? ['main', 'origin/main'] : ['main', 'origin/main', 'release/1.x'],
                              tags: index > 60 ? ['v1.0.0'] : [],
                              describe: index > 60 ? undefined : { tag: 'v1.0.0', distance: 60 - index },
                          };
                      },
                      async loadCommitFiles(commit: GitCommit) {
                          await wait(DELAY_MS / 2);
                          return filesOf(commit);
                      },
                      async findCommit(sha: string) {
                          await wait(DELAY_MS);
                          return COMMITS.find((c) => c.sha.startsWith(sha)) ?? null;
                      },
                  }),
        }),
        []
    );

    return (
        <GitHistory
            path={FOLDER ? 'src' : 'src/history.ts'}
            target={FOLDER ? 'folder' : 'file'}
            branch="main"
            source={source}
            pageSize={40}
            onCopySha={(commit) => void navigator.clipboard?.writeText(commit.sha)}
            linkify={(commit) => {
                const issue = /#(\d+)/.exec(commit.body ?? '');
                return [
                    { label: 'View on GitHub', url: `https://github.com/example/repo/commit/${commit.sha}` },
                    ...(issue ? [{ label: `Issue ${issue[1]}`, url: `https://github.com/example/repo/issues/${issue[1]}` }] : []),
                ];
            }}
            commitActions={(commit) => [
                { id: 'copy-sha', label: 'Copy SHA', run: () => void navigator.clipboard?.writeText(commit.sha) },
                { id: 'copy-subject', label: 'Copy subject', run: () => void navigator.clipboard?.writeText(commit.subject) },
            ]}
            onLayoutChange={(layout) => console.info('[demo] layout', layout)}
            initialColumnWidths={query.has('narrow') ? { message: 260, author: 120 } : undefined}
            onColumnWidthsChange={(widths) => console.info('[demo] column widths', widths)}
        />
    );
}

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Demo />
    </React.StrictMode>
);
