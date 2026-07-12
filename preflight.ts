/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Startup capability check for the Monaco-backed CodeEditor
// Runs once when the app boots (see App.tsx) so Monaco's availability — and the
// reason for any failure — is known and logged before any code block ever renders

import { loadMonacoBundle, workerBaseUrl } from './bundleLoader';
import { diagnosticLog } from './diagnosticLog';

export type PreflightFailureReason = 'no-worker-support' | 'bundle-load-failed' | 'create-failed';

export interface PreflightResult {
    ok: boolean;
    reason?: PreflightFailureReason;
    detail?: string;
}

function errorDetail(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/** Check whether Monaco can load and initialize on this platform, logging the outcome */
export async function runPreflightCheck(): Promise<PreflightResult> {
    diagnosticLog('info', 'preflight: starting Monaco capability check');

    if (typeof Worker === 'undefined') {
        const result: PreflightResult = {
            ok: false,
            reason: 'no-worker-support',
            detail: 'window.Worker is unavailable on this platform',
        };
        diagnosticLog('error', 'preflight: failed', result.detail);
        return result;
    }

    try {
        await loadMonacoBundle();
        diagnosticLog('info', 'preflight: code-editor.js loaded');
    } catch (err) {
        const result: PreflightResult = { ok: false, reason: 'bundle-load-failed', detail: errorDetail(err) };
        diagnosticLog('error', 'preflight: failed to load code-editor.js', result.detail);
        return result;
    }

    // Real capability check: mount a throwaway, detached, invisible editor and
    // dispose it immediately — this exercises monaco.editor.create() end to end
    // without ever showing anything to the user
    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.top = '-10000px';
    probe.style.width = '10px';
    probe.style.height = '10px';
    document.body.appendChild(probe);

    try {
        const handle = window.__portunixCodeEditor!.mount(probe, {
            value: '',
            language: 'plaintext',
            readOnly: true,
            lineNumbers: false,
            minimap: false,
            workerBaseUrl: workerBaseUrl(),
        });
        handle.dispose();
        diagnosticLog('info', 'preflight: ok — Monaco is usable on this platform');
        return { ok: true };
    } catch (err) {
        const result: PreflightResult = { ok: false, reason: 'create-failed', detail: errorDetail(err) };
        diagnosticLog('error', 'preflight: monaco.editor.create() failed', result.detail);
        return result;
    } finally {
        probe.remove();
    }
}
