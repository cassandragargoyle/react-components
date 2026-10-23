/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The detail panel of GitHistory: Commit, Diff and Files tabs for the selected commit
// Each tab loads its own data from the source and ignores answers for an earlier commit

import React, { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../Avatar';
import { authorKey } from './CommitList';
import { DiffView, type DiffViewMode } from './DiffView';
import { parseUnifiedDiff } from './parseUnifiedDiff';
import type {
    GitChangedFile,
    GitCommit,
    GitCommitDetails,
    GitHistorySource,
    GitHistoryTarget,
    GitLink,
} from './types';

/** A tab of the detail panel */
export type GitHistoryTab = 'commit' | 'diff' | 'files';

export interface DetailPanelLabels {
    tabCommit: string;
    tabDiff: string;
    tabFiles: string;
    unified: string;
    split: string;
    author: string;
    authorDate: string;
    committer: string;
    commitDate: string;
    commitHash: string;
    parent: string;
    parents: string;
    copySha: string;
    relatedLinks: string;
    containedInBranches: string;
    containedInTags: string;
    containedInNone: string;
    derivesFromTag: string;
    commitsSince: string;
    loadingDetails: string;
    loadingDiff: string;
    loadingFiles: string;
    errorDiff: string;
    errorFiles: string;
    errorDetails: string;
    showAllFiles: string;
    noFilesInFolder: string;
    files: string;
    noChanges: string;
    binary: string;
    renamed: string;
    added: string;
    deleted: string;
    selectCommit: string;
    fileStatus: Record<GitChangedFile['status'], string>;
}

export interface DetailPanelProps {
    commit: GitCommit | null;
    target: GitHistoryTarget;
    /** Repository-relative path of the history's file or folder */
    path: string;
    source: GitHistorySource;
    tab: GitHistoryTab;
    onTabChange: (tab: GitHistoryTab) => void;
    diffMode: DiffViewMode;
    onDiffModeChange: (mode: DiffViewMode) => void;
    formatDate: (iso: string) => string;
    formatFullDate: (iso: string) => string;
    resolveAvatarUrl?: (email: string, commit: GitCommit) => string | undefined;
    linkify?: (commit: GitCommit) => GitLink[];
    onOpenLink?: (url: string) => void;
    onCopySha?: (commit: GitCommit) => void;
    /** A click on a parent SHA */
    onSelectSha: (sha: string) => void;
    labels: DetailPanelLabels;
}

type Async<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; value: T };

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return typeof err === 'string' ? err : String(err);
}

// Runs `load` whenever its key changes and drops answers that arrive for an older key
function useAsync<T>(load: (() => Promise<T>) | null, key: string): Async<T> | null {
    const [state, setState] = useState<Async<T> | null>(null);
    useEffect(() => {
        if (!load) {
            setState(null);
            return undefined;
        }
        let cancelled = false;
        setState({ status: 'loading' });
        load().then(
            (value) => !cancelled && setState({ status: 'ready', value }),
            (err: unknown) => !cancelled && setState({ status: 'error', error: errorMessage(err) })
        );
        return () => {
            cancelled = true;
        };
        // The key stands for everything `load` closes over
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    return state;
}

const FILE_STATUS_LETTER: Record<GitChangedFile['status'], string> = {
    added: 'A',
    modified: 'M',
    deleted: 'D',
    renamed: 'R',
    copied: 'C',
};

// A link opened by the host when it handles links, otherwise by the browser
function ExternalLink({
    url,
    children,
    onOpenLink,
}: {
    url: string;
    children: React.ReactNode;
    onOpenLink?: (url: string) => void;
}): React.ReactElement {
    return (
        <a
            className="git-history-link"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
                if (!onOpenLink) return;
                e.preventDefault();
                onOpenLink(url);
            }}
        >
            {children}
        </a>
    );
}

function DiffModeSwitch({
    mode,
    onChange,
    labels,
}: {
    mode: DiffViewMode;
    onChange: (mode: DiffViewMode) => void;
    labels: DetailPanelLabels;
}): React.ReactElement {
    return (
        <span className="git-history-segmented" role="group">
            {(['unified', 'split'] as const).map((m) => (
                <button
                    key={m}
                    type="button"
                    className={`git-history-toggle${mode === m ? ' is-on' : ''}`}
                    aria-pressed={mode === m}
                    onClick={() => onChange(m)}
                >
                    {labels[m]}
                </button>
            ))}
        </span>
    );
}

function DiffBody({
    state,
    mode,
    labels,
}: {
    state: Async<string> | null;
    mode: DiffViewMode;
    labels: DetailPanelLabels;
}): React.ReactElement | null {
    const files = useMemo(() => (state?.status === 'ready' ? parseUnifiedDiff(state.value) : []), [state]);
    if (!state) return null;
    if (state.status === 'loading') return <div className="git-history-diff-note" role="status">{labels.loadingDiff}</div>;
    if (state.status === 'error') {
        return (
            <div className="git-history-diff-error" role="alert">
                <div>{labels.errorDiff}</div>
                <div className="git-history-diff-error-detail">{state.error}</div>
            </div>
        );
    }
    return <DiffView files={files} mode={mode} labels={labels} />;
}

function CommitTab(props: DetailPanelProps & { commit: GitCommit }): React.ReactElement {
    const { commit, source, formatDate, formatFullDate, resolveAvatarUrl, linkify, onOpenLink, onCopySha, onSelectSha, labels } = props;
    const details = useAsync<GitCommitDetails>(
        source.loadCommitDetails ? () => source.loadCommitDetails!(commit) : null,
        commit.sha
    );
    const links = linkify?.(commit) ?? [];
    const dateLine = (iso: string): string => `${formatDate(iso)} (${formatFullDate(iso)})`;
    const parents = commit.parents ?? [];

    return (
        <div className="git-history-commit-info">
            <div className="git-history-commit-head">
                <Avatar
                    id={authorKey(commit)}
                    displayName={commit.author}
                    kind="user"
                    size={56}
                    interactive={false}
                    ring={false}
                    avatarUrl={commit.authorEmail ? resolveAvatarUrl?.(commit.authorEmail, commit) : undefined}
                />
                <dl className="git-history-fields">
                    <dt>{labels.author}</dt>
                    <dd>
                        {commit.author}
                        {commit.authorEmail && (
                            <>
                                {' '}
                                <ExternalLink url={`mailto:${commit.authorEmail}`} onOpenLink={onOpenLink}>
                                    &lt;{commit.authorEmail}&gt;
                                </ExternalLink>
                            </>
                        )}
                    </dd>
                    <dt>{labels.authorDate}</dt>
                    <dd>{dateLine(commit.date)}</dd>
                    {commit.committer && commit.committer !== commit.author && (
                        <>
                            <dt>{labels.committer}</dt>
                            <dd>{commit.committer}</dd>
                        </>
                    )}
                    {commit.commitDate && (
                        <>
                            <dt>{labels.commitDate}</dt>
                            <dd>{dateLine(commit.commitDate)}</dd>
                        </>
                    )}
                    <dt>{labels.commitHash}</dt>
                    <dd>
                        <span className="git-history-mono">{commit.sha}</span>
                        {onCopySha && (
                            <button type="button" className="git-history-button is-small" onClick={() => onCopySha(commit)}>
                                {labels.copySha}
                            </button>
                        )}
                    </dd>
                    {parents.length > 0 && (
                        <>
                            <dt>{parents.length > 1 ? labels.parents : labels.parent}</dt>
                            <dd>
                                {parents.map((sha) => (
                                    <button
                                        key={sha}
                                        type="button"
                                        className="git-history-link-button git-history-mono"
                                        onClick={() => onSelectSha(sha)}
                                    >
                                        {sha.slice(0, 10)}
                                    </button>
                                ))}
                            </dd>
                        </>
                    )}
                </dl>
            </div>

            <div className="git-history-message">
                <div className="git-history-message-subject">{commit.subject}</div>
                {commit.body && commit.body.trim() && <div className="git-history-message-body">{commit.body.trim()}</div>}
            </div>

            {links.length > 0 && (
                <div className="git-history-commit-line">
                    {labels.relatedLinks}:{' '}
                    {links.map((link, i) => (
                        <React.Fragment key={link.url}>
                            {i > 0 && ', '}
                            <ExternalLink url={link.url} onOpenLink={onOpenLink}>
                                {link.label}
                            </ExternalLink>
                        </React.Fragment>
                    ))}
                </div>
            )}

            {details?.status === 'loading' && (
                <div className="git-history-commit-line is-dim" role="status">{labels.loadingDetails}</div>
            )}
            {details?.status === 'error' && (
                <div className="git-history-commit-line is-error">{labels.errorDetails}: {details.error}</div>
            )}
            {details?.status === 'ready' && (
                <>
                    <div className="git-history-commit-line">
                        {labels.containedInBranches}:{' '}
                        {details.value.branches.length > 0 ? details.value.branches.join(', ') : labels.containedInNone}
                    </div>
                    <div className="git-history-commit-line">
                        {labels.containedInTags}:{' '}
                        {details.value.tags.length > 0 ? details.value.tags.join(', ') : labels.containedInNone}
                    </div>
                    {details.value.describe && (
                        <div className="git-history-commit-line">
                            {labels.derivesFromTag}: <span className="git-history-mono">{details.value.describe.tag}</span>
                            {details.value.describe.distance > 0 &&
                                ` + ${labels.commitsSince.replace('{count}', String(details.value.describe.distance))}`}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function DiffTab(props: DetailPanelProps & { commit: GitCommit }): React.ReactElement {
    const { commit, source, diffMode, onDiffModeChange, labels } = props;
    const diff = useAsync<string>(() => source.loadDiff(commit), commit.sha);
    return (
        <div className="git-history-tab-body">
            <div className="git-history-tab-toolbar">
                <DiffModeSwitch mode={diffMode} onChange={onDiffModeChange} labels={labels} />
            </div>
            <div className="git-history-tab-scroll">
                <DiffBody state={diff} mode={diffMode} labels={labels} />
            </div>
        </div>
    );
}

// Whether a repository-relative path lies below a folder path
function isBelow(file: string, folder: string): boolean {
    const prefix = folder.replace(/\/+$/, '');
    return prefix === '' || file === prefix || file.startsWith(`${prefix}/`);
}

function FilesTab(props: DetailPanelProps & { commit: GitCommit }): React.ReactElement {
    const { commit, source, target, path, diffMode, onDiffModeChange, labels } = props;
    const files = useAsync<GitChangedFile[]>(() => source.loadCommitFiles!(commit), commit.sha);
    const [showAll, setShowAll] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);

    const all = files?.status === 'ready' ? files.value : [];
    const own = target === 'folder' ? all.filter((f) => isBelow(f.path, path) || (f.oldPath && isBelow(f.oldPath, path))) : all;
    const shown = target === 'folder' && !showAll ? own : all;

    // Preselect the history's own file, or the first file shown, whenever the list changes
    const historyFile = commit.path ?? path;
    useEffect(() => {
        if (files?.status !== 'ready') return;
        const preferred = shown.find((f) => f.path === historyFile || f.oldPath === historyFile) ?? shown[0];
        setSelected(preferred ? preferred.path : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [files, showAll]);

    const diff = useAsync<string>(selected ? () => source.loadDiff(commit, selected) : null, `${commit.sha}:${selected ?? ''}`);

    const handleKeyDown = (e: React.KeyboardEvent): void => {
        const index = shown.findIndex((f) => f.path === selected);
        let next = -1;
        if (e.key === 'ArrowDown') next = Math.min(index + 1, shown.length - 1);
        else if (e.key === 'ArrowUp') next = Math.max(index - 1, 0);
        else return;
        e.preventDefault();
        if (shown[next]) setSelected(shown[next].path);
    };

    if (!files || files.status === 'loading') return <div className="git-history-diff-note" role="status">{labels.loadingFiles}</div>;
    if (files.status === 'error') {
        return (
            <div className="git-history-diff-error" role="alert">
                <div>{labels.errorFiles}</div>
                <div className="git-history-diff-error-detail">{files.error}</div>
            </div>
        );
    }

    return (
        <div className="git-history-files">
            <div className="git-history-files-side">
                <div
                    className="git-history-files-list"
                    role="listbox"
                    aria-label={labels.files}
                    tabIndex={0}
                    onKeyDown={handleKeyDown}
                >
                    {shown.length === 0 && <div className="git-history-diff-note">{labels.noFilesInFolder}</div>}
                    {shown.map((file) => (
                        <div
                            key={file.path}
                            role="option"
                            aria-selected={file.path === selected}
                            className={`git-history-file${file.path === selected ? ' is-selected' : ''}`}
                            title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                            onClick={() => setSelected(file.path)}
                        >
                            <span className={`git-history-file-status is-${file.status}`} title={labels.fileStatus[file.status]}>
                                {FILE_STATUS_LETTER[file.status]}
                            </span>
                            <span className="git-history-file-path">{`${file.path}\u200e`}</span>
                            {(file.additions !== undefined || file.deletions !== undefined) && (
                                <span className="git-history-file-counts">
                                    <span className="is-add">+{file.additions ?? 0}</span>{' '}
                                    <span className="is-delete">-{file.deletions ?? 0}</span>
                                </span>
                            )}
                        </div>
                    ))}
                </div>
                {target === 'folder' && own.length < all.length && (
                    <label className="git-history-files-all">
                        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />{' '}
                        {labels.showAllFiles.replace('{count}', String(all.length))}
                    </label>
                )}
            </div>
            <div className="git-history-tab-body">
                <div className="git-history-tab-toolbar">
                    <DiffModeSwitch mode={diffMode} onChange={onDiffModeChange} labels={labels} />
                </div>
                <div className="git-history-tab-scroll">
                    <DiffBody state={diff} mode={diffMode} labels={labels} />
                </div>
            </div>
        </div>
    );
}

/** The tabs a target and a source can show */
export function availableTabs(target: GitHistoryTarget, source: GitHistorySource): GitHistoryTab[] {
    const tabs: GitHistoryTab[] = ['commit'];
    if (target === 'file') tabs.push('diff');
    if (source.loadCommitFiles) tabs.push('files');
    return tabs;
}

export function DetailPanel(props: DetailPanelProps): React.ReactElement {
    const { commit, target, source, tab, onTabChange, labels } = props;
    const tabs = availableTabs(target, source);
    const active = tabs.includes(tab) ? tab : tabs[tabs.length > 1 ? 1 : 0];
    const tabLabel: Record<GitHistoryTab, string> = { commit: labels.tabCommit, diff: labels.tabDiff, files: labels.tabFiles };
    const tabId = (t: GitHistoryTab): string => `git-history-tab-${t}`;

    const handleKeyDown = (e: React.KeyboardEvent): void => {
        const index = tabs.indexOf(active);
        let next = -1;
        if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        else return;
        e.preventDefault();
        onTabChange(tabs[next]);
        (e.currentTarget.querySelector(`#${tabId(tabs[next])}`) as HTMLElement | null)?.focus();
    };

    if (!commit) {
        return (
            <div className="git-history-detail">
                <div className="git-history-diff-note">{labels.selectCommit}</div>
            </div>
        );
    }

    return (
        <div className="git-history-detail">
            <div className="git-history-tabs" role="tablist" onKeyDown={handleKeyDown}>
                {tabs.map((t) => (
                    <button
                        key={t}
                        id={tabId(t)}
                        type="button"
                        role="tab"
                        className={`git-history-tab${t === active ? ' is-active' : ''}`}
                        aria-selected={t === active}
                        aria-controls="git-history-tabpanel"
                        tabIndex={t === active ? 0 : -1}
                        onClick={() => onTabChange(t)}
                    >
                        {tabLabel[t]}
                    </button>
                ))}
            </div>
            <div className="git-history-tabpanel" id="git-history-tabpanel" role="tabpanel" aria-labelledby={tabId(active)}>
                {active === 'commit' && <CommitTab {...props} commit={commit} />}
                {active === 'diff' && <DiffTab {...props} commit={commit} />}
                {active === 'files' && <FilesTab {...props} commit={commit} />}
            </div>
        </div>
    );
}
