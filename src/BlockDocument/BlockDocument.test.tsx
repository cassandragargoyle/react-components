/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Component tests for BlockDocument (INT-001) over the family house sample
// Read-only rendering, then each edit through the menu, the keyboard and drag and drop

import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { BlockDocument } from './BlockDocument';
import { findBlock, flattenBlocks } from './operations';
import { placeCaret } from './richTextDom';
import sampleJson from './samples/family-house.blockdocument.json';
import type { BlockDocumentData, DocumentBlock } from './types';

const sample = sampleJson as BlockDocumentData;

function small(): BlockDocumentData {
    return {
        schemaVersion: 1,
        id: 'd',
        title: 'Small',
        blocks: [
            { id: 'a', type: 'paragraph', text: [{ text: 'Alpha' }] },
            {
                id: 'c1',
                type: 'chapter',
                title: [{ text: 'Chapter one' }],
                children: [{ id: 'c1a', type: 'paragraph', text: [{ text: 'Inside' }] }],
            },
            { id: 'b', type: 'paragraph', text: [{ text: 'Beta' }] },
            { id: 'x', type: 'table', rows: [['kept']] } as DocumentBlock,
        ],
    };
}

// A host that owns the document, as an application would
function edit(initial: BlockDocumentData, props: Partial<React.ComponentProps<typeof BlockDocument>> = {}) {
    const onChange = vi.fn();
    let counter = 0;
    function Host(): React.ReactElement {
        const [doc, setDoc] = useState(initial);
        return (
            <BlockDocument
                document={doc}
                createBlockId={() => `new-${++counter}`}
                onChange={(next) => {
                    onChange(next);
                    setDoc(next);
                }}
                {...props}
            />
        );
    }
    const view = render(<Host />);
    const last = (): BlockDocumentData => onChange.mock.lastCall![0];
    const block = (id: string): HTMLElement => view.container.querySelector(`[data-block-id="${id}"]`)!;
    const order = (): string[] => flattenBlocks(last().blocks).map((found) => found.block.id);
    return { ...view, onChange, last, block, order };
}

function openMenu(blockEl: HTMLElement): HTMLElement {
    fireEvent.click(within(blockEl).getAllByRole('button', { name: /^Actions for/ })[0]);
    return screen.getByRole('menu');
}

function dataTransfer(): DataTransfer {
    const data = new Map<string, string>();
    return {
        setData: (type: string, value: string) => data.set(type, value),
        getData: (type: string) => data.get(type) ?? '',
        setDragImage: () => undefined,
        effectAllowed: 'all',
        dropEffect: 'none',
    } as unknown as DataTransfer;
}

describe('BlockDocument read-only', () => {
    it('renders the family house as one page', () => {
        render(<BlockDocument document={sample} />);
        expect(screen.getByRole('heading', { level: 1, name: 'Family house Novák' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Floor plans' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 3, name: 'Ground floor' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /Ground floor plan/ })).toHaveAttribute('src', 'plans/ground-floor.svg');
        expect(screen.getByText('Ground floor, 1 : 100')).toBeInTheDocument();
        expect(screen.getByText('three').tagName).toBe('STRONG');
    });

    it('plays the video in place with native controls', () => {
        const { container } = render(<BlockDocument document={sample} />);
        const video = container.querySelector('video')!;
        expect(video).toHaveAttribute('controls');
        expect(video).toHaveAttribute('poster', 'media/walk-through-poster.svg');
        expect(video).toHaveAccessibleName('Walk-through of the house and the technical room');
    });

    it('shows no editing affordance without onChange', () => {
        render(<BlockDocument document={sample} />);
        expect(screen.queryByRole('textbox')).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('stays read-only with readOnly even when onChange is given', () => {
        render(<BlockDocument document={sample} onChange={() => undefined} readOnly />);
        expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('maps media through resolveMediaUrl', () => {
        render(<BlockDocument document={sample} resolveMediaUrl={(src) => `https://cdn.local/${src}`} />);
        expect(screen.getByRole('img', { name: /Ground floor plan/ })).toHaveAttribute(
            'src',
            'https://cdn.local/plans/ground-floor.svg',
        );
    });

    it('renders an unknown block as a placeholder', () => {
        render(<BlockDocument document={small()} />);
        expect(screen.getByRole('note')).toHaveTextContent('Unsupported block: table');
    });

    it('does not render a javascript: link as a link', () => {
        const doc = small();
        doc.blocks = [{ id: 'p', type: 'paragraph', text: [{ text: 'click', href: 'javascript:alert(1)' }] }];
        render(<BlockDocument document={doc} />);
        expect(screen.getByText('click').closest('a')).toBeNull();
    });

    it('says why an invalid document cannot be shown', () => {
        const doc = { ...small(), blocks: [{ id: 'i', type: 'image', src: 'a.png' }] } as unknown as BlockDocumentData;
        render(<BlockDocument document={doc} />);
        expect(screen.getByRole('alert')).toHaveTextContent('blocks[0].alt');
    });
});

describe('BlockDocument editing', () => {
    it('proposes the whole document once per text edit', () => {
        const { block, onChange, last } = edit(small());
        const text = within(block('a')).getByRole('textbox', { name: 'Paragraph' });
        text.textContent = 'Alpha changed';
        fireEvent.input(text);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(findBlock(last(), 'a')!.block).toEqual({ id: 'a', type: 'paragraph', text: [{ text: 'Alpha changed' }] });
        expect(last().blocks).toHaveLength(4);
    });

    it('edits a chapter title and the document title', () => {
        const { block, last } = edit(small());
        const title = within(block('c1')).getAllByRole('textbox', { name: 'Chapter title' })[0];
        title.textContent = 'Renamed';
        fireEvent.input(title);
        expect((findBlock(last(), 'c1')!.block as { title: unknown }).title).toEqual([{ text: 'Renamed' }]);

        const docTitle = screen.getByRole('textbox', { name: 'Document title' });
        docTitle.textContent = 'New title';
        fireEvent.input(docTitle);
        expect(last().title).toBe('New title');
    });

    it('inserts a paragraph below from the menu and focuses it', () => {
        const { block, onChange, order } = edit(small());
        fireEvent.click(within(openMenu(block('a'))).getByRole('menuitem', { name: 'Insert paragraph below' }));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(order()).toEqual(['a', 'new-1', 'c1', 'c1a', 'b', 'x']);
        expect(document.activeElement).toBe(within(block('new-1')).getByRole('textbox'));
    });

    it('deletes a block from the menu', () => {
        const { block, onChange, order } = edit(small());
        fireEvent.click(within(openMenu(block('b'))).getByRole('menuitem', { name: 'Delete' }));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(order()).toEqual(['a', 'c1', 'c1a', 'x']);
    });

    it('moves blocks up and down from the menu, offering only what is possible', () => {
        const { block, order } = edit(small());
        const first = within(openMenu(block('a')));
        expect(first.queryByRole('menuitem', { name: 'Move up' })).toBeNull();
        fireEvent.click(first.getByRole('menuitem', { name: 'Move down' }));
        expect(order()).toEqual(['c1', 'c1a', 'a', 'b', 'x']);
    });

    it('closes the menu with Escape and returns focus to the handle', () => {
        const { block } = edit(small());
        const menu = openMenu(block('a'));
        expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
        fireEvent.keyDown(menu, { key: 'Escape' });
        expect(screen.queryByRole('menu')).toBeNull();
        expect(document.activeElement).toBe(within(block('a')).getByRole('button', { name: /^Actions for/ }));
    });

    it('moves with Alt+arrows, into and out of a chapter', () => {
        const { block, onChange, last, order } = edit(small());
        const beta = () => within(block('b')).getByRole('textbox');
        fireEvent.keyDown(beta(), { key: 'ArrowUp', altKey: true });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(order()).toEqual(['a', 'b', 'c1', 'c1a', 'x']);

        fireEvent.keyDown(beta(), { key: 'ArrowDown', altKey: true });
        fireEvent.keyDown(beta(), { key: 'ArrowRight', altKey: true });
        expect(findBlock(last(), 'b')).toMatchObject({ parentId: 'c1', index: 1 });

        fireEvent.keyDown(beta(), { key: 'ArrowLeft', altKey: true });
        expect(findBlock(last(), 'b')).toMatchObject({ parentId: undefined, index: 2 });
    });

    it('moves only the innermost block on Alt+arrows', () => {
        const { block, last } = edit(small());
        fireEvent.keyDown(within(block('c1a')).getByRole('textbox'), { key: 'ArrowLeft', altKey: true });
        expect(findBlock(last(), 'c1a')).toMatchObject({ parentId: undefined, index: 2 });
        expect(findBlock(last(), 'c1')).toMatchObject({ parentId: undefined, index: 1 });
    });

    it('splits a paragraph on Enter and starts a new one at its end', () => {
        const { block, last, order } = edit(small());
        const text = within(block('a')).getByRole('textbox');
        text.focus();
        placeCaret(text, 2);
        fireEvent.keyDown(text, { key: 'Enter' });
        expect(order()).toEqual(['a', 'new-1', 'c1', 'c1a', 'b', 'x']);
        expect(findBlock(last(), 'a')!.block).toMatchObject({ text: [{ text: 'Al' }] });
        expect(findBlock(last(), 'new-1')!.block).toMatchObject({ text: [{ text: 'pha' }] });
        expect(document.activeElement).toBe(within(block('new-1')).getByRole('textbox'));
    });

    it('opens a chapter with Enter in its title', () => {
        const { block, last } = edit(small());
        const title = within(block('c1')).getAllByRole('textbox', { name: 'Chapter title' })[0];
        title.focus();
        placeCaret(title, 'end');
        fireEvent.keyDown(title, { key: 'Enter' });
        expect(findBlock(last(), 'new-1')).toMatchObject({ parentId: 'c1', index: 0 });
    });

    it('removes an empty paragraph with Backspace and joins a non-empty one upward', () => {
        const doc = small();
        doc.blocks.splice(1, 0, { id: 'empty', type: 'paragraph', text: [] });
        const { block, last, order } = edit(doc);

        const empty = within(block('empty')).getByRole('textbox');
        empty.focus();
        placeCaret(empty, 'start');
        fireEvent.keyDown(empty, { key: 'Backspace' });
        expect(order()).toEqual(['a', 'c1', 'c1a', 'b', 'x']);

        const inside = within(block('c1a')).getByRole('textbox');
        inside.focus();
        placeCaret(inside, 'start');
        fireEvent.keyDown(inside, { key: 'Backspace' });
        // The block above c1a is the chapter title, not a paragraph: nothing is joined
        expect(findBlock(last(), 'c1a')).toBeDefined();
    });

    it('drags a block into a chapter, and never a chapter into itself', () => {
        const { block, onChange, last } = edit(small());
        const transfer = dataTransfer();
        const handleOf = (id: string) => within(block(id)).getAllByRole('button', { name: /^Actions for/ })[0];

        fireEvent.dragStart(handleOf('c1'), { dataTransfer: transfer });
        const insideChapter = block('c1').querySelectorAll('.bd-gap');
        expect(Array.from(insideChapter).some((gap) => gap.classList.contains('bd-gap--droppable'))).toBe(false);
        fireEvent.dragEnd(handleOf('c1'));

        fireEvent.dragStart(handleOf('b'), { dataTransfer: transfer });
        const gapAfterInside = block('c1').querySelectorAll('.bd-gap')[1];
        expect(gapAfterInside).toHaveClass('bd-gap--droppable');
        fireEvent.dragOver(gapAfterInside, { dataTransfer: transfer });
        fireEvent.drop(gapAfterInside, { dataTransfer: transfer });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(findBlock(last(), 'b')).toMatchObject({ parentId: 'c1', index: 1 });
    });

    it('keeps an unknown block through an edit', () => {
        const { block, last } = edit(small());
        const text = within(block('a')).getByRole('textbox');
        text.textContent = 'changed';
        fireEvent.input(text);
        expect(findBlock(last(), 'x')!.block).toEqual({ id: 'x', type: 'table', rows: [['kept']] });
    });

    it('inserts an image only with its alternative text', () => {
        const { block, onChange, last } = edit(small());
        fireEvent.click(within(openMenu(block('a'))).getByRole('menuitem', { name: 'Insert image below' }));
        const form = screen.getByRole('form', { name: 'Insert image' });
        fireEvent.change(within(form).getByLabelText('Image address'), { target: { value: 'plans/new.svg' } });
        fireEvent.submit(form);
        expect(within(form).getByRole('alert')).toHaveTextContent('alternative text');
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.change(within(form).getByLabelText('Alternative text'), { target: { value: 'A new plan' } });
        fireEvent.submit(form);
        expect(findBlock(last(), 'new-1')).toMatchObject({
            parentId: undefined,
            index: 1,
            block: { type: 'image', src: 'plans/new.svg', alt: 'A new plan' },
        });
    });

    it('edits a caption and removes it when emptied', () => {
        const { container, last } = edit(sample);
        const figure = container.querySelector('[data-block-id="plans-ground-image"]') as HTMLElement;
        const caption = within(figure).getByRole('textbox', { name: 'Caption' });
        caption.textContent = '';
        fireEvent.input(caption);
        expect(findBlock(last(), 'plans-ground-image')!.block).not.toHaveProperty('caption');
    });

    it('offers a first paragraph in an empty document', () => {
        const { last } = edit({ ...small(), blocks: [] });
        fireEvent.click(screen.getByRole('button', { name: 'Add a paragraph' }));
        expect(last().blocks).toEqual([{ id: 'new-1', type: 'paragraph', text: [] }]);
    });
});
