/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Maps markdown fence identifiers and file extensions to Monaco language ids
// Falls back to 'plaintext' for anything unrecognized

const FENCE_TO_MONACO: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    python: 'python',
    rb: 'ruby',
    go: 'go',
    golang: 'go',
    rs: 'rust',
    rust: 'rust',
    java: 'java',
    kt: 'kotlin',
    kotlin: 'kotlin',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    hpp: 'cpp',
    'c++': 'cpp',
    cs: 'csharp',
    csharp: 'csharp',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    shell: 'shell',
    ps1: 'powershell',
    powershell: 'powershell',
    sql: 'sql',
    json: 'json',
    jsonc: 'jsonc',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'ini',
    ini: 'ini',
    xml: 'xml',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    markdown: 'markdown',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    make: 'makefile',
    proto: 'proto',
    graphql: 'graphql',
    diff: 'diff',
    patch: 'diff',
    text: 'plaintext',
    txt: 'plaintext',
    plaintext: 'plaintext',
};

const EXTENSION_TO_FENCE: Record<string, string> = {
    '.js': 'js',
    '.jsx': 'jsx',
    '.mjs': 'mjs',
    '.cjs': 'cjs',
    '.ts': 'ts',
    '.tsx': 'tsx',
    '.py': 'py',
    '.rb': 'rb',
    '.go': 'go',
    '.rs': 'rs',
    '.java': 'java',
    '.kt': 'kt',
    '.c': 'c',
    '.h': 'h',
    '.cpp': 'cpp',
    '.cc': 'cc',
    '.hpp': 'hpp',
    '.cs': 'cs',
    '.sh': 'sh',
    '.bash': 'bash',
    '.zsh': 'zsh',
    '.ps1': 'ps1',
    '.sql': 'sql',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yml',
    '.toml': 'toml',
    '.ini': 'ini',
    '.xml': 'xml',
    '.html': 'html',
    '.htm': 'htm',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.md': 'md',
    '.proto': 'proto',
    '.graphql': 'graphql',
    '.gql': 'graphql',
    '.diff': 'diff',
    '.patch': 'patch',
};

/** Resolve a Monaco language id from a markdown fence identifier, file extension, or filename */
export function resolveMonacoLanguage(language?: string, filename?: string): string {
    const fromLanguage = language?.trim().toLowerCase();
    if (fromLanguage) {
        if (fromLanguage in FENCE_TO_MONACO) return FENCE_TO_MONACO[fromLanguage];
        // Already a valid-looking Monaco id (e.g. 'typescript', 'python') — pass through
        return fromLanguage;
    }

    if (filename) {
        const base = filename.split(/[/\\]/).pop() ?? filename;
        if (/^dockerfile$/i.test(base)) return 'dockerfile';
        if (/^makefile$/i.test(base)) return 'makefile';
        const dot = base.lastIndexOf('.');
        if (dot >= 0) {
            const ext = base.slice(dot).toLowerCase();
            const fence = EXTENSION_TO_FENCE[ext];
            if (fence) return FENCE_TO_MONACO[fence] ?? fence;
        }
    }

    return 'plaintext';
}
