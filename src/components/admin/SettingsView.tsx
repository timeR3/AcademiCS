'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Trophy, Calculator, Settings, FolderKanban, Award, Bot, Cpu, PartyPopper } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AppSettings } from '@/types';
import { apiGet, apiPatch } from '@/lib/api-client';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AIConfigView } from './AIConfigView';
import { BadgesView } from './BadgesView';
import { CategoriesView } from './CategoriesView';
import { AIModelsView } from './AIModelsView';
import { SeasonalDecorationsView } from './SeasonalDecorationsView';

export function SettingsView() {
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    // General settings state
    const [minPassingScore, setMinPassingScore] = useState('70');
    const [scoreCalculationMethod, setScoreCalculationMethod] = useState<'last_attempt' | 'all_attempts'>('last_attempt');
    
    // State to track initial settings to check for changes
    const [initialSettings, setInitialSettings] = useState<Partial<AppSettings>>({});

    const loadAllSettings = async () => {
        setLoadingSettings(true);
        try {
            const settings = await apiGet<AppSettings>('/api/app-settings');
            
            setMinPassingScore(settings.minPassingScore || '70');
            setScoreCalculationMethod(settings.scoreCalculationMethod || 'last_attempt');

            // Set initial states for comparison on save
            setInitialSettings({
                minPassingScore: settings.minPassingScore || '70',
                scoreCalculationMethod: settings.scoreCalculationMethod || 'last_attempt'
            });

        } catch (error) {
             toast({
                title: "No se pudieron cargar las configuraciones",
                description: "Se usarán los valores predeterminados. Los cambios no se guardarán hasta que se resuelva el problema de la base de datos.",
                variant: "destructive",
            });
            // Fallback to defaults
            setMinPassingScore('70');
            setScoreCalculationMethod('last_attempt');
        } finally {
             setLoadingSettings(false);
        }
    };

    useEffect(() => {
        loadAllSettings();
    }, []);
    
    const handleSaveChanges = async () => {
        setIsSaving(true);
        try {
            const settingsToSave: Partial<AppSettings> = {};

            if (minPassingScore !== initialSettings.minPassingScore) {
                settingsToSave.minPassingScore = minPassingScore;
            }
            if (scoreCalculationMethod !== initialSettings.scoreCalculationMethod) {
                settingsToSave.scoreCalculationMethod = scoreCalculationMethod;
            }

            if (Object.keys(settingsToSave).length === 0) {
                 toast({
                    title: "No hay cambios",
                    description: "No se ha modificado ninguna configuración. No se guardó nada.",
                });
                setIsSaving(false);
                return;
            }

            await apiPatch<{ success: boolean }>('/api/app-settings', settingsToSave);

            toast({
                title: "Configuración Guardada",
                description: `La configuración general ha sido actualizada.`
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
        <div className="space-y-6 min-w-0">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                 <Settings className="h-8 w-8" />
                 <div>
                    <h1 className="text-2xl sm:text-3xl font-bold font-headline">Configuraciones</h1>
                    <p className="text-muted-foreground">Gestiona la configuración global de la plataforma.</p>
                 </div>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 lg:grid-cols-3 2xl:grid-cols-6">
                    <TabsTrigger value="general" className="px-2 py-2 text-xs sm:text-sm"><Settings className="mr-1 h-4 w-4 sm:mr-2"/>General</TabsTrigger>
                    <TabsTrigger value="categories" className="px-2 py-2 text-xs sm:text-sm"><FolderKanban className="mr-1 h-4 w-4 sm:mr-2"/>Categorías</TabsTrigger>
                    <TabsTrigger value="badges" className="px-2 py-2 text-xs sm:text-sm"><Award className="mr-1 h-4 w-4 sm:mr-2"/>Insignias</TabsTrigger>
                    <TabsTrigger value="decorations" className="px-2 py-2 text-xs sm:text-sm"><PartyPopper className="mr-1 h-4 w-4 sm:mr-2"/>Tema</TabsTrigger>
                    <TabsTrigger value="ai" className="px-2 py-2 text-xs sm:text-sm"><Bot className="mr-1 h-4 w-4 sm:mr-2"/>Prompts IA</TabsTrigger>
                    <TabsTrigger value="models" className="px-2 py-2 text-xs sm:text-sm"><Cpu className="mr-1 h-4 w-4 sm:mr-2"/>Modelos IA</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="mt-6">
                     <Card className="premium-surface">
                        <CardHeader>
                            <CardTitle>Configuración General de la Plataforma</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 sm:space-y-8">
                             <div className="grid gap-6 sm:gap-8 md:grid-cols-2">
                                <Card className="premium-surface">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2"><Trophy /> Parámetros de Evaluación</CardTitle>
                                        <CardDescription>Define la configuración global para las evaluaciones de los cursos.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                    {loadingSettings ? <p>Cargando...</p> : (
                                        <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="min-passing-score">Puntuación Mínima para Aprobar (%)</Label>
                                            <Input
                                            id="min-passing-score"
                                            type="number"
                                            value={minPassingScore}
                                            onChange={(e) => setMinPassingScore(e.target.value)}
                                            disabled={isSaving}
                                            min="0"
                                            max="100"
                                            placeholder="Ej: 70"
                                            />
                                        </div>
                                        </div>
                                    )}
                                    </CardContent>
                                </Card>
                                <Card className="premium-surface">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2"><Calculator /> Cálculo de Calificaciones</CardTitle>
                                        <CardDescription>Elige cómo se calcula la calificación final de un curso.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                    {loadingSettings ? <p>Cargando...</p> : (
                                        <RadioGroup value={scoreCalculationMethod} onValueChange={(v) => setScoreCalculationMethod(v as any)} disabled={isSaving} className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="last_attempt" id="last_attempt" />
                                                <Label htmlFor="last_attempt" className="font-normal">Promediar solo el último intento de cada módulo (Recomendado)</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="all_attempts" id="all_attempts" />
                                                <Label htmlFor="all_attempts" className="font-normal">Promediar todos los intentos de todos los módulos</Label>
                                            </div>
                                        </RadioGroup>
                                    )}
                                    </CardContent>
                                </Card>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleSaveChanges} disabled={loadingSettings || isSaving} className="w-full sm:w-auto">
                                {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                                Guardar Cambios Generales
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="categories" className="mt-6">
                    <CategoriesView />
                </TabsContent>
                <TabsContent value="badges" className="mt-6">
                    <BadgesView />
                </TabsContent>
                <TabsContent value="decorations" className="mt-6">
                    <SeasonalDecorationsView />
                </TabsContent>
                <TabsContent value="ai" className="mt-6">
                    <AIConfigView />
                </TabsContent>
                 <TabsContent value="models" className="mt-6">
                    <AIModelsView />
                </TabsContent>
            </Tabs>
        </div>
    );
}
