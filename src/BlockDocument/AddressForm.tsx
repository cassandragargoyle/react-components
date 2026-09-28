/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// The form that inserts or edits the data of an address block (INT-003), every field shown
// A field the document does not show is marked; the block's display settings change that

import React, { useId, useRef, useState } from 'react';

import {
    ADDRESS_FIELDS,
    ADDRESS_TEXT_FIELDS,
    hasAddressContent,
    type AddressField,
    type AddressFields,
    type AddressPatch,
    type AddressTextField,
} from './address';
import { EyeOffIcon } from './icons';
import { useMessages } from './messages';
import type { GeoPoint, HouseNumberType } from './types';

/** What the form saves: every data field, `undefined` where it is cleared; never `visibility` */
export type AddressFormFields = Omit<AddressPatch, 'visibility'>;

export interface AddressFormProps {
    mode: 'insert' | 'edit';
    initial?: AddressFields;
    /** Whether the document shows a field, to mark the ones it does not */
    visible(field: AddressField): boolean;
    onSubmit(fields: AddressFormFields): void;
    onCancel(): void;
}

type InputName = AddressTextField | 'ruianCode' | 'lat' | 'lon';

// Accepts a decimal comma as well, as typed on a Czech keyboard; NaN when it is not a number
function parseNumber(text: string): number | undefined {
    const trimmed = text.trim().replace(',', '.');
    return trimmed ? Number(trimmed) : undefined;
}

export function AddressForm({ mode, initial, visible, onSubmit, onCancel }: AddressFormProps): React.ReactElement {
    const id = useId();
    const messages = useMessages();
    const labels = messages.fields.address;
    const [text, setText] = useState<Record<AddressTextField, string>>(() => {
        const out = {} as Record<AddressTextField, string>;
        for (const field of ADDRESS_TEXT_FIELDS) out[field] = initial?.[field] ?? '';
        return out;
    });
    const [numberType, setNumberType] = useState<HouseNumberType | ''>(initial?.houseNumberType ?? '');
    const [ruian, setRuian] = useState(initial?.ruianCode !== undefined ? String(initial.ruianCode) : '');
    const [lat, setLat] = useState(initial?.gps ? String(initial.gps.lat) : '');
    const [lon, setLon] = useState(initial?.gps ? String(initial.gps.lon) : '');
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
            fail('ruianCode', messages.ruianInvalid);
            return;
        }
        const latValue = parseNumber(lat);
        const lonValue = parseNumber(lon);
        if (latValue !== undefined && !(Math.abs(latValue) <= 90)) {
            fail('lat', messages.latitudeInvalid);
            return;
        }
        if (lonValue !== undefined && !(Math.abs(lonValue) <= 180)) {
            fail('lon', messages.longitudeInvalid);
            return;
        }
        if ((latValue === undefined) !== (lonValue === undefined)) {
            fail(latValue === undefined ? 'lat' : 'lon', messages.gpsIncomplete);
            return;
        }
        const gps: GeoPoint | undefined =
            latValue !== undefined && lonValue !== undefined ? { lat: latValue, lon: lonValue } : undefined;

        const values = {} as Record<AddressTextField, string | undefined>;
        for (const field of ADDRESS_TEXT_FIELDS) values[field] = text[field].trim() || undefined;
        if (!hasAddressContent({ ...values, ruianCode, gps })) {
            fail('street', messages.addressEmpty);
            return;
        }

        onSubmit({
            ...values,
            // A number type without a number says nothing
            houseNumberType: values.houseNumber && numberType ? numberType : undefined,
            ruianCode,
            gps,
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
                aria-describedby={visible(field) ? undefined : `${id}-${field}-hidden`}
                onChange={(e) => onChange(e.target.value)}
                {...extra}
            />
        </>
    );

    const textRow = (field: AddressTextField, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => (
        <React.Fragment key={field}>
            {input(field, labels[field], text[field], (next) => setText((prev) => ({ ...prev, [field]: next })), field, extra)}
        </React.Fragment>
    );

    const hidden = ADDRESS_FIELDS.filter((field) => !visible(field));

    return (
        <form
            className="bd-media-form bd-address-form"
            aria-label={mode === 'insert' ? messages.insert.address : messages.edit.address}
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
                {textRow('street', { autoFocus: true })}
                {textRow('houseNumber')}
                <label htmlFor={`${id}-numberType`}>{messages.houseNumberType}</label>
                <select
                    id={`${id}-numberType`}
                    value={numberType}
                    onChange={(e) => setNumberType(e.target.value as HouseNumberType | '')}
                >
                    <option value="">{messages.notSpecified}</option>
                    <option value="conscription">{messages.conscriptionNumber}</option>
                    <option value="registration">{messages.registrationNumber}</option>
                </select>
                {textRow('orientationNumber', { placeholder: '14a' })}
                {textRow('municipalityPart')}
                {textRow('postalCode')}
                {textRow('city')}
                {textRow('country')}
                {input('ruianCode', labels.ruianCode, ruian, setRuian, 'ruianCode', { inputMode: 'numeric' })}
                {input('lat', messages.latitude, lat, setLat, 'gps', { inputMode: 'decimal', placeholder: '49.9917' })}
                {input('lon', messages.longitude, lon, setLon, 'gps', { inputMode: 'decimal', placeholder: '14.6543' })}
            </div>
            {hidden.map((field) => (
                <p key={field} className="bd-hidden-note" id={`${id}-${field}-hidden`}>
                    <EyeOffIcon />
                    {messages.fieldNotShown(field === 'gps' ? messages.latitudeAndLongitude : labels[field])}
                </p>
            ))}
            {error && (
                <p className="bd-form-error" role="alert">
                    {error.message}
                </p>
            )}
            <div className="bd-form-actions">
                <button type="submit" className="bd-button bd-button--primary">
                    {mode === 'insert' ? messages.insertButton : messages.save}
                </button>
                <button type="button" className="bd-button" onClick={onCancel}>
                    {messages.cancel}
                </button>
            </div>
        </form>
    );
}
