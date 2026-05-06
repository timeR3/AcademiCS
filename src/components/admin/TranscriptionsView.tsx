'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, Trash2, Eye, FileText, Loader2, RefreshCw, Hash, Database, ChevronRight, AlertCircle, Coins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiDelete, getFriendlyErrorMessage } from '@/lib/api-client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TranscriptionSummary {
    id: string;
    fileName: string;
    fileHash: string;
    status: string;
    uploadedAt: string;
    chunkCount: number;
    transcribedAt: string | null;
    inputTokens: number;
    outputTokens: number;
}

interface TranscriptionDetail {
    fileHash: string;
    structuredContent: Array<{ title: string; content: string }>;
    chunks: Array<{ index: number; content: string }>;
    metrics: {
        inputTokens: number;
        outputTokens: number;
        createdAt: string;
    };
}

export function TranscriptionsView() {
    const { toast } = useToast();
    const [transcriptions, setTranscriptions] = useState<TranscriptionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedHash, setSelectedHash] = useState<string | null>(null);
    const [detail, setDetail] = useState<TranscriptionDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [hashToDelete, setHashToDelete] = useState<string | null>(null);

    const fetchTranscriptions = async () => {
        setLoading(true);
        try {
            const response = await apiGet<any>('/api/admin/transcriptions');
            const data = Array.isArray(response) ? response : (response.data || []);
            setTranscriptions(data);
        } catch (error) {
            toast({
                title: 'Error al cargar transcripciones',
                description: getFriendlyErrorMessage(error),
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTranscriptions();
    }, []);

    const handleViewDetail = async (hash: string) => {
        setSelectedHash(hash);
        setLoadingDetail(true);
        try {
            const response = await apiGet<any>(`/api/admin/transcriptions/${hash}`);
            const data = response.data || response;
            setDetail(data);
        } catch (error) {
            toast({
                title: 'Error al cargar detalle',
                description: getFriendlyErrorMessage(error),
                variant: 'destructive',
            });
            setSelectedHash(null);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleDelete = async () => {
        if (!hashToDelete) return;
        setIsDeleting(true);
        try {
            await apiDelete(`/api/admin/transcriptions/${hashToDelete}`);
            toast({
                title: 'Transcripci�n eliminada',
                description: 'Los registros y el hash han sido liberados correctamente.',
            });
            setTranscriptions(prev => prev.filter(t => t.fileHash !== hashToDelete));
            if (selectedHash === hashToDelete) {
                setSelectedHash(null);
                setDetail(null);
            }
        } catch (error) {
            toast({
                title: 'Error al eliminar',
                description: getFriendlyErrorMessage(error),
                variant: 'destructive',
            });
        } finally {
            setIsDeleting(false);
            setHashToDelete(null);
        }
    };

    const filtered = transcriptions.filter(t => 
        t.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.fileHash.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold font-headline text-primary">Auditor de Contenido AI</h2>
                    <p className="text-muted-foreground text-sm">Inspecciona y gestiona el flujo de transcripci�n y costos.</p>
                </div>
                <Button variant="outline" onClick={fetchTranscriptions} disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar Datos
                </Button>
            </div>

            <Card className="premium-surface overflow-hidden">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar archivo o hash..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-md bg-background/50"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[30%]">Archivo</TableHead>
                                <TableHead>Hash ID</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-center">Chunks</TableHead>
                                <TableHead className="text-right">Consumo (Tokens)</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                                        Sincronizando auditor�a...
                                    </TableCell>
                                </TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                                        No se encontraron registros de IA.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((t) => (
                                    <TableRow key={t.id} className="hover:bg-muted/30 transition-colors group">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-foreground break-all leading-tight" title={t.fileName}>{t.fileName}</span>
                                                <span className="text-[10px] text-muted-foreground mt-1">Subido: {format(new Date(t.uploadedAt), 'dd/MM/yy HH:mm')}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-bold text-primary/80 uppercase">
                                                {t.fileHash.substring(0, 16)}...
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={t.status === 'completed' ? 'default' : t.status === 'failed' ? 'destructive' : 'secondary'} className="capitalize text-[10px] h-5">
                                                {t.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                                                <Database className="h-3 w-3" />
                                                {t.chunkCount}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                                                    <Coins className="h-3 w-3 text-amber-500" />
                                                    {(t.inputTokens + t.outputTokens).toLocaleString()}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground italic">
                                                    In: {t.inputTokens.toLocaleString()} | Out: {t.outputTokens.toLocaleString()}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => handleViewDetail(t.fileHash)} title="Ver Contenido">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setHashToDelete(t.fileHash)} title="Eliminar">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={!!selectedHash} onOpenChange={(open) => !open && setSelectedHash(null)}>
                <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl border-primary/20">
                    <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <DialogTitle className="flex items-center gap-2 text-xl">
                                    <FileText className="h-6 w-6 text-primary" />
                                    Inspecci�n de Transcripci�n
                                </DialogTitle>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">HASH ID:</span>
                                    <code className="text-sm font-black text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 select-all italic">
                                        {selectedHash}
                                    </code>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-hidden">
                        {loadingDetail ? (
                            <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground bg-background">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <p className="animate-pulse font-medium">Extrayendo estructura de la base de datos...</p>
                            </div>
                        ) : detail ? (
                            <Tabs defaultValue="json" className="h-full flex flex-col">
                                <div className="px-6 border-b bg-muted/40">
                                    <TabsList className="h-12 bg-transparent gap-6">
                                        <TabsTrigger value="json" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 h-full">Estructura JSON</TabsTrigger>
                                        <TabsTrigger value="chunks" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 h-full">Chunks Crudos ({detail.chunks?.length || 0})</TabsTrigger>
                                        <TabsTrigger value="metrics" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 h-full">M�tricas & Costo</TabsTrigger>
                                    </TabsList>
                                </div>
                                <div className="flex-1 min-h-0 bg-zinc-50 dark:bg-zinc-950/20">
                                    <TabsContent value="json" className="h-full m-0 p-0 overflow-hidden outline-none">
                                        <ScrollArea className="h-full">
                                            <div className="p-8 space-y-6 max-w-4xl mx-auto">
                                                {detail.structuredContent && detail.structuredContent.length > 0 ? (
                                                    detail.structuredContent.map((item, idx) => (
                                                        <div key={idx} className="space-y-3 group bg-background p-5 rounded-xl border shadow-sm hover:border-primary/30 transition-colors">
                                                            <div className="flex items-center gap-2 text-md font-black text-primary uppercase tracking-tight">
                                                                <ChevronRight className="h-5 w-5 text-primary/50" />
                                                                {item.title}
                                                            </div>
                                                            <div className="pl-7 text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
                                                                {item.content}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-center py-20 text-muted-foreground bg-background rounded-2xl border-2 border-dashed">
                                                        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                                        <p className="italic text-lg">No hay contenido estructurado disponible para esta transcripci�n.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>
                                    <TabsContent value="chunks" className="h-full m-0 p-0 overflow-hidden outline-none">
                                        <ScrollArea className="h-full">
                                            <div className="p-8 space-y-4 max-w-4xl mx-auto">
                                                {detail.chunks?.map((chunk) => (
                                                    <div key={chunk.index} className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="text-[10px] font-black tracking-widest bg-muted">FRAGMENTO #{chunk.index}</Badge>
                                                        </div>
                                                        <div className="font-mono text-xs p-4 bg-zinc-900 text-zinc-300 rounded-lg border border-zinc-800 shadow-inner leading-relaxed">
                                                            {chunk.content}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </TabsContent>
                                    <TabsContent value="metrics" className="h-full m-0 p-0 overflow-hidden outline-none">
                                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                                            <Card className="bg-background border-primary/10 shadow-sm">
                                                <CardHeader className="pb-2">
                                                    <CardDescription className="text-xs font-bold uppercase text-muted-foreground">Tokens Entrada</CardDescription>
                                                    <CardTitle className="text-3xl font-black font-mono text-primary">{detail.metrics?.inputTokens?.toLocaleString() || 0}</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-[11px] text-muted-foreground italic">Tokens consumidos por el prompt y contexto.</p>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-background border-primary/10 shadow-sm">
                                                <CardHeader className="pb-2">
                                                    <CardDescription className="text-xs font-bold uppercase text-muted-foreground">Tokens Salida</CardDescription>
                                                    <CardTitle className="text-3xl font-black font-mono text-primary">{detail.metrics?.outputTokens?.toLocaleString() || 0}</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-[11px] text-muted-foreground italic">Tokens generados por la IA en la respuesta.</p>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-primary/5 border-primary/20 md:col-span-2">
                                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                                    <div className="space-y-1">
                                                        <CardDescription className="text-xs font-bold uppercase text-primary/70">Inversi�n Total de Tokens</CardDescription>
                                                        <CardTitle className="text-5xl font-black font-mono text-primary">
                                                            {((detail.metrics?.inputTokens || 0) + (detail.metrics?.outputTokens || 0)).toLocaleString()}
                                                        </CardTitle>
                                                    </div>
                                                    <Coins className="h-12 w-12 text-primary/20" />
                                                </CardHeader>
                                                <CardContent className="pt-4 border-t border-primary/10 mt-2">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="font-bold text-muted-foreground">FECHA DE PROCESO:</span>
                                                        <span className="font-medium">
                                                            {detail.metrics?.createdAt ? format(new Date(detail.metrics.createdAt), "PPPP 'a las' p", { locale: es }) : 'N/A'}
                                                        </span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </TabsContent>
                                </div>
                            </Tabs>
                        ) : null}
                    </div>
                    
                    <DialogFooter className="p-6 border-t bg-muted/10">
                        <div className="flex justify-between items-center w-full">
                            <p className="text-[11px] text-muted-foreground italic max-w-xs">
                                Use esta herramienta con precauci�n. La eliminaci�n es irreversible y resetea el archivo para un nuevo intento de procesamiento.
                            </p>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => setSelectedHash(null)} className="font-bold">Cerrar Inspecci�n</Button>
                                <Button variant="destructive" className="font-bold shadow-lg shadow-destructive/20" onClick={() => {
                                    setHashToDelete(selectedHash);
                                    setSelectedHash(null);
                                }}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Borrar de la Plataforma
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!hashToDelete} onOpenChange={(open) => !open && setHashToDelete(null)}>
                <AlertDialogContent className="border-destructive/30">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive text-xl font-black">
                            <AlertCircle className="h-6 w-6" />
                            �CONFIRMAR ELIMINACI�N AT�MICA?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-foreground pt-2">
                            Est�s a punto de borrar permanentemente la transcripci�n y los fragmentos del hash:
                            <div className="my-4 p-3 bg-muted rounded-lg border font-mono text-xs font-black text-destructive uppercase break-all">
                                {hashToDelete}
                            </div>
                            Esta acci�n permitirá� que el archivo sea procesado de nuevo por la IA. **No existe bot�n de deshacer para esta operaci�n.**
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel disabled={isDeleting} className="font-bold">Abortar</AlertDialogCancel>
                        <Button 
                            variant="destructive" 
                            onClick={handleDelete} 
                            disabled={isDeleting}
                            className="font-bold"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    EJECUTANDO BORRADO...
                                </>
                            ) : 'S�, BORRAR PERMANENTEMENTE'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}


