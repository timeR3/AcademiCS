

'use client';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, UploadCloud, File as FileIcon, X, RotateCcw, Ban, CheckCircle2, Cpu } from 'lucide-react';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import type { CourseSourceFile } from '@/types';
import { apiPost } from '@/lib/api-client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';

type PromptSource = 'admin' | 'file' | 'code';
type StructuredContentItem = {
  title: string;
  content: string;
};
const PROCESS_STEPS_TOTAL = 6;
type CreateSyllabusIndexOutput = {
  moduleTitles: string[];
  pdfHashes: string[];
  structuredContent: StructuredContentItem[];
  classificationMap: Record<string, string[]>;
  promptSource: PromptSource;
};

type FileStatus = 'pending' | 'transcribing' | 'completed' | 'failed';
interface FileState {
    file: File;
    status: FileStatus;
    hash?: string;
    dataUri?: string;
    size: number;
    progressStep: number;
    progressLabel: string;
    lastError?: string;
}

const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface SyllabusGeneratorProps {
    onSyllabusIndexGenerated: (output: CreateSyllabusIndexOutput) => void;
    hasGeneratedContent: boolean;
    initialSourceFiles: CourseSourceFile[];
    courseTitleSet: boolean;
    courseTitle: string;
    isLoading: boolean;
    difficulty: 'basic' | 'intermediate' | 'advanced';
    includeFundamentals: boolean;
    onDifficultyChange: (value: 'basic' | 'intermediate' | 'advanced') => void;
    onIncludeFundamentalsChange: (value: boolean) => void;
}

export function SyllabusGenerator({ onSyllabusIndexGenerated, hasGeneratedContent, initialSourceFiles, courseTitleSet, isLoading, difficulty, includeFundamentals, onDifficultyChange, onIncludeFundamentalsChange }: SyllabusGeneratorProps) {
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [numModules, setNumModules] = useState<number | undefined>(undefined);
  const [generationStatusMessage, setGenerationStatusMessage] = useState<string | null>(null);
  
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiModelName] = useState('OpenAI');
  
  const generationController = useRef<AbortController | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      const currentFileNames = new Set(fileStates.map(fs => fs.file.name));
      const uniqueNewFiles = newFiles.filter(f => !currentFileNames.has(f.name));
      
      const newFileStates: FileState[] = uniqueNewFiles.map(file => ({
        file,
        status: 'pending',
        size: file.size,
        progressStep: 0,
        progressLabel: 'Pendiente',
      }));
      
      setFileStates(current => [...current, ...newFileStates]);
      onSyllabusIndexGenerated({ moduleTitles: [], pdfHashes: [], structuredContent: [], classificationMap: {}, promptSource: 'admin' });
      setGenerationStatusMessage(null);
    }
  };
  
  const handleProcessFiles = async () => {
    const pendingFiles = fileStates.filter(fs => fs.status === 'pending');
    if (pendingFiles.length === 0) {
      toast({ title: "No hay archivos pendientes", description: "Todos los archivos ya han sido procesados." });
      return;
    }
    
    setIsProcessingFiles(true);
    
    const updateFileProgress = (fileName: string, status: FileStatus, step: number, label: string, extra?: Partial<FileState>) => {
      setFileStates(prev =>
        prev.map(fs => fs.file.name === fileName
          ? { ...fs, status, progressStep: step, progressLabel: label, ...extra }
          : fs
        )
      );
    };

    const processingPromises = pendingFiles.map(async (pendingFile) => {
      try {
        updateFileProgress(pendingFile.file.name, 'transcribing', 1, 'Paso 1 de 6: preparando el archivo');
        updateFileProgress(pendingFile.file.name, 'transcribing', 2, 'Paso 2 de 6: leyendo el PDF');
        const dataUri = await fileToDataURL(pendingFile.file);
        updateFileProgress(pendingFile.file.name, 'transcribing', 3, 'Paso 3 de 6: revisando si ya existe en tu biblioteca');
        updateFileProgress(pendingFile.file.name, 'transcribing', 4, 'Paso 4 de 6: transcribiendo el archivo');
        const { hash, status, stage } = await apiPost<{ hash: string; status: 'cached' | 'transcribed'; stage?: string }>('/api/files/cache', {
          dataUri,
          fileName: pendingFile.file.name,
        });
        
        updateFileProgress(pendingFile.file.name, 'transcribing', 5, 'Paso 5 de 6: separando el contenido');
        updateFileProgress(pendingFile.file.name, 'transcribing', 6, stage || 'Paso 6 de 6: guardando contenido del curso');
        const finalStatus: FileStatus = 'completed';
        if (status === 'cached') {
             toast({ title: 'Archivo encontrado en caché', description: `${pendingFile.file.name} ya había sido procesado.`, variant: 'default' });
        }
        
        updateFileProgress(
          pendingFile.file.name,
          finalStatus,
          PROCESS_STEPS_TOTAL,
          status === 'cached' ? 'Completado: ya lo tenías procesado' : 'Completado: contenido listo para tu curso',
          { hash, dataUri, lastError: undefined }
        );
      } catch (error: any) {
        console.error(`Failed to transcribe ${pendingFile.file.name}:`, error);
        const errorMessage = typeof error?.message === 'string' && error.message.trim() !== ''
          ? error.message
          : 'Error desconocido al procesar el archivo.';
        toast({ title: 'Error de Transcripción', description: `No se pudo procesar ${pendingFile.file.name}. ${errorMessage}`, variant: 'destructive'});
        updateFileProgress(
          pendingFile.file.name,
          'failed',
          Math.max(1, fileStates.find(fs => fs.file.name === pendingFile.file.name)?.progressStep || 4),
          'El proceso se detuvo. Revisa el detalle del error',
          { lastError: errorMessage }
        );
      }
    });

    await Promise.all(processingPromises);
    setIsProcessingFiles(false);
  };


  const handleGenerate = async () => {
    if (!courseTitleSet) {
       toast({ title: 'Error', description: 'Por favor, crea el curso y guarda un título antes de generar el temario.', variant: 'destructive' });
       return;
    }
    const completedFiles = fileStates.filter(fs => fs.status === 'completed' && fs.dataUri);
    if (completedFiles.length === 0 && initialSourceFiles.length === 0) {
      toast({ title: 'Error', description: 'Espera a que los archivos terminen de procesarse o sube al menos un PDF.', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    setGenerationStatusMessage('Transcribiendo y procesando archivos...');
    
    generationController.current = new AbortController();

    try {
      const result = await apiPost<CreateSyllabusIndexOutput>('/api/syllabus/index', {
          pdfDataUris: completedFiles.map(f => f.dataUri!),
          sourceFileIds: initialSourceFiles.map((f) => f.id),
          numModules: numModules,
          difficulty,
          includeFundamentals,
      });

      onSyllabusIndexGenerated(result);
      setGenerationStatusMessage(null);

    } catch (error: any) {
        toast({ title: 'Falló la Generación', description: `No se pudo generar el índice de módulos. ${error.message}`, variant: 'destructive' });
        setGenerationStatusMessage(`Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
      generationController.current = null;
    }
  };
  
  const handleCancelGeneration = () => {
    if (generationController.current) {
        generationController.current.abort();
    }
  };
  
  const removeFile = (fileName: string) => {
    setFileStates(prev => prev.filter(fs => fs.file.name !== fileName));
    if (fileStates.length === 1 && hasGeneratedContent) {
      onSyllabusIndexGenerated({ moduleTitles: [], pdfHashes: [], structuredContent: [], classificationMap: {}, promptSource: 'admin' });
      setGenerationStatusMessage(null);
    }
  };
  
  const handleNumModulesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setNumModules(undefined);
    } else {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num > 0) {
        setNumModules(num);
      }
    }
  };
  
  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
        case 'transcribing':
            return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
        case 'completed':
            return <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />;
        case 'failed':
            return <X className="h-5 w-5 text-destructive" />;
        case 'pending':
        default:
            return <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />;
    }
  }
  
  const getStatusText = (status: FileStatus) => {
     switch (status) {
        case 'transcribing':
            return <span className="text-primary">Procesando...</span>;
        case 'completed':
            return <span className="text-secondary">Completado</span>;
        case 'failed':
            return <span className="text-destructive">Fallido</span>;
        case 'pending':
        default:
            return <span className="text-muted-foreground">Pendiente</span>;
    }
  }

  const getProgressValue = (status: FileStatus, step: number) => {
    if (status === 'completed') return 100;
    if (status === 'failed') return Math.min(100, Math.max(5, Math.round((step / PROCESS_STEPS_TOTAL) * 100)));
    if (status === 'pending') return 0;
    return Math.min(95, Math.max(10, Math.round((step / PROCESS_STEPS_TOTAL) * 100)));
  }
  
  const hasPendingFiles = fileStates.some(f => f.status === 'pending');
  const allFilesProcessed = fileStates.every(fs => fs.status === 'completed' || fs.status === 'failed');
  const canGenerate = (allFilesProcessed && fileStates.some(fs => fs.status === 'completed')) || (!fileStates.length && initialSourceFiles.length > 0);
  const hasFilesToProcess = fileStates.length > 0;
  const descriptionText = `Sube tus PDFs. La transcripción comenzará cuando presiones "Procesar Archivos". Luego, podrás generar la ruta de aprendizaje. Proveedor activo: ${aiModelName}.`;

  return (
    <Card className="w-full premium-surface animate-fade-in-up">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">2. Generar Ruta de Aprendizaje</CardTitle>
        <CardDescription>{descriptionText}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,320px),minmax(0,1fr)] items-start">
          <div className="space-y-3">
            <Label htmlFor="pdf-upload" className="font-medium">Subir Archivos PDF</Label>
            <div
              className="flex cursor-pointer justify-center rounded-2xl border border-dashed border-input px-4 py-6 transition-colors hover:border-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-center">
                <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
                <div className="mt-2 flex text-sm leading-6 text-muted-foreground">
                  <p className="pl-1">Haz clic o arrastra tus PDFs</p>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">Uno o varios archivos</p>
                <Input
                  id="pdf-upload"
                  ref={fileInputRef}
                  name="pdf-upload"
                  type="file"
                  className="sr-only"
                  accept="application/pdf"
                  multiple
                  onChange={handleFileChange}
                  onClick={(e) => (e.currentTarget.value = '')}
                  disabled={isLoading || isProcessingFiles}
                />
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleProcessFiles}
              disabled={!hasPendingFiles || isLoading || isProcessingFiles}
              className="w-full"
            >
              {isProcessingFiles ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cpu className="mr-2 h-4 w-4" />}
              {isProcessingFiles ? 'Procesando...' : 'Procesar Archivos'}
            </Button>
          </div>

          <div className="space-y-2">
            {fileStates.length > 0 ? (
              <>
                <p className="font-medium text-sm">Archivos cargados</p>
                <ul className="space-y-2">
                  {fileStates.map((fs, index) => (
                    <li key={index} className="flex items-center justify-between rounded-xl border bg-secondary/50 p-3">
                      <div className="flex flex-1 items-center gap-2 overflow-hidden">
                        {getStatusIcon(fs.status)}
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-sm font-medium truncate" title={fs.file.name}>{fs.file.name}</span>
                          <div className="text-xs flex gap-x-2">
                            {getStatusText(fs.status)}
                          </div>
                          <div className="mt-2 w-full min-w-[260px]">
                            <Progress value={getProgressValue(fs.status, fs.progressStep)} className="h-2" />
                            <p className="mt-1 text-[11px] text-muted-foreground truncate">
                              {fs.progressLabel}
                            </p>
                            {fs.lastError ? (
                              <p className="mt-1 text-[11px] text-destructive break-words">
                                {fs.lastError}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeFile(fs.file.name)} disabled={isLoading || isProcessingFiles}>
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            ) : initialSourceFiles.length > 0 && !hasFilesToProcess ? (
              <>
                <p className="font-medium text-sm">Fuentes de Origen Guardadas</p>
                <ul className="space-y-2">
                  {initialSourceFiles.map((file) => (
                    <li key={file.id} className="flex items-center justify-between rounded-xl border bg-secondary/50 p-2">
                      <div className="flex items-center gap-2">
                        <FileIcon className="h-5 w-5 text-primary shrink-0" />
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-sm truncate">{file.fileName}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">Vuelve a generar el contenido a partir de estos archivos. Si subes nuevos archivos, estos serán ignorados.</p>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                Los archivos aparecerán aquí después de cargarlos.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="course-difficulty">Dificultad del Curso</Label>
            <Select value={difficulty} onValueChange={(value) => onDifficultyChange(value as 'basic' | 'intermediate' | 'advanced')}>
              <SelectTrigger id="course-difficulty">
                <SelectValue placeholder="Selecciona dificultad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Básico</SelectItem>
                <SelectItem value="intermediate">Intermedio</SelectItem>
                <SelectItem value="advanced">Avanzado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="num-modules">Número de Módulos Temáticos {includeFundamentals ? '(sin contar "Fundamentos")' : ''}</Label>
            <Input
              id="num-modules"
              type="number"
              placeholder="La IA decide si está vacío"
              value={numModules || ''}
              onChange={handleNumModulesChange}
              min="1"
              disabled={isLoading || isGenerating || isProcessingFiles}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="include-fundamentals">Incluir módulo de Fundamentos</Label>
            <div className="flex h-10 items-center justify-between rounded-2xl border px-3">
              <span className="text-sm text-muted-foreground">{includeFundamentals ? 'Sí' : 'No'}</span>
              <Switch id="include-fundamentals" checked={includeFundamentals} onCheckedChange={onIncludeFundamentalsChange} />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-4 border-t pt-6">
        {!isGenerating ? (
            <Button onClick={handleGenerate} disabled={isLoading || isProcessingFiles || isGenerating || !canGenerate || !courseTitleSet} className="w-full">
                {hasGeneratedContent ? <RotateCcw className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {hasGeneratedContent ? 'Volver a Generar Ruta' : 'Generar Ruta de Aprendizaje'}
            </Button>
        ) : (
            <Button onClick={handleCancelGeneration} variant="destructive" className="w-full">
                <Ban className="mr-2 h-4 w-4" />
                Cancelar Generación
            </Button>
        )}
         <div className="flex items-center text-sm text-muted-foreground h-5">
            {generationStatusMessage && (
                <div className="flex items-center gap-2 rounded-xl bg-secondary p-2 text-xs">
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className='italic'>
                        {generationStatusMessage}
                    </span>
                </div>
            )}
         </div>
        </CardFooter>
    </Card>
  );
}
