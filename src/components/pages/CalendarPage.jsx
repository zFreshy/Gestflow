import React from 'react';
import { CalendarGrid } from '../organisms/CalendarGrid';

export function CalendarPage({ transactions }) {
    return (
        <div className="h-full flex flex-col">
            <CalendarGrid transactions={transactions} />
        </div>
    );
}
