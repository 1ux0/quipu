export function MarkdownView({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      className="h-full w-full resize-none bg-transparent pb-4 pl-14 pr-10 pt-10 font-body text-base leading-relaxed text-ink outline-none"
    />
  );
}
