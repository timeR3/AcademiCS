
'use client';
import { useState, useRef } from 'react';
import { useCourse } from '@/context/CourseContext';
import { useToast } from '@/hooks/use-toast';
import { addBibliographyItem, deleteBibliographyItem } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Loader2, UploadCloud, FileText, Trash2, Link as LinkIcon, Plus } from 'lucide-react';
import type { CourseBibliographyItem } from '@/types';

const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export function CourseBibliography() {
  const { activeCourse, refreshCourses } = useCourse();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!activeCourse) return null;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setIsUploading(true);
      try {
        const dataUri = await fileToDataURL(file);
        await addBibliographyItem({
          courseId: Number(activeCourse.id),
          type: 'file',
          fileName: file.name,
          dataUri,
        });
        toast({ title: 'Archivo Añadido', description: `${file.name} ha sido añadido a la bibliografía.` });
        await refreshCourses();
      } catch (error: any) {
        toast({ title: 'Error al Subir', description: error.message, variant: 'destructive' });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleAddLink = async () => {
      if (!linkUrl.trim()) {
          toast({ title: 'URL vacía', description: 'Por favor, introduce una URL válida.', variant: 'destructive'});
          return;
      }
      setIsAddingLink(true);
      try {
          await addBibliographyItem({
              courseId: Number(activeCourse.id),
              type: 'link',
              url: linkUrl,
          });
          toast({ title: 'Enlace Añadido', description: 'El enlace ha sido añadido a la bibliografía.'});
          setLinkUrl('');
          await refreshCourses();
      } catch (error: any) {
          toast({ title: 'Error al Añadir Enlace', description: error.message, variant: 'destructive' });
      } finally {
        setIsAddingLink(false);
      }
  }

  const handleDelete = async (item: CourseBibliographyItem) => {
    setIsDeleting(item.id);
    try {
        await deleteBibliographyItem(item.id);
        toast({ title: 'Ítem Eliminado', description: `"${item.itemName}" ha sido eliminado de la bibliografía.` });
        await refreshCourses();
    } catch (error: any) {
        toast({ title: 'Error al Eliminar', description: error.message, variant: 'destructive' });
    } finally {
        setIsDeleting(null);
    }
  };
  
  const isLoading = isUploading || isAddingLink;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center gap-2">
          <FileText />
          Bibliografía Complementaria
        </CardTitle>
        <CardDescription>
          Añade archivos PDF, documentos o enlaces a recursos externos (como vídeos de YouTube) que los estudiantes puedan consultar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input 
                type="url"
                placeholder="Pega una URL (ej. YouTube, blog...)"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                disabled={isLoading}
            />
             <Button onClick={handleAddLink} disabled={isLoading || !linkUrl.trim()} className="w-full sm:w-auto">
                {isAddingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Añadir Enlace
            </Button>
          </div>
           <div className="relative flex items-center">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink mx-4 text-muted-foreground text-xs">O</span>
                <div className="flex-grow border-t border-border"></div>
            </div>
          <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading} variant="outline" className="w-full">
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {isUploading ? 'Subiendo Archivo...' : 'Subir un Archivo (PDF, etc.)'}
          </Button>
          <Input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept="application/pdf"
            onChange={handleFileChange}
            onClick={(e) => (e.currentTarget.value = '')}
          />
        </div>
        {activeCourse.bibliography && activeCourse.bibliography.length > 0 ? (
          <ul className="space-y-3 pt-4 border-t">
            {activeCourse.bibliography.map((item) => (
              <li key={item.id} className="flex items-center justify-between p-3 rounded-md border bg-background">
                <div className="flex items-center gap-3 overflow-hidden">
                    {item.itemType === 'file' ? (
                        <FileText className="h-6 w-6 text-primary shrink-0" />
                    ) : (
                        <LinkIcon className="h-6 w-6 text-primary shrink-0" />
                    )}
                  <span className="font-medium text-sm truncate" title={item.itemName}>{item.itemName}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDelete(item)}
                        disabled={isDeleting === item.id}
                        title="Eliminar ítem"
                    >
                        {isDeleting === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-center text-muted-foreground py-4">
            No hay archivos ni enlaces en la bibliografía de este curso.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
