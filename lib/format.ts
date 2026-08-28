export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatAuthorTime(author: string | undefined, iso: string): string {
  const when = formatDateTime(iso);
  const name = (author || '').trim();
  return name ? `${name} · ${when}` : when;
}

export function withAuthor(author: string | undefined, rest?: string) {
  const name = (author || '').trim();
  if (name && rest) {
    return `${name} · ${rest}`;
  }
  return name || rest || '';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

export function formatPeriod(startsAt: string, endsAt: string): string {
  return `${formatDateTime(startsAt)} ~ ${formatDateTime(endsAt)}`;
}
