

'use client';
import { useState, useEffect, useCallback } from 'react';
import { SyllabusGenerator } from './SyllabusGenerator';
import { QuestionnaireGenerator } from './QuestionnaireGenerator';
import { useCourse } from '@/context/CourseContext';
import { Button } from '../ui/button';
import { ArrowLeft, Save, Loader2, BookOpen, FileQuestion, RotateCcw, Trash2 } from 'lucide-react';
import type { Question } from '@/types';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import type { CourseLevel, CourseSourceFile, SyllabusSection, CourseCategory } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Textarea } from '../ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { buttonVariants } from '../ui/button';
import { apiPatch, apiPost } from '@/lib/api-client';


type ModuleGenerationStatus = 'pending' | 'generating' | 'completed' | 'failed';
interface ExtendedCourseLevel extends CourseLevel {
  generationStatus: ModuleGenerationStatus;
  errorMessage?: string;
}

interface CourseCreationViewProps {
    onCourseSaved: () => void;
    isEditing?: boolean;
    isAdminView?: boolean;
}

type StructuredContent = {
  title?: string;
  content?: string;
  text?: string;
  [key: string]: unknown;
};

type CreateSyllabusOutput = {
  moduleTitles: string[];
  pdfHashes?: string[];
  structuredContent?: StructuredContent[];
  classificationMap?: Record<string, string[]>;
  promptSource?: 'admin' | 'file' | 'code';
};

export function CourseCreationView({ onCourseSaved, isEditing = false, isAdminView = false }: CourseCreationViewProps) {
  const { activeCourse, refreshCourses, updateQuestionnaireForLevel, allCategories, setActiveCourseId } = useCourse();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [title, setTitle] = useState('');
  const [levels, setLevels] = useState<CourseLevel[]>([]);
  const [sourceFiles, setSourceFiles] = useState<CourseSourceFile[]>([]);
  const [activeLevelId, setActiveLevelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [courseId, setCourseId] = useState<number | null>(null);
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);

  const [generatedLearningPath, setGeneratedLearningPath] = useState<ExtendedCourseLevel[]>([]);
  const [generatedFileHashes, setGeneratedFileHashes] = useState<string[]>([]);
  const [allStructuredContent, setAllStructuredContent] = useState<StructuredContent[]>([]);
  const [classificationMap, setClassificationMap] = useState<Record<string, string[]>>({});
  
  const [moduleToDelete, setModuleToDelete] = useState<ExtendedCourseLevel | null>(null);


  useEffect(() => {
    if (isEditing && activeCourse) {
      setTitle(activeCourse.title);
      setLevels(activeCourse.levels);
      setSourceFiles(activeCourse.sourceFiles);
      setCourseId(Number(activeCourse.id));
      setSelectedCategoryId(activeCourse.categoryId);
      setGeneratedLearningPath([]);
      setGeneratedFileHashes([]);
      setAllStructuredContent([]);
    } else {
      if (!courseId) {
          setTitle('');
          setLevels([]);
          setSourceFiles([]);
          setCourseId(null);
          setSelectedCategoryId(undefined);
          setGeneratedLearningPath([]);
          setGeneratedFileHashes([]);
          setAllStructuredContent([]);
      }
    }
  }, [isEditing, activeCourse, courseId]);

  useEffect(() => {
    const processNextModule = async () => {
        const nextPendingModule = generatedLearningPath.find(l => l.generationStatus === 'pending');
        if (!nextPendingModule || isGenerating) {
            if (!nextPendingModule && generatedLearningPath.length > 0 && !isGenerating) {
                 const hasFailures = generatedLearningPath.some(l => l.generationStatus === 'failed');
                 if (!hasFailures) {
                    toast({ title: "¡Generación de Temarios Completa!", description: "Todos los módulos han sido generados. Ahora puedes editar y generar los cuestionarios." });
                 }
            }
            return;
        }

        setIsGenerating(true);
        setGeneratedLearningPath(currentPath =>
            currentPath.map(l => l.id === nextPendingModule.id ? { ...l, generationStatus: 'generating', errorMessage: undefined } : l)
        );
        
        if (!activeLevelId) {
            setActiveLevelId(nextPendingModule.id);
        }

        try {
            const detailedModule = await apiPost<{
              introduction: string;
              syllabus: SyllabusSection[];
              questionnaire: [];
              questionsToDisplay: number;
            }>('/api/syllabus/module', {
                moduleTitle: nextPendingModule.title,
                structuredContent: allStructuredContent,
                classificationMap: classificationMap,
            });

            setGeneratedLearningPath(currentPath =>
                currentPath.map(l =>
                    l.id === nextPendingModule.id
                        ? { ...l, ...detailedModule, generationStatus: 'completed' }
                        : l
                )
            );
        } catch (error: any) {
            const errorMessage = error.message || "An unexpected response was received from the server.";
            toast({ title: `Error al generar "${nextPendingModule.title}"`, description: errorMessage, variant: "destructive" });
            
            setGeneratedLearningPath(currentPath =>
                currentPath.map(l => l.id === nextPendingModule.id ? { ...l, generationStatus: 'failed', errorMessage: errorMessage } : l)
            );
        } finally {
            setIsGenerating(false);
        }
    };

    processNextModule();
  }, [generatedLearningPath, isGenerating, allStructuredContent, toast, activeLevelId, classificationMap]);

  
  const handleSyllabusIndexGenerated = useCallback((output: CreateSyllabusOutput) => {
      if (!Array.isArray(output.moduleTitles) || output.moduleTitles.length === 0) {
        setGeneratedLearningPath([]);
        setGeneratedFileHashes(output.pdfHashes || []);
        setAllStructuredContent(output.structuredContent || []);
        setClassificationMap(output.classificationMap || {});
        setLevels([]);
        return;
      }
      const previewPath: ExtendedCourseLevel[] = output.moduleTitles.map((title, index) => ({
        id: `gen-${index}`, 
        title: title,
        introduction: '',
        syllabus: [], 
        questionnaire: [],
        questionsToDisplay: 10,
        status: 'locked',
        generationStatus: 'pending' // Initial status
      }));
      
      setGeneratedLearningPath(previewPath);
      setGeneratedFileHashes(output.pdfHashes || []);
      setAllStructuredContent(output.structuredContent || []);
      setClassificationMap(output.classificationMap || {});
      setLevels([]); 
      
      const thematicModules = Math.max(output.moduleTitles.length - 1, 0);
      toast({
        title: `Fase 1 y 2 Completadas`,
        description: `Se ha propuesto un índice de ${thematicModules} módulos temáticos${output.moduleTitles.length > 0 ? ' + Fundamentos' : ''} y se ha clasificado el contenido. Iniciando generación...`
      });

  }, [toast]);


  
  const handleBack = () => {
    onCourseSaved();
  };
  
  const handleRetryModule = (moduleId: string) => {
      setGeneratedLearningPath(currentPath =>
          currentPath.map(l => l.id === moduleId ? { ...l, generationStatus: 'pending', errorMessage: undefined } : l)
      );
  };


  const handleSaveTitle = async () => {
      if (!title.trim() || !user) {
        toast({ title: "Datos incompletos", description: "El título del curso es requerido.", variant: "destructive" });
        return;
      }
      setIsLoading(true);
      try {
          const categoryIdNumber = selectedCategoryId ? Number(selectedCategoryId) : undefined;
          if ((isEditing || isAdminView) && courseId) {
              await apiPatch<{ success: boolean }>(`/api/courses/${courseId}/title`, { title, categoryId: categoryIdNumber });
              toast({ title: '¡Título y Categoría Actualizados!', description: 'La información del curso ha sido guardada.' });
              await refreshCourses();
          } else if (!courseId) {
              const { courseId: newCourseId } = await apiPost<{ courseId: number }>('/api/courses', { title, teacherId: user.id, categoryId: categoryIdNumber });
              setCourseId(newCourseId);
              setActiveCourseId(newCourseId.toString());
              toast({ title: '¡Curso Creado!', description: 'Ahora puedes generar la ruta de aprendizaje.' });
          }
      } catch (error: any) {
          toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
      } finally {
          setIsLoading(false);
      }
  };
  
  const handleSaveLearningPath = async () => {
    if (!courseId) {
      toast({ title: "Curso no guardado", description: "Primero guarda un título para el curso.", variant: "destructive" });
      return;
    }
    const pathToSave = generatedLearningPath.length > 0 ? generatedLearningPath : levels;
    if (pathToSave.length === 0) {
      toast({ title: "Nada que guardar", description: "No se ha generado o cargado una ruta de aprendizaje.", variant: "destructive" });
      return;
    }
    
    if (generatedLearningPath.length > 0) {
      const allSyllabusGenerated = generatedLearningPath.every(level => level.generationStatus === 'completed');
      if (!allSyllabusGenerated) {
          toast({ title: "Módulos pendientes", description: "Aún hay módulos por generar o con errores. Revisa la lista.", variant: "destructive" });
          return;
      }
    }

    setIsLoading(true);
    try {
        const { updatedLearningPath } = await apiPatch<{ updatedLearningPath: CourseLevel[] }>(`/api/courses/${courseId}/learning-path`, {
            learningPath: pathToSave, 
            sourceFileHashes: generatedFileHashes.length > 0 ? generatedFileHashes : sourceFiles.map(f => f.id),
        });
        setLevels(updatedLearningPath); 
        setGeneratedLearningPath([]); 
        setGeneratedFileHashes([]);
        setAllStructuredContent([]);
        toast({ title: '¡Ruta de Aprendizaje Guardada!', description: 'La estructura y contenido del curso se han guardado en la base de datos.' });
        await refreshCourses(); 
    } catch (error: any) {
        toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const handleQuestionnaireGenerated = (levelId: string, questionnaire: Question[], questionsToDisplay: number) => {
      const updatePath = (path: CourseLevel[]) => path.map(level => {
          if (level.id === levelId) {
              return { ...level, questionnaire, questionsToDisplay };
          }
          return level;
      });

      if (generatedLearningPath.length > 0) {
          setGeneratedLearningPath(currentPath => updatePath(currentPath) as ExtendedCourseLevel[]);
      } else {
          setLevels(currentPath => updatePath(currentPath));
          updateQuestionnaireForLevel(String(courseId), levelId, questionnaire, questionsToDisplay);
      }
  };
  
  const handleAccordionChange = (value: string) => {
    setActiveLevelId(value);
  };
  
    const handleConfirmDelete = () => {
        if (!moduleToDelete) return;

        const updatePath = (path: any[]) => path.filter(l => l.id !== moduleToDelete.id);

        if (generatedLearningPath.length > 0) {
            setGeneratedLearningPath(updatePath(generatedLearningPath));
        } else {
            setLevels(updatePath(levels));
        }
        toast({ title: "Módulo Eliminado", description: `El módulo "${moduleToDelete.title}" ha sido eliminado. Guarda los cambios para hacerlo permanente.` });
        setModuleToDelete(null);
    };

  const displayPath: ExtendedCourseLevel[] =
    generatedLearningPath.length > 0
      ? generatedLearningPath
      : levels.map((l) => ({ ...l, generationStatus: 'completed' as ModuleGenerationStatus, errorMessage: undefined }));
  
  const activeLevel = activeLevelId
    ? displayPath.find(l => l.id === activeLevelId)
    : null;

  const canSaveLearningPath = useCallback(() => {
    if (isGenerating) return false;
    
    if (generatedLearningPath.length > 0) {
        return generatedLearningPath.every(level => level.generationStatus === 'completed');
    }
    
    if (levels.length > 0) {
        return true;
    }
    
    return false;
  }, [generatedLearningPath, levels, isGenerating]);
  
  const hasContentToSave = displayPath.length > 0;

  const getStatusBadge = (level: ExtendedCourseLevel) => {
      const bankSize = level.questionnaire?.length || 0;
      const displaySize = level.questionsToDisplay || 0;

      switch(level.generationStatus) {
          case 'generating':
              return <Badge variant="outline" className="text-xs ml-2 font-normal px-2 py-1 rounded-full whitespace-nowrap"><Loader2 className="h-3 w-3 animate-spin mr-1"/>Generando</Badge>;
          case 'completed':
              if (bankSize > 0) {
                 return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                 <Badge variant={'default'} className="text-xs ml-2 font-normal px-2 py-1 rounded-full whitespace-nowrap cursor-help">{`Preguntas: ${bankSize} / ${displaySize}`}</Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{`Preguntas: Banco ${bankSize} / Evaluación ${displaySize}`}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                 );
              }
              return <Badge variant={'secondary'} className="text-xs ml-2 font-normal px-2 py-1 rounded-full whitespace-nowrap">Falta Cuestionario</Badge>;
          case 'failed':
              return <Badge variant="destructive" className="text-xs ml-2 font-normal px-2 py-1 rounded-full whitespace-nowrap">Error</Badge>;
          case 'pending':
               return <Badge variant="outline" className="text-xs ml-2 font-normal px-2 py-1 rounded-full whitespace-nowrap">Pendiente</Badge>;
          default:
              return null;
      }
  };

  const handleLevelChange = <T extends keyof CourseLevel>(levelId: string, field: T, value: CourseLevel[T]) => {
      const updatePath = (path: CourseLevel[]) => path.map(level =>
          level.id === levelId ? { ...level, [field]: value } : level
      );

      if (generatedLearningPath.length > 0) {
          setGeneratedLearningPath(updatePath(generatedLearningPath) as ExtendedCourseLevel[]);
      } else {
          setLevels(updatePath(levels));
      }
  };

  const handleSyllabusChange = (levelId: string, sectionIndex: number, field: keyof SyllabusSection, value: string) => {
      const updatePath = (path: CourseLevel[]) => path.map(level => {
          if (level.id === levelId) {
              const newSyllabus = [...level.syllabus];
              newSyllabus[sectionIndex] = { ...newSyllabus[sectionIndex], [field]: value };
              return { ...level, syllabus: newSyllabus };
          }
          return level;
      });
      if (generatedLearningPath.length > 0) {
          setGeneratedLearningPath(updatePath(generatedLearningPath) as ExtendedCourseLevel[]);
      } else {
          setLevels(updatePath(levels));
      }
  };


  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
            <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
            </Button>
            <h1 className="text-xl md:text-3xl font-bold font-headline text-center">{isEditing || isAdminView ? 'Editar Curso' : 'Crear Nuevo Curso'}</h1>
            <div className="w-24 hidden sm:block"></div>
        </div>
        
        <Card className="premium-surface w-full animate-fade-in-up">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">1. Información del Curso</CardTitle>
                <CardDescription>Establece el nombre y la categoría. Guarda para poder generar contenido.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,auto] gap-4 items-end">
                    <div className="space-y-2">
                        <Label htmlFor="course-title" className="font-medium">Título del Curso</Label>
                        <Input
                        id="course-title"
                        placeholder="Ej: Fundamentos de React Avanzado"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                         <Label htmlFor="course-category" className="font-medium">Categoría</Label>
                         <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                            <SelectTrigger id="course-category" className="w-full md:w-[220px]">
                                <SelectValue placeholder="Selecciona una categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                {allCategories.map(category => (
                                    <SelectItem key={category.id} value={category.id}>
                                        {category.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                         </Select>
                    </div>
                    <Button onClick={handleSaveTitle} disabled={isLoading || !title.trim()} className="w-full md:w-auto">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {courseId ? 'Guardar' : 'Crear'}
                    </Button>
                </div>
            </CardContent>
        </Card>

        <SyllabusGenerator 
            onSyllabusIndexGenerated={handleSyllabusIndexGenerated}
            hasGeneratedContent={generatedLearningPath.length > 0}
            initialSourceFiles={sourceFiles}
            courseTitleSet={!!title.trim() && !!courseId}
            courseTitle={title}
            isLoading={isLoading || isGenerating}
        />

        <Card className="premium-surface w-full animate-fade-in-up">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="font-headline text-2xl flex items-center gap-2"><BookOpen />3. Ruta de Aprendizaje</CardTitle>
                </div>
                <CardDescription>
                    {isGenerating
                        ? "Generando contenido de los módulos secuencialmente..."
                        : "Aquí puedes ver y editar los módulos generados. Una vez que todo el contenido del temario esté listo, guarda la ruta de aprendizaje."
                    }
                </CardDescription>
            </CardHeader>
            <CardContent>
                {displayPath.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">Aún no se ha generado una ruta de aprendizaje para este curso.</p>
                )}
                <Accordion type="single" collapsible value={activeLevelId || ''} onValueChange={handleAccordionChange} className="w-full">
                    {displayPath.map((level, index) => (
                    <AccordionItem value={level.id} key={level.id}>
                        <div className="flex items-center w-full">
                            <AccordionTrigger className="font-semibold text-lg hover:no-underline flex-1" disabled={isLoading}>
                                <div className="text-left flex items-center">
                                    <span className="mr-2">{index + 1}.</span> 
                                    <Input 
                                        value={level.title}
                                        onChange={(e) => handleLevelChange(level.id, 'title', e.target.value)}
                                        className="text-lg font-semibold p-0 border-none focus-visible:ring-0 h-auto bg-transparent"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </AccordionTrigger>
                                <div className="flex items-center gap-2 pr-4">
                                {getStatusBadge(level)}
                                {(level.generationStatus === 'failed' || level.generationStatus === 'completed') && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleRetryModule(level.id)}
                                        disabled={isGenerating || isLoading}
                                        className="h-8 w-8 p-0"
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                        <span className="sr-only">Regenerar</span>
                                    </Button>
                                )}
                                <Button
                                    size="icon"
                                    variant="destructive"
                                    onClick={() => setModuleToDelete(level)}
                                    disabled={isGenerating || isLoading}
                                    className="h-8 w-8"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Eliminar Módulo</span>
                                </Button>
                            </div>
                        </div>
                        <AccordionContent className="space-y-4 rounded-2xl bg-secondary/30 p-4">
                            {level.generationStatus === 'generating' ? <p className="text-sm italic text-muted-foreground">Generando contenido detallado para este módulo...</p> 
                            : level.generationStatus === 'failed' ? <p className="text-sm italic text-destructive">Error: {level.errorMessage}</p>
                            : level.generationStatus === 'pending' ? <p className="text-sm italic text-muted-foreground">Pendiente de generación...</p>
                            : (
                            <>
                                <div className="space-y-2">
                                     <Label htmlFor={`intro-${level.id}`} className="font-semibold">Introducción del Módulo</Label>
                                     <Textarea
                                        id={`intro-${level.id}`}
                                        value={level.introduction}
                                        onChange={(e) => handleLevelChange(level.id, 'introduction', e.target.value)}
                                        rows={4}
                                     />
                                </div>
                                {level.syllabus && level.syllabus.length > 0 ? (
                                <Accordion type="single" collapsible className="w-full space-y-2 rounded-2xl bg-background p-2">
                                    <p className="px-2 text-sm font-semibold text-muted-foreground">Secciones del Temario</p>
                                    {(level.syllabus as SyllabusSection[]).map((section, sIndex) => (
                                    <AccordionItem value={`section-${sIndex}`} key={sIndex} className="rounded-xl border bg-card px-4">
                                        <AccordionTrigger className="p-0 text-sm font-medium text-left hover:no-underline [&>svg]:ml-auto">
                                            <Input
                                                value={section.title}
                                                onChange={(e) => handleSyllabusChange(level.id, sIndex, 'title', e.target.value)}
                                                className="text-sm font-medium p-0 border-none focus-visible:ring-0 h-auto bg-transparent"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2">
                                             <Textarea
                                                value={section.content}
                                                onChange={(e) => handleSyllabusChange(level.id, sIndex, 'content', e.target.value)}
                                                rows={8}
                                                className="text-sm"
                                            />
                                        </AccordionContent>
                                    </AccordionItem>
                                    ))}
                                </Accordion>
                                ) : (
                                <p className="text-sm text-muted-foreground">No se generó contenido para este módulo.</p>
                                )}
                            </>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
            {hasContentToSave && (
                <CardFooter className="justify-end border-t pt-6">
                    <Button onClick={handleSaveLearningPath} disabled={isLoading || isGenerating || !canSaveLearningPath()}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar Ruta de Aprendizaje
                    </Button>
                </CardFooter>
            )}
        </Card>
        
        <Card className="premium-surface w-full animate-fade-in-up">
            <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center gap-2"><FileQuestion />4. Generador de Cuestionarios</CardTitle>
                <CardDescription>
                    {activeLevel 
                        ? <span className="block">Genera el cuestionario para el módulo seleccionado: <strong className="text-lg font-bold italic block mt-1">"{activeLevel.title}"</strong></span>
                        : "Selecciona un módulo de la lista de arriba para generar su cuestionario."
                    }
                </CardDescription>
            </CardHeader>
            {activeLevel && (
                <CardContent>
                    <QuestionnaireGenerator 
                        key={activeLevel.id}
                        level={activeLevel}
                        onQuestionnaireGenerated={handleQuestionnaireGenerated}
                        isLoading={isLoading || isGenerating || activeLevel.generationStatus !== 'completed'}
                    />
                </CardContent>
            )}
        </Card>

        <AlertDialog open={!!moduleToDelete} onOpenChange={(isOpen) => !isOpen && setModuleToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro de que quieres eliminar este módulo?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Estás a punto de eliminar el módulo <span className="font-bold">"{moduleToDelete?.title}"</span>. Esta acción no se puede deshacer una vez guardada la ruta de aprendizaje.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setModuleToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirmDelete}
                        className={buttonVariants({ variant: "destructive" })}
                    >
                        Sí, eliminar módulo
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
