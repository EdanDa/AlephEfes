import React, { memo, useEffect, useMemo, useRef, useState } from 'react';

const VirtualizedList = memo(
    ({ items, itemHeight, listHeight, renderItem, getKey, overscan = 4, className = 'noselect', containerStyle = {} }) => {
        const [scrollTop, setScrollTop] = useState(0);
        const rafId = useRef(null);

        const handleScroll = (e) => {
            const y = e.currentTarget.scrollTop;
            if (rafId.current) cancelAnimationFrame(rafId.current);
            rafId.current = requestAnimationFrame(() => setScrollTop(y));
        };

        useEffect(
            () => () => {
                if (rafId.current) cancelAnimationFrame(rafId.current);
            },
            []
        );

        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const visibleCount = Math.ceil(listHeight / itemHeight) + overscan * 2;
        const endIndex = Math.min(startIndex + visibleCount, items.length);
        const visibleItems = useMemo(() => items.slice(startIndex, endIndex), [items, startIndex, endIndex]);
        const totalHeight = items.length * itemHeight;
        const offsetY = startIndex * itemHeight;

        return (
            <div
                onScroll={handleScroll}
                className={className}
                style={{ height: listHeight, overflowY: 'auto', position: 'relative', ...containerStyle }}
            >
                <div style={{ height: totalHeight }}>
                    <div style={{ transform: `translateY(${offsetY}px)` }}>
                        {visibleItems.map((item, idx) => (
                            <div key={getKey ? getKey(item) : item?.value ?? item?.word ?? startIndex + idx}>
                                {renderItem(item, startIndex + idx)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
);

export default VirtualizedList;
