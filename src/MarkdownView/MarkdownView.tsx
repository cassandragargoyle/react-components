/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Markdown view: renders a GitHub-flavoured Markdown string as a read-only document
// Host-neutral — links and image URLs go out through props, raw HTML is never rendered

import React, { useCallback, useMemo, useRef } from 'react';
import Markdown, { defaultUrlTransform, type Components, type UrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import markdownViewStyles from './MarkdownView.css';

// Inject styles once when bundled with the 'text' loader (single-file bundle).
// Under the 'css' loader the import resolves to a non-string and a sibling
// stylesheet is emitted instead, so this injection is skipped.
if (
    typeof document !== 'undefined' &&
    typeof markdownViewStyles === 'string' &&
    markdownViewStyles &&
    !document.getElementById('markdown-view-styles')
) {
    const styleEl = document.createElement('style');
    styleEl.id = 'markdown-view-styles';
    styleEl.textContent = markdownViewStyles;
    document.head.appendChild(styleEl);
}

export interface MarkdownViewProps {
    /** The Markdown text to render (GitHub-flavoured: tables, task lists, strikethrough, autolinks) */
    source: string;
    /**
     * Called when a link other than an in-document `#anchor` is clicked. The view never
     * navigates by itself, so a link without this handler does nothing
     */
    onLinkClick?: (href: string) => void;
    /**
     * Extra URL schemes a link `href` may keep, without the colon (for example `['file']`).
     * By default only http, https, irc, ircs, mailto and xmpp are kept; any other target
     * becomes an empty href, so the click never reaches `onLinkClick`. Image sources are
     * not affected
     */
    linkSchemes?: readonly string[];
    /** Map an image `src` as written in the document to a URL the host can load */
    resolveImage?: (src: string) => string;
    /**
     * Render a fenced code block. Return undefined to keep the default `<pre>`;
     * `language` is the info string of the fence, when there is one
     */
    renderCode?: (code: string, language: string | undefined) => React.ReactNode | undefined;
    /** Extra class on the scroll container */
    className?: string;
}

// Minimal hast shapes the plugin and the code block walk; react-markdown passes these nodes
interface HastNode {
    type: string;
    tagName?: string;
    value?: string;
    properties?: Record<string, unknown>;
    children?: HastNode[];
}

const HEADING = /^h[1-6]$/;

/** Concatenated text of a hast subtree */
function textOf(node: HastNode): string {
    if (node.type === 'text') return node.value ?? '';
    return (node.children ?? []).map(textOf).join('');
}

/**
 * GitHub-style heading slug: lower case, punctuation dropped, spaces to dashes. Letters
 * and digits of every script are kept, so a Czech heading keeps its diacritics
 */
export function slugify(text: string): string {
    return text
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .replace(/\s/g, '-');
}

/**
 * The heading an anchor names, inside `root`: the exact id, else the id in lower case. Heading
 * ids are lower case slugs, and GitHub also takes `#Install` for `install`. The id is decoded
 * already; a host that scrolls to an anchor of a link from another document uses the same rule
 */
export function findHeading(root: ParentNode, id: string): Element | null {
    const find = (value: string) => root.querySelector(`[id="${CSS.escape(value)}"]`);
    return find(id) ?? find(id.toLowerCase());
}

/** The id of an `#anchor` href; a malformed `%` code stays as written instead of throwing */
function anchorId(href: string): string {
    const raw = href.slice(1);
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

// Rehype plugin: gives every heading a GitHub-style id, so `#anchor` links resolve.
// A repeated slug gets `-1`, `-2`, … like on GitHub
function rehypeHeadingIds() {
    return (tree: HastNode): void => {
        const seen = new Map<string, number>();
        const visit = (node: HastNode): void => {
            if (node.type === 'element' && node.tagName && HEADING.test(node.tagName)) {
                const base = slugify(textOf(node));
                const count = seen.get(base) ?? 0;
                seen.set(base, count + 1);
                node.properties = { ...node.properties, id: count === 0 ? base : `${base}-${count}` };
            }
            node.children?.forEach(visit);
        };
        visit(tree);
    };
}

/** The language of a `<code>` element, from its `language-xxx` class */
function codeLanguage(code: HastNode): string | undefined {
    const className = code.properties?.className;
    const classes = Array.isArray(className) ? className : [];
    const match = classes.map(String).find((name) => name.startsWith('language-'));
    return match ? match.slice('language-'.length) : undefined;
}

/**
 * The URL rule of react-markdown, plus the extra schemes of the host for link targets.
 * javascript:, vbscript: and data: stay dropped even when the host lists them
 */
const UNSAFE_SCHEMES = new Set(['javascript', 'vbscript', 'data']);
function linkUrlTransform(schemes: readonly string[]): UrlTransform {
    const allowed = new Set(schemes.map((scheme) => scheme.toLowerCase()).filter((scheme) => !UNSAFE_SCHEMES.has(scheme)));
    return (url, key) => {
        const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1].toLowerCase();
        if (key === 'href' && scheme !== undefined && allowed.has(scheme)) return url;
        return defaultUrlTransform(url);
    };
}

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeHeadingIds];

/**
 * MarkdownView renders a Markdown string as a document that follows the VS Code theme.
 * It reads no file and calls no host API: the host passes the text in and decides what a
 * link or an image path means. Embedded HTML is skipped, so the view needs no sanitizer
 */
export function MarkdownView({ source, onLinkClick, linkSchemes, resolveImage, renderCode, className }: MarkdownViewProps): React.ReactElement {
    const rootRef = useRef<HTMLDivElement>(null);
    const schemesKey = (linkSchemes ?? []).join(',');
    const urlTransform = useMemo(() => linkUrlTransform(schemesKey ? schemesKey.split(',') : []), [schemesKey]);

    // One handler for every link: an `#anchor` scrolls within the view, anything else goes
    // to the host. The default is always prevented, so the host window never navigates
    const handleClick = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            const anchor = (event.target as HTMLElement).closest('a');
            if (!anchor || !rootRef.current?.contains(anchor)) return;
            const href = anchor.getAttribute('href');
            if (href === null) return;
            event.preventDefault();
            if (href.startsWith('#')) {
                findHeading(rootRef.current, anchorId(href))?.scrollIntoView({ block: 'start' });
                return;
            }
            if (href) onLinkClick?.(href);
        },
        [onLinkClick]
    );

    const components: Components = {
        img: ({ src, alt, title }) => (
            <img
                src={typeof src === 'string' && resolveImage ? resolveImage(src) : src}
                alt={alt ?? ''}
                title={title}
                loading="lazy"
            />
        ),
        pre: ({ node, children }) => {
            const code = (node as unknown as HastNode | undefined)?.children?.find((child) => child.tagName === 'code');
            if (code && renderCode) {
                const rendered = renderCode(textOf(code).replace(/\n$/, ''), codeLanguage(code));
                if (rendered !== undefined) return <>{rendered}</>;
            }
            return <pre>{children}</pre>;
        },
    };

    return (
        <div ref={rootRef} className={`markdown-view${className ? ` ${className}` : ''}`} onClick={handleClick}>
            <div className="markdown-view-body">
                <Markdown
                    remarkPlugins={REMARK_PLUGINS}
                    rehypePlugins={REHYPE_PLUGINS}
                    components={components}
                    urlTransform={urlTransform}
                    skipHtml
                >
                    {source}
                </Markdown>
            </div>
        </div>
    );
}
