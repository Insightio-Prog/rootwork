import { useRef, type ChangeEvent } from "react";

type HiddenFileButtonProps = {
  label: string;
  accept?: string;
  multiple?: boolean;
  className?: string;
  onFiles: (files: File[]) => void;
};

export function HiddenFileButton({
  label,
  accept = "image/*,application/pdf,.tif,.tiff",
  multiple = false,
  className = "btn btn-secondary",
  onFiles,
}: HiddenFileButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) onFiles(files);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={handleChange}
      />
      <button type="button" className={className} onClick={() => inputRef.current?.click()}>
        {label}
      </button>
    </>
  );
}
