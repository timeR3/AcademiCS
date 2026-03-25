'use client';
import { useState, useMemo } from 'react';
import type { CourseLevel, Question } from '@/types/index';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, ArrowRight, Flag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { IncorrectAnswer } from '@/types';
import { apiPost } from '@/lib/api-client';

interface EvaluationViewProps {
  level: CourseLevel;
  courseId: string;
  onFinish: (result: { score: number; passed: boolean; incorrectAnswers: IncorrectAnswer[] }) => void;
  onBack: () => void;
}

// Fisher-Yates shuffle algorithm
const shuffleArray = (array: any[]) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

export function EvaluationView({ level, courseId, onFinish, onBack }: EvaluationViewProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({}); // Using indices: { questionIndex: optionIndex }
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Memoize the shuffled questions for the duration of the component's life
  const questions = useMemo(() => {
    const questionBank = level.questionnaire || [];
    if (questionBank.length === 0) {
      return [];
    }
    const shuffled = shuffleArray([...questionBank]);
    return shuffled.slice(0, level.questionsToDisplay || shuffled.length);
  }, [level.id, level.questionnaire, level.questionsToDisplay]); // Use level.id to re-shuffle for a new evaluation


  const handleAnswerChange = (value: string) => {
    // The value from RadioGroupItem is the option text, we need to find its index
    const optionIndex = questions[currentQuestionIndex].options.findIndex((opt: string) => opt === value);
    setAnswers(prev => ({ ...prev, [currentQuestionIndex]: optionIndex }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length !== questions.length) {
      toast({ title: 'Incompleto', description: 'Por favor, responde todas las preguntas antes de enviar.', variant: 'destructive' });
      return;
    }
    if (!user) {
       toast({ title: 'Error', description: 'No se ha podido identificar al usuario. Por favor, inicia sesión de nuevo.', variant: 'destructive' });
       return;
    }
    setIsLoading(true);
    try {
      // Calculate score and track incorrect answers on the client side.
      let correctAnswersCount = 0;
      const incorrectAnswers: IncorrectAnswer[] = [];
      
      questions.forEach((q, index) => {
        const userAnswerIndex = answers[index];
        if (userAnswerIndex === q.correctOptionIndex) {
          correctAnswersCount++;
        } else {
          incorrectAnswers.push({
            questionText: q.text,
            userAnswer: q.options[userAnswerIndex],
            correctAnswer: q.options[q.correctOptionIndex],
          });
        }
      });

      const score = Math.round((correctAnswersCount / questions.length) * 100);
      
      // Submit to server which will determine 'passed' and update course completion status
      const result = await apiPost<{ passed: boolean; finalScore?: number }>('/api/evaluations', {
        studentId: user.id,
        courseId: Number(courseId),
        moduleId: Number(level.id),
        score: score,
      });
      
      onFinish({ score, passed: result.passed, incorrectAnswers });

    } catch (error) {
      toast({ title: 'Error al Enviar', description: 'No se pudo enviar tu evaluación. Por favor, inténtalo de nuevo.', variant: 'destructive' });
      setIsLoading(false);
    }
  };
  
  if (questions.length === 0) {
    return (
        <Card className="premium-surface w-full max-w-2xl animate-fade-in">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Evaluación no disponible</CardTitle>
          </CardHeader>
          <CardContent>
            <p>El profesor aún no ha creado el cuestionario para este módulo.</p>
          </CardContent>
           <CardFooter>
            <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4"/> Volver
            </Button>
           </CardFooter>
        </Card>
    )
  }

  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const currentQuestion = questions[currentQuestionIndex];
  const selectedOptionIndex = answers[currentQuestionIndex];
  const selectedOptionValue = selectedOptionIndex !== undefined ? currentQuestion.options[selectedOptionIndex] : "";


  return (
    <div className="flex justify-center flex-col items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="self-start">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Contenido del Curso
        </Button>
        <Card className="premium-surface w-full max-w-2xl animate-fade-in">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">{level.title} - Evaluación</CardTitle>
            <CardDescription>Pregunta {currentQuestionIndex + 1} de {questions.length}</CardDescription>
            <Progress value={progress} className="mt-2"/>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-lg mb-6">{currentQuestion.text}</p>
            <RadioGroup value={selectedOptionValue} onValueChange={handleAnswerChange} className="space-y-2">
              {currentQuestion.options.map((option: string, index: number) => (
                <div key={index} className="flex items-center space-x-3 rounded-xl border p-3 transition-colors hover:bg-secondary has-[[data-state=checked]]:border-primary">
                  <RadioGroupItem value={option} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer text-base">{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
          <CardFooter className="justify-between border-t pt-6">
            <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0 || isLoading}>
                <ArrowLeft className="mr-2 h-4 w-4"/> Anterior
            </Button>
            {currentQuestionIndex < questions.length - 1 ? (
              <Button onClick={handleNext}>Siguiente <ArrowRight className="ml-2 h-4 w-4"/></Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Flag className="mr-2 h-4 w-4"/>} Finalizar Evaluación
              </Button>
            )}
          </CardFooter>
        </Card>
    </div>
  );
}
