export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/40 flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-xl font-semibold tracking-tight">
            Celeste<span className="text-primary">.bdc</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
