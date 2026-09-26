/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The form that inserts or edits an address block (INT-003), with every field shown
// Each field has a "Show in document" switch that writes the block's visibility (ADR-001)

import React, { useId, useRef, useState } from 'react';

import {
    ADDRESS_FIELD_LABELS,
    ADDRESS_FIELDS,
    ADDRESS_TEXT_FIELDS,
    hasAddressContent,
    type AddressField,
    type AddressFields,
    type AddressPatch,
    type AddressTextField,
} from './address';
import { EyeOffIcon } from './icons';
import type { FieldVisibility, GeoPoint, HouseNumberType } from './types';

export interface AddressFormProps {
    mode: 'insert' | 'edit';
    initial?: AddressFields;
    /** What each field inherits from the host and the type, without the block's own override */
    inherited(field: AddressField): boolean;
    onSubmit(fields: AddressPatch): void;
    onCancel(): void;
}

type InputName = AddressTextField | 'ruianCode' | 'lat' | 'lon';

// Accepts a decimal comma as well, as typed on a Czech keyboard; NaN when it is not a number
function parseNumber(text: string): number | undefined {
    const trimmed = text.trim().replace(',', '.');
    return trimmed ? Number(trimmed) : undefined;
}

export function AddressForm({ mode, initial, inherited, onSubmit, onCancel }: AddressFormProps): React.ReactElement {
    const id = useId();
    const [text, setText] = useState<Record<AddressTextField, string>>(() => {
        const out = {} as Record<AddressTextField, string>;
        for (const field of ADDRESS_TEXT_FIELDS) out[field] = initial?.[field] ?? '';
        return out;
    });
    const [numberType, setNumberType] = useState<HouseNumberType | ''>(initial?.houseNumberType ?? '');
    const [ruian, setRuian] = useState(initial?.ruianCode !== undefined ? String(initial.ruianCode) : '');
    const [lat, setLat] = useState(initial?.gps ? String(initial.gps.lat) : '');
    const [lon, setLon] = useState(initial?.gps ? String(initial.gps.lon) : '');
    const [shown, setShown] = useState<Record<AddressField, boolean>>(() => {
        const own = initial?.visibility ?? {};
        const out = {} as Record<AddressField, boolean>;
        for (const field of ADDRESS_FIELDS) out[field] = own[field] ?? inherited(field);
        return out;
    });
    const [error, setError] = useState<{ input: InputName; message: string } | null>(null);
    const inputs = useRef(new Map<InputName, HTMLInputElement>());

    const fail = (input: InputName, message: string): void => {
        setError({ input, message });
        inputs.current.get(input)?.focus();
    };

    const submit = (e: React.FormEvent): void => {
        e.preventDefault();
        const ruianCode = parseNumber(ruian);
        if (ruianCode !== undefined && !(Number.isSafeInteger(ruianCode) && ruianCode > 0)) {
            fail('ruianCode', 'The RÚIAN address code must be a positive whole number');
            return;
        }
        const latValue = parseNumber(lat);
        const lonValue = parseNumber(lon);
        if (latValue !== undefined && !(Math.abs(latValue) <= 90)) {
            fail('lat', 'Latitude must be a number between -90 and 90');
            return;
        }
        if (lonValue !== undefined && !(Math.abs(lonValue) <= 180)) {
            fail('lon', 'Longitude must be a number between -180 and 180');
            return;
        }
        if ((latValue === undefined) !== (lonValue === undefined)) {
            fail(latValue === undefined ? 'lat' : 'lon', 'Enter both latitude and longitude, or neither');
            return;
        }
        const gps: GeoPoint | undefined =
            latValue !== undefined && lonValue !== undefined ? { lat: latValue, lon: lonValue } : undefined;

        const values = {} as Record<AddressTextField, string | undefined>;
        for (const field of ADDRESS_TEXT_FIELDS) values[field] = text[field].trim() || undefined;
        if (!hasAddressContent({ ...values, ruianCode, gps })) {
            fail('street', 'Fill in at least one field of the address');
            return;
        }

        // Keeps names this form does not know; a switch at its inherited value is no override
        const visibility: FieldVisibility = { ...initial?.visibility };
        for (const field of ADDRESS_FIELDS) {
            if (shown[field] === inherited(field)) delete visibility[field];
            else visibility[field] = shown[field];
        }

        onSubmit({
            ...values,
            // A number type without a number says nothing
            houseNumberType: values.houseNumber && numberType ? numberType : undefined,
            ruianCode,
            gps,
            visibility: Object.keys(visibility).length ? visibility : undefined,
        });
    };

    const register =
        (name: InputName) =>
        (el: HTMLInputElement | null): void => {
            if (el) inputs.current.set(name, el);
            else inputs.current.delete(name);
        };

    const input = (
        name: InputName,
        label: string,
        value: string,
        onChange: (next: string) => void,
        field: AddressField,
        extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {},
    ): React.ReactElement => (
        <>
            <label htmlFor={`${id}-${name}`}>{label}</label>
            <input
                ref={register(name)}
                id={`${id}-${name}`}
                type="text"
                value={value}
                aria-invalid={error?.input === name || undefined}
                aria-describedby={shown[field] ? undefined : `${id}-${field}-hidden`}
                onChange={(e) => onChange(e.target.value)}
                {...extra}
            />
        </>
    );

    const toggle = (field: AddressField, rows = 1): React.ReactElement => (
        <label className="bd-switch" style={rows > 1 ? { gridRow: `span ${rows}` } : undefined}>
            <input
                type="checkbox"
                role="switch"
                checked={shown[field]}
                onChange={(e) => setShown((prev) => ({ ...prev, [field]: e.target.checked }))}
            />
            <span className="bd-visually-hidden">Show {ADDRESS_FIELD_LABELS[field]} in the document</span>
        </label>
    );

    const textRow = (field: AddressTextField, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => (
        <React.Fragment key={field}>
            {input(field, ADDRESS_FIELD_LABELS[field], text[field], (next) => setText((prev) => ({ ...prev, [field]: next })), field, extra)}
            {toggle(field)}
        </React.Fragment>
    );

    const hidden = ADDRESS_FIELDS.filter((field) => !shown[field]);

    return (
        <form
            className="bd-media-form bd-address-form"
            aria-label={`${mode === 'insert' ? 'Insert' : 'Edit'} address`}
            onSubmit={submit}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    onCancel();
                }
                // Keys typed here are not block shortcuts
                e.stopPropagation();
            }}
        >
            <div className="bd-address-grid">
                <span className="bd-address-grid-head" aria-hidden="true">
                    Show in document
                </span>
                {textRow('street', { autoFocus: true })}
                {textRow('houseNumber')}
                <label htmlFor={`${id}-numberType`}>House number type</label>
                <select
                    id={`${id}-numberType`}
                    value={numberType}
                    onChange={(e) => setNumberType(e.target.value as HouseNumberType | '')}
                >
                    <option value="">Not specified</option>
                    <option value="conscription">Conscription number (č.p.)</option>
                    <option value="registration">Registration number (č.ev.)</option>
                </select>
                <span />
                {textRow('orientationNumber', { placeholder: '14a' })}
                {textRow('municipalityPart')}
                {textRow('postalCode')}
                {textRow('city')}
                {textRow('country')}
                {input('ruianCode', ADDRESS_FIELD_LABELS.ruianCode, ruian, setRuian, 'ruianCode', { inputMode: 'numeric' })}
                {toggle('ruianCode')}
                {input('lat', 'Latitude', lat, setLat, 'gps', { inputMode: 'decimal', placeholder: '49.9917' })}
                {toggle('gps', 2)}
                {input('lon', 'Longitude', lon, setLon, 'gps', { inputMode: 'decimal', placeholder: '14.6543' })}
            </div>
            {hidden.map((field) => (
                <p key={field} className="bd-hidden-note" id={`${id}-${field}-hidden`}>
                    <EyeOffIcon />
                    {field === 'gps' ? 'Latitude and longitude' : ADDRESS_FIELD_LABELS[field]}: not shown in the document
                </p>
            ))}
            {error && (
                <p className="bd-form-error" role="alert">
                    {error.message}
                </p>
            )}
            <div className="bd-form-actions">
                <button type="submit" className="bd-button bd-button--primary">
                    {mode === 'insert' ? 'Insert' : 'Save'}
                </button>
                <button type="button" className="bd-button" onClick={onCancel}>
                    Cancel
                </button>
            </div>
        </form>
    );
}
