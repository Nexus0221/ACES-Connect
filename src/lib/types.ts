export type Profile = {
  id: string
  display_name: string
  avatar_url: string | null
  role: 'member' | 'admin'
  position: string | null
}

export type Room = {
  id: string
  name: string
  description: string | null
}

export type Attachment = {
  path: string
  name: string
  mime: string
  size: number
}

export type Message = {
  id: string
  room_id: string
  user_id: string
  content: string
  attachments: Attachment[]
  created_at: string
}

/** Every ACES officer / coordinator / committee position. Anyone holding one can create rooms. */
export const POSITIONS = [
  'President',
  'Vice President',
  'Secretary',
  'Assistant Secretary',
  'Public Relations Officer (P.R.O)',
  'Treasurer',
  'Assistant Treasurer',
  'Auditor',
  'Assistant Auditor',
  '4th Year Representative',
  '3rd Year Representative',
  '2nd Year Representative',
  '1st Year Representative',
  'ODL/Offshore Representative',
  'Snap Coordinator',
  'Media Coordinator',
  'Technical Coordinator',
  'Sports League Coordinator',
  'Snap Committee',
  'Media Committee',
  'Technical Committee',
  'Sports League Committee',
] as const

export function canCreateRooms(p: Pick<Profile, 'role' | 'position'>) {
  return p.role === 'admin' || !!p.position
}
