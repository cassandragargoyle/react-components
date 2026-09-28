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
import { blockDocumentMessages, type BlockDocumentMessages } from './messages';
import { findBlock, flattenBlocks } from './operations';
import { placeCaret } from './richTextDom';
import sampleJson from './samples/family-house.blockdocument.json';
import type { AddressBlock, BlockDocumentData, DocumentBlock } from './types';

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

describe('BlockDocument address and field visibility (INT-003)', () => {
    function withAddress(extra: Partial<AddressBlock> = {}): BlockDocumentData {
        return {
            ...small(),
            blocks: [
                {
                    id: 'addr',
                    type: 'address',
                    street: 'Lipová',
                    houseNumber: '1234',
                    houseNumberType: 'conscription',
                    orientationNumber: '12',
                    postalCode: '251 01',
                    city: 'Říčany',
                    country: 'Czech Republic',
                    ruianCode: 12345678,
                    gps: { lat: 49.9917, lon: 14.6543 },
                    ...extra,
                },
                ...small().blocks,
            ],
        };
    }

    const addressText = (container: HTMLElement): string => container.querySelector('address')?.textContent ?? '';

    it('renders the family house address without its coordinates', () => {
        const { container } = render(<BlockDocument document={sample} />);
        const lines = [...container.querySelectorAll('address .bd-address-line')].map((el) => el.textContent);
        expect(lines).toEqual(['Lipová 1234/12', '251 01 Říčany', 'Czech Republic']);
        expect(container.textContent).not.toContain('49.9917');
    });

    it('shows the coordinates and the code when the host asks for them', () => {
        const { container } = render(
            <BlockDocument document={withAddress()} fieldVisibility={{ address: { gps: true, ruianCode: true } }} />,
        );
        expect(addressText(container)).toContain('49.9917, 14.6543');
        expect(addressText(container)).toContain('RÚIAN 12345678');
    });

    it("lets a block's visibility win over the host's, in both directions", () => {
        const hidden = render(
            <BlockDocument document={withAddress({ visibility: { gps: false } })} fieldVisibility={{ address: { gps: true } }} />,
        );
        expect(addressText(hidden.container)).not.toContain('49.9917');
        hidden.unmount();

        const shown = render(
            <BlockDocument
                document={withAddress({ visibility: { gps: true, country: false } })}
                fieldVisibility={{ address: { gps: false } }}
            />,
        );
        expect(addressText(shown.container)).toContain('49.9917');
        expect(addressText(shown.container)).not.toContain('Czech Republic');
    });

    it('shows hidden fields while editing, dimmed and marked', () => {
        const { block } = edit(withAddress());
        const hidden = block('addr').querySelectorAll('.bd-field--hidden');
        expect([...hidden].map((el) => el.textContent)).toEqual([
            'RÚIAN address code: 12345678 Not shown in the document',
            'GPS coordinates: 49.9917, 14.6543 Not shown in the document',
        ]);
        expect(addressText(block('addr'))).not.toContain('49.9917');
    });

    it('hides an image caption per the host, and still edits it', () => {
        const readOnly = render(<BlockDocument document={sample} fieldVisibility={{ image: { caption: false } }} />);
        expect(readOnly.queryByText('Ground floor, 1 : 100')).toBeNull();
        readOnly.unmount();

        const { container } = edit(sample, { fieldVisibility: { image: { caption: false } } });
        const figure = container.querySelector('[data-block-id="plans-ground-image"]') as HTMLElement;
        expect(within(figure).getByRole('textbox', { name: 'Caption' })).toHaveTextContent('Ground floor, 1 : 100');
        expect(figure).toHaveTextContent('Caption: not shown in the document');
    });

    it('inserts an address from the gap menu, only when something is filled in', () => {
        const { container, onChange, last } = edit(small());
        const gap = container.querySelectorAll('.bd-gap')[1] as HTMLElement;
        fireEvent.click(within(gap).getByRole('button', { name: 'Insert block here' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Insert address' }));
        const form = screen.getByRole('form', { name: 'Insert address' });
        expect(within(form).getByLabelText('Street')).toHaveFocus();

        fireEvent.submit(form);
        expect(within(form).getByRole('alert')).toHaveTextContent('at least one field');
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.change(within(form).getByLabelText('Part of municipality'), { target: { value: 'Praskačka' } });
        fireEvent.change(within(form).getByLabelText('House number'), { target: { value: '111' } });
        fireEvent.change(within(form).getByLabelText('House number type'), { target: { value: 'conscription' } });
        fireEvent.change(within(form).getByLabelText('City'), { target: { value: 'Praskačka' } });
        fireEvent.change(within(form).getByLabelText('Latitude'), { target: { value: '50,2' } });
        fireEvent.change(within(form).getByLabelText('Longitude'), { target: { value: '15.9' } });
        fireEvent.submit(form);
        expect(findBlock(last(), 'new-1')).toMatchObject({ parentId: undefined, index: 1 });
        expect(findBlock(last(), 'new-1')!.block).toEqual({
            id: 'new-1',
            type: 'address',
            houseNumber: '111',
            houseNumberType: 'conscription',
            municipalityPart: 'Praskačka',
            city: 'Praskačka',
            gps: { lat: 50.2, lon: 15.9 },
        });
        expect(addressText(container)).toBe('č.p. 111Praskačka');
    });

    it('refuses coordinates out of range or only one of them, naming the field', () => {
        const { block, onChange } = edit(withAddress({ gps: undefined }));
        fireEvent.click(within(openMenu(block('addr'))).getByRole('menuitem', { name: 'Edit address…' }));
        const form = screen.getByRole('form', { name: 'Edit address' });

        fireEvent.change(within(form).getByLabelText('Latitude'), { target: { value: '95' } });
        fireEvent.change(within(form).getByLabelText('Longitude'), { target: { value: '14' } });
        fireEvent.submit(form);
        expect(within(form).getByRole('alert')).toHaveTextContent('Latitude must be a number between -90 and 90');
        expect(within(form).getByLabelText('Latitude')).toHaveFocus();

        fireEvent.change(within(form).getByLabelText('Latitude'), { target: { value: '' } });
        fireEvent.submit(form);
        expect(within(form).getByRole('alert')).toHaveTextContent('both latitude and longitude');
        expect(onChange).not.toHaveBeenCalled();
    });

    it('keeps visibility names it does not know through an edit', () => {
        const { block, last } = edit(withAddress({ visibility: { floor: true } }));
        fireEvent.click(within(openMenu(block('addr'))).getByRole('menuitem', { name: 'Edit address…' }));
        fireEvent.submit(screen.getByRole('form', { name: 'Edit address' }));
        expect(findBlock(last(), 'addr')!.block).toHaveProperty('visibility', { floor: true });
    });

    it('offers edit and display settings on the right of a block', () => {
        const { block } = edit(withAddress());
        const tools = (id: string): string[] =>
            within(block(id))
                .queryAllByRole('button')
                .filter((el) => el.closest('.bd-tools')?.parentElement === block(id))
                .map((el) => el.getAttribute('aria-label')!);
        expect(tools('addr')).toEqual([
            'Edit address Lipová 1234/12',
            'Display settings for address Lipová 1234/12',
        ]);
        expect(tools('a')).toEqual(['Edit paragraph']);
        expect(tools('x')).toEqual([]);
    });

    it('opens the address form from the edit button, with no switches in it', () => {
        const { block } = edit(withAddress());
        fireEvent.click(within(block('addr')).getByRole('button', { name: /^Edit address/ }));
        const form = screen.getByRole('form', { name: 'Edit address' });
        expect(within(form).queryByRole('switch')).toBeNull();
        expect(within(form).getByLabelText('Latitude')).toHaveAccessibleDescription(
            'Latitude and longitude: not shown in the document',
        );
    });

    it('toggles the address form with the edit button, which shows as pressed', () => {
        const { block } = edit(withAddress());
        const pencil = within(block('addr')).getByRole('button', { name: /^Edit address/ });
        expect(pencil).toHaveAttribute('aria-pressed', 'false');
        // A real press: the pointer goes down before the click
        fireEvent.mouseDown(pencil);
        fireEvent.click(pencil);
        expect(screen.getByRole('form', { name: 'Edit address' })).toBeInTheDocument();
        expect(pencil).toHaveAttribute('aria-pressed', 'true');
        fireEvent.mouseDown(pencil);
        fireEvent.click(pencil);
        expect(screen.queryByRole('form', { name: 'Edit address' })).toBeNull();
        expect(pencil).toHaveAttribute('aria-pressed', 'false');
        expect(within(block('a')).getByRole('button', { name: 'Edit paragraph' })).not.toHaveAttribute('aria-pressed');
    });

    it('closes the display settings and the block menu on a second press of their button', () => {
        const { block } = edit(withAddress());
        const gear = within(block('addr')).getByRole('button', { name: /^Display settings/ });
        fireEvent.mouseDown(gear);
        fireEvent.click(gear);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        fireEvent.mouseDown(gear);
        fireEvent.click(gear);
        expect(screen.queryByRole('dialog')).toBeNull();

        const handle = within(block('addr')).getAllByRole('button', { name: /^Actions for/ })[0];
        fireEvent.mouseDown(handle);
        fireEvent.click(handle);
        expect(screen.getByRole('menu')).toBeInTheDocument();
        fireEvent.mouseDown(handle);
        fireEvent.click(handle);
        expect(screen.queryByRole('menu')).toBeNull();

        // A press elsewhere still closes it
        fireEvent.click(handle);
        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('puts the caret into a paragraph from its edit button', () => {
        const { block } = edit(small());
        fireEvent.click(within(block('a')).getByRole('button', { name: 'Edit paragraph' }));
        expect(within(block('a')).getByRole('textbox', { name: 'Paragraph' })).toHaveFocus();
    });

    it('writes visibility from the display settings at once, and drops a switch set back to the inherited value', () => {
        const { block, last } = edit(withAddress());
        const settings = within(block('addr')).getByRole('button', { name: /^Display settings/ });
        fireEvent.click(settings);
        const dialog = screen.getByRole('dialog', { name: /Show in document/ });
        const gpsSwitch = within(dialog).getByRole('switch', { name: 'Show GPS coordinates in the document' });
        expect(within(dialog).getByRole('switch', { name: 'Show Street in the document' })).toHaveFocus();
        expect(gpsSwitch).not.toBeChecked();

        fireEvent.click(gpsSwitch);
        expect(findBlock(last(), 'addr')!.block).toHaveProperty('visibility', { gps: true });
        fireEvent.click(within(dialog).getByRole('switch', { name: 'Show Country in the document' }));
        expect(findBlock(last(), 'addr')!.block).toHaveProperty('visibility', { gps: true, country: false });
        expect(dialog).toHaveTextContent('GPS coordinates · this block');
        expect(addressText(block('addr'))).toContain('49.9917');

        fireEvent.click(within(dialog).getByRole('switch', { name: 'Show GPS coordinates in the document' }));
        fireEvent.click(within(dialog).getByRole('switch', { name: 'Show Country in the document' }));
        expect(findBlock(last(), 'addr')!.block).not.toHaveProperty('visibility');

        fireEvent.keyDown(dialog, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(settings).toHaveFocus();
    });

    it('offers the caption of an image in its display settings', () => {
        const { container, last } = edit(sample);
        const figure = container.querySelector('[data-block-id="plans-ground-image"]') as HTMLElement;
        fireEvent.click(within(figure).getByRole('button', { name: /^Display settings/ }));
        fireEvent.click(screen.getByRole('switch', { name: 'Show Caption in the document' }));
        expect(findBlock(last(), 'plans-ground-image')!.block).toHaveProperty('visibility', { caption: false });
        expect(figure).toHaveTextContent('Caption: not shown in the document');
    });

    it('starts a switch at what the host gives', () => {
        const { block } = edit(withAddress(), { fieldVisibility: { address: { gps: true } } });
        fireEvent.click(within(block('addr')).getByRole('button', { name: /^Display settings/ }));
        expect(screen.getByRole('switch', { name: 'Show GPS coordinates in the document' })).toBeChecked();
    });
});

describe('BlockDocument localization (INT-004)', () => {
    // A document written in Czech, with every kind of block, so no English comes from the content
    function czech(): BlockDocumentData {
        return {
            schemaVersion: 1,
            id: 'cz',
            title: 'Rodinný dům',
            language: 'cs',
            blocks: [
                {
                    id: 'addr',
                    type: 'address',
                    street: 'Lipová',
                    houseNumber: '1234',
                    houseNumberType: 'conscription',
                    orientationNumber: '12',
                    postalCode: '251 01',
                    city: 'Říčany',
                    country: 'Česko',
                    ruianCode: 12345678,
                    gps: { lat: 49.9917, lon: 14.6543 },
                },
                { id: 'p', type: 'paragraph', text: [{ text: 'Úvod' }] },
                { id: 'c', type: 'chapter', title: [{ text: 'Kapitola' }], children: [] },
                {
                    id: 'img',
                    type: 'image',
                    src: 'pudorys.png',
                    alt: 'Půdorys',
                    caption: [{ text: 'Přízemí' }],
                    visibility: { caption: false },
                },
                { id: 'v', type: 'video', src: 'prohlidka.mp4' },
                { id: 'x', type: 'tabulka' } as DocumentBlock,
            ],
        };
    }

    // The English texts that differ from the Czech ones, templates reduced to their fixed words
    function englishTexts(): string[] {
        const leaves = (en: unknown, cs: unknown): string[] => {
            if (typeof en === 'function') {
                const [a, b] = [(en as (x: string) => string)('').trim(), (cs as (x: string) => string)('').trim()];
                return a !== b ? [a] : [];
            }
            if (typeof en === 'string') return en !== cs ? [en] : [];
            return Object.keys(en as object).flatMap((key) =>
                leaves((en as Record<string, unknown>)[key], (cs as Record<string, unknown>)[key]),
            );
        };
        return leaves(blockDocumentMessages.en, blockDocumentMessages.cs).filter((text) => /[a-z]{3}/i.test(text));
    }

    // Everything the page says: each text node apart, so neighbouring labels do not run together,
    // and the names and placeholders of its elements
    function pageTexts(): string {
        const texts: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) texts.push(walker.currentNode.textContent ?? '');
        const attributes = Array.from(document.body.querySelectorAll('*')).flatMap((el) =>
            ['aria-label', 'placeholder', 'data-placeholder', 'title'].map((name) => el.getAttribute(name) ?? ''),
        );
        return [...texts, ...attributes].join('\n');
    }

    function expectNoEnglish(): void {
        const page = pageTexts();
        const found = englishTexts().filter((text) =>
            new RegExp(`(^|[^\\p{L}])${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'u').test(page),
        );
        expect(found).toEqual([]);
    }

    it('renders every text in Czech, in the menus, forms and display settings', () => {
        const { container, block } = edit(czech());
        const article = container.querySelector('article')!;
        expect(article).toHaveAttribute('lang', 'cs');
        expect(screen.getByRole('textbox', { name: 'Název dokumentu' })).toBeInTheDocument();
        expect(block('img')).toHaveTextContent('Popisek: v dokumentu se nezobrazuje');
        expect(block('x')).toHaveTextContent('Nepodporovaný blok: tabulka');

        expectNoEnglish();

        // The menu of each block, one form or panel open at a time, each checked while it is
        for (const id of ['addr', 'p', 'c', 'img', 'v', 'x']) {
            fireEvent.click(within(block(id)).getAllByRole('button', { name: /^Akce: / })[0]);
        }
        const addressMenu = screen.getByRole('menu', { name: 'Akce: adresa Lipová 1234/12' });
        expect(within(addressMenu).getAllByRole('menuitem').map((el) => el.textContent)).toEqual([
            'Vložit odstavec za blok',
            'Vložit kapitolu za blok',
            'Vložit obrázek za blok',
            'Vložit video za blok',
            'Vložit adresu za blok',
            'Posunout dolů',
            'Upravit adresu…',
            'Smazat',
        ]);

        // The display settings
        fireEvent.click(within(block('addr')).getByRole('button', { name: 'Nastavení zobrazení: adresa Lipová 1234/12' }));
        expect(screen.getByRole('switch', { name: 'Zobrazit v dokumentu: Souřadnice GPS' })).not.toBeChecked();
        expect(screen.getByRole('button', { name: 'Hotovo' })).toBeInTheDocument();
        expectNoEnglish();

        // The address form, with its error
        fireEvent.click(within(addressMenu).getByRole('menuitem', { name: 'Upravit adresu…' }));
        const addressForm = screen.getByRole('form', { name: 'Upravit adresu' });
        fireEvent.change(within(addressForm).getByLabelText('Zeměpisná šířka'), { target: { value: '95' } });
        fireEvent.submit(addressForm);
        expect(within(addressForm).getByRole('alert')).toHaveTextContent('Zeměpisná šířka musí být číslo od -90 do 90');
        expect(within(addressForm).getByLabelText('Typ čísla domovního')).toHaveDisplayValue('Číslo popisné (č.p.)');
        expect(addressForm).toHaveTextContent('Zeměpisná šířka a délka: v dokumentu se nezobrazuje');
        expectNoEnglish();

        // The image and video forms, from the gap menus
        const gaps = container.querySelectorAll('.bd-gap');
        fireEvent.click(within(gaps[0] as HTMLElement).getByRole('button', { name: 'Vložit blok sem' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Vložit obrázek' }));
        const imageForm = screen.getByRole('form', { name: 'Vložit obrázek' });
        fireEvent.submit(imageForm);
        expect(within(imageForm).getByRole('alert')).toHaveTextContent('Zadejte adresu obrázku');
        expectNoEnglish();
        fireEvent.click(within(gaps[2] as HTMLElement).getByRole('button', { name: 'Vložit blok sem' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Vložit video' }));
        expect(screen.getByRole('form', { name: 'Vložit video' })).toHaveTextContent('Adresa náhledu (nepovinné)');
        expectNoEnglish();

        // The link form of a paragraph
        const paragraph = within(block('p')).getByRole('textbox', { name: 'Odstavec' });
        placeCaret(paragraph, 2);
        fireEvent.keyDown(paragraph, { key: 'k', ctrlKey: true });
        const linkForm = screen.getByRole('form', { name: 'Odkaz' });
        fireEvent.change(within(linkForm).getByLabelText('Adresa odkazu'), { target: { value: 'javascript:x' } });
        fireEvent.submit(linkForm);
        expect(within(linkForm).getByRole('alert')).toHaveTextContent('Odkazovat lze jen na adresy http, https a mailto');

        expectNoEnglish();
    });

    it('renders the texts in English with locale="en", and keeps the content language', () => {
        const { container } = render(<BlockDocument document={czech()} locale="en" onChange={() => undefined} />);
        expect(container.querySelector('article')).toHaveAttribute('lang', 'cs');
        expect(screen.getByRole('textbox', { name: 'Document title' })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /^Actions for/ })).not.toHaveLength(0);
    });

    it('renders in English without a language or a locale, with no lang attribute', () => {
        const { container } = render(<BlockDocument document={small()} />);
        expect(container.querySelector('article')).not.toHaveAttribute('lang');
        expect(screen.getByText('Unsupported block: table')).toBeInTheDocument();
    });

    it('resolves cs-CZ to Czech and falls back to English for an unknown tag', () => {
        const regional = render(<BlockDocument document={{ ...small(), language: 'cs-CZ' }} />);
        expect(regional.getByText('Nepodporovaný blok: table')).toBeInTheDocument();
        regional.unmount();
        render(<BlockDocument document={{ ...small(), language: 'xx' }} />);
        expect(screen.getByText('Unsupported block: table')).toBeInTheDocument();
    });

    it('keeps the Czech address prefixes and the coordinate format in every language', () => {
        const doc: BlockDocumentData = {
            ...czech(),
            blocks: [{ id: 'a', type: 'address', houseNumber: '7', houseNumberType: 'registration', city: 'Brno', ruianCode: 42, gps: { lat: 49.5, lon: 16.25 } }],
        };
        const visibility = { address: { gps: true, ruianCode: true } };
        for (const locale of ['cs', 'en']) {
            const view = render(<BlockDocument document={doc} locale={locale} fieldVisibility={visibility} />);
            const address = view.container.querySelector('address')!;
            expect(Array.from(address.children).map((el) => el.textContent)).toEqual(['č.ev. 7', 'Brno', 'RÚIAN 42', '49.5, 16.25']);
            view.unmount();
        }
    });

    it('lets messages reword a single text, or add a whole language', () => {
        const { unmount } = render(<BlockDocument document={czech()} messages={{ unsupportedBlock: (type) => `Neznámý blok ${type}` }} />);
        expect(screen.getByText('Neznámý blok tabulka')).toBeInTheDocument();
        unmount();

        const de: BlockDocumentMessages = { ...blockDocumentMessages.en, unsupportedBlock: (type) => `Nicht unterstützter Block: ${type}` };
        render(<BlockDocument document={czech()} locale="de" messages={de} />);
        expect(screen.getByText('Nicht unterstützter Block: tabulka')).toBeInTheDocument();
    });
});
