interface PageStepHeaderProps {
  step: number;
  title: string;
  className?: string;
}

export default function PageStepHeader({ step, title, className = "" }: PageStepHeaderProps) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-md bg-[#eeeeee] text-base font-bold">{step}</span>
      <span className="text-lg font-extrabold">{title}</span>
    </div>
  );
}
