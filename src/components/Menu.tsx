import { useState } from "react";

export interface MenuItem {
  label: string;
  onClick: () => void;
}

export function Menu({
  trigger,
  items,
  align = "right",
  title = "Menu",
}: {
  trigger: string;
  items: MenuItem[];
  align?: "left" | "right";
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        title={title}
        className="px-1 font-ui text-sm leading-none text-ink hover:text-ink/60"
      >
        {trigger}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            className={`absolute ${align === "right" ? "right-0" : "left-0"} z-30 mt-1 w-28 border border-line bg-paper`}
          >
            {items.map((item) => (
              <button
                key={item.label}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick();
                }}
                className="block w-full px-3 py-1.5 text-left font-ui text-xs hover:bg-slate/10"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
