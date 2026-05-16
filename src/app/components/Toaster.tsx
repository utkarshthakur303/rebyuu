import { Toaster as SonnerToaster } from 'sonner'

export default function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        className: 'border border-gold/15 bg-card/95 text-foreground shadow-2xl shadow-black/30 backdrop-blur-xl',
        style: {
          fontFamily: 'Outfit, sans-serif',
          fontSize: '13px',
          borderRadius: '6px',
        },
      }}
    />
  )
}
