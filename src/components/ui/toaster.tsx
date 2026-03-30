"use client"

import { useToast } from "@/hooks/use-toast"
import { ChevronDown, Wrench } from "lucide-react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { getTechnicalDetailsForFriendlyMessage } from "@/lib/api-client"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const technicalDetails =
          typeof description === "string"
            ? getTechnicalDetailsForFriendlyMessage(description)
            : undefined

        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>
                  <div className="space-y-2">
                    <div>{description}</div>
                    {technicalDetails && (
                      <details className="group/details rounded-xl border border-border/70 bg-background/60 px-2.5 py-1.5">
                        <summary className="flex cursor-pointer list-none items-center justify-end gap-1.5 text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">
                          <span className="sr-only">Ver detalle técnico</span>
                          <Wrench className="h-3.5 w-3.5 shrink-0" />
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open/details:rotate-180" />
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-muted/55 p-2 text-[11px] leading-relaxed text-foreground/85">
                          {technicalDetails}
                        </pre>
                      </details>
                    )}
                  </div>
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
