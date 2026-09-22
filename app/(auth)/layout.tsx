export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#e4efe8,_#f7f6f3_50%)] p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">{children}</div>
    </div>
  );
}
