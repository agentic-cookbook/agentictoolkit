"use client"

import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { X } from "lucide-react"

import { cn } from "../lib/utils"

// Base UI toast. Wrap the app (or a subtree) in <ToastProvider>, render
// <Toaster/> once inside it, and call `useToast().add({ title, description })`
// from any descendant to enqueue a toast.
const ToastProvider = ToastPrimitive.Provider
const useToast = ToastPrimitive.useToastManager

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager()
  return toasts.map((toast) => (
    <ToastPrimitive.Root
      key={toast.id}
      toast={toast}
      className={cn(
        "relative flex flex-col gap-1 rounded-lg border border-apt-border bg-apt-surface-2 p-4 pr-9 text-sm shadow-lg outline-none",
        "transition-all data-ending-style:opacity-0 data-starting-style:opacity-0",
      )}
    >
      <ToastPrimitive.Title className="text-sm font-medium text-apt-text" />
      <ToastPrimitive.Description className="text-sm text-apt-text-muted" />
      <ToastPrimitive.Close
        aria-label="Close"
        className="absolute top-3 right-3 rounded text-apt-text-muted transition-colors outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40"
      >
        <X className="size-4" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  ))
}

function Toaster() {
  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        <ToastList />
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  )
}

export { ToastProvider, Toaster, useToast }
