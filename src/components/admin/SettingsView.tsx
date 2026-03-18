'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { saveAppSettings, fetchAppSettings } from '@/app/actions';
import { Loader2, Save, Trophy, Calculator, Settings, FolderKanban, Award, Bot, Cpu, PartyPopper } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AppSettings } from '@/types';
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
            const settings = await fetchAppSettings();
            
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

            await saveAppSettings(settingsToSave);

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
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                 <Settings className="h-8 w-8" />
                 <div>
                    <h1 className="text-3xl font-bold font-headline">Configuraciones</h1>
                    <p className="text-muted-foreground">Gestiona la configuración global de la plataforma.</p>
                 </div>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
                    <TabsTrigger value="general"><Settings className="mr-2"/>General</TabsTrigger>
                    <TabsTrigger value="categories"><FolderKanban className="mr-2"/>Categorías</TabsTrigger>
                    <TabsTrigger value="badges"><Award className="mr-2"/>Insignias</TabsTrigger>
                    <TabsTrigger value="decorations"><PartyPopper className="mr-2"/>Tema</TabsTrigger>
                    <TabsTrigger value="ai"><Bot className="mr-2"/>Prompts IA</TabsTrigger>
                    <TabsTrigger value="models"><Cpu className="mr-2"/>Modelos IA</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="mt-6">
                     <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>Configuración General de la Plataforma</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                             <div className="grid gap-8 md:grid-cols-2">
                                <Card>
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
                                <Card>
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
                            <Button onClick={handleSaveChanges} disabled={loadingSettings || isSaving}>
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
