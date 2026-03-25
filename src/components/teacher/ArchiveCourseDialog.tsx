'use client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "../ui/button";

interface ArchiveCourseDialogProps {
  courseName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ArchiveCourseDialog({ courseName, onCancel, onConfirm }: ArchiveCourseDialogProps) {
  return (
    <AlertDialog open={true} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás seguro de que quieres archivar este curso?</AlertDialogTitle>
          <AlertDialogDescription>
            Estás a punto de archivar el curso <span className="font-bold">"{courseName}"</span>. No podrás editarlo y los estudiantes no podrán inscribirse, pero no se eliminará permanentemente. Podrás recuperarlo más tarde.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className={buttonVariants({ variant: "destructive" })}
           >
            Sí, Archivar Curso
           </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
