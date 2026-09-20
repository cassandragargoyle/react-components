/*
 *  This file is part of CassandraGargoyle Community Project
 *  Licensed under the MIT License - see LICENSE file for details
 */

// Reusable carousel component with 3-card fan layout and glassmorphism
// Renders a centered hero card with two offset neighbor cards

import React, { useState, useCallback, useRef, useEffect } from 'react';
import './Carousel.css';

/** Single item to display in the carousel */
export interface CarouselItem {
    id: string;
    label: string;
    description?: string;
    icon?: React.ReactNode;
    meta?: string;
    /** Rich preview content (e.g., tool icon grid) */
    preview?: React.ReactNode;
    accentColor?: string;
}

export interface CarouselProps {
    items: CarouselItem[];
    /** Currently focused item id */
    activeId: string;
    /** Called when user confirms selection (Enter, click Select, double-click) */
    onSelect: (id: string) => void;
    /** Called when user dismisses without selecting (Escape, click outside) */
    onCancel: () => void;
    /** Optional label for the select button (default: "Select") */
    selectLabel?: string;
}

/** Modular index helper for wrap-around navigation */
function mod(n: number, m: number): number {
    return ((n % m) + m) % m;
}

/** Expandable description with show more/less toggle */
function CardDescription({ text }: { text: string }): React.ReactElement {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="carousel-card-description-wrap">
            <p className={`carousel-card-description ${expanded ? 'carousel-card-description--expanded' : ''}`}>
                {text}
            </p>
            {text.length > 80 && (
                <button
                    className="carousel-card-expand"
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(!expanded);
                    }}
                >
                    {expanded ? 'Show less' : 'Show more'}
                </button>
            )}
        </div>
    );
}

export function Carousel({
    items,
    activeId,
    onSelect,
    onCancel,
    selectLabel = 'Select',
}: CarouselProps): React.ReactElement | null {
    const initialIndex = Math.max(0, items.findIndex(item => item.id === activeId));
    const [focusedIndex, setFocusedIndex] = useState(initialIndex);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef({ startX: 0, isDragging: false });

    const count = items.length;

    // Fade-in on mount
    useEffect(() => {
        const frame = requestAnimationFrame(() => setIsVisible(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    // Focus trap
    useEffect(() => {
        containerRef.current?.focus();
    }, []);

    const navigate = useCallback((direction: -1 | 1) => {
        if (isAnimating || count <= 1) return;
        setIsAnimating(true);
        setFocusedIndex(prev => mod(prev + direction, count));
        setTimeout(() => setIsAnimating(false), 300);
    }, [isAnimating, count]);

    const handleSelect = useCallback(() => {
        const item = items[focusedIndex];
        if (item) {
            setIsVisible(false);
            setTimeout(() => onSelect(item.id), 200);
        }
    }, [focusedIndex, items, onSelect]);

    const handleCancel = useCallback(() => {
        setIsVisible(false);
        setTimeout(onCancel, 200);
    }, [onCancel]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                navigate(-1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                navigate(1);
                break;
            case 'Enter':
                e.preventDefault();
                handleSelect();
                break;
            case 'Escape':
                e.preventDefault();
                handleCancel();
                break;
        }
    }, [navigate, handleSelect, handleCancel]);

    // Mouse wheel navigation (horizontal)
    const handleWheel = useCallback((e: React.WheelEvent) => {
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(delta) < 10) return;
        navigate(delta > 0 ? 1 : -1);
    }, [navigate]);

    // Drag/swipe support
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('.carousel-card-select, .carousel-card-expand')) return;
        dragRef.current = { startX: e.clientX, isDragging: true };
    }, []);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!dragRef.current.isDragging) return;
        const diff = e.clientX - dragRef.current.startX;
        dragRef.current.isDragging = false;
        if (Math.abs(diff) > 40) {
            navigate(diff < 0 ? 1 : -1);
        }
    }, [navigate]);

    // Click outside to dismiss
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleCancel();
        }
    }, [handleCancel]);

    if (count === 0) return null;

    /** Get the 3 visible card indices: [prev, center, next] */
    const getVisibleIndices = (): [number, number, number] => {
        const prev = mod(focusedIndex - 1, count);
        const next = mod(focusedIndex + 1, count);
        return [prev, focusedIndex, next];
    };

    const [prevIdx, centerIdx, nextIdx] = getVisibleIndices();

    const renderCard = (index: number, position: 'prev' | 'center' | 'next') => {
        const item = items[index];
        if (!item) return null;

        const isCenter = position === 'center';
        const cardClass = [
            'carousel-card',
            `carousel-card--${position}`,
        ].join(' ');

        const borderStyle = item.accentColor && isCenter
            ? { borderColor: item.accentColor }
            : undefined;

        return (
            <div
                key={`${item.id}-${position}`}
                className={cardClass}
                style={borderStyle}
                onClick={() => {
                    if (isCenter) return;
                    navigate(position === 'prev' ? -1 : 1);
                }}
                onDoubleClick={() => {
                    if (isCenter) handleSelect();
                }}
                aria-label={item.label}
                role="group"
                aria-roledescription="slide"
            >
                {/* Preview area (e.g., tool icon grid) */}
                {item.preview && (
                    <div className="carousel-card-preview">
                        {item.preview}
                    </div>
                )}

                {/* Icon + label */}
                <div className="carousel-card-header">
                    {item.icon && (
                        <span className="carousel-card-icon">{item.icon}</span>
                    )}
                    <span className="carousel-card-label">{item.label}</span>
                </div>

                {/* Meta info (e.g., tool count) */}
                {item.meta && (
                    <span className="carousel-card-meta">{item.meta}</span>
                )}

                {/* Description — expandable on center, single-line on neighbors */}
                {item.description && isCenter && (
                    <CardDescription text={item.description} />
                )}
                {item.description && !isCenter && (
                    <p className="carousel-card-description carousel-card-description--neighbor">
                        {item.description}
                    </p>
                )}

                {/* Select button (center only) */}
                {isCenter && (
                    <button
                        className="carousel-card-select"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSelect();
                        }}
                    >
                        {selectLabel}
                    </button>
                )}
            </div>
        );
    };

    return (
        <div
            className={`carousel-overlay ${isVisible ? 'carousel-overlay--visible' : ''}`}
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-label="Carousel selector"
        >
            <div
                ref={containerRef}
                className="carousel-container"
                tabIndex={0}
                onKeyDown={handleKeyDown}
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                aria-roledescription="carousel"
            >
                <div className="carousel-track">
                    {count >= 2 && renderCard(prevIdx, 'prev')}
                    {renderCard(centerIdx, 'center')}
                    {count >= 2 && renderCard(nextIdx, 'next')}
                </div>

                {/* Pagination dots */}
                {count > 1 && (
                    <div className="carousel-dots" role="tablist" aria-label="Carousel pagination">
                        {items.map((item, i) => (
                            <button
                                key={item.id}
                                className={`carousel-dot ${i === focusedIndex ? 'carousel-dot--active' : ''}`}
                                onClick={() => {
                                    if (i !== focusedIndex && !isAnimating) {
                                        setIsAnimating(true);
                                        setFocusedIndex(i);
                                        setTimeout(() => setIsAnimating(false), 300);
                                    }
                                }}
                                role="tab"
                                aria-selected={i === focusedIndex}
                                aria-label={item.label}
                                tabIndex={-1}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
