import { Field } from '@/components/Form';

function toLocalInput(value: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function DateTimeField({
  label,
  value,
  onChange,
  minimumDate,
}: {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  minimumDate?: Date;
}) {
  return (
    <Field label={label}>
      <input
        type="datetime-local"
        value={toLocalInput(value)}
        min={minimumDate ? toLocalInput(minimumDate) : undefined}
        onChange={(event) => {
          if (event.target.value) {
            onChange(new Date(event.target.value));
          }
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          border: '1px solid #EDEDED',
          borderRadius: 12,
          padding: '12px 14px',
          fontSize: 16,
          fontFamily: 'inherit',
          background: '#FFFFFF',
          color: '#1A1A1A',
        }}
      />
    </Field>
  );
}
