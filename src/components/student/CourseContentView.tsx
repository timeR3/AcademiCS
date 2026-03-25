'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Course, CourseLevel, SyllabusSection, CourseSourceFile, CourseBibliographyItem } from '@/types/index';
import { Button } from '@/components/ui/button';
import { BookOpen, ChevronsRight, FileText, CheckCircle2, ArrowLeft, Download, Link as LinkIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CourseContentSidebar } from './CourseContentSidebar';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import { apiGet } from '@/lib/api-client';


const downloadFile = (fileName: string, dataUrl: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

interface CourseContentViewProps {
    course: Course;
    onStartEvaluation: (level: CourseLevel) => void;
    onBackToDashboard: () => void;
}

export function CourseContentView({ course, onStartEvaluation, onBackToDashboard }: CourseContentViewProps) {
    const { toast } = useToast();
    const isCourseCompleted = useMemo(() => {
        return course.levels.every(l => l.status === 'completed');
    }, [course.levels]);

    const [activeSection, setActiveSection] = useState<SyllabusSection | null>(() => {
        // Find the first section of the first 'in-progress' level to show by default
        const inProgressLevel = course.levels.find(l => l.status === 'in-progress');
        if (inProgressLevel && inProgressLevel.syllabus.length > 0) {
            return inProgressLevel.syllabus[0];
        }
        // Fallback to the first section of the first level if no in-progress (e.g., all completed)
        if (course.levels.length > 0 && course.levels[0].syllabus.length > 0) {
            return course.levels[0].syllabus[0];
        }
        return null;
    });

    const handleSelectSection = useCallback((section: SyllabusSection) => {
        setActiveSection(section);
    }, []);
    
    // Find the parent level of the active section
    const activeLevel = useMemo(() => {
        if (!activeSection) return null;
        for (const level of course.levels) {
            if (level.syllabus.some(s => s.id === activeSection.id)) {
                return level;
            }
        }
        return null;
    }, [activeSection, course.levels]);

    // Determine if the active section is the last one in its module
    const isLastSectionOfModule = useMemo(() => {
        if (!activeLevel || !activeSection) return false;
        const syllabus = activeLevel.syllabus;
        const lastSectionId = syllabus[syllabus.length - 1]?.id;
        return activeSection.id === lastSectionId;
    }, [activeLevel, activeSection]);
    
    // Determine the next section or module to navigate to
    const nextNavigation = useMemo(() => {
        if (!activeLevel || !activeSection || isCourseCompleted) return null;

        const currentLevelIndex = course.levels.findIndex(l => l.id === activeLevel.id);
        const currentSectionIndex = activeLevel.syllabus.findIndex(s => s.id === activeSection.id);

        // If not the last section of the module, the next is in the same module
        if (currentSectionIndex < activeLevel.syllabus.length - 1) {
            const nextSection = activeLevel.syllabus[currentSectionIndex + 1];
            return { type: 'section' as const, section: nextSection };
        }
        
        // If it is the last section, the next is the evaluation
        return { type: 'evaluation' as const, level: activeLevel };
        
    }, [activeLevel, activeSection, course.levels, onStartEvaluation, isCourseCompleted]);

    const handleNextClick = () => {
        if (!nextNavigation) return;
        if (nextNavigation.type === 'section') {
            handleSelectSection(nextNavigation.section);
        } else if (nextNavigation.type === 'evaluation') {
            onStartEvaluation(nextNavigation.level);
        }
    };

    const handleDownloadSourceFile = async (file: CourseSourceFile) => {
        toast({ title: 'Preparando descarga...', description: `Tu descarga para "${file.fileName}" comenzará en breve.`});
        try {
            const { dataUrl, fileName } = await apiGet<{ dataUrl: string | null; fileName: string | null }>(`/api/source-files/${file.id}`);
            if (dataUrl && fileName) {
                downloadFile(fileName, dataUrl);
            } else {
                 throw new Error("El archivo no tiene contenido o el nombre no está disponible.");
            }
        } catch (error: any) {
            toast({ title: 'Error de Descarga', description: error.message, variant: 'destructive'});
        }
    };

    const handleDownloadBibliographyItem = async (item: CourseBibliographyItem) => {
        toast({ title: 'Preparando descarga...', description: `Tu descarga para "${item.itemName}" comenzará en breve.`});
        try {
            const { dataUrl, fileName } = await apiGet<{ dataUrl: string | null; fileName: string | null }>(`/api/bibliography/${item.id}`);
            if (dataUrl && fileName) {
                downloadFile(fileName, dataUrl);
            } else {
                 throw new Error("El archivo no tiene contenido o el nombre no está disponible.");
            }
        } catch (error: any) {
            toast({ title: 'Error de Descarga', description: error.message, variant: 'destructive'});
        }
    };


  return (
    <div className="flex flex-col h-full min-w-0 animate-fade-in">
        <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-bold mb-1">{course.title}</h1>
            <p className="text-muted-foreground text-base sm:text-lg">
                {isCourseCompleted 
                    ? "Has completado este curso. ¡Felicidades! Aquí puedes revisar el contenido."
                    : "Selecciona un tema en la barra lateral para comenzar a estudiar."
                }
            </p>
        </div>

        <div className="lg:hidden mb-4">
            <Card className="premium-surface">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Índice del curso</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="max-h-[40vh]">
                        <CourseContentSidebar 
                            levels={course.levels} 
                            activeSectionId={activeSection?.id}
                            onSelectSection={handleSelectSection} 
                        />
                    </div>
                </CardContent>
            </Card>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 flex-1 min-w-0">
        <aside className="lg:col-span-1 hidden lg:block">
            <CourseContentSidebar 
                levels={course.levels} 
                activeSectionId={activeSection?.id}
                onSelectSection={handleSelectSection} 
            />
        </aside>
        
        <main className="lg:col-span-3 min-w-0">
             <Tabs defaultValue="content" className="w-full">
                <TabsList className="w-full grid grid-cols-2 h-auto">
                    <TabsTrigger value="content" className="text-xs sm:text-sm text-center whitespace-normal leading-tight px-2 py-2">Contenido del Curso</TabsTrigger>
                    <TabsTrigger value="materials" className="text-xs sm:text-sm text-center whitespace-normal leading-tight px-2 py-2">Material de Estudio</TabsTrigger>
                </TabsList>
                <TabsContent value="content">
                    {activeSection && activeLevel ? (
                        <ScrollArea className="h-full pr-0 sm:pr-4">
                            <Card className="premium-surface">
                                <CardHeader>
                                    <CardTitle className="font-headline text-2xl md:text-3xl">{activeSection.title}</CardTitle>
                                    <CardDescription>
                                        Del módulo: <span className="font-semibold text-primary">{activeLevel.title}</span>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="prose dark:prose-invert max-w-none text-lg leading-relaxed">
                                    <ReactMarkdown>{activeSection.content}</ReactMarkdown>
                                </CardContent>
                                <CardFooter>
                                    {nextNavigation && (
                                        <Button onClick={handleNextClick}>
                                            <ChevronsRight className="mr-2 h-4 w-4" />
                                            {nextNavigation.type === 'section' ? `Siguiente: ${nextNavigation.section.title.substring(0, 20)}...` : `Iniciar Evaluación de "${nextNavigation.level.title}"`}
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        </ScrollArea>
                    ) : (
                        <div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed bg-card py-12 text-center">
                            <div>
                                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-medium">Selecciona un Tema</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Elige un tema del índice para ver su contenido.</p>
                            </div>
                        </div>
                    )}
                </TabsContent>
                <TabsContent value="materials">
                     <Card className="premium-surface">
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl md:text-3xl">Material de Estudio</CardTitle>
                            <CardDescription>
                                Descarga los documentos originales utilizados para crear este curso y la bibliografía complementaria.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <h3 className="font-semibold mb-3">Archivos Fuente del Curso</h3>
                                {course.sourceFiles && course.sourceFiles.length > 0 ? (
                                    <ul className="space-y-3">
                                        {course.sourceFiles.map(file => (
                                            <li key={file.id} className="flex items-center justify-between rounded-xl border bg-background p-3">
                                                <div className='flex items-center gap-3 overflow-hidden'>
                                                    <FileText className='h-6 w-6 text-primary shrink-0' />
                                                    <span className='font-medium'>{file.fileName}</span>
                                                </div>
                                                <Button onClick={() => handleDownloadSourceFile(file)} size="sm">
                                                    <Download className="mr-2 h-4 w-4"/>
                                                    Descargar
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-muted-foreground text-sm">Este curso no tiene archivos fuente.</p>
                                )}
                            </div>
                             <div>
                                <h3 className="font-semibold mb-3">Bibliografía Complementaria</h3>
                                {course.bibliography && course.bibliography.length > 0 ? (
                                    <ul className="space-y-3">
                                        {course.bibliography.map(item => (
                                            <li key={item.id} className="flex items-center justify-between rounded-xl border bg-background p-3">
                                                <div className='flex items-center gap-3 overflow-hidden'>
                                                    {item.itemType === 'file' ? <BookOpen className='h-6 w-6 text-primary shrink-0' /> : <LinkIcon className='h-6 w-6 text-primary shrink-0' />}
                                                    <span className='font-medium truncate' title={item.itemName}>{item.itemName}</span>
                                                </div>
                                                {item.itemType === 'file' ? (
                                                     <Button onClick={() => handleDownloadBibliographyItem(item)} size="sm">
                                                        <Download className="mr-2 h-4 w-4"/>
                                                        Descargar
                                                    </Button>
                                                ) : (
                                                    <Button asChild size="sm">
                                                        <a href={item.url || ''} target="_blank" rel="noopener noreferrer">
                                                            <LinkIcon className="mr-2 h-4 w-4" />
                                                            Abrir Enlace
                                                        </a>
                                                    </Button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-muted-foreground text-sm">Este curso no tiene bibliografía complementaria.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </main>
      </div>
    </div>
  )
}
