/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Public types of the GitHistory component: the host data source, commits and parsed diffs
// The component renders these shapes only; it never runs git or reads a file itself

/** What the history is of: one file, or everything below a folder */
export type GitHistoryTarget = 'file' | 'folder';

/** Kind of a ref label; `head` is the checked-out branch */
export type GitRefKind = 'head' | 'branch' | 'remote' | 'tag';

/** A branch, remote branch or tag pointing at a commit */
export interface GitRef {
    /** Short name, e.g. 'main', 'origin/main', 'v1.0.0' */
    name: string;
    kind: GitRefKind;
}

/** Build or check status of a commit, shown as a dot */
export type GitCommitStatus = 'success' | 'failure' | 'pending' | 'unknown';

/** One commit that touched the file. Every field after `path` is optional and turns on
 *  the matching part of the rich view (graph, labels, author column, details) */
export interface GitCommit {
    /** Full SHA; the row key */
    sha: string;
    shortSha: string;
    author: string;
    /** ISO 8601 date */
    date: string;
    subject: string;
    /** The file path at this commit, when it differs from the current one (renames with follow) */
    path?: string;
    /** Full SHAs of the parents, after history simplification for the path; drives the graph */
    parents?: string[];
    authorEmail?: string;
    committer?: string;
    /** Commit date, ISO 8601; `date` stays the author date */
    commitDate?: string;
    /** The message without the subject line */
    body?: string;
    refs?: GitRef[];
    status?: GitCommitStatus;
}

/** Slow facts about one commit, loaded when it is selected */
export interface GitCommitDetails {
    /** Branches (local and remote) that contain the commit */
    branches: string[];
    /** Tags that contain the commit */
    tags: string[];
    /** Nearest earlier tag and the number of commits since it */
    describe?: { tag: string; distance: number };
}

/** Status of a file in a commit */
export type GitFileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';

/** One file changed by a commit */
export interface GitChangedFile {
    /** Path after the change, repository-relative */
    path: string;
    /** Path before a rename or copy */
    oldPath?: string;
    status: GitFileStatus;
    additions?: number;
    deletions?: number;
    /** Line count of the file after the commit (0 when deleted); turns on the change weight */
    lines?: number;
}

/** A link shown under the commit message, e.g. "View on GitHub" or "Issue 42" */
export interface GitLink {
    label: string;
    url: string;
}

/** An action offered for a commit row (⋯ button and context menu) */
export interface GitCommitAction {
    id: string;
    label: string;
    run: () => void;
}

/** One page of the commit list, newest first */
export interface GitHistoryPage {
    commits: GitCommit[];
    /** false when the list is complete */
    hasMore: boolean;
}

/** Options of one commit-list request */
export interface GitHistoryQuery {
    /** Follow the file across renames (`git log --follow`) */
    follow: boolean;
    /** Number of commits already loaded */
    skip: number;
    /** Page size */
    limit: number;
}

/**
 * Supplied by the host. A rejected promise is shown in the error state with the
 * error's message, so the host should reject with a readable `Error`
 */
export interface GitHistorySource {
    loadCommits(query: GitHistoryQuery): Promise<GitHistoryPage>;
    /** Unified-diff text of one commit against its first parent: for the history's file, or
     *  for `path` (a repository-relative path picked in the Files tab) */
    loadDiff(commit: GitCommit, path?: string): Promise<string>;
    /** Branches and tags containing the commit, and its nearest tag; optional and slow */
    loadCommitDetails?(commit: GitCommit): Promise<GitCommitDetails>;
    /** Every file the commit changed; turns on the Files tab */
    loadCommitFiles?(commit: GitCommit): Promise<GitChangedFile[]>;
    /** Find a commit of this history by full or abbreviated SHA, for the filter */
    findCommit?(sha: string): Promise<GitCommit | null>;
}

/** Kind of one diff line */
export type DiffLineKind = 'context' | 'add' | 'delete' | 'meta';

/** One line of a hunk; `meta` is the `\ No newline at end of file` marker */
export interface DiffLine {
    kind: DiffLineKind;
    /** Line text without the leading +, - or space */
    text: string;
    /** Line number in the old file (context and delete lines) */
    oldLine?: number;
    /** Line number in the new file (context and add lines) */
    newLine?: number;
}

/** One `@@ -a,b +c,d @@` hunk */
export interface DiffHunk {
    /** The full hunk header line */
    header: string;
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: DiffLine[];
}

/** The change of one file in a unified diff */
export interface DiffFile {
    /** Path before the change; null for an added file */
    oldPath: string | null;
    /** Path after the change; null for a deleted file */
    newPath: string | null;
    /** true for a binary change, which carries no hunks */
    binary: boolean;
    hunks: DiffHunk[];
}
