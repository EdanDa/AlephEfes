import React, { Suspense, lazy, useState, useMemo, useEffect, useRef, useCallback, useDeferredValue, useTransition, useLayoutEffect, memo } from 'react';
import { Analytics } from '@vercel/analytics/react';
import VirtualizedList from './components/VirtualizedList';
import VirtualizedGroups from './components/VirtualizedGroups';
import ExportMenu from './components/ExportMenu';
import NetworkView from './components/NetworkView';
import PrimeColorPicker from './components/PrimeColorPicker';
import ResearchWorkspace, { InspectWord, useResearch } from './components/ResearchWorkspace';
import './workspace.css';
import './light-theme.css';
import { formatTextForClipboard, stripTrailingSpacesPerLine } from './utils/exportFormatting';
import { withCSVMetadata } from './utils/exportMetadata';
import { buildValueInsights } from './core/valueInsights';
import { shouldUseDitto } from './utils/valueDisplay';
import { matchesSearchQuery } from './core/searchQuery';
import {
    BASE_LETTER_VALUES,
    COLOR_PALETTE,
    DEFAULT_DR_ORDER,
    HEB_FINALS,
    LAYER_COLORS,
    PRIME_COLOR_HEX,
    availableLayers,
    buildLetterTable,
    forceHebrewInput,
    getLetterDetails,
    getGroupedWordValues,
    getWordValues,
    isValueVisible,
    isWordVisible,
    layersMatching,
    strongestLayer,
} from './core/analysisCore';
import {
    EN_TO_HE_LETTER_MAP,
    EN_TO_HE_PUNCT_LETTER_MAP,
    EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP,
    KEYBOARD_CODE_TO_HE_LETTER_MAP,
    normalizeSearchInput,
} from './core/searchInput';
import { AppProvider, useAppState, useAppCoreState, useAppDispatch, useAppFilters, useAppClipboard, useAppStats } from './state/appStore';
import { useHebrewInputSanitizer } from './hooks/useHebrewInputSanitizer';
import { buildWordConnectionIndex as buildVisibleWordConnectionIndex, getConnectionValues, getPinnedClusters } from './core/wordConnections';

const TanakhNavigator = lazy(() => import('./components/TanakhNavigator.jsx'));

// -----------------------------------------------------------------------------
// 1. Context Definitions
// -----------------------------------------------------------------------------
const EMPTY_SET = new Set();

// -----------------------------------------------------------------------------
// 2. Constants & Styles
// -----------------------------------------------------------------------------
const TEXT_SIZE_CLASSNAMES = Object.freeze({
    sm: 'text-base leading-6',
    md: 'text-lg leading-7',
    lg: 'text-xl leading-8',
});
const TEXT_SIZE_OPTIONS = Object.freeze([
    { value: 'sm', label: 'קטן' },
    { value: 'md', label: 'בינוני' },
    { value: 'lg', label: 'גדול' },
]);
const HEB_MARKS_RE = /[\u034F\u0591-\u05BD\u05BF-\u05C7\uFB1E]/g;
const INPUT_PUNCT_TO_SPACE_RE = /[^\u05D0-\u05EA\u05DA\u05DD\u05DF\u05E3\u05E5\n ]+/g;
const INPUT_HEBREW_JOINERS_RE = /([\u05D0-\u05EA\u05DA\u05DD\u05DF\u05E3\u05E5])["'׳״‘’“”]+(?=[\u05D0-\u05EA\u05DA\u05DD\u05DF\u05E3\u05E5])/g;
const INPUT_MULTI_SPACE_RE = / {2,}/g;
const ALEPH_ZERO_DR_ORDER = [0, ...DEFAULT_DR_ORDER];
const LARGE_INPUT_SANITIZE_THRESHOLD = 80_000;
const MIN_INPUT_ROWS = 4;
const MAX_INPUT_ROWS = 18;
const SAFE_BASE_LETTER_VALUES = typeof BASE_LETTER_VALUES !== 'undefined' ? BASE_LETTER_VALUES : {};

const GlobalStyles = () => (
    <style>{`
        html { overflow-y: scroll; }
        button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
            outline: 3px solid #2563eb;
            outline-offset: 3px;
        }
        .dark button:focus-visible, .dark a:focus-visible, .dark input:focus-visible, .dark select:focus-visible, .dark textarea:focus-visible {
            outline-color: #93c5fd;
        }
        button:disabled { cursor: not-allowed; }
        .app-analysis-results[inert] { pointer-events: none; }
        .app-word-card { font: inherit; color: inherit; }
        .app-frequency-table-row {
            appearance: none;
            font: inherit;
            color: inherit;
            background: transparent;
            border: 0;
            border-bottom: 1px solid #e5e7eb;
            padding: 0;
        }
        .dark .app-frequency-table-row { border-bottom-color: rgba(55, 65, 81, 0.5); }

        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #64748b; }
        .dark ::-webkit-scrollbar-track { background: #1f2937; }
        .dark ::-webkit-scrollbar-thumb { background: #4b5563; }
        .dark ::-webkit-scrollbar-thumb:hover { background: #6b7280; }
        body {
            -webkit-user-select: none;
            user-select: none;
        }
        input, textarea, .selectable, .selectable * {
            -webkit-user-select: text;
            user-select: text;
            cursor: auto;
        }
        input, textarea {
            direction: rtl;
            text-align: right;
        }

        .app-title {
            font-size: 3rem;
            line-height: 0.95;
        }
        .app-header {
            flex-wrap: wrap;
            gap: 1rem;
        }
        .app-header-actions {
            flex-wrap: wrap;
            max-width: 100%;
        }
        .app-header-actions,
        .app-input-toolbar,
        .app-legend-items {
            min-width: 0;
        }
        .app-network-canvas canvas {
            touch-action: none;
        }
        .app-canvas-tooltip {
            white-space: normal;
            overflow-wrap: anywhere;
        }
        @media (max-width: 1023px) {
            .app-results-header {
                display: grid;
                grid-template-columns: minmax(0, 1fr);
                gap: 0.75rem;
            }
            .app-results-header > * {
                min-width: 0;
                width: 100%;
            }
            .app-results-header > :empty {
                display: none;
            }
            .app-results-header > .app-results-title,
            .app-results-header > .app-results-heading {
                order: -2;
                padding-inline: 0;
            }
            .app-results-header > .app-export-toolbar,
            .app-results-header > :has(> .app-export-toolbar) {
                order: 1;
            }
            .app-export-toolbar {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 0.5rem;
                width: 100%;
            }
            .app-export-toolbar button {
                align-items: center;
                justify-content: center;
                min-height: 2.75rem;
                min-width: 0;
                padding: 0.5rem 0.25rem;
                white-space: nowrap;
            }
            .app-export-toolbar svg {
                flex-shrink: 0;
            }
            .app-segmented-control {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                width: 100%;
            }
            .app-segmented-control button {
                min-height: 2.75rem;
                min-width: 0;
                padding-inline: 0.5rem;
            }
        }
        .app-mobile-scroll-top {
            display: none;
        }
        @media (max-width: 640px), (max-width: 1023px) and (pointer: coarse) {
            html {
                overflow-y: auto;
            }
            body {
                overflow-x: hidden;
            }
            button,
            select,
            summary {
                touch-action: manipulation;
            }
            .app-shell {
                overflow-x: clip;
                padding: 0.75rem 0.625rem 1.5rem;
            }
            .app-shell.app-shell-has-nav {
                padding-bottom: calc(5.5rem + env(safe-area-inset-bottom));
            }

            .app-header {
                align-items: flex-start;
                flex-direction: column;
                gap: 0.875rem;
                margin-bottom: 1rem;
                text-align: right;
            }
            .app-header-copy {
                max-width: 100%;
            }
            .app-title {
                font-size: clamp(2.35rem, 12vw, 3.25rem);
                line-height: 0.95;
                overflow-wrap: anywhere;
                white-space: normal;
            }
            .app-subtitle {
                font-size: 1rem;
                line-height: 1.45;
                max-width: 100%;
            }
            .app-header-actions {
                align-self: stretch;
                display: grid;
                grid-template-columns: 1fr auto auto;
                gap: 0.5rem;
                width: 100%;
            }
            .app-legend {
                grid-column: 1 / -1;
                grid-row: 2;
                min-width: 0;
                position: static;
                width: 100%;
            }
            .app-value-table-action {
                grid-column: 2;
                grid-row: 1;
                justify-self: end;
            }
            .app-theme-toggle {
                grid-column: 3;
                grid-row: 1;
                justify-self: end;
            }
            .app-value-table-action > button,
            .app-theme-toggle {
                align-items: center;
                display: inline-flex;
                height: 2.75rem;
                justify-content: center;
                width: 2.75rem;
            }
            .app-legend-items {
                border-radius: 1rem;
                display: grid;
                font-size: 0.875rem;
                gap: 0.4rem;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                max-width: 100%;
                padding: 0.5rem;
                width: 100%;
            }
            .app-legend-items > .w-px {
                display: none;
            }
            .app-legend-items button {
                justify-content: center;
                min-height: 2.75rem;
                min-width: 0;
                padding: 0.45rem 0.5rem;
            }
            .app-card,
            .app-stats-panel,
            .app-results-card,
            .app-distribution-card {
                margin-bottom: 1rem;
                padding: 0.875rem;
            }
            .app-input-toolbar {
                display: grid;
                gap: 0.75rem;
                grid-template-columns: 1fr 1fr;
            }
            .app-mode-toggle {
                justify-self: start;
            }
            .app-mode-toggle button,
            .app-clear-control button,
            .app-text-size-control select {
                min-height: 2.75rem;
            }
            .app-text-size-control {
                grid-column: 1 / -1;
                justify-self: end;
            }
            .app-clear-control {
                grid-column: 2;
                grid-row: 1;
                justify-self: end;
            }
            .app-results-header {
                align-items: stretch;
                flex-direction: column;
                gap: 0.875rem;
            }
            .app-results-header > .flex-1,
            .app-results-header > .flex-none {
                flex: none;
                width: 100%;
            }
            .app-export-toolbar {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 0.5rem;
                width: 100%;
            }
            .app-export-toolbar button {
                justify-content: center;
                min-height: 2.75rem;
                padding: 0.45rem;
                white-space: normal;
            }
            .app-stats-grid > div {
                min-height: 5.5rem;
                padding: 0.75rem;
            }
            .app-stats-grid .text-3xl {
                font-size: 1.65rem;
            }
            .app-distribution-card .app-results-header {
                align-items: center;
            }
            .app-view-nav {
                position: fixed;
                inset-inline: 0;
                bottom: 0;
                margin: 0;
                padding: 0.45rem 0.5rem calc(0.45rem + env(safe-area-inset-bottom));
                top: auto;
            }
            .app-view-tabs {
                border-radius: 1.25rem;
                display: grid;
                grid-template-columns: repeat(5, minmax(0, 1fr));
                width: 100%;
            }
            .app-view-tabs-has-top {
                grid-template-columns: repeat(5, minmax(0, 1fr)) 2.75rem;
            }
            .app-mobile-scroll-top {
                align-items: center;
                display: inline-flex;
                justify-content: center;
                min-height: 2.75rem;
                width: 2.75rem;
            }
            .app-shell:has(.app-view-nav) .app-scroll-top {
                display: none;
            }
            .app-view-tab {
                flex-direction: column;
                font-size: 0.7rem;
                gap: 0.15rem;
                justify-content: center;
                min-width: 0;
                min-height: 3.2rem;
                padding: 0.4rem 0.15rem;
            }
            .app-view-tab svg {
                height: 1rem;
                width: 1rem;
            }
            .app-view-tab-label {
                line-height: 1.2;
                white-space: normal;
                max-width: 100%;
                overflow-wrap: anywhere;
            }
            .app-results-title {
                font-size: clamp(1.35rem, 6vw, 1.75rem);
                line-height: 1.25;
            }
            .app-value-table-card {
                padding: 0.875rem;
            }
            .app-value-table-title {
                font-size: 1.35rem;
                line-height: 1.25;
            }
            .app-value-tables {
                flex-direction: column;
                gap: 1rem;
            }
            .app-value-tables table {
                max-width: none;
                font-size: 0.95rem;
            }
            .app-value-tables th,
            .app-value-tables td {
                padding: 0.45rem;
            }
            .app-distribution-card .app-results-title {
                font-size: clamp(1.45rem, 6vw, 1.9rem);
            }
            .app-dr-row {
                display: grid;
                grid-template-columns: repeat(5, minmax(0, 1fr));
                gap: 0.25rem;
                height: auto;
                min-height: 0;
                padding-block: 0.5rem;
            }
            .app-dr-item {
                width: auto;
                min-width: 0;
                height: 4rem;
            }
            .app-dr-label {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 0.2rem;
                font-size: 0.95rem;
                line-height: 1.05;
                margin-top: 0.1rem;
            }
            .app-dr-prefix {
                font-size: 0.72rem;
                opacity: 0.75;
            }
            .app-dr-empty {
                color: #94a3b8;
                font-size: 1rem;
            }
            .app-frequency-table-header,
            .app-frequency-table-row {
                display: grid;
                grid-template-columns: 3.5rem 4rem minmax(0, 1fr);
                align-items: center;
                column-gap: 0.5rem;
            }
            .app-frequency-table-header > *,
            .app-frequency-table-row > * {
                min-width: 0;
                width: auto;
            }
            .app-frequency-table-header {
                font-size: 0.85rem;
                min-height: 2.75rem;
            }
            .app-frequency-table-row > * {
                padding-inline: 0.25rem;
            }
            .app-drilldown-header,
            .app-drilldown-actions {
                align-items: stretch;
                flex-direction: column;
            }
            .app-drilldown-actions > button {
                min-height: 2.75rem;
            }
            .app-network-canvas {
                height: clamp(14rem, 52svh, 30rem);
            }
            .app-value-canvas {
                height: clamp(14rem, 48svh, 25rem);
            }
            .app-canvas-toolbar button {
                min-height: 2.75rem;
                min-width: 2.75rem;
            }
            .app-value-summary {
                grid-template-columns: repeat(3, minmax(0, 1fr));
                font-size: 0.75rem;
            }
            .app-value-summary > div {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
                justify-content: center;
                min-width: 0;
                text-align: center;
            }
            .app-line-card th,
            .app-line-card td,
            .app-word-table th,
            .app-word-table td {
                padding: 0.65rem 0.5rem;
                font-size: 0.9rem;
            }
            .app-textarea {
                display: block;
                max-width: 100%;
                overflow-x: hidden;
                overflow-wrap: anywhere;
                padding: 0.875rem;
                white-space: pre-wrap;
            }
            .app-cluster-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .app-cluster-grid > * {
                min-width: 0;
            }
            .app-line-card {
                padding: 1rem;
            }
            .app-line-heading {
                font-size: 1.65rem;
            }
            .app-line-text {
                font-size: 1.1rem;
                margin-bottom: 1rem;
                overflow-wrap: anywhere;
            }
            .app-line-totals {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 0.5rem;
                padding: 0.75rem;
            }
            .app-line-totals-label {
                grid-column: 1 / -1;
            }
            .app-line-word-count {
                grid-column: 1 / -1;
                margin-inline: 0;
            }
            .app-line-total {
                margin-inline: 0;
                min-width: 0;
                white-space: nowrap;
            }
            .app-scroll-top {
                bottom: calc(5.25rem + env(safe-area-inset-bottom));
                right: 0.75rem;
                top: auto;
                transform: none;
            }
            .app-scroll-top button {
                padding: 0.625rem;
            }
            .tanakh-header,
            .tanakh-content {
                padding: 0.875rem;
            }
            .tanakh-header-row {
                align-items: stretch;
                flex-direction: column;
            }
            .tanakh-meta-actions {
                align-items: stretch;
                width: 100%;
            }
            .tanakh-download {
                min-height: 2.75rem;
                text-align: center;
            }
            .tanakh-division-tabs {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                width: 100%;
            }
            .tanakh-division-tabs button {
                min-height: 2.75rem;
                padding-inline: 0.5rem;
            }
            .tanakh-books {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .tanakh-books button {
                min-height: 2.75rem;
                min-width: 0;
            }
            .tanakh-workspace {
                gap: 0.875rem;
            }
            .tanakh-controls {
                padding: 0.75rem;
            }
            .tanakh-scope-tabs button {
                line-height: 1.2;
                min-height: 3rem;
                padding-inline: 0.25rem;
            }
            .tanakh-range-fields {
                grid-template-columns: 1fr;
            }
            .tanakh-preview {
                font-size: 1.05rem;
                line-height: 2;
                max-height: 18rem;
                padding: 0.875rem;
            }
            .tanakh-actions button {
                min-height: 3rem;
                width: 100%;
            }
        }
    `}</style>
);

// -----------------------------------------------------------------------------
// 3. Logic Helpers
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// 4. Initial State & Reducer
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// 5. Basic UI Components
// -----------------------------------------------------------------------------
const Icon = React.memo(({ name, className }) => {
    switch (name) {
        case 'sun': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>;
        case 'moon': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>;
        case 'hash': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>;
        case 'github': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.59 2 12.253c0 4.53 2.865 8.373 6.839 9.729.5.095.682-.222.682-.493 0-.243-.009-.888-.014-1.743-2.782.62-3.369-1.374-3.369-1.374-.455-1.185-1.11-1.5-1.11-1.5-.908-.636.069-.623.069-.623 1.004.073 1.532 1.057 1.532 1.057.892 1.568 2.341 1.115 2.91.853.091-.664.349-1.116.635-1.372-2.221-.259-4.555-1.139-4.555-5.065 0-1.119.389-2.034 1.029-2.751-.103-.26-.446-1.303.098-2.717 0 0 .84-.276 2.75 1.051A9.303 9.303 0 0 1 12 7.98a9.31 9.31 0 0 1 2.504.345c1.909-1.327 2.748-1.051 2.748-1.051.546 1.414.203 2.457.1 2.717.641.717 1.027 1.632 1.027 2.751 0 3.936-2.338 4.803-4.566 5.057.359.318.679.946.679 1.907 0 1.376-.012 2.486-.012 2.824 0 .274.18.593.688.492C19.138 20.622 22 16.782 22 12.253 22 6.59 17.523 2 12 2Z"/></svg>;
        case 'copy': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>;
        case 'check': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
        case 'grid': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>;
        case 'network': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/></svg>;
        case 'chevron-down': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
        case 'bar-chart': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'scaleX(-1)' }}><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>;
        case 'arrow-up': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>;
        case 'activity': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>;
        case 'share-2': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>;
        case 'download': return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>;
        default: return null;
    }
});

const Legend = React.memo(() => {
    const { primeColor, filters } = useAppFilters();
    const dispatch = useAppDispatch();
    const [, startTransition] = useTransition();
    const colorPicker = useRef(null);
    const legend = useRef(null);
    const toggleFilter = (filterKey) => {
        startTransition(() => {
            dispatch({ type: 'TOGGLE_FILTER', payload: filterKey });
        });
    };

    const primeColorClasses = COLOR_PALETTE[primeColor];
    const getFilterStyle = (key, activeClass, inactiveClass, baseClass = "") => {
        const isActive = filters[key];
        return `cursor-pointer transition-all duration-200 rounded-full px-2 py-0.5 select-none ${isActive ? activeClass : inactiveClass} ${baseClass}`;
    };

    return (
        <>
        <PrimeColorPicker ref={colorPicker} anchor={legend} color={primeColor} onChange={(color) => dispatch({ type: 'SET_PRIME_COLOR', payload: color })} />
        <div ref={legend} data-prime-color={primeColor} className="app-legend relative" onMouseEnter={() => colorPicker.current?.show()} onMouseLeave={() => colorPicker.current?.leave()} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); colorPicker.current?.show(true); } }}>
            <div className="app-legend-items flex items-center gap-2 text-base text-slate-700 dark:text-gray-300 bg-slate-100/70 dark:bg-gray-700/50 px-3 py-1.5 rounded-full noselect">
                 <button
                    aria-pressed={filters.Prime}
                    aria-description="חץ למטה לבחירת צבע הראשוניים"
                    onClick={() => toggleFilter('Prime')}
                    className={getFilterStyle(
                        'Prime',
                        'bg-violet-100 text-violet-900 dark:bg-violet-400/25 dark:text-violet-50',
                        'bg-slate-300/35 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400',
                        'flex items-center gap-2'
                    )}
                 >
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${filters['Prime'] ? 'bg-violet-100 dark:bg-violet-500/25' : 'bg-white dark:bg-slate-700/70'} ${primeColorClasses.light} ${primeColorClasses.dark} text-sm font-bold`}>♢</span>
                    <span className={filters['Prime'] ? `font-semibold ${primeColorClasses.light} ${primeColorClasses.dark}` : ''}>ראשוני</span>
                 </button>
                 <div className="w-px h-4 bg-gray-400 mx-1"></div>
                 <button
                    aria-pressed={filters.U}
                    onClick={() => toggleFilter('U')}
                    className={getFilterStyle(
                        'U',
                        'bg-sky-100 text-sky-900 dark:bg-sky-500/25 dark:text-sky-50',
                        'bg-slate-300/35 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400',
                        'flex items-center gap-2'
                    )}
                 >
                    <div className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${filters['U'] ? 'text-sky-800 dark:bg-sky-500/20 dark:text-sky-200' : 'text-slate-500 dark:bg-slate-700/70 dark:text-sky-500'}`}>
                        <svg width="14" height="12" viewBox="0 0 14 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3"><path d="M7 1L1 11H13L7 1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
                    </div>
                    <span className={filters['U'] ? "font-semibold text-sky-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}>יחידות</span>
                 </button>
                 <button
                    aria-pressed={filters.T}
                    onClick={() => toggleFilter('T')}
                    className={getFilterStyle(
                        'T',
                        'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/25 dark:text-emerald-50',
                        'bg-slate-300/35 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400',
                        'flex items-center gap-2'
                    )}
                 >
                    <div className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${filters['T'] ? 'text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200' : 'text-slate-500 dark:bg-slate-700/70 dark:text-emerald-500'}`}>
                        <div className="w-3 h-3 border-2 border-current"></div>
                    </div>
                    <span className={filters['T'] ? "font-semibold text-emerald-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}>עשרות</span>
                 </button>
                 <button
                    aria-pressed={filters.H}
                    onClick={() => toggleFilter('H')}
                    className={getFilterStyle(
                        'H',
                        'bg-purple-100 text-purple-900 dark:bg-purple-500/25 dark:text-purple-50',
                        'bg-slate-300/35 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400',
                        'flex items-center gap-2'
                    )}
                 >
                    <div className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${filters['H'] ? 'text-purple-800 dark:bg-purple-500/20 dark:text-purple-200' : 'text-slate-500 dark:bg-slate-700/70 dark:text-purple-500'}`}>
                        <div className="w-3 h-3 rounded-full border-2 border-current"></div>
                    </div>
                    <span className={filters['H'] ? "font-semibold text-purple-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}>מאות</span>
                 </button>
            </div>
        </div>
        </>
    );
});

const ValueCell = memo(({ value, isPrimeFlag, previousValue, previousLayer, previousIsPrimeFlag, layer, isApplicable = true, primeColor, filters }) => {
    const isVisible = isValueVisible(layer, isPrimeFlag, filters);
    const primeColorClasses = COLOR_PALETTE[primeColor];
    // .selectable ensures numbers can be copied
    const className = `px-4 py-3 text-center tabular-nums selectable cursor-default ${isPrimeFlag ? `${primeColorClasses.light} ${primeColorClasses.dark}` : 'text-slate-700 dark:text-gray-300'}`;
    
    if (!isApplicable) return <td className={className}>-</td>;
    if (!isVisible) return <td className={className}></td>;

    const previousVisible = previousLayer ? isValueVisible(previousLayer, previousIsPrimeFlag, filters) : false;
    if (shouldUseDitto(value, previousValue, previousVisible)) return <td className={className}>〃</td>;
    return <td className={className}>{value} {isPrimeFlag && <span className="mr-1" title="ראשוני">♢</span>}</td>;
});

const TotalNumberDisplay = memo(({ value, isPrimeFlag, primeColor, layer, filters }) => {
    const isVisible = isValueVisible(layer, isPrimeFlag, filters);
    const primeColorClasses = COLOR_PALETTE[primeColor];
    
    if (!isVisible) {
         return <p className="text-3xl font-bold text-gray-500 dark:text-gray-500 noselect">-</p>;
    }
    // .selectable
    return <p className={`text-3xl font-bold selectable cursor-default ${isPrimeFlag ? `${primeColorClasses.light} ${primeColorClasses.dark}` : 'text-gray-800 dark:text-gray-200'}`}>{value} {isPrimeFlag && <span className="mr-2 text-xl">♢</span>}</p>;
});

const WordValuesDisplay = memo(({ wordData, isDarkMode, matches, connectionValues, hoveredWord, primeColor, filters }) => {
    const primeColorClasses = COLOR_PALETTE[primeColor];
    const groupedValues = getGroupedWordValues(wordData, filters);
    const connectionValueSet = connectionValues || EMPTY_SET;

    const getSourceLayer = (src, val) => {
        const avail = availableLayers(src);
        // Priority H > T > U to determine dominant color if value exists in multiple source layers.
        if (avail.includes('H') && src.hundreds === val) return 'H';
        if (avail.includes('T') && src.tens === val) return 'T';
        if (avail.includes('U') && src.units === val) return 'U';
        return null;
    };

    const renderLayerSymbol = (layer, iconStroke, iconFill) => {
        if (layer === 'U') return <svg width="14" height="12" viewBox="0 0 14 12" fill={iconFill} xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3"><path d="M7 1L1 11H13L7 1Z" stroke={iconStroke} strokeWidth="2" strokeLinejoin="round"/></svg>;
        if (layer === 'T') return <div className="w-3 h-3 border-2" style={{ borderColor: iconStroke, background: iconFill }}></div>;
        return <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: iconStroke, background: iconFill }}></div>;
    };

    return (
        <div className={`grid grid-flow-col auto-cols-max gap-x-2 text-xs font-mono tracking-wider justify-center ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
            {groupedValues.map((group) => (
                <div key={group.value} className="flex flex-col items-center noselect">
                    <span className={group.isPrime ? `${primeColorClasses.light} ${primeColorClasses.dark}` : ''}>{group.value}{group.isPrime && '♢'}</span>
                    <div className="mt-0.5 flex items-center justify-center gap-1 min-h-3">
                        {group.layers.map(({ layer }) => {
                            // 'matches' contains layers from the TARGET word that match the ACTIVE word.
                            const isHit = hoveredWord && connectionValueSet.has(group.value) && matches.includes(layer);
                            const srcLayer = isHit ? getSourceLayer(hoveredWord, group.value) : null;
                            const dotColor = srcLayer ? LAYER_COLORS[srcLayer].dot : null;
                            // Restored layer-colored icons logic for connections.
                            const iconStroke = dotColor || (isDarkMode ? '#ffffff60' : '#00000040');
                            const iconFill = dotColor || 'transparent';

                            return (
                                <div key={layer} className="flex items-center justify-center h-3 w-3.5">
                                    {renderLayerSymbol(layer, iconStroke, iconFill)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
});

const ExportToolbar = ({ getText, getCSV, getJSON, id, label = "העתק", researchSelection }) => {
    const { openNote } = useResearch();
    const { copiedId } = useAppClipboard();
    const { mode, filters, corpusSelection, isAnalysisStale } = useAppState();
    const metadata = { mode, filters, corpusSelection };
    const dispatch = useAppDispatch();
    const [isCopying, setIsCopying] = useState(false);

    const handleCopy = async () => {
        if (isAnalysisStale) return;
        setIsCopying(true);
        await new Promise(resolve => setTimeout(resolve, 10)); 

        try {
            const activeLayers = ['U', 'T', 'H'].filter((layer) => filters[layer]).join('/');
            const text = formatTextForClipboard(`מצב: ${mode === 'aleph-zero' ? 'א=0' : 'א=1'} · שכבות: ${activeLayers || 'ללא'} · ראשוניים בלבד: ${filters.Prime ? 'כן' : 'לא'}\n${getText()}`);
            if (!text || text.trim().length === 0) throw new Error("No visible text generated based on current filters");
            
            let success = false;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try { 
                    await navigator.clipboard.writeText(text); 
                    success = true; 
                } catch (err) { console.warn("Clipboard API failed", err); }
            }

            if (!success) {
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.setAttribute("readonly", "");
                Object.assign(ta.style, { position: "fixed", top: "0", left: "0", opacity: "0", width: "1px", height: "1px" });
                document.body.appendChild(ta);
                try {
                    ta.focus({ preventScroll: true });
                    ta.select();
                    success = document.execCommand("copy");
                } finally { ta.remove(); }
            }

            if (success) {
                dispatch({ type: 'SET_COPIED_ID', payload: id });
                setTimeout(() => dispatch({ type: 'SET_COPIED_ID', payload: null }), 2000);
            }
            else throw new Error('Clipboard unavailable');
        } catch (e) {
            console.error("Copy failed", e);
            alert("שגיאה בהעתקה (או שלא נבחרו נתונים להצגה)");
        } finally { setIsCopying(false); }
    };


    const handleJSON = () => {
        if (isAnalysisStale) return;
        try {
            const raw = getJSON ? getJSON() : '';
            if (!raw) return;
            const content = JSON.stringify({ ...JSON.parse(raw), metadata }, null, 2);
            const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `aleph-code-${id}-${new Date().toISOString().slice(0,10)}.json`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch(e) { console.error("JSON Export failed", e); }
    };

    const handleCSV = () => {
        if (isAnalysisStale) return;
        try {
            const content = withCSVMetadata(stripTrailingSpacesPerLine(getCSV()), metadata);
            if (!content) return;
            // Add BOM for Excel Hebrew support
            const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `aleph-code-${id}-${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch(e) { console.error("CSV Export failed", e); }
    };

    return (
        <ExportMenu disabled={isAnalysisStale}>
            <button disabled={isAnalysisStale} onClick={() => openNote(researchSelection)}>הערת מחקר</button>
            <button 
                onClick={handleCopy} 
                disabled={isCopying || isAnalysisStale}
                className={`bg-gray-200 dark:bg-gray-700/50 text-slate-600 dark:text-gray-300 px-3 py-1 rounded-md text-sm hover:bg-slate-300 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 noselect ${isCopying ? 'opacity-50 cursor-wait' : ''}`}
            >
                {copiedId === id ? <Icon name="check" className="w-4 h-4" /> : <Icon name="copy" className="w-4 h-4" />}
                {isCopying ? "מעתיק..." : label}
            </button>
            <button 
                onClick={handleCSV}
                disabled={isAnalysisStale}
                className="bg-gray-200 dark:bg-gray-700/50 text-slate-600 dark:text-gray-300 px-3 py-1 rounded-md text-sm hover:bg-slate-300 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 noselect"
            >
                <Icon name="download" className="w-4 h-4" />
                ייצא CSV
            </button>
            <button 
                onClick={handleJSON}
                disabled={isAnalysisStale}
                className="bg-gray-200 dark:bg-gray-700/50 text-slate-600 dark:text-gray-300 px-3 py-1 rounded-md text-sm hover:bg-slate-300 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 noselect"
            >
                <Icon name="download" className="w-4 h-4" />
                ייצא JSON
            </button>
        </ExportMenu>
    );
};

const StatsPanel = memo(() => {
    const { stats, isStatsCollapsed, isDarkMode, connectionValues, corpusSelection } = useAppStats();
    const dispatch = useAppDispatch();
    if (!stats) return null;

    const isSectionSelection = Boolean(corpusSelection && corpusSelection.sectionCount === stats.totalLines);
    const unitName = isSectionSelection ? 'פרשיות' : 'שורות';
    const uniqueShare = stats.totalWords > 0 ? ((stats.uniqueWords / stats.totalWords) * 100).toFixed(1) : '0.0';
    const averageWords = stats.totalLines > 0 ? (stats.totalWords / stats.totalLines).toFixed(1) : '0.0';
    const summaryItems = [
        { label: unitName, value: stats.totalLines, title: `מספר ה${unitName} בטקסט המחושב` },
        { label: 'מילים', value: stats.totalWords, title: 'מספר כל מופעי המילים בטקסט' },
        { label: 'מילים ייחודיות', value: stats.uniqueWords, secondary: `${uniqueShare}% מן המופעים`, title: 'מספר צורות המילה השונות ושיעורן מכלל המופעים' },
        { label: `מילים ל${isSectionSelection ? 'פרשיה' : 'שורה'}`, value: averageWords, title: `הממוצע האריתמטי של מספר המילים בכל ${isSectionSelection ? 'פרשיה' : 'שורה'}` },
        { label: `${unitName} עם סכום ראשוני`, value: stats.primeLineTotals, title: `מספר ה${unitName} שבהן לפחות אחד מסכומי היחידות, העשרות או המאות הוא מספר ראשוני` },
        { label: 'ערכים מקשרים', value: connectionValues.size, title: 'ערכים מספריים המופיעים ביותר ממילה ייחודית אחת בשכבות המוצגות' },
    ];

    return (
        <div className={`app-stats-panel p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
            <button aria-expanded={!isStatsCollapsed} onClick={() => dispatch({ type: 'TOGGLE_STATS_COLLAPSED' })} className="app-stats-toggle w-full flex justify-between items-center text-2xl font-bold text-gray-800 dark:text-gray-200 noselect">
                <div className="flex-1"></div>
                <span className="text-center flex-grow">תקציר הטקסט</span>
                <div className="flex-1 flex justify-end"><Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isStatsCollapsed ? '' : 'rotate-180'}`} /></div>
            </button>
            {!isStatsCollapsed && (
                <div className="app-stats-grid grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 text-center mt-6">
                    {summaryItems.map(item => (
                        <div key={item.label} title={item.title} className="min-h-28 p-4 rounded-lg bg-slate-200 dark:bg-gray-700/50 noselect cursor-help flex flex-col justify-center">
                            <p className="app-stat-label text-sm text-gray-700 dark:text-gray-300 font-semibold">{item.label}</p>
                            <p className="app-stat-value text-3xl font-bold text-slate-900 dark:text-gray-100">{item.value}</p>
                            {item.secondary && <p className="app-stat-secondary mt-1 text-xs text-gray-600 dark:text-gray-400">{item.secondary}</p>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

const WordCard = memo(({ wordData, activeWord, activeWordKey, isConnectedToActive, isDarkMode, primeColor, connectionValues = EMPTY_SET, dispatch, filters, pinnedWord, isAnalysisStale }) => {
    const isSelf = activeWord && activeWord.word === wordData.word;
    
    // Background color determination (for connected words)
    let topLayer = null;
    if (activeWord && !isSelf && isConnectedToActive) {
        // Find the highest layer in activeWord that connects to a VISIBLE layer in wordData.
        // This ensures hidden layers don't trigger background colors.
        const sourceLayers = [];
        
        const isValueVisibleInTarget = (val) => {
             if (wordData.units === val && isValueVisible('U', wordData.isPrimeU, filters)) return true;
             if (wordData.tens === val && isValueVisible('T', wordData.isPrimeT, filters)) return true;
             if (wordData.hundreds === val && isValueVisible('H', wordData.isPrimeH, filters)) return true;
             return false;
        };

        const availSrc = availableLayers(activeWord);
        
        // Check Source H
        if (availSrc.includes('H') && isValueVisible('H', activeWord.isPrimeH, filters)) {
            if (isValueVisibleInTarget(activeWord.hundreds)) sourceLayers.push('H');
        }
        // Check Source T
        if (availSrc.includes('T') && isValueVisible('T', activeWord.isPrimeT, filters)) {
            if (isValueVisibleInTarget(activeWord.tens)) sourceLayers.push('T');
        }
        // Check Source U
        if (availSrc.includes('U') && isValueVisible('U', activeWord.isPrimeU, filters)) {
            if (isValueVisibleInTarget(activeWord.units)) sourceLayers.push('U');
        }

        topLayer = strongestLayer(sourceLayers);
    }
    
    // matches is used to determine WHICH icon to light up (target perspective)
    const matches = (activeWord && (isSelf || isConnectedToActive)) ? layersMatching(activeWord, wordData).filter(L => availableLayers(wordData).includes(L)) : [];
    
    // Reverted to pastel background logic
    const baseBg = isDarkMode ? 'rgba(255,255,255,0.08)' : '#f4f6f9';
    const tint = !isSelf && topLayer ? (isDarkMode ? LAYER_COLORS[topLayer].dark : LAYER_COLORS[topLayer].light) : baseBg;
    
    // Border color logic (for Self)
    let borderColor = 'transparent';
    if (isSelf) {
        const values = getWordValues(wordData);
        const connectedVisibleLayers = values
            .filter(v => isValueVisible(v.layer, v.isPrime, filters) && connectionValues.has(v.value))
            .map(v => v.layer);
        
        const bestLayer = strongestLayer(connectedVisibleLayers);
        if (bestLayer) {
            borderColor = LAYER_COLORS[bestLayer].dot;
        } else {
             borderColor = isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
        }
    }

    const cardStyle = {
        background: tint,
        opacity: !isDarkMode && !activeWord || isSelf || isConnectedToActive ? 1 : 0.75,
        border: `2px solid ${borderColor}`,
        cursor: 'pointer',
    };

    const handleClick = (e) => {
        e.stopPropagation();
        dispatch({ type: 'SET_PINNED_WORD', payload: wordData });
    };

    const handleMouseEnter = () => dispatch({ type: 'SET_HOVERED_WORD', payload: wordData });
    const handleMouseLeave = () => dispatch({ type: 'SET_HOVERED_WORD', payload: null });

    return (
        <div className="research-word-card">
        <button
            type="button"
            disabled={isAnalysisStale}
            aria-pressed={Boolean(isSelf && pinnedWord)}
            aria-label={`נעץ מילה ${wordData.word}`}
            className="app-word-card p-2 rounded-lg text-center transition-all duration-200 noselect"
            style={cardStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
        >
            <div className={`research-word-title font-bold text-xl ${isDarkMode ? 'text-gray-100' : 'text-slate-900'}`}>{wordData.word}</div>
            <WordValuesDisplay wordData={wordData} isDarkMode={isDarkMode} matches={matches} connectionValues={connectionValues} hoveredWord={activeWord} primeColor={primeColor} filters={filters}/>
        </button>
        <InspectWord word={wordData.word} compact />
        </div>
    );
}, (prev, next) => {
    if (prev.wordData !== next.wordData) return false;
    if (prev.isAnalysisStale !== next.isAnalysisStale) return false;
    if (prev.pinnedWord !== next.pinnedWord) return false;
    if (prev.isDarkMode !== next.isDarkMode) return false;
    if (prev.primeColor !== next.primeColor) return false;
    if (prev.filters !== next.filters) return false;
    if (prev.connectionValues !== next.connectionValues) return false;
    if (prev.activeWordKey !== next.activeWordKey) {
        const wasAffected = prev.isConnectedToActive || (prev.wordData.word === prev.activeWordKey);
        const isAffected = next.isConnectedToActive || (next.wordData.word === next.activeWordKey);
        return !wasAffected && !isAffected;
    }
    if (prev.isConnectedToActive !== next.isConnectedToActive) return false;
    return true;
});

const computeConnectedWordsSet = (activeWord, wordsByVisibleValue = new Map(), visibleValuesByWord = new Map(), cacheRef) => {
    if (!activeWord) return new Set();

    const cache = cacheRef?.current;
    const cached = cache?.get(activeWord.word);
    if (cached) return cached;

    const connected = new Set();
    const activeValues = visibleValuesByWord.get(activeWord.word) || [];
    activeValues.forEach((value) => {
        const hitList = wordsByVisibleValue.get(value);
        if (!hitList) return;
        hitList.forEach((word) => {
            if (word !== activeWord.word) connected.add(word);
        });
    });

    cache?.set(activeWord.word, connected);
    return connected;
};

const ClusterView = memo(({ clusterRefs, unpinOnBackgroundClick, filteredWordsInView, pinnedWord, hoveredWord, isDarkMode, primeColor, dispatch, copySummaryToClipboard, prepareSummaryCSV, prepareSummaryJSON, copiedId, searchTerm, isAnalysisStale }) => {
    const { filters } = useAppFilters();
    const searchInputRef = useRef(null);
    const deferredHoveredWord = useDeferredValue(hoveredWord);
    const activeWord = pinnedWord || deferredHoveredWord;
    const activeWordKey = activeWord?.word || null;

    const connectedWordsCacheRef = useRef(new Map());
    const scopedWords = useMemo(
        () => filteredWordsInView.flatMap(({ words }) => words),
        [filteredWordsInView]
    );
    const scopedConnectionValues = useMemo(
        () => getConnectionValues(scopedWords, filters),
        [scopedWords, filters]
    );
    useEffect(() => {
        connectedWordsCacheRef.current.clear();
    }, [filteredWordsInView, filters]);

    const connectedWordsSet = useMemo(() => {
        if (!activeWord) return new Set();

        const cached = connectedWordsCacheRef.current.get(activeWord.word);
        if (cached) return cached;

        const wordsByVisibleValue = new Map();
        const visibleValuesByWord = new Map();

        filteredWordsInView.forEach(({ words }) => {
            words.forEach((wordData) => {
                const visibleValues = getWordValues(wordData)
                    .filter((v) => isValueVisible(v.layer, v.isPrime, filters))
                    .map((v) => v.value);

                visibleValuesByWord.set(wordData.word, visibleValues);

                visibleValues.forEach((value) => {
                    if (!wordsByVisibleValue.has(value)) wordsByVisibleValue.set(value, []);
                    wordsByVisibleValue.get(value).push(wordData.word);
                });
            });
        });

        const connected = new Set();
        const activeValues = visibleValuesByWord.get(activeWord.word) || [];
        activeValues.forEach((value) => {
            const hitList = wordsByVisibleValue.get(value);
            if (!hitList) return;
            hitList.forEach((word) => {
                if (word !== activeWord.word) connected.add(word);
            });
        });

        connectedWordsCacheRef.current.set(activeWord.word, connected);
        return connected;
    }, [activeWord, filteredWordsInView, filters]);

    const handleSearchChange = useCallback((e) => {
        dispatch({ type: 'SET_SEARCH_TERM', payload: normalizeSearchInput(e.target.value) });
    }, [dispatch]);


    
    return (
        <div className={`app-results-card p-4 sm:p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`} onClick={unpinOnBackgroundClick}>
            <div className="app-results-header flex justify-between items-center mb-4">
                <div className="flex-1 flex justify-start">
                    <ExportToolbar getText={copySummaryToClipboard} getCSV={prepareSummaryCSV} getJSON={prepareSummaryJSON} id='summary' />
                </div>
                <div className="app-results-heading relative group text-center flex-grow">
                    <h2 className="app-results-title text-2xl font-bold inline-block noselect">קבוצות לפי שורש דיגיטלי</h2>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none noselect">
                        שורש דיגיטלי של מספר הוא הספרה הבודדת שמתקבלת כשמחברים שוב ושוב את ספרותיו עד שנותרת ספרה אחת.
                    </div>
                </div>
                 <div className="flex-1"></div>
            </div>
            <div className="mb-4">
                <input dir="rtl" type="text" placeholder="חפש מילה, מספר או צירוף כמו 20+11..." value={searchTerm} onChange={handleSearchChange} className={`w-full p-2 border rounded-md text-right ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'border-slate-300'}`} />
            </div>
            <VirtualizedGroups groups={filteredWordsInView} clusterRefs={clusterRefs} renderWord={(wordData) => (
                <WordCard key={wordData.word} wordData={wordData} isAnalysisStale={isAnalysisStale} pinnedWord={pinnedWord} activeWord={activeWord} activeWordKey={activeWordKey} isConnectedToActive={connectedWordsSet.has(wordData.word)} isDarkMode={isDarkMode} primeColor={primeColor} connectionValues={scopedConnectionValues} dispatch={dispatch} filters={filters} />
            )} />
        </div>
    );
});

const canvasTooltipStyle = (point, container) => {
    const width = Math.min(260, (container?.clientWidth || 276) - 16);
    return {
        width,
        left: Math.max(8, Math.min(point.px - width / 2, (container?.clientWidth || 276) - width - 8)),
        top: Math.max(8, Math.min(point.py + 12, (container?.clientHeight || 320) - 160)),
    };
};

const GraphView = memo(({ coreResults, filters, isDarkMode, primeColor, onWordClick, selectedDR }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const spatialRef = useRef({ cellSize: 24, grid: new Map() });
    const [hoverInfo, setHoverInfo] = useState(null);
    const [selectedValue, setSelectedValue] = useState(null);
    const [wordPage, setWordPage] = useState(0);

    const valueInsights = useMemo(() => buildValueInsights(coreResults, filters, selectedDR), [coreResults, filters, selectedDR]);

    const selectedInsight = useMemo(
        () => valueInsights.find((insight) => insight.value === selectedValue) || null,
        [valueInsights, selectedValue],
    );

    const preparedRows = useMemo(() => valueInsights.map((item, idx) => ({ ...item, rank: idx + 1 })), [valueInsights]);
    const selectedWords = useMemo(() => selectedValue === null ? [] : coreResults.allWords.flatMap((word) => {
        if (selectedDR !== null && word.dr !== selectedDR) return [];
        const layers = getWordValues(word).filter((entry) => entry.value === selectedValue && isValueVisible(entry.layer, entry.isPrime, filters)).map((entry) => entry.layer);
        return layers.length ? [{ word: word.word, layers, occurrences: coreResults.wordCounts.get(word.word) || 0 }] : [];
    }).sort((a, b) => b.occurrences - a.occurrences || a.word.localeCompare(b.word, 'he')), [coreResults, filters, selectedDR, selectedValue]);
    useEffect(() => setWordPage(0), [selectedValue, filters, selectedDR]);
    const graphSummary = useMemo(() => {
        if (!valueInsights.length) {
            return { valueCount: 0, primeValues: 0, totalBridgeScore: 0, highlights: [] };
        }

        return {
            valueCount: valueInsights.length,
            primeValues: valueInsights.filter((item) => item.isPrime).length,
            totalBridgeScore: valueInsights.reduce((sum, item) => sum + item.bridgeScore, 0),
            highlights: valueInsights.slice(0, 5),
        };
    }, [valueInsights]);

    const prepareInsightText = useCallback(() => {
        if (!preparedRows.length) return 'אין נתונים להצגה.';

        const lines = [
            'גרף מרוכזת – ערכי מפתח לפי גישור בין שכבות',
            'דרוג | ערך | שכבות | מילים ייחודיות | מופעים בטקסט | מופעים/מילה | ציון גישור',
        ];

        preparedRows.forEach((row) => {
            lines.push(`${row.rank} | ${row.value}${row.isPrime ? '♢' : ''} | ${row.layers.join('/')} | ${row.uniqueWordCount} | ${row.totalOccurrences} | ${row.avgOccurrences.toFixed(2)} | ${row.bridgeScore}`);
        });

        if (selectedInsight) {
            lines.push('');
            lines.push(`פירוט ערך נבחר: ${selectedInsight.value}${selectedInsight.isPrime ? '♢' : ''}`);
            selectedInsight.topWords.forEach((entry) => {
                lines.push(`- ${entry.word} (${entry.layers.join('/')}) ×${entry.occurrences}`);
            });
        }

        return lines.join('\n');
    }, [preparedRows, selectedInsight]);

    const prepareInsightCSV = useCallback(() => {
        if (!preparedRows.length) return 'rank,value,is_prime,layers,layer_count,unique_words,total_occurrences,avg_occurrences_per_word,bridge_score';

        const rows = ['rank,value,is_prime,layers,layer_count,unique_words,total_occurrences,avg_occurrences_per_word,bridge_score'];
        preparedRows.forEach((row) => {
            rows.push([
                row.rank,
                row.value,
                row.isPrime ? 1 : 0,
                `"${row.layers.join('/') }"`,
                row.layerCount,
                row.uniqueWordCount,
                row.totalOccurrences,
                row.avgOccurrences.toFixed(3),
                row.bridgeScore,
            ].join(','));
        });

        if (selectedInsight) {
            rows.push('');
            rows.push('selected_value,word,layer,occurrences');
            selectedInsight.topWords.forEach((entry) => {
                rows.push([selectedInsight.value, `"${entry.word}"`, entry.layers.join('/'), entry.occurrences].join(','));
            });
        }

        return rows.join('\n');
    }, [preparedRows, selectedInsight]);

    const prepareInsightJSON = useCallback(() => JSON.stringify({
        summary: graphSummary,
        rows: preparedRows,
        selectedInsight,
    }, null, 2), [graphSummary, preparedRows, selectedInsight]);

    useEffect(() => {
        if (selectedValue !== null && !valueInsights.some((insight) => insight.value === selectedValue)) {
            setSelectedValue(null);
        }
    }, [selectedValue, valueInsights]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        const padding = { top: 20, right: 24, bottom: 40, left: 52 };
        const cellSize = 28;

        const render = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            const dpr = window.devicePixelRatio || 1;

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);

            ctx.clearRect(0, 0, width, height);
            if (!valueInsights.length) { spatialRef.current = { cellSize, grid: new Map() }; return; }

            const graphWidth = width - padding.left - padding.right;
            const graphHeight = height - padding.top - padding.bottom;
            const maxX = Math.max(...valueInsights.map((v) => v.totalOccurrences), 1);
            const maxY = Math.max(...valueInsights.map((v) => v.uniqueWordCount), 1);

            const scaleX = (x) => padding.left + (x / maxX) * graphWidth;
            const scaleY = (y) => height - padding.bottom - (y / maxY) * graphHeight;

            ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';
            ctx.fillStyle = isDarkMode ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)';
            ctx.font = '10px sans-serif';
            ctx.lineWidth = 1;

            for (let i = 0; i <= 5; i += 1) {
                const yValue = Math.round((maxY / 5) * i);
                const y = scaleY(yValue);
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(width - padding.right, y);
                ctx.stroke();
                ctx.fillText(String(yValue), 8, y + 3);
                const xValue = Math.round((maxX / 5) * i);
                const x = scaleX(xValue);
                ctx.beginPath(); ctx.moveTo(x, padding.top); ctx.lineTo(x, height - padding.bottom); ctx.stroke();
                ctx.fillText(String(xValue), x - 6, height - padding.bottom + 16);
            }

            ctx.save();
            ctx.translate(15, height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText('מילים ייחודיות לערך', 0, 0);
            ctx.restore();
            ctx.fillText('מופעים בטקסט', width / 2 - 30, height - 10);

            const grid = new Map();

            valueInsights.forEach((item) => {
                const px = scaleX(item.totalOccurrences);
                const py = scaleY(item.uniqueWordCount);
                const gx = Math.floor(px / cellSize);
                const gy = Math.floor(py / cellSize);
                const gridKey = `${gx}:${gy}`;
                if (!grid.has(gridKey)) grid.set(gridKey, []);

                const radius = 4 + item.layerCount * 2;
                const color = item.layerCount === 3
                    ? (isDarkMode ? '#c084fc' : '#7c3aed')
                    : item.layerCount === 2
                        ? (isDarkMode ? '#34d399' : '#059669')
                        : (isDarkMode ? '#60a5fa' : '#2563eb');

                ctx.beginPath();
                ctx.fillStyle = color;
                ctx.globalAlpha = selectedValue !== null && selectedValue !== item.value ? 0.2 : 0.82;
                ctx.arc(px, py, radius, 0, Math.PI * 2);
                ctx.fill();

                if (item.isPrime) {
                    ctx.strokeStyle = isDarkMode ? PRIME_COLOR_HEX[primeColor] : COLOR_PALETTE[primeColor].hexLight;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                if (selectedValue === item.value) {
                    ctx.strokeStyle = isDarkMode ? '#ffffff' : '#111827';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }

                ctx.globalAlpha = 1;
                grid.get(gridKey).push({ ...item, px, py, radius });
            });

            spatialRef.current = { cellSize, grid };
        };

        render();
        const observer = new ResizeObserver(render); observer.observe(container);
        window.addEventListener('resize', render);
        return () => { observer.disconnect(); window.removeEventListener('resize', render); };
    }, [isDarkMode, primeColor, selectedValue, valueInsights]);

    const handleInteraction = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas || valueInsights.length === 0) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const { cellSize, grid } = spatialRef.current;
        const gx = Math.floor(mouseX / cellSize);
        const gy = Math.floor(mouseY / cellSize);
        let nearest = null;
        let minDistSq = 26 * 26;

        for (let ix = gx - 1; ix <= gx + 1; ix += 1) {
            for (let iy = gy - 1; iy <= gy + 1; iy += 1) {
                const bucket = grid.get(`${ix}:${iy}`);
                if (!bucket) continue;
                bucket.forEach((point) => {
                    const dx = point.px - mouseX;
                    const dy = point.py - mouseY;
                    const distSq = dx * dx + dy * dy;
                    if (distSq <= Math.max(minDistSq, point.radius * point.radius)) {
                        minDistSq = distSq;
                        nearest = point;
                    }
                });
            }
        }

        setHoverInfo(nearest);
        if (e.type === 'click') {
            setSelectedValue((prev) => (nearest ? (prev === nearest.value ? null : nearest.value) : null));
        }
    }, [valueInsights.length]);

    return (
        <div className={`app-results-card app-value-map p-4 rounded-xl border noselect ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
            <div className="app-results-header flex items-center justify-between gap-4 mb-4">
                <h2 className="app-results-title text-2xl font-bold text-center flex-1">גרף · תפוצת ערכים בקטע</h2>
                <ExportToolbar getText={prepareInsightText} getCSV={prepareInsightCSV} getJSON={prepareInsightJSON} id='graph-insights' label='העתק' researchSelection={{ value: selectedValue }} />
            </div>
            <p className={`text-center text-sm mb-3 ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                כל נקודה היא ערך מספרי: ימינה — יותר מופעים; למעלה — יותר צורות מילים שונות הנושאות אותו.
            </p>
            <div className="app-value-summary grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4 text-sm">
                <div className={`p-2 rounded-lg border ${isDarkMode ? 'bg-gray-900/40 border-gray-700' : 'bg-white border-slate-200'}`}>ערכים מוצגים: <b>{graphSummary.valueCount}</b></div>
                <div className={`p-2 rounded-lg border ${isDarkMode ? 'bg-gray-900/40 border-gray-700' : 'bg-white border-slate-200'}`}>ערכים ראשוניים: <b>{graphSummary.primeValues}</b></div>
                <div className={`p-2 rounded-lg border ${isDarkMode ? 'bg-gray-900/40 border-gray-700' : 'bg-white border-slate-200'}`}>היקף: <b>הקטע הנוכחי והמסננים הפעילים</b></div>
            </div>
            <details className="workspace-help"><summary>מה אפשר לבדוק בגרף?</summary><p>ערך עם מופעים רבים ומעט צורות מילים נובע מחזרות על אותן מילים. ערך עם צורות רבות משותף לכתיבים שונים. בחרו ערך כדי לבדוק אילו מילים ושכבות יוצרות את התוצאה. זהו תיאור של הקטע, ללא מסקנה על מובהקות סטטיסטית.</p><p>כחול: שכבה אחת; ירוק: שתיים; סגול: שלוש. הגודל מציין את מספר השכבות, והמסגרת מציינת ערך ראשוני. מופע של מילה נספר פעם אחת לכל ערך גם כשכמה שכבות שלה שוות.</p></details>
            <label className="research-graph-select">בחר ערך לבדיקה <select aria-label="בחר ערך לבדיקה" value={selectedValue ?? ''} onChange={(event) => setSelectedValue(event.target.value === '' ? null : Number(event.target.value))}><option value="">בחרו ערך</option>{[...valueInsights].sort((a, b) => a.value - b.value).map((item) => <option key={item.value} value={item.value}>{item.value} · {item.totalOccurrences} מופעים · {item.uniqueWordCount} צורות</option>)}</select></label>
            {!valueInsights.length && <p role="status">אין ערכים להצגה במסננים הנוכחיים.</p>}
            <div ref={containerRef} className="app-value-canvas relative w-full h-[430px] cursor-crosshair">
                <canvas
                    ref={canvasRef}
                    onClick={handleInteraction}
                    onPointerMove={handleInteraction}
                    onPointerLeave={() => setHoverInfo(null)}
                    className="w-full h-full"
                />
                {hoverInfo && (
                    <div
                        className="app-canvas-tooltip absolute pointer-events-none p-3 rounded-lg bg-gray-900/90 text-white text-sm z-10 shadow-xl border border-gray-600"
                        style={canvasTooltipStyle(hoverInfo, containerRef.current)}
                    >
                        <div className="font-bold text-base mb-1">ערך {hoverInfo.value} {hoverInfo.isPrime && <span className="text-yellow-400">♢</span>}</div>
                        <div>שכבות: {hoverInfo.layers.join('/')}</div>
                        <div>מילים ייחודיות: {hoverInfo.uniqueWordCount}</div>
                        <div>מופעים בטקסט: {hoverInfo.totalOccurrences}</div>
                        <div>מופעים לצורת מילה: {hoverInfo.avgOccurrences.toFixed(2)}</div>
                    </div>
                )}
            </div>

            <div className="mt-3 text-sm text-center text-gray-500 dark:text-gray-300">
                ציר X: מופעים בטקסט · ציר Y: צורות מילים שונות · גודל וצבע: מספר שכבות U/T/H
            </div>
            {graphSummary.highlights.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 justify-center">
                    {graphSummary.highlights.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => setSelectedValue((prev) => (prev === item.value ? null : item.value))}
                            className={`px-3 py-1 rounded-full border text-sm transition-colors ${selectedValue === item.value ? 'bg-blue-600 text-white border-blue-500' : isDarkMode ? 'bg-gray-900/40 text-gray-100 border-gray-700 hover:bg-gray-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                        >
                            {item.value}{item.isPrime ? '♢' : ''} · {item.topWords[0]?.word || '—'}
                        </button>
                    ))}
                </div>
            )}

            {selectedInsight && (
                <div className={`mt-4 p-3 rounded-lg border ${isDarkMode ? 'bg-gray-900/50 border-gray-700' : 'bg-white/80 border-slate-300'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-lg">ערך נבחר: {selectedInsight.value}{selectedInsight.isPrime ? ' ♢' : ''}</h3>
                        <span className="text-sm text-gray-500">קליק נוסף על הנקודה לביטול בחירה</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                        <div className="p-2 rounded bg-slate-200 dark:bg-gray-800">שכבות: <b>{selectedInsight.layers.join('/')}</b></div>
                        <div className="p-2 rounded bg-slate-200 dark:bg-gray-800">מילים ייחודיות: <b>{selectedInsight.uniqueWordCount}</b></div>
                        <div className="p-2 rounded bg-slate-200 dark:bg-gray-800">מופעים: <b>{selectedInsight.totalOccurrences}</b></div>
                        <div className="p-2 rounded bg-slate-200 dark:bg-gray-800">ממוצע מופעים לצורה: <b>{selectedInsight.avgOccurrences.toFixed(2)}</b></div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-right border-b border-gray-300 dark:border-gray-700">
                                    <th className="py-1">מילה</th>
                                    <th className="py-1">שכבה</th>
                                    <th className="py-1">מופעים</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedWords.slice(wordPage * 50, (wordPage + 1) * 50).map((entry, idx) => (
                                    <tr
                                        key={`${entry.word}-${idx}`}
                                        className="border-b border-gray-200 dark:border-gray-800 hover:bg-slate-100 dark:hover:bg-gray-800/60 cursor-pointer"
                                        onClick={() => {
                                            const wordData = coreResults?.wordDataMap?.get(entry.word);
                                            if (wordData) onWordClick(wordData);
                                        }}
                                    >
                                        <td className="py-1 font-semibold text-blue-700 dark:text-blue-300"><button onClick={(event) => { event.stopPropagation(); const data = coreResults.wordDataMap.get(entry.word); if (data) onWordClick(data); }} aria-label={`הדגש קשרי ${entry.word}`}>{entry.word}</button><InspectWord word={entry.word} /></td>
                                        <td className="py-1">{entry.layers.join('/')}</td>
                                        <td className="py-1 font-mono">{entry.occurrences}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="research-actions"><span>{selectedWords.length} צורות מילים · הרשימה כוללת את כל ההתאמות לסינון</span>{selectedWords.length > 50 && <><button disabled={wordPage === 0} onClick={() => setWordPage(wordPage - 1)}>עמוד קודם</button><span>{wordPage + 1} מתוך {Math.ceil(selectedWords.length / 50)}</span><button disabled={(wordPage + 1) * 50 >= selectedWords.length} onClick={() => setWordPage(wordPage + 1)}>עמוד הבא</button></>}</div>
                </div>
            )}
        </div>
    );
});

const MainTextInput = memo(({ text, isDarkMode, textSize, onTextChange, onDraftChange }) => {
    const textareaRef = useRef(null);
    const draftRef = useRef(text);
    const commitTimerRef = useRef(null);
    const selectionRafRef = useRef(null);
    const dragStateRef = useRef(null);
    const isComposingRef = useRef(false);
    const minTextareaHeightRef = useRef(0);
    const maxTextareaHeightRef = useRef(Number.POSITIVE_INFINITY);
    const [isDragActive, setIsDragActive] = useState(false);
    const [manualHeight, setManualHeight] = useState(null);

    const { sanitizeHebrewInput, sanitizePastedHebrewInput } = useHebrewInputSanitizer({
        HEB_MARKS_RE,
        INPUT_HEBREW_JOINERS_RE,
        INPUT_PUNCT_TO_SPACE_RE,
        INPUT_MULTI_SPACE_RE,
        EN_TO_HE_LETTER_MAP,
        EN_TO_HE_PUNCT_LETTER_MAP,
        EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP,
    });

    const clearCommitTimer = useCallback(() => {
        if (commitTimerRef.current !== null) {
            clearTimeout(commitTimerRef.current);
            commitTimerRef.current = null;
        }
    }, []);

    const queueSelectionUpdate = useCallback((fn) => {
        if (selectionRafRef.current !== null) cancelAnimationFrame(selectionRafRef.current);
        selectionRafRef.current = requestAnimationFrame(() => {
            selectionRafRef.current = null;
            fn();
        });
    }, []);
    const clearSelectionUpdate = useCallback(() => {
        if (selectionRafRef.current !== null) {
            cancelAnimationFrame(selectionRafRef.current);
            selectionRafRef.current = null;
        }
    }, []);

    const applyTextareaRowBounds = useCallback((target) => {
        const textarea = target || textareaRef.current;
        if (!textarea) return;

        const computedStyle = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(computedStyle.lineHeight) || 24;
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
        const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
        const chromeHeight = paddingTop + paddingBottom + borderTop + borderBottom;
        const minHeight = (lineHeight * MIN_INPUT_ROWS) + chromeHeight;
        const maxHeight = (lineHeight * MAX_INPUT_ROWS) + chromeHeight;

        minTextareaHeightRef.current = minHeight;
        maxTextareaHeightRef.current = maxHeight;
        textarea.style.minHeight = `${minHeight}px`;
        textarea.style.maxHeight = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
    }, []);
    const adjustTextareaHeight = applyTextareaRowBounds;

    const commitChanges = useCallback(() => {
        clearCommitTimer();
        const committedValue = sanitizeHebrewInput(draftRef.current);
        draftRef.current = committedValue;
        onTextChange(committedValue);
    }, [clearCommitTimer, onTextChange, sanitizeHebrewInput]);

    useEffect(() => {
        const sanitized = sanitizeHebrewInput(text);
        const textarea = textareaRef.current;
        if (!textarea) {
            draftRef.current = sanitized;
            return;
        }

        const isFocused = document.activeElement === textarea;
        const hasLocalUncommittedChanges = draftRef.current !== sanitized;

        if (isFocused && hasLocalUncommittedChanges) {
            return;
        }

        draftRef.current = sanitized;
        if (textarea.value === sanitized) return;

        const selectionStart = textarea.selectionStart ?? sanitized.length;
        const selectionEnd = textarea.selectionEnd ?? sanitized.length;

        textarea.value = sanitized;
        if (isFocused) {
            const nextStart = Math.min(selectionStart, sanitized.length);
            const nextEnd = Math.min(selectionEnd, sanitized.length);
            queueSelectionUpdate(() => textarea.setSelectionRange(nextStart, nextEnd));
        }
    }, [adjustTextareaHeight, queueSelectionUpdate, sanitizeHebrewInput, text]);

    useEffect(() => {
        adjustTextareaHeight();
        applyTextareaRowBounds();
    }, [adjustTextareaHeight, applyTextareaRowBounds, textSize]);

    useEffect(() => () => {
        clearCommitTimer();
        clearSelectionUpdate();
    }, [clearCommitTimer, clearSelectionUpdate]);

    const scheduleCommit = useCallback((nextValue) => {
        onDraftChange(nextValue);
        clearCommitTimer();
        let debounceMs = 180;
        if (nextValue.length === 0) debounceMs = 0;
        else if (nextValue.length > 120_000) debounceMs = 420;
        else if (nextValue.length > 40_000) debounceMs = 280;

        commitTimerRef.current = setTimeout(() => {
            commitTimerRef.current = null;
            const committedValue = sanitizeHebrewInput(draftRef.current);
            draftRef.current = committedValue;
            onTextChange(committedValue);
        }, debounceMs);
    }, [clearCommitTimer, onTextChange, onDraftChange, sanitizeHebrewInput]);

    const handleChange = useCallback((e) => {
        const rawValue = e.target.value;

        if (isComposingRef.current) {
            onDraftChange(rawValue);
            draftRef.current = rawValue;
            adjustTextareaHeight(e.target);
            return;
        }
        const nativeInputEvent = e.nativeEvent;
        const inputType = nativeInputEvent?.inputType || '';
        const insertedData = nativeInputEvent?.data ?? null;
        const isDeleteInput = inputType.startsWith('delete');
        const isSimpleInsert = inputType === 'insertText';
        const isLineBreakInsert = inputType === 'insertLineBreak';
        const isLargeInput = rawValue.length > LARGE_INPUT_SANITIZE_THRESHOLD;
        const isAllowedInsertedData = insertedData === null || insertedData === '\n' || insertedData === ' ' || /^[א-ת]$/.test(insertedData);
        const canSkipFullSanitize = isLargeInput && (
            isDeleteInput
            || isLineBreakInsert
            || (isSimpleInsert && isAllowedInsertedData)
        );

        const nextValue = canSkipFullSanitize ? rawValue : sanitizeHebrewInput(rawValue);

        if (rawValue !== nextValue) {
            const cursorStart = e.target.selectionStart ?? rawValue.length;
            const nextCursor = sanitizeHebrewInput(rawValue.slice(0, cursorStart)).length;
            e.target.value = nextValue;
            queueSelectionUpdate(() => e.target.setSelectionRange(nextCursor, nextCursor));
        }

        draftRef.current = nextValue;
        adjustTextareaHeight(e.target);
        scheduleCommit(nextValue);
    }, [adjustTextareaHeight, queueSelectionUpdate, sanitizeHebrewInput, scheduleCommit, onDraftChange]);

    const handleKeyDown = useCallback((e) => {
        if (isComposingRef.current || e.nativeEvent?.isComposing) return;

        const isMetaCombo = e.ctrlKey || e.metaKey;
        const key = e.key.toLowerCase();
        const isEnterKey = key === 'enter' || e.code === 'Enter' || e.code === 'NumpadEnter';
        const isSpaceKey = key === ' ' || key === 'space' || key === 'spacebar' || e.code === 'Space';

        if (isMetaCombo && isEnterKey) {
            e.preventDefault();
            commitChanges();
            return;
        }

        const textarea = textareaRef.current;
        const currentLength = textarea?.value.length ?? draftRef.current.length;
        if (currentLength > LARGE_INPUT_SANITIZE_THRESHOLD) {
            return;
        }

        if (isMetaCombo || e.altKey || key === 'shift' || key === 'alt' || key === 'control' || key === 'meta') {
            return;
        }

        clearSelectionUpdate();

        if (isEnterKey || isSpaceKey) {
            return;
        }

        if (e.key.length !== 1) {
            return;
        }

        const mappedFromCode = KEYBOARD_CODE_TO_HE_LETTER_MAP[e.code];
        const mappedFromKey = (!e.code || e.code === 'Unidentified')
            ? (EN_TO_HE_LETTER_MAP[e.key.toLowerCase()]
                || EN_TO_HE_PUNCT_LETTER_MAP[e.key]
                || EN_TO_HE_SHIFTED_PUNCT_LETTER_MAP[e.key])
            : null;
        const mappedLetter = mappedFromCode || mappedFromKey;

        if (mappedLetter) {
            e.preventDefault();
            if (!textarea) return;

            const start = textarea.selectionStart ?? 0;
            const end = textarea.selectionEnd ?? 0;
            const current = textarea.value;
            const nextValue = current.slice(0, start) + mappedLetter + current.slice(end);

            textarea.value = nextValue;
            draftRef.current = nextValue;
            adjustTextareaHeight(textarea);
            scheduleCommit(nextValue);

            const nextPos = start + mappedLetter.length;
            queueSelectionUpdate(() => textarea.setSelectionRange(nextPos, nextPos));
            return;
        }

        if (!/^[א-ת]$/i.test(e.key)) {
            e.preventDefault();
        }
    }, [adjustTextareaHeight, clearSelectionUpdate, commitChanges, queueSelectionUpdate, scheduleCommit]);

    const handlePaste = useCallback((e) => {
        const pasted = e.clipboardData?.getData('text') ?? '';
        const sanitized = sanitizePastedHebrewInput(pasted);

        e.preventDefault();

        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const current = textarea.value;
        const nextValue = current.slice(0, start) + sanitized + current.slice(end);

        textarea.value = nextValue;
        draftRef.current = nextValue;
        adjustTextareaHeight(textarea);
        scheduleCommit(nextValue);

        const nextPos = start + sanitized.length;
        queueSelectionUpdate(() => textarea.setSelectionRange(nextPos, nextPos));
    }, [adjustTextareaHeight, queueSelectionUpdate, sanitizePastedHebrewInput, scheduleCommit]);

    const insertTextAtCursor = useCallback((incomingText) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const sanitized = sanitizePastedHebrewInput(incomingText);
        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const current = textarea.value;
        const nextValue = current.slice(0, start) + sanitized + current.slice(end);

        textarea.value = nextValue;
        draftRef.current = nextValue;
        adjustTextareaHeight(textarea);
        scheduleCommit(nextValue);

        const nextPos = start + sanitized.length;
        queueSelectionUpdate(() => textarea.setSelectionRange(nextPos, nextPos));
    }, [adjustTextareaHeight, queueSelectionUpdate, sanitizePastedHebrewInput, scheduleCommit]);



    const handleCompositionStart = useCallback(() => {
        isComposingRef.current = true;
    }, []);

    const handleCompositionEnd = useCallback((e) => {
        isComposingRef.current = false;
        const finalizedValue = sanitizeHebrewInput(e.currentTarget.value);

        if (finalizedValue !== e.currentTarget.value) {
            const cursorStart = e.currentTarget.selectionStart ?? e.currentTarget.value.length;
            const nextCursor = sanitizeHebrewInput(e.currentTarget.value.slice(0, cursorStart)).length;
            e.currentTarget.value = finalizedValue;
            queueSelectionUpdate(() => e.currentTarget.setSelectionRange(nextCursor, nextCursor));
        }

        draftRef.current = finalizedValue;
        adjustTextareaHeight(e.currentTarget);
        scheduleCommit(finalizedValue);
    }, [adjustTextareaHeight, queueSelectionUpdate, sanitizeHebrewInput, scheduleCommit]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!isDragActive) setIsDragActive(true);
    }, [isDragActive]);

    const handleDragLeave = useCallback((e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragActive(false);
    }, []);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        setIsDragActive(false);

        const files = Array.from(e.dataTransfer?.files || []);
        if (!files.length) return;

        const file = files.find((candidate) => {
            const hasTextType = candidate.type?.startsWith('text/');
            const hasTextExt = /\.(txt|text|md|csv|log)$/i.test(candidate.name || '');
            return hasTextType || hasTextExt;
        });

        if (!file) return;

        const droppedText = await file.text();
        insertTextAtCursor(droppedText);
    }, [insertTextAtCursor]);

    const handleResizeDragMove = useCallback((event) => {
        const dragState = dragStateRef.current;
        if (!dragState) return;

        const heightDelta = event.clientY - dragState.startClientY;
        const nextHeight = dragState.startHeight + heightDelta;
        const boundedHeight = Math.min(
            maxTextareaHeightRef.current,
            Math.max(minTextareaHeightRef.current, nextHeight),
        );
        setManualHeight(boundedHeight);
    }, []);

    const stopResizeDrag = useCallback(() => {
        if (!dragStateRef.current) return;
        dragStateRef.current = null;
        window.removeEventListener('mousemove', handleResizeDragMove);
        window.removeEventListener('mouseup', stopResizeDrag);
    }, [handleResizeDragMove]);

    const beginResizeDrag = useCallback((event) => {
        event.preventDefault();

        const textarea = textareaRef.current;
        if (!textarea) return;

        const rect = textarea.getBoundingClientRect();
        dragStateRef.current = {
            startClientY: event.clientY,
            startHeight: rect.height,
        };

        window.addEventListener('mousemove', handleResizeDragMove);
        window.addEventListener('mouseup', stopResizeDrag);
    }, [handleResizeDragMove, stopResizeDrag]);

    useEffect(() => () => stopResizeDrag(), [stopResizeDrag]);

    return (
        <div className="relative pb-3">
            <textarea
                ref={textareaRef}
                dir="rtl"
                id="text-input"
                aria-label="טקסט לניתוח"
                className={`app-textarea w-full resize-none p-4 border rounded-lg focus:ring-2 focus:border-blue-500 transition duration-150 text-right ${TEXT_SIZE_CLASSNAMES[textSize] || TEXT_SIZE_CLASSNAMES.md} ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300'} ${isDragActive ? 'ring-2 ring-blue-400 border-blue-400' : ''}`}
                style={manualHeight !== null ? { height: `${manualHeight}px` } : undefined}
                rows={MIN_INPUT_ROWS}
                defaultValue={text}
                onChange={handleChange}
                onBlur={commitChanges}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
                placeholder="הזן טקסט לניתוח"
            />
            <div
                role="presentation"
                className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize rounded-b-lg bg-slate-300/90 dark:bg-gray-600/90"
                onMouseDown={beginResizeDrag}
                aria-hidden="true"
            />
        </div>
    );
});

// -----------------------------------------------------------------------------
// 8. Main App Component
// -----------------------------------------------------------------------------
const App = () => {
    // ... Context and Effects ...
    const state = useAppCoreState();
    const dispatch = useAppDispatch();
    const {
        text, coreResults, selectedDR, isDarkMode, searchTerm, isValueTableOpen, isValueTablePinned,
        mode, textSize, copiedId, view, hoveredWord, isPrimesCollapsed, pinnedWord, selectedHotValue,
        hotWordsList, isStatsCollapsed, showScrollTop, hotView, detailsView, hotSort,
        expandedRows, primeColor, wordNumberingStart,
        stats, connectionValues, valueToWordsMap, filters,
        hasExplicitThemeChoice, isPending, corpusSelection, isAnalysisStale, analysisError, retryAnalysis
    } = state;
    const [isTanakhOpen, setIsTanakhOpen] = useState(false);

    const clusterRefs = useRef({});
    const valueTableRef = useRef(null);
    const valueTableButtonRef = useRef(null);
    const viewContentTopRef = useRef(null);
    
    const letterTable = useMemo(() => buildLetterTable(mode), [mode]);

    useLayoutEffect(() => {
        if (view !== 'clusters' || selectedDR === null) return;
        const el = clusterRefs.current[selectedDR];
        if (!el) return;
        requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }, [selectedDR, view]);

    // Fixed: Properly close table when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (isValueTableOpen) {
                if (valueTableButtonRef.current && valueTableButtonRef.current.contains(event.target)) return;
                if (valueTableRef.current && !valueTableRef.current.contains(event.target)) {
                    // Explicitly unpin and close
                    dispatch({ type: 'CLOSE_VALUE_TABLE' });
                }
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isValueTableOpen, dispatch]);

    // ... scroll effect, localstorage effect ...
    useEffect(() => {
        const checkScrollTop = () => {
            const shouldShow = window.pageYOffset > 300;
            if (showScrollTop !== shouldShow) dispatch({ type: 'SET_SHOW_SCROLL_TOP', payload: shouldShow });
        };
        window.addEventListener('scroll', checkScrollTop);
        return () => window.removeEventListener('scroll', checkScrollTop);
    }, [showScrollTop, dispatch]);

    useEffect(() => {
        let savedTheme = null;
        try {
            const current = localStorage.getItem('alephThemeMode');
            savedTheme = current === 'light' || current === 'dark' ? current : localStorage.getItem('alephTheme');
        } catch (_err) {
            savedTheme = null;
        }

        if (savedTheme === 'dark' || savedTheme === 'light') {
            dispatch({ type: 'SET_DARK_MODE', payload: savedTheme === 'dark' });
            dispatch({ type: 'SET_EXPLICIT_THEME_CHOICE', payload: true });
            return;
        }

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        dispatch({ type: 'SET_DARK_MODE', payload: mediaQuery.matches });
        dispatch({ type: 'SET_EXPLICIT_THEME_CHOICE', payload: false });
    }, [dispatch]);
    
    useEffect(() => {
        if (!hasExplicitThemeChoice) return;
        try {
            localStorage.setItem('alephThemeMode', isDarkMode ? 'dark' : 'light');
        } catch (_err) {
            // Ignore storage write failures (private mode / blocked storage)
        }
    }, [hasExplicitThemeChoice, isDarkMode]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
        document.body.classList.toggle('dark', isDarkMode);
        document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDarkMode ? '#111827' : '#f5f6f4');
    }, [isDarkMode]);
    useEffect(() => {
        if (hasExplicitThemeChoice) return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const applyTheme = (event) => dispatch({ type: 'SET_DARK_MODE', payload: event.matches });

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', applyTheme);
            return () => mediaQuery.removeEventListener('change', applyTheme);
        }

        mediaQuery.addListener(applyTheme);
        return () => mediaQuery.removeListener(applyTheme);
    }, [dispatch, hasExplicitThemeChoice]);


    // ... Memos for clusters, hot values, word counts ...
    const drClusters = useMemo(() => {
        if (!coreResults || (view !== 'clusters' && view !== 'network')) return {};
        const activeDrOrder = mode === 'aleph-zero' ? ALEPH_ZERO_DR_ORDER : DEFAULT_DR_ORDER;
        const clusters = Object.fromEntries(activeDrOrder.map((dr) => [dr, []]));
        coreResults.allWords.forEach((wd) => {
            if (Object.hasOwn(clusters, wd.dr)) clusters[wd.dr].push(wd);
        });
        for (const k in clusters) {
            clusters[k].sort((a, b) => {
                if (a.units !== b.units) return a.units - b.units;
                if (a.tens !== b.tens) return a.tens - b.tens;
                return a.hundreds - b.hundreds;
            });
        }
        return clusters;
    }, [coreResults, mode, view]);

    const deferredHoveredWord = useDeferredValue(hoveredWord);
    const deferredFilters = filters;
    const activeWord = pinnedWord || deferredHoveredWord;
    const activeWordKey = activeWord?.word || null;

    const isVisibleWord = useCallback(
        (wordData) => isWordVisible(wordData, deferredFilters) && (selectedDR === null || wordData.dr === selectedDR),
        [deferredFilters, selectedDR]
    );

    const visibleAllWords = useMemo(() => {
        if (!coreResults) return [];
        if (view !== 'lines' && view !== 'hot-words') return [];
        return coreResults.allWords.filter(isVisibleWord);
    }, [coreResults, isVisibleWord, view]);

    const visibleWordsByLine = useMemo(() => {
        if (!coreResults) return [];
        if (view !== 'lines') return [];
        return coreResults.lines.map((line) => line.words.filter(isVisibleWord));
    }, [coreResults, isVisibleWord, view]);
    const visibleWordPositionsByLine = useMemo(() => view === 'lines' && coreResults
        ? coreResults.lines.map((line) => line.words.flatMap((word, index) => isVisibleWord(word) ? [index + 1] : [])) : [], [coreResults, isVisibleWord, view]);

    const visibleValueToWordsMap = useMemo(() => {
        if (!valueToWordsMap) return new Map();
        if (view !== 'hot-words') return new Map();
        const map = new Map();
        for (const [value, words] of valueToWordsMap.entries()) {
            const visible = words.filter((wordData) => (
                isVisibleWord(wordData)
                && getWordValues(wordData).some((valueData) => valueData.value === value && isValueVisible(valueData.layer, valueData.isPrime, deferredFilters))
            ));
            if (visible.length > 0) map.set(value, visible);
        }
        return map;
    }, [valueToWordsMap, isVisibleWord, view, deferredFilters]);

    const visibleHotWords = useMemo(() => {
        if (selectedHotValue !== null) return visibleValueToWordsMap.get(selectedHotValue) || [];
        return hotWordsList.filter((wordData) => isWordVisible(wordData, deferredFilters));
    }, [selectedHotValue, visibleValueToWordsMap, hotWordsList, deferredFilters]);

    const hotValuesList = useMemo(() => {
        if (!visibleValueToWordsMap) return [];
        const arr = [];
        for (const [value, visibleWords] of visibleValueToWordsMap.entries()) {
            const uniqueWordsCount = new Set(visibleWords.map((w) => w.word)).size;
            arr.push({ value, count: uniqueWordsCount });
        }
        return arr;
    }, [visibleValueToWordsMap]);

    const sortedWordCounts = useMemo(() => {
        if (!coreResults || !coreResults.wordCounts) return [];
        if (view !== 'hot-words' || hotView !== 'words') return [];
        const wordMap = coreResults.wordDataMap;
        return Array.from(coreResults.wordCounts.entries())
            .filter(([word]) => {
                 const wordData = wordMap.get(word);
                 return wordData && isVisibleWord(wordData);
            })
            .map(([word, count]) => ({ word, count }))
            .sort((a, b) => b.count - a.count);
    }, [coreResults, isVisibleWord, view, hotView]);

    const sortedHotViewList = useMemo(() => {
        if (hotView === 'words') {
            const arr = [...sortedWordCounts];
            const { key, order } = hotSort;
            if (key === 'count') arr.sort((a, b) => order === 'asc' ? a.count - b.count : b.count - a.count);
            return arr;
        }
        const arr = [...hotValuesList];
        const { key, order } = hotSort;
        arr.sort((a, b) => {
            const valA = a[key]; const valB = b[key];
            return order === 'asc' ? valA - valB : valB - valA;
        });
        return arr;
    }, [hotView, sortedWordCounts, hotValuesList, hotSort]);

    const { wordsByVisibleValue: hotWordsByVisibleValue, visibleValuesByWord: hotVisibleValuesByWord } = useMemo(() => {
        if (view !== 'hot-words' || selectedHotValue === null) return { wordsByVisibleValue: new Map(), visibleValuesByWord: new Map() };
        return buildVisibleWordConnectionIndex(visibleHotWords, deferredFilters);
    }, [view, selectedHotValue, visibleHotWords, deferredFilters]);

    const hotConnectedWordsSet = useMemo(() => {
        if (view !== 'hot-words' || selectedHotValue === null) return new Set();
        return computeConnectedWordsSet(activeWord, hotWordsByVisibleValue, hotVisibleValuesByWord);
    }, [view, selectedHotValue, activeWord, hotVisibleValuesByWord, hotWordsByVisibleValue]);

    const filteredWordsInView = useMemo(() => {
        if (view !== 'clusters' || !drClusters) return [];
        const allWordsInClusters = Object.entries(drClusters)
            .filter(([dr]) => selectedDR === null || selectedDR === parseInt(dr))
            .flatMap(([, words]) => words);

        let filteredWords = allWordsInClusters;

        if (searchTerm.trim()) {
            const normalizedSearch = normalizeSearchInput(searchTerm);
            filteredWords = filteredWords.filter((wordData) => matchesSearchQuery(wordData, normalizedSearch, deferredFilters));
        }

        const regrouped = {};
        filteredWords.forEach((wordData) => {
            if (isVisibleWord(wordData)) {
                if (!regrouped[wordData.dr]) regrouped[wordData.dr] = [];
                regrouped[wordData.dr].push(wordData);
            }
        });

        const activeDrOrder = mode === 'aleph-zero' ? ALEPH_ZERO_DR_ORDER : DEFAULT_DR_ORDER;
        return activeDrOrder
            .map((dr) => ({ dr, words: regrouped[dr] || [] }))
            .filter(({ words }) => words.length > 0);
    }, [drClusters, mode, view, selectedDR, searchTerm, isVisibleWord, deferredFilters]);

    const summaryClusters = useMemo(
        () => getPinnedClusters(filteredWordsInView, pinnedWord, deferredFilters),
        [filteredWordsInView, pinnedWord, deferredFilters],
    );
    const getPinnedRelevantWords = useCallback(() => summaryClusters.flatMap(({ words }) => words), [summaryClusters]);

    // --- Data Preparation for Export ---
    const csvEscape = useCallback((value) => {
        const str = String(value ?? '');
        if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
    }, []);

    const toCSV = useCallback((headers, rows) => [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n'), [csvEscape]);

    const prepareAllDetailsText = useCallback(() => {
        if (!coreResults || !stats) return "";
        const primeMarker = (isPrime) => isPrime ? " ♢" : "";
        const modeText = `מצב חישוב: ${mode === 'aleph-zero' ? 'א=0' : 'א=1'}`;
        const filterText = selectedDR !== null ? ` | מסונן לפי ש"ד: ${selectedDR}` : "";
        const lines = [
            `${modeText}${filterText}\n---\n`,
            "ניתוח סטטיסטי\n-------------------\n",
            `סה"כ שורות: ${stats.totalLines}`,
            `סה"כ מילים: ${stats.totalWords}`,
            `מילים ייחודיות: ${stats.uniqueWords}`,
            `שורות ראשוניות: ${stats.primeLineTotals}`,
            `קבוצות קשרים: ${connectionValues.size || 0}\n`,
            "סיכום כללי (מסונן לפי מקרא)\n-------------------\n"
        ];
        
        // ... Grand Totals logic remains same ...
        if (isValueVisible('U', coreResults.grandTotals.isPrime.U, filters)) lines.push(`סה"כ י'= ${coreResults.grandTotals.units}${primeMarker(coreResults.grandTotals.isPrime.U)}`);
        if (isValueVisible('T', coreResults.grandTotals.isPrime.T, filters)) lines.push(`סה"כ ע: ${coreResults.grandTotals.tens}${primeMarker(coreResults.grandTotals.isPrime.T)}`);
        if (isValueVisible('H', coreResults.grandTotals.isPrime.H, filters)) lines.push(`סה"כ מ: ${coreResults.grandTotals.hundreds}${primeMarker(coreResults.grandTotals.isPrime.H)}`);
        lines.push(`ש"ד כללי: ${coreResults.grandTotals.dr}\n`);

        if (detailsView === 'words') {
             lines.push("סיכום מילים ייחודיות\n-------------------\n");
             visibleAllWords.forEach(w => {
                const calc = getLetterDetails(w.word, letterTable).map(l => `${l.char}(${l.value})`).join('+');
                let valuesArr = [];
                if (isValueVisible('U', w.isPrimeU, filters)) valuesArr.push(`י'= ${w.units}${w.isPrimeU ? " ♢" : ""}`);
                if (isValueVisible('T', w.isPrimeT, filters)) valuesArr.push(`ע: ${w.tens}${w.isPrimeT ? " ♢" : ""}`);
                if (isValueVisible('H', w.isPrimeH, filters)) valuesArr.push(`מ: ${w.hundreds}${w.isPrimeH ? " ♢" : ""}`);
                lines.push(`- ${w.word}: ${calc} | ${valuesArr.join(' | ')} | ש"ד: ${w.dr}`);
             });
             return lines.join('\n');
        }

        lines.push("פירוט שורות\n-------------------\n");
        coreResults.lines.forEach((line, index) => {
            const visibleWords = visibleWordsByLine[index] || [];
            if (visibleWords.length === 0) return;

            lines.push(`\nשורה ${index + 1}: "${line.lineText}"`);
            visibleWords.forEach(wordData => {
                const calculation = getLetterDetails(wordData.word, letterTable).map(l => `${l.char}(${l.value})`).join(' + ');
                const primeU = wordData.isPrimeU ? " ♢" : "";
                
                let valuesArr = [];
                if (isValueVisible('U', wordData.isPrimeU, filters)) valuesArr.push(`י'= ${wordData.units}${primeU}`);
                if (isValueVisible('T', wordData.isPrimeT, filters)) valuesArr.push(`ע: ${wordData.tens}${wordData.isPrimeT ? " ♢" : ""}`);
                if (isValueVisible('H', wordData.isPrimeH, filters)) valuesArr.push(`מ: ${wordData.hundreds}${wordData.isPrimeH ? " ♢" : ""}`);
                
                const valuesString = valuesArr.join(' | ');
                lines.push(`  - ${wordData.word}: ${calculation} | ${valuesString} | ש"ד: ${wordData.dr}`);
            });
            // ... Line totals logic ...
            const lineValues = [];
            if (isValueVisible('U', line.isPrimeTotals.U, filters)) lineValues.push(`י'=${line.totals.units}${primeMarker(line.isPrimeTotals.U)}`);
            if (isValueVisible('T', line.isPrimeTotals.T, filters)) lineValues.push(`ע=${line.totals.tens}${primeMarker(line.isPrimeTotals.T)}`);
            if (isValueVisible('H', line.isPrimeTotals.H, filters)) lineValues.push(`מ=${line.totals.hundreds}${primeMarker(line.isPrimeTotals.H)}`);
            const lineWordCount = line.words.length;
            const wordsSuffix = lineWordCount > 1 ? ` (${lineWordCount} מילים)` : '';
            lineValues.push(`ש"ד=${line.totalsDR}${wordsSuffix}`);
            lines.push(`  סה"כ שורה: ${lineValues.join(', ')}`);
        });
        
        // ... Prime Summary logic ...
        if (coreResults.primeSummary.length > 0) {
            lines.push(`\n\nסיכום ראשוניים מסכומי השורות\n---------------------------\n`);
            coreResults.primeSummary.forEach(p => {
                 const layers = p.layers.map(l => l === 'יחידות' ? 'U' : l === 'עשרות' ? 'T' : 'H');
                 if (layers.some(l => filters[l])) lines.push(`שורה ${p.line}: ${p.value} (שכבת ${p.layers.join(', ')})`);
            });
        }
        return lines.filter(Boolean).join('\n');
    }, [coreResults, stats, mode, connectionValues, letterTable, filters, selectedDR, detailsView, visibleAllWords, visibleWordsByLine]);

    const prepareAllDetailsCSV = useCallback(() => {
        if (detailsView === 'words') {
            return toCSV(
                ['mode','word','dr','יחידות','עשרות','מאות','is_prime_u','is_prime_t','is_prime_h'],
                visibleAllWords.map((w) => [mode, w.word, w.dr, w.units, w.tens, w.hundreds, w.isPrimeU ? 1 : 0, w.isPrimeT ? 1 : 0, w.isPrimeH ? 1 : 0]),
            );
        }
        const rows = [];
        coreResults?.lines.forEach((line, index) => {
            const visibleWords = visibleWordsByLine[index] || [];
            rows.push([
                mode,
                index + 1,
                visibleWords.length,
                visibleWords.map((w) => w.word).join('|'),
                visibleWords.map((w) => `${w.word}:${w.dr}`).join('|'),
                visibleWords.map((w) => `${w.word}:${w.units}`).join('|'),
                visibleWords.map((w) => `${w.word}:${w.tens}`).join('|'),
                visibleWords.map((w) => `${w.word}:${w.hundreds}`).join('|'),
            ]);
        });
        return toCSV(['mode','line_number','word_count','words','dr_by_word','יחידות_לפי_מילה','עשרות_לפי_מילה','מאות_לפי_מילה'], rows);
    }, [detailsView, visibleAllWords, mode, coreResults, visibleWordsByLine, toCSV]);

    const prepareSummaryText = useCallback(() => {
        if (!coreResults) return "";
        const primeMarker = (isPrime) => isPrime ? " ♢" : "";
        const modeText = `מצב חישוב: ${mode === 'aleph-zero' ? 'א=0' : 'א=1'}`;
        const lines = [`${modeText}\n---\n`];

        const formatWord = (wordData) => {
            const values = [];
            if (isValueVisible('U', wordData.isPrimeU, filters)) values.push(`י'= ${wordData.units}${primeMarker(wordData.isPrimeU)}`);
            if (isValueVisible('T', wordData.isPrimeT, filters)) values.push(`ע: ${wordData.tens}${primeMarker(wordData.isPrimeT)}`);
            if (isValueVisible('H', wordData.isPrimeH, filters)) values.push(`מ: ${wordData.hundreds}${primeMarker(wordData.isPrimeH)}`);
            if (values.length === 0) return null; 
            return `- ${wordData.word} (${values.join(', ')})`;
        };

        if (view === 'clusters' && pinnedWord) {
            const relevantWords = getPinnedRelevantWords();
            lines.push(`סיכום מילים המקושרות ל"${pinnedWord.word}" (מסונן)\n---\n`);
            relevantWords.forEach(wordData => {
                const txt = formatWord(wordData);
                if (txt) lines.push(txt);
            });
        } else if (view === 'clusters') {
            const drHeader = selectedDR !== null ? `סיכום קיבוץ שורש דיגיטלי ${selectedDR}` : `סיכום כללי - קיבוץ לפי שורש דיגיטלי`;
            if (searchTerm) lines.push(`סיכום תוצאות חיפוש "${searchTerm}"\n---\n`);
            else lines.push(`${drHeader}\n---\n`);
            
            filteredWordsInView.forEach(({ dr, words }) => {
                const visibleWords = words.map(formatWord).filter(Boolean);
                if (visibleWords.length > 0) {
                    if (selectedDR === null) lines.push(`\nש"ד ${dr} (${visibleWords.length} מילים)\n---------------------------\n`);
                    visibleWords.forEach(line => lines.push(line));
                }
            });
        }
        return lines.join('\n');
    }, [coreResults, mode, view, pinnedWord, getPinnedRelevantWords, selectedDR, searchTerm, filteredWordsInView, filters]);

    const prepareSummaryCSV = useCallback(() => {
        const rows = [];
        if (view === 'clusters' && pinnedWord) {
            const relevantWords = getPinnedRelevantWords() || [];
            relevantWords.forEach((w) => rows.push([mode, 'pinned', pinnedWord.word, w.word, w.dr, w.units, w.tens, w.hundreds, w.isPrimeU ? 1 : 0, w.isPrimeT ? 1 : 0, w.isPrimeH ? 1 : 0]));
        } else if (view === 'clusters') {
            filteredWordsInView.forEach(({ dr, words }) => words.forEach((w) => rows.push([mode, 'clusters', selectedDR ?? '', w.word, dr, w.units, w.tens, w.hundreds, w.isPrimeU ? 1 : 0, w.isPrimeT ? 1 : 0, w.isPrimeH ? 1 : 0])));
        }
        return toCSV(['mode','view','context_word','word','dr','יחידות','עשרות','מאות','is_prime_u','is_prime_t','is_prime_h'], rows);
    }, [view, mode, pinnedWord, getPinnedRelevantWords, filteredWordsInView, selectedDR, toCSV]);

    const prepareHotWordsText = useCallback(() => {
        if (!coreResults || selectedHotValue === null) return "";
        const primeU = (w) => w.isPrimeU ? " ♢" : "";
        const lines = [`מצב חישוב: ${mode === 'aleph-zero' ? 'א=0' : 'א=1'}\n---\n`, `מילים עם הערך ${selectedHotValue}\n-------------------\n`];
        visibleHotWords.forEach(w => {
            let parts = [];
            if (isValueVisible('U', w.isPrimeU, filters)) parts.push(`י'= ${w.units}${primeU(w)}`);
            if (isValueVisible('T', w.isPrimeT, filters)) parts.push(`ע: ${w.tens}${w.isPrimeT ? " ♢" : ""}`);
            if (isValueVisible('H', w.isPrimeH, filters)) parts.push(`מ: ${w.hundreds}${w.isPrimeH ? " ♢" : ""}`);
            const valuesString = parts.join(' | ');
            lines.push(`${w.word} | ${valuesString} | ש"ד: ${w.dr}`);
        });
        return lines.join('\n');
    }, [coreResults, selectedHotValue, mode, visibleHotWords, filters]);

    const prepareHotWordsCSV = useCallback(() => toCSV(
        ['mode','selected_value','word','dr','יחידות','עשרות','מאות','is_prime_u','is_prime_t','is_prime_h'],
        visibleHotWords.map((w) => [mode, selectedHotValue, w.word, w.dr, w.units, w.tens, w.hundreds, w.isPrimeU ? 1 : 0, w.isPrimeT ? 1 : 0, w.isPrimeH ? 1 : 0]),
    ), [toCSV, visibleHotWords, mode, selectedHotValue]);

    const prepareFrequenciesText = useCallback(() => {
        if (!coreResults) return "";
        const lines = [`מצב חישוב: ${mode === 'aleph-zero' ? 'א=0' : 'א=1'}\n---\n`];
        if (hotView === 'values') {
            lines.push("סיכום שכיחות ערכים\n-------------------\n");
            // USE SORTED LIST
            const arr = sortedHotViewList; 
            arr.forEach(({ value, count }) => {
                 const words = [...new Set((visibleValueToWordsMap.get(value) || []).map(w => w.word))].join(', ');
                 if(words) lines.push(`ערך: ${value} | כמות: ${count}\nמילים: ${words}\n`);
            });
        } else {
            lines.push("סיכום שכיחות מילים\n-------------------\n");
            // USE SORTED LIST
            sortedHotViewList.forEach(({ word, count }) => lines.push(`מילה: ${word}, שכיחות: ${count}`));
        }
        return lines.join('\n');
    }, [coreResults, mode, hotView, sortedHotViewList, visibleValueToWordsMap]);

    const prepareFrequenciesCSV = useCallback(() => {
        if (hotView === 'values') {
            return toCSV(['mode','type','value','count','words'], sortedHotViewList.map(({ value, count }) => [mode, 'value', value, count, [...new Set((visibleValueToWordsMap.get(value) || []).map((w) => w.word))].join('|')]));
        }
        return toCSV(['mode','type','word','count'], sortedHotViewList.map(({ word, count }) => [mode, 'word', word, count]));
    }, [hotView, sortedHotViewList, visibleValueToWordsMap, toCSV, mode]);

    const prepareAllDetailsJSON = useCallback(() => {
        if (detailsView === 'words') {
            return JSON.stringify({ mode, detailsView, selectedDR, words: visibleAllWords }, null, 2);
        }

        const lines = (coreResults?.lines || []).map((line, index) => ({
            lineNumber: index + 1,
            lineText: line.lineText,
            words: visibleWordsByLine[index] || [],
        }));

        return JSON.stringify({ mode, detailsView, selectedDR, lines }, null, 2);
    }, [mode, detailsView, selectedDR, visibleAllWords, coreResults, visibleWordsByLine]);
    const prepareSummaryJSON = useCallback(() => JSON.stringify({ mode, view, selectedDR, searchTerm, pinnedWord: pinnedWord?.word ?? null, clusters: summaryClusters }, null, 2), [mode, view, selectedDR, searchTerm, pinnedWord, summaryClusters]);
    const prepareHotWordsJSON = useCallback(() => JSON.stringify({ mode, selectedHotValue, words: visibleHotWords }, null, 2), [mode, selectedHotValue, visibleHotWords]);
    const prepareFrequenciesJSON = useCallback(() => JSON.stringify({ mode, hotView, rows: sortedHotViewList }, null, 2), [mode, hotView, sortedHotViewList]);

    // --- Event Handlers ---
    const handleTableIconEnter = () => dispatch({ type: 'SET_VALUE_TABLE_OPEN', payload: true });
    const handleTableIconLeave = () => !isValueTablePinned && dispatch({ type: 'SET_VALUE_TABLE_OPEN', payload: false });
    const handleTableIconClick = () => dispatch({ type: 'TOGGLE_VALUE_TABLE_PIN' });
    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    const handleModeChange = (newMode) => dispatch({ type: 'SET_MODE', payload: newMode });
    const handleTextSizeChange = (e) => dispatch({ type: 'SET_TEXT_SIZE', payload: e.target.value });
    const handleClearText = useCallback(() => {
        dispatch({ type: 'SET_TEXT', payload: '' });
        dispatch({ type: 'CLEAR_CORPUS_SELECTION' });
    }, [dispatch]);
    const drOrder = mode === 'aleph-zero' ? ALEPH_ZERO_DR_ORDER : DEFAULT_DR_ORDER;
    
    const handleDrillDown = useCallback((dr) => {
        if (!stats || (stats.drDistribution?.[dr] || 0) === 0) return;
        // Toggle selected DR instead of switching view
        dispatch({ type: 'SET_SELECTED_DR', payload: dr });
    }, [dispatch, stats]);

    useEffect(() => {
        if (selectedDR === null || !stats) return;
        if ((stats.drDistribution?.[selectedDR] || 0) === 0) {
            dispatch({ type: 'SET_SELECTED_DR', payload: null });
        }
    }, [dispatch, selectedDR, stats]);

    const handleWordClick = useCallback((wordData) => dispatch({ type: 'SET_PINNED_WORD', payload: wordData }), [dispatch]);
    const handleViewChange = useCallback((newView) => {
        dispatch({ type: 'SET_VIEW', payload: newView });
        requestAnimationFrame(() => {
            viewContentTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [dispatch]);
    const unpinOnBackgroundClick = useCallback((e) => { if (e.target === e.currentTarget) { e.stopPropagation(); dispatch({ type: 'UNPIN_WORD' }); } }, [dispatch]);
    const handleDraftChange = useCallback((draft) => dispatch({ type: 'SET_INPUT_DIRTY', payload: draft !== text }), [dispatch, text]);
    const handleTextChange = useCallback((nextText) => {
        dispatch({ type: 'SET_TEXT', payload: forceHebrewInput(nextText) });
    }, [dispatch]);
    const handleCorpusSelection = useCallback((selectedText, selection, book) => {
        dispatch({
            type: 'LOAD_CORPUS_SELECTION',
            payload: {
                text: selectedText,
                selection: {
                    bookSlug: book.slug,
                    bookName: book.name,
                    scope: selection.scope,
                    startSectionOrdinal: selection.startOrdinal,
                    endSectionOrdinal: selection.endOrdinal,
                    sectionCount: selection.sectionCount,
                    locator: selection.locators,
                },
            },
        });
    }, [dispatch]);
    const hasInput = text.trim().length > 0;

    return (
        <div dir="rtl" data-theme={isDarkMode ? 'dark' : 'light'} className={`app-shell ${hasInput ? 'app-shell-has-nav' : ''} min-h-screen font-sans p-4 sm:p-6 lg:p-8 transition-colors duration-500 ${isDarkMode ? 'bg-gray-900 text-gray-200' : 'bg-gradient-to-br from-slate-100 to-blue-100 text-gray-900'}`}>
            <GlobalStyles />
            <div className="max-w-7xl mx-auto">
                <div className="mb-5 flex justify-center">
                    <a
                        href="https://github.com/EdanDa/AlephEfes"
                        target="_blank"
                        rel="noreferrer"
                        className={`app-repository-link inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm sm:text-base font-semibold transition-colors noselect ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-100' : 'bg-slate-100 hover:bg-slate-300 text-slate-800'}`}
                        aria-label="פתח את Aleph Efes ב-GitHub"
                        title="Aleph Efes on GitHub"
                    >
                        <Icon name="github" className="w-5 h-5" />
                        <span dir="ltr">Aleph Efes</span>
                    </a>
                </div>
                <header className="app-header mb-8 flex justify-between items-center">
                    <div className="app-header-copy text-right">
                        <h1 className="app-title text-5xl font-bold bg-gradient-to-l from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">{mode === 'aleph-zero' ? 'מצב א=0' : 'מצב א=1'}</h1>
                        <p className={`app-subtitle text-base sm:text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            כלי לניתוח אלפביתי־מספרי ומבני של טקסט עברי
                        </p>
                    </div>
                    <div className="app-header-actions flex items-center gap-4">
                        <Legend />
                        <div className="app-value-table-action relative" onMouseEnter={handleTableIconEnter} onMouseLeave={handleTableIconLeave}>
                            <button aria-expanded={isValueTableOpen} ref={valueTableButtonRef} onClick={handleTableIconClick} className={`p-2 rounded-full text-xl transition-colors noselect ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-slate-100 hover:bg-slate-300'}`} aria-label="הצג טבלת ערכי אותיות">
                                <Icon name="hash" className="w-5 h-5 text-purple-600"/>
                            </button>
                        </div>
                        <button onClick={() => dispatch({ type: 'TOGGLE_THEME_MODE' })} className={`app-theme-toggle p-2 rounded-full text-xl transition-colors noselect ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`} aria-label={isDarkMode ? 'עבור למצב בהיר' : 'עבור למצב כהה'}>
                            {isDarkMode ? <Icon name="sun" className="w-5 h-5 text-yellow-400"/> : <Icon name="moon" className="w-5 h-5 text-blue-600"/>}
                        </button>
                    </div>
                </header>

                {isValueTableOpen && (
                    <div ref={valueTableRef} className={`app-value-table-card p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
                        <h2 className="app-value-table-title text-2xl font-bold mb-4 text-center">טבלת ערכי אותיות ({mode === 'aleph-zero' ? 'א=0' : 'א=1'})</h2>
                        <div className="app-value-tables flex justify-center gap-8">
                            { [0, 11].map(offset => (
                                <table key={offset} className="text-center w-full max-w-xs"><thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-slate-100 to-indigo-100'}>
                                    <tr>{['אות', 'יחידות', 'עשרות', 'מאות'].map(header => <th key={header} className="p-2 font-semibold">{header}</th>)}</tr>
                                </thead><tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                    {Object.keys(SAFE_BASE_LETTER_VALUES).slice(offset, offset + 11).map(letter => {
                                        const rec = letterTable.get(letter);
                                        const finalForm = Object.keys(HEB_FINALS).find(key => HEB_FINALS[key] === letter);
                                        if (!rec) return null;
                                        return (
                                        <tr key={letter} className={isDarkMode ? 'hover:bg-gray-700/50' : 'hover:bg-slate-100'}>
                                            <td className="p-2 font-bold text-xl flex items-center justify-center gap-2"><span>{letter}</span>{finalForm && <span className="text-gray-500 dark:text-gray-400">{finalForm}</span>}</td>
                                            <td className="p-2 font-mono">{rec.u}</td><td className="p-2 font-mono">{rec.t}</td><td className="p-2 font-mono">{rec.h}</td>
                                        </tr>);
                                    })}
                                </tbody></table>
                            ))}
                        </div>
                    </div>
                )}
                
                {!isValueTableOpen && (
                <>
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsTanakhOpen((open) => !open)}
                            className={`rounded-full border px-5 py-2 font-semibold transition-colors ${isTanakhOpen ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' : (isDarkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100')}`}
                            aria-expanded={isTanakhOpen}
                        >
                            {isTanakhOpen ? 'סגור תנ״ך' : 'פתח תנ״ך'}
                        </button>
                        {corpusSelection && (
                            <span className={`rounded-full px-3 py-1.5 text-xs ${isDarkMode ? 'bg-gray-800 text-gray-300 border border-gray-700' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                MAM · {corpusSelection.bookName} · {corpusSelection.scope === 'book'
                                    ? 'הספר כולו'
                                    : corpusSelection.sectionCount === 1
                                        ? `פרשיה ${corpusSelection.startSectionOrdinal}`
                                        : `פרשיות ${corpusSelection.startSectionOrdinal}–${corpusSelection.endSectionOrdinal}`}
                            </span>
                        )}
                    </div>

                    {isTanakhOpen && (
                        <Suspense fallback={<div className={`rounded-xl border p-8 mb-8 text-center ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-300'}`}>טוען תנ״ך…</div>}>
                            <TanakhNavigator currentSelection={corpusSelection} isDarkMode={isDarkMode} onSelect={handleCorpusSelection} />
                        </Suspense>
                    )}

                    <div className={`app-card p-6 rounded-xl border mb-8 transition-all ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)] hover:shadow-xl'}`}>
                        <div className="app-input-toolbar grid grid-cols-[1fr_auto_1fr] items-center mb-2 gap-4">
                            <div className={`app-mode-toggle flex items-center p-1 rounded-full justify-self-start w-fit ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                <button aria-pressed={mode === 'aleph-zero'} onClick={() => handleModeChange('aleph-zero')} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors noselect ${mode === 'aleph-zero' ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-600 shadow') : ''}`}>א=0</button>
                                <button aria-pressed={mode === 'aleph-one'} onClick={() => handleModeChange('aleph-one')} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors noselect ${mode === 'aleph-one' ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-600 shadow') : ''}`}>א=1</button>
                            </div>
                            <div className="app-clear-control flex justify-center">
                                <button
                                    type="button"
                                    onClick={handleClearText}
                                    disabled={!text}
                                    className={`px-4 py-1 text-sm font-semibold rounded-md border transition-colors noselect ${!text ? 'opacity-50 cursor-not-allowed' : ''} ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600 disabled:hover:bg-gray-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 disabled:hover:bg-white'}`}
                                >
                                    אפס
                                </button>
                            </div>
                            <label className="app-text-size-control flex items-center justify-self-end gap-2 text-sm font-semibold noselect">
                                <span>גופן</span>
                                <select
                                    dir="rtl"
                                    value={textSize}
                                    onChange={handleTextSizeChange}
                                    className={`px-3 py-1 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-slate-300 text-gray-800'}`}
                                >
                                    {TEXT_SIZE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <MainTextInput
                            text={text}
                            isDarkMode={isDarkMode}
                            textSize={textSize}
                            onTextChange={handleTextChange}
                            onDraftChange={handleDraftChange}
                        />
                        <div className="mt-4 flex flex-wrap justify-center items-center gap-2 min-h-5 text-center">
                            {isPending && <span role="status" className="text-sm text-gray-600 dark:text-gray-300 noselect">מחשב... התוצאות הקודמות אינן זמינות לייצוא עד לסיום.</span>}
                        </div>
                    </div>

                    {analysisError && !isPending && (
                        <div role="alert" className="mb-6 rounded-lg border border-red-400 bg-red-50 text-red-900 p-4 dark:bg-gray-800 dark:text-red-300">
                            <p>לא ניתן להשלים את החישוב. הטקסט נשמר ואפשר לנסות שוב.</p>
                            <button type="button" onClick={retryAnalysis} className="mt-2 rounded-lg border px-4 py-2 font-semibold">נסה שוב</button>
                        </div>
                    )}
                    <StatsPanel />

                    {hasInput && (
                        <div className="app-view-nav sticky top-3 z-40 flex justify-center my-8">
                            <div className={`app-view-tabs ${showScrollTop ? 'app-view-tabs-has-top' : ''} flex items-center p-1 rounded-full noselect border backdrop-blur-sm ${isDarkMode ? 'bg-gray-700/95 border-gray-600 shadow-lg shadow-black/30' : 'bg-gray-200/95 border-slate-300 shadow-md shadow-slate-300/70'}`}>
                                <button aria-label="שכיחות" aria-pressed={view === 'hot-words'} onClick={() => handleViewChange('hot-words')} className={`app-view-tab px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 ${view === 'hot-words' ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-600 shadow') : ''}`}><Icon name="bar-chart" className="w-4 h-4" /><span className="app-view-tab-label">שכיחות</span></button>
                                <button aria-label="פירוט" aria-pressed={view === 'lines'} onClick={() => handleViewChange('lines')} className={`app-view-tab px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 ${view === 'lines' ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-600 shadow') : ''}`}><Icon name="grid" className="w-4 h-4" /><span className="app-view-tab-label">פירוט</span></button>
                                <button aria-label="קבוצות" aria-pressed={view === 'clusters'} onClick={() => handleViewChange('clusters')} className={`app-view-tab px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 ${view === 'clusters' ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-600 shadow') : ''}`}><Icon name="network" className="w-4 h-4" /><span className="app-view-tab-label">קבוצות</span></button>
                                <button aria-label="גרף" aria-pressed={view === 'graph'} onClick={() => handleViewChange('graph')} className={`app-view-tab px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 ${view === 'graph' ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-600 shadow') : ''}`}><Icon name="activity" className="w-4 h-4" /><span className="app-view-tab-label">גרף</span></button>
                                <button aria-label="רשת" aria-pressed={view === 'network'} onClick={() => handleViewChange('network')} className={`app-view-tab px-4 py-2 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 ${view === 'network' ? (isDarkMode ? 'bg-blue-500 text-white shadow' : 'bg-white text-blue-600 shadow') : ''}`}><Icon name="share-2" className="w-4 h-4" /><span className="app-view-tab-label">רשת</span></button>
                                {showScrollTop && <button type="button" className="app-mobile-scroll-top rounded-full" aria-label="גלול לראש העמוד" onClick={scrollToTop}><Icon name="arrow-up" className="w-5 h-5" /></button>}
                            </div>
                        </div>
                    )}

                    <div ref={viewContentTopRef} />
                    <div className="app-analysis-results" aria-busy={isPending} inert={isAnalysisStale ? '' : undefined} style={isAnalysisStale ? { opacity: 0.6 } : undefined}>

                    {stats && (
                        <div className={`app-distribution-card p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
                            <div className="app-results-header flex justify-between items-center mb-4 noselect">
                                <div className="flex-1"></div>
                                <h3 className="app-results-title text-2xl font-bold text-center flex-grow">התפלגות שורשים דיגיטליים · צורות מילים שונות</h3>
                                <div className="flex-1 flex justify-end"></div>
                            </div>
                            <div className={`app-dr-row flex justify-around items-center p-2 rounded-lg h-28 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                                {drOrder.map((dr) => {
                                    const count = stats.drDistribution[dr] || 0;
                                    const maxCount = Math.max(...stats.drDistribution.slice(1));
                                    const hasWords = count > 0;
                                    const isPrimeDR = [2,3,5,7].includes(dr);
                                    const primeColorClasses = COLOR_PALETTE[primeColor];
                                    const indicatorSize = hasWords ? 22 + (12 * (hasWords && maxCount > 0 ? Math.pow(count / maxCount, 0.75) : 0)) : 0;
                                    
                                    return (
                                        <div key={dr} className="app-dr-item flex flex-col items-center w-1/12 h-full justify-center group">
                                            <button
                                                type="button"
                                                disabled={!hasWords}
                                                className={`flex flex-col items-center w-full h-full justify-center group rounded-md p-1 transition-all ${hasWords ? 'cursor-pointer hover:bg-gray-200/80 dark:hover:bg-gray-600/40' : 'cursor-not-allowed'} ${selectedDR === dr ? 'border-2 border-purple-500 dark:border-purple-400' : 'border-2 border-transparent'}`}
                                                onClick={() => handleDrillDown(dr)}
                                                aria-pressed={selectedDR === dr}
                                                aria-label={`ש"ד ${dr}${hasWords ? '' : ' (ללא תוצאות)'}`}
                                                title={hasWords ? `סינון לפי ש"ד ${dr}` : `ש"ד ${dr} - ללא מילים`}
                                            >
                                                <div className="h-8 flex items-center justify-center mb-1">
                                                    {hasWords ? <div className="rounded-full flex items-center justify-center bg-blue-600 text-xs font-bold text-white shadow-md" style={{ width: `${indicatorSize}px`, height: `${indicatorSize}px` }}>{count}</div> : <span className="app-dr-empty text-gray-400" aria-hidden="true">—</span>}
                                                </div>
                                                <div className={`app-dr-label font-bold text-lg mt-1 ${!hasWords ? 'text-gray-500 dark:text-gray-400' : selectedDR === dr ? 'text-purple-700 dark:text-purple-300' : isPrimeDR ? `${primeColorClasses.light} ${primeColorClasses.dark}` : 'text-gray-600 dark:text-gray-400'}`}><span className="app-dr-prefix">ש"ד</span>{" "}<span>{dr}</span></div>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {view === 'lines' && coreResults && (
                        <>
                            {detailsView === 'lines' ? (
                                <>
                                    {coreResults.grandTotals && (
                                        <div className={`app-detail-summary p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
                                            <div className="app-results-header flex justify-between items-center mb-4">
                                                <div className="flex-1 flex justify-start"><ExportToolbar getText={prepareAllDetailsText} getCSV={prepareAllDetailsCSV} getJSON={prepareAllDetailsJSON} id='all-details' /></div>
                                                <div className="flex-none px-4"><h2 className="text-2xl font-bold text-center noselect">סיכום כללי</h2></div>
                                                <div className="flex-1 flex justify-end">
                                                    <div className={`app-segmented-control flex items-center p-1 rounded-full noselect ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                                        <button aria-pressed={detailsView === 'lines'} onClick={() => dispatch({ type: 'SET_DETAILS_VIEW', payload: 'lines' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${detailsView === 'lines' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>שורות</button>
                                                        <button aria-pressed={detailsView === 'words'} onClick={() => dispatch({ type: 'SET_DETAILS_VIEW', payload: 'words' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${detailsView === 'words' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>מילים</button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-flow-col md:auto-cols-fr gap-4 text-center">
                                                <div className="p-4 rounded-lg bg-slate-200 dark:bg-gray-700/50"> <p className="text-sm text-gray-700 dark:text-gray-300 uppercase font-semibold">Σ-יחידות (סה"כ)</p> <TotalNumberDisplay value={coreResults.grandTotals.units} isPrimeFlag={coreResults.grandTotals.isPrime.U} primeColor={primeColor} layer="U" filters={filters}/> </div>
                                                <div className="p-4 rounded-lg bg-slate-200 dark:bg-gray-700/50"> <p className="text-sm text-gray-700 dark:text-gray-300 uppercase font-semibold">Σ-עשרות (סה"כ)</p> <TotalNumberDisplay value={coreResults.grandTotals.tens} isPrimeFlag={coreResults.grandTotals.isPrime.T} primeColor={primeColor} layer="T" filters={filters}/> </div>
                                                <div className="p-4 rounded-lg bg-slate-200 dark:bg-gray-700/50"> <p className="text-sm text-gray-700 dark:text-gray-300 uppercase font-semibold">Σ-מאות (סה"כ)</p> <TotalNumberDisplay value={coreResults.grandTotals.hundreds} isPrimeFlag={coreResults.grandTotals.isPrime.H} primeColor={primeColor} layer="H" filters={filters}/> </div>
                                                <div className="p-4 rounded-lg bg-slate-200 dark:bg-gray-700/50"> <p className="text-sm text-gray-700 dark:text-gray-300 uppercase font-semibold">ש"ד (סה"כ)</p> <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{coreResults.grandTotals.dr}</p> </div>
                                            </div>
                                        </div>
                                    )}
                                    {coreResults.primeSummary.length > 0 && (
                                        <div
                                            className={`app-prime-summary relative p-4 sm:p-6 rounded-xl border mb-8 cursor-pointer ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}
                                            aria-expanded={!isPrimesCollapsed}
                                            onClick={() => dispatch({ type: 'TOGGLE_PRIMES_COLLAPSED' })}
                                            aria-label="הצג או הסתר פירוט ערכים ראשוניים"
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    dispatch({ type: 'TOGGLE_PRIMES_COLLAPSED' });
                                                }
                                            }}
                                        >
                                            <Icon name="chevron-down" className={`absolute top-4 left-4 w-6 h-6 text-gray-800 dark:text-gray-200 transition-transform duration-300 ${isPrimesCollapsed ? '' : 'rotate-180'}`} />
                                            <h2 className="text-2xl font-bold text-center mb-4 text-gray-800 dark:text-gray-200 noselect">מדדי ראשוניות שורות</h2>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-center">
                                                <div className="p-4 rounded-lg bg-slate-200 dark:bg-gray-700/50">
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold">שורות ראשוניות</p>
                                                    <p className="text-3xl font-bold text-slate-900 dark:text-gray-100">{stats.primeLineTotals}</p>
                                                </div>
                                                <div className="p-4 rounded-lg bg-slate-200 dark:bg-gray-700/50">
                                                    <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold">ערכים ראשוניים</p>
                                                    <p className="text-3xl font-bold text-slate-900 dark:text-gray-100">{coreResults.primeSummary.length}</p>
                                                </div>
                                            </div>
                                            {!isPrimesCollapsed && (
                                                <div className="mt-4">
                                                    <div className="overflow-x-auto max-w-lg mx-auto">
                                                        <table className="min-w-full"><thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-slate-100 to-emerald-100'}>
                                                            <tr><th className="px-4 py-3 text-center">שורה</th><th className="px-4 py-3 text-center">ערך ראשוני</th><th className="px-4 py-3 text-center">שכבה</th></tr>
                                                        </thead><tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                                                            {coreResults.primeSummary.map((primeInfo, index) => {
                                                                const layers = primeInfo.layers.map(l => l === 'יחידות' ? 'U' : l === 'עשרות' ? 'T' : 'H');
                                                                if (!layers.some(l => filters[l])) return null;

                                                                return (
                                                                <tr key={index} className={`transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-emerald-50'}`}><td className="px-4 py-3 text-center">{primeInfo.line}</td><td className="px-4 py-3 text-center font-bold text-emerald-600 tabular-nums">{primeInfo.value}</td><td className="px-4 py-3 text-center">{primeInfo.layers.join(', ')}</td></tr>
                                                            )})}
                                                        </tbody></table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="research-detail-controls">
                                        {coreResults.lines.some((line) => line.words.length > 1) && <div className="research-numbering-control">
                                            <span>מספור מילים בשורה</span>
                                            <div role="group" aria-label="תחילת מספור המילים" className="research-numbering-options">
                                                {[1, 0].map((start) => <button key={start} type="button" aria-pressed={wordNumberingStart === start} onClick={() => dispatch({ type: 'SET_WORD_NUMBERING_START', payload: start })}>ספירה מ־{start}</button>)}
                                            </div>
                                            <small>לפי המיקום בשורת המקור, לפני סינון.</small>
                                        </div>}
                                        <button onClick={() => dispatch({ type: 'TOGGLE_ALL_ROWS' })} className="bg-gray-200 dark:bg-gray-700/50 text-slate-600 dark:text-gray-300 px-3 py-1 rounded-md text-sm hover:bg-slate-300 dark:hover:bg-gray-700 transition-colors noselect">{coreResults && Object.keys(expandedRows).length === coreResults.lines.length && Object.values(expandedRows).every(v => v) ? 'קפל הכל' : 'פתח הכל'}</button>
                                    </div>
                                    {coreResults.lines.map((lineResult, lineIndex) => {
                                        const isExpanded = !!expandedRows[lineIndex];
                                        const visibleWords = visibleWordsByLine[lineIndex] || [];
                                        const showTotalsLine = !isExpanded || lineResult.words.length > 1;
                                        const unitsVisible = isValueVisible('U', lineResult.isPrimeTotals.U, filters);
                                        const tensVisible = isValueVisible('T', lineResult.isPrimeTotals.T, filters);
                                        const hundredsVisible = isValueVisible('H', lineResult.isPrimeTotals.H, filters);
                                        const tensUsesDitto = tensVisible && shouldUseDitto(lineResult.totals.tens, lineResult.totals.units, unitsVisible);
                                        const hundredsUsesDitto = hundredsVisible && shouldUseDitto(lineResult.totals.hundreds, lineResult.totals.tens, tensVisible);
                                        if (visibleWords.length === 0) return null;

                                        return (
                                            <div
                                                key={lineIndex}
                                                className={`app-line-card p-4 sm:p-6 rounded-xl border mb-8 transition-shadow ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)] hover:shadow-xl'}`}
                                                style={{ contentVisibility: 'auto', containIntrinsicSize: '560px' }}
                                            >
                                                <button type="button" className="w-full text-right cursor-pointer" onClick={() => dispatch({ type: 'TOGGLE_ROW_EXPAND', payload: lineIndex })} aria-expanded={isExpanded} aria-label={`החלף מצב תצוגה עבור שורה ${lineIndex + 1}`}>
                                                    <div className="flex justify-between items-center"><h2 className="app-line-heading text-2xl font-bold mb-1 text-center flex-grow">שורה {lineIndex + 1}</h2><Icon name="chevron-down" className={`w-6 h-6 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} /></div>
                                                    <p className={`app-line-text text-center mb-6 italic text-lg break-all ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>"{lineResult.lineText}"</p>
                                                    {showTotalsLine && <div className={`app-line-totals font-bold text-sm text-center p-2 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-slate-200 text-gray-900'}`}><span className="app-line-totals-label">סה"כ שורה:</span>
                                                        {lineResult.words.length > 1 && <span className="app-line-word-count mx-2">({lineResult.words.length} מילים)</span>}
                                                        {unitsVisible && <span className={`app-line-total mx-2 ${lineResult.isPrimeTotals.U ? `${COLOR_PALETTE[primeColor].light} ${COLOR_PALETTE[primeColor].dark}` : ''}`}>יחידות={lineResult.totals.units}{lineResult.isPrimeTotals.U && '♢'}</span>}
                                                        {tensVisible && <span className={`app-line-total mx-2 ${lineResult.isPrimeTotals.T && !tensUsesDitto ? `${COLOR_PALETTE[primeColor].light} ${COLOR_PALETTE[primeColor].dark}` : ''}`}>עשרות={tensUsesDitto ? '〃' : lineResult.totals.tens}{lineResult.isPrimeTotals.T && !tensUsesDitto && '♢'}</span>}
                                                        {hundredsVisible && <span className={`app-line-total mx-2 ${lineResult.isPrimeTotals.H && !hundredsUsesDitto ? `${COLOR_PALETTE[primeColor].light} ${COLOR_PALETTE[primeColor].dark}` : ''}`}>מאות={hundredsUsesDitto ? '〃' : lineResult.totals.hundreds}{lineResult.isPrimeTotals.H && !hundredsUsesDitto && '♢'}</span>}
                                                        <span className="app-line-total mx-2">ש"ד={lineResult.totalsDR}</span>
                                                    </div>}
                                                </button>
                                                {isExpanded && (
                                                    <div className="overflow-x-auto mt-4">
                                                        <table className="research-detail-table min-w-full">
                                                            <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-slate-100 to-indigo-100'}>
                                                                <tr>
                                                                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider rounded-r-lg">מילה</th>
                                                                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">חישוב</th>
                                                                    {filters.U && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-יחידות</th>}
                                                                    {filters.T && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-עשרות</th>}
                                                                    {filters.H && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-מאות</th>}
                                                                    <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider rounded-l-lg">ש"ד</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>{visibleWords.map((res, index) => (
                                                                <tr key={index} className={`transition-colors duration-200 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-slate-50 hover:bg-indigo-50'}`}>
                                                                    <td className="px-4 py-3 font-bold text-lg text-blue-800 dark:text-blue-300 whitespace-nowrap rounded-r-lg text-right"><span className="research-detail-word">{lineResult.words.length > 1 && <span className="research-detail-position" dir="ltr" aria-label={`מיקום מילה בשורה: ${visibleWordPositionsByLine[lineIndex][index] - 1 + wordNumberingStart}`}>{visibleWordPositionsByLine[lineIndex][index] - 1 + wordNumberingStart}</span>}<span>{res.word}</span><InspectWord word={res.word} lineIndex={lineIndex} wordPosition={visibleWordPositionsByLine[lineIndex][index]} compact /></span></td>
                                                                    <td className="px-4 py-3 text-sm text-right font-mono" style={{ direction: 'ltr', textAlign: 'right' }}>{getLetterDetails(res.word, letterTable).map(l => l.value).join('+')}</td>
                                                                    {filters.U && <ValueCell value={res.units} isPrimeFlag={res.isPrimeU} primeColor={primeColor} layer="U" filters={filters} />}
                                                                    {filters.T && <ValueCell value={res.tens} isPrimeFlag={res.isPrimeT} previousValue={res.units} previousLayer="U" previousIsPrimeFlag={res.isPrimeU} primeColor={primeColor} layer="T" filters={filters} />}
                                                                    {filters.H && <ValueCell value={res.hundreds} isPrimeFlag={res.isPrimeH} previousValue={res.tens} previousLayer="T" previousIsPrimeFlag={res.isPrimeT} primeColor={primeColor} layer="H" filters={filters} />}
                                                                    <td className="px-4 py-3 text-center font-semibold text-violet-900 dark:text-purple-300 text-lg rounded-l-lg">{res.dr}</td>
                                                                </tr>
                                                            ))}</tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </>
                            ) : (
                                <div className={`p-4 sm:p-6 rounded-xl border mb-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
                                    <div className="app-results-header flex justify-between items-center mb-4">
                                        <div className="flex-1 flex justify-start"><ExportToolbar getText={prepareAllDetailsText} getCSV={prepareAllDetailsCSV} getJSON={prepareAllDetailsJSON} id='all-details' /></div>
                                        <div className="flex-none px-4"><h2 className="text-2xl font-bold text-center noselect">סיכום מילים ייחודיות ({coreResults.allWords.length} מילים)</h2></div>
                                        <div className="flex-1 flex justify-end">
                                            <div className={`app-segmented-control flex items-center p-1 rounded-full noselect ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                                <button aria-pressed={detailsView === 'lines'} onClick={() => dispatch({ type: 'SET_DETAILS_VIEW', payload: 'lines' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${detailsView === 'lines' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>שורות</button>
                                                <button aria-pressed={detailsView === 'words'} onClick={() => dispatch({ type: 'SET_DETAILS_VIEW', payload: 'words' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${detailsView === 'words' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>מילים</button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="app-word-table research-detail-table min-w-full">
                                            <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gradient-to-l from-slate-100 to-indigo-100'}>
                                                <tr>
                                                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider rounded-r-lg">מילה</th>
                                                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">חישוב</th>
                                                    {filters.U && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-יחידות</th>}
                                                    {filters.T && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-עשרות</th>}
                                                    {filters.H && <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Σ-מאות</th>}
                                                    <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider rounded-l-lg">ש"ד</th>
                                                </tr>
                                            </thead>
                                            <tbody>{visibleAllWords.map((res, index) => (
                                                <tr key={index} className={`transition-colors duration-200 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-slate-50 hover:bg-indigo-50'}`}>
                                                    <td className="px-4 py-3 font-bold text-lg text-blue-800 dark:text-blue-300 whitespace-nowrap rounded-r-lg text-right"><span className="research-detail-word"><span>{res.word}</span><InspectWord word={res.word} compact /></span></td>
                                                    <td className="px-4 py-3 text-sm text-right font-mono" style={{ direction: 'ltr', textAlign: 'right' }}>{getLetterDetails(res.word, letterTable).map(l => l.value).join('+')}</td>
                                                    {filters.U && <ValueCell value={res.units} isPrimeFlag={res.isPrimeU} primeColor={primeColor} layer="U" filters={filters} />}
                                                    {filters.T && <ValueCell value={res.tens} isPrimeFlag={res.isPrimeT} previousValue={res.units} previousLayer="U" previousIsPrimeFlag={res.isPrimeU} primeColor={primeColor} layer="T" filters={filters} />}
                                                    {filters.H && <ValueCell value={res.hundreds} isPrimeFlag={res.isPrimeH} previousValue={res.tens} previousLayer="T" previousIsPrimeFlag={res.isPrimeT} primeColor={primeColor} layer="H" filters={filters} />}
                                                    <td className="px-4 py-3 text-center font-semibold text-violet-900 dark:text-purple-300 text-lg rounded-l-lg">{res.dr}</td>
                                                </tr>
                                            ))}</tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    
                    {view === 'clusters' && coreResults && (
                        <ClusterView 
                            clusterRefs={clusterRefs}
                            isAnalysisStale={isAnalysisStale}
                            unpinOnBackgroundClick={unpinOnBackgroundClick}
                            filteredWordsInView={filteredWordsInView}
                            pinnedWord={pinnedWord}
                            hoveredWord={hoveredWord}
                            isDarkMode={isDarkMode}
                            primeColor={primeColor}
                            dispatch={dispatch}
                            copySummaryToClipboard={prepareSummaryText}
                            prepareSummaryCSV={prepareSummaryCSV}
                            prepareSummaryJSON={prepareSummaryJSON}
                            copiedId={copiedId}
                            searchTerm={searchTerm}
                        />
                    )}

                    {view === 'hot-words' && coreResults && (
                        <div className={`app-results-card app-frequency-card p-4 sm:p-6 rounded-xl border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-50/95 border-slate-300 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.7)]'}`}>
                            <div className="app-results-header flex justify-between items-center mb-4">
                                <div className="flex-1 flex justify-start"><ExportToolbar getText={selectedHotValue !== null ? prepareHotWordsText : prepareFrequenciesText} getCSV={selectedHotValue !== null ? prepareHotWordsCSV : prepareFrequenciesCSV} getJSON={selectedHotValue !== null ? prepareHotWordsJSON : prepareFrequenciesJSON} id='hot-words' /></div>
                                <div className="app-results-heading flex-none px-4"><h2 className="app-results-title text-2xl font-bold text-center noselect">ניתוח שכיחויות</h2></div>
                                <div className="flex-1 flex justify-end">
                                    <div className={`app-segmented-control flex items-center p-1 rounded-full noselect ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                        <button aria-pressed={hotView === 'values'} onClick={() => dispatch({ type: 'SET_HOT_VIEW', payload: 'values' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${hotView === 'values' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>ערכים</button>
                                        <button aria-pressed={hotView === 'words'} onClick={() => dispatch({ type: 'SET_HOT_VIEW', payload: 'words' })} className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${hotView === 'words' ? 'bg-white dark:bg-blue-500 text-blue-600 dark:text-white shadow' : ''}`}>מילים</button>
                                    </div>
                                </div>
                            </div>
                            {hotView === 'values' && (
                                <div>
                                    {selectedHotValue === null ? (
                                        <div>
                                            <div className={`app-frequency-table-header flex text-right sticky top-0 p-2 font-semibold border-b noselect ${isDarkMode ? 'bg-gray-800 text-gray-100 border-gray-700' : 'bg-slate-800 text-white border-slate-700'}`}>
                                                <button type="button" className="w-1/4 text-right cursor-pointer" onClick={() => dispatch({ type: 'SET_HOT_SORT', payload: 'value' })} aria-label="מיין לפי ערך">ערך {hotSort.key === 'value' && (hotSort.order === 'desc' ? '↓' : '↑')}</button>
                                                <button type="button" className="w-1/4 text-center cursor-pointer" onClick={() => dispatch({ type: 'SET_HOT_SORT', payload: 'count' })} aria-label="מיין לפי כמות מילים">כמות {hotSort.key === 'count' && (hotSort.order === 'desc' ? '↓' : '↑')}</button>
                                                <div className="w-1/2">מילים</div>
                                            </div>
                                            <VirtualizedList
                                                items={sortedHotViewList}
                                                itemHeight={40}
                                                listHeight={384} 
                                                getKey={(item) => item.value}
                                                renderItem={({ value, count }) => (
                                                    <button type="button" disabled={isAnalysisStale} aria-label={`הצג מילים עם הערך ${value}`} className="app-frequency-table-row w-full flex items-center text-right hover:bg-gradient-to-l from-slate-100 to-indigo-100 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-200 dark:border-gray-700/50 noselect" style={{ height: 40 }} onClick={() => dispatch({ type: 'SET_SELECTED_HOT_VALUE', payload: { value, list: visibleValueToWordsMap.get(value) || [] } })}>
                                                        <div className="w-1/4 p-2 font-bold text-lg text-blue-700 dark:text-blue-300">{value}</div>
                                                        <div className="w-1/4 p-2 text-center text-gray-900 dark:text-gray-100">{count}</div>
                                                        <div className="w-1/2 p-2 text-sm text-gray-700 dark:text-gray-300 truncate">{[...new Set((visibleValueToWordsMap.get(value) || []).map(w => w.word))].join(', ')}</div>
                                                    </button>
                                                )}
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="app-drilldown-header flex justify-between items-center mb-4 noselect gap-3 flex-wrap">
                                                <h3 className="text-xl font-bold">מילים עם הערך {selectedHotValue}</h3>
                                                <div className="app-drilldown-actions flex items-center gap-2">
                                                    {pinnedWord && (
                                                        <div className={`text-sm px-3 py-1 rounded-full border ${isDarkMode ? 'bg-amber-900/40 border-amber-700 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
                                                            מילה נעוצה: {pinnedWord.word}
                                                        </div>
                                                    )}
                                                    <button onClick={() => dispatch({ type: 'CLEAR_SELECTED_HOT_VALUE' })} className="bg-gray-200 dark:bg-gray-700/50 text-slate-700 dark:text-gray-300 px-4 py-2 rounded-lg text-base font-semibold hover:bg-slate-300 dark:hover:bg-gray-700 transition-colors">חזור לרשימה</button>
                                                </div>
                                            </div>
                                            {visibleHotWords.length === 0 ? (
                                                <div className={`rounded-lg border p-4 text-sm ${isDarkMode ? 'bg-gray-900/40 border-gray-700 text-gray-300' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>
                                                    אין ערכים גלויים תחת הסינון הנוכחי. נסו להפעיל שכבות נוספות באגדת הסינון.
                                                </div>
                                            ) : (
                                            <div className="app-cluster-grid flex flex-wrap justify-start gap-2" onClick={unpinOnBackgroundClick}>
                                                {visibleHotWords.map((wordData, index) => (
                                                    <WordCard 
                                                        key={wordData.word}
                                                        wordData={wordData}
                                                        isAnalysisStale={isAnalysisStale}
                                                        pinnedWord={pinnedWord}
                                                        activeWord={activeWord}
                                                        activeWordKey={activeWordKey}
                                                        isConnectedToActive={hotConnectedWordsSet.has(wordData.word)}
                                                        isDarkMode={isDarkMode}
                                                        primeColor={primeColor}
                                                        connectionValues={connectionValues}
                                                        dispatch={dispatch}
                                                        filters={deferredFilters}
                                                    />
                                                ))}
                                            </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            {hotView === 'words' && (
                                <div>
                                    <div className={`flex text-right sticky top-0 p-2 font-semibold border-b noselect ${isDarkMode ? 'bg-gray-800 text-gray-100 border-gray-700' : 'bg-slate-800 text-white border-slate-700'}`}>
                                        <div className="w-3/4">מילה</div>
                                        <button type="button" className="w-1/4 text-center cursor-pointer" aria-label="מיין לפי כמות מופעים" onClick={() => dispatch({ type: 'SET_HOT_SORT', payload: 'count' })}>כמות {hotSort.key === 'count' && (hotSort.order === 'desc' ? '↓' : '↑')}</button>
                                    </div>
                                    <VirtualizedList items={sortedHotViewList} itemHeight={60} listHeight={384} getKey={(item) => item.word} renderItem={({ word, count }) => (
                                        <div className="flex items-center text-right hover:bg-gradient-to-l from-slate-100 to-indigo-100 dark:hover:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700/50 noselect" style={{ height: 60 }}>
                                            <div className="w-3/4 p-2 font-bold text-lg text-blue-700 dark:text-blue-300">{word}</div>
                                            <div className="w-1/4 p-2 text-center font-mono text-gray-900 dark:text-gray-100">{count}</div>
                                            <InspectWord word={word} />
                                        </div>
                                    )} />
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'graph' && coreResults && (
                        <GraphView 
                            coreResults={coreResults}
                            filters={deferredFilters}
                            isDarkMode={isDarkMode}
                            primeColor={primeColor}
                            onWordClick={handleWordClick}
                            selectedDR={selectedDR}
                        />
                    )}

                    {view === 'network' && coreResults && (
                        <NetworkView 
                            coreResults={coreResults}
                            filters={deferredFilters}
                            isDarkMode={isDarkMode}
                            primeColor={primeColor}
                            onWordClick={handleWordClick}
                            selectedDR={selectedDR}
                        />
                    )}
                    </div>
                </>
                )}
                {showScrollTop && (
                    <div className="app-scroll-top fixed top-1/2 right-5 -translate-y-1/2 z-50 group">
                        <button onClick={scrollToTop} aria-label="גלול לראש העמוד" className="bg-gray-800/55 dark:bg-white/20 text-white p-3 rounded-full hover:bg-gray-800/75 dark:hover:bg-white/30 transition-opacity shadow-lg">
                            <Icon name="arrow-up" className="w-7 h-7" />
                        </button>
                        <div className="absolute top-1/2 right-16 -translate-y-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">לראש הדף</div>
                    </div>
                )}
            </div>
            <Analytics />
        </div>
    );
};

// -----------------------------------------------------------------------------
// 9. App Provider & Wrapper
// -----------------------------------------------------------------------------
function WrappedApp() {
	return (
		<AppProvider>
			<ResearchWorkspace><App /></ResearchWorkspace>
		</AppProvider>
	);
}

export default WrappedApp;
