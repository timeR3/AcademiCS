'use client';
import type { CourseLevel, CourseLevelStatus, SyllabusSection } from "@/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, Lock, PlayCircle, FileText } from 'lucide-react';
import { ScrollArea } from "../ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";

interface CourseContentSidebarProps {
    levels: CourseLevel[];
    activeSectionId?: string;
    onSelectSection: (section: SyllabusSection) => void;
}

const statusConfig: Record<CourseLevelStatus, { icon: React.ElementType, color: string }> = {
  completed: { icon: CheckCircle2, color: 'text-green-500' },
  'in-progress': { icon: PlayCircle, color: 'text-primary' },
  locked: { icon: Lock, color: 'text-muted-foreground' },
};

export function CourseContentSidebar({ levels, activeSectionId, onSelectSection }: CourseContentSidebarProps) {
    const defaultOpenLevel = levels.find(l => l.status === 'in-progress')?.id || levels[0]?.id || '';
    
    return (
        <ScrollArea className="h-full max-h-[75vh] pr-4">
             <Accordion type="single" collapsible defaultValue={defaultOpenLevel} className="w-full">
                {levels.map(level => {
                    const config = statusConfig[level.status];
                    const Icon = config.icon;
                    const isLocked = level.status === 'locked';

                    return (
                         <AccordionItem value={level.id} key={level.id}>
                            <AccordionTrigger disabled={isLocked} className="hover:no-underline disabled:opacity-50">
                                <div className="flex items-center gap-3 text-left">
                                    <Icon className={cn("h-5 w-5 shrink-0", config.color)} />
                                    <span className="font-semibold text-base">{level.title}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pl-6 border-l-2 ml-2.5">
                                 <ul className="space-y-1 mt-2">
                                    {level.syllabus.map(section => (
                                        <li key={section.id}>
                                            <button 
                                                onClick={() => onSelectSection(section)}
                                                disabled={isLocked}
                                                className={cn(
                                                    "w-full text-left p-2 rounded-md text-sm flex items-center gap-2 transition-colors",
                                                    activeSectionId === section.id 
                                                        ? "bg-primary/10 text-primary font-semibold" 
                                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                                    isLocked && "cursor-not-allowed"
                                                )}
                                            >
                                                <FileText className="h-4 w-4 shrink-0" />
                                                <span className="flex-1">{section.title}</span>
                                            </button>
                                        </li>
                                    ))}
                                 </ul>
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>
        </ScrollArea>
    );
}
