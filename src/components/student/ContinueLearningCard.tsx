'use client';
import type { Course, CourseLevel } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayCircle, Zap } from 'lucide-react';
import Image from 'next/image';

interface ContinueLearningCardProps {
    course: Course;
    level: CourseLevel;
    onContinue: () => void;
}

export function ContinueLearningCard({ course, level, onContinue }: ContinueLearningCardProps) {
    
    return (
        <Card className="shadow-lg transition-all hover:shadow-xl w-full overflow-hidden bg-gradient-to-tr from-primary/10 via-background to-background border-primary/20">
            <div className="flex flex-col sm:flex-row items-center justify-between p-6 gap-6">
                 <div className="flex-1">
                    <CardHeader className="p-0 mb-2">
                        <CardTitle className="font-headline text-2xl flex items-center gap-2">
                            <Zap className="text-primary h-6 w-6"/>
                            Continuar Aprendiendo
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <p className="text-muted-foreground">
                            Siguiente módulo en <strong className="text-foreground">{course.title}</strong>:
                        </p>
                        <p className="text-lg font-semibold">{level.title}</p>
                    </CardContent>
                </div>
                <CardFooter className="p-0">
                    <Button onClick={onContinue} className="w-full sm:w-auto">
                        <PlayCircle className="mr-2 h-4 w-4"/>
                        Ir al Módulo
                    </Button>
                </CardFooter>
            </div>
        </Card>
    );
}
