/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Public types of the GitHistory component: the host data source, commits and parsed diffs
// The component renders these shapes only; it never runs git or reads a file itself

/** One commit that touched the file */
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
    /** Unified-diff text of one commit for the file, against its first parent */
    loadDiff(commit: GitCommit): Promise<string>;
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
