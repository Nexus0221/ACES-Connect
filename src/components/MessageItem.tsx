import { Trash2 } from 'lucide-react'
import { Avatar } from './Avatar'
import { AttachmentView } from './Attachment'
import type { Message, Profile } from '../lib/types'

function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer noopener">
        {part}
      </a>
    ) : (
      part
    ),
  )
}

type Props = {
  message: Message
  author: Profile | undefined
  compact: boolean
  canDelete: boolean
  onDelete: (id: string) => void
}

export function MessageItem({ message, author, compact, canDelete, onDelete }: Props) {
  const name = author?.display_name ?? 'Former member'
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <article className={`msg ${compact ? 'compact' : ''}`}>
      {compact ? (
        <span className="msg-gutter" />
      ) : (
        <Avatar name={name} src={author?.avatar_url} size={40} />
      )}
      <div className="msg-body">
        {!compact && (
          <header>
            <strong>{name}</strong>
            <time>{time}</time>
          </header>
        )}
        {message.content && <p className="msg-text">{linkify(message.content)}</p>}
        {message.attachments.length > 0 && (
          <div className="atts">
            {message.attachments.map((a) => (
              <AttachmentView key={a.path} a={a} />
            ))}
          </div>
        )}
      </div>
      {canDelete && (
        <button
          className="msg-del"
          aria-label="Delete message"
          onClick={() => {
            if (window.confirm('Delete this message?')) onDelete(message.id)
          }}
        >
          <Trash2 size={16} />
        </button>
      )}
    </article>
  )
}
