import { Toaster as SonnerToaster } from 'sonner'

export default function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        className: 'border border-border bg-popover text-popover-foreground shadow-lg'
      }}
    />
  )
}

