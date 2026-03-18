'use client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Award, Check, X, Trophy } from 'lucide-react';
import type { IncorrectAnswer } from '@/types';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import ReactConfetti from 'react-confetti';
import { useState, useEffect } from 'react';

interface ResultsModalProps {
  result: {
    score: number;
    passed: boolean;
    incorrectAnswers?: IncorrectAnswer[];
    finalScore?: number;
  };
  onNext: () => void;
  isCourseCompleted: boolean;
}

export function ResultsModal({ result, onNext, isCourseCompleted }: ResultsModalProps) {
  const { score, passed, incorrectAnswers, finalScore } = result;
  const [showConfetti, setShowConfetti] = useState(isCourseCompleted);

  useEffect(() => {
    if (isCourseCompleted) {
      const timer = setTimeout(() => setShowConfetti(false), 8000); // Let it rain for 8 seconds
      return () => clearTimeout(timer);
    }
  }, [isCourseCompleted]);
  
  const getButtonText = () => {
    if (isCourseCompleted) {
      return '¡Finalizar y Volver al Panel!';
    }
    if (passed) {
      return 'Continuar al Siguiente Módulo';
    }
    return 'Volver a la Ruta de Aprendizaje';
  }

  return (
    <>
      {showConfetti && <ReactConfetti recycle={false} numberOfPieces={400} />}
      <Dialog open={true} onOpenChange={(isOpen) => { if (!isOpen) onNext(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center items-center">
              {isCourseCompleted ? (
                <Trophy className="h-20 w-20 text-yellow-400 mb-4" />
              ) : passed ? (
                  <CheckCircle2 className="h-20 w-20 text-green-500 mb-4" />
              ) : (
                  <XCircle className="h-20 w-20 text-destructive mb-4" />
              )}
            <DialogTitle className="font-headline text-3xl">
              {isCourseCompleted ? "¡Curso Completado!" : "¡Evaluación Completa!"}
            </DialogTitle>
            <DialogDescription className="text-lg">
                {isCourseCompleted && finalScore !== undefined ? (
                    <>Has obtenido una calificación final de <span className="font-bold text-primary">{finalScore.toFixed(1)}%</span></>
                ) : (
                    <>Obtuviste un <span className="font-bold text-primary">{score}%</span>.</>
                )}
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 text-center">
              {isCourseCompleted ? (
                  <p className="text-green-600 flex items-center justify-center gap-2">
                    <Award />
                    ¡Felicidades! Has dominado todos los módulos. ¡Sigue así!
                  </p>
              ) : passed ? (
                  <p className="text-green-600 flex items-center justify-center gap-2">
                    <Award />
                    ¡Felicidades! Has aprobado y desbloqueado el siguiente módulo.
                  </p>
              ) : (
                  <p className="text-destructive">No te preocupes, puedes intentarlo de nuevo. ¡Revisa el material y tus errores abajo!</p>
              )}
          </div>
          
          {!passed && incorrectAnswers && incorrectAnswers.length > 0 && (
              <>
                  <Separator />
                  <div className='my-4'>
                      <h3 className="font-semibold text-center mb-2">Revisión de Errores</h3>
                      <ScrollArea className='h-40 w-full rounded-md border p-4 bg-secondary/50'>
                          <div className="space-y-4">
                              {incorrectAnswers.map((item, index) => (
                                  <div key={index} className='text-sm'>
                                      <p className='font-bold'>{item.questionText}</p>
                                      <div className='mt-1 flex items-start gap-2 text-destructive'>
                                          <X className='h-4 w-4 mt-0.5 shrink-0' />
                                          <p><span className='font-medium'>Tu respuesta:</span> {item.userAnswer}</p>
                                      </div>
                                       <div className='mt-1 flex items-start gap-2 text-green-600'>
                                          <Check className='h-4 w-4 mt-0.5 shrink-0' />
                                          <p><span className='font-medium'>Respuesta correcta:</span> {item.correctAnswer}</p>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </ScrollArea>
                  </div>
              </>
          )}

          <DialogFooter>
            <Button onClick={onNext} className="w-full">
              {getButtonText()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
