/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The texts BlockDocument renders, per language (INT-004): English and Czech are built in
// The host's `locale`, else the document `language`, else English picks one; `messages` rewords it

import { createContext, useContext } from 'react';

import type { AddressField } from './address';

/** The block types that can be inserted from the menu */
type InsertableType = 'paragraph' | 'chapter' | 'image' | 'video' | 'address';

/** The block types edited in a form */
type FormType = 'image' | 'video' | 'address';

/**
 * Every text of the component in one language. A text with a variable part is a function,
 * because word order differs between languages
 */
export interface BlockDocumentMessages {
    /** The name of an untitled document to assistive technology */
    document: string;
    documentTitle: string;
    untitled: string;
    addParagraph: string;
    /** Shown for an invalid document; `error` stays in English, from `validateBlockDocument` */
    cannotShow: (error: string) => string;

    /** How a block is named to assistive technology, e.g. in `actionsFor` */
    blockName: {
        chapter: (title: string) => string;
        paragraph: string;
        image: (alt: string) => string;
        video: (captionOrSrc: string) => string;
        address: (firstLine: string) => string;
        unknown: (type: string) => string;
    };

    insertHere: string;
    insertMenu: string;
    /** A menu item, and the name of the insert form */
    insert: Record<InsertableType, string>;
    /** A menu item of a block, inserting after it */
    insertBelow: Record<InsertableType, string>;
    moveUp: string;
    moveDown: string;
    moveIntoChapter: string;
    moveOutOfChapter: string;
    /** A menu item of a block, opening its form */
    editMenu: Record<FormType, string>;
    delete: string;
    actionsFor: (block: string) => string;
    editBlock: (block: string) => string;
    displaySettingsFor: (block: string) => string;

    chapterTitle: string;
    paragraph: string;
    paragraphPlaceholder: string;
    caption: string;
    captionPlaceholder: string;
    video: string;
    unsupportedBlock: (type: string) => string;

    notShown: string;
    fieldNotShown: (field: string) => string;
    showInDocument: string;
    thisBlock: string;
    showFieldInDocument: (field: string) => string;
    done: string;

    /** The name of the edit form */
    edit: Record<FormType, string>;
    insertButton: string;
    save: string;
    cancel: string;

    imageAddress: string;
    videoAddress: string;
    altText: string;
    posterAddress: string;
    srcRequired: Record<'image' | 'video', string>;
    altRequired: string;

    houseNumberType: string;
    notSpecified: string;
    conscriptionNumber: string;
    registrationNumber: string;
    latitude: string;
    longitude: string;
    latitudeAndLongitude: string;
    ruianInvalid: string;
    latitudeInvalid: string;
    longitudeInvalid: string;
    gpsIncomplete: string;
    addressEmpty: string;

    link: string;
    linkAddress: string;
    linkPlaceholder: string;
    applyLink: string;
    linkInvalid: string;

    /** The labels of the fields a block type declares (ADR-001) */
    fields: {
        image: { caption: string };
        video: { poster: string; caption: string };
        address: Record<AddressField, string>;
    };
}

type DeepPartial<T> = T extends (...args: never[]) => unknown
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

/** Any part of `BlockDocumentMessages`, at any depth: what the host's `messages` prop takes */
export type BlockDocumentMessageOverrides = DeepPartial<BlockDocumentMessages>;

const en: BlockDocumentMessages = {
    document: 'Document',
    documentTitle: 'Document title',
    untitled: 'Untitled',
    addParagraph: 'Add a paragraph',
    cannotShow: (error) => `This document cannot be shown. ${error}`,

    blockName: {
        chapter: (title) => `chapter ${title || '(untitled)'}`,
        paragraph: 'paragraph',
        image: (alt) => `image ${alt}`,
        video: (captionOrSrc) => `video ${captionOrSrc}`,
        address: (firstLine) => `address ${firstLine}`,
        unknown: (type) => `unsupported block ${type}`,
    },

    insertHere: 'Insert block here',
    insertMenu: 'Insert block',
    insert: {
        paragraph: 'Insert paragraph',
        chapter: 'Insert chapter',
        image: 'Insert image',
        video: 'Insert video',
        address: 'Insert address',
    },
    insertBelow: {
        paragraph: 'Insert paragraph below',
        chapter: 'Insert chapter below',
        image: 'Insert image below',
        video: 'Insert video below',
        address: 'Insert address below',
    },
    moveUp: 'Move up',
    moveDown: 'Move down',
    moveIntoChapter: 'Move into chapter above',
    moveOutOfChapter: 'Move out of chapter',
    editMenu: { image: 'Edit image…', video: 'Edit video…', address: 'Edit address…' },
    delete: 'Delete',
    actionsFor: (block) => `Actions for ${block}`,
    editBlock: (block) => `Edit ${block}`,
    displaySettingsFor: (block) => `Display settings for ${block}`,

    chapterTitle: 'Chapter title',
    paragraph: 'Paragraph',
    paragraphPlaceholder: 'Type something…',
    caption: 'Caption',
    captionPlaceholder: 'Add a caption',
    video: 'Video',
    unsupportedBlock: (type) => `Unsupported block: ${type}`,

    notShown: 'Not shown in the document',
    fieldNotShown: (field) => `${field}: not shown in the document`,
    showInDocument: 'Show in document',
    thisBlock: 'this block',
    showFieldInDocument: (field) => `Show ${field} in the document`,
    done: 'Done',

    edit: { image: 'Edit image', video: 'Edit video', address: 'Edit address' },
    insertButton: 'Insert',
    save: 'Save',
    cancel: 'Cancel',

    imageAddress: 'Image address',
    videoAddress: 'Video address',
    altText: 'Alternative text',
    posterAddress: 'Poster address (optional)',
    srcRequired: { image: 'Enter the address of the image', video: 'Enter the address of the video' },
    altRequired: 'Describe the image in the alternative text',

    houseNumberType: 'House number type',
    notSpecified: 'Not specified',
    conscriptionNumber: 'Conscription number (č.p.)',
    registrationNumber: 'Registration number (č.ev.)',
    latitude: 'Latitude',
    longitude: 'Longitude',
    latitudeAndLongitude: 'Latitude and longitude',
    ruianInvalid: 'The RÚIAN address code must be a positive whole number',
    latitudeInvalid: 'Latitude must be a number between -90 and 90',
    longitudeInvalid: 'Longitude must be a number between -180 and 180',
    gpsIncomplete: 'Enter both latitude and longitude, or neither',
    addressEmpty: 'Fill in at least one field of the address',

    link: 'Link',
    linkAddress: 'Link address',
    linkPlaceholder: 'https://…  (empty removes the link)',
    applyLink: 'Apply',
    linkInvalid: 'Only http, https and mailto addresses can be linked',

    fields: {
        image: { caption: 'Caption' },
        video: { poster: 'Poster', caption: 'Caption' },
        address: {
            street: 'Street',
            houseNumber: 'House number',
            orientationNumber: 'Orientation number',
            municipalityPart: 'Part of municipality',
            postalCode: 'Postal code',
            city: 'City',
            country: 'Country',
            ruianCode: 'RÚIAN address code',
            gps: 'GPS coordinates',
        },
    },
};

// Block names follow a colon, so the Czech nominative never has to be declined
const cs: BlockDocumentMessages = {
    document: 'Dokument',
    documentTitle: 'Název dokumentu',
    untitled: 'Bez názvu',
    addParagraph: 'Přidat odstavec',
    cannotShow: (error) => `Tento dokument nelze zobrazit. ${error}`,

    blockName: {
        chapter: (title) => `kapitola ${title || '(bez názvu)'}`,
        paragraph: 'odstavec',
        image: (alt) => `obrázek ${alt}`,
        video: (captionOrSrc) => `video ${captionOrSrc}`,
        address: (firstLine) => `adresa ${firstLine}`,
        unknown: (type) => `nepodporovaný blok ${type}`,
    },

    insertHere: 'Vložit blok sem',
    insertMenu: 'Vložit blok',
    insert: {
        paragraph: 'Vložit odstavec',
        chapter: 'Vložit kapitolu',
        image: 'Vložit obrázek',
        video: 'Vložit video',
        address: 'Vložit adresu',
    },
    insertBelow: {
        paragraph: 'Vložit odstavec za blok',
        chapter: 'Vložit kapitolu za blok',
        image: 'Vložit obrázek za blok',
        video: 'Vložit video za blok',
        address: 'Vložit adresu za blok',
    },
    moveUp: 'Posunout nahoru',
    moveDown: 'Posunout dolů',
    moveIntoChapter: 'Přesunout do kapitoly nad',
    moveOutOfChapter: 'Přesunout z kapitoly ven',
    editMenu: { image: 'Upravit obrázek…', video: 'Upravit video…', address: 'Upravit adresu…' },
    delete: 'Smazat',
    actionsFor: (block) => `Akce: ${block}`,
    editBlock: (block) => `Upravit: ${block}`,
    displaySettingsFor: (block) => `Nastavení zobrazení: ${block}`,

    chapterTitle: 'Název kapitoly',
    paragraph: 'Odstavec',
    paragraphPlaceholder: 'Napište něco…',
    caption: 'Popisek',
    captionPlaceholder: 'Přidat popisek',
    video: 'Video',
    unsupportedBlock: (type) => `Nepodporovaný blok: ${type}`,

    notShown: 'V dokumentu se nezobrazuje',
    fieldNotShown: (field) => `${field}: v dokumentu se nezobrazuje`,
    showInDocument: 'Zobrazit v dokumentu',
    thisBlock: 'tento blok',
    showFieldInDocument: (field) => `Zobrazit v dokumentu: ${field}`,
    done: 'Hotovo',

    edit: { image: 'Upravit obrázek', video: 'Upravit video', address: 'Upravit adresu' },
    insertButton: 'Vložit',
    save: 'Uložit',
    cancel: 'Zrušit',

    imageAddress: 'Adresa obrázku',
    videoAddress: 'Adresa videa',
    altText: 'Alternativní text',
    posterAddress: 'Adresa náhledu (nepovinné)',
    srcRequired: { image: 'Zadejte adresu obrázku', video: 'Zadejte adresu videa' },
    altRequired: 'Popište obrázek v alternativním textu',

    houseNumberType: 'Typ čísla domovního',
    notSpecified: 'Neuvedeno',
    conscriptionNumber: 'Číslo popisné (č.p.)',
    registrationNumber: 'Číslo evidenční (č.ev.)',
    latitude: 'Zeměpisná šířka',
    longitude: 'Zeměpisná délka',
    latitudeAndLongitude: 'Zeměpisná šířka a délka',
    ruianInvalid: 'Kód adresního místa RÚIAN musí být kladné celé číslo',
    latitudeInvalid: 'Zeměpisná šířka musí být číslo od -90 do 90',
    longitudeInvalid: 'Zeměpisná délka musí být číslo od -180 do 180',
    gpsIncomplete: 'Zadejte zeměpisnou šířku i délku, nebo ani jednu',
    addressEmpty: 'Vyplňte alespoň jedno pole adresy',

    link: 'Odkaz',
    linkAddress: 'Adresa odkazu',
    linkPlaceholder: 'https://…  (prázdná adresa odkaz odstraní)',
    applyLink: 'Použít',
    linkInvalid: 'Odkazovat lze jen na adresy http, https a mailto',

    fields: {
        image: { caption: 'Popisek' },
        video: { poster: 'Náhled', caption: 'Popisek' },
        address: {
            street: 'Ulice',
            houseNumber: 'Číslo domovní',
            orientationNumber: 'Číslo orientační',
            municipalityPart: 'Část obce',
            postalCode: 'PSČ',
            city: 'Obec',
            country: 'Stát',
            ruianCode: 'Kód adresního místa RÚIAN',
            gps: 'Souřadnice GPS',
        },
    },
};

/** The built-in dictionaries, by primary language subtag; a host can start its own from one */
export const blockDocumentMessages: Readonly<{ en: BlockDocumentMessages; cs: BlockDocumentMessages }> = { en, cs };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

// Lays `over` onto `base` at any depth; a function or string replaces, an object merges
function merge<T>(base: T, over: unknown): T {
    if (!isPlainObject(base) || !isPlainObject(over)) return (over === undefined ? base : over) as T;
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(over)) {
        if (value !== undefined) out[key] = merge(out[key], value);
    }
    return out as T;
}

/** The built-in dictionary for a BCP 47 tag: exactly, else by its primary subtag, else English */
function dictionaryFor(tag: string | undefined): BlockDocumentMessages {
    const dictionaries = blockDocumentMessages as Readonly<Record<string, BlockDocumentMessages | undefined>>;
    const lower = tag?.trim().toLowerCase();
    if (!lower) return en;
    return dictionaries[lower] ?? dictionaries[lower.split(/[-_]/)[0]!] ?? en;
}

/**
 * The texts to render: the dictionary of `locale`, else of the document `language`, else
 * English, with the host's `overrides` laid over it
 */
export function resolveMessages(
    locale: string | undefined,
    language: string | undefined,
    overrides?: BlockDocumentMessageOverrides,
): BlockDocumentMessages {
    const base = dictionaryFor(locale?.trim() ? locale : language);
    return overrides ? merge(base, overrides) : base;
}

/** The resolved texts, for the components below `BlockDocument` */
export const MessagesContext = createContext<BlockDocumentMessages>(en);

export function useMessages(): BlockDocumentMessages {
    return useContext(MessagesContext);
}
