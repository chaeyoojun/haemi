export type Spot = {
  id: string;
  title: string;
  place: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type AirspaceKind =
  | 'prohibited'
  | 'restricted'
  | 'ctr'
  | 'atz'
  | 'danger'
  | 'ua'
  | 'dronezone';

export type AirspaceLevel = 'no-fly' | 'permit' | 'ua' | 'clear';

export type AirspaceZone = {
  kind: AirspaceKind;
  title: string;
  ident: string;
  name: string;
  lower: string;
  upper: string;
  altitude: string;
};

export type AirspaceLookup = {
  lat: number;
  lng: number;
  level: AirspaceLevel;
  title: string;
  summary: string;
  zones: AirspaceZone[];
  source: string;
};

export type RepairStatus = 'pending' | 'doing' | 'done';

export type RepairPhoto = {
  id: string;
  fileName: string;
  url: string;
};

export type Repair = {
  id: string;
  title: string;
  place: string;
  description: string;
  status: RepairStatus;
  photos?: RepairPhoto[];
  createdAt: string;
  updatedAt: string;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type VoteOption = {
  id: string;
  label: string;
  count: number;
  voteId: string;
};

export type Vote = {
  id: string;
  title: string;
  body: string;
  startsAt: string;
  endsAt: string;
  allowMultiple: boolean;
  createdAt: string;
  updatedAt: string;
  options: VoteOption[];
};

export type Model3d = {
  id: string;
  title: string;
  format: string;
  fileName: string;
  url: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export const repairStatusLabel: Record<RepairStatus, string> = {
  pending: '대기',
  doing: '진행',
  done: '완료',
};
