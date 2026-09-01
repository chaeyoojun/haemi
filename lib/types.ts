export type Spot = {
  id: string;
  title: string;
  place: string;
  description: string;
  author?: string;
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
  author?: string;
  status: RepairStatus;
  photos?: RepairPhoto[];
  createdAt: string;
  updatedAt: string;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
};

export type VoteOption = {
  id: string;
  label: string;
  count: number;
  voteId: string;
  voters?: string[];
};

export type Vote = {
  id: string;
  title: string;
  body: string;
  author?: string;
  startsAt: string;
  endsAt: string;
  allowMultiple: boolean;
  createdAt: string;
  updatedAt: string;
  options: VoteOption[];
};

export type Model3dFile = {
  id: string;
  fileName: string;
  format: string;
  url: string;
  createdAt: string;
};

export type Model3d = {
  id: string;
  title: string;
  format: string;
  fileName: string;
  url: string;
  description: string;
  author?: string;
  hasPin?: boolean;
  createdAt: string;
  updatedAt: string;
  files?: Model3dFile[];
};

export const repairStatusLabel: Record<RepairStatus, string> = {
  pending: '대기',
  doing: '진행',
  done: '완료',
};

export type GameRank = {
  rank: number;
  name: string;
  score: number;
};
