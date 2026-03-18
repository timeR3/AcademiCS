'use client';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { checkAiConfigStatus, saveAppSettings, fetchAppSettings, fetchPromptHistory, deletePromptFromHistory, fetchAllAiModels } from '@/app/actions';
import { CheckCircle2, AlertTriangle, KeyRound, Copy, Bot, BrainCircuit, MessageSquare, Pencil, Loader2, History, RotateCcw, Youtube, Trash2, Trophy, Calculator, Cpu, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '../ui/textarea';
import type { AppSettings, PromptHistoryItem, AiModel } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { buttonVariants } from '../ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';

export function AIConfigView() {
    const [isApiKeySet, setIsApiKeySet] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [savingStates, setSavingStates] = useState({
        general: false,
        syllabus: false,
        questionnaire: false,
    });
    const { toast } = useToast();

    // Settings state
    const [syllabusPrompt, setSyllabusPrompt] = useState('');
    const [questionnairePrompt, setQuestionnairePrompt] = useState('');
    const [enableYoutube, setEnableYoutube] = useState(false);
    const [aiModel, setAiModel] = useState('');
    
    // State to track initial settings to check for changes
    const [initialSettings, setInitialSettings] = useState<Partial<AppSettings>>({});

    const [promptHistory, setPromptHistory] = useState<PromptHistoryItem[]>([]);
    const [availableAiModels, setAvailableAiModels] = useState<AiModel[]>([]);
    
    // Delete dialog state
    const [promptToDelete, setPromptToDelete] = useState<PromptHistoryItem | null>(null);

    const selectedModelInfo = useMemo(() => {
        return availableAiModels.find(m => m.id === aiModel);
    }, [aiModel, availableAiModels]);


    const loadAllSettings = async () => {
        setLoadingSettings(true);
        try {
            const [settings, history, models] = await Promise.all([
                fetchAppSettings(),
                fetchPromptHistory(),
                fetchAllAiModels()
            ]);
            
            const activeModels = models.filter(m => m.status === 'active');
            setAvailableAiModels(activeModels);

            setSyllabusPrompt(settings.adminSyllabusPrompt || '');
            setQuestionnairePrompt(settings.adminQuestionnairePrompt || '');
            setEnableYoutube(settings.enableYoutubeGeneration === 'true');
            setAiModel(settings.aiModel || activeModels[0]?.id || '');

            // Set initial states for comparison on save
            setInitialSettings({
                adminSyllabusPrompt: settings.adminSyllabusPrompt || '',
                adminQuestionnairePrompt: settings.adminQuestionnairePrompt || '',
                enableYoutubeGeneration: String(settings.enableYoutubeGeneration === 'true'),
                aiModel: settings.aiModel || activeModels[0]?.id || '',
            });

            setPromptHistory(history);
        } catch (error) {
             toast({
                title: "No se pudieron cargar las configuraciones",
                description: "Se usarán los valores predeterminados. Los cambios no se guardarán hasta que se resuelva el problema de la base de datos.",
                variant: "destructive",
            });
        } finally {
             setLoadingSettings(false);
        }
    };


    useEffect(() => {
        async function checkStatus() {
            setLoadingStatus(true);
            try {
                const { isApiKeySet } = await checkAiConfigStatus(); 
                setIsApiKeySet(isApiKeySet);
            } catch (error) {
                console.error("Failed to check AI config status:", error);
                setIsApiKeySet(false);
            } finally {
                setLoadingStatus(false);
            }
        }
        checkStatus();
        loadAllSettings();
    }, []);
    
     const handleSaveGeneralSettings = async () => {
        setSavingStates(s => ({ ...s, general: true }));
        try {
            const settingsToSave: Partial<AppSettings> = {};

            if (aiModel !== initialSettings.aiModel) {
                settingsToSave.aiModel = aiModel;
            }
            if (String(enableYoutube) !== initialSettings.enableYoutubeGeneration) {
                settingsToSave.enableYoutubeGeneration = String(enableYoutube);
            }

            if (Object.keys(settingsToSave).length === 0) {
                toast({ title: "No hay cambios", description: "No se modificó la configuración general." });
                return;
            }

            await saveAppSettings(settingsToSave);
            toast({ title: "Configuración Guardada", description: "El modelo de IA y las funcionalidades han sido actualizados." });
            loadAllSettings();
        } catch (error: any) {
            toast({ title: "Error al Guardar", description: `No se pudo guardar la configuración: ${error.message}`, variant: "destructive" });
        } finally {
            setSavingStates(s => ({ ...s, general: false }));
        }
    };
    
    const handleSaveSyllabusPrompt = async () => {
        setSavingStates(s => ({ ...s, syllabus: true }));
        try {
            if (syllabusPrompt === initialSettings.adminSyllabusPrompt) {
                toast({ title: "No hay cambios", description: "El prompt de temarios no ha sido modificado." });
                return;
            }
            await saveAppSettings({ adminSyllabusPrompt: syllabusPrompt });
            toast({ title: "Prompt Guardado", description: "El prompt para generar temarios ha sido actualizado." });
            loadAllSettings();
        } catch (error: any) {
            toast({ title: "Error al Guardar", description: `No se pudo guardar el prompt: ${error.message}`, variant: "destructive" });
        } finally {
            setSavingStates(s => ({ ...s, syllabus: false }));
        }
    };

    const handleSaveQuestionnairePrompt = async () => {
        setSavingStates(s => ({ ...s, questionnaire: true }));
        try {
            if (questionnairePrompt === initialSettings.adminQuestionnairePrompt) {
                toast({ title: "No hay cambios", description: "El prompt de cuestionarios no ha sido modificado." });
                return;
            }
            await saveAppSettings({ adminQuestionnairePrompt: questionnairePrompt });
            toast({ title: "Prompt Guardado", description: "El prompt para generar cuestionarios ha sido actualizado." });
            loadAllSettings();
        } catch (error: any) {
            toast({ title: "Error al Guardar", description: `No se pudo guardar el prompt: ${error.message}`, variant: "destructive" });
        } finally {
            setSavingStates(s => ({ ...s, questionnaire: false }));
        }
    };


    const handleReusePrompt = (item: PromptHistoryItem) => {
        if (item.promptType === 'syllabus') {
            setSyllabusPrompt(item.content);
        } else {
            setQuestionnairePrompt(item.content);
        }
        toast({
            title: 'Prompt Reutilizado',
            description: `El prompt ha sido cargado en el editor. No olvides guardar los cambios.`
        });
    };

    const handleDeletePrompt = async () => {
        if (!promptToDelete) return;
        const isSaving = Object.values(savingStates).some(Boolean);
        if (isSaving) return;

        try {
            await deletePromptFromHistory(promptToDelete.id);
            toast({
                title: 'Prompt Eliminado',
                description: 'El prompt ha sido eliminado del historial.',
            });
            setPromptHistory(prev => prev.filter(p => p.id !== promptToDelete.id));
        } catch (error: any) {
            toast({
                title: 'Error al Eliminar',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setPromptToDelete(null);
        }
    };


    // The key is now a server-side environment variable.
    const apiKeyName = 'GEMINI_API_KEY';
    const isSaving = Object.values(savingStates).some(Boolean);

    return (
        <div className="space-y-8">
            <div className="grid gap-8 lg:grid-cols-2">
                 <Card className="shadow-lg flex flex-col h-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><KeyRound /> Configuración de API</CardTitle>
                        <CardDescription>
                        Gestiona la clave API necesaria para la generación de contenido.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 flex-grow">
                        <div className="space-y-2">
                            <Label>Proveedor de IA</Label>
                            <Input value="Google (Gemini)" disabled />
                        </div>
                        {loadingStatus ? (
                            <p>Verificando estado...</p>
                        ) : isApiKeySet ? (
                            <Alert variant="default" className="bg-green-50 border-green-200">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <AlertTitle className="text-green-700">¡Conectado!</AlertTitle>
                                <AlertDescription className="text-green-600">
                                    La variable de entorno {apiKeyName} está configurada. La IA está activa.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>¡Acción Requerida!</AlertTitle>
                                <AlertDescription>
                                     La variable de entorno {apiKeyName} no está configurada en tu servidor. Las funciones de IA no funcionarán hasta que se configure.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>
                <Card className="shadow-lg flex flex-col h-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Cpu /> Configuración del Modelo de IA</CardTitle>
                        <CardDescription>Elige el modelo de Gemini para la generación de contenido.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                    {loadingSettings ? <p>Cargando...</p> : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="ai-model-select">Modelo de Generación</Label>
                                <Select value={aiModel} onValueChange={setAiModel} disabled={isSaving}>
                                    <SelectTrigger id="ai-model-select">
                                        <SelectValue placeholder="Selecciona un modelo..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableAiModels.map(model => (
                                            <SelectItem key={model.id} value={model.id}>
                                                {model.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {selectedModelInfo && (
                                <Card className="bg-secondary/50">
                                    <CardHeader>
                                        <CardTitle className="text-base">Información de Precios</CardTitle>
                                        <CardDescription className="text-xs">Precios por millón de tokens. Un token son aprox. 4 caracteres.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="text-sm space-y-1">
                                            <li><strong>Entrada (Input):</strong> {selectedModelInfo.pricingInput}</li>
                                            <li><strong>Salida (Output):</strong> {selectedModelInfo.pricingOutput}</li>
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                    </CardContent>
                    <CardFooter className="border-t pt-6">
                         <Button onClick={handleSaveGeneralSettings} disabled={loadingStatus || loadingSettings || isSaving}>
                             {savingStates.general ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                             {savingStates.general ? 'Guardando...' : 'Guardar Configuración'}
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Youtube /> Funcionalidades de Generación</CardTitle>
                    <CardDescription>Habilita o deshabilita funcionalidades específicas de la IA.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                {loadingSettings ? <p>Cargando...</p> : (
                    <div className="flex items-center space-x-2 rounded-md border p-4">
                    <Switch
                        id="youtube-generation"
                        checked={enableYoutube}
                        onCheckedChange={setEnableYoutube}
                        disabled={isSaving}
                    />
                    <Label htmlFor="youtube-generation" className="flex-1">Habilitar generación de cursos desde YouTube</Label>
                    </div>
                )}
                </CardContent>
            </Card>
            
            <div className="grid md:grid-cols-2 gap-6">
                <Card className="shadow-lg">
                     <CardHeader>
                         <CardTitle className="flex items-center gap-2"><MessageSquare /> Prompt para Generar Temarios</CardTitle>
                         <CardDescription>Personaliza las instrucciones para la creación de rutas de aprendizaje.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       {loadingSettings ? <p>Cargando prompt...</p> : (
                            <Textarea 
                                id="syllabus-prompt"
                                value={syllabusPrompt}
                                onChange={(e) => setSyllabusPrompt(e.target.value)}
                                rows={15}
                                className="font-mono text-xs"
                                disabled={isSaving}
                            />
                       )}
                    </CardContent>
                     <CardFooter className="border-t pt-6">
                         <Button onClick={handleSaveSyllabusPrompt} disabled={loadingStatus || loadingSettings || isSaving}>
                             {savingStates.syllabus ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                             {savingStates.syllabus ? 'Guardando...' : 'Guardar Prompt de Temario'}
                        </Button>
                    </CardFooter>
                </Card>
                 <Card className="shadow-lg">
                     <CardHeader>
                         <CardTitle className="flex items-center gap-2"><MessageSquare /> Prompt para Generar Cuestionarios</CardTitle>
                         <CardDescription>Define las directrices para la creación de preguntas de evaluación.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       {loadingSettings ? <p>Cargando prompt...</p> : (
                            <Textarea 
                                id="questionnaire-prompt"
                                value={questionnairePrompt}
                                onChange={(e) => setQuestionnairePrompt(e.target.value)}
                                rows={15}
                                className="font-mono text-xs"
                                disabled={isSaving}
                            />
                       )}
                    </CardContent>
                     <CardFooter className="border-t pt-6">
                         <Button onClick={handleSaveQuestionnairePrompt} disabled={loadingStatus || loadingSettings || isSaving}>
                             {savingStates.questionnaire ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                             {savingStates.questionnaire ? 'Guardando...' : 'Guardar Prompt de Cuestionario'}
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History /> Historial de Prompts</CardTitle>
                    <CardDescription>Revisa, reutiliza y elimina versiones anteriores de tus prompts guardados.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loadingSettings ? <p>Cargando historial...</p> : (
                        <ScrollArea className="h-[400px]">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Contenido (fragmento)</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {promptHistory.length > 0 ? promptHistory.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <Badge variant={item.promptType === 'syllabus' ? 'secondary' : 'default'} className="capitalize">
                                                        {item.promptType === 'syllabus' ? 'Temario' : 'Cuestionario'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs max-w-sm truncate">{item.content.substring(0, 100)}...</TableCell>
                                                <TableCell>{new Date(item.savedAt).toLocaleString()}</TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button size="sm" variant="outline" onClick={() => handleReusePrompt(item)} disabled={isSaving}>
                                                        <RotateCcw className="mr-2 h-4 w-4" />
                                                        Reutilizar
                                                    </Button>
                                                    <Button size="sm" variant="destructive" onClick={() => setPromptToDelete(item)} disabled={isSaving}>
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Eliminar
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center">No hay historial de prompts.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!promptToDelete} onOpenChange={(isOpen) => !isOpen && setPromptToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro de que quieres eliminar este prompt?</AlertDialogTitle>
                        <AlertDialogDescription>
                           Esta acción es permanente y no se puede deshacer. El prompt se eliminará del historial.
                        </AlertDialogDescription>
                        <blockquote className="mt-4 border-l-2 pl-4 italic text-xs text-left text-muted-foreground">
                            {promptToDelete?.content.substring(0, 150)}...
                        </blockquote>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPromptToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeletePrompt}
                            className={buttonVariants({ variant: "destructive" })}
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Sí, eliminar prompt
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
