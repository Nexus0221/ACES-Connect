export type Profile = {
  id: string
  display_name: string
  avatar_url: string | null
  role: 'member' | 'admin'
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
