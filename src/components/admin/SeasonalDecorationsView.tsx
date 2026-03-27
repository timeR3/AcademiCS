'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Save, PartyPopper, Calendar as CalendarIcon, Snowflake } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AppSettings, SeasonalDecorationTheme } from '@/types';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { apiGet, apiPatch } from '@/lib/api-client';


export function SeasonalDecorationsView() {
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    // Settings state
    const [decorationsEnabled, setDecorationsEnabled] = useState(false);
    const [decorationTheme, setDecorationTheme] = useState<SeasonalDecorationTheme>('christmas');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    
    // State to track initial settings to check for changes
    const [initialSettings, setInitialSettings] = useState<Partial<AppSettings>>({});
    
    const loadAllSettings = useCallback(async () => {
        setLoadingSettings(true);
        try {
            const settings = await apiGet<AppSettings>('/api/app-settings');
            
            setDecorationsEnabled(settings.seasonalDecorationsEnabled === 'true');
            setDecorationTheme(settings.seasonalDecorationsTheme || 'christmas');
            setStartDate(settings.seasonalDecorationsStartDate ? new Date(settings.seasonalDecorationsStartDate) : undefined);
            setEndDate(settings.seasonalDecorationsEndDate ? new Date(settings.seasonalDecorationsEndDate) : undefined);
            
            setInitialSettings({
                 seasonalDecorationsEnabled: settings.seasonalDecorationsEnabled,
                 seasonalDecorationsTheme: settings.seasonalDecorationsTheme,
                 seasonalDecorationsStartDate: settings.seasonalDecorationsStartDate,
                 seasonalDecorationsEndDate: settings.seasonalDecorationsEndDate,
            });

        } catch (error) {
             toast({
                title: "No se pudieron cargar las configuraciones",
                description: "Se usarán los valores predeterminados.",
                variant: "destructive",
            });
        } finally {
             setLoadingSettings(false);
        }
    }, [toast]);
    
    useEffect(() => {
        loadAllSettings();
    }, [loadAllSettings]);

    const handleSaveChanges = async () => {
        setIsSaving(true);
        try {
            const settingsToSave: Partial<AppSettings> = {
                seasonalDecorationsEnabled: decorationsEnabled ? 'true' : 'false',
                seasonalDecorationsTheme: decorationTheme,
                seasonalDecorationsStartDate: startDate ? startDate.toISOString().split('T')[0] : undefined,
                seasonalDecorationsEndDate: endDate ? endDate.toISOString().split('T')[0] : undefined,
            };

            await apiPatch<{ success: boolean }>('/api/app-settings', settingsToSave);

            toast({
                title: "Configuración Guardada",
                description: `La configuración de decoraciones ha sido actualizada.`
            });
            
            loadAllSettings();

        } catch (error: any) {
             toast({
                title: "Error al Guardar",
                description: `No se pudo guardar la configuración: ${error.message}`,
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Card className="premium-surface">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline"><PartyPopper />Decoraciones de Temporada</CardTitle>
                <CardDescription>
                    Añade un toque festivo a la plataforma. Las decoraciones se mostrarán en la parte superior de la aplicación durante el rango de fechas que elijas.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {loadingSettings ? <p>Cargando configuraciones...</p> : (
                    <>
                        <div className="flex items-start gap-3 rounded-2xl border p-4 sm:items-center">
                            <Switch
                                id="decorations-enabled"
                                checked={decorationsEnabled}
                                onCheckedChange={setDecorationsEnabled}
                                disabled={isSaving}
                            />
                            <Label htmlFor="decorations-enabled" className="text-base font-medium">
                                Habilitar Decoraciones de Temporada
                            </Label>
                        </div>
                        <div className={cn("space-y-6 transition-opacity", !decorationsEnabled && "opacity-50 pointer-events-none")}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="theme-select">Tema de la Decoración</Label>
                                    <Select value={decorationTheme} onValueChange={(v) => setDecorationTheme(v as SeasonalDecorationTheme)} disabled={isSaving}>
                                        <SelectTrigger id="theme-select">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="christmas"><span className="flex items-center gap-2"><Snowflake />Navidad</span></SelectItem>
                                            <SelectItem value="new_year" disabled>Año Nuevo (Próximamente)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Fecha de Inicio</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                                                disabled={isSaving}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {startDate ? format(startDate, 'PPP', { locale: es }) : <span>Elige una fecha</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                     <Label>Fecha de Fin</Label>
                                     <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                                                disabled={isSaving}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {endDate ? format(endDate, 'PPP', { locale: es }) : <span>Elige una fecha</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSaveChanges} disabled={loadingSettings || isSaving}>
                    {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                    Guardar Configuración de Tema
                </Button>
            </CardFooter>
        </Card>
    );
}
