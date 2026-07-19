export default function InlineSelectionValidation({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div aria-live="polite" className="mb-8 flex justify-center">
      <p role="alert" className="rounded-lg bg-[#fff8e6] px-4 py-3 text-sm font-bold text-[#8a5a00]">
        {message}
      </p>
    </div>
  );
}
