

'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, RotateCcw, Save, Trash2, Pencil, Check } from 'lucide-react';
import type { Question } from '@/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import type { CourseLevel } from '@/types';
import { useCourse } from '@/context/CourseContext';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';
import { apiPost, apiPatch } from '@/lib/api-client';


interface QuestionnaireGeneratorProps {
    level: CourseLevel;
    isLoading: boolean;
    onQuestionnaireGenerated: (levelId: string, questionnaire: Question[], questionsToDisplay: number) => void;
}

type QuestionDifficulty = 'low' | 'medium' | 'high';

export function QuestionnaireGenerator({ level, isLoading, onQuestionnaireGenerated }: QuestionnaireGeneratorProps) {
  const [numQuestionsToGenerate, setNumQuestionsToGenerate] = useState(20);
  const [numQuestionsToDisplay, setNumQuestionsToDisplay] = useState(10);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('medium');
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { activeCourse, updateQuestionnaireForLevel } = useCourse();
  
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);


  useEffect(() => {
    // Sync with parent component's state for this level
    setGeneratedQuestions(level.questionnaire || []);
    setNumQuestionsToDisplay(level.questionsToDisplay || 10);
    // Open the first question for editing if it exists and we're not already editing
    if ((level.questionnaire || []).length > 0 && editingQuestionIndex === null) {
      setEditingQuestionIndex(0);
    } else if ((level.questionnaire || []).length === 0) {
      setEditingQuestionIndex(null); // Reset editing state when level changes or has no questions
    }
  }, [level]);

  const syllabusContent = level.syllabus.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n');

  const handleGenerate = async () => {
    if (!syllabusContent.trim()) {
      toast({ title: 'Error', description: 'No hay contenido en este módulo para generar un cuestionario.', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await apiPost<{ questionnaire: Question[] }>('/api/questionnaire/generate', {
          content: syllabusContent, 
          numQuestions: numQuestionsToGenerate,
          difficulty,
          moduleId: Number(level.id),
          courseId: activeCourse?.id ? Number(activeCourse.id) : undefined,
      });
      const newQuestions = result.questionnaire;
      setGeneratedQuestions(newQuestions);
      onQuestionnaireGenerated(level.id, newQuestions, numQuestionsToDisplay);
      toast({ title: '¡Banco de Preguntas Generado!', description: 'Las preguntas están listas para ser editadas. No olvides guardar el cuestionario.'});
      // Force open the first question for editing immediately after generation.
      if (newQuestions.length > 0) {
        setEditingQuestionIndex(0);
      }
    } catch (error: any) {
      toast({ title: 'Falló la Generación', description: `No se pudieron generar las preguntas. ${error.message}`, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleSave = async () => {
      if (editingQuestionIndex !== null) {
          toast({ title: 'Edición en curso', description: 'Finaliza la edición de la pregunta actual antes de guardar.', variant: 'destructive'});
          return;
      }
      if (numQuestionsToDisplay > generatedQuestions.length) {
          toast({ title: 'Error', description: 'No puedes mostrar más preguntas de las que hay en el banco.', variant: 'destructive' });
          return;
      }
      if (generatedQuestions.length === 0) {
           toast({ title: 'Nada que guardar', description: 'Primero genera un banco de preguntas.', variant: 'destructive' });
          return;
      }
      
      setIsSaving(true);
      try {
        await apiPatch<{ success: boolean }>(`/api/modules/${level.id}/questionnaire`, {
            questionnaire: generatedQuestions,
            questionsToDisplay: numQuestionsToDisplay
        });
        if (activeCourse?.id) {
          updateQuestionnaireForLevel(activeCourse.id, level.id, generatedQuestions, numQuestionsToDisplay);
        }
        onQuestionnaireGenerated(level.id, generatedQuestions, numQuestionsToDisplay);
        toast({ title: '¡Cuestionario Guardado!', description: 'El banco de preguntas y la configuración se han guardado en la base de datos.'});
      } catch(e: any) {
        toast({ title: 'Error al Guardar', description: e.message, variant: 'destructive' });
      } finally {
        setIsSaving(false);
      }
  };
  

  const handleQuestionTextChange = (qIndex: number, text: string) => {
    const question = generatedQuestions[qIndex];
    const updatedQuestion = { ...question, text };
    const updatedQuestions = [...generatedQuestions];
    updatedQuestions[qIndex] = updatedQuestion;
    setGeneratedQuestions(updatedQuestions);
  }

  const handleOptionChange = (qIndex: number, oIndex: number, text: string) => {
    const question = generatedQuestions[qIndex];
    const newOptions = [...question.options];
    newOptions[oIndex] = text;
    const updatedQuestion = { ...question, options: newOptions };
    const updatedQuestions = [...generatedQuestions];
    updatedQuestions[qIndex] = updatedQuestion;
    setGeneratedQuestions(updatedQuestions);
  }
  
  const handleCorrectOptionChange = (qIndex: number, newCorrectIndex: number) => {
    const question = generatedQuestions[qIndex];
    const updatedQuestion = { ...question, correctOptionIndex: newCorrectIndex };
    const updatedQuestions = [...generatedQuestions];
    updatedQuestions[qIndex] = updatedQuestion;
    setGeneratedQuestions(updatedQuestions);
  }

  const handleDeleteQuestion = (qIndex: number) => {
    const updated = generatedQuestions.filter((_, index) => index !== qIndex);
    setGeneratedQuestions(updated);
    onQuestionnaireGenerated(level.id, updated, numQuestionsToDisplay);
    setEditingQuestionIndex(null); // Close accordion if open
    toast({ title: 'Pregunta Eliminada', description: 'La pregunta ha sido eliminada del banco. No olvides guardar los cambios.'});
  }
  
  const handleToggleEdit = (qIndex: number) => {
    if (editingQuestionIndex === qIndex) {
        onQuestionnaireGenerated(level.id, generatedQuestions, numQuestionsToDisplay);
        setEditingQuestionIndex(null);
    } else {
        setEditingQuestionIndex(qIndex);
    }
  }


  const canSaveQuestionnaire = generatedQuestions.length > 0 && editingQuestionIndex === null && numQuestionsToDisplay <= generatedQuestions.length;

  return (
    <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Genera un banco de preguntas para este módulo. Luego, edita las preguntas, define cuántas se mostrarán al estudiante y guarda los cambios.</p>
        
        <div className="grid grid-cols-1 xl:grid-cols-[auto,auto,minmax(0,1fr),auto,auto] gap-4 items-center">
            <div className="flex items-center gap-4">
                <Label htmlFor={`num-questions-gen-${level.id}`} className="font-medium whitespace-nowrap">Nº de Preguntas a Generar</Label>
                <Input
                id={`num-questions-gen-${level.id}`}
                type="number"
                value={numQuestionsToGenerate}
                onChange={(e) => setNumQuestionsToGenerate(Math.max(1, parseInt(e.target.value, 10)) || 1)}
                className="w-24"
                min="1"
                disabled={isLoading || isGenerating || isSaving}
                />
            </div>
            <div className="flex items-center gap-4">
                <Label htmlFor={`num-questions-display-${level.id}`} className="font-medium whitespace-nowrap">Nº de Preguntas a Mostrar</Label>
                <Input
                id={`num-questions-display-${level.id}`}
                type="number"
                value={numQuestionsToDisplay}
                onChange={(e) => {
                  const nextValue = Math.max(1, parseInt(e.target.value, 10)) || 1;
                  setNumQuestionsToDisplay(nextValue);
                  if (level.id.startsWith("gen-")) {
                    onQuestionnaireGenerated(level.id, generatedQuestions, nextValue);
                  }
                }}
                className="w-24"
                min="1"
                max={generatedQuestions.length || undefined}
                disabled={isLoading || isGenerating || isSaving || editingQuestionIndex !== null}
                />
            </div>
            <div className="rounded-2xl border bg-card p-4">
                <Label className="mb-3 block font-medium">Dificultad</Label>
                <RadioGroup
                    value={difficulty}
                    onValueChange={(value) => setDifficulty(value as QuestionDifficulty)}
                    className="flex flex-wrap gap-4"
                >
                    <div className="flex items-center gap-2">
                        <RadioGroupItem value="low" id={`difficulty-low-${level.id}`} />
                        <Label htmlFor={`difficulty-low-${level.id}`}>Baja</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <RadioGroupItem value="medium" id={`difficulty-medium-${level.id}`} />
                        <Label htmlFor={`difficulty-medium-${level.id}`}>Media</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <RadioGroupItem value="high" id={`difficulty-high-${level.id}`} />
                        <Label htmlFor={`difficulty-high-${level.id}`}>Alta</Label>
                    </div>
                </RadioGroup>
            </div>
             <Button onClick={handleGenerate} disabled={isLoading || isGenerating || isSaving || !syllabusContent.trim()} className="w-full xl:w-auto">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (generatedQuestions.length > 0 ? <RotateCcw className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />)}
              {generatedQuestions.length > 0 ? 'Volver a Generar' : 'Generar Preguntas'}
            </Button>
            {!level.id.startsWith("gen-") && (
              <Button onClick={handleSave} disabled={isLoading || isGenerating || isSaving || !canSaveQuestionnaire} className="w-full xl:w-auto">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar Cuestionario
              </Button>
            )}
        </div>
         {isGenerating && <p className="text-sm text-muted-foreground animate-pulse">La IA está creando un banco de preguntas para "{level.title}"...</p>}

        {generatedQuestions.length > 0 && (
          <div className="mt-4 space-y-6">
            <div className="space-y-2">
                 <h4 className="font-semibold">Editor del Banco de Preguntas ({generatedQuestions.length} en total)</h4>
                <ScrollArea className="h-[500px] space-y-4 rounded-xl border bg-background p-4">
                   <Accordion type="single" collapsible value={editingQuestionIndex !== null ? `q-${editingQuestionIndex}` : undefined} onValueChange={(value) => setEditingQuestionIndex(value ? parseInt(value.split('-')[1]) : null)}>
                    {generatedQuestions.map((q, qIndex) => {
                        const isEditingThis = editingQuestionIndex === qIndex;
                        return (
                        <AccordionItem value={`q-${qIndex}`} key={`q-${qIndex}`} className="mb-2 rounded-xl border bg-card">
                           <div className="flex items-center w-full">
                                <AccordionTrigger className="font-semibold text-base hover:no-underline flex-1 text-left px-4 py-2">
                                    <span className="text-left flex items-start pr-4">
                                        <span className="text-primary font-bold mr-3">{qIndex + 1}.</span>
                                        {q.text}
                                    </span>
                                </AccordionTrigger>
                                <div className="flex items-center gap-2 pl-4 pr-4">
                                     <Button size="sm" variant={isEditingThis ? "default" : "outline"} onClick={() => handleToggleEdit(qIndex)} disabled={isLoading || isSaving}>
                                        {isEditingThis ? <Check className="mr-2 h-4 w-4"/> : <Pencil className="mr-2 h-4 w-4"/>}
                                        {isEditingThis ? 'Aceptar' : 'Editar'}
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(qIndex)} className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0" disabled={isEditingThis || isLoading || isSaving}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <AccordionContent className="p-4 pt-0 space-y-4">
                                <Label htmlFor={`q-text-${qIndex}`} className="font-semibold">Texto de la Pregunta</Label>
                                <Textarea
                                    id={`q-text-${qIndex}`}
                                    value={q.text}
                                    onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                                    rows={3}
                                    className="text-base"
                                />
                                <Label className="font-semibold">Opciones de Respuesta</Label>
                                <RadioGroup value={q.correctOptionIndex.toString()} onValueChange={(value) => handleCorrectOptionChange(qIndex, parseInt(value))}>
                                    {q.options.map((opt: string, oIndex: number) => (
                                        <div key={`q-${qIndex}-opt-${oIndex}`} className={cn("flex items-start gap-3 rounded-xl border p-3 transition-colors", q.correctOptionIndex === oIndex && "border-primary bg-primary/5")}>
                                            <div className="mt-1">
                                                <RadioGroupItem value={oIndex.toString()} id={`q-${qIndex}-opt-radio-${oIndex}`} />
                                            </div>
                                            <Textarea
                                                id={`q-${qIndex}-opt-input-${oIndex}`}
                                                value={opt}
                                                onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                                                className={cn("flex-1 text-sm min-h-0", q.correctOptionIndex === oIndex && "font-semibold")}
                                                rows={2}
                                            />
                                        </div>
                                    ))}
                                </RadioGroup>
                            </AccordionContent>
                        </AccordionItem>
                        );
                    })}
                   </Accordion>
                </ScrollArea>
            </div>
          </div>
        )}
      </div>
  );
}
    

    

    
