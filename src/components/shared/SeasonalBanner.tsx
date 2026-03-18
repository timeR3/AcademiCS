'use client';
import { useState, useEffect } from 'react';
import { fetchAppSettings } from '@/app/actions';
import type { AppSettings } from '@/types';
import { ChristmasGarland } from './ChristmasGarland';

export function SeasonalBanner() {
    const [settings, setSettings] = useState<Partial<AppSettings>>({});
    const [shouldDisplay, setShouldDisplay] = useState(false);

    useEffect(() => {
        async function loadSettings() {
            try {
                const fetchedSettings = await fetchAppSettings();
                setSettings(fetchedSettings);
                
                const isEnabled = fetchedSettings.seasonalDecorationsEnabled === 'true';
                if (!isEnabled) {
                    setShouldDisplay(false);
                    return;
                }

                // Correct date logic that ignores time and timezone issues.
                const now = new Date();
                now.setHours(0, 0, 0, 0); // Normalize current date to midnight

                const parseLocalDate = (dateString: string) => {
                    const [year, month, day] = dateString.split('-').map(Number);
                    const localDate = new Date(year, month - 1, day);
                    return localDate;
                }

                const start = fetchedSettings.seasonalDecorationsStartDate ? parseLocalDate(fetchedSettings.seasonalDecorationsStartDate) : null;
                const end = fetchedSettings.seasonalDecorationsEndDate ? parseLocalDate(fetchedSettings.seasonalDecorationsEndDate) : null;

                if (start && end && now >= start && now <= end) {
                    setShouldDisplay(true);
                } else {
                    setShouldDisplay(false);
                }

            } catch (error) {
                console.error("Failed to load seasonal settings:", error);
                setShouldDisplay(false);
            }
        }
        loadSettings();
    }, []);

    if (!shouldDisplay) {
        return null;
    }

    const renderDecoration = () => {
        switch (settings.seasonalDecorationsTheme) {
            case 'christmas':
                return <ChristmasGarland />;
            // case 'new_year':
            //     return <NewYearDecoration />;
            default:
                return null;
        }
    }

    return (
        <div className="w-full h-8 pointer-events-none overflow-hidden absolute top-0 left-0 z-50">
            {renderDecoration()}
        </div>
    )
}
