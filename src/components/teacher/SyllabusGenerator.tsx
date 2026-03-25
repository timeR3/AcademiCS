

'use client';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, UploadCloud, File as FileIcon, X, RotateCcw, Ban, CheckCircle2, Cpu } from 'lucide-react';
import { Input } from '../ui/input';
import type { CourseSourceFile } from '@/types';
import { apiPost } from '@/lib/api-client';

type PromptSource = 'admin' | 'file' | 'code';
type StructuredContentItem = {
  title: string;
  content: string;
};
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
}

export function SyllabusGenerator({ onSyllabusIndexGenerated, hasGeneratedContent, initialSourceFiles, courseTitleSet, isLoading }: SyllabusGeneratorProps) {
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [numModules, setNumModules] = useState<number | undefined>(undefined);
  const [generationStatusMessage, setGenerationStatusMessage] = useState<string | null>(null);
  
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [aiModelName] = useState('gemini-1.5-pro-latest');
  
  const generationController = useRef<AbortController | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      const currentFileNames = new Set(fileStates.map(fs => fs.file.name));
      const uniqueNewFiles = newFiles.filter(f => !currentFileNames.has(f.name));
      
      const newFileStates: FileState[] = uniqueNewFiles.map(file => ({ file, status: 'pending', size: file.size }));
      
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
    
    const processingPromises = pendingFiles.map(async (pendingFile) => {
      try {
        setFileStates(prev => prev.map(fs => fs.file.name === pendingFile.file.name ? { ...fs, status: 'transcribing' } : fs));
        const dataUri = await fileToDataURL(pendingFile.file);
        const { hash, status } = await apiPost<{ hash: string; status: 'cached' | 'transcribed' }>('/api/files/cache', {
          dataUri,
          fileName: pendingFile.file.name,
        });
        
        const finalStatus: FileStatus = 'completed';
        if (status === 'cached') {
             toast({ title: 'Archivo encontrado en caché', description: `${pendingFile.file.name} ya había sido procesado.`, variant: 'default' });
        }
        
        setFileStates(prev => prev.map(fs => fs.file.name === pendingFile.file.name ? { ...fs, status: finalStatus, hash, dataUri } : fs));
      } catch (error: any) {
        console.error(`Failed to transcribe ${pendingFile.file.name}:`, error);
        const errorMessage = typeof error?.message === 'string' && error.message.trim() !== ''
          ? error.message
          : 'Error desconocido al procesar el archivo.';
        toast({ title: 'Error de Transcripción', description: `No se pudo procesar ${pendingFile.file.name}. ${errorMessage}`, variant: 'destructive'});
        setFileStates(prev => prev.map(fs => fs.file.name === pendingFile.file.name ? { ...fs, status: 'failed' } : fs));
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
          numModules: numModules
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
  
  const hasPendingFiles = fileStates.some(f => f.status === 'pending');
  const allFilesProcessed = fileStates.every(fs => fs.status === 'completed' || fs.status === 'failed');
  const canGenerate = (allFilesProcessed && fileStates.some(fs => fs.status === 'completed')) || (!fileStates.length && initialSourceFiles.length > 0);
  const hasFilesToProcess = fileStates.length > 0;
  const descriptionText = `Sube tus PDFs. La transcripción comenzará cuando presiones "Procesar Archivos". Luego, podrás generar la ruta de aprendizaje. Usaremos Gemini (${aiModelName}).`;

  return (
    <Card className="w-full premium-surface animate-fade-in-up">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">2. Generar Ruta de Aprendizaje</CardTitle>
        <CardDescription>{descriptionText}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="pdf-upload" className="font-medium">Subir Archivos PDF</Label>
          <div 
            className="mt-2 flex cursor-pointer justify-center rounded-2xl border border-dashed border-input px-6 py-10 transition-colors hover:border-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-center">
              <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
              <div className="mt-4 flex text-sm leading-6 text-muted-foreground">
                <p className="pl-1">Haz clic para subir o arrastra y suelta</p>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">Archivos PDF</p>
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
          {fileStates.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center">
                <p className="font-medium text-sm">Archivos en cola:</p>
                <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleProcessFiles}
                    disabled={!hasPendingFiles || isLoading || isProcessingFiles}
                >
                   {isProcessingFiles ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cpu className="mr-2 h-4 w-4" />}
                   {isProcessingFiles ? 'Procesando...' : 'Procesar Archivos'}
                </Button>
              </div>
              <ul className="space-y-2">
                {fileStates.map((fs, index) => (
                  <li key={index} className="flex items-center justify-between rounded-xl border bg-secondary/50 p-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {getStatusIcon(fs.status)}
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium truncate" title={fs.file.name}>{fs.file.name}</span>
                         <div className="text-xs flex gap-x-2">
                           {getStatusText(fs.status)}
                         </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeFile(fs.file.name)} disabled={isLoading || isProcessingFiles}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {initialSourceFiles.length > 0 && !hasFilesToProcess && (
            <div className="mt-4 space-y-2">
              <p className="font-medium text-sm">Fuentes de Origen Guardadas:</p>
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
            </div>
        )}
        
        <div className="space-y-2">
            <Label htmlFor="num-modules">Número de Módulos Temáticos (sin contar "Fundamentos")</Label>
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
